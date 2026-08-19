/**
 * Reads a product page.
 *
 * Two passes, cheapest first: a plain fetch that reads Open Graph and schema.org
 * markup (most retailers publish both, costs nothing, and returns in about a second),
 * then Firecrawl only when that came back thin or the site refused us. Roughly one add
 * in five will still come back empty — Instagram shops and some fast-fashion apps block
 * everything — and that is a designed-for path, not an error. This never throws and
 * never returns a non-200 to the client; empty fields simply mean she types it herself.
 */

export type Candidate = {
  name: string | null;
  price_cents: number | null;
  currency: string;
  image_url: string | null;
  source_site: string | null;
  source_url: string;
  confidence: number;
};

const empty = (url: string): Candidate => ({
  name: null, price_cents: null, currency: "USD", image_url: null,
  source_site: hostOf(url), source_url: url, confidence: 0,
});

export function hostOf(url: string): string | null {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
}

export function toCents(raw: unknown): number | null {
  if (raw == null) return null;
  const text = String(raw);
  const m = text.replace(/[ ,]/g, "").match(/(\d+(?:\.\d{1,2})?)/);
  if (!m) return null;
  const n = Math.round(parseFloat(m[1]) * 100);
  return Number.isFinite(n) && n > 0 ? n : null;
}

const META = (html: string, prop: string) => {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']+)["']`, "i");
  const alt = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
  return html.match(re)?.[1] ?? html.match(alt)?.[1] ?? null;
};

function fromJsonLd(html: string) {
  const out: { name?: string; image?: string; price?: string } = {};
  const blocks = html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const b of blocks) {
    let parsed: unknown;
    try { parsed = JSON.parse(b[1].trim()); } catch { continue; }
    const nodes = Array.isArray(parsed) ? parsed : [parsed];
    for (const node of nodes) {
      const n = node as Record<string, any>;
      const graph: Record<string, any>[] = n?.["@graph"] ?? [n];
      for (const g of graph) {
        const type = String(g?.["@type"] ?? "");
        if (!type.includes("Product")) continue;
        out.name ??= typeof g.name === "string" ? g.name : undefined;
        const img = Array.isArray(g.image) ? g.image[0] : g.image;
        out.image ??= typeof img === "string" ? img : img?.url;
        const offers = Array.isArray(g.offers) ? g.offers[0] : g.offers;
        out.price ??= offers?.price ?? offers?.lowPrice;
      }
    }
  }
  return out;
}

async function directRead(url: string) {
  const res = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(6000),
    headers: {
      // identifying as a normal browser; some retailers serve a stub to unknown agents
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      "accept": "text/html,application/xhtml+xml",
      "accept-language": "en-US,en;q=0.9",
    },
  });
  if (!res.ok) return null;
  const html = (await res.text()).slice(0, 900_000);
  const ld = fromJsonLd(html);
  return {
    name: META(html, "og:title") ?? ld.name ?? META(html, "twitter:title"),
    image: META(html, "og:image") ?? ld.image ?? META(html, "twitter:image"),
    price: META(html, "product:price:amount") ?? ld.price ?? META(html, "og:price:amount"),
    currency: META(html, "product:price:currency") ?? META(html, "og:price:currency"),
  };
}

async function firecrawlRead(url: string) {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) return null;
  const res = await fetch("https://api.firecrawl.dev/v2/scrape", {
    method: "POST",
    signal: AbortSignal.timeout(8000),
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      url,
      onlyMainContent: true,
      proxy: "auto",
      formats: [{
        type: "json",
        prompt: "Read this product page and return the item's name, its current price as a number, the currency code, and the URL of the main product photo.",
        schema: {
          type: "object",
          properties: {
            name: { type: "string" },
            price: { type: "number" },
            currency: { type: "string" },
            image: { type: "string" },
          },
        },
      }],
    }),
  });
  if (!res.ok) return null;
  const body = await res.json() as {
    data?: { json?: Record<string, unknown>; metadata?: Record<string, unknown> };
  };
  const j = body?.data?.json ?? {};
  const meta = body?.data?.metadata ?? {};
  return {
    name: (j.name as string) ?? (meta.ogTitle as string) ?? null,
    image: (j.image as string) ?? (meta.ogImage as string) ?? null,
    price: (j.price as number | string) ?? null,
    currency: (j.currency as string) ?? null,
  };
}

const cloudinary = (remote: string | null) => {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!remote || !cloud) return remote;
  // Retailer CDNs hotlink-block and expire URLs; re-serving through Cloudinary also
  // gives every tile the same 4:5 crop the grid depends on.
  return `https://res.cloudinary.com/${cloud}/image/fetch/c_fill,ar_4:5,g_auto,w_600,f_auto,q_auto/${encodeURIComponent(remote)}`;
};

const cache = new Map<string, { at: number; value: Candidate }>();
const TTL = 24 * 60 * 60 * 1000;   // per warm instance only; re-pasting a link is usually free

export async function readProduct(rawUrl: string): Promise<Candidate> {
  let url: string;
  try {
    const u = new URL(rawUrl.trim().startsWith("http") ? rawUrl.trim() : `https://${rawUrl.trim()}`);
    if (u.protocol !== "https:" && u.protocol !== "http:") return empty(rawUrl);
    u.hash = "";
    url = u.toString();
  } catch { return empty(rawUrl); }

  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL) return hit.value;

  let found: Awaited<ReturnType<typeof directRead>> = null;
  try { found = await directRead(url); } catch { /* blocked or slow: fall through */ }

  if (!found?.name || !found?.price) {
    try {
      const fc = await firecrawlRead(url);
      if (fc) found = {
        name: found?.name ?? fc.name,
        image: found?.image ?? fc.image,
        price: found?.price ?? (fc.price == null ? null : String(fc.price)),
        currency: found?.currency ?? fc.currency,
      };
    } catch { /* same: the manual form is the answer */ }
  }

  const price = toCents(found?.price);
  const value: Candidate = {
    name: found?.name?.trim().slice(0, 140) || null,
    price_cents: price,
    currency: (found?.currency || "USD").toUpperCase().slice(0, 3),
    image_url: cloudinary(found?.image ?? null),
    source_site: hostOf(url),
    source_url: url,
    confidence: found?.name && price ? 1 : found?.name ? 0.5 : 0,
  };
  cache.set(url, { at: Date.now(), value });
  return value;
}
