// Detail panel for Constellation v2: facts, the last 10 activities, what the node is waiting on (Needs you) and actions.
// Actions only open existing pages or the classic panels (which hold teach / refine). Nothing here runs, pauses or deletes.
import { Link } from "react-router-dom";
import { ArrowUpRight, ExternalLink, Network, Zap, Bot, Inbox, PlugZap } from "lucide-react";
import PanelShell from "../panels/PanelShell";
import { StatusPill, StatusDot, Stat, Section, Empty, Title, relTime, KIND_LABELS, AUTONOMY } from "../ui";
import { activitiesFor, waitingFor, appName, COLORS, LANES } from "./graph";
import { PILLARS } from "./pillars";

const TYPE_COLOR = { run: COLORS.command, work: COLORS.result, job: COLORS.claude, research: COLORS.intel, fact: COLORS.brain };
const TYPE_WORD = { run: "Run", work: "Result", job: "Claude job", research: "Research", fact: "Fact", search_intel: "Intel", oracle: "Oracle", ideas: "Idea", learnings: "Learning" };

function ActRow({ a }) {
  const inner = (
    <>
      <span className="mt-[5px] inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: TYPE_COLOR[a.type] || COLORS.intel, boxShadow: `0 0 8px ${TYPE_COLOR[a.type] || COLORS.intel}` }} />
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[12.5px] leading-snug text-[var(--ink-d)]">{a.label}</span>
        <span className="mono mt-0.5 block text-[10px] uppercase tracking-[.1em] text-[var(--ink-s)]">{TYPE_WORD[a.type] || a.type} · {relTime(new Date(a.at).toISOString())}{a.rec?.status ? ` · ${String(a.rec.status).replace(/_/g, " ")}` : ""}</span>
      </span>
      {a.href ? <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ink-s)]" /> : null}
    </>
  );
  return a.href ? <Link to={a.href} className="shp-row !items-start">{inner}</Link> : <div className="shp-row !items-start">{inner}</div>;
}

function AgentRows({ agents, onSelect, selId }) {
  if (!agents?.length) return <Empty>No agents on this branch yet.</Empty>;
  return (
    <div className="-mx-2 space-y-0.5">
      {agents.slice().sort((a, b) => (a.status === "live" ? -1 : 1) - (b.status === "live" ? -1 : 1) || String(a.name).localeCompare(String(b.name))).map((a) => (
        <button key={a.key} type="button" className={`shp-row ${selId === `agent:${a.key}` ? "on" : ""}`} onClick={() => onSelect(`agent:${a.key}`)}>
          <StatusDot status={a.status} size={7} />
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--ink-d)]">{a.name}</span>
          <span className="mono shrink-0 text-[10px] text-[var(--ink-s)]">{a.status === "planned" ? "planned" : relTime(a.last_run_at)}</span>
        </button>
      ))}
    </div>
  );
}

function Actions({ items }) {
  const list = items.filter(Boolean);
  if (!list.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {list.map((x) => (x.href?.startsWith("http")
        ? <a key={x.label} href={x.href} target="_blank" rel="noreferrer" className={x.primary ? "btn-f" : "btn-d"}><x.icon className="h-3.5 w-3.5" />{x.label}</a>
        : <Link key={x.label} to={x.href} className={x.primary ? "btn-f" : "btn-d"}><x.icon className="h-3.5 w-3.5" />{x.label}</Link>))}
    </div>
  );
}

export default function ShipPanel({ selId, noteId, ship, data, registry, onClose, onSelect }) {
  const node = ship.nodes[selId];
  const agent = selId.startsWith("agent:") ? registry.find((a) => a.key === selId.slice(6)) : null;
  if (!node && !agent) return null;
  const acts = activitiesFor(selId, ship, data, registry, 10);
  const waits = waitingFor(selId, ship, data, registry);
  const note = noteId ? (data.research || []).find((n) => n.id === noteId) : null;

  let eyebrow = ""; let title = ""; let sub = ""; let status = null; let stats = []; let body = null; let actions = [];
  if (agent) {
    eyebrow = agent.scope === "client" ? `Client agent · ${agent.client_name || ""}` : "Møthership agent";
    title = agent.name; sub = agent.role || ""; status = agent.status;
    stats = [
      ["Kind", KIND_LABELS[agent.kind] || agent.kind],
      ["Last run", agent.status === "planned" ? "planned" : relTime(agent.last_run_at)],
      ["Last result", String(agent.last_status || "unknown").replace(/_/g, " ")],
      ["Runs · 30 days", agent.run_count_30d ?? "—"],
      ["Schedule", agent.schedule || "—"],
      ["Autonomy", AUTONOMY[agent.autonomy] || "—"],
    ];
    if (agent.kind === "client_app_workflow") stats.push(["Lives in", appName(agent.owner_app)], ["Synced", relTime(agent.synced_at)]);
    const classic = agent.scope === "client" ? `/agents?v=classic&web=clients&client=${agent.client_id}&agent=${encodeURIComponent(agent.key)}` : `/agents?v=classic&agent=${encodeURIComponent(agent.key)}`;
    actions = [
      agent.open_url ? { label: "Open", href: agent.open_url, icon: ExternalLink, primary: true } : null,
      { label: "Teach / full panel", href: classic, icon: Network, primary: !agent.open_url },
      agent.kind === "base44_workflow" || agent.kind === "client_app_workflow" ? { label: "Automations", href: "/automations", icon: Zap } : null,
      agent.kind === "claude_scheduled_task" ? { label: "Claude queue", href: "/claude", icon: Bot } : null,
    ];
    body = (
      <p className="px-5 pb-1 text-[11.5px] leading-relaxed text-[var(--ink-s)]">
        {agent.kind === "claude_scheduled_task" ? "Runs as a Claude scheduled task: pause or resume it in Claude (Scheduled tasks). Never run from here."
          : agent.kind === "client_app_workflow" ? `Runs inside ${agent.owner_app ? appName(agent.owner_app) : "the client's app"}. Møthership reads its status through the nightly registry sync; pause or edit it in that app.`
            : "Pause, resume or change it from the page it lives on (Open)."}
      </p>
    );
  } else if (node.type === "claude") {
    eyebrow = "The engine"; title = "Claude"; sub = "Every agent, brief, plan and research note runs through Claude.";
    stats = [["AI calls today", node.metrics.aiCallsToday], ["Claude runs today", node.metrics.claudeRunsToday], ["Facts in the brain", node.metrics.factsActive], ["Learned · 7 days", node.metrics.learned7d]];
    actions = [{ label: "Claude queue", href: "/claude", icon: Bot, primary: true }, { label: "AI usage", href: "/client-usage", icon: Zap }];
  } else if (node.type === "brain") {
    eyebrow = "Main brain"; title = "Møthership Brain"; sub = "What the business knows, scored across the 8 pillars.";
    stats = [["Facts", node.metrics.factsActive], ["Brain complete", node.metrics.completeness == null ? "—" : `${node.metrics.completeness}%`]];
    const ps = node.metrics.pillars || {};
    body = (
      <Section title="Pillars (from today's brief)">
        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5">
          {PILLARS.map((p) => {
            const v = ps[p.id]?.score;
            return (
              <Link key={p.id} to={`/pillars?p=${p.id}`} className="group min-w-0">
                <span className="flex items-center justify-between text-[11.5px] text-[var(--ink-m)] group-hover:text-white"><span className="truncate">{p.name}</span><span className="mono text-[10.5px]">{v ?? "—"}</span></span>
                <span className="shp-bar mt-1 block"><span style={{ width: `${v || 0}%`, background: `linear-gradient(90deg, ${COLORS.brain}, ${COLORS.command})` }} /></span>
              </Link>
            );
          })}
        </div>
      </Section>
    );
    actions = [{ label: "Open the Brain", href: "/brain", icon: ExternalLink, primary: true }, { label: "Pillars", href: "/pillars", icon: Network }, { label: "Refine / teach", href: "/agents?v=classic&brain=1", icon: Network }];
  } else if (node.type === "lane") {
    eyebrow = "Research flowing in"; title = node.label; sub = node.sub;
    stats = [["This week", node.metrics.week], ["Waiting on you", node.metrics.waiting], ["On file", node.metrics.total], ["Latest", relTime(node.metrics.last)]];
    const L = LANES.find((x) => `lane:${x.key}` === selId);
    actions = [L?.path ? { label: `Open ${node.label}`, href: L.path, icon: ExternalLink, primary: true } : null];
  } else if (node.type === "ideas") {
    eyebrow = "Ideas going out"; title = node.label; sub = "Research turned into moves. Approve them on Command.";
    stats = [["Ideas waiting", node.metrics.ideasWaiting], ["Need you", node.metrics.needsYou]];
    actions = [{ label: "Needs you on Command", href: "/", icon: Inbox, primary: true }, { label: "Idea Vault", href: "/idea-vault", icon: ExternalLink }];
  } else if (node.type === "dept") {
    eyebrow = `Department · ${node.code}`; title = node.label; sub = node.sub; status = node.status;
    stats = [["Agents", `${node.metrics.live} live / ${node.metrics.agents}`], ["Runs today", node.metrics.runsToday], ["Last run", relTime(node.metrics.lastRun)], ["Client agents it commands", node.metrics.clientAgents]];
    body = <Section title={`Agents (${node.agents.length})`}><AgentRows agents={node.agents} onSelect={onSelect} selId={selId} /></Section>;
    actions = [{ label: "Department tree", href: `/agents?v=classic&dept=${node.key}`, icon: Network, primary: true }];
  } else if (node.type === "client" || node.type === "cagents" || node.type === "cgroup") {
    const c = ship.nodes[`client:${node.clientId}`];
    eyebrow = node.type === "cgroup" ? (node.appId ? "Client app" : "Client agents") : "Client"; title = node.type === "client" ? c.label : node.label; sub = node.type === "client" ? c.sub : c.label;
    status = node.status || c.status;
    stats = node.type === "cgroup"
      ? [["Agents", node.metrics.agents], ["Runs today", node.metrics.runsToday], ["Last synced", node.appId ? relTime(node.metrics.synced) : "live in Møthership"]]
      : [["Health", c.health == null ? "—" : `${c.health}%`], ...(c.clientBrain?.total ? [["Brain answered", `${c.clientBrain.answered}/${c.clientBrain.total}`]] : []), ["Agents", `${c.metrics.live} live / ${c.metrics.agents}`], ["In their apps", c.metrics.inApp], ["Runs today", c.metrics.runsToday], ["Results today", c.metrics.workToday], ["New research", c.metrics.newResearch]];
    const agents = node.type === "cgroup" ? node.agents : (registry || []).filter((a) => a.scope === "client" && a.client_id === node.clientId);
    const cb = c.clientBrain;
    body = (
      <>
        {node.type !== "cgroup" && cb ? (
          <Section title={cb.total ? `Business Brain: ${cb.answered}/${cb.total} answered` : "Business Brain"}>
            {cb.total ? (
              <div className="mb-2.5">
                <span className="shp-bar block"><span style={{ width: `${cb.score || 0}%`, background: `linear-gradient(90deg, ${COLORS.brain}, ${COLORS.command})` }} /></span>
                <p className="mono mt-1.5 text-[10px] uppercase tracking-[.1em] text-[var(--ink-s)]">{cb.score}% complete · counts toward health{cb.syncedAt ? ` · synced ${relTime(cb.syncedAt)}` : ""}{cb.apps.length ? ` · from ${cb.apps.map((a) => a.name).join(", ")}` : ""}</p>
              </div>
            ) : null}
            {cb.latest.length ? (
              <div className="space-y-2">
                {cb.latest.map((f) => (
                  <div key={f.id} className="min-w-0">
                    {f.question ? <p className="line-clamp-1 text-[11px] text-[var(--ink-s)]">{f.question}</p> : null}
                    <p className="line-clamp-3 text-[12.5px] leading-snug text-[var(--ink-d)]">{f.statement}</p>
                    <p className="mono mt-0.5 text-[10px] uppercase tracking-[.1em] text-[var(--ink-s)]">{f.area || "other"}{f.captured_by_name ? ` · ${f.captured_by_name}` : ""} · {relTime(f.answered_at || f.created_date)}</p>
                  </div>
                ))}
              </div>
            ) : <Empty>No answers yet.</Empty>}
          </Section>
        ) : null}
        {node.type !== "cgroup" ? (
          <Section title="Connected apps">
            {c.apps.length ? (
              <div className="flex flex-wrap gap-1.5">{c.apps.map((a) => <button key={a.id} type="button" onClick={() => onSelect(`cgroup:${node.clientId}:app:${a.id}`)} className="chip">{a.label}</button>)}</div>
            ) : <Empty>No app connected to Møthership for this client yet.</Empty>}
          </Section>
        ) : null}
        {node.type === "cgroup" && node.appId && !node.agents.length ? (
          <Section title="Next step">
            <p className="flex gap-2 text-[12.5px] leading-relaxed text-[var(--ink-m)]"><PlugZap className="mt-0.5 h-4 w-4 shrink-0 text-[#ffc23d]" />No agents have been read from this app yet. Connect: add this app to the nightly registry sync so its workflows and in-app AI show up here.</p>
          </Section>
        ) : null}
        <Section title={`Agents (${agents.length})`}><AgentRows agents={agents} onSelect={onSelect} selId={selId} /></Section>
      </>
    );
    actions = [
      { label: "Client cockpit", href: `/clients/${node.clientId}`, icon: ExternalLink, primary: true },
      { label: "Client constellation", href: `/agents?v=classic&web=clients&client=${node.clientId}`, icon: Network },
      c.client?.websites?.[0] ? { label: "Website", href: `https://${String(c.client.websites[0]).replace(/^https?:\/\//, "").split("/")[0].toLowerCase()}`, icon: ArrowUpRight } : null,
    ];
  }

  return (
    <PanelShell onClose={onClose} label={`${title} details`}>
      <div className="px-5 pb-3 pt-5 pr-12">
        <p className="eyebrow">{eyebrow}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2"><Title>{title}</Title>{status ? <StatusPill status={status} /> : null}</div>
        {sub ? <p className="mt-1.5 text-[12.5px] leading-relaxed text-[var(--ink-m)]">{sub}</p> : null}
      </div>
      {stats.length ? <div className="grid grid-cols-2 gap-2 px-5 pb-4">{stats.map(([l, v]) => <Stat key={l} label={l} value={String(v ?? "—")} />)}</div> : null}
      {body}
      {note ? (
        <Section title="Research note">
          <p className="text-[13.5px] font-medium text-white">{note.topic}</p>
          {note.client_name ? <p className="mono mt-0.5 text-[10.5px] text-[var(--ink-s)]">{note.client_name} · {note.relevance || "—"} relevance · {note.status}</p> : null}
          <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--ink-m)]">{note.summary}</p>
          {note.proposed_change ? <p className="mt-2 text-[12.5px] leading-relaxed text-[var(--ink-d)]"><span className="text-[#ffc23d]">Proposed:</span> {note.proposed_change}</p> : null}
          {(note.sources || []).length ? <div className="mt-2 space-y-1">{note.sources.slice(0, 5).map((s, i) => { const u = typeof s === "string" ? s : s?.url; return u ? <a key={i} href={u} target="_blank" rel="noreferrer" className="block truncate text-[11.5px] text-[#ff8a3d] underline underline-offset-2">{(typeof s === "object" && s.title) || u}</a> : null; })}</div> : null}
        </Section>
      ) : null}
      <Section title={`Needs you (${waits.length})`}>
        {waits.length ? <div className="-mx-2 space-y-0.5">{waits.slice(0, 8).map((w) => (
          <Link key={w.key} to={w.href} className="shp-row"><Inbox className="h-3.5 w-3.5 shrink-0 text-[#ffc23d]" /><span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--ink-d)]">{w.label}</span><ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-[var(--ink-s)]" /></Link>
        ))}{waits.length > 8 ? <p className="px-2 pt-1 text-[11px] text-[var(--ink-s)]">+{waits.length - 8} more</p> : null}</div> : <Empty>Nothing waiting on you here.</Empty>}
      </Section>
      <Section title="Last 10 activities">
        {acts.length ? <div className="-mx-2 space-y-0.5">{acts.map((a) => <ActRow key={a.key} a={a} />)}</div> : <Empty>No recorded activity yet.</Empty>}
      </Section>
      <Section title="Actions"><Actions items={actions} /></Section>
      <div className="h-4" />
    </PanelShell>
  );
}
