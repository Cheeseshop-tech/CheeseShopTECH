import type { State } from "../types";
import { BUCKETS, C, onItemBy, unfulfilledOn } from "../money";
import { Shot } from "../ui";

export function Detail({ state, itemId, go, actions }: {
  state: State; itemId: string; go: (s: string) => void;
  actions: {
    allocate: () => void; takeBack: () => void; addNew: () => void;
    pledge: () => void; setStatus: (s: string) => void; fulfill: (id: string, done: boolean) => void;
  };
}) {
  const item = state.items.find(i => i.id === itemId);
  if (!item) return null;

  const isParent = state.me.role === "parent";
  const hers = onItemBy(state.ledger, item.id, "teen");
  const theirs = onItemBy(state.ledger, item.id, "parent");
  const owed = unfulfilledOn(state.ledger, item.id);
  const price = item.price_cents ?? 0;
  const pct = (n: number) => (price ? Math.min(100, (n / price) * 100) : 0);
  const history = state.ledger.filter(e => e.item_id === item.id);

  return (
    <>
      <div className="topbar">
        <button className="back" onClick={() => go("list")}>← {BUCKETS[item.bucket]}</button>
      </div>
      <div className="scroll">
        <div className="hero"><Shot item={item} /></div>
        <span className="eyebrow">{item.source_site}</span>
        <h2 style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-.03em", margin: "6px 0 4px" }}>
          {item.name}
        </h2>
        <p className="num" style={{ fontSize: 20, fontWeight: 700, margin: "0 0 16px" }}>
          {item.price_cents == null ? "No price yet" : C(item.price_cents)}
        </p>

        {item.source_url ? (
          <a className="btn sm quiet" style={{ marginBottom: 14 }} href={item.source_url}
            target="_blank" rel="noreferrer noopener">Open the shop</a>
        ) : null}

        {item.bucket === "goal" ? (
          <>
            <div className="money">
              <span className="bar" style={{ marginBottom: 10 }}>
                <i className="h" style={{ width: `${pct(hers)}%` }} />
                <i className={owed ? "p" : "t"} style={{ width: `${pct(theirs)}%` }} />
              </span>
              <div className="key">
                <span><i className="dot" style={{ background: "var(--her)" }} />Hers <b className="num">{C(hers)}</b></span>
                <span><i className="dot" style={{ background: "var(--them)" }} />Theirs <b className="num">{C(theirs)}</b></span>
                <span>Still needed <b className="num">{C(Math.max(0, price - hers - theirs))}</b></span>
              </div>
              {owed ? <p className="note">{C(owed)} of that is promised but not handed over yet.</p> : null}
            </div>

            {isParent ? (
              <button className="btn sm" style={{ marginBottom: 12 }} onClick={actions.pledge}>
                Pledge from the pot
              </button>
            ) : (
              <div className="pair" style={{ marginBottom: 12 }}>
                <button className="btn sm" onClick={actions.allocate}
                  disabled={state.balance <= 0}>Use her savings</button>
                <button className="btn sm quiet" onClick={actions.addNew}>Add new money</button>
              </div>
            )}
            {!isParent && hers > 0 ? (
              <button className="btn sm quiet" style={{ marginBottom: 12 }} onClick={actions.takeBack}>
                Take some back off this
              </button>
            ) : null}
          </>
        ) : null}

        {isParent ? (
          <div className="pair" style={{ marginBottom: 12 }}>
            <button className="btn sm dark" onClick={() => actions.setStatus("approved")}>Approve</button>
            <button className="btn sm quiet" onClick={() => actions.setStatus("declined")}>Not now</button>
          </div>
        ) : null}

        {history.length ? <span className="eyebrow">History</span> : null}
        {history.map(e => {
          const who = e.link_id ? state.people[e.link_id] : null;
          const label = e.kind === "pledged"
            ? `${who ?? "A parent"} pledged${e.fulfilled_at ? "" : " (not handed over yet)"}`
            : e.kind === "direct" ? "She put money straight on it"
            : e.amount_cents < 0 ? "She took some back" : "She moved savings over";
          return (
            <div className="led" key={e.id}>
              <div className="w">
                <div className="t">{label}</div>
                <div className="m">
                  {e.note || new Date(e.created_at).toLocaleDateString(undefined,
                    { month: "short", day: "numeric" })}
                </div>
              </div>
              <div className="a num">{C(Math.abs(e.amount_cents))}</div>
              {isParent && e.kind === "pledged" ? (
                <button className="btn sm quiet" style={{ width: "auto", padding: "7px 11px", fontSize: 12 }}
                  onClick={() => actions.fulfill(e.id, !e.fulfilled_at)}>
                  {e.fulfilled_at ? "Undo" : "Paid"}
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
    </>
  );
}
