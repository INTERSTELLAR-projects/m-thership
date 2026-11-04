import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, Check, History, Pencil, Plus, RefreshCw, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import PanelShell from "./PanelShell";
import { Empty, Md, Section, Spinner, relTime, fmtDateTime } from "../ui";
import { BRAIN_SECTIONS, sectionScore } from "../defs";
import { agentsCall } from "../useAgentsData";

const CONF = { high: "#7fd18b", medium: "#ffb27a", low: "#ff8a7f", unknown: "rgba(244,239,233,.4)" };

function Ring({ pct }) {
  const r = 26, c = 2 * Math.PI * r;
  return (
    <svg width="68" height="68" viewBox="0 0 68 68" aria-label={`${pct}% complete`}>
      <defs><linearGradient id="agx-ring" x1="0" x2="1"><stop offset="0" stopColor="#ff3c00" /><stop offset="1" stopColor="#ffaa00" /></linearGradient></defs>
      <circle cx="34" cy="34" r={r} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="5" />
      <circle cx="34" cy="34" r={r} fill="none" stroke="url(#agx-ring)" strokeWidth="5" strokeLinecap="round" strokeDasharray={`${(c * pct) / 100} ${c}`} transform="rotate(-90 34 34)" />
      <text x="34" y="38" textAnchor="middle" className="mono" fill="#fff" fontSize="13" fontWeight="600">{pct}%</text>
    </svg>
  );
}

function SectionCard({ s, sec, history, onSave, busy }) {
  const [edit, setEdit] = useState(false);
  const [text, setText] = useState(sec?.text || "");
  const [showHist, setShowHist] = useState(false);
  const score = sectionScore(sec);
  return (
    <div className="rounded-xl border border-[var(--hair-d)] bg-white/[0.015] p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[13.5px] font-semibold text-white">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: score === 1 ? "#ff6a00" : score ? "#ffb27a" : "rgba(255,255,255,.25)" }} />
            {s.label}
          </p>
          <p className="mono mt-0.5 text-[10px] uppercase tracking-[.12em] text-[var(--ink-s)]">
            <span style={{ color: CONF[sec?.confidence || "unknown"] }}>{sec?.confidence || "unknown"}</span> · {sec?.updated_by || "—"} · {sec?.updated_at ? relTime(sec.updated_at) : "never"}
          </p>
        </div>
        <div className="flex shrink-0 gap-1">
          {history.length ? <button type="button" onClick={() => setShowHist((v) => !v)} aria-label="Version history" className={`grid h-7 w-7 place-items-center rounded-md hover:bg-white/5 ${showHist ? "text-[#ff8a3d]" : "text-[var(--ink-s)]"}`}><History className="h-3.5 w-3.5" /></button> : null}
          {!edit ? <button type="button" onClick={() => { setText(sec?.text || ""); setEdit(true); }} aria-label={`Edit ${s.label}`} className="grid h-7 w-7 place-items-center rounded-md text-[var(--ink-s)] hover:bg-white/5 hover:text-white"><Pencil className="h-3.5 w-3.5" /></button> : null}
        </div>
      </div>
      {edit ? (
        <div className="mt-2.5">
          <textarea className="inp w-full font-[inherit]" rows={Math.min(14, Math.max(4, String(text).split("\n").length + 1))} value={text} onChange={(e) => setText(e.target.value)} placeholder={s.hint} />
          <p className="mt-1 text-[11px] text-[var(--ink-s)]">Facts only. Never paste passwords; write where a login lives instead.</p>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" className="btn-d" onClick={() => setEdit(false)}><X className="h-3.5 w-3.5" />Cancel</button>
            <button type="button" className="btn-f" disabled={busy} onClick={async () => { const ok = await onSave(s.key, text); if (ok) setEdit(false); }}><Check className="h-3.5 w-3.5" />Save</button>
          </div>
        </div>
      ) : (
        <div className="mt-2">{sec?.text && sec.text !== "unknown" ? <Md>{sec.text}</Md> : <p className="text-[12.5px] italic text-[var(--ink-s)]">unknown · {s.hint}</p>}</div>
      )}
      {sec?.sources?.length ? <p className="mt-2 text-[11px] text-[var(--ink-s)]">Sources: {sec.sources.join(" · ")}</p> : null}
      {showHist ? (
        <div className="mt-3 space-y-2 border-t border-[var(--hair-d)] pt-3">
          {history.slice(0, 6).map((h, i) => (
            <div key={i} className="rounded-lg bg-white/[0.02] p-2.5">
              <p className="mono text-[10px] uppercase tracking-[.12em] text-[var(--ink-s)]">Before {fmtDateTime(h.at)} · was by {h.by}</p>
              <div className="mt-1 max-h-40 overflow-y-auto scroll-d"><Md>{h.text || "(empty)"}</Md></div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function BrainPanel({ brain, client, scope = "client", agency = [], onClose, refresh }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState("glance");
  const [busy, setBusy] = useState("");
  const [add, setAdd] = useState({ section: "problems", text: "", source: "" });
  const pending = (brain?.pending_updates || []).filter((u) => (u.status || "pending") === "pending");
  const conflicts = (brain?.conflicts || []).filter((c) => c.status === "open");
  const questions = (brain?.open_questions || []).filter((q) => q.status !== "answered");
  const histBy = useMemo(() => {
    const m = {};
    (brain?.history || []).forEach((h) => { (m[h.section] ||= []).push(h); });
    return m;
  }, [brain]);

  const run = async (label, fn, ok) => {
    setBusy(label);
    try { const r = await fn(); if (ok) toast(ok(r)); refresh(); setBusy(""); return true; } catch (e) { toast({ title: "Something went wrong", description: e.message, variant: "destructive" }); setBusy(""); return false; }
  };

  const name = scope === "interstellar" ? "Interstellar" : client?.business || brain?.client_name || "Client";
  if (!brain) {
    return (
      <PanelShell onClose={onClose} wide label={`${name} brain`}>
        <header className="px-5 pb-5 pt-5 pr-12">
          <p className="eyebrow">Business brain</p>
          <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-white">{name} <span className="text-[#ff3c00]">/Brain</span></h2>
          <p className="mt-2 text-[13px] text-[var(--ink-m)]">No brain yet. Build it from what Møthership already knows (CRM, dossier, gaps, goals, reviews, agents). Unknowns stay "unknown" with an open question.</p>
          <button type="button" className="btn-f mt-4" disabled={!!busy} onClick={() => run("seed", () => agentsCall("brain_seed", { client_id: client?.id }), () => ({ title: "Brain built", description: "Seeded from records." }))}>{busy ? <Spinner /> : <Brain className="h-4 w-4" />}Build brain from records</button>
        </header>
      </PanelShell>
    );
  }

  const pct = Math.round(brain.completeness || 0);
  return (
    <PanelShell onClose={onClose} wide label={`${name} brain`}>
      <header className="flex items-start gap-4 px-5 pb-4 pt-5 pr-12">
        <Ring pct={pct} />
        <div className="min-w-0">
          <p className="eyebrow">{scope === "interstellar" ? "Company brain · every department reads it" : "Business brain · this client's agents read only this"}</p>
          <h2 className="mt-1.5 text-[24px] font-semibold tracking-[-0.03em] text-white">{name} <span className="text-[#ff3c00]">/Brain</span></h2>
          <p className="mono mt-1 text-[10.5px] text-[var(--ink-s)]">Refined {relTime(brain.last_refined_at)} · {pending.length} pending · {conflicts.length} conflicts · {questions.length} open questions</p>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-2 px-5 pb-4">
        <button type="button" className="btn-f" disabled={!!busy} onClick={() => run("refine", () => agentsCall("brain_refine", { brain_id: brain.id }), (r) => ({ title: "Brain refined", description: `${r.updated_sections?.length || 0} sections updated · ${r.merged || 0} merged · ${r.conflicts || 0} conflicts flagged` }))}>
          {busy === "refine" ? <Spinner /> : <RefreshCw className="h-4 w-4" />}{busy === "refine" ? "Refining…" : "Refine now"}
        </button>
        {client?.id ? <button type="button" className="btn-d" onClick={() => navigate(`/clients/${client.id}`)}>Client cockpit</button> : null}
        {scope === "interstellar" ? <button type="button" className="btn-d" onClick={() => navigate("/settings")}>Agency knowledge</button> : null}
      </div>
      <div className="flex gap-1 overflow-x-auto px-5 pb-3 no-scrollbar">
        {[["glance", "At a glance"], ["sections", "Sections"], ["inbox", `Inbox${pending.length + conflicts.length ? ` · ${pending.length + conflicts.length}` : ""}`], ["questions", `Questions · ${questions.length}`], ["log", "Changelog"]].map(([k, l]) => (
          <button key={k} type="button" className={`chip ${tab === k ? "on" : ""}`} onClick={() => setTab(k)}>{l}</button>
        ))}
      </div>

      {tab === "glance" ? (
        <Section title="Business at a glance">
          {brain.glance ? <Md>{brain.glance}</Md> : <Empty>No summary yet. Press Refine now and the brain writes one from its sections.</Empty>}
          {brain.glance_at ? <p className="mono mt-2 text-[10.5px] text-[var(--ink-s)]">Written {relTime(brain.glance_at)}</p> : null}
          {scope === "interstellar" ? (
            <div className="mt-4 rounded-lg border border-[var(--hair-d)] p-3">
              <p className="eyebrow !text-[9.5px]">Also feeding this brain</p>
              <ul className="mt-1.5 space-y-1 text-[12.5px] text-[var(--ink-m)]">
                <li>AgencyKnowledge: {agency.length ? agency.map((k) => k.title).join(" · ") : "sections in Settings"}</li>
                <li>Claude Project doc <span className="mono text-[11.5px]">claude/interstellar-knowledge-base.md</span> (read by every Claude task)</li>
                <li>Each agent's own learnings (AgentLearning) and the research department's notes</li>
              </ul>
            </div>
          ) : null}
        </Section>
      ) : null}

      {tab === "sections" ? (
        <div className="space-y-2.5 px-5 pb-5">
          {BRAIN_SECTIONS.map((s) => (
            <SectionCard key={`${s.key}:${brain.sections?.[s.key]?.updated_at || ""}`} s={s} sec={brain.sections?.[s.key]} history={histBy[s.key] || []} busy={!!busy}
              onSave={(key, text) => run("edit", () => agentsCall("brain_edit", { brain_id: brain.id, section: key, text }), () => ({ title: "Saved", description: "Edit logged with history. Press Refine now to update the summary." }))} />
          ))}
        </div>
      ) : null}

      {tab === "inbox" ? (
        <>
          <Section title={`Conflicts for you (${conflicts.length})`}>
            {conflicts.length ? conflicts.map((c) => (
              <div key={c.id} className="mb-2.5 rounded-xl border border-[rgba(255,68,51,.35)] p-3">
                <p className="mono text-[10px] uppercase tracking-[.12em] text-[#ff8a7f]">{c.section} · flagged {relTime(c.flagged_at)}</p>
                <p className="mt-1.5 text-[12.5px] text-[var(--ink-m)]"><span className="text-white">Now:</span> {c.current}</p>
                <p className="mt-1 text-[12.5px] text-[var(--ink-m)]"><span className="text-white">Incoming:</span> {c.incoming}</p>
                {c.why ? <p className="mt-1 text-[12px] text-[var(--ink-s)]">{c.why}</p> : null}
                <div className="mt-2.5 flex flex-wrap gap-2">
                  <button type="button" className="btn-d !h-8" disabled={!!busy} onClick={() => run("resolve", () => agentsCall("brain_resolve", { brain_id: brain.id, conflict_id: c.id, resolution: "keep" }))}>Keep current</button>
                  <button type="button" className="btn-d !h-8" disabled={!!busy || !c.update_id} onClick={() => run("resolve", () => agentsCall("brain_resolve", { brain_id: brain.id, conflict_id: c.id, resolution: "incoming" }), () => ({ title: "Queued", description: "The incoming fact merges on the next refine." }))}>Use incoming</button>
                  <button type="button" className="btn-d !h-8" disabled={!!busy} onClick={() => run("resolve", () => agentsCall("brain_resolve", { brain_id: brain.id, conflict_id: c.id, resolution: "dismiss" }))}>Dismiss</button>
                </div>
              </div>
            )) : <Empty>No conflicts. When an agent or research contradicts something you set, it lands here instead of overwriting it.</Empty>}
          </Section>
          <Section title={`Pending findings (${pending.length})`}>
            {pending.length ? (
              <ul className="space-y-2">
                {pending.map((u) => (
                  <li key={u.id} className="rounded-lg border border-[var(--hair-d)] p-2.5">
                    <p className="mono text-[10px] uppercase tracking-[.12em] text-[var(--ink-s)]">{u.section} · {u.by}{u.agent_key ? ` · ${u.agent_key}` : ""} · {relTime(u.added_at)}</p>
                    <p className="mt-1 text-[12.5px] text-[var(--ink-d)]">{u.text}</p>
                    {u.source ? <p className="mt-0.5 text-[11px] text-[var(--ink-s)]">Source: {u.source}</p> : null}
                  </li>
                ))}
              </ul>
            ) : <Empty>Nothing waiting. Agents and research add findings here; Refine now merges them.</Empty>}
          </Section>
          <Section title="Add a finding" right={<Plus className="h-3.5 w-3.5 text-[#ff8a3d]" />}>
            <div className="grid gap-2">
              <select className="inp" value={add.section} onChange={(e) => setAdd({ ...add, section: e.target.value })}>{BRAIN_SECTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
              <textarea className="inp" rows={3} placeholder="The fact, in one or two sentences" value={add.text} onChange={(e) => setAdd({ ...add, text: e.target.value })} />
              <input className="inp" placeholder="Source (link, call, document)" value={add.source} onChange={(e) => setAdd({ ...add, source: e.target.value })} />
              <div className="flex justify-end">
                <button type="button" className="btn-d" disabled={!add.text.trim() || !!busy} onClick={async () => { const ok = await run("add", () => agentsCall("brain_add_update", { brain_id: brain.id, section: add.section, text: add.text, source: add.source, by: "justin" }), () => ({ title: "Queued", description: "Merges on the next refine." })); if (ok) setAdd({ ...add, text: "", source: "" }); }}>Queue finding</button>
              </div>
            </div>
          </Section>
        </>
      ) : null}

      {tab === "questions" ? (
        <Section title="Open questions">
          {questions.length ? (
            <ul className="space-y-1.5">{questions.map((q, i) => <li key={i} className="flex gap-2 text-[12.5px] text-[var(--ink-m)]"><span className="mono mt-0.5 shrink-0 text-[10px] uppercase text-[#ff8a3d]">{q.section}</span>{q.q}</li>)}</ul>
          ) : <Empty>No open questions.</Empty>}
          <p className="mt-3 text-[11.5px] text-[var(--ink-s)]">Answer one by editing its section; the question closes automatically.</p>
        </Section>
      ) : null}

      {tab === "log" ? (
        <Section title="Changelog">
          <ul className="space-y-2">
            {(brain.changelog || []).slice(0, 60).map((c, i) => (
              <li key={i} className="text-[12.5px] text-[var(--ink-m)]"><span className="mono mr-2 text-[10.5px] text-[var(--ink-s)]">{fmtDateTime(c.at)}</span><span className="text-white">{c.by}</span> · {c.section === "*" ? "brain" : c.section} · {c.change}</li>
            ))}
          </ul>
        </Section>
      ) : null}
      <div className="h-4 shrink-0" />
    </PanelShell>
  );
}
