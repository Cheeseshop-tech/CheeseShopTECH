import { useState } from "react";
import type { Item, State } from "../types";
import { BUCKETS, C, inBucket, onItemBy } from "../money";
import { Row, Shot, StatusPill, Tile } from "../ui";

export function GoalCard({ item, ledger, onOpen }: {
  item: Item; ledger: State["ledger"]; onOpen: () => void;
}) {
  const hers = onItemBy(ledger, item.id, "teen");
  const theirs = onItemBy(ledger, item.id, "parent");
  const price = item.price_cents ?? 0;
  const pct = (n: number) => (price ? Math.min(100, (n / price) * 100) : 0);
  const left = Math.max(0, price - hers - theirs);
  return (
    <button className="goal" onClick={onOpen}>
      <span className="row" style={{ border: 0, padding: 0 }}>
        <span className="thumb"><Shot item={item} mini /></span>
        <span style={{ flex: 1 }}>
          <h3>{item.name}</h3>
          <span className="of num">
            {C(hers + theirs)} of {C(price)}{left ? ` · ${C(left)} to go` : " · fully funded"}
          </span>
        </span>
        <StatusPill status={item.status} chip />
      </span>
      <span className="bar">
        <i className="h" style={{ width: `${pct(hers)}%` }} />
        <i className="t" style={{ width: `${pct(theirs)}%` }} />
      </span>
      <span className="key">
        <span><i className="dot" style={{ background: "var(--her)" }} />She saved <b className="num">{C(hers)}</b></span>
        <span><i className="dot" style={{ background: "var(--them)" }} />Pledged <b className="num">{C(theirs)}</b></span>
      </span>
    </button>
  );
}

export function List({ state, go, act }: {
  state: State;
  go: (screen: string, itemId?: string) => void;
  act: {
    move: (id: string, d: -1 | 1) => void;
    priority: (item: Item) => void;
    remove: (item: Item) => void;
  };
}) {
  const [tab, setTab] = useState<"need" | "want" | "goal">("need");
  const [mode, setMode] = useState<"grid" | "list">(
    () => (localStorage.getItem("dm.mode") as "grid" | "list") ?? "grid"
  );
  const setView = (m: "grid" | "list") => { localStorage.setItem("dm.mode", m); setMode(m); };

  const [showGot, setShowGot] = useState(false);
  const list = inBucket(state.items, tab);
  const total = list.reduce((n, i) => n + (i.price_cents ?? 0), 0);
  const got = state.items.filter(i => i.bucket === tab && i.status === "purchased");

  const money = (
    <div className="money">
      <div className="two">
        <div className="half">
          <div className="cap">Her savings</div>
          <div className="fig her num">{C(state.balance)}</div>
        </div>
        <div className="half">
          <div className="cap">Parents left</div>
          <div className="fig them num"
            style={state.pot - state.pledged < 0 ? { color: "var(--over)" } : undefined}>
            {C(state.pot - state.pledged)}
          </div>
        </div>
      </div>
      <button className="btn sm dark" style={{ marginTop: 11 }} onClick={() => go("savings")}>
        Open savings
      </button>
    </div>
  );

  return (
    <>
      <div className="topbar"><h1 className="brand">Dream<em>Machine</em></h1></div>
      <div className="scroll">
        <div className="tabs">
          {(["need", "want", "goal"] as const).map(b => (
            <button key={b} onClick={() => setTab(b)} aria-selected={b === tab}>
              {BUCKETS[b]}<span className="count num">{inBucket(state.items, b).length}</span>
            </button>
          ))}
          <span className="viewtog">
            <button onClick={() => setView("grid")} aria-pressed={mode === "grid"}>Grid</button>
            <button onClick={() => setView("list")} aria-pressed={mode === "list"}>List</button>
          </span>
        </div>

        {list.length === 0 ? (
          <div className="empty">
            <h3>{tab === "goal" ? "Nothing saved for yet" : "Nothing here yet"}</h3>
            {tab === "goal"
              ? "A goal is something big enough to save toward — a camera, a bag, a coat you keep going back to."
              : "Paste a link and it lands here."}
            <div style={{ marginTop: 18 }}>
              <button className="btn sm" style={{ width: "auto", padding: "11px 22px", display: "inline-block" }}
                onClick={() => go("add")}>Add something</button>
            </div>
          </div>
        ) : mode === "list" ? (
          <>
            {tab === "goal" ? money : null}
            <p className="hint">Arrows move things up and down. Tap the label to change how badly she wants it.</p>
            {list.map((it, i) => (
              <Row key={it.id} item={it} first={i === 0} last={i === list.length - 1}
                onOpen={() => go("detail", it.id)}
                onMove={d => act.move(it.id, d)}
                onPriority={() => act.priority(it)}
                onDelete={() => act.remove(it)} />
            ))}
            <p className="note">{list.length} open · {C(total)} all in</p>
          </>
        ) : tab === "goal" ? (
          <>
            {money}
            {list.map(it => (
              <GoalCard key={it.id} item={it} ledger={state.ledger} onOpen={() => go("detail", it.id)} />
            ))}
          </>
        ) : (
          <>
            <div className="grid">
              {list.map(it => <Tile key={it.id} item={it} onOpen={() => go("detail", it.id)} />)}
            </div>
            <p className="note">{list.length} open · {C(total)} all in</p>
          </>
        )}
        {got.length ? (
          <>
            <button className="btn sm quiet" style={{ marginTop: 18 }}
              onClick={() => setShowGot(v => !v)}>
              Got it · {got.length}
            </button>
            {showGot ? got.map(it => (
              <div className="led" key={it.id}>
                <button className="w ropen" onClick={() => go("detail", it.id)}>
                  <div className="t">{it.name}</div>
                  <div className="m">{it.source_site}</div>
                </button>
                <div className="a num">{C(it.price_cents ?? 0)}</div>
              </div>
            )) : null}
          </>
        ) : null}
      </div>
    </>
  );
}
