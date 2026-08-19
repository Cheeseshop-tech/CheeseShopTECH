import {
  db, json, handler, loadState, balanceOf, requireTeen, requireParent,
  HttpError, type Entry, type Link,
} from "../lib/core.ts";

type Body = {
  action: "deposit" | "allocate" | "direct" | "pledge" | "fulfill" | "unfulfill" | "setPot";
  itemId?: string;
  entryId?: string;
  amountCents?: number;
  note?: string;
};

const amountOf = (b: Body) => {
  const n = Math.round(Number(b.amountCents));
  if (!Number.isFinite(n) || n === 0) throw new HttpError(400, "That isn't an amount");
  return n;
};

export default handler(async (req, link: Link) => {
  const body = (await req.json()) as Body;

  if (body.action === "setPot") {
    requireParent(link);
    const n = Math.max(0, Math.round(Number(body.amountCents)));
    if (!Number.isFinite(n)) throw new HttpError(400, "That isn't an amount");
    await db.from("households")
      .update({ goal_budget_cents: n, updated_at: new Date().toISOString() })
      .eq("id", link.household_id);
    return json(await loadState(link));
  }

  if (body.action === "fulfill" || body.action === "unfulfill") {
    requireParent(link);
    await db.from("contributions")
      .update({ fulfilled_at: body.action === "fulfill" ? new Date().toISOString() : null })
      .eq("id", body.entryId!).eq("household_id", link.household_id).eq("kind", "pledged");
    return json(await loadState(link));
  }

  if (body.action === "pledge") {
    requireParent(link);
    const amount = amountOf(body);
    if (!body.itemId) throw new HttpError(400, "Pledges go to a specific goal");
    const { error } = await db.from("contributions").insert({
      household_id: link.household_id, item_id: body.itemId, link_id: link.id,
      source: "parent", kind: "pledged", amount_cents: amount, note: body.note ?? null,
    });
    if (error) throw new HttpError(500, "Could not record that pledge");
    // Deliberately not blocked when it exceeds the pot: a parent may promise their own
    // kid money. The parent view shows the pot over-allocated in red instead.
    return json(await loadState(link));
  }

  requireTeen(link);
  const amount = amountOf(body);

  if (body.action === "deposit") {
    await db.from("contributions").insert({
      household_id: link.household_id, item_id: null, link_id: link.id,
      source: "teen", kind: "deposit", amount_cents: amount, note: body.note ?? null,
    });
    return json(await loadState(link));
  }

  if (body.action === "direct") {
    if (!body.itemId) throw new HttpError(400, "That needs a goal to go on");
    await db.from("contributions").insert({
      household_id: link.household_id, item_id: body.itemId, link_id: link.id,
      source: "teen", kind: "direct", amount_cents: amount, note: body.note ?? null,
    });
    return json(await loadState(link));
  }

  if (body.action === "allocate") {
    if (!body.itemId) throw new HttpError(400, "That needs a goal to go on");
    const { data } = await db.from("contributions").select("*").eq("household_id", link.household_id);
    const ledger = (data ?? []) as Entry[];

    if (amount > 0 && amount > balanceOf(ledger)) {
      // Her balance is money that exists or doesn't — unlike a parent pledge, this is refused.
      throw new HttpError(400, "That's more than she has saved");
    }
    if (amount < 0) {
      const onIt = ledger.reduce((n, e) =>
        e.item_id === body.itemId && e.kind === "allocate" ? n + e.amount_cents : n, 0);
      if (-amount > onIt) throw new HttpError(400, "There isn't that much of hers on it");
    }
    await db.from("contributions").insert({
      household_id: link.household_id, item_id: body.itemId, link_id: link.id,
      source: "teen", kind: "allocate", amount_cents: amount,
      note: body.note ?? (amount < 0 ? "changed her mind" : null),
    });
    return json(await loadState(link));
  }

  throw new HttpError(400, "Unknown action");
});
export const config = { path: "/api/money" };
