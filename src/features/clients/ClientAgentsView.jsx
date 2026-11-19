// Client profile, "Agents" section: the Agents page (Constellation v2, the ship) scoped to one client.
// Same dark stage, same cards and the same flowing connections, but everything is this client's:
//   wiring in (website, Command System, portal, data sources) -> Claude -> the client's Brain -> their agent
//   departments -> what they delivered, plus what needs Justin and what is due next.
// Every number comes from real records. Nothing connected / nothing run yet shows as exactly that.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Brain, Sparkles, Globe, PlugZap, LayoutDashboard, BarChart3, CreditCard, Search, Share2, Megaphone, Mail, Star,
  FileBarChart, Bot, ChevronDown, ChevronRight, ArrowUpRight, Inbox, CalendarClock, CheckCircle2, CircleDashed,
} from "lucide-react";
import "@/features/agents/agents.css";
import "@/features/agents/ship/ship.css";
import { base44 } from "@/api/base44Client";
import { useShipData } from "@/features/agents/ship/useShipData";
import { COLORS, runMatchesAgent, clientBrainOf, when } from "@/features/agents/ship/graph";
import FlowCanvas from "@/features/agents/ship/FlowCanvas";
import { StatusDot, relTime, Spinner } from "@/features/agents/ui";
import { CLIENT_DEPTS } from "@/features/agents/defs";
import { loadClientContext } from "./clientContext";
import { evaluateCriteria } from "./criteria";

const arr = (v) => (Array.isArray(v) ? v : (v && v.items) || []);
const safe = (p) => Promise.resolve(p).then(arr).catch(() => []);
const DEPT_ICON = { research: Search, seo: BarChart3, social: Share2, ads: Megaphone, email: Mail, reviews: Star, website: Globe, reporting: FileBarChart, ops: PlugZap };
const orbRate = (c, base = 0.1) => Math.min(2.2, base + 0.32 * Math.log1p(Math.max(0, Number(c) || 0)));
const orbGlow = (c) => 0.35 + 0.65 * Math.min(1, Math.log1p(Math.max(0, Number(c) || 0)) / Math.log1p(40));
const stream = (c, base) => ({ count: Math.max(0, Number(c) || 0), rate: orbRate(c, base), glow: orbGlow(c) });
const dayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };
const since = (iso, t) => Boolean(iso) && new Date(iso).getTime() >= t;
const ago = (iso) => (iso ? relTime(new Date(iso).toISOString()) : "");
const ahead = (iso) => {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "due now";
  const h = Math.round(ms / 36e5);
  return h < 1 ? "within the hour" : h < 24 ? `in ${h}h` : `in ${Math.round(h / 24)}d`;
};
// Same Møthership department a client agent rolls up to, used to colour work results by category.
const CATEGORY_DEPT = { seo: "seo", content: "seo", gbp: "seo", citations: "seo", social: "social", ads: "ads", email: "email", website: "website", app_build: "ops", ops: "ops", research: "research", reviews: "reviews", reporting: "reporting" };

async function loadClientExtras(clientId) {
  const E = base44.entities;
  const [automations, tasks, snapshots, worklog, actions] = await Promise.all([
    safe(E.Automation.filter({ client_id: clientId }, "-last_run_at", 100)),
    safe(E.Task.filter({ client_id: clientId }, "due_date", 200)),
    safe(E.PerformanceSnapshot.filter({ client_id: clientId }, "-period_end", 60)),
    safe(E.WorkLog.filter({ client_id: clientId }, "-date", 40)),
    safe(E.ProposedAction.filter({ client_id: clientId, status: "pending" }, "-created_date", 30)),
  ]);
  return { automations, tasks, snapshots, worklog, actions };
}

function usePrefersReducedMotion() {
  const q = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const [r, setR] = useState(!!q?.matches);
  useEffect(() => { if (!q) return undefined; const on = () => setR(q.matches); q.addEventListener?.("change", on); return () => q.removeEventListener?.("change", on); }, [q]);
  return r;
}

// ---------------------------------------------------------------- cards (ship look)
function Card({ id, reg, onClick, className = "", children, label, tint, as = "div" }) {
  const Tag = onClick ? "button" : as;
  return (
    <Tag type={onClick ? "button" : undefined} ref={reg(id)} data-node={id} aria-label={label} onClick={onClick} className={`shp-card ${className}`}>
      {tint ? <span className="shp-tint" style={{ background: tint, boxShadow: `0 0 10px ${tint}` }} /> : null}
      {children}
    </Tag>
  );
}

function WireCard({ node, reg }) {
  const Icon = node.icon;
  const tone = node.state === "on" ? "#2ee6c5" : node.state === "partial" ? "#ffc23d" : "rgba(255,255,255,.28)";
  const body = (
    <div className="flex items-center gap-2">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: node.state === "off" ? "rgba(255,255,255,.04)" : "rgba(56,200,255,.1)", boxShadow: `inset 0 0 0 1px ${node.state === "off" ? "rgba(255,255,255,.12)" : "rgba(56,200,255,.35)"}` }}><Icon className="h-3.5 w-3.5" style={{ color: node.state === "off" ? "rgba(255,255,255,.4)" : "#38c8ff" }} /></span>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 truncate text-[12.5px] font-medium text-white"><i className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: tone, boxShadow: node.state === "off" ? "none" : `0 0 6px ${tone}` }} />{node.label}</p>
        <p className="mono truncate text-[9.5px] text-[var(--ink-s)]" title={node.sub}>{node.sub}</p>
      </div>
    </div>
  );
  return node.href
    ? <a ref={reg(node.id)} data-node={node.id} href={node.href} target="_blank" rel="noreferrer" className={`shp-card block px-3 py-2.5 ${node.state === "off" ? "opacity-70" : ""}`}>{body}</a>
    : <div ref={reg(node.id)} data-node={node.id} className={`shp-card px-3 py-2.5 ${node.state === "off" ? "opacity-70" : ""}`}>{body}</div>;
}

function ClaudeCard({ m, reg }) {
  return (
    <Card id="claude" reg={reg} label="Claude, the engine" className="shp-clear overflow-hidden px-4 pb-3.5 pt-3">
      <p className="eyebrow flex items-center gap-1.5 !text-[9.5px]"><Sparkles className="h-3 w-3 text-[#ffb27a]" />Claude · engine</p>
      <div ref={reg("slot:claude")} className="mx-auto my-1 aspect-square w-full max-w-[150px]" />
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {[["Runs today", m.runsToday], ["Claude jobs 7d", m.jobs7d], ["Facts", m.facts], ["Learned 7d", m.learned7d]].map(([l, v]) => (
          <div key={l} className="min-w-0"><p className="mono text-[15px] font-medium leading-none text-white">{v}</p><p className="mono mt-1 truncate text-[9px] uppercase tracking-[.12em] text-[var(--ink-s)]">{l}</p></div>
        ))}
      </div>
    </Card>
  );
}

function BrainCard({ client, brain, reg, onFill }) {
  const pct = brain.pct;
  return (
    <Card id="brain" reg={reg} label={`${client.business} Brain`} className="shp-clear overflow-hidden px-4 pb-3.5 pt-3">
      <p className="eyebrow flex items-center gap-1.5 !text-[9.5px]"><Brain className="h-3 w-3 text-[#b18cff]" />Business brain</p>
      <p className="mt-1 truncate text-[17px] font-semibold tracking-[-0.02em] text-white">{client.business} <span style={{ color: COLORS.brain }}>Brain</span></p>
      <div ref={reg("slot:brain")} className="my-1 h-[70px] w-full" />
      <div className="flex items-baseline justify-between gap-2">
        <p className="mono text-[11px] text-[var(--ink-m)]">{pct == null ? "…" : <><span className="text-[15px] text-white">{pct}%</span> complete</>}</p>
        <p className="mono text-[11px] text-[var(--ink-m)]"><span className="text-white">{brain.facts}</span> facts</p>
      </div>
      <div className="shp-bar mt-2"><span style={{ width: `${pct || 0}%`, background: "linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)" }} /></div>
      {brain.groups.length ? (
        <div className="mt-2.5 grid grid-cols-3 gap-x-2 gap-y-1.5">
          {brain.groups.map((g) => (
            <div key={g.key} title={g.missing.length ? `Missing: ${g.missing.map((x) => x.label).join(", ")}` : "Complete"} className="min-w-0">
              <p className="mono truncate text-[8.5px] uppercase tracking-[.1em] text-[var(--ink-s)]">{g.label}</p>
              <div className="shp-bar mt-1"><span style={{ width: `${g.pct}%`, background: g.pct >= 80 ? COLORS.result : g.pct >= 50 ? COLORS.idea : COLORS.command }} /></div>
            </div>
          ))}
        </div>
      ) : null}
      {brain.missing.length ? (
        <div className="mt-3 border-t border-[var(--hair-d)] pt-2.5">
          <p className="mono text-[9px] uppercase tracking-[.12em] text-[var(--ink-s)]">Missing · {brain.missing.length}</p>
          <ul className="mt-1.5 space-y-1">
            {brain.missing.slice(0, 4).map((x) => <li key={x.key} className="flex items-center gap-1.5 truncate text-[11.5px] text-[var(--ink-d)]"><CircleDashed className="h-3 w-3 shrink-0 text-[#ff8a3d]" />{x.label}</li>)}
          </ul>
          <button type="button" onClick={onFill} className="mt-2 text-[11.5px] font-medium text-[#ff8a3d] hover:text-white">Fill in what's missing →</button>
        </div>
      ) : pct != null ? <p className="mt-3 flex items-center gap-1.5 text-[11.5px] text-[#2ee6c5]"><CheckCircle2 className="h-3.5 w-3.5" />Nothing missing</p> : null}
    </Card>
  );
}

function DeptCard({ node, reg, open, onToggle, clientId }) {
  const Icon = DEPT_ICON[node.key] || Bot;
  const m = node.metrics;
  return (
    <div className="shp-card" ref={reg(node.id)} data-node={node.id}>
      <button type="button" onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: "rgba(255,90,0,.1)", boxShadow: "inset 0 0 0 1px rgba(255,106,0,.35)" }}><Icon className="h-4 w-4 text-[#ff8a3d]" /></span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium text-white">{node.label}</span>
          <span className="mono block truncate text-[9.5px] text-[var(--ink-s)]">{m.live}/{m.agents} live · {m.runsToday} today · {m.lastRun ? `last ${ago(m.lastRun)}` : "no runs yet"}</span>
        </span>
        <StatusDot status={node.status} size={7} />
        {open ? <ChevronDown className="h-3.5 w-3.5 text-[var(--ink-s)]" /> : <ChevronRight className="h-3.5 w-3.5 text-[var(--ink-s)]" />}
      </button>
      {open ? (
        <div className="border-t border-[var(--hair-d)] px-1.5 py-1.5">
          {node.agents.map((a) => (
            <Link key={a.key} to={`/agents?v=classic&web=clients&client=${clientId}&agent=${encodeURIComponent(a.key)}`} className="shp-row">
              <StatusDot status={a.status} size={6} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12px] text-[var(--ink-d)]">{a.name}</span>
                <span className="mono block truncate text-[9.5px] text-[var(--ink-s)]">{a.status === "planned" ? "planned, not built yet" : a.last_run_at ? `last ran ${ago(a.last_run_at)}${a.last_status && a.last_status !== "success" ? ` · ${a.last_status}` : ""}` : "has not run yet"}{a.schedule ? ` · next: ${a.schedule}` : ""}</span>
              </span>
              <ArrowUpRight className="h-3 w-3 shrink-0 text-[var(--ink-s)]" />
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function FeedCard({ items, reg }) {
  return (
    <Card id="feed" reg={reg} label="What the agents delivered" className="overflow-hidden" tint={COLORS.result}>
      <div className="flex items-center justify-between gap-2 px-3.5 pb-1.5 pt-3">
        <p className="eyebrow !text-[9.5px]">Delivered · recent work</p>
        <span className="mono text-[10px] text-[var(--ink-s)]">{items.length ? `${items.length} items` : ""}</span>
      </div>
      {items.length ? (
        <ul className="scroll-d max-h-[320px] overflow-y-auto px-1.5 pb-2">
          {items.slice(0, 14).map((w) => {
            const inner = (
              <>
                <i className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: w.live ? COLORS.result : "rgba(255,255,255,.35)", boxShadow: w.live ? `0 0 6px ${COLORS.result}` : "none" }} />
                <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--ink-d)]">{w.title}</span>
                <span className="mono shrink-0 text-[9.5px] text-[var(--ink-s)]">{w.kind ? `${w.kind} · ` : ""}{ago(w.at)}</span>
              </>
            );
            return <li key={w.id}>{w.url ? <a href={w.url} target="_blank" rel="noreferrer" className="shp-row">{inner}</a> : <div className="shp-row">{inner}</div>}</li>;
          })}
        </ul>
      ) : <p className="px-3.5 pb-3.5 text-[12px] leading-snug text-[var(--ink-s)]">Nothing delivered yet. Finished work shows here (and in their portal) as soon as it is logged.</p>}
    </Card>
  );
}

function NextCard({ items, reg }) {
  return (
    <Card id="next" reg={reg} label="Due next" className="overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3.5 pb-1.5 pt-3">
        <p className="eyebrow flex items-center gap-1.5 !text-[9.5px]"><CalendarClock className="h-3 w-3 text-[#ff8a3d]" />Due next</p>
      </div>
      {items.length ? (
        <ul className="px-1.5 pb-2">
          {items.slice(0, 7).map((x) => (
            <li key={x.id} className="shp-row !cursor-default">
              <i className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: x.late ? COLORS.broken : COLORS.command }} />
              <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--ink-d)]">{x.title}</span>
              <span className={`mono shrink-0 text-[9.5px] ${x.late ? "text-[#ff8a7f]" : "text-[var(--ink-s)]"}`}>{x.when}</span>
            </li>
          ))}
        </ul>
      ) : <p className="px-3.5 pb-3.5 text-[12px] leading-snug text-[var(--ink-s)]">Nothing scheduled. Scheduled automations and open tasks with a due date land here.</p>}
    </Card>
  );
}

function NeedsCard({ n, reg, onOpen }) {
  return (
    <Card id="needs" reg={reg} onClick={onOpen} label="Waiting for you" className="px-3.5 py-2.5" tint={COLORS.idea}>
      <div className="flex items-center gap-2.5 pl-1">
        <Inbox className="h-4 w-4 shrink-0 text-[#ffc23d]" />
        <div className="min-w-0 flex-1"><p className="truncate text-[12.5px] font-medium text-white">Waiting for your OK</p><p className="truncate text-[11px] text-[var(--ink-s)]">{n ? "Drafts and moves for this client" : "Nothing waiting on you"}</p></div>
        <p className="mono text-[17px] leading-none text-[#ffc23d]">{n}</p>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------- view
export default function ClientAgentsView({ client, go }) {
  const { data, isLoading, error } = useShipData();
  const extrasQ = useQuery({ queryKey: ["client-agents-extras", client.id], queryFn: () => loadClientExtras(client.id), staleTime: 30_000, refetchInterval: 60_000 });
  const ctxQ = useQuery({ queryKey: ["clientContext", client.id], queryFn: () => loadClientContext(client.id), staleTime: 30_000 });
  const reduced = usePrefersReducedMotion();
  const [openDept, setOpenDept] = useState("");
  const stageRef = useRef(null);
  const contentRef = useRef(null);
  const canvasApi = useRef(null);
  const els = useRef({});
  const [anchors, setAnchors] = useState(null);
  const [width, setWidth] = useState(1200);
  const mode = width >= 1080 ? "cols" : "stack";

  const ev = useMemo(() => (ctxQ.data ? evaluateCriteria(ctxQ.data) : null), [ctxQ.data]);
  const x = extrasQ.data || { automations: [], tasks: [], snapshots: [], worklog: [], actions: [] };

  const model = useMemo(() => {
    const d = data || {};
    const today = dayStart();
    const week = Date.now() - 7 * 864e5;
    const mine = arr(d.registry).filter((a) => a.scope === "client" && a.client_id === client.id);
    const runs = arr(d.runs).filter((r) => r.client_id === client.id);
    const runsToday = (a) => Math.max(runs.filter((r) => since(when.run(r), today) && runMatchesAgent(r, a)).length, since(a.last_run_at, today) ? 1 : 0);
    const work = arr(d.work).filter((w) => w.client_id === client.id);
    const jobs = arr(d.jobs).filter((j) => j.client_id === client.id);
    const facts = arr(d.facts).filter((f) => f.client_id === client.id && f.status !== "superseded");
    const learned7d = facts.filter((f) => since(when.fact(f), week)).length + arr(d.learnings).filter((l) => l.client_id === client.id && since(when.learning(l), week)).length;
    const dossier = arr(d.dossiers).find((y) => y.client_id === client.id) || null;
    const cb = clientBrainOf(dossier, d.facts, client.id);

    // Departments with at least one of this client's agents.
    const depts = CLIENT_DEPTS.map((dep) => {
      const agents = mine.filter((a) => a.department === dep.key).sort((a, b) => (a.status === "live" ? 0 : 1) - (b.status === "live" ? 0 : 1) || String(a.name).localeCompare(String(b.name)));
      if (!agents.length) return null;
      const st = agents.some((a) => a.status === "broken") ? "broken" : agents.some((a) => a.status === "live") ? "live" : agents.some((a) => a.status === "paused") ? "paused" : "planned";
      const lastRun = agents.map((a) => a.last_run_at).filter(Boolean).sort().pop() || null;
      return { id: `dept:${dep.key}`, key: dep.key, label: dep.label, status: st, agents, metrics: { agents: agents.length, live: agents.filter((a) => a.status === "live").length, runsToday: agents.reduce((s, a) => s + runsToday(a), 0), lastRun } };
    }).filter(Boolean);
    // Client CEO and brain keeper sit with the brain (they serve it), not in a department list.
    const brainAgents = mine.filter((a) => ["ceo", "brain"].includes(a.department));

    // Wiring in: real fields and records only.
    const site = client.domain || (client.websites || [])[0] || "";
    const sources = ["gsc", "gbp", "ga4"].map((k) => ({ k, snap: x.snapshots.find((s) => s.source === k) || null }));
    const reporting = sources.filter((s) => s.snap);
    const access = ev ? ["access_gsc", "access_gbp", "access_ga4"].filter((k) => ev.items.find((i) => i.key === k && i.filled && !i.na)).length : 0;
    const stripeLines = (client.services || []).filter((s) => s.stripe || s.stripe_price_id || s.stripe_subscription_id);
    const cmdSync = cb?.syncedAt || (cb?.apps || []).map((a) => a.syncedAt).filter(Boolean).sort().pop() || null;
    const wires = [
      { id: "wire:site", icon: Globe, label: "Website", state: site ? (client.site_app_id ? "on" : "partial") : "off", sub: site ? `${site.replace(/^https?:\/\//, "")}${client.site_app_id ? " · app linked" : " · app not linked"}` : "No website on file", href: site ? `https://${site.replace(/^https?:\/\//, "")}` : null },
      { id: "wire:cmd", icon: LayoutDashboard, label: "Command System", state: client.command_app_id ? (cmdSync ? "on" : "partial") : client.ops_app_id ? "partial" : "off", sub: client.command_app_id ? (cmdSync ? `brain synced ${ago(cmdSync)}${cb?.total ? ` · ${cb.answered}/${cb.total} answered` : ""}` : "linked · not synced yet") : client.ops_app_id ? "ops app linked · brain sync not set" : "Not connected" },
      { id: "wire:portal", icon: PlugZap, label: "Client portal", state: client.portal_enabled ? ((client.portal_emails || []).length ? "on" : "partial") : "off", sub: client.portal_enabled ? `${(client.portal_emails || []).length} login${(client.portal_emails || []).length === 1 ? "" : "s"}` : "Portal off" },
      { id: "wire:data", icon: BarChart3, label: "Data sources", state: reporting.length ? "on" : access ? "partial" : "off", sub: reporting.length ? `${reporting.map((s) => s.k.toUpperCase()).join(" · ")} reporting${reporting[0].snap.period_end ? ` · to ${reporting[0].snap.period_end}` : ""}` : access ? `${access} access granted · no data yet` : "Not connected" },
      { id: "wire:billing", icon: CreditCard, label: "Billing", state: stripeLines.length ? "on" : (client.services || []).length ? "partial" : "off", sub: stripeLines.length ? `${stripeLines.length} Stripe line${stripeLines.length === 1 ? "" : "s"}` : (client.services || []).length ? "services set · not on Stripe" : "No services yet" },
    ];

    // Delivered: ledger entries (client-visible titles first), then the work log.
    const feed = [
      ...work.filter((w) => w.status === "done").map((w) => ({ id: `we:${w.id}`, title: w.client_title || w.title || w.summary || "Work", kind: w.category || "", at: when.work(w), url: w.link || "", live: true, dept: CATEGORY_DEPT[w.category] })),
      ...x.worklog.map((w) => ({ id: `wl:${w.id}`, title: w.title, kind: String(w.kind || "").replace(/_/g, " "), at: w.date, url: w.url || "", live: w.status === "live", dept: CATEGORY_DEPT[w.kind] || (w.kind === "blog" || w.kind === "gbp_post" ? "seo" : w.kind === "site_edit" ? "website" : null) })),
    ].filter((w) => w.title).sort((a, b) => String(b.at || "").localeCompare(String(a.at || "")));

    const todayIso = new Date().toISOString().slice(0, 10);
    const next = [
      ...x.automations.filter((a) => a.status === "active" && a.next_run_at).map((a) => ({ id: `au:${a.id}`, title: a.name, at: a.next_run_at, when: ahead(a.next_run_at), late: false })),
      ...x.tasks.filter((t) => !["done", "Completed"].includes(t.status) && t.due_date).map((t) => ({ id: `t:${t.id}`, title: t.title, at: t.due_date, when: t.due_date < todayIso ? `overdue · ${t.due_date.slice(5)}` : t.due_date === todayIso ? "today" : t.due_date.slice(5), late: t.due_date < todayIso })),
    ].sort((a, b) => String(a.at).localeCompare(String(b.at)));

    const waiting = jobs.filter((j) => j.status === "needs_approval").length + work.filter((w) => w.status === "awaiting_approval").length + x.actions.length;
    const brokenAutos = x.automations.filter((a) => a.status === "error").length;
    const metrics = { runsToday: mine.reduce((s, a) => s + runsToday(a), 0) + runs.filter((r) => since(when.run(r), today) && !mine.some((a) => runMatchesAgent(r, a))).length, jobs7d: jobs.filter((j) => since(when.job(j), week)).length, facts: facts.length, learned7d };
    const brain = { pct: ev ? ev.pct : null, groups: ev ? ev.groups : [], missing: ev ? ev.missing.filter((m) => !m.na) : [], facts: facts.length + (cb?.factsActive || 0) };

    // Connections, built the same way the ship builds its own.
    const edges = [];
    const link = (from, to, kind, fwd, back, extra = {}) => edges.push({ id: `${from}>${to}`, from, to, kind, fwd, back, ...extra });
    link("claude", "brain", "fuel", stream(metrics.runsToday + metrics.jobs7d), stream(learned7d, 0.04), { color: COLORS.claude, backColor: COLORS.brain });
    wires.filter((w) => w.state !== "off").forEach((w) => link(w.id, "brain", "intel", stream(w.state === "on" ? 3 : 0, w.state === "on" ? 0.12 : 0.04), stream(0, 0), { color: COLORS.intel }));
    link("brain", "needs", "ideas", stream(waiting, waiting ? 0.08 : 0.02), stream(0, 0), { color: COLORS.idea });
    depts.forEach((dp) => {
      const done7 = feed.filter((f) => f.dept === dp.key && since(f.at, week)).length;
      link("brain", dp.id, "command", stream(dp.metrics.runsToday, dp.metrics.live ? 0.1 : 0.02), stream(done7, 0.03), { color: COLORS.command, backColor: COLORS.result });
      if (dp.metrics.live) link(dp.id, "feed", "app", stream(done7, 0.04), stream(0, 0), { color: COLORS.result });
    });
    if (next.length && depts.length) link("brain", "next", "app", stream(next.length, 0.05), stream(0, 0), { color: COLORS.command });

    return { mine, depts, brainAgents, wires, feed, next, waiting, brokenAutos, metrics, brain, edges };
  }, [data, client, x, ev]);

  // Card positions for the flow layer (content coordinates).
  const reg = useCallback((id) => (el) => { if (el) els.current[id] = el; else delete els.current[id]; }, []);
  const measure = useCallback(() => {
    const c = contentRef.current;
    if (!c) return;
    const base = c.getBoundingClientRect();
    const out = {};
    Object.entries(els.current).forEach(([id, el]) => { const r = el.getBoundingClientRect(); if (r.width || r.height) out[id] = { x: Math.round(r.left - base.left), y: Math.round(r.top - base.top), w: Math.round(r.width), h: Math.round(r.height) }; });
    setAnchors((prev) => (prev && JSON.stringify(prev) === JSON.stringify(out) ? prev : out));
  }, []);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [isLoading]);
  useLayoutEffect(() => { measure(); }, [measure, model, mode, openDept, width]);
  useEffect(() => {
    const c = contentRef.current;
    if (!c) return undefined;
    const ro = new ResizeObserver(() => measure());
    ro.observe(c);
    document.fonts?.ready?.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [measure, isLoading]);

  if (isLoading) return <div className="agx shp grid h-[520px] place-items-center rounded-lg"><div className="flex items-center gap-3 text-[13px] text-[var(--ink-m)]"><Spinner size={18} />Loading {client.business}'s agents…</div></div>;
  if (error) return <div className="agx shp grid h-[300px] place-items-center rounded-lg text-[13px] text-[#ff8a7f]">Couldn't load agents: {String(error.message || error)}</div>;

  const m = model;
  const live = m.mine.filter((a) => a.status === "live").length;
  const planned = m.mine.filter((a) => a.status === "planned").length;
  const broken = m.mine.filter((a) => a.status === "broken").length;
  const summary = m.mine.length
    ? `${live} agent${live === 1 ? "" : "s"} live${planned ? ` · ${planned} planned` : ""}${broken ? ` · ${broken} broken` : ""} · ${m.metrics.runsToday} runs today · ${m.waiting} waiting for you${m.brokenAutos ? ` · ${m.brokenAutos} automation${m.brokenAutos === 1 ? "" : "s"} failing` : ""}`
    : "No agents set up for this client yet. They are added when the client goes Active and syncs.";

  const wireCards = m.wires.map((w) => <WireCard key={w.id} node={w} reg={reg} />);
  const deptCards = m.depts.length
    ? m.depts.map((dp) => <DeptCard key={dp.id} node={dp} reg={reg} clientId={client.id} open={openDept === dp.key} onToggle={() => setOpenDept((k) => (k === dp.key ? "" : dp.key))} />)
    : [<div key="none" className="shp-card px-3.5 py-3 text-[12px] leading-snug text-[var(--ink-s)]">No agent departments yet. Once agents are registered for {client.business}, they appear here, connected to the Brain.</div>];
  const brainCard = <BrainCard client={client} brain={m.brain} reg={reg} onFill={() => go("profile")} />;
  const needs = <NeedsCard n={m.waiting} reg={reg} onOpen={() => go("claude")} />;

  return (
    <div className="agx shp grain-d overflow-hidden rounded-lg" data-testid="client-agents">
      <header className="relative z-20 border-b border-[var(--hair-d)] px-4 pb-3 pt-3.5 md:px-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="eyebrow !text-[9.5px]">+ Agents · {client.business}</p>
            <p className="mt-1.5 flex items-start gap-2 text-[13px] leading-snug text-[var(--ink-d)]"><span className="live-dot mt-1 shrink-0" />{summary}</p>
          </div>
          <Link to={`/agents?v=classic&web=clients&client=${client.id}`} className="btn-d shrink-0"><Bot className="h-3.5 w-3.5" />Open on the Agents page</Link>
        </div>
        <div className="mono mt-2 hidden flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px] uppercase tracking-[.12em] text-[var(--ink-s)] sm:flex">
          {[["wired in", COLORS.intel], ["orders out", COLORS.command], ["results back", COLORS.result], ["waiting for you", COLORS.idea], ["Claude", COLORS.claude]].map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><i className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />{l}</span>)}
        </div>
      </header>

      <div ref={stageRef} className="shp-stage relative">
        <FlowCanvas ref={canvasApi} anchors={anchors} edges={m.edges} scrollRef={contentRef} mode={mode} lit={null} focusIds={openDept ? new Set(["brain", `dept:${openDept}`, "feed"]) : null} hoverEdge={null} reduced={reduced} density={width < 700 ? 0.5 : 1} />
        <div ref={contentRef} className="relative">
          {mode === "cols" ? (
            <div className="csh-cols">
              <div className="csh-wires">{wireCards}</div>
              <div className="csh-needs">{needs}</div>
              <div className="shp-col csh-a"><ClaudeCard m={m.metrics} reg={reg} /></div>
              <div className="shp-col csh-b">{brainCard}</div>
              <div className="shp-col csh-c">{deptCards}</div>
              <div className="shp-col csh-d"><FeedCard items={m.feed} reg={reg} /><NextCard items={m.next} reg={reg} /></div>
            </div>
          ) : (
            <div className="shp-stack !pb-6">
              <div className="csh-wires-s">{wireCards}</div>
              <div className="shp-pair"><ClaudeCard m={m.metrics} reg={reg} />{brainCard}</div>
              {needs}
              <div className="shp-depts">{deptCards}</div>
              <FeedCard items={m.feed} reg={reg} />
              <NextCard items={m.next} reg={reg} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
