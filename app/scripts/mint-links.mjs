#!/usr/bin/env node
// Creates a household and its three links. Run once, after the migration.
//   SUPABASE_URL=... SUPABASE_SERVICE_KEY=... node scripts/mint-links.mjs "Posada" Ella Mom Dad
import { createClient } from "@supabase/supabase-js";
import { randomBytes, createHash } from "node:crypto";

const { SUPABASE_URL, SUPABASE_SERVICE_KEY, SITE_URL = "http://localhost:8888" } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_SERVICE_KEY first.");
  process.exit(1);
}
const [householdName = "Home", teen = "Her", ...parents] = process.argv.slice(2);
const db = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const token = () => {
  let n = BigInt("0x" + randomBytes(16).toString("hex")), out = "";
  while (n > 0n) { out = B58[Number(n % 58n)] + out; n /= 58n; }
  return out;
};
const hash = t => createHash("sha256").update(t).digest("hex");

const { data: house, error: he } = await db
  .from("households").insert({ name: householdName }).select().single();
if (he) throw he;

const people = [{ role: "teen", display_name: teen },
  ...(parents.length ? parents : ["Parent"]).map(n => ({ role: "parent", display_name: n }))];

console.log(`\nHousehold "${householdName}" created.\n`);
for (const p of people) {
  const t = token();
  const { error } = await db.from("access_links")
    .insert({ household_id: house.id, token_hash: hash(t), ...p });
  if (error) throw error;
  console.log(`  ${p.display_name.padEnd(8)} ${SITE_URL}/#t=${t}`);
}
console.log(`
Send each person only their own link. Anyone holding a link is that person.
If one leaks, any parent can rotate all three from the parent view.
`);
