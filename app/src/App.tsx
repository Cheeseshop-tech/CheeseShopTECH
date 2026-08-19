import { useCallback, useEffect, useState } from "react";
import { api, ApiError, claimToken, forgetToken } from "./api";
import type { Item, State } from "./types";
import { C, PRI, onItemBy } from "./money";
import { AmountSheet, Confirm, Toast } from "./ui";
import { List } from "./screens/List";
import { Add } from "./screens/Add";
import { Detail } from "./screens/Detail";
import { Savings } from "./screens/Savings";
import { Parent } from "./screens/Parent";

type Screen = "list" | "add" | "detail" | "savings";
type Sheet =
  | { kind: "deposit" }
  | { kind: "allocate" | "takeBack" | "direct" | "pledge"; item: Item }
  | { kind: "pot" }
  | { kind: "delete"; item: Item };

export default function App() {
  const [state, setState] = useState<State | null>(null);
  const [screen, setScreen] = useState<Screen>("list");
  const [itemId, setItemId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [fatal, setFatal] = useState<string | null>(null);

  const say = useCallback((t: string) => {
    setToast(t);
    setTimeout(() => setToast(null), 2200);
  }, []);

  const refresh = useCallback(async () => {
    try {
      setState(await api.state());
      setFatal(null);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
        forgetToken();
        setFatal(e.message);
      }
    }
  }, []);

  useEffect(() => {
    const token = claimToken();
    if (!token) { setFatal("This app opens from your own link."); return; }
    void refresh();
  }, [refresh]);

  // No websocket: the access model keeps every database key server-side, so the app
  // catches up on focus and on a slow timer instead. At three people that reads the same.
  useEffect(() => {
    const onFocus = () => void refresh();
    const timer = setInterval(onFocus, 30_000);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  const run = async (fn: () => Promise<State>, message?: string) => {
    try {
      setState(await fn());
      if (message) say(message);
    } catch (e) {
      say(e instanceof Error ? e.message : "That didn't work");
    }
  };

  if (fatal) {
    return (
      <div className="loading" style={{ flexDirection: "column", gap: 10, padding: 24, textAlign: "center" }}>
        <h1 className="brand" style={{ fontSize: 22 }}>Dream<em>Machine</em></h1>
        <p style={{ maxWidth: 280, lineHeight: 1.5 }}>{fatal}</p>
      </div>
    );
  }
  if (!state) return <div className="loading">Loading…</div>;

  const go = (s: string, id?: string) => {
    if (id) setItemId(id);
    setScreen(s as Screen);
  };

  const isParent = state.me.role === "parent";
  const current = itemId ? state.items.find(i => i.id === itemId) ?? null : null;

  const body = () => {
    if (screen === "add") {
      return <Add say={say} onCancel={() => go("list")}
        onDone={s => { setState(s); go("list"); }} />;
    }
    if (screen === "detail" && current) {
      return <Detail state={state} itemId={current.id} go={go} actions={{
        allocate: () => setSheet({ kind: "allocate", item: current }),
        takeBack: () => setSheet({ kind: "takeBack", item: current }),
        addNew: () => setSheet({ kind: "direct", item: current }),
        pledge: () => setSheet({ kind: "pledge", item: current }),
        setStatus: async s => {
          await run(() => api.setStatus(current.id, s),
            s === "approved" ? "Approved"
              : s === "declined" ? "Marked not now"
              : s === "purchased" ? "Moved to Got it"
              : "Back on the list");
          // once it is bought it is off the list, so staying on its page strands her
          if (s === "purchased") go("list");
        },
        saveNotes: text => run(() => api.updateItem(current.id, { notes: text }), "Note saved"),
        fulfill: (id, done) => run(() => api.fulfill(id, done), done ? "Marked paid" : "Marked unpaid"),
      }} />;
    }
    if (screen === "savings" && !isParent) {
      return <Savings state={state} go={go} onAdd={() => setSheet({ kind: "deposit" })} />;
    }
    if (isParent) {
      return <Parent state={state} go={go} apply={setState}
        onSetPot={() => setSheet({ kind: "pot" })}
        onPledge={id => {
          const it = state.items.find(i => i.id === id);
          if (it) setSheet({ kind: "pledge", item: it });
        }} />;
    }
    return <List state={state} go={go} act={{
      move: (id, d) => run(() => api.moveItem(id, d)),
      priority: it => run(() =>
        api.updateItem(it.id, { priority: it.priority === 3 ? 1 : it.priority + 1 }),
        `${it.name} · ${PRI[it.priority === 3 ? 1 : it.priority + 1]}`),
      remove: it => setSheet({ kind: "delete", item: it }),
    }} />;
  };

  const sheetView = () => {
    if (!sheet) return null;
    const close = () => setSheet(null);

    if (sheet.kind === "deposit") {
      return <AmountSheet title="Money in" sub="Babysitting, birthday money, anything she earned."
        confirm="Add it" onClose={close}
        onSubmit={async (cents, note) => { setState(await api.deposit(cents, note)); say(`${C(cents)} in`); }} />;
    }
    if (sheet.kind === "pot") {
      return <AmountSheet title="The pot" sub="What you and her mum are putting toward goals in total."
        initial={(state.pot / 100).toFixed(2)} confirm="Set it" onClose={close}
        onSubmit={async cents => { setState(await api.setPot(cents)); say(`Pot set to ${C(cents)}`); }} />;
    }
    if (sheet.kind === "allocate") {
      return <AmountSheet title={`Put money toward ${sheet.item.name}`}
        sub={`She has ${C(state.balance)} unspent.`} max={state.balance} confirm="Move it"
        onClose={close}
        onSubmit={async cents => {
          setState(await api.allocate(sheet.item.id, cents));
          say(`${C(cents)} moved over`);
        }} />;
    }
    if (sheet.kind === "takeBack") {
      const on = onItemBy(state.ledger, sheet.item.id, "teen");
      return <AmountSheet title="Take money back" sub={`${C(on)} of hers is on this.`} max={on}
        confirm="Take it back" onClose={close}
        onSubmit={async cents => {
          setState(await api.allocate(sheet.item.id, -cents));
          say(`${C(cents)} back in savings`);
        }} />;
    }
    if (sheet.kind === "direct") {
      return <AmountSheet title="Add new money to this"
        sub="Money that goes straight on it, without passing through her savings."
        confirm="Add it" onClose={close}
        onSubmit={async (cents, note) => {
          setState(await api.direct(sheet.item.id, cents, note));
          say(`${C(cents)} on ${sheet.item.name}`);
        }} />;
    }
    if (sheet.kind === "pledge") {
      const free = state.pot - state.pledged;
      return <AmountSheet title={`Pledge toward ${sheet.item.name}`}
        sub={`${C(free)} of the pot is unpromised.`} confirm="Pledge it" onClose={close}
        onSubmit={async cents => {
          setState(await api.pledge(sheet.item.id, cents));
          say(cents > free ? "Pledged — that puts the pot over" : `Pledged ${C(cents)}`);
        }} />;
    }

    const hers = onItemBy(state.ledger, sheet.item.id, "teen");
    const theirs = onItemBy(state.ledger, sheet.item.id, "parent");
    const money = hers || theirs
      ? `${C(hers)} of her savings goes back to her balance` +
        (theirs ? ` and ${C(theirs)} of pledges is freed up.` : ".")
      : undefined;
    return <Confirm title={`Delete "${sheet.item.name}"?`} body={money} confirm="Delete"
      onClose={close}
      onConfirm={async () => {
        setState(await api.deleteItem(sheet.item.id));
        if (screen === "detail") go("list");
        say("Deleted" + (hers ? ` · ${C(hers)} back in savings` : ""));
      }} />;
  };

  return (
    <>
      {body()}
      {sheetView()}
      {toast ? <Toast text={toast} /> : null}
      {!isParent ? (
        <div className="nav">
          <div className="navwrap">
            <button onClick={() => go("list")} aria-current={screen === "list" ? "page" : undefined}>
              ☰<span>My list</span>
            </button>
            <button className="add" onClick={() => go("add")} aria-label="Add something">+</button>
            <button onClick={() => go("savings")} aria-current={screen === "savings" ? "page" : undefined}>
              ◈<span>Savings</span>
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
