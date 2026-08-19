import type { Item, State } from "../types";
import { C } from "../money";

export function Savings({ state, go, onAdd }: {
  state: State; go: (s: string) => void; onAdd: () => void;
}) {
  const mine = state.ledger.filter(e => e.source === "teen").slice().reverse();
  const byId = new Map<string, Item>(state.items.map(i => [i.id, i]));

  return (
    <>
      <div className="topbar"><button className="back" onClick={() => go("list")}>← Back</button></div>
      <div className="scroll">
        <span className="eyebrow">Money she has</span>
        <p className="num" style={{
          fontSize: 52, fontWeight: 800, letterSpacing: "-.04em",
          margin: "2px 0 4px", color: "var(--her)",
        }}>{C(state.balance)}</p>
        <p style={{ color: "var(--ink-60)", fontSize: 13, margin: "0 0 18px" }}>
          not yet promised to anything
        </p>

        <div className="pair" style={{ marginBottom: 8 }}>
          <button className="btn sm" onClick={onAdd}>Add money</button>
          <button className="btn sm quiet" onClick={() => go("list")}>Put toward a goal</button>
        </div>
        <p className="note" style={{ marginBottom: 20 }}>
          Parents can see this number. They can't move it.
        </p>

        <span className="eyebrow">Everything so far</span>
        {mine.length === 0
          ? <p className="note">Nothing yet. When she earns something, log it here and it'll be
              ready to put toward a goal.</p>
          : mine.map(e => {
              const goal = e.item_id ? byId.get(e.item_id) : null;
              const label = e.kind === "deposit" ? "Money in"
                : e.kind === "direct" ? `Straight onto ${goal?.name ?? "a goal"}`
                : e.amount_cents < 0 ? `Taken back off ${goal?.name ?? "a goal"}`
                : `Moved to ${goal?.name ?? "a goal"}`;
              const positive = e.kind === "deposit" || e.amount_cents < 0;
              return (
                <div className="led" key={e.id}>
                  <div className="w">
                    <div className="t">{label}</div>
                    <div className="m">
                      {e.note || new Date(e.created_at).toLocaleDateString(undefined,
                        { month: "short", day: "numeric" })}
                    </div>
                  </div>
                  <div className={`a num ${positive ? "pos" : "neg"}`}>
                    {positive ? "+" : "−"}{C(Math.abs(e.amount_cents))}
                  </div>
                </div>
              );
            })}
      </div>
    </>
  );
}
