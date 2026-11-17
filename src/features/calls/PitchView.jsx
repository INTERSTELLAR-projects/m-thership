// Pitch: Interstellar's pitch in 30 seconds, 2 minutes and 10 minutes, generated from the positioning facts
// (BrainFact source = positioning) by callPrepAgent, editable and copyable. No invented stats, clients or prices.
import { useEffect, useState } from "react";
import { ClipboardCopy, RefreshCw, Save } from "lucide-react";
import { Spinner } from "@/features/agents/ui";
import { ArmBtn } from "./ui";
import { E, agent } from "./api";

const LENGTHS = [["pitch_30s", "30 seconds", 4], ["pitch_2min", "2 minutes", 10], ["pitch_10min", "10 minutes", 22]];

export default function PitchView() {
  const [pitch, setPitch] = useState(null);
  const [facts, setFacts] = useState([]);
  const [saved, setSaved] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  useEffect(() => {
    E.PitchScript.filter({ key: "interstellar" }, "-updated_date", 1).then((r) => { const p = r?.[0] || { key: "interstellar" }; setPitch(p); setSaved(JSON.stringify(p)); }).catch(() => setPitch({ key: "interstellar" }));
    E.BrainFact.filter({ source: "positioning", status: "active" }, "question_key", 40).then(setFacts).catch(() => setFacts([]));
  }, []);
  const dirty = pitch && JSON.stringify(pitch) !== saved;
  const generate = async () => {
    setBusy("gen"); setMsg("");
    const r = await agent({ mode: "pitch" });
    setBusy("");
    if (r?.ok) { setPitch(r.pitch); setSaved(JSON.stringify(r.pitch)); } else setMsg(r?.error || "Could not generate");
  };
  const save = async () => {
    setBusy("save");
    try {
      const body = { key: "interstellar", pitch_30s: pitch.pitch_30s || "", pitch_2min: pitch.pitch_2min || "", pitch_10min: pitch.pitch_10min || "", edited_at: new Date().toISOString() };
      const rec = pitch.id ? await E.PitchScript.update(pitch.id, body) : await E.PitchScript.create(body);
      const next = { ...pitch, ...body, id: pitch.id || rec?.id };
      setPitch(next); setSaved(JSON.stringify(next)); setMsg("Saved");
    } catch (e) { setMsg(e?.message || "Could not save"); }
    setBusy("");
  };
  const copy = async (t) => { try { await navigator.clipboard.writeText(t || ""); setMsg("Copied"); } catch { setMsg("Copy was blocked by the browser"); } setTimeout(() => setMsg(""), 2000); };
  if (!pitch) return <div className="grid min-h-[30vh] place-items-center"><Spinner size={18} /></div>;
  const has = LENGTHS.some(([k]) => pitch[k]);

  return (
    <div className="space-y-4 pt-5">
      <div className="flex flex-wrap items-center gap-2">
        {has ? (
          <ArmBtn className="btn-d" armedLabel="Click again: this replaces all three" onConfirm={generate} disabled={!!busy}>{busy === "gen" ? <Spinner /> : <RefreshCw className="h-3.5 w-3.5" />}Regenerate</ArmBtn>
        ) : (
          <button type="button" className="btn-f" onClick={generate} disabled={!!busy || !facts.length}>{busy === "gen" ? <Spinner /> : <RefreshCw className="h-3.5 w-3.5" />}Generate pitch</button>
        )}
        <button type="button" className="btn-d" onClick={save} disabled={!dirty || !!busy}><Save className="h-3.5 w-3.5" />{dirty ? "Save edits" : "Saved"}</button>
        {msg ? <span className="text-[12px] text-white">{msg}</span> : null}
        {pitch.generated_at ? <span className="mono text-[10.5px] text-[var(--ink-s)]">generated {new Date(pitch.generated_at).toLocaleDateString()}</span> : null}
      </div>
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          {LENGTHS.map(([k, label, rows], i) => (
            <section key={k} className="card rise p-4" style={{ animationDelay: `${i * 50}ms` }}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[13.5px] font-semibold text-white">{label} <span className="mono ml-1 text-[10.5px] font-normal text-[var(--ink-s)]">{String(pitch[k] || "").split(/\s+/).filter(Boolean).length} words</span></p>
                <button type="button" className="chip" onClick={() => copy(pitch[k])} disabled={!pitch[k]}><ClipboardCopy className="h-3 w-3" />Copy</button>
              </div>
              <textarea className="inp !text-[13.5px] leading-relaxed" rows={rows} value={pitch[k] || ""} placeholder={has ? "" : "Generate to write this from the positioning facts."} onChange={(e) => setPitch({ ...pitch, [k]: e.target.value })} />
            </section>
          ))}
        </div>
        <aside className="card rise h-fit p-4" style={{ animationDelay: "120ms" }}>
          <p className="lbl">Built only from these positioning facts</p>
          {!facts.length ? <p className="text-[12.5px] text-[var(--ink-s)]">No positioning facts yet.</p> : (
            <ul className="space-y-2 text-[12.5px] text-[var(--ink-d)]">{facts.map((f) => <li key={f.id} className="border-l-2 border-[rgba(255,106,0,.5)] pl-2.5">{f.statement}</li>)}</ul>
          )}
          <p className="mt-3 text-[11.5px] text-[var(--ink-s)]">Sales, investor, partner, internal and win-back call plans read these too. [Brackets] in a pitch mark details only you can fill in.</p>
        </aside>
      </div>
    </div>
  );
}
