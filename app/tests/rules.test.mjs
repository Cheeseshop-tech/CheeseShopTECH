process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_KEY = "test-key";
const { allowedStatusFor, balanceOf, pledgedOf, onItemBy } =
  await import("../netlify/lib/core.ts");

let pass = 0, fail = 0;
const eq = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`${ok ? "ok  " : "FAIL"} ${name}${ok ? "" : `  got ${JSON.stringify(got)} want ${JSON.stringify(want)}`}`);
};

eq("a parent may approve", allowedStatusFor("parent").includes("approved"), true);
eq("a parent may NOT mark something bought", allowedStatusFor("parent").includes("purchased"), false);
eq("she may mark something bought", allowedStatusFor("teen").includes("purchased"), true);
eq("she may NOT approve her own request", allowedStatusFor("teen").includes("approved"), false);
eq("both may reopen", ["teen","parent"].every(r => allowedStatusFor(r).includes("open")), true);

const L = (kind, amount, source = "teen", item = null) =>
  ({ kind, amount_cents: amount, source, item_id: item, fulfilled_at: null });

eq("balance counts deposits and spends allocations",
  balanceOf([L("deposit", 6000), L("allocate", 4000, "teen", "g1")]), 2000);
eq("direct money never touches the balance",
  balanceOf([L("deposit", 6000), L("direct", 2500, "teen", "g1")]), 6000);
eq("taking money back off a goal restores the balance",
  balanceOf([L("deposit", 6000), L("allocate", 4000, "teen", "g1"), L("allocate", -4000, "teen", "g1")]), 6000);
eq("a pledge never counts as her money",
  balanceOf([L("deposit", 1000), L("pledged", 9000, "parent", "g1")]), 1000);
eq("the pot counts every pledge",
  pledgedOf([L("pledged", 6000, "parent", "g1"), L("pledged", 5000, "parent", "g2")]), 11000);
eq("money on a goal is hers plus theirs, counted once",
  [onItemBy([L("allocate", 4000, "teen", "g1"), L("direct", 1500, "teen", "g1"), L("pledged", 6000, "parent", "g1")], "g1", "teen"),
   onItemBy([L("allocate", 4000, "teen", "g1"), L("pledged", 6000, "parent", "g1")], "g1", "parent")],
  [5500, 6000]);
eq("money on another goal doesn't leak in",
  onItemBy([L("allocate", 4000, "teen", "g2")], "g1", "teen"), 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
