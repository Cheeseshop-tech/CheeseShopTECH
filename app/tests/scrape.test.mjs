process.env.CLOUDINARY_CLOUD_NAME = "demo";
const { readProduct, toCents, hostOf } = await import("../netlify/lib/scrape.ts");

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `\n     got  ${JSON.stringify(got)}\n     want ${JSON.stringify(want)}`}`);
};

eq("toCents plain", toCents("34.00"), 3400);
eq("toCents currency symbol", toCents("$1,299.99"), 129999);
eq("toCents integer", toCents(68), 6800);
eq("toCents junk", toCents("Sold out"), null);
eq("toCents empty", toCents(null), null);
eq("host strips www", hostOf("https://www.depop.com/products/x"), "depop.com");

// Open Graph, the common case
const OG = `<html><head>
  <meta property="og:title" content="Rare Beauty Soft Pinch Blush" />
  <meta property="og:image" content="https://cdn.sephora.com/x.jpg" />
  <meta property="product:price:amount" content="23.00" />
  <meta property="product:price:currency" content="USD" />
</head></html>`;

// schema.org only, no OG price — the other common shape
const LD = `<html><head><script type="application/ld+json">
{"@context":"https://schema.org","@type":"Product","name":"Vintage Carhartt jacket",
 "image":["https://cdn.depop.com/j.jpg"],"offers":{"@type":"Offer","price":"54.00","priceCurrency":"USD"}}
</script></head></html>`;

// a page that gives us nothing — the ~1-in-5 case
const BLANK = `<html><head><title>Login</title></head><body>Sign in to continue</body></html>`;

const serve = html => (global.fetch = async () => new Response(html, {
  status: 200, headers: { "content-type": "text/html" },
}));

serve(OG);
let r = await readProduct("https://sephora.com/product/rare-beauty");
eq("og name", r.name, "Rare Beauty Soft Pinch Blush");
eq("og price", r.price_cents, 2300);
eq("og confidence", r.confidence, 1);
eq("image goes through cloudinary", r.image_url?.startsWith("https://res.cloudinary.com/demo/image/fetch/c_fill,ar_4:5"), true);

serve(LD);
r = await readProduct("https://depop.com/products/carhartt");
eq("json-ld name", r.name, "Vintage Carhartt jacket");
eq("json-ld price", r.price_cents, 5400);
eq("json-ld site", r.source_site, "depop.com");

serve(BLANK);
r = await readProduct("https://instagram.com/shop/xyz");
eq("blocked page yields empty fields", [r.name, r.price_cents, r.confidence], [null, null, 0]);
eq("blocked page still names the site", r.source_site, "instagram.com");

global.fetch = async () => { throw new Error("ECONNREFUSED"); };
r = await readProduct("https://nowhere.example/thing");
eq("network failure never throws", r.confidence, 0);

r = await readProduct("javascript:alert(1)");
eq("non-http scheme refused", r.confidence, 0);

serve(OG);
const cached = await readProduct("https://sephora.com/product/rare-beauty#ref=abc");
eq("hash is ignored so the cache still hits", cached.name, "Rare Beauty Soft Pinch Blush");

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
