import {
  db, json, handler, loadState, requireTeen, requireParent, HttpError, type Link,
} from "../lib/core.ts";

type Body = {
  action: "create" | "update" | "delete" | "move" | "status";
  id?: string;
  fields?: Record<string, unknown>;
  dir?: -1 | 1;
  status?: string;
};

const OWN_FIELDS = new Set([
  "bucket", "name", "price_cents", "image_url", "source_url", "source_site",
  "notes", "priority", "entry_method",
]);

/** Renumbers a bucket 0..n-1 so manual order stays clean instead of drifting on floats. */
async function renumber(householdId: string, bucket: string, ordered: { id: string }[]) {
  await Promise.all(ordered.map((it, i) =>
    db.from("items").update({ sort_order: i }).eq("id", it.id).eq("household_id", householdId)
  ));
}

export default handler(async (req, link: Link) => {
  const body = (await req.json()) as Body;

  if (body.action === "status") {
    requireParent(link);
    if (!["approved", "declined", "open"].includes(body.status ?? "")) {
      throw new HttpError(400, "Not a status a parent can set");
    }
    await db.from("items").update({ status: body.status, updated_at: new Date().toISOString() })
      .eq("id", body.id!).eq("household_id", link.household_id);
    return json(await loadState(link));
  }

  requireTeen(link);

  if (body.action === "create") {
    const f = body.fields ?? {};
    if (!f.name || !f.bucket) throw new HttpError(400, "It needs a name and a list");
    const { count } = await db.from("items")
      .select("id", { count: "exact", head: true })
      .eq("household_id", link.household_id).eq("bucket", f.bucket);
    const clean = Object.fromEntries(Object.entries(f).filter(([k]) => OWN_FIELDS.has(k)));
    const { error } = await db.from("items")
      .insert({ ...clean, household_id: link.household_id, sort_order: count ?? 0 });
    if (error) throw new HttpError(500, "Could not save it");
    return json(await loadState(link));
  }

  if (body.action === "update") {
    const clean = Object.fromEntries(
      Object.entries(body.fields ?? {}).filter(([k]) => OWN_FIELDS.has(k))
    );
    await db.from("items").update({ ...clean, updated_at: new Date().toISOString() })
      .eq("id", body.id!).eq("household_id", link.household_id);
    return json(await loadState(link));
  }

  if (body.action === "move") {
    const { data: item } = await db.from("items").select("*")
      .eq("id", body.id!).eq("household_id", link.household_id).single();
    if (!item) throw new HttpError(404, "Can't find that one");
    const { data: siblings } = await db.from("items").select("*")
      .eq("household_id", link.household_id).eq("bucket", item.bucket)
      .neq("status", "purchased").order("priority").order("sort_order");
    const list = siblings ?? [];
    const i = list.findIndex(x => x.id === item.id);
    const j = i + (body.dir ?? 0);
    if (j < 0 || j >= list.length) return json(await loadState(link));

    // Crossing a priority boundary adopts the neighbour's band AND takes its place.
    // Adopting the band alone leaves the item sorting exactly where it was, so the
    // arrow would appear to do nothing — the one thing a reorder control must never do.
    const other = list[j];
    if (other.priority !== item.priority) {
      await db.from("items").update({ priority: other.priority })
        .eq("id", item.id).eq("household_id", link.household_id);
    }
    [list[i], list[j]] = [list[j], list[i]];
    await renumber(link.household_id, item.bucket, list);
    return json(await loadState(link));
  }

  if (body.action === "delete") {
    // Money first, and in this order. Her direct-to-goal entries never passed through
    // the balance, so they come back as deposits; allocations and pledges are removed
    // by the cascade, which returns her balance and frees the pot.
    await db.from("contributions")
      .update({ item_id: null, kind: "deposit", note: "back from a deleted goal" })
      .eq("household_id", link.household_id).eq("item_id", body.id!).eq("kind", "direct");
    await db.from("items").delete().eq("id", body.id!).eq("household_id", link.household_id);
    return json(await loadState(link));
  }

  throw new HttpError(400, "Unknown action");
});
export const config = { path: "/api/item" };
