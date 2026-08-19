import { db, json, handler, requireTeen, HttpError } from "../lib/core.ts";
import { readProduct } from "../lib/scrape.ts";

/**
 * The share-sheet front door. An iOS Shortcut (or an Android share target) sends a URL
 * here and the item lands without the app coming to the foreground. Bucket defaults to
 * Wants — asking a question at share time would defeat the point.
 */
export default handler(async (req, link) => {
  requireTeen(link);
  const url = new URL(req.url);
  const body = req.method === "POST"
    ? await req.json().catch(() => ({})) as { url?: string; bucket?: string }
    : {};
  const target = body.url ?? url.searchParams.get("url");
  if (!target) throw new HttpError(400, "No link to add");

  const bucket = body.bucket ?? url.searchParams.get("bucket") ?? "want";
  if (!["need", "want", "goal"].includes(bucket)) throw new HttpError(400, "Not a list");

  const found = await readProduct(target);
  const { count } = await db.from("items").select("id", { count: "exact", head: true })
    .eq("household_id", link.household_id).eq("bucket", bucket);

  const { error } = await db.from("items").insert({
    household_id: link.household_id,
    bucket,
    name: found.name ?? "Untitled — open the app to name it",
    price_cents: found.price_cents,
    currency: found.currency,
    image_url: found.image_url,
    source_url: found.source_url,
    source_site: found.source_site,
    entry_method: found.confidence > 0 ? "auto" : "manual",
    sort_order: count ?? 0,
  });
  if (error) throw new HttpError(500, "Could not save it");

  return json({ ok: true, name: found.name, bucket, filled: found.confidence > 0 });
}, { allowQueryToken: true });
export const config = { path: "/api/share" };
