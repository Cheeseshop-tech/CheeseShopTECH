import type { Entry, Item } from "./types";

export const C = (cents: number | null | undefined): string => {
  const c = cents ?? 0;
  const abs = Math.abs(c);
  return (c < 0 ? "−" : "") + "$" +
    (abs / 100).toFixed(abs % 100 ? 2 : 0).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
};

export const onItemBy = (ledger: Entry[], itemId: string, source: "teen" | "parent") =>
  ledger.reduce((n, e) => {
    if (e.item_id !== itemId) return n;
    if (source === "teen" && (e.kind === "allocate" || e.kind === "direct")) return n + e.amount_cents;
    if (source === "parent" && e.kind === "pledged") return n + e.amount_cents;
    return n;
  }, 0);

export const unfulfilledOn = (ledger: Entry[], itemId: string) =>
  ledger.reduce((n, e) =>
    e.item_id === itemId && e.kind === "pledged" && !e.fulfilled_at ? n + e.amount_cents : n, 0);

/**
 * The server already returns items in this order; sorting again here means the list
 * can never disagree with itself if a response arrives out of order or an optimistic
 * update lands first. Stable sort, so manual order holds inside a priority band.
 */
export const inBucket = (items: Item[], bucket: string) =>
  items
    .filter(i => i.bucket === bucket && i.status !== "purchased" && i.status !== "archived")
    .sort((a, b) => a.priority - b.priority || a.sort_order - b.sort_order);

export const PRI: Record<number, string> = { 1: "Must have", 2: "Would like", 3: "Someday" };
export const priColor = (p: number) =>
  p === 1 ? "var(--over)" : p === 2 ? "var(--them)" : "var(--ink-30)";
export const BUCKETS = { need: "Needs", want: "Wants", goal: "Goals" } as const;

export const parseAmount = (raw: string): number | null => {
  const n = Math.round(parseFloat(raw.replace(/[^0-9.]/g, "")) * 100);
  return Number.isFinite(n) && n > 0 ? n : null;
};
