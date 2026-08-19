import { useState } from "react";
import { api } from "../api";
import type { State } from "../types";
import { BUCKETS, C, inBucket } from "../money";
import { Shot } from "../ui";

export function Parent({ state, go, onSetPot, onPledge, apply }: {
  state: State;
  go: (s: string, id?: string) => void;
  onSetPot: () => void;
  onPledge: (itemId: string) => void;
  apply: (s: State) => void;
}) {
  const [links, setLinks] = useState<{ name: string; url: string }[] | null>(null);
  const [rotating, setRotating] = useState(false);
  const left = state.pot - state.pledged;
  const waiting = state.items.filter(i => i.status === "open");

  const rotate = async () => {
    setRotating(true);
    try {
      const res = await api.rotate();
      setLinks(res.links);
      apply(await api.state());
    } finally { setRotating(false); }
  };

  return (
    <>
      <div className="topbar" style={{ display: "flex", alignItems: "center" }}>
        <h1 className="brand">Dream<em>Machine</em></h1>
        <span className="eyebrow" style={{ marginLeft: "auto" }}>{state.me.name}</span>
      </div>
      <div className="scroll">
        {left < 0 ? (
          <div className="warn">
            You've promised {C(-left)} more than the pot holds. Raise it, or pull a pledge back.
          </div>
        ) : null}

        <div className="money">
          <div className="cap">The pot</div>
          <div className="fig num" style={{ color: left < 0 ? "var(--over)" : "var(--ink)" }}>
            {C(state.pot)}
          </div>
          <div className="two" style={{ marginTop: 12 }}>
            <div className="half">
              <div className="cap">Promised out</div>
              <div className="fig them num" style={{ fontSize: 18 }}>{C(state.pledged)}</div>
            </div>
            <div className="half">
              <div className="cap">Still free</div>
              <div className="fig num"
                style={{ fontSize: 18, color: left < 0 ? "var(--over)" : "var(--done)" }}>{C(left)}</div>
            </div>
          </div>
          <div className="pair" style={{ marginTop: 11 }}>
            <button className="btn sm dark" onClick={onSetPot}>Change the pot</button>
            <button className="btn sm quiet">Her savings · {C(state.balance)}</button>
          </div>
        </div>

        <span className="eyebrow">Waiting on you · {waiting.length}</span>
        <div style={{ marginTop: 10 }}>
          {waiting.map(it => (
            <div className="goal" key={it.id} style={{ cursor: "default" }}>
              <div className="row" style={{ border: 0, padding: 0 }}>
                <span className="thumb"><Shot item={it} mini /></span>
                <span style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 15 }}>{it.name}</h3>
                  <span className="of num">
                    {it.price_cents == null ? "no price" : C(it.price_cents)} · {BUCKETS[it.bucket].replace(/s$/, "")} · {it.source_site}
                  </span>
                </span>
              </div>
              <div className="pair">
                <button className="btn sm dark"
                  onClick={async () => apply(await api.setStatus(it.id, "approved"))}>Approve</button>
                <button className="btn sm quiet"
                  onClick={async () => apply(await api.setStatus(it.id, "declined"))}>Not now</button>
              </div>
              {it.bucket === "goal" ? (
                <button className="btn sm" onClick={() => onPledge(it.id)}>Pledge from the pot</button>
              ) : null}
              <button className="btn sm quiet" onClick={() => go("detail", it.id)}>Open</button>
            </div>
          ))}
          {waiting.length === 0 ? <p className="note">Nothing needs a decision right now.</p> : null}
        </div>

        <span className="eyebrow">Everything she's added</span>
        <div style={{ marginTop: 10, marginBottom: 20 }}>
          {(["need", "want", "goal"] as const).map(b => (
            <div className="led" key={b}>
              <div className="w"><div className="t">{BUCKETS[b]}</div></div>
              <div className="a num">
                {C(inBucket(state.items, b).reduce((n, i) => n + (i.price_cents ?? 0), 0))}
              </div>
            </div>
          ))}
        </div>

        <div className="money">
          <div className="cap">If a link goes astray</div>
          <p className="note" style={{ marginTop: 6 }}>
            Rotating replaces all three links at once. The old ones stop working immediately,
            so everyone needs the new one.
          </p>
          <button className="btn sm quiet" onClick={rotate} disabled={rotating}>
            {rotating ? "Rotating…" : "Rotate every link"}
          </button>
          {links ? (
            <div style={{ marginTop: 12 }}>
              {links.map(l => (
                <div key={l.url}>
                  <div className="cap" style={{ marginBottom: 4 }}>{l.name}</div>
                  <div className="linkrow">{l.url}</div>
                </div>
              ))}
              <p className="note">Copy these now — they aren't shown again.</p>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
