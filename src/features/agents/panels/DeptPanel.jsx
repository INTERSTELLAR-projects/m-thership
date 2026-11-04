import { useNavigate } from "react-router-dom";
import { ArrowRight, BookOpen, Sparkles } from "lucide-react";
import PanelShell from "./PanelShell";
import { Section, StatusDot, Stat, KIND_SHORT, relTime } from "../ui";
import { countStatus } from "../layout";

function AgentRow({ a, onPick }) {
  return (
    <button type="button" onClick={() => onPick(a)} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/[0.04]">
      <StatusDot status={a.status} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] text-white">{a.name}</span>
        <span className="block truncate text-[11px] text-[var(--ink-s)]">{KIND_SHORT[a.kind] || a.kind}{a.schedule ? ` · ${a.schedule}` : ""}</span>
      </span>
      <span className="mono shrink-0 text-[10.5px] text-[var(--ink-s)]">{a.status === "planned" ? (a.build_order ? `#${a.build_order}` : "planned") : relTime(a.last_run_at)}</span>
    </button>
  );
}

export function DeptPanel({ dept, agents, onClose, onPick, onOpenView }) {
  const c = countStatus(agents);
  const groups = ["broken", "live", "paused", "planned"].map((s) => [s, agents.filter((a) => a.status === s).sort((x, y) => (s === "planned" ? (x.build_order || 99) - (y.build_order || 99) : String(x.name).localeCompare(String(y.name))))]).filter(([, l]) => l.length);
  return (
    <PanelShell onClose={onClose} label={dept.label}>
      <header className="px-5 pb-4 pt-5 pr-12">
        <p className="eyebrow">Department · {dept.code}</p>
        <h2 className="mt-2 text-[24px] font-semibold tracking-[-0.03em] text-white">{dept.label.split(" ").slice(0, -1).join(" ")} <span className="text-[#ff3c00]">/{dept.label.split(" ").slice(-1)[0]}</span></h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-m)]">{dept.blurb}</p>
      </header>
      <div className="grid grid-cols-4 gap-2 px-5 pb-4">
        <Stat label="Live" value={String(c.live)} accent />
        <Stat label="Paused" value={String(c.paused)} />
        <Stat label="Planned" value={String(c.planned)} />
        <Stat label="Broken" value={String(c.broken)} />
      </div>
      {onOpenView ? <div className="px-5 pb-4"><button type="button" className="btn-f" onClick={onOpenView}>Open the {dept.label} tree<ArrowRight className="h-4 w-4" /></button></div> : null}
      {groups.map(([s, list]) => (
        <Section key={s} title={`${s} · ${list.length}`}>
          <div className="-mx-2">{list.map((a) => <AgentRow key={a.key} a={a} onPick={onPick} />)}</div>
        </Section>
      ))}
      <div className="h-4 shrink-0" />
    </PanelShell>
  );
}

export function ClientPanel({ client, agents, brain, onClose, onPick, onOpenWeb, onOpenBrain, onOpenCeo }) {
  const navigate = useNavigate();
  const c = countStatus(agents.filter((a) => a.template_key));
  const ops = agents.filter((a) => a.department === "ops");
  const attention = agents.filter((a) => a.status === "broken" || a.last_status === "failed" || a.last_status === "needs_approval");
  return (
    <PanelShell onClose={onClose} label={client.business}>
      <header className="px-5 pb-4 pt-5 pr-12">
        <p className="eyebrow">Client constellation</p>
        <h2 className="mt-2 text-[24px] font-semibold leading-tight tracking-[-0.03em] text-white">{client.business}</h2>
        <p className="mt-1.5 text-[12.5px] text-[var(--ink-m)]">{[client.industry, client.location].filter(Boolean).join(" · ")}</p>
        {client.plan ? <p className="mono mt-1.5 text-[10.5px] uppercase tracking-[.12em] text-[#ff8a3d]">{client.plan}</p> : null}
      </header>
      <div className="grid grid-cols-4 gap-2 px-5 pb-4">
        <Stat label="Live" value={String(c.live)} accent />
        <Stat label="Paused" value={String(c.paused)} />
        <Stat label="Planned" value={String(c.planned)} />
        <Stat label="Brain" value={`${Math.round(brain?.completeness || 0)}%`} />
      </div>
      <div className="flex flex-wrap gap-2 px-5 pb-4">
        <button type="button" className="btn-f" onClick={onOpenWeb}>Open constellation<ArrowRight className="h-4 w-4" /></button>
        <button type="button" className="btn-d" onClick={onOpenBrain}><BookOpen className="h-3.5 w-3.5" />Brain</button>
        <button type="button" className="btn-d" onClick={onOpenCeo}><Sparkles className="h-3.5 w-3.5" />Client CEO</button>
        <button type="button" className="btn-d" onClick={() => navigate(`/clients/${client.id}`)}>Cockpit</button>
      </div>
      {brain?.glance ? <Section title="At a glance"><p className="line-clamp-6 whitespace-pre-line text-[12.5px] leading-relaxed text-[var(--ink-m)]">{brain.glance.replace(/[#*]/g, "")}</p></Section> : null}
      <Section title={`Needs a look · ${attention.length}`}>
        {attention.length ? <div className="-mx-2">{attention.map((a) => <AgentRow key={a.key} a={a} onPick={onPick} />)}</div> : <p className="text-[12.5px] text-[var(--ink-s)]">Nothing broken or waiting on approval.</p>}
      </Section>
      {ops.length ? <Section title={`Client app automations · ${ops.length}`}><div className="-mx-2">{ops.map((a) => <AgentRow key={a.key} a={a} onPick={onPick} />)}</div></Section> : null}
      <div className="h-4 shrink-0" />
    </PanelShell>
  );
}
