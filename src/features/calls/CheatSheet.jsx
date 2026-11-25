// Cheat sheet (default call view): no script. Things to remember, where things stand, topics as short joggers,
// and every question with a box to capture the answer during the call (type or tap the mic). Saved PDFs live here too.
import { useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { AlertTriangle, Check, ChevronDown, Download, FileText, Paperclip, Plus, Trash2 } from "lucide-react";
import { Spinner } from "@/features/agents/ui";
import MicButton from "./MicButton";
import { whoOf } from "./api";
import { savePdf, uploadPdf } from "./pdf";

const arr = (v) => (Array.isArray(v) ? v : []);

function Dots({ items, tone = "#ff6a00", big = false }) {
  return (
    <ul className={big ? "space-y-2.5" : "space-y-1.5"}>
      {items.map((t, k) => (
        <li key={k} className={`flex gap-2.5 ${big ? "text-[16px] text-white" : "text-[13.5px] text-[var(--ink-d)]"}`}>
          <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tone }} />{t}
        </li>
      ))}
    </ul>
  );
}

function Block({ label, children, accent, delay = 0 }) {
  return (
    <section className={`card rise p-4 ${accent ? "border-[rgba(255,106,0,.45)]" : ""}`} style={{ animationDelay: `${delay}ms` }}>
      <p className="eyebrow mb-2.5">{label}</p>
      {children}
    </section>
  );
}

function Answer({ x, i, setQa, onSave }) {
  const ref = useRef(null);
  const set = (patch) => setQa((qa) => qa.map((y, j) => (j === i ? { ...y, ...patch } : y)));
  const hasAnswer = !!String(x.answer || "").trim();
  return (
    <li className={`rounded-lg border p-3 transition ${hasAnswer || x.asked ? "border-[rgba(46,230,197,.3)] bg-[rgba(46,230,197,.04)]" : "border-[var(--hair-d)] bg-white/[0.015]"}`}>
      <div className="flex items-start gap-2.5">
        <button type="button" onClick={() => { set({ asked: !x.asked }); setTimeout(onSave, 50); }} aria-label={x.asked ? "Mark not asked" : "Mark asked"}
          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded border ${x.asked || hasAnswer ? "border-[#2ee6c5] bg-[rgba(46,230,197,.2)]" : "border-[var(--hair-d2)]"}`}>
          {x.asked || hasAnswer ? <Check className="h-3 w-3 text-[#9ff3df]" /> : null}
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-[14.5px] leading-snug text-white">{x.q}</p>
          {x.topic ? <p className="mono mt-0.5 text-[9.5px] uppercase tracking-[.12em] text-[var(--ink-s)]">{x.topic}</p> : null}
          <div className="mt-2 flex items-start gap-2">
            <textarea ref={ref} rows={hasAnswer ? Math.min(6, Math.ceil(String(x.answer).length / 70) + 1) : 1} className="inp !min-h-[34px] !py-1.5 !text-[13px]"
              placeholder="Their answer…" value={x.answer || ""} onChange={(e) => set({ answer: e.target.value })} onBlur={onSave} />
            <MicButton value={x.answer} onChange={(v) => set({ answer: v })} onDone={onSave} title="Dictate their answer" />
          </div>
        </div>
      </div>
    </li>
  );
}

export default function CheatSheet({ cp, set, onSave }) {
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [newQ, setNewQ] = useState("");
  const [showRef, setShowRef] = useState(false);
  const fileRef = useRef(null);
  const qa = arr(cp.qa).length ? cp.qa : arr(cp.agenda).flatMap((a) => arr(a.questions).map((q) => ({ q, topic: a.topic, answer: "", asked: false })));
  const setQa = (fn) => set({ qa: fn(qa) });
  const answered = qa.filter((x) => String(x.answer || "").trim() || x.asked).length;
  const pdfs = arr(cp.pdfs);

  const makePdf = async () => {
    setBusy("pdf"); setMsg("");
    try { await onSave(); const entry = await savePdf({ ...cp, qa }); set({ pdfs: [entry, ...pdfs] }); setTimeout(onSave, 50); setMsg("PDF saved to this prep"); }
    catch (e) { setMsg(e?.message || "Could not make the PDF"); }
    setBusy(""); setTimeout(() => setMsg(""), 3000);
  };
  const attach = async (file) => {
    if (!file) return;
    setBusy("up"); setMsg("");
    try { const entry = await uploadPdf(file); set({ pdfs: [entry, ...pdfs] }); setTimeout(onSave, 50); setMsg("File attached"); }
    catch (e) { setMsg(e?.message || "Upload failed"); }
    setBusy(""); setTimeout(() => setMsg(""), 3000);
  };
  const addQ = () => { const q = newQ.trim(); if (!q) return; setQa((list) => [...list, { q, topic: "", answer: "", asked: false }]); setNewQ(""); setTimeout(onSave, 50); };

  return (
    <div className="grid gap-4 pt-5 lg:grid-cols-[1fr_1.05fr]">
      <div className="space-y-3">
        {cp.goal ? (
          <section className="card rise border-[rgba(255,106,0,.55)] p-4 md:p-5">
            <p className="eyebrow mb-1.5">The point of this call</p>
            <p className="text-[19px] font-medium leading-snug tracking-[-0.015em] text-white md:text-[21px]">{cp.goal}</p>
          </section>
        ) : null}
        {arr(cp.remember).length ? <Block label="Don't forget" accent delay={30}><Dots items={cp.remember} big /></Block> : null}
        {arr(cp.conflicts).length ? (
          <section className="card rise border-[rgba(255,170,0,.45)] p-4">
            <p className="flex items-center gap-2 text-[13px] font-medium text-[#ffcf7a]"><AlertTriangle className="h-4 w-4" />Check first: doesn't match what's on file</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px] text-[var(--ink-m)]">{cp.conflicts.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </section>
        ) : null}
        {arr(cp.background).length ? <Block label="Where things stand" delay={60}><Dots items={cp.background} tone="#8a8f9c" /></Block> : null}
        {arr(cp.agenda).length ? (
          <Block label="Talk about" delay={90}>
            <div className="space-y-3.5">
              {cp.agenda.map((a, i) => (
                <div key={i}>
                  <p className="text-[14.5px] font-semibold text-white">{a.topic}{!arr(a.talking_points).length && arr(a.questions).length ? <span className="mono ml-2 text-[10.5px] font-normal text-[var(--ink-s)]">{arr(a.questions).length} question{arr(a.questions).length === 1 ? "" : "s"} →</span> : null}</p>
                  {arr(a.talking_points).length ? <div className="mt-1.5"><Dots items={a.talking_points} /></div> : null}
                  {a.decision_needed ? <p className="mt-1.5 border-l-2 border-[#ff6a00] pl-2.5 text-[13px] text-[#ffd2b0]">Decide: {a.decision_needed}</p> : null}
                </div>
              ))}
            </div>
          </Block>
        ) : null}
        {arr(cp.show).length ? <Block label="Show" delay={120}><Dots items={cp.show} tone="#2ee6c5" /></Block> : null}
        {arr(cp.follow_ups).length ? <Block label="Open from last call" delay={140}><Dots items={cp.follow_ups} tone="#ffaa00" /></Block> : null}
        {arr(cp.risks).length ? <Block label="Watch for" delay={160}><Dots items={cp.risks} tone="#ff4433" /></Block> : null}
      </div>

      <div className="space-y-3">
        <section className="card rise p-4" style={{ animationDelay: "40ms" }}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="eyebrow">Ask</p>
            <span className="mono text-[10.5px] text-[var(--ink-s)]">{answered} / {qa.length} answered</span>
          </div>
          {qa.length ? <ul className="space-y-2">{qa.map((x, i) => <Answer key={i} x={x} i={i} setQa={setQa} onSave={onSave} />)}</ul> : <p className="text-[12.5px] text-[var(--ink-s)]">No questions yet.</p>}
          <div className="mt-3 flex gap-2">
            <input className="inp !h-[34px]" placeholder="Add a question…" value={newQ} onChange={(e) => setNewQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addQ(); }} />
            <button type="button" className="btn-d !h-[34px]" onClick={addQ} disabled={!newQ.trim()}><Plus className="h-3.5 w-3.5" /></button>
          </div>
        </section>
        {arr(cp.asks_from_client).length ? <Block label={`Get from ${cp.contact_name || whoOf(cp)}`} delay={70}><Dots items={cp.asks_from_client} tone="#ffaa00" /></Block> : null}
        {arr(cp.prep_checklist).length ? <Block label="Have open" delay={90}><Dots items={cp.prep_checklist} tone="#8a8f9c" /></Block> : null}

        {cp.reference_md ? (
          <section className="card rise p-4" style={{ animationDelay: "110ms" }}>
            <button type="button" className="flex w-full items-center justify-between" onClick={() => setShowRef((v) => !v)}>
              <span className="eyebrow">Full prep notes</span><ChevronDown className={`h-4 w-4 text-[var(--ink-s)] transition ${showRef ? "rotate-180" : ""}`} />
            </button>
            {showRef ? <div className="cpx-md mt-3 text-[13px] leading-relaxed text-[var(--ink-d)]"><ReactMarkdown>{cp.reference_md}</ReactMarkdown></div> : null}
          </section>
        ) : null}

        <section className="card rise p-4" style={{ animationDelay: "130ms" }}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="eyebrow">PDFs</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn-f !h-[30px]" onClick={makePdf} disabled={!!busy}>{busy === "pdf" ? <Spinner /> : <FileText className="h-3.5 w-3.5" />}Save as PDF</button>
              <button type="button" className="btn-d !h-[30px]" onClick={() => fileRef.current?.click()} disabled={!!busy}>{busy === "up" ? <Spinner /> : <Paperclip className="h-3.5 w-3.5" />}Attach file</button>
              <input ref={fileRef} type="file" accept="application/pdf,image/*,.doc,.docx" className="hidden" onChange={(e) => { attach(e.target.files?.[0]); e.target.value = ""; }} />
            </div>
          </div>
          {msg ? <p className="mt-2 text-[12px] text-white">{msg}</p> : null}
          {pdfs.length ? (
            <ul className="mt-3 divide-y divide-[var(--hair-d)]">
              {pdfs.map((p, i) => (
                <li key={`${p.url}-${i}`} className="flex items-center gap-2 py-2 text-[12.5px]">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-[#ff8a3d]" />
                  <a href={p.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1 truncate text-[var(--ink-d)] hover:text-white">{p.name}</a>
                  <span className="mono shrink-0 text-[10px] text-[var(--ink-s)]">{p.kind === "uploaded" ? "attached" : "cheat sheet"} · {String(p.created_at || "").slice(0, 10)}</span>
                  <a href={p.url} target="_blank" rel="noreferrer" className="btn-d !h-[26px] !px-1.5" aria-label="Open"><Download className="h-3.5 w-3.5" /></a>
                  <button type="button" className="btn-d !h-[26px] !px-1.5" aria-label="Remove from this prep" onClick={() => { set({ pdfs: pdfs.filter((_, j) => j !== i) }); setTimeout(onSave, 50); }}><Trash2 className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-[12px] text-[var(--ink-s)]">Every PDF you make or attach stays on this prep, so you can look back at how calls were prepped.</p>}
        </section>
      </div>
    </div>
  );
}
