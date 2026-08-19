import { createClient } from "@supabase/supabase-js";
import { createHash, randomBytes } from "node:crypto";

export const db = createClient(
  process.env.SUPABASE_URL ?? "",
  process.env.SUPABASE_SERVICE_KEY ?? "",
  { auth: { persistSession: false } }
);

export const sha = (t: string) => createHash("sha256").update(t).digest("hex");

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });

export class HttpError extends Error {
  status: number;
  // written out rather than a parameter property so this module can be run directly
  // by node's type-stripping, which the rule tests rely on
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export type Role = "teen" | "parent";
export type Link = {
  id: string; household_id: string; role: Role; display_name: string;
};
export type Kind = "deposit" | "allocate" | "direct" | "pledged";
export type Entry = {
  id: string; item_id: string | null; link_id: string | null; source: "teen" | "parent";
  kind: Kind; amount_cents: number; fulfilled_at: string | null; note: string | null;
  created_at: string;
};

/**
 * Failed-token throttle. This lives in module memory, so it only covers one warm
 * instance — a determined attacker could dodge it by forcing cold starts. At three
 * users that is an acceptable trade; a shared counter table is the upgrade if this
 * ever stops being a family app.
 */
const misses = new Map<string, { n: number; until: number }>();
const THROTTLE = { max: 20, windowMs: 60_000 };

/**
 * Statuses each role may set. Kept here as a pure rule so it can be tested without
 * a database, and so the two roles can't quietly drift apart.
 */
export const allowedStatusFor = (role: Role): string[] =>
  role === "parent" ? ["approved", "declined", "open"] : ["purchased", "open"];

export async function authenticate(req: Request, allowQueryToken = false): Promise<Link> {
  // A token in a query string ends up in server logs and Referer headers, which is the
  // whole reason it normally travels in the URL hash. Only the share endpoint accepts
  // one that way, because an iOS Shortcut cannot always set a header.
  const token = req.headers.get("x-dm-token")
    ?? (allowQueryToken ? new URL(req.url).searchParams.get("t") : null)
    ?? "";
  if (!token) throw new HttpError(401, "No link token");

  const ip = req.headers.get("x-nf-client-connection-ip") ?? "unknown";
  const seen = misses.get(ip);
  const now = Date.now();
  if (seen && seen.until > now && seen.n >= THROTTLE.max) {
    throw new HttpError(429, "Too many tries — wait a minute");
  }

  const { data, error } = await db
    .from("access_links")
    .select("id, household_id, role, display_name, revoked_at")
    .eq("token_hash", sha(token))
    .maybeSingle();

  if (error) throw new HttpError(500, "Could not check that link");
  if (!data || data.revoked_at) {
    const rec = seen && seen.until > now ? seen : { n: 0, until: now + THROTTLE.windowMs };
    rec.n += 1;
    misses.set(ip, rec);
    throw new HttpError(401, "That link isn't valid anymore");
  }
  misses.delete(ip);

  // fire-and-forget: powers the parent's "new since you last looked"
  void db.from("access_links").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id);

  return data as Link;
}

export const requireTeen = (link: Link) => {
  if (link.role !== "teen") throw new HttpError(403, "Only she can change her list");
};
export const requireParent = (link: Link) => {
  if (link.role !== "parent") throw new HttpError(403, "Only a parent can do that");
};

/** Her unspent money. Deposits are the only entries that add to it; allocations spend it. */
export const balanceOf = (ledger: Entry[]) =>
  ledger.reduce((n, e) =>
    e.source !== "teen" ? n
      : e.kind === "deposit" ? n + e.amount_cents
      : e.kind === "allocate" ? n - e.amount_cents
      : n, 0);

/** Parent money already promised to specific goals. */
export const pledgedOf = (ledger: Entry[]) =>
  ledger.reduce((n, e) => (e.kind === "pledged" ? n + e.amount_cents : n), 0);

export const onItemBy = (ledger: Entry[], itemId: string, source: "teen" | "parent") =>
  ledger.reduce((n, e) => {
    if (e.item_id !== itemId) return n;
    if (source === "teen" && (e.kind === "allocate" || e.kind === "direct")) return n + e.amount_cents;
    if (source === "parent" && e.kind === "pledged") return n + e.amount_cents;
    return n;
  }, 0);

export async function loadState(link: Link) {
  const [house, items, ledger] = await Promise.all([
    db.from("households").select("id, name, goal_budget_cents").eq("id", link.household_id).single(),
    db.from("items").select("*").eq("household_id", link.household_id)
      .order("priority").order("sort_order"),
    db.from("contributions").select("*").eq("household_id", link.household_id)
      .order("created_at"),
  ]);
  if (house.error || items.error || ledger.error) throw new HttpError(500, "Could not load the list");

  const entries = (ledger.data ?? []) as Entry[];
  const people = await db.from("access_links")
    .select("id, display_name, role").eq("household_id", link.household_id);

  return {
    me: { name: link.display_name, role: link.role },
    pot: house.data.goal_budget_cents,
    balance: balanceOf(entries),
    pledged: pledgedOf(entries),
    items: items.data ?? [],
    ledger: entries,
    people: Object.fromEntries((people.data ?? []).map(p => [p.id, p.display_name])),
  };
}

export const b58 = () => {
  let n = BigInt("0x" + randomBytes(16).toString("hex")), out = "";
  const A = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  while (n > 0n) { out = A[Number(n % 58n)] + out; n /= 58n; }
  return out;
};

/** Wraps a handler so thrown HttpErrors become clean JSON and nothing else leaks. */
export const handler = (
  fn: (req: Request, link: Link) => Promise<Response>,
  opts: { allowQueryToken?: boolean } = {}
) =>
  async (req: Request): Promise<Response> => {
    try {
      const link = await authenticate(req, opts.allowQueryToken === true);
      return await fn(req, link);
    } catch (err) {
      if (err instanceof HttpError) return json({ error: err.message }, err.status);
      console.error(err);
      return json({ error: "Something went wrong" }, 500);
    }
  };
