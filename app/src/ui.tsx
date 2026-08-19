import { useEffect, useRef, useState } from "react";
import type { Item } from "./types";
import { C, PRI, priColor, parseAmount } from "./money";

/**
 * Stand-in artwork. Every item that has no photo still has to hold its place in a
 * grid — a blank tile reads as broken in a way a blank row never does — so the name
 * is set as the picture, and shrinks to a monogram once the container is thumbnail-sized.
 */
const TINT: [string, string][] = [
  ["#EFE9FF", "#4B2EF5"], ["#FBEEDA", "#C97E1C"], ["#E6F2EC", "#1F8A4C"],
  ["#FBE7EC", "#C2415C"], ["#EAEDF6", "#2F4B85"], ["#F4EEE6", "#8A6034"],
];
const tintOf = (id: string) => {
  let n = 0;
  for (const ch of id) n = (n * 31 + ch.charCodeAt(0)) % 997;
  return TINT[n % TINT.length];
};

export function Shot({ item, mini }: { item: Item; mini?: boolean }) {
  if (item.image_url) return <img src={item.image_url} alt="" loading="lazy" />;
  const [bg, fg] = tintOf(item.id);
  if (mini) {
    return (
      <div className="noimg mini" style={{ background: bg, color: fg }}>
        <span className="n">{(item.name.trim()[0] ?? "?").toUpperCase()}</span>
      </div>
    );
  }
  return (
    <div className="noimg" style={{ background: bg, color: fg }}>
      <span className="s">{item.source_site?.split(".")[0] ?? "typed in"}</span>
      <span className="n">{item.name}</span>
    </div>
  );
}

export const StatusPill = ({ status, chip }: { status: string; chip?: boolean }) => {
  if (status !== "approved" && status !== "declined") return null;
  const cls = chip ? "chip" : "pill";
  return (
    <span className={`${cls} ${status === "approved" ? "ok" : "no"}`}>
      {status === "approved" ? "Approved" : "Not now"}
    </span>
  );
};

export function Tile({ item, onOpen }: { item: Item; onOpen: () => void }) {
  return (
    <button className="tile" onClick={onOpen}>
      <span className="shot">
        <Shot item={item} />
        <span className="pri" style={{ background: priColor(item.priority) }} />
        <StatusPill status={item.status} />
      </span>
      {item.image_url ? <span className="tname">{item.name}</span> : null}
      <span className="tmeta">
        <span className="tprice num">{item.price_cents == null ? "—" : C(item.price_cents)}</span>
        <span className="tsite">{item.source_site}</span>
      </span>
    </button>
  );
}

export function Row({ item, first, last, onOpen, onMove, onPriority, onDelete }: {
  item: Item; first: boolean; last: boolean;
  onOpen: () => void; onMove: (d: -1 | 1) => void; onPriority: () => void; onDelete: () => void;
}) {
  return (
    <div className="row">
      <span className="rthumb"><Shot item={item} mini /></span>
      <div className="rtext">
        {/* the name is the tap target; the priority chip has to sit outside it,
            since a button inside a button is invalid and swallows the inner tap */}
        <button className="ropen" onClick={onOpen}>
          <span className="rname">{item.name}</span>
          <span className="rmeta num">
            {item.price_cents == null ? "no price yet" : C(item.price_cents)} · {item.source_site}
          </span>
        </button>
        <button className="prichip" onClick={onPriority}>
          <i className="dot" style={{ borderRadius: "50%", background: priColor(item.priority) }} />
          {PRI[item.priority]}
        </button>
      </div>
      <span className="arrows">
        <button onClick={() => onMove(-1)} disabled={first} aria-label="Move up">▲</button>
        <button onClick={() => onMove(1)} disabled={last} aria-label="Move down">▼</button>
      </span>
      <button className="del" onClick={onDelete} aria-label={`Delete ${item.name}`}>✕</button>
    </div>
  );
}

export function AmountSheet({ title, sub, initial, max, confirm, onClose, onSubmit }: {
  title: string; sub?: string; initial?: string; max?: number; confirm: string;
  onClose: () => void; onSubmit: (cents: number, note: string) => Promise<void>;
}) {
  const [raw, setRaw] = useState(initial ?? "");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { input.current?.focus(); }, []);

  const go = async () => {
    const cents = parseAmount(raw);
    if (!cents) return setErr("Type an amount");
    if (max != null && cents > max) return setErr(`That's more than the ${C(max)} available`);
    setBusy(true);
    try { await onSubmit(cents, note); onClose(); }
    catch (e) { setErr(e instanceof Error ? e.message : "That didn't work"); setBusy(false); }
  };

  return (
    <div className="veil" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        {sub ? <p className="sub">{sub}</p> : null}
        <input ref={input} className="big num" inputMode="decimal" placeholder="0.00"
          value={raw} onChange={e => { setRaw(e.target.value); setErr(null); }}
          onKeyDown={e => e.key === "Enter" && go()} />
        <div className="field" style={{ marginTop: 12 }}>
          <label>Note (optional)</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="Babysitting" />
        </div>
        {err ? <p className="err">{err}</p> : null}
        <div className="pair" style={{ marginTop: 12 }}>
          <button className="btn quiet" onClick={onClose}>Cancel</button>
          <button className="btn" onClick={go} disabled={busy}>{busy ? "…" : confirm}</button>
        </div>
      </div>
    </div>
  );
}

export function Confirm({ title, body, confirm, onClose, onConfirm }: {
  title: string; body?: string; confirm: string;
  onClose: () => void; onConfirm: () => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div className="veil" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        {body ? <p className="sub">{body}</p> : null}
        <div className="pair" style={{ marginTop: 8 }}>
          <button className="btn quiet" onClick={onClose}>Keep it</button>
          <button className="btn" style={{ background: "var(--over)" }} disabled={busy}
            onClick={async () => { setBusy(true); await onConfirm(); onClose(); }}>
            {busy ? "…" : confirm}
          </button>
        </div>
      </div>
    </div>
  );
}

export function Toast({ text }: { text: string }) {
  return <div className="toast">{text}</div>;
}
