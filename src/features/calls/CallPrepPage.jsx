// Call prep (/calls/new and /calls/:id): talk through what the call needs, get a tight timeboxed plan, run the call
// one item at a time, then dictate what happened so action items and accepted facts feed the client's brain.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Check, ChevronLeft, ChevronRight, ClipboardCopy, ListChecks, Minus, NotebookPen, Pause, Play, Plus, RefreshCw, Save, Sparkles, Timer, Trash2, Wand2, X } from "lucide-react";
import { Spinner } from "@/features/agents/ui";
import { Shell, GlideTabs, ArmBtn } from "./ui";
import VoiceBox from "./VoiceBox";
import CheatSheet from "./CheatSheet";
import { E, agent, PURPOSE, CALL_TYPES, typeLabel, whoOf, totalMinutes, toMarkdown, fmtWhen } from "./api";

const lines = (v) => String(v || "").split("\n").map((x) => x.trim()).filter(Boolean);
const toLocalInput = (iso) => { if (!iso) return ""; const d = new Date(iso); const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

function ListEditor({ label, items, onChange, placeholder }) {
  return (
    <label className="block">
      <span className="lbl">{label}</span>
      <textarea className="inp" rows={Math.max(2, (items || []).length + 1)} value={(items || []).join("\n")} placeholder={placeholder}
        onChange={(e) => onChange(e.target.value.split("\n"))} onBlur={(e) => onChange(lines(e.target.value))} />
    </label>
  );
}

// ---------- New call ----------
function NewCall() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [clients, setClients] = useState([]);
  const [type, setType] = useState(params.get("type") || "client");
  const [clientId, setClientId] = useState(params.get("client") || "");
  const [contact, setContact] = useState("");
  const [company, setCompany] = useState("");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState("");
  const [box, setBox] = useState(25);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { E.CRMClient.list("business", 300).then((c) => setClients((c || []).filter((x) => x.status !== "Inactive"))).catch(() => setClients([])); }, []);
  const needsClient = type === "client";
  const ok = notes.trim().length >= 5 && (needsClient ? !!clientId : type === "internal" ? true : !!(clientId || contact.trim() || company.trim()));

  const go = async () => {
    setBusy(true); setErr("");
    const r = await agent({
      mode: "structure", call_type: type, client_id: clientId || undefined, contact_name: contact.trim() || (type === "internal" ? "" : undefined), company: company.trim() || undefined,
      raw_notes: notes, title: title.trim(), scheduled_for: when ? new Date(when).toISOString() : undefined, timebox_minutes: box,
    });
    setBusy(false);
    if (r?.ok && r.call_prep?.id) nav(`/calls/${r.call_prep.id}`, { replace: true });
    else setErr(r?.error || "Could not structure the call");
  };

  return (
    <Shell title="Structure" accent="Call" sub="Talk through what you need from this call. You get a cheat sheet back: the point of the call, what not to forget, where things stand, and your questions with space for their answers. No script."
      right={<Link to="/calls" className="btn-d"><ArrowLeft className="h-3.5 w-3.5" />All calls</Link>}>
      <div className="grid gap-5 pt-5 lg:grid-cols-[1fr_340px]">
        <section className="card rise p-4 md:p-5">
          <VoiceBox value={notes} onChange={setNotes} rows={9} label="Tap and say what this call needs to cover"
            placeholder="e.g. Walk Tyler through the new website before launch, get his opinion on the lab pages, ask for better project photos, confirm lead time and budget ranges…" />
          {err ? <p className="mt-2 text-[12.5px] text-[#ff8a7f]">{err}</p> : null}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" className="btn-f" onClick={go} disabled={!ok || busy}>{busy ? <><Spinner />Prepping…</> : <><Wand2 className="h-3.5 w-3.5" />Prep this call</>}</button>
            {!ok ? <span className="text-[12px] text-[var(--ink-s)]">{needsClient && !clientId ? "Pick the client first." : "Add a few words about the call."}</span> : null}
          </div>
        </section>
        <aside className="card rise space-y-3 p-4" style={{ animationDelay: "60ms" }}>
          <label className="block"><span className="lbl">Call type</span>
            <select className="inp" value={type} onChange={(e) => setType(e.target.value)}>{CALL_TYPES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <span className="mt-1 block text-[11.5px] text-[var(--ink-s)]">{CALL_TYPES.find(([k]) => k === type)?.[2]}</span>
          </label>
          {type !== "internal" ? (
            <label className="block"><span className="lbl">{needsClient ? "Client" : "Client (if they're in the CRM)"}</span>
              <select className="inp" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">{needsClient ? "Pick a client…" : "Not in the CRM"}</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.business || c.domain}{c.status === "Lead" ? " (lead)" : ""}</option>)}
              </select>
            </label>
          ) : null}
          <label className="block"><span className="lbl">{type === "internal" ? "Who with" : "Contact name"}</span><input className="inp" value={contact} onChange={(e) => setContact(e.target.value)} placeholder={type === "internal" ? "e.g. Devon" : "e.g. Tyler"} /></label>
          {!clientId && type !== "internal" && type !== "client" ? <label className="block"><span className="lbl">Company</span><input className="inp" value={company} onChange={(e) => setCompany(e.target.value)} /></label> : null}
          <label className="block"><span className="lbl">Title (optional)</span><input className="inp" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Leave blank to name it from the notes" /></label>
          <label className="block"><span className="lbl">When (optional)</span><input className="inp" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} /></label>
          <label className="block"><span className="lbl">Timebox <span className="mono text-white">{box} min</span></span><input type="range" min={10} max={45} step={5} value={box} onChange={(e) => setBox(Number(e.target.value))} className="w-full accent-[#ff6a00]" /></label>
        </aside>
      </div>
    </Shell>
  );
}

// ---------- Plan editor ----------
function AgendaCard({ a, i, n, set, move, remove }) {
  const P = PURPOSE[a.purpose] || PURPOSE.inform;
  return (
    <div className="card rise p-3.5" style={{ animationDelay: `${Math.min(i, 12) * 35}ms` }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono grid h-6 w-6 place-items-center rounded-full border border-[var(--hair-d2)] text-[11px] text-white">{i + 1}</span>
        <input className="inp min-w-[180px] flex-1 !h-[32px] !text-[14px] font-medium" value={a.topic || ""} onChange={(e) => set({ topic: e.target.value })} />
        <span className="chipmin" title="Minutes">
          <button type="button" onClick={() => set({ minutes: Math.max(1, (Number(a.minutes) || 1) - 1) })} aria-label="One minute less"><Minus className="mx-auto h-3 w-3" /></button>
          <span>{Number(a.minutes) || 0}m</span>
          <button type="button" onClick={() => set({ minutes: (Number(a.minutes) || 0) + 1 })} aria-label="One minute more"><Plus className="mx-auto h-3 w-3" /></button>
        </span>
        <select className={`h-[26px] rounded-full border px-2 text-[11.5px] ${P.cls}`} value={a.purpose} onChange={(e) => set({ purpose: e.target.value })}>
          {Object.entries(PURPOSE).map(([k, v]) => <option key={k} value={k} className="bg-[#11131b] text-white">{v.label}</option>)}
        </select>
        <button type="button" className="btn-d !h-[26px] !px-1.5" disabled={i === 0} onClick={() => move(-1)} aria-label="Move up"><ChevronLeft className="h-3.5 w-3.5 rotate-90" /></button>
        <button type="button" className="btn-d !h-[26px] !px-1.5" disabled={i === n - 1} onClick={() => move(1)} aria-label="Move down"><ChevronRight className="h-3.5 w-3.5 rotate-90" /></button>
        <ArmBtn className="btn-d !h-[26px] !px-1.5" armedLabel="Remove?" onConfirm={remove}><Trash2 className="h-3.5 w-3.5" /></ArmBtn>
      </div>
      {a.purpose === "decide" || a.decision_needed ? (
        <label className="mt-2.5 block"><span className="lbl">Decision to get</span><input className="inp" value={a.decision_needed || ""} onChange={(e) => set({ decision_needed: e.target.value })} /></label>
      ) : null}
      <div className="mt-2.5 grid gap-2.5 md:grid-cols-2">
        <ListEditor label="Talking points" items={a.talking_points} onChange={(v) => set({ talking_points: v })} />
        <ListEditor label="Questions to ask" items={a.questions} onChange={(v) => set({ questions: v })} />
      </div>
    </div>
  );
}

function PlanView({ cp, set, setAgenda }) {
  const total = totalMinutes(cp.agenda);
  const box = Number(cp.timebox_minutes) || 25;
  return (
    <div className="grid gap-5 pt-5 lg:grid-cols-[1fr_330px]">
      <div className="space-y-3">
        <section className="card rise p-4">
          <span className="lbl">Goal: what must be true when the call ends</span>
          <textarea className="inp !text-[15px] !text-white" rows={2} value={cp.goal || ""} onChange={(e) => set({ goal: e.target.value })} />
          <div className="mt-3 flex items-center gap-3">
            <div className={`bar flex-1 ${total > box ? "over" : ""}`}><i style={{ width: `${Math.min(100, (total / Math.max(box, 1)) * 100)}%` }} /></div>
            <span className={`mono text-[12px] ${total > box ? "text-[#ff8a7f]" : "text-white"}`}>{total} / {box} min</span>
          </div>
        </section>
        {(cp.conflicts || []).length ? (
          <section className="card rise border-[rgba(255,170,0,.45)] p-4">
            <p className="flex items-center gap-2 text-[13px] font-medium text-[#ffcf7a]"><AlertTriangle className="h-4 w-4" />Check before the call: these don't match what's on file</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-[12.5px] text-[var(--ink-m)]">{cp.conflicts.map((c, i) => <li key={i}>{c}</li>)}</ul>
          </section>
        ) : null}
        {(cp.agenda || []).map((a, i) => (
          <AgendaCard key={i} a={a} i={i} n={cp.agenda.length}
            set={(patch) => setAgenda((ag) => ag.map((x, j) => (j === i ? { ...x, ...patch } : x)))}
            move={(d) => setAgenda((ag) => { const c = [...ag]; const [x] = c.splice(i, 1); c.splice(i + d, 0, x); return c; })}
            remove={() => setAgenda((ag) => ag.filter((_, j) => j !== i))} />
        ))}
        <button type="button" className="btn-d w-full" onClick={() => setAgenda((ag) => { const c = [...(ag || [])]; c.splice(Math.max(0, c.length - 1), 0, { topic: "New item", minutes: 3, purpose: "inform", talking_points: [], questions: [], decision_needed: "" }); return c; })}>
          <Plus className="h-3.5 w-3.5" />Add agenda item
        </button>
      </div>
      <aside className="space-y-3">
        {(cp.follow_ups || []).length ? (
          <section className="card rise p-4"><p className="lbl">Open from last call</p><ul className="list-disc space-y-1 pl-5 text-[12.5px] text-[var(--ink-d)]">{cp.follow_ups.map((f, i) => <li key={i}>{f}</li>)}</ul></section>
        ) : null}
        <section className="card rise space-y-3 p-4" style={{ animationDelay: "40ms" }}>
          <ListEditor label="Don't forget" items={cp.remember} onChange={(v) => set({ remember: v })} />
          <ListEditor label="Where things stand" items={cp.background} onChange={(v) => set({ background: v })} />
          <ListEditor label="Show" items={cp.show} onChange={(v) => set({ show: v })} />
          <ListEditor label="Have open before the call" items={cp.prep_checklist} onChange={(v) => set({ prep_checklist: v })} />
          <ListEditor label={`Get from ${cp.contact_name || whoOf(cp)}`} items={cp.asks_from_client} onChange={(v) => set({ asks_from_client: v })} />
          <ListEditor label="Watch for" items={cp.risks} onChange={(v) => set({ risks: v })} />
        </section>
        <section className="card rise space-y-3 p-4" style={{ animationDelay: "80ms" }}>
          <label className="block"><span className="lbl">When</span><input className="inp" type="datetime-local" value={toLocalInput(cp.scheduled_for)} onChange={(e) => set({ scheduled_for: e.target.value ? new Date(e.target.value).toISOString() : null })} /></label>
          <label className="block"><span className="lbl">Timebox <span className="mono text-white">{box} min</span></span><input type="range" min={10} max={45} step={5} value={box} onChange={(e) => set({ timebox_minutes: Number(e.target.value) })} className="w-full accent-[#ff6a00]" /></label>
          {cp.context_summary ? <p className="mono text-[10.5px] leading-relaxed text-[var(--ink-s)]">Read: {cp.context_summary}</p> : null}
        </section>
      </aside>
    </div>
  );
}

// ---------- Call mode ----------
const mmss = (sec) => { const s = Math.max(0, Math.round(Math.abs(sec))); return `${sec < 0 ? "-" : ""}${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

function CallMode({ cp, setAgenda, onSave }) {
  const agenda = cp.agenda || [];
  const [i, setI] = useState(() => Math.max(0, agenda.findIndex((a) => !a.done)));
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [itemStart, setItemStart] = useState(0);
  useEffect(() => { if (!running) return undefined; const t = setInterval(() => setElapsed((e) => e + 1), 1000); return () => clearInterval(t); }, [running]);
  useEffect(() => { setItemStart(elapsed); }, [i]);
  const a = agenda[i];
  if (!a) return <p className="pt-6 text-[13px] text-[var(--ink-m)]">No agenda yet. Structure the call first.</p>;
  const left = (Number(a.minutes) || 0) * 60 - (elapsed - itemStart);
  const total = totalMinutes(agenda) * 60;
  const P = PURPOSE[a.purpose] || PURPOSE.inform;
  const check = () => { setAgenda((ag) => ag.map((x, j) => (j === i ? { ...x, done: !x.done } : x))); if (!a.done && i < agenda.length - 1) setI(i + 1); setTimeout(onSave, 50); };

  return (
    <div className="pt-5">
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <button type="button" className="btn-f" onClick={() => setRunning((r) => !r)}>{running ? <><Pause className="h-3.5 w-3.5" />Pause</> : <><Play className="h-3.5 w-3.5" />{elapsed ? "Resume" : "Start call"}</>}</button>
          <span className="clock text-[26px] text-white">{mmss(elapsed)}</span>
          <span className="mono text-[11px] text-[var(--ink-s)]">of {mmss(total)} planned</span>
          <div className={`bar min-w-[120px] flex-1 ${elapsed > total ? "over" : ""}`}><i style={{ width: `${Math.min(100, (elapsed / Math.max(total, 1)) * 100)}%` }} /></div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {agenda.map((x, j) => (
            <button key={j} type="button" onClick={() => setI(j)} className={`chip ${j === i ? "on" : ""}`}>{x.done ? <Check className="h-3 w-3 text-[#9ff3df]" /> : <span className="mono text-[10px]">{j + 1}</span>}<span className="max-w-[140px] truncate">{x.topic}</span></button>
          ))}
        </div>
      </div>
      <section key={i} className="card slide mt-4 p-5 md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className={`rounded-full border px-2 py-0.5 text-[11px] ${P.cls}`}>{P.label}</span>
            <span className="mono text-[11px] text-[var(--ink-s)]">Item {i + 1} of {agenda.length} · {a.minutes} min</span>
          </div>
          <span className={`clock text-[34px] ${left < 0 ? "text-[#ff8a7f]" : "text-white"}`}><Timer className="mr-2 inline h-5 w-5 align-[-2px] text-[var(--ink-s)]" />{mmss(left)}</span>
        </div>
        <h2 className="mt-3 text-[26px] font-semibold leading-tight tracking-[-0.03em] text-white md:text-[34px]">{a.topic}</h2>
        {a.decision_needed ? <p className="mt-3 border-l-2 border-[#ff6a00] pl-3 text-[15px] text-[#ffd2b0]">Decision: {a.decision_needed}</p> : null}
        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div>{(a.talking_points || []).length ? <><p className="eyebrow mb-2">Say</p><ul className="space-y-2 text-[15px] text-[var(--ink-d)]">{a.talking_points.map((t, k) => <li key={k} className="flex gap-2"><span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#ff6a00]" />{t}</li>)}</ul></> : null}</div>
          <div>{(a.questions || []).length ? <><p className="eyebrow mb-2">Ask</p><ul className="space-y-2 text-[15px] text-[var(--ink-d)]">{a.questions.map((q, k) => <li key={k} className="flex gap-2"><span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#8cafff]" />{q}</li>)}</ul></> : null}</div>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button type="button" className="btn-d" disabled={i === 0} onClick={() => setI(i - 1)}><ChevronLeft className="h-4 w-4" />Back</button>
          <button type="button" className={a.done ? "btn-d" : "btn-f"} onClick={check}><Check className="h-4 w-4" />{a.done ? "Done (undo)" : "Done, next"}</button>
          <button type="button" className="btn-d" disabled={i === agenda.length - 1} onClick={() => setI(i + 1)}>Skip<ChevronRight className="h-4 w-4" /></button>
        </div>
      </section>
    </div>
  );
}

// ---------- After the call ----------
function FactRow({ f, i, cpId, onChange }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const decide = async (decision) => {
    setBusy(decision); setErr("");
    const r = await agent({ mode: "fact", call_prep_id: cpId, index: i, decision });
    setBusy("");
    if (r?.ok) onChange(r.call_prep); else setErr(r?.error || "Failed");
  };
  return (
    <li className="rise rounded-lg border border-[var(--hair-d)] bg-white/[0.015] p-3" style={{ animationDelay: `${i * 30}ms` }}>
      <p className="text-[13.5px] text-white">{f.fact}</p>
      {f.quote ? <p className="mt-1 text-[11.5px] italic text-[var(--ink-s)]">"{f.quote}"</p> : null}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="mono text-[10px] uppercase tracking-[.12em] text-[var(--ink-s)]">{f.pillar}</span>
        {f.status === "proposed" ? (
          <>
            <ArmBtn className="btn-f !h-[28px]" armedLabel="Click again to add to the brain" onConfirm={() => decide("accepted")} disabled={!!busy}>{busy === "accepted" ? <Spinner /> : <Check className="h-3.5 w-3.5" />}Accept</ArmBtn>
            <ArmBtn className="btn-d !h-[28px]" armedLabel="Click again to reject" onConfirm={() => decide("rejected")} disabled={!!busy}><X className="h-3.5 w-3.5" />Reject</ArmBtn>
          </>
        ) : (
          <span className={`mono text-[10.5px] uppercase tracking-[.12em] ${f.status === "accepted" ? "text-[#9ff3df]" : "text-[var(--ink-s)]"}`}>{f.status === "accepted" ? "In the brain" : "Rejected"}</span>
        )}
        {err ? <span className="text-[11.5px] text-[#ff8a7f]">{err}</span> : null}
      </div>
    </li>
  );
}

function AfterCall({ cp, set, replace, onSave }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const run = async () => {
    setBusy(true); setErr("");
    await onSave();
    const r = await agent({ mode: "debrief", call_prep_id: cp.id, outcomes: cp.outcomes });
    setBusy(false);
    if (r?.ok) replace(r.call_prep); else setErr(r?.error || "Debrief failed");
  };
  const items = cp.action_items || [];
  const facts = cp.brain_facts_proposed || [];
  return (
    <div className="grid gap-5 pt-5 lg:grid-cols-2">
      <section className="card rise p-4 md:p-5">
        <VoiceBox value={cp.outcomes} onChange={(v) => set({ outcomes: v })} rows={8} label="Tap and say what happened on the call"
          placeholder="What was decided, what they said, what you promised, what they'll send, dates…" />
        {err ? <p className="mt-2 text-[12.5px] text-[#ff8a7f]">{err}</p> : null}
        <button type="button" className="btn-f mt-3" onClick={run} disabled={busy || String(cp.outcomes || "").trim().length < 5}>{busy ? <><Spinner />Debriefing…</> : <><Sparkles className="h-3.5 w-3.5" />Debrief</>}</button>
        <p className="mt-2 text-[11.5px] text-[var(--ink-s)]">Facts only go into {cp.call_type === "internal" ? "Interstellar's" : "the client's"} brain when you accept them. Nothing personal is ever proposed.</p>
      </section>
      <div className="space-y-3">
        <section className="card rise p-4" style={{ animationDelay: "40ms" }}>
          <p className="mb-2 flex items-center gap-2 text-[13.5px] font-semibold text-white"><ListChecks className="h-4 w-4 text-[#ff8a3d]" />Action items</p>
          {!items.length ? <p className="text-[12.5px] text-[var(--ink-s)]">Debrief to pull them out of your notes.</p> : (
            <ul className="space-y-1.5">
              {items.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-[13px]">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-[#ff6a00]" checked={!!a.done} onChange={() => { set({ action_items: items.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) }); setTimeout(onSave, 50); }} />
                  <span className={`flex-1 ${a.done ? "text-[var(--ink-s)] line-through" : "text-[var(--ink-d)]"}`}>{a.text}</span>
                  <span className="mono shrink-0 text-[10px] uppercase tracking-[.1em] text-[var(--ink-s)]">{a.owner === "client" ? "them" : "you"}{a.due ? ` · ${a.due}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
          {items.some((a) => !a.done) ? <p className="mt-2 text-[11.5px] text-[var(--ink-s)]">Open items roll forward into the next call you structure with them.</p> : null}
        </section>
        <section className="card rise p-4" style={{ animationDelay: "80ms" }}>
          <p className="mb-2 text-[13.5px] font-semibold text-white">Proposed brain facts</p>
          {!facts.length ? <p className="text-[12.5px] text-[var(--ink-s)]">None yet.</p> : (
            <ul className="space-y-2">{facts.map((f, i) => <FactRow key={`${i}-${f.fact}`} f={f} i={i} cpId={cp.id} onChange={replace} />)}</ul>
          )}
        </section>
      </div>
    </div>
  );
}

// ---------- Existing call ----------
const FIELDS = ["title", "goal", "agenda", "prep_checklist", "asks_from_client", "risks", "timebox_minutes", "scheduled_for", "raw_notes", "outcomes", "action_items", "status", "contact_name", "remember", "background", "show", "qa", "reference_md", "pdfs"];

function ExistingCall({ id }) {
  const [params, setParams] = useSearchParams();
  const view = ["sheet", "plan", "call", "after", "notes"].includes(params.get("view")) ? params.get("view") : "sheet";
  const [cp, setCp] = useState(null);
  const [savedJson, setSavedJson] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const cpRef = useRef(null);
  cpRef.current = cp;

  const snapshot = (x) => JSON.stringify(FIELDS.map((k) => x?.[k] ?? null));
  const replace = useCallback((x) => { setCp(x); setSavedJson(snapshot(x)); }, []);
  useEffect(() => { E.CallPrep.get(id).then(replace).catch((e) => setErr(e?.message || "Not found")); }, [id, replace]);
  const set = (patch) => setCp((c) => ({ ...c, ...patch }));
  const setAgenda = (fn) => setCp((c) => ({ ...c, agenda: fn(c.agenda || []) }));
  const dirty = cp ? snapshot(cp) !== savedJson : false;

  const save = useCallback(async () => {
    const cur = cpRef.current;
    if (!cur) return;
    const body = Object.fromEntries(FIELDS.map((k) => [k, cur[k]]));
    body.prep_checklist = (body.prep_checklist || []).map((x) => String(x).trim()).filter(Boolean);
    body.asks_from_client = (body.asks_from_client || []).map((x) => String(x).trim()).filter(Boolean);
    body.risks = (body.risks || []).map((x) => String(x).trim()).filter(Boolean);
    for (const k of ["remember", "background", "show"]) body[k] = (body[k] || []).map((x) => String(x).trim()).filter(Boolean);
    body.agenda = (body.agenda || []).map((a) => ({ ...a, talking_points: (a.talking_points || []).map((t) => String(t).trim()).filter(Boolean), questions: (a.questions || []).map((t) => String(t).trim()).filter(Boolean) }));
    body.structure = toMarkdown({ ...cur, ...body });
    try { await E.CallPrep.update(cur.id, body); setSavedJson(snapshot({ ...cur, ...body })); setMsg("Saved"); setTimeout(() => setMsg(""), 2000); }
    catch (e) { setMsg(e?.message || "Could not save"); }
  }, []);

  const regenerate = async () => {
    setBusy("regen"); setMsg("");
    await save();
    const r = await agent({ mode: "structure", call_prep_id: id, raw_notes: cpRef.current?.raw_notes, timebox_minutes: cpRef.current?.timebox_minutes });
    setBusy("");
    if (r?.ok) { replace(r.call_prep); setParams({}); } else setMsg(r?.error || "Could not regenerate");
  };
  const copy = async () => {
    try { await navigator.clipboard.writeText(toMarkdown(cpRef.current)); setMsg("Copied for the call"); }
    catch { setMsg("Copy was blocked by the browser; select the plan text instead"); }
    setTimeout(() => setMsg(""), 2500);
  };
  const go = (v) => setParams(v === "sheet" ? {} : { view: v }, { replace: true });
  const pendingFacts = useMemo(() => (cp?.brain_facts_proposed || []).filter((f) => f.status === "proposed").length, [cp]);

  if (err) return <Shell title="Call" accent="Not found" right={<Link to="/calls" className="btn-d"><ArrowLeft className="h-3.5 w-3.5" />All calls</Link>}><p className="pt-6 text-[13px] text-[#ff8a7f]">{err}</p></Shell>;
  if (!cp) return <Shell title="Call" accent="Prep"><div className="grid min-h-[40vh] place-items-center"><Spinner size={18} /></div></Shell>;

  return (
    <Shell title={cp.title || "Call"} sub={<>{whoOf(cp)}{cp.contact_name ? ` · ${cp.contact_name}` : ""} · {typeLabel(cp.call_type)}{cp.scheduled_for ? ` · ${fmtWhen(cp.scheduled_for)}` : ""}{cp.client_id ? <> · <Link className="text-[#ff8a3d] hover:underline" to={`/clients/${cp.client_id}?tab=calls`}>client profile</Link></> : null}</>}
      right={<>
        <Link to="/calls" className="btn-d"><ArrowLeft className="h-3.5 w-3.5" />All calls</Link>
        <button type="button" className="btn-d" onClick={copy}><ClipboardCopy className="h-3.5 w-3.5" />Copy for call</button>
        <button type="button" className="btn-d" onClick={save} disabled={!dirty}><Save className="h-3.5 w-3.5" />{dirty ? "Save" : "Saved"}</button>
      </>}>
      <div className="flex flex-wrap items-center justify-between gap-3 pt-5">
        <GlideTabs value={view} onChange={go} label="Call views" options={[["sheet", "Cheat sheet", NotebookPen], ["plan", "Edit plan", ListChecks], ["call", "Timed run", Timer], ["after", "After the call", Sparkles, pendingFacts], ["notes", "Your notes", Wand2]]} />
        <div className="flex items-center gap-3 text-[12px]">
          {msg ? <span className="text-white">{msg}</span> : null}
          {cp.status !== "done" ? (
            <select className="inp !h-[30px] !w-auto" value={cp.status} onChange={(e) => set({ status: e.target.value })} aria-label="Status"><option value="draft">draft</option><option value="ready">ready</option><option value="done">done</option></select>
          ) : <span className="mono text-[10.5px] uppercase tracking-[.12em] text-[var(--ink-s)]">done</span>}
        </div>
      </div>
      {!(cp.agenda || []).length && !(cp.remember || []).length && !cp.reference_md && view !== "notes" ? (
        <div className="card mt-5 grid place-items-center gap-3 px-6 py-12 text-center">
          <p className="max-w-md text-[13px] text-[var(--ink-m)]">No plan yet. Structure it from your notes.</p>
          <button type="button" className="btn-f" onClick={regenerate} disabled={!!busy}>{busy ? <Spinner /> : <Wand2 className="h-3.5 w-3.5" />}Structure this call</button>
        </div>
      ) : view === "sheet" ? <CheatSheet cp={cp} set={set} onSave={save} />
        : view === "plan" ? <PlanView cp={cp} set={set} setAgenda={setAgenda} />
        : view === "call" ? <CallMode cp={cp} setAgenda={setAgenda} onSave={save} />
        : view === "after" ? <AfterCall cp={cp} set={set} replace={replace} onSave={save} />
        : (
          <section className="card rise mt-5 p-4 md:p-5">
            <VoiceBox value={cp.raw_notes} onChange={(v) => set({ raw_notes: v })} rows={8} label="Add to what this call needs to cover" />
            <label className="mt-4 block"><span className="lbl">Full prep notes (markdown; paste a prep from Claude here; read by the agent on later calls too)</span>
              <textarea className="inp mono !text-[12px]" rows={10} value={cp.reference_md || ""} onChange={(e) => set({ reference_md: e.target.value })} /></label>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <ArmBtn className="btn-f" armedLabel="Click again: this replaces the plan" onConfirm={regenerate} disabled={!!busy}>{busy ? <Spinner /> : <RefreshCw className="h-3.5 w-3.5" />}Re-structure from notes</ArmBtn>
              <span className="text-[11.5px] text-[var(--ink-s)]">Re-structuring replaces the agenda with a fresh one from these notes.</span>
            </div>
          </section>
        )}
    </Shell>
  );
}

export default function CallPrepPage() {
  const { id } = useParams();
  return !id || id === "new" ? <NewCall /> : <ExistingCall key={id} id={id} />;
}
