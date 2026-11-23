import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChevronLeft, ChevronRight, Filter, LayoutList, Network, Search, Sparkles, X, BookOpen, Users, Orbit, Play, ArrowLeft, ArrowUpRight } from "lucide-react";
import "./agents.css";
import { useAgentsData, useRefreshAgents } from "./useAgentsData";
import { INTERSTELLAR_DEPTS, CLIENT_DEPTS } from "./defs";
import { buildClientsOverview, countStatus } from "./layout";
import { buildClusterOverview, buildHandoffs, pillarOfAgent, PILLAR_NAMES, runs30 } from "./map/model";
import Constellation from "./Constellation";
import ListView from "./ListView";
import AgentPanel, { runsFor } from "./panels/AgentPanel";
import CeoPanel from "./panels/CeoPanel";
import BrainPanel from "./panels/BrainPanel";
import { DeptPanel, ClientPanel } from "./panels/DeptPanel";
import { usePanelState, panelWidth } from "./panels/PanelShell";
import { KIND_SHORT, KIND_LABELS, AUTONOMY, StatusDot, StatusPill, STATUS_META, relTime, Spinner } from "./ui";
import ShipView from "./ship/ShipView";
import PresentMode from "./present/PresentMode";

const STATUSES = ["live", "paused", "planned", "broken"];
const KINDS = Object.keys(KIND_SHORT);
const AUTOS = Object.keys(AUTONOMY);

function useFillHeight() {
  const ref = useRef(null);
  const [h, setH] = useState(null);
  useLayoutEffect(() => {
    const measure = () => { if (ref.current) setH(Math.max(520, window.innerHeight - ref.current.getBoundingClientRect().top - (window.scrollY || 0))); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return [ref, h];
}
function useMedia(q) {
  const get = () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia(q).matches : false);
  const [m, setM] = useState(get);
  useEffect(() => { const mq = window.matchMedia(q); const on = () => setM(mq.matches); mq.addEventListener?.("change", on); return () => mq.removeEventListener?.("change", on); }, [q]);
  return m;
}

function Toggle({ value, options, onChange, label }) {
  return (
    <div className="seg" role="tablist" aria-label={label}>
      {options.map(([v, l, Icon]) => (
        <button key={v} type="button" role="tab" aria-selected={value === v} className={value === v ? "on" : ""} onClick={() => onChange(v)}>
          {Icon ? <Icon className="h-3.5 w-3.5" /> : null}{l}
        </button>
      ))}
    </div>
  );
}

function FilterGroup({ title, items, set, onToggle, render }) {
  return (
    <div>
      <p className="eyebrow mb-2 !text-[9.5px]">{title}</p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => <button key={it} type="button" className={`chip !h-7 ${set.has(it) ? "on" : ""}`} onClick={() => onToggle(it)}>{render ? render(it) : it}</button>)}
      </div>
    </div>
  );
}

// Compact card for the hovered / tapped agent: what it does, trigger, last run, status, owner pillar, hand-offs.
function AgentCard({ a, name, deptLabel, links, pinned, onOpen, onClose, sheet, top = 12 }) {
  const pillar = pillarOfAgent(a);
  const runs = runs30(a);
  return (
    <div data-ui="" data-testid="agent-card" role="dialog" aria-label={`${name} summary`}
      style={sheet ? undefined : { top }}
      className={`glass z-30 ${pinned ? "" : "pointer-events-none"} ${sheet ? "absolute inset-x-2 bottom-2 rounded-2xl" : "absolute left-3 w-[320px] rounded-xl md:left-5"} px-4 py-3.5 shadow-[0_20px_60px_-20px_rgba(0,0,0,.8)]`}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="eyebrow !text-[9.5px]">{deptLabel}{pillar ? ` · ${PILLAR_NAMES[pillar]} pillar` : ""}</p>
          <p className="mt-1 text-[14.5px] font-semibold leading-snug text-white">{name}</p>
        </div>
        <StatusPill status={a.status} />
        {pinned ? <button type="button" aria-label="Close card" onClick={onClose} className="-mr-1 grid h-7 w-7 shrink-0 place-items-center rounded-md text-[var(--ink-s)] hover:bg-white/5 hover:text-white"><X className="h-3.5 w-3.5" /></button> : null}
      </div>
      {a.role ? <p className="mt-2 line-clamp-3 text-[12.5px] leading-snug text-[var(--ink-m)]">{a.role}</p> : null}
      <dl className="mono mt-2.5 grid grid-cols-[72px,1fr] gap-x-2 gap-y-1 text-[10.5px]">
        <dt className="uppercase tracking-[.12em] text-[var(--ink-s)]">Trigger</dt><dd className="truncate text-[var(--ink-d)]" title={a.schedule || ""}>{a.schedule || KIND_LABELS[a.kind] || "—"}</dd>
        <dt className="uppercase tracking-[.12em] text-[var(--ink-s)]">Last run</dt><dd className="text-[var(--ink-d)]">{a.status === "planned" ? `planned${a.build_order ? ` · build #${a.build_order}` : ""}` : `${relTime(a.last_run_at)}${a.last_status && a.last_status !== "unknown" && a.last_run_at ? ` · ${a.last_status}` : ""}`}</dd>
        <dt className="uppercase tracking-[.12em] text-[var(--ink-s)]">30 days</dt><dd className="text-[var(--ink-d)]">{runs ? `${runs} run${runs === 1 ? "" : "s"}` : "no logged runs"}</dd>
        <dt className="uppercase tracking-[.12em] text-[var(--ink-s)]">Hand-offs</dt><dd className="text-[var(--ink-d)]">{links.out} out · {links.in} in</dd>
      </dl>
      {pinned ? <button type="button" className="btn-d mt-3 !h-8 w-full" onClick={onOpen}>Open details<ArrowUpRight className="h-3.5 w-3.5" /></button> : <p className="mono mt-2 text-[9.5px] uppercase tracking-[.12em] text-[var(--ink-s)]">Click for details</p>}
    </div>
  );
}

function ClassicAgentsPage({ onShip }) {
  const { data, isLoading, error } = useAgentsData();
  const refresh = useRefreshAgents();
  const [params, setParams] = useSearchParams();
  const web = params.get("web") === "clients" ? "clients" : "interstellar";
  const clientId = params.get("client") || "";
  const deptKey = params.get("dept") || "";
  const view = params.get("view") === "list" ? "list" : "map";
  const presenting = params.get("present") === "1";
  const [q, setQ] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [fStatus, setFStatus] = useState(new Set());
  const [fKind, setFKind] = useState(new Set());
  const [fAuto, setFAuto] = useState(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [hover, setHover] = useState(null);
  const [pin, setPin] = useState(null); // agent key with its card pinned (tap / click)
  const [cam, setCam] = useState({ k: 1, fitK: 1, x: 0, y: 0 });
  const [fillRef, height] = useFillHeight();
  const mapRef = useRef(null);
  const stageRef = useRef(null);
  const [stage, setStage] = useState({ w: 1200, h: 700 });
  const isMd = useMedia("(min-width: 768px)");
  const reduced = useMedia("(prefers-reduced-motion: reduce)");
  const ps = usePanelState();

  const setP = useCallback((patch, replace = false) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => { if (v === null || v === undefined || v === "") next.delete(k); else next.set(k, v); });
    setParams(next, { replace });
  }, [params, setParams]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setStage({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [isLoading]);

  // Selection lives in the URL too, so any agent / brain / CEO can be deep-linked.
  const sel = useMemo(() => {
    if (params.get("agent")) return { type: "agent", key: params.get("agent") };
    if (params.get("ceo")) return { type: "ceo" };
    if (params.get("brain")) return { type: "brain" };
    if (params.get("deptpanel")) return { type: "dept", key: params.get("deptpanel") };
    if (params.get("clientpanel")) return { type: "client", id: params.get("clientpanel") };
    return null;
  }, [params]);
  const select = useCallback((s) => setP({ agent: s?.type === "agent" ? s.key : null, ceo: s?.type === "ceo" ? "1" : null, brain: s?.type === "brain" ? "1" : null, deptpanel: s?.type === "dept" ? s.key : null, clientpanel: s?.type === "client" ? s.id : null }), [setP]);

  const d = data || { registry: [], learnings: [], notes: [], briefs: [], brains: [], clients: [], runs: [], prefs: null, agency: [] };
  const registry = useMemo(() => d.registry.map((a) => (a.run_count_30d == null && a.status === "live" ? { ...a, _runs30: runsFor(a, d.runs).length } : a)), [d.registry, d.runs]);
  const hq = useMemo(() => registry.filter((a) => a.scope === "interstellar"), [registry]);
  const instances = useMemo(() => registry.filter((a) => a.scope === "client"), [registry]);
  const commander = hq.find((a) => a.key === "commander");
  const hqBrain = d.brains.find((b) => b.scope === "interstellar");
  const clients = d.clients;
  const client = clients.find((c) => c.id === clientId) || null;
  const clientAgents = useMemo(() => (client ? instances.filter((a) => a.client_id === client.id) : []), [instances, client]);
  const clientBrain = client ? d.brains.find((b) => b.client_id === client.id) : null;
  const ceoName = d.prefs?.pageSettings?.ceo_name || "Commander";

  const depts = web === "clients" ? CLIENT_DEPTS : INTERSTELLAR_DEPTS;
  const scopeAgents = web === "clients" ? (client ? clientAgents : instances) : hq;
  const presentDepts = useMemo(() => depts.filter((x) => scopeAgents.some((a) => a.department === x.key)), [depts, scopeAgents]);
  const dept = presentDepts.find((x) => x.key === deptKey) || null;
  const clientsHub = web === "clients" && !client;

  const query = q.trim().toLowerCase();
  const isMatch = useCallback((a) => {
    if (fStatus.size && !fStatus.has(a.status)) return false;
    if (fKind.size && !fKind.has(a.kind)) return false;
    if (fAuto.size && !fAuto.has(a.autonomy || "")) return false;
    if (query && !`${a.name} ${a.role} ${a.client_name || ""} ${a.key} ${a.branch || ""}`.toLowerCase().includes(query)) return false;
    return true;
  }, [fStatus, fKind, fAuto, query]);
  const filtering = !!(fStatus.size || fKind.size || fAuto.size || query);

  const graph = useMemo(() => {
    if (web === "interstellar") {
      const named = commander ? { ...commander, name: ceoName } : null;
      return buildClusterOverview({ depts: INTERSTELLAR_DEPTS, agents: hq.filter((a) => a.key !== "commander"), ceo: named, brain: hqBrain, centerLabel: "Company Brain", centerSub: hqBrain ? `${Math.round(hqBrain.completeness || 0)}% COMPLETE · AGENCY KNOWLEDGE` : "AGENCY KNOWLEDGE" });
    }
    if (!client) return { ...buildClientsOverview({ clients, instances, brains: d.brains }), clusters: [] };
    const ceo = clientAgents.find((a) => a.template_key === "client_ceo");
    const keeper = clientAgents.find((a) => a.template_key === "brain_keeper");
    return buildClusterOverview({ depts: CLIENT_DEPTS, agents: clientAgents.filter((a) => a !== ceo && a !== keeper), ceo, keeper, brain: clientBrain, centerLabel: client.business, centerSub: `BUSINESS BRAIN · ${Math.round(clientBrain?.completeness || 0)}%` });
  }, [web, hq, commander, ceoName, hqBrain, client, clients, instances, d.brains, clientAgents, clientBrain]);
  const handoffs = useMemo(() => (clientsHub ? [] : buildHandoffs(web === "clients" ? clientAgents : hq)), [clientsHub, web, clientAgents, hq]);

  const viewKey = `${web}|${client?.id || ""}`;
  const counts = countStatus(clientsHub ? instances.filter((a) => a.template_key) : scopeAgents);

  const selectedAgent = sel?.type === "agent" ? registry.find((a) => a.key === sel.key) : null;
  const pinnedAgent = pin ? registry.find((a) => a.key === pin) : null;
  const focusAgent = selectedAgent || pinnedAgent;
  const selectedId = focusAgent ? (clientsHub ? `c:${focusAgent.client_id}` : `a:${focusAgent.key}`) : sel?.type === "ceo" ? (web === "interstellar" ? "a:commander" : null) : sel?.type === "brain" ? "brain" : sel?.type === "dept" ? `d:${sel.key}` : sel?.type === "client" ? `c:${sel.id}` : null;

  // ---------------------------------------------------------------- camera follows the URL (department focus)
  useEffect(() => {
    if (view !== "map" || isLoading || presenting) return undefined;
    const id = setTimeout(() => { if (dept) mapRef.current?.flyToCluster(dept.key); else if (mapRef.current && mapRef.current.k > mapRef.current.fitK * 1.25) mapRef.current.fit(true); }, 60);
    return () => clearTimeout(id);
  }, [dept?.key, view, isLoading, viewKey, presenting]); // eslint-disable-line react-hooks/exhaustive-deps

  const onNode = (n, info = {}) => {
    if (!n) { setPin(null); return; }
    if (n.type === "brain") { select({ type: "brain" }); return; }
    if (n.type === "ceo") { setPin(null); select({ type: "ceo" }); return; }
    if (n.type === "dept") { setPin(null); setP({ dept: n.dept, deptpanel: null, agent: null }); return; }
    if (n.type === "client") { setP({ client: n.client.id, dept: null, clientpanel: n.client.id, agent: null, ceo: null, brain: null, deptpanel: null }); return; }
    if (n.type === "agent") {
      if (n.agent.template_key === "client_ceo") { select({ type: "ceo" }); return; }
      // First click pins the compact card and lights the hand-offs; a second click (or "Open details") opens the panel.
      if (pin === n.agent.key || info.pointerType === "keyboard" && pin === n.agent.key) { select({ type: "agent", key: n.agent.key }); return; }
      setPin(n.agent.key);
      if (sel?.type === "agent") setP({ agent: null });
    }
  };
  const openDetails = (key) => { setPin(null); select({ type: "agent", key }); };

  const stepDept = (dir) => {
    if (!presentDepts.length) return;
    const i = presentDepts.findIndex((x) => x.key === dept?.key);
    const next = presentDepts[((i < 0 ? (dir > 0 ? -1 : 0) : i) + dir + presentDepts.length) % presentDepts.length];
    setP({ dept: next.key, deptpanel: null, agent: null });
  };

  useEffect(() => {
    if (presenting) return undefined;
    const onKey = (e) => {
      if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
      if (e.key === "Escape") { if (pin) setPin(null); else if (sel) select(null); else if (dept) setP({ dept: null }); }
      if (dept && e.key === "ArrowRight" && !e.shiftKey) stepDept(1);
      if (dept && e.key === "ArrowLeft" && !e.shiftKey) stepDept(-1);
      if (e.key === "/" && !e.metaKey && !e.ctrlKey) { e.preventDefault(); document.getElementById("agx-search")?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const toggleIn = (setter) => (v) => setter((s) => { const n = new Set(s); if (n.has(v)) n.delete(v); else n.add(v); return n; });
  const listAgents = useMemo(() => scopeAgents.filter((a) => a.scope !== "template").filter(isMatch), [scopeAgents, isMatch]);

  // ---------------------------------------------------------------- search that flies to the agent
  const results = useMemo(() => {
    if (!query) return [];
    if (clientsHub) return clients.filter((c) => String(c.business).toLowerCase().includes(query)).slice(0, 8).map((c) => ({ id: `c:${c.id}`, label: c.business, sub: "Client", client: c }));
    return scopeAgents.filter((a) => `${a.key === "commander" ? ceoName : a.name} ${a.branch || ""}`.toLowerCase().includes(query)).slice(0, 8).map((a) => ({ id: `a:${a.key}`, label: a.key === "commander" ? ceoName : a.name, sub: depts.find((x) => x.key === a.department)?.label || "", agent: a }));
  }, [query, clientsHub, clients, scopeAgents, depts, ceoName]);
  const goResult = (r) => {
    if (!r) return;
    setSearchOpen(false);
    if (r.client) { setP({ client: r.client.id, clientpanel: r.client.id }); return; }
    if (view === "list") { select({ type: "agent", key: r.agent.key }); return; }
    if (r.agent.key === "commander") { mapRef.current?.flyToNode("a:commander", { k: 2.2 }); return; }
    setPin(r.agent.key);
    if (dept && dept.key !== r.agent.department) setP({ dept: null }, true);
    setTimeout(() => mapRef.current?.flyToNode(r.id, { k: 2.4 }), 80);
  };

  // ---------------------------------------------------------------- panel
  let panel = null;
  if (sel?.type === "agent" && selectedAgent) {
    panel = <AgentPanel key={selectedAgent.key} agent={selectedAgent.key === "commander" ? { ...selectedAgent, name: ceoName } : selectedAgent} data={d} refresh={refresh} onClose={() => select(null)}
      onOpenCeo={() => { if (selectedAgent.client_id) setP({ web: "clients", client: selectedAgent.client_id, agent: null, ceo: "1" }); else select({ type: "ceo" }); }}
      onOpenBrain={() => { if (selectedAgent.client_id) setP({ web: "clients", client: selectedAgent.client_id, agent: null, brain: "1" }); else select({ type: "brain" }); }} />;
  } else if (sel?.type === "ceo") {
    panel = web === "clients" && client
      ? <CeoPanel key={`ceo:${client.id}`} scope="client" client={client} data={d} prefs={d.prefs} refresh={refresh} onClose={() => select(null)} />
      : <CeoPanel key="ceo:hq" scope="interstellar" data={d} prefs={d.prefs} refresh={refresh} onClose={() => select(null)} />;
  } else if (sel?.type === "brain") {
    panel = web === "clients" && client
      ? <BrainPanel key={`brain:${client.id}`} brain={clientBrain} client={client} scope="client" refresh={refresh} onClose={() => select(null)} />
      : <BrainPanel key="brain:hq" brain={hqBrain} scope="interstellar" agency={d.agency} refresh={refresh} onClose={() => select(null)} />;
  } else if (sel?.type === "dept") {
    const dd = depts.find((x) => x.key === sel.key);
    if (dd) panel = <DeptPanel dept={dd} agents={scopeAgents.filter((a) => a.department === dd.key)} onClose={() => select(null)} onPick={(a) => select({ type: "agent", key: a.key })} onOpenView={() => setP({ dept: dd.key, deptpanel: null })} />;
  } else if (sel?.type === "client") {
    const c = clients.find((x) => x.id === sel.id);
    if (c) panel = <ClientPanel client={c} agents={instances.filter((a) => a.client_id === c.id)} brain={d.brains.find((b) => b.client_id === c.id)} onClose={() => select(null)}
      onPick={(a) => setP({ client: c.id, agent: a.key, clientpanel: null })} onOpenWeb={() => setP({ client: c.id, dept: null, clientpanel: null })}
      onOpenBrain={() => setP({ client: c.id, dept: null, clientpanel: null, brain: "1" })} onOpenCeo={() => setP({ client: c.id, dept: null, clientpanel: null, ceo: "1" })} />;
  }

  // What the open panel covers, so the map recenters into the rest.
  const panelOpen = !!panel;
  const pw = panelWidth({ ...ps, wide: sel?.type === "ceo" || sel?.type === "brain" });
  const pad = {
    top: 0,
    left: 0,
    right: isMd && panelOpen ? (ps.collapsed ? 64 : pw + 18) : 0,
    bottom: (isMd ? 60 : 56) + (!isMd && panelOpen ? Math.round(stage.h * 0.62) : 0) + (!isMd && pinnedAgent && !panelOpen ? 180 : 0),
  };

  // In-map breadcrumb: which department the camera is in, even when you zoomed there by hand.
  const zoomedIn = cam.k > cam.fitK * 1.35;
  const camDept = useMemo(() => {
    if (dept) return dept;
    if (!graph.clusters?.length || !zoomedIn) return null;
    const vw = Math.max(200, stage.w - pad.right), vh = Math.max(200, stage.h - pad.bottom);
    const wx = (vw / 2 - cam.x) / cam.k, wy = (vh / 2 - cam.y) / cam.k;
    const c = graph.clusters.find((cl) => Math.hypot(cl.x - wx, cl.y - wy) < cl.r + 40);
    return c ? depts.find((x) => x.key === c.key) || null : null;
  }, [dept, graph, cam, zoomedIn, stage, pad.right, pad.bottom, depts]);

  const crumbs = [
    { label: web === "clients" ? "Clients" : "Interstellar", go: () => setP({ client: null, dept: null, agent: null, ceo: null, brain: null, deptpanel: null, clientpanel: null }) },
    ...(client ? [{ label: client.business, go: () => setP({ dept: null, agent: null, deptpanel: null }) }] : []),
    ...(dept ? [{ label: dept.label }] : []),
  ];

  const hovered = hover?.n?.agent && hover.n.type === "agent" ? hover.n.agent : null;
  const cardAgent = (isMd && hovered) || pinnedAgent;
  const cardLinks = cardAgent ? { out: handoffs.filter((h) => h.from === cardAgent.key).length, in: handoffs.filter((h) => h.to === cardAgent.key).length } : null;

  return (
    <div ref={fillRef} className="agx grain-d flex flex-col overflow-hidden" style={{ height: height || "calc(100dvh - 48px)" }}>
      {/* Header */}
      <header className="relative z-20 border-b border-[var(--hair-d)] px-4 pb-3 pt-4 md:px-6">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <p className="eyebrow flex items-center gap-2"><span className="inline-block h-[9px] w-[9px]" style={{ background: "linear-gradient(#ff3c00,#ff3c00) center/100% 1.5px no-repeat, linear-gradient(#ff3c00,#ff3c00) center/1.5px 100% no-repeat" }} />(Command)</p>
            <h1 className="mt-1.5 text-[30px] font-semibold leading-[0.95] tracking-[-0.045em] text-white md:text-[40px]">Agent <span className="text-[#ff3c00]">/Constellation</span></h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="btn-d" onClick={onShip} aria-label="Open the ship view"><Orbit className="h-3.5 w-3.5" />Ship view</button>
            <Toggle label="Which web" value={web} onChange={(v) => setParams(new URLSearchParams(v === "clients" ? { v: "classic", web: "clients", view } : { v: "classic", view }))} options={[["interstellar", "Interstellar", Orbit], ["clients", "Clients", Users]]} />
            <Toggle label="View" value={view} onChange={(v) => setP({ view: v === "list" ? "list" : null })} options={[["map", "Map", Network], ["list", "List", LayoutList]]} />
            <button type="button" className="btn-f" onClick={() => setP({ present: "1" })} disabled={isLoading || !!error} data-testid="present-button" aria-label="Present the agent workforce full screen"><Play className="h-3.5 w-3.5 fill-current" />Present</button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Breadcrumb" className="flex w-full min-w-0 flex-wrap items-center gap-1.5 text-[12.5px] sm:w-auto">
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1.5">
                {i ? <span className="text-[var(--ink-s)]">/</span> : null}
                {c.go && i < crumbs.length - 1 ? <button type="button" onClick={c.go} className="text-[var(--ink-m)] hover:text-white">{c.label}</button> : <span className="text-white">{c.label}</span>}
              </span>
            ))}
            <span className="mono ml-2 hidden text-[10.5px] text-[var(--ink-s)] sm:inline">
              {counts.live} live · {counts.paused} paused · {counts.planned} planned{counts.broken ? ` · ${counts.broken} broken` : ""}
            </span>
          </nav>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-72 sm:flex-none">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-s)]" />
                <input id="agx-search" className="inp w-full !pl-8 !pr-8" placeholder="Search agents  /" value={q} role="combobox" aria-expanded={searchOpen && results.length > 0} aria-controls="agx-results" aria-autocomplete="list"
                  onChange={(e) => { setQ(e.target.value); setSearchOpen(true); }} onFocus={() => setSearchOpen(true)} onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); goResult(results[0]); } if (e.key === "Escape") { setQ(""); e.currentTarget.blur(); } }} aria-label="Search agents" />
                {q ? <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--ink-s)] hover:text-white"><X className="h-3.5 w-3.5" /></button> : null}
              </label>
              {searchOpen && results.length ? (
                <ul id="agx-results" role="listbox" className="glass absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl py-1" data-testid="search-results">
                  {results.map((r) => (
                    <li key={r.id} role="option" aria-selected={false}>
                      <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => goResult(r)} className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-white/5">
                        {r.agent ? <StatusDot status={r.agent.status} size={7} /> : <Users className="h-3 w-3 text-[var(--ink-s)]" />}
                        <span className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--ink-d)]">{r.label}</span>
                        <span className="mono shrink-0 text-[9.5px] uppercase tracking-[.1em] text-[var(--ink-s)]">{r.sub}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <button type="button" className={`btn-d ${filtering && (fStatus.size || fKind.size || fAuto.size) ? "!border-[rgba(255,106,0,.7)]" : ""}`} onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters}>
              <Filter className="h-3.5 w-3.5" /><span className="hidden sm:inline">Filters</span>{fStatus.size + fKind.size + fAuto.size ? ` · ${fStatus.size + fKind.size + fAuto.size}` : ""}
            </button>
            <button type="button" aria-label={web === "clients" && client ? "Client CEO" : ceoName} className="btn-d !px-3 sm:!px-3.5" onClick={() => (web === "clients" && client ? select({ type: "ceo" }) : setP({ web: null, client: null, ceo: "1", agent: null, brain: null }))}>
              <Sparkles className="h-4 w-4 text-[#ff8a3d]" /><span className="hidden sm:inline">{web === "clients" && client ? "Client CEO" : ceoName}</span>
            </button>
          </div>
        </div>
        {showFilters ? (
          <div className="glass absolute left-4 right-4 top-full z-40 mt-2 grid gap-4 rounded-xl p-4 md:left-auto md:right-6 md:w-[520px]">
            <FilterGroup title="Status" items={STATUSES} set={fStatus} onToggle={toggleIn(setFStatus)} render={(s) => <><StatusDot status={s} size={7} />{STATUS_META[s].label}</>} />
            <FilterGroup title="Kind" items={KINDS} set={fKind} onToggle={toggleIn(setFKind)} render={(k) => KIND_SHORT[k]} />
            <FilterGroup title="Autonomy" items={AUTOS} set={fAuto} onToggle={toggleIn(setFAuto)} render={(k) => AUTONOMY[k]} />
            <div className="flex justify-between">
              <button type="button" className="text-[12px] text-[var(--ink-s)] hover:text-white" onClick={() => { setFStatus(new Set()); setFKind(new Set()); setFAuto(new Set()); }}>Clear filters</button>
              <button type="button" className="btn-d !h-8" onClick={() => setShowFilters(false)}>Done</button>
            </div>
          </div>
        ) : null}
      </header>

      {/* Stage */}
      <div ref={stageRef} className="relative min-h-0 flex-1">
        {isLoading ? (
          <div className="absolute inset-0 grid place-items-center"><div className="flex items-center gap-3 text-[13px] text-[var(--ink-m)]"><Spinner size={18} />Mapping the constellation…</div></div>
        ) : error ? (
          <div className="absolute inset-0 grid place-items-center text-[13px] text-[#ff8a7f]">Couldn't load agents: {String(error.message || error)}</div>
        ) : view === "list" ? (
          <ListView agents={listAgents} depts={web === "clients" ? CLIENT_DEPTS : INTERSTELLAR_DEPTS} onPick={(a) => select({ type: "agent", key: a.key })} selectedKey={selectedAgent?.key} showClient={clientsHub} />
        ) : (
          <>
            <Constellation ref={mapRef} graph={graph} handoffs={handoffs} viewKey={viewKey} selectedId={selectedId} onSelect={onNode} isMatch={filtering ? isMatch : null} query={query}
              pad={pad} reduced={reduced} onCamera={(t, fitK) => { if (Math.abs(t.k - cam.k) / cam.k > 0.04 || fitK !== cam.fitK || Math.hypot(t.x - cam.x, t.y - cam.y) > 60) setCam({ k: t.k, fitK, x: t.x, y: t.y }); }}
              onHover={(n, x, y) => setHover(n ? { n, x, y } : null)} />

            {/* Back control when zoomed into a department */}
            {(dept || zoomedIn) && !clientsHub ? (
              <div data-ui="" className="absolute z-20 flex items-center gap-1.5" style={{ left: isMd ? 20 : 12, top: 12 }}>
                <button type="button" className="glass flex h-9 items-center gap-1.5 rounded-full pl-2.5 pr-3.5 text-[12px] text-[var(--ink-d)] hover:text-white" onClick={() => { setPin(null); if (dept) setP({ dept: null }); else mapRef.current?.fit(true); }} data-testid="map-back">
                  <ArrowLeft className="h-3.5 w-3.5" />All departments
                </button>
                {camDept ? <span className="mono rounded-full bg-black/40 px-2.5 py-1 text-[10px] uppercase tracking-[.16em] text-[#ffb27a]">{camDept.label}</span> : null}
              </div>
            ) : null}

            {dept ? (
              <>
                <button type="button" data-ui="" aria-label="Previous department" onClick={() => stepDept(-1)} className="glass absolute left-3 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-[var(--ink-m)] transition hover:text-white sm:grid md:left-5"><ChevronLeft className="h-5 w-5" /></button>
                <button type="button" data-ui="" aria-label="Next department" onClick={() => stepDept(1)} className="glass absolute top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-[var(--ink-m)] transition hover:text-white sm:grid" style={{ right: pad.right + 16 }}><ChevronRight className="h-5 w-5" /></button>
              </>
            ) : null}

            {/* Legend */}
            <div className="glass pointer-events-none absolute bottom-[68px] left-3 z-10 hidden rounded-xl px-3.5 py-3 lg:block md:left-5">
              <p className="eyebrow mb-2 !text-[9px]">Legend</p>
              <ul className="space-y-1.5 text-[11.5px] text-[var(--ink-m)]">
                <li className="flex items-center gap-2"><StatusDot status="live" />Live <span className="text-[var(--ink-s)]">· ring = ran in 24h</span></li>
                <li className="flex items-center gap-2"><StatusDot status="paused" />Paused</li>
                <li className="flex items-center gap-2"><StatusDot status="planned" />Planned (still needed)</li>
                <li className="flex items-center gap-2"><StatusDot status="broken" />Broken</li>
                <li className="pt-0.5 text-[10.5px] text-[var(--ink-s)]">Bigger = more runs in 30 days</li>
                <li className="text-[10.5px] text-[var(--ink-s)]">Hover an agent to see its hand-offs</li>
              </ul>
            </div>

            {cardAgent ? (
              <AgentCard a={cardAgent} name={cardAgent.key === "commander" ? ceoName : cardAgent.name} deptLabel={depts.find((x) => x.key === cardAgent.department)?.label || cardAgent.department}
                links={cardLinks} pinned={!hovered || hovered.key === pin} sheet={!isMd} top={(dept || zoomedIn) && !clientsHub ? 58 : 12} onOpen={() => openDetails(cardAgent.key)} onClose={() => setPin(null)} />
            ) : null}
            {hover && !hover.n.agent && hover.n.type !== "brain" && isMd ? (
              <div className="glass pointer-events-none fixed z-50 max-w-[260px] rounded-lg px-3 py-2" style={{ left: hover.x + 14, top: hover.y + 14 }}>
                <p className="text-[12.5px] font-medium text-white">{hover.n.type === "dept" ? `${hover.n.label} · zoom in` : hover.n.type === "client" ? `${hover.n.label} · open constellation` : hover.n.label}</p>
              </div>
            ) : null}
          </>
        )}

        {/* Department switcher */}
        {!isLoading && !clientsHub ? (
          <div className="absolute bottom-3 left-3 z-20 md:left-5" style={{ right: (isMd ? pad.right : 0) + (isMd ? 70 : 12) }}>
            <div className="no-scrollbar flex gap-1.5 overflow-x-auto">
              <button type="button" className={`chip shrink-0 ${!dept ? "on" : ""}`} onClick={() => setP({ dept: null, deptpanel: null })}>Overview</button>
              {presentDepts.map((x) => {
                const c = countStatus(scopeAgents.filter((a) => a.department === x.key));
                return (
                  <button key={x.key} type="button" className={`chip shrink-0 ${dept?.key === x.key ? "on" : ""}`} onClick={() => setP({ dept: x.key, deptpanel: null, agent: null })}>
                    {x.label}<span className="mono text-[10px] text-[#ff8a3d]">{c.live}</span><span className="mono text-[10px] text-[var(--ink-s)]">/{c.planned}</span>
                  </button>
                );
              })}
              {web === "clients" && client ? <button type="button" className="chip shrink-0" onClick={() => select({ type: "brain" })}><BookOpen className="h-3 w-3" />Brain</button> : null}
            </div>
          </div>
        ) : null}

        {panel}
      </div>

      {presenting && data ? <PresentMode data={d} registry={registry} ceoName={ceoName} onExit={() => setP({ present: null, scene: null })} /> : null}
    </div>
  );
}

// /agents opens Constellation v2 (the whole ship). The classic constellation stays one click away ("Classic"), and every
// older deep link (?ceo=1, ?agent=, ?brain=1, ?web=clients ...) still opens it; once in classic, ?v=classic keeps it there.
const CLASSIC_PARAMS = ["v", "ceo", "brain", "agent", "deptpanel", "clientpanel", "web", "dept", "view", "client", "present"];
export default function AgentsPage() {
  const [params, setParams] = useSearchParams();
  const classic = params.get("v") === "classic" || CLASSIC_PARAMS.slice(1).some((k) => params.has(k));
  useEffect(() => {
    if (classic && params.get("v") !== "classic") { const next = new URLSearchParams(params); next.set("v", "classic"); setParams(next, { replace: true }); }
  }, [classic, params, setParams]);
  if (classic) return <ClassicAgentsPage onShip={() => setParams(new URLSearchParams())} />;
  return <ShipView onClassic={() => setParams(new URLSearchParams({ v: "classic" }))} onPresent={() => setParams(new URLSearchParams({ v: "classic", present: "1" }))} />;
}
