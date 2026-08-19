import { useState } from "react";
import { api } from "../api";
import type { Bucket, State } from "../types";
import { BUCKETS, PRI, parseAmount } from "../money";

/**
 * One form, always. When a site refuses to be read the fields simply come back empty
 * and focus lands on the name — no error banner, no warning colour, nothing that makes
 * a blocked site feel like her mistake.
 */
export function Add({ onDone, onCancel, say }: {
  onDone: (s: State) => void; onCancel: () => void; say: (t: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [bucket, setBucket] = useState<Bucket>("want");
  const [priority, setPriority] = useState(2);
  const [reading, setReading] = useState(false);
  const [found, setFound] = useState<{ image: string | null; site: string | null; auto: boolean }>(
    { image: null, site: null, auto: false }
  );
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const read = async (value: string) => {
    if (!value.trim()) return;
    setReading(true);
    try {
      const c = await api.scrape(value);
      if (c.name) setName(n => n || c.name!);
      if (c.price_cents) setPrice(p => p || (c.price_cents! / 100).toFixed(2));
      setFound({ image: c.image_url, site: c.source_site, auto: c.confidence > 0 });
    } catch {
      // the endpoint is built never to fail; if the network did, the form still works
    } finally {
      setReading(false);
    }
  };

  const save = async () => {
    if (!name.trim()) return setErr("Give it a name first");
    setSaving(true);
    try {
      const state = await api.createItem({
        bucket, name: name.trim(),
        price_cents: price ? parseAmount(price) : null,
        image_url: found.image,
        source_url: url.trim() || null,
        source_site: found.site ?? (url ? url.replace(/^https?:\/\//, "").split("/")[0] : null),
        priority,
        entry_method: found.auto ? "auto" : "manual",
      });
      say(`Added to ${BUCKETS[bucket]}`);
      onDone(state);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save it");
      setSaving(false);
    }
  };

  return (
    <>
      <div className="topbar"><button className="back" onClick={onCancel}>← Cancel</button></div>
      <div className="scroll">
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-.03em", marginBottom: 16 }}>
          Add something
        </h2>

        <div className="field">
          <label>Paste a link</label>
          <input value={url} inputMode="url" autoCapitalize="off" autoCorrect="off"
            placeholder="sephora.com/product/…"
            onChange={e => setUrl(e.target.value)}
            onBlur={e => read(e.target.value)}
            onPaste={e => setTimeout(() => read(e.clipboardData.getData("text")), 0)} />
        </div>

        <div className={`hero ${reading ? "skel" : ""}`}
          style={{ display: reading || found.image ? "block" : "none", marginBottom: 16 }}>
          {found.image && !reading ? <img src={found.image} alt="" /> : null}
        </div>

        <div className="field">
          <label>What is it</label>
          <input value={name} autoFocus={!url} onChange={e => { setName(e.target.value); setErr(null); }}
            placeholder="Name it" />
        </div>

        <div className="field">
          <label>Price</label>
          <input value={price} inputMode="decimal" onChange={e => setPrice(e.target.value)}
            placeholder="0.00" />
        </div>

        <div className="field">
          <label>Which list</label>
          <div className="chips">
            {(["need", "want", "goal"] as const).map(b => (
              <button key={b} aria-pressed={b === bucket} onClick={() => setBucket(b)}>
                {BUCKETS[b].replace(/s$/, "")}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>How badly</label>
          <div className="chips">
            {[1, 2, 3].map(p => (
              <button key={p} aria-pressed={p === priority} onClick={() => setPriority(p)}>
                {PRI[p]}
              </button>
            ))}
          </div>
        </div>

        {err ? <p className="err" style={{ textAlign: "left" }}>{err}</p> : null}
        <button className="btn" onClick={save} disabled={saving}>
          {saving ? "Saving…" : "Save it"}
        </button>
      </div>
    </>
  );
}
