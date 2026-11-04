import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowUpRight, BookOpen, Copy, Lightbulb, Send, Sparkles, ShieldCheck } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { toast } from "@/components/ui/use-toast";
import { queueCustom } from "@/features/claude/jobs";
import PanelShell from "./PanelShell";
import { AUTONOMY, KIND_LABELS, Section, Stat, StatusPill, Tags, Empty, relTime, fmtDateTime, Md } from "../ui";
import { INTERSTELLAR_DEPTS, CLIENT_DEPTS, BRAIN_SECTIONS } from "../defs";
import { agentsCall } from "../useAgentsData";

const deptLabel = (a) => [...INTERSTELLAR_DEPTS, ...CLIENT_DEPTS].find((d) => d.key === a.department)?.label || (a.department === "ceo" ? "Client CEO" : a.department === "brain" ? "Brain" : a.department);

export function runsFor(agent, runs) {
  const names = new Set([...(agent.run_match || []), agent.name].filter(Boolean).map((s) => s.toLowerCase()));
  return runs.filter((r) => {
    const n = String(r.automation_name || "").toLowerCase();
    if (!names.has(n)) return false;
    return agent.client_id && agent.scope === "client" ? r.client_id === agent.client_id : true;
  });
}

export function learningsFor(agent, learnings) {
  return learnings.filter((l) => l.agent_key === agent.key || (agent.template_key && agent.client_id && l.agent_key === agent.template_key && l.client_id === agent.client_id));
}

export function notesFor(agent, notes) {
  return notes.filter((n) => {
    const fa = n.for_agents || [];
    if (agent.scope === "client") return n.client_id === agent.client_id && (fa.includes(agent.template_key) || fa.includes(agent.key) || fa.includes(agent.department));
    return !n.client_id && (fa.includes(agent.key) || fa.includes(agent.department));
  });
}

export default function AgentPanel({ agent: a, data, onClose, onOpenCeo, onOpenBrain, refresh }) {
  const navigate = useNavigate();
  const [teach, setTeach] = useState("");
  const [toBrain, setToBrain] = useState(false);
  const [section, setSection] = useState("problems");
  const [busy, setBusy] = useState("");
  const runs = useMemo(() => runsFor(a, data.runs).slice(0, 8), [a, data.runs]);
  const learns = useMemo(() => learningsFor(a, data.learnings).slice(0, 8), [a, data.learnings]);
  const notes = useMemo(() => notesFor(a, data.notes).slice(0, 6), [a, data.notes]);
  const brain = a.client_id ? data.brains.find((b) => b.client_id === a.client_id) : null;
  const isClaude = a.kind === "claude_scheduled_task";

  const saveLearning = async () => {
    const text = teach.trim();
    if (!text) return;
    setBusy("teach");
    try {
      await base44.entities.AgentLearning.create({ agent_key: a.scope === "client" ? a.template_key : a.key, department: a.department, client_id: a.client_id || "", client_name: a.client_name || "", date: new Date().toISOString().slice(0, 10), learning: text, source: "justin_feedback", status: "proposed", applied: false });
      if (toBrain && brain) await agentsCall("brain_add_update", { brain_id: brain.id, section, text, source: `Justin, via ${a.name}`, by: "justin", agent_key: a.key });
      setTeach("");
      toast({ title: "Saved", description: toBrain && brain ? "Learning saved and queued for the brain." : "Learning saved. Commander will factor it in." });
      refresh();
    } catch (e) {
      toast({ title: "Couldn't save", description: e.message, variant: "destructive" });
    }
    setBusy("");
  };

  const queueBuild = async () => {
    setBusy("build");
    try {
      await queueCustom({
        title: `Agent build plan — ${a.name}`,
        kind: "other",
        instructions: [
          `Plan the build of a planned agent from the Møthership Agent Constellation (AgentRegistry key \`${a.key}\`).`,
          "", `Name: ${a.name}`, `Department: ${deptLabel(a)}`, `What it should do: ${a.role}`, `Replaces: ${a.replaces || "unknown"}`,
          `Target autonomy: ${a.autonomy_target || "assisted"} · approval required: ${a.approval_required ? "yes" : "no"}`,
          `Reads: ${(a.reads_knowledge || []).join(", ") || "tbd"} · Writes: ${(a.writes_knowledge || []).join(", ") || "tbd"}`,
          `KPIs: ${(a.kpis || []).join(", ") || "tbd"}`,
          "", "Deliver: (1) the recommended mechanism (Claude scheduled task, Base44 workflow, in-app AI or backend function) and why,",
          "(2) the complete standalone prompt or the exact workflow/function design, (3) the data it reads and writes, (4) its approval gates,",
          "(5) how it logs runs (AutomationRun) and learnings (AgentLearning) so Commander can see it.",
          "Do NOT create scheduled tasks or workflows, do not change live behavior, and never send anything to a client. Justin approves first.",
        ].join("\n"),
      });
      toast({ title: "Sent to Claude", description: "A build plan job is in the Claude queue." });
    } catch (e) {
      toast({ title: "Couldn't queue it", description: e.message, variant: "destructive" });
    }
    setBusy("");
  };

  const refineBrain = async () => {
    if (!brain) return;
    setBusy("refine");
    try {
      const r = await agentsCall("brain_refine", { brain_id: brain.id });
      toast({ title: "Brain refined", description: `${r.updated_sections?.length || 0} sections updated · ${r.conflicts || 0} conflicts flagged` });
      refresh();
    } catch (e) {
      toast({ title: "Refine failed", description: e.message, variant: "destructive" });
    }
    setBusy("");
  };

  const copy = (s) => { navigator.clipboard?.writeText(s).then(() => toast({ title: "Copied", description: s })).catch(() => null); };
  const success = a.success_rate_30d != null ? `${Math.round(a.success_rate_30d * 100)}%` : null;

  return (
    <PanelShell onClose={onClose} label={`Agent: ${a.name}`}>
      <header className="px-5 pb-4 pt-5 pr-12">
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={a.status} />
          <span className="eyebrow">{deptLabel(a)}{a.branch ? ` · ${a.branch}` : ""}</span>
        </div>
        <h2 className="mt-2.5 text-[21px] font-semibold leading-tight tracking-[-0.02em] text-white">{a.name}</h2>
        {a.client_name ? <p className="mono mt-1 text-[11px] uppercase tracking-[.14em] text-[#ff8a3d]">{a.client_name}</p> : null}
        <p className="mt-2.5 text-[13.5px] leading-relaxed text-[var(--ink-m)]">{a.role}</p>
      </header>

      <div className="grid grid-cols-2 gap-2 px-5 pb-4">
        <Stat label="Kind" value={KIND_LABELS[a.kind] || a.kind || "—"} />
        <Stat label="Schedule" value={a.schedule || (a.status === "planned" ? "Not built" : "—")} />
        <Stat label="Last run" value={relTime(a.last_run_at)} hint={a.last_run_at ? `${fmtDateTime(a.last_run_at)} · ${a.last_status || ""}` : a.last_status || ""} />
        <Stat label="Runs · 30 days" value={a.run_count_30d != null ? String(a.run_count_30d) : runs.length ? String(runs.length) : "—"} hint={success ? `${success} success` : ""} />
        <Stat label="Autonomy" value={AUTONOMY[a.autonomy] || (a.status === "planned" ? "Not built" : "—")} hint={a.autonomy_target ? `Target: ${AUTONOMY[a.autonomy_target]}` : ""} />
        <Stat label="Approval" value={a.approval_required ? "Justin approves" : "Runs on its own"} accent={!!a.approval_required} />
      </div>

      <div className="flex flex-wrap gap-2 px-5 pb-4">
        {a.key === "commander" || a.template_key === "client_ceo" ? <button type="button" className="btn-f" onClick={onOpenCeo}><Sparkles className="h-4 w-4" />Talk to {a.template_key === "client_ceo" ? "Client CEO" : a.name}</button> : null}
        {a.template_key === "brain_keeper" && brain ? <><button type="button" className="btn-f" onClick={onOpenBrain}><BookOpen className="h-4 w-4" />Open brain</button><button type="button" className="btn-d" disabled={!!busy} onClick={refineBrain}>{busy === "refine" ? "Refining…" : "Refine now"}</button></> : null}
        {a.open_url && !a.open_url.startsWith("/agents") ? <button type="button" className="btn-d" onClick={() => navigate(a.open_url)}>Open its page<ArrowUpRight className="h-3.5 w-3.5" /></button> : null}
        {a.status === "planned" ? <button type="button" className="btn-f" disabled={!!busy} onClick={queueBuild}><Send className="h-4 w-4" />{busy === "build" ? "Sending…" : "Send build plan to Claude"}</button> : null}
        {isClaude && a.external_id ? <button type="button" className="btn-d" onClick={() => copy(a.external_id)}><Copy className="h-3.5 w-3.5" />Copy task id</button> : null}
      </div>
      {isClaude ? <p className="px-5 pb-4 text-[11.5px] leading-relaxed text-[var(--ink-s)]">Pause, resume or edit this scheduled task in Claude (Scheduled tasks). It is never run from here.</p> : null}
      {a.kind === "base44_workflow" || a.kind === "client_app_workflow" ? <p className="px-5 pb-4 text-[11.5px] leading-relaxed text-[var(--ink-s)]">Workflow {a.external_id}. Pausing happens in the app's Workflows screen; nothing here can start a client-facing send.</p> : null}

      {a.notes ? <Section title="Notes"><p className="text-[13px] leading-relaxed text-[var(--ink-m)]">{a.notes}</p></Section> : null}

      <Section title="Replaces"><p className="text-[13px] text-[var(--ink-d)]">{a.replaces || "—"}</p></Section>
      <Section title="Knowledge it reads"><Tags items={a.reads_knowledge} /></Section>
      <Section title="Knowledge it writes"><Tags items={a.writes_knowledge} /></Section>
      {a.kpis?.length ? <Section title="KPIs"><Tags items={a.kpis} /></Section> : null}
      {a.status === "planned" && a.build_order ? <Section title="Build order"><p className="text-[13px] text-[var(--ink-d)]">#{a.build_order} · {a.build_priority || "—"} priority</p></Section> : null}

      <Section title={`Recent runs (${runs.length})`}>
        {runs.length ? (
          <ul className="space-y-1.5">
            {runs.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 text-[12.5px]">
                <span className="min-w-0 text-[var(--ink-m)]"><span className={r.status === "failed" ? "text-[#ff8a7f]" : "text-[var(--ink-d)]"}>{r.status}</span>{r.client_name ? ` · ${r.client_name}` : ""}{r.message ? ` · ${r.message}` : ""}</span>
                <span className="mono shrink-0 text-[10.5px] text-[var(--ink-s)]">{relTime(r.started_at || r.created_date)}</span>
              </li>
            ))}
          </ul>
        ) : <Empty>{a.kind === "claude_scheduled_task" ? "Claude tasks report last-run status via the daily registry sync; per-run logs appear here when the task writes an AutomationRun." : "No runs logged in the last 30 days."}</Empty>}
      </Section>

      <Section title={`Learnings (${learns.length})`}>
        {learns.length ? (
          <ul className="space-y-2.5">
            {learns.map((l) => (
              <li key={l.id} className="rounded-lg border border-[var(--hair-d)] p-2.5">
                <p className="mono text-[10px] uppercase tracking-[.14em] text-[var(--ink-s)]">{l.date || String(l.created_date).slice(0, 10)} · {String(l.source || "").replace("_", " ")} · {l.status || "proposed"}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-d)]">{l.learning}</p>
                {l.proposed_change ? <p className="mt-1 text-[12px] text-[#ffb27a]">Proposes: {l.proposed_change}</p> : null}
              </li>
            ))}
          </ul>
        ) : <Empty>No learnings yet. The registry sync and the research department add them; you can teach it below.</Empty>}
      </Section>

      <Section title={`Research feeding it (${notes.length})`}>
        {notes.length ? (
          <ul className="space-y-2.5">
            {notes.map((n) => (
              <li key={n.id} className="rounded-lg border border-[var(--hair-d)] p-2.5">
                <p className="text-[12.5px] font-medium text-white">{n.topic}</p>
                <div className="mt-1"><Md>{n.summary}</Md></div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">{(n.sources || []).slice(0, 3).map((s) => <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="text-[11.5px] text-[#ff8a3d] underline-offset-2 hover:underline">{s.title || s.url}</a>)}</div>
              </li>
            ))}
          </ul>
        ) : <Empty>No research notes tagged for this agent yet.</Empty>}
      </Section>

      <Section title="Teach this agent" right={<Lightbulb className="h-3.5 w-3.5 text-[#ff8a3d]" />}>
        <textarea className="inp w-full" rows={3} placeholder="What should it do differently? (saved as your feedback; nothing changes until approved)" value={teach} onChange={(e) => setTeach(e.target.value)} />
        {brain ? (
          <label className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-[var(--ink-m)]">
            <input type="checkbox" checked={toBrain} onChange={(e) => setToBrain(e.target.checked)} className="accent-[#ff6a00]" />
            Also add to {a.client_name}'s brain as a finding in
            <select className="inp !h-7 !px-2 !text-[12px]" value={section} onChange={(e) => setSection(e.target.value)} disabled={!toBrain}>
              {BRAIN_SECTIONS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </label>
        ) : null}
        <div className="mt-2.5 flex justify-end"><button type="button" className="btn-d" disabled={!teach.trim() || !!busy} onClick={saveLearning}><ShieldCheck className="h-3.5 w-3.5" />{busy === "teach" ? "Saving…" : "Save learning"}</button></div>
      </Section>
      <div className="h-4 shrink-0" />
    </PanelShell>
  );
}
