import { db, json, handler, requireParent, b58, sha, HttpError } from "../lib/core.ts";

/** Regenerates every link in the household. Old links die immediately. */
export default handler(async (req, link) => {
  requireParent(link);
  // Netlify routes functions through an internal host, so req.url is not reliably the
  // site's own origin — a link built from it can point somewhere nobody can open.
  const origin = process.env.URL ?? new URL(req.url).origin;

  const { data: people, error } = await db.from("access_links")
    .select("id, display_name, role").eq("household_id", link.household_id).is("revoked_at", null);
  if (error || !people) throw new HttpError(500, "Could not read the links");

  const minted = await Promise.all(people.map(async p => {
    const token = b58();
    const { error: e } = await db.from("access_links")
      .update({ token_hash: sha(token) }).eq("id", p.id);
    if (e) throw new HttpError(500, "Could not rotate the links");
    return { name: p.display_name, role: p.role, url: `${origin}/#t=${token}` };
  }));

  return json({ links: minted });
});
export const config = { path: "/api/rotate" };
