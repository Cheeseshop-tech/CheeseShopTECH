import { json, handler } from "../lib/core.ts";
import { readProduct } from "../lib/scrape.ts";

export default handler(async req => {
  const { url } = (await req.json()) as { url?: string };
  if (!url) return json({ error: "No link" }, 400);
  // Always 200, even when nothing was found: a failed read must never cost her the item.
  return json(await readProduct(url));
});
export const config = { path: "/api/scrape" };
