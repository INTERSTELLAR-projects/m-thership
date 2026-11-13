// Constellation v2: "the whole ship". Claude core -> Møthership brain -> departments -> clients -> the agents in
// their apps, with research flooding in and ideas / results flowing back, all driven by real records.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  Search, X, Orbit, Network, Crown, Radar, Handshake, Megaphone, Rocket, HeartHandshake, Landmark, ShieldCheck,
  Telescope, Lightbulb, ScanSearch, GraduationCap, Sparkles, ChevronDown, ChevronRight, PlugZap, Bot, Brain,
} from "lucide-react";
import "../agents.css";
import "./ship.css";
import { useShipData } from "./useShipData";
import { buildShip, litNodes, breadcrumb, eventsOf, freshEvents, eventPath, summaryLine, hqDeptOf, recordPath, COLORS } from "./graph";
import FlowCanvas from "./FlowCanvas";
import ShipPanel from "./ShipPanel";
import { StatusDot, relTime, Spinner, STATUS_META } from "../ui";
import { INTERSTELLAR_DEPTS } from "../defs";

const DEPT_ICON = { command: Crown, research: Radar, sales: Handshake, marketing: Megaphone, delivery: Rocket, success: HeartHandshake, backoffice: Landmark, systems: ShieldCheck };
const LANE_ICON = { search_intel: Search, oracle: Telescope, ideas: Lightbulb, research: ScanSearch, learnings: GraduationCap };
const EVENT_COLOR = { run: COLORS.command, work: COLORS.result, job: COLORS.claude, research: COLORS.intel };

function useFillHeight() {
  const ref = useRef(null);
  const [h, setH] = useState(null);
  useLayoutEffect(() => {
    const measure = () => { if (ref.current) setH(Math.max(560, window.innerHeight - ref.current.getBoundingClientRect().top - (window.scrollY || 0))); };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  return [ref, h];
}
function usePrefersReducedMotion() {
  const q = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const [r, setR] = useState(!!q?.matches);
  useEffect(() => { if (!q) return undefined; const on = () => setR(q.matches); q.addEventListener?.("change", on); return () => q.removeEventListener?.("change", on); }, [q]);
  return r;
}

// Nodes on the selected branch (lit paths).
function chainOf(selId, ship, registry) {
  if (!selId || !ship) return null;
  const S = new Set();
  const clientChain = (cid) => {
    S.add("claude"); S.add("brain"); S.add(`client:${cid}`);
    ship.edges.forEach((e) => { if (e.to === `client:${cid}`) S.add(e.from); if (e.from === `client:${cid}`) S.add(e.to); });
  };
  if (selId.startsWith("agent:")) {
    const a = registry.find((x) => x.key === selId.slice(6));
    if (!a) return null;
    if (a.scope === "client") { clientChain(a.client_id); S.forEach((id) => { if (id.startsWith("dept:") && id !== `dept:${hqDeptOf(a)}`) S.delete(id); }); } else ["claude", "brain", `dept:${a.department}`].forEach((x) => S.add(x));
    return S;
  }
  const n = ship.nodes[selId];
  if (!n) return null;
  if (n.type === "claude") ["claude", "brain"].forEach((x) => S.add(x));
  else if (n.type === "brain") { ["claude", "brain", "ideas_out"].forEach((x) => S.add(x)); Object.keys(ship.nodes).forEach((k) => { if (k.startsWith("lane:") || k.startsWith("dept:")) S.add(k); }); }
  else if (n.type === "lane") [selId, "brain"].forEach((x) => S.add(x));
  else if (n.type === "ideas") ["brain", "ideas_out"].forEach((x) => S.add(x));
  else if (n.type === "dept") { ["claude", "brain", selId].forEach((x) => S.add(x)); ship.edges.forEach((e) => { if (e.from === selId) S.add(e.to); }); }
  else if (n.clientId) clientChain(n.clientId);
  return S;
}

// ---------------------------------------------------------------- cards
function Card({ id, reg, sel, dim, onClick, className = "", children, label, tint }) {
  return (
    <button type="button" ref={reg(id)} data-node={id} aria-label={label} aria-pressed={sel} onClick={onClick} className={`shp-card ${sel ? "sel" : ""} ${dim ? "dim" : ""} ${className}`}>
      {tint ? <span className="shp-tint" style={{ background: tint, boxShadow: `0 0 10px ${tint}` }} /> : null}
      {children}
    </button>
  );
}

function ClaudeCard({ node, reg, sel, onClick }) {
  const m = node.metrics;
  return (
    <Card id="claude" reg={reg} sel={sel} onClick={onClick} label="Claude, the engine" className="overflow-hidden px-4 pb-3.5 pt-3">
      <p className="eyebrow flex items-center gap-1.5 !text-[9.5px]"><Sparkles className="h-3 w-3 text-[#ffb27a]" />Claude · engine</p>
      <div ref={reg("slot:claude")} className="mx-auto my-1 aspect-square w-full max-w-[170px]" />
      <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {[["AI calls today", m.aiCallsToday], ["Runs today", m.claudeRunsToday], ["Facts", m.factsActive], ["Learned 7d", m.learned7d]].map(([l, v]) => (
          <div key={l} className="min-w-0"><p className="mono text-[15px] font-medium leading-none text-white">{v}</p><p className="mono mt-1 truncate text-[9px] uppercase tracking-[.12em] text-[var(--ink-s)]">{l}</p></div>
        ))}
      </div>
    </Card>
  );
}

function BrainCard({ node, reg, sel, onClick }) {
  const ps = node.metrics.pillars || {};
  const scores = Object.values(ps).map((p) => p?.score).filter((v) => Number.isFinite(v));
  const avg = scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : null;
  return (
    <Card id="brain" reg={reg} sel={sel} onClick={onClick} label="Møthership Brain" className="overflow-hidden px-4 pb-3.5 pt-3">
      <p className="eyebrow flex items-center gap-1.5 !text-[9.5px]"><Brain className="h-3 w-3 text-[#b18cff]" />Main brain</p>
      <p className="mt-1 text-[17px] font-semibold tracking-[-0.02em] text-white">Møthership <span style={{ color: COLORS.brain }}>Brain</span></p>
      <div ref={reg("slot:brain")} className="my-1 h-[84px] w-full" />
      <div className="flex items-baseline justify-between gap-2">
        <p className="mono text-[11px] text-[var(--ink-m)]"><span className="text-[15px] text-white">{node.metrics.factsActive}</span> facts</p>
        <p className="mono text-[11px] text-[var(--ink-m)]">{node.metrics.completeness == null ? "" : <><span className="text-white">{node.metrics.completeness}%</span> mapped</>}</p>
      </div>
      <div className="mt-2 grid grid-cols-8 items-end gap-1" title={avg == null ? "Pillar scores" : `Pillars average ${avg}/100`}>
        {["sales", "marketing", "delivery", "finance", "clients", "team", "systems", "owner"].map((k) => {
          const v = ps[k]?.score;
          return <span key={k} className="block rounded-sm" style={{ height: 4 + ((v || 0) / 100) * 22, background: v == null ? "rgba(255,255,255,.1)" : `linear-gradient(180deg, ${v >= 70 ? COLORS.result : v >= 45 ? COLORS.idea : COLORS.command}, rgba(177,140,255,.35))`, boxShadow: v >= 70 ? `0 0 8px ${COLORS.result}` : "none" }} />;
        })}
      </div>
      <p className="mono mt-1.5 text-[9px] uppercase tracking-[.12em] text-[var(--ink-s)]">8 pillars{avg == null ? "" : ` · avg ${avg}`}</p>
    </Card>
  );
}

function LaneCard({ node, reg, sel, dim, onClick }) {
  const Icon = LANE_ICON[node.key] || Radar;
  return (
    <Card id={node.id} reg={reg} sel={sel} dim={dim} onClick={onClick} label={node.label} className="px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: "rgba(56,200,255,.1)", boxShadow: "inset 0 0 0 1px rgba(56,200,255,.35)" }}><Icon className="h-3.5 w-3.5 text-[#38c8ff]" /></span>
        <div className="min-w-0"><p className="truncate text-[12.5px] font-medium text-white">{node.label}</p><p className="mono truncate text-[9.5px] text-[var(--ink-s)]">{node.metrics.week} this week{node.metrics.waiting ? ` · ${node.metrics.waiting} new` : ""}</p></div>
      </div>
    </Card>
  );
}

function IdeasCard({ node, reg, sel, onClick }) {
  return (
    <Card id="ideas_out" reg={reg} sel={sel} onClick={onClick} label="Ideas and moves waiting" className="px-3.5 py-2.5" tint={COLORS.idea}>
      <div className="flex items-center gap-2.5 pl-1">
        <Lightbulb className="h-4 w-4 shrink-0 text-[#ffc23d]" />
        <div className="min-w-0 flex-1"><p className="truncate text-[12.5px] font-medium text-white">{node.label}</p><p className="truncate text-[11px] text-[var(--ink-s)]">{node.sub}</p></div>
        <div className="text-right"><p className="mono text-[17px] leading-none text-[#ffc23d]">{node.metrics.ideasWaiting}</p><p className="mono mt-0.5 text-[9px] uppercase tracking-[.1em] text-[var(--ink-s)]">{node.metrics.needsYou} need you</p></div>
      </div>
    </Card>
  );
}

function DeptCard({ node, reg, sel, dim, open, onClick, onAgent, selId }) {
  const Icon = DEPT_ICON[node.key] || Orbit;
  const m = node.metrics;
  return (
    <div className={`shp-card ${sel ? "sel" : ""} ${dim ? "dim" : ""}`} ref={reg(node.id)} data-node={node.id}>
      <button type="button" onClick={onClick} aria-expanded={open} className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg" style={{ background: "rgba(255,90,0,.1)", boxShadow: "inset 0 0 0 1px rgba(255,106,0,.35)" }}><Icon className="h-4 w-4 text-[#ff8a3d]" /></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5"><span className="truncate text-[13px] font-medium text-white">{node.label}</span></span>
          <span className="mono block truncate text-[9.5px] text-[var(--ink-s)]">{m.live}/{m.agents} live · {m.runsToday} today · {m.lastRun ? relTime(m.lastRun) : "no runs"}</span>
        </span>
        <StatusDot status={node.status} size={7} />
        {open ? <ChevronDown className="h-3.5 w-3.5 text-[var(--ink-s)]" /> : <ChevronRight className="h-3.5 w-3.5 text-[var(--ink-s)]" />}
      </button>
      {open ? (
        <div className="scroll-d max-h-[300px] overflow-y-auto border-t border-[var(--hair-d)] px-1.5 py-1.5">
          {node.agents.length ? node.agents.slice().sort((a, b) => (a.status === "live" ? 0 : 1) - (b.status === "live" ? 0 : 1) || String(a.name).localeCompare(String(b.name))).map((a) => (
            <button key={a.key} type="button" onClick={() => onAgent(a)} className={`shp-row ${selId === `agent:${a.key}` ? "on" : ""}`}>
              <StatusDot status={a.status} size={6} />
              <span className="min-w-0 flex-1 truncate text-[12px] text-[var(--ink-d)]">{a.name}</span>
              <span className="mono shrink-0 text-[9.5px] text-[var(--ink-s)]">{a.status === "planned" ? "planned" : relTime(a.last_run_at)}</span>
            </button>
          )) : <p className="px-2 py-1.5 text-[11.5px] text-[var(--ink-s)]">Commands {m.clientAgents} client agents; no agency agents of its own.</p>}
        </div>
      ) : null}
    </div>
  );
}

function Logo({ node }) {
  const [bad, setBad] = useState(false);
  const ring = { boxShadow: `0 0 0 1px ${node.color}88, 0 0 14px -2px ${node.color}` };
  if (node.logo && !bad) return <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg bg-white/90 p-1" style={ring}><img src={node.logo} alt="" className="h-full w-full object-contain" loading="lazy" onError={() => setBad(true)} /></span>;
  return <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[13px] font-semibold text-white" style={{ ...ring, background: `${node.color}33` }}>{String(node.label || "?").trim()[0]}</span>;
}

function ClientCard({ node, reg, sel, dim, open, onClick }) {
  const m = node.metrics;
  return (
    <Card id={node.id} reg={reg} sel={sel} dim={dim} onClick={onClick} label={`${node.label}${open ? ", expanded" : ""}`} className="px-3 py-2.5" tint={node.color}>
      <div className="flex items-center gap-2.5 pl-1">
        <Logo node={node} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-white">{node.label}</p>
          <p className="mono truncate text-[9.5px] text-[var(--ink-s)]">{node.health == null ? "" : `health ${node.health}% · `}{m.runsToday} today{m.waiting ? ` · ${m.waiting} waiting` : ""}</p>
        </div>
        {m.newResearch ? <span className="mono rounded-full px-1.5 py-0.5 text-[9.5px]" style={{ color: COLORS.idea, boxShadow: `inset 0 0 0 1px ${COLORS.idea}66` }} title="New research ideas">{m.newResearch}</span> : null}
        {open ? <ChevronDown className="h-3.5 w-3.5 text-[var(--ink-s)]" /> : <ChevronRight className="h-3.5 w-3.5 text-[var(--ink-s)]" />}
      </div>
    </Card>
  );
}

function ClusterCard({ node, reg, sel, dim, onClick }) {
  const agents = node.agents.filter((a) => a.status !== "planned");
  const shown = agents.slice(0, 22);
  return (
    <Card id={node.id} reg={reg} sel={sel} dim={dim} onClick={onClick} label={`${node.label}, open`} className="px-3 py-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[12px] text-[var(--ink-d)]"><span className="font-medium text-white">{agents.filter((a) => a.status === "live").length}</span> live agents{node.metrics.inApp ? <span className="text-[var(--ink-s)]"> · {node.metrics.inApp} in their apps</span> : null}</p>
        <Bot className="h-3.5 w-3.5 shrink-0 text-[var(--ink-s)]" />
      </div>
      <div className="shp-orbs mt-1.5">
        {shown.map((a) => <i key={a.key} title={a.name} style={{ background: a.status === "live" ? (a.kind === "client_app_workflow" ? node.color : STATUS_META.live.color) : STATUS_META[a.status]?.color || "#777", boxShadow: a.status === "live" ? `0 0 7px ${a.kind === "client_app_workflow" ? node.color : "#ff6a00"}` : "none" }} />)}
        {agents.length > shown.length ? <span className="mono text-[9.5px] text-[var(--ink-s)]">+{agents.length - shown.length}</span> : null}
        {!agents.length ? <span className="text-[11px] text-[var(--ink-s)]">Nothing running yet</span> : null}
      </div>
    </Card>
  );
}

function GroupCard({ node, reg, sel, onClick, onAgent, selId }) {
  const empty = !node.agents.length;
  return (
    <div ref={reg(node.id)} data-node={node.id} className={`shp-card ${sel ? "sel" : ""}`}>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-2 px-3 pb-1.5 pt-2.5 text-left">
        {node.appId ? <PlugZap className="h-3.5 w-3.5 shrink-0" style={{ color: node.color }} /> : <Orbit className="h-3.5 w-3.5 shrink-0 text-[#ff8a3d]" />}
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium text-white">{node.label}</span>
        <span className="mono shrink-0 text-[9.5px] text-[var(--ink-s)]">{node.metrics.agents} agents</span>
      </button>
      {empty ? (
        <p className="px-3 pb-2.5 text-[11px] leading-snug text-[var(--ink-s)]">{node.appId ? "Connected app · no agents read from it yet. Next: add it to the registry sync." : "No agents yet."}</p>
      ) : (
        <div className="scroll-d max-h-[230px] overflow-y-auto px-1.5 pb-1.5">
          {node.agents.slice().sort((a, b) => (a.status === "live" ? 0 : 1) - (b.status === "live" ? 0 : 1)).map((a) => (
            <button key={a.key} type="button" onClick={() => onAgent(a)} className={`shp-row !py-1 ${selId === `agent:${a.key}` ? "on" : ""}`}>
              <StatusDot status={a.status} size={6} />
              <span className="min-w-0 flex-1 truncate text-[11.5px] text-[var(--ink-d)]">{a.name}</span>
              <span className="mono shrink-0 text-[9.5px] text-[var(--ink-s)]">{a.status === "planned" ? "planned" : relTime(a.last_run_at)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- page
export default function ShipView({ onClassic }) {
  const { data, isLoading, error, liveAt } = useShipData();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const focus = params.get("focus") || "";
  const noteId = params.get("note") || "";
  const sel = params.get("sel") || (noteId ? "lane:research" : "");
  const forceSvg = params.get("flow") === "svg";
  const [q, setQ] = useState("");
  const [fClient, setFClient] = useState("");
  const [fDept, setFDept] = useState("");
  const [fStatus, setFStatus] = useState("");
  const reduced = usePrefersReducedMotion();
  const [fillRef, height] = useFillHeight();
  const stageRef = useRef(null);
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const canvasApi = useRef(null);
  const els = useRef({});
  const [anchors, setAnchors] = useState(null);
  const [width, setWidth] = useState(1280);
  const [hover, setHover] = useState(null);
  const [ticker, setTicker] = useState([]);
  const seen = useRef(null);

  const setP = useCallback((patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => { if (v === null || v === undefined || v === "") next.delete(k); else next.set(k, v); });
    setParams(next, { replace: false });
  }, [params, setParams]);

  const registry = useMemo(() => (data?.registry || []).filter((a) => a.scope !== "template"), [data]);
  const ship = useMemo(() => (data ? buildShip(data, { now: new Date(), focus }) : null), [data, focus]);
  const lit = useMemo(() => (ship ? litNodes(ship, registry, { q, client: fClient, dept: fDept, status: fStatus }) : null), [ship, registry, q, fClient, fDept, fStatus]);
  const chain = useMemo(() => chainOf(sel, ship, registry), [sel, ship, registry]);
  const mode = width >= 1120 ? "cols" : "stack";
  const density = width < 700 ? 0.5 : 1;

  // Stage width -> layout mode.
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setWidth(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [isLoading]);

  // Card positions (content coordinates) for the flow layer.
  const reg = useCallback((id) => (el) => { if (el) els.current[id] = el; else delete els.current[id]; }, []);
  const read = useCallback(() => {
    const c = contentRef.current;
    if (!c) return null;
    const base = c.getBoundingClientRect();
    const out = {};
    Object.entries(els.current).forEach(([id, el]) => {
      const r = el.getBoundingClientRect();
      if (r.width || r.height) out[id] = { x: Math.round(r.left - base.left), y: Math.round(r.top - base.top), w: Math.round(r.width), h: Math.round(r.height) };
    });
    return out;
  }, []);
  const measure = useCallback(() => {
    const out = read();
    if (out) setAnchors((prev) => (prev && JSON.stringify(prev) === JSON.stringify(out) ? prev : out));
  }, [read]);
  // Sticky columns move while the client list scrolls: update the flow layer every frame, sync React state after.
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return undefined;
    let raf = 0; let idle = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { const out = read(); if (out) canvasApi.current?.setAnchors(out); });
      clearTimeout(idle);
      idle = setTimeout(measure, 180);
    };
    sc.addEventListener("scroll", on, { passive: true });
    return () => { sc.removeEventListener("scroll", on); cancelAnimationFrame(raf); clearTimeout(idle); };
  }, [read, measure, isLoading]);
  const [stageH, setStageH] = useState(600);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setStageH(Math.round(e.contentRect.height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [isLoading]);
  useLayoutEffect(() => { measure(); }, [measure, ship, mode, focus, width]);
  useEffect(() => {
    const c = contentRef.current;
    if (!c) return undefined;
    const ro = new ResizeObserver(() => measure());
    ro.observe(c);
    document.fonts?.ready?.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [measure, isLoading]);

  // Live events: every poll, new records fire a bright pulse along their real path.
  useEffect(() => {
    if (!data || !ship) return;
    const ev = eventsOf(data, { from: Date.now() - 2 * 864e5 });
    const fire = (list) => list.slice(0, 12).forEach((e, i) => {
      const p = eventPath({ ...e }, ship, registry);
      if (p) setTimeout(() => canvasApi.current?.fire(p), 250 + i * 420);
    });
    if (!seen.current) {
      seen.current = new Set(ev.map((e) => e.key));
      fire(ev.filter((e) => e.at > Date.now() - 12 * 3600e3).slice(0, 4).reverse()); // replay the latest real events once
      setTicker(ev.slice(0, 8).map((e) => ({ ...e, fresh: false })));
      return;
    }
    const fresh = freshEvents(seen.current, ev);
    fresh.forEach((e) => seen.current.add(e.key));
    if (fresh.length) {
      fire(fresh.slice().reverse());
      setTicker((t) => [...fresh.map((e) => ({ ...e, fresh: true })), ...t].slice(0, 8));
    }
  }, [liveAt]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape" && !/input|textarea|select/i.test(e.target?.tagName || "")) setP({ sel: null, note: null }); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setP]);

  // Hover + click on the flow layer (anywhere that isn't a card).
  const hoverRaf = useRef(0);
  const contentPoint = (e) => { const r = contentRef.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const onMove = (e) => {
    if (e.target.closest?.(".shp-card")) { if (hover) setHover(null); return; }
    const pt = contentPoint(e); const cx = e.clientX; const cy = e.clientY;
    cancelAnimationFrame(hoverRaf.current);
    hoverRaf.current = requestAnimationFrame(() => {
      const hit = canvasApi.current?.hitTest(pt.x, pt.y);
      setHover(hit ? { ...hit, x: cx, y: cy } : null);
    });
  };
  const onStageClick = (e) => {
    if (e.target.closest?.(".shp-card")) return;
    const hit = canvasApi.current?.hitTest(...Object.values(contentPoint(e)));
    if (hit?.type === "pulse" && hit.pulse.href) navigate(hit.pulse.href);
    else if (hit?.type === "edge") { const to = ship.nodes[hit.edge.to]; select(to?.type === "cagents" ? `client:${to.clientId}` : hit.edge.to); }
  };

  const select = (id) => setP({ sel: id || null, note: null });
  const toggleFocus = (id) => setP({ focus: focus === id ? null : id, sel: id, note: null });
  const onAgent = (a) => setP({ sel: `agent:${a.key}`, note: null });
  const isDim = (id) => (lit ? !lit.has(id) : false);

  if (isLoading || !ship) {
    return (
      <div ref={fillRef} className="agx shp grid place-items-center" style={{ height: height || "calc(100dvh - 48px)" }}>
        {error ? <p className="text-[13px] text-[#ff8a7f]">Couldn&apos;t load the ship: {String(error.message || error)}</p> : <div className="flex items-center gap-3 text-[13px] text-[var(--ink-m)]"><Spinner size={18} />Waking the ship…</div>}
      </div>
    );
  }

  const N = ship.nodes;
  const depts = INTERSTELLAR_DEPTS.map((d) => N[`dept:${d.key}`]).filter(Boolean);
  const clients = Object.values(N).filter((n) => n.type === "client");
  const lanes = Object.values(N).filter((n) => n.type === "lane");
  const crumbs = breadcrumb(ship, sel, registry);
  const panelOpen = !!sel && (N[sel] || sel.startsWith("agent:"));
  const filtering = !!(q || fClient || fDept || fStatus);

  const tooltip = hover ? (() => {
    if (hover.type === "pulse") return <><p className="text-[12.5px] font-medium text-white">{hover.pulse.label}</p><p className="mono mt-0.5 text-[10.5px] text-[var(--ink-s)]">live event · click to open</p></>;
    const e = hover.edge; const a = N[e.from]; const b = N[e.to];
    const words = {
      fuel: `${e.fwd.count} AI calls + Claude runs today · ${e.back.count} things learned this week flowing back`,
      intel: `${e.fwd.count} items this week flooding into the brain`,
      ideas: `${e.fwd.count} ideas waiting for your yes`,
      command: `${e.fwd.count} runs today · ${e.back.count} results back`,
      serve: `${e.agents} agents · ${e.fwd.count} runs today · ${e.back.count} results back${e.idea ? ` · ${e.idea.count} new research ideas` : ""}`,
      app: `${e.fwd.count} runs today · ${e.back.count} results back`,
    }[e.kind];
    return <><p className="text-[12.5px] font-medium text-white">{a?.label} → {b?.type === "cagents" ? "their agents" : b?.label}</p><p className="mt-0.5 text-[11.5px] text-[var(--ink-m)]">{words}</p></>;
  })() : null;

  const clientRow = (c) => {
    const open = focus === c.id;
    const groups = Object.values(N).filter((n) => n.type === "cgroup" && n.clientId === c.clientId);
    return (
      <div key={c.id} className={mode === "cols" ? "contents" : "shp-crow"}>
        <ClientCard node={c} reg={reg} sel={sel === c.id} dim={isDim(c.id)} open={open} onClick={() => toggleFocus(c.id)} />
        {open ? (
          <div className="shp-col !gap-2">
            {groups.map((g) => <GroupCard key={g.id} node={g} reg={reg} sel={sel === g.id} onClick={() => select(g.id)} onAgent={onAgent} selId={sel} />)}
            {!groups.length ? <p className="text-[11.5px] text-[var(--ink-s)]">No agents or apps for this client yet.</p> : null}
          </div>
        ) : N[`cagents:${c.clientId}`] ? (
          <ClusterCard node={N[`cagents:${c.clientId}`]} reg={reg} sel={sel === `cagents:${c.clientId}`} dim={isDim(`cagents:${c.clientId}`)} onClick={() => toggleFocus(c.id)} />
        ) : <span />}
      </div>
    );
  };

  const deptCards = depts.map((d) => <DeptCard key={d.id} node={d} reg={reg} sel={sel === d.id} dim={isDim(d.id)} open={focus === d.id} onClick={() => toggleFocus(d.id)} onAgent={onAgent} selId={sel} />);
  const laneCards = lanes.map((l) => <LaneCard key={l.id} node={l} reg={reg} sel={sel === l.id} dim={false} onClick={() => select(l.id)} />);

  return (
    <div ref={fillRef} className="agx shp flex flex-col overflow-hidden" style={{ height: height || "calc(100dvh - 48px)" }} data-testid="ship-view">
      {/* Header */}
      <header className="relative z-20 border-b border-[var(--hair-d)] px-4 pb-2.5 pt-3 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="text-[26px] font-semibold leading-[0.95] tracking-[-0.045em] text-white md:text-[30px]">Agent <span className="text-[#ff3c00]">/Constellation</span></h1>
            <p className="flex min-w-0 items-center gap-2 text-[13px] text-[var(--ink-d)]" data-testid="ship-summary"><span className="live-dot shrink-0" />{summaryLine(ship.summary)}</p>
          </div>
          <div className="seg" role="tablist" aria-label="Constellation view">
            <button type="button" role="tab" aria-selected className="on"><Orbit className="h-3.5 w-3.5" />Ship</button>
            <button type="button" role="tab" aria-selected={false} onClick={onClassic}><Network className="h-3.5 w-3.5" />Classic</button>
          </div>
        </div>
        <div className="mono mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px] uppercase tracking-[.12em] text-[var(--ink-s)]">
          {[["orders out", COLORS.command], ["results back", COLORS.result], ["research in", COLORS.intel], ["ideas out", COLORS.idea], ["Claude", COLORS.claude]].map(([l, c]) => <span key={l} className="flex items-center gap-1.5"><i className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />{l}</span>)}
          {liveAt ? <span>· live · updated {relTime(new Date(liveAt).toISOString())}</span> : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <nav aria-label="Breadcrumb" className="flex min-w-0 flex-wrap items-center gap-1.5 text-[12.5px]" data-testid="ship-breadcrumb">
            {crumbs.map((c, i) => (
              <span key={`${c.id}-${i}`} className="flex items-center gap-1.5">
                {i ? <span className="text-[var(--ink-s)]">/</span> : null}
                {i < crumbs.length - 1 ? <button type="button" className="text-[var(--ink-m)] hover:text-white" onClick={() => (c.id ? setP({ sel: c.id, focus: c.id.startsWith("client:") || c.id.startsWith("dept:") ? c.id : focus }) : setP({ sel: null, focus: null, note: null }))}>{c.label}</button> : <span className="text-white">{c.label}</span>}
              </span>
            ))}
          </nav>
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <label className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-s)]" />
              <input className="inp w-full !pl-8" placeholder="Search agents, clients" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search agents and clients" />
              {q ? <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--ink-s)] hover:text-white"><X className="h-3.5 w-3.5" /></button> : null}
            </label>
            <select className="shp-sel" aria-label="Filter by client" value={fClient} onChange={(e) => setFClient(e.target.value)}>
              <option value="">All clients</option>
              {clients.map((c) => <option key={c.clientId} value={c.clientId}>{c.label}</option>)}
            </select>
            <select className="shp-sel" aria-label="Filter by department" value={fDept} onChange={(e) => setFDept(e.target.value)}>
              <option value="">All departments</option>
              {INTERSTELLAR_DEPTS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
            </select>
            <select className="shp-sel" aria-label="Filter by status" value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
              <option value="">Any status</option>
              {["live", "paused", "planned", "broken"].map((s) => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
            </select>
            {filtering ? <button type="button" className="text-[12px] text-[var(--ink-s)] hover:text-white" onClick={() => { setQ(""); setFClient(""); setFDept(""); setFStatus(""); }}>Clear</button> : null}
          </div>
        </div>
      </header>

      {/* Stage */}
      <div ref={stageRef} className="shp-stage relative min-h-0 flex-1">
        <FlowCanvas ref={canvasApi} anchors={anchors} edges={ship.edges} scrollRef={scrollRef} mode={mode} lit={lit} focusIds={chain} hoverEdge={hover?.type === "edge" ? hover.edge.id : null} reduced={reduced} density={density} forceSvg={forceSvg} />
        <div ref={scrollRef} className="shp-scroll absolute inset-0 overflow-y-auto overflow-x-hidden" onMouseMove={onMove} onMouseLeave={() => setHover(null)} onClick={onStageClick} style={{ cursor: hover ? "pointer" : "default" }}>
          <div ref={contentRef} className="relative" style={{ "--stage-h": `${stageH}px` }}>
            {mode === "cols" ? (
              <div className="shp-cols">
                <div className="shp-lanes">{laneCards}</div>
                <div className="shp-ideas"><IdeasCard node={N.ideas_out} reg={reg} sel={sel === "ideas_out"} onClick={() => select("ideas_out")} /></div>
                <div className="shp-col shp-sticky"><ClaudeCard node={N.claude} reg={reg} sel={sel === "claude"} onClick={() => select("claude")} /></div>
                <div className="shp-col shp-sticky"><BrainCard node={N.brain} reg={reg} sel={sel === "brain"} onClick={() => select("brain")} /></div>
                <div className="shp-col shp-sticky">{deptCards}</div>
                <div className="shp-clients">{clients.map(clientRow)}</div>
              </div>
            ) : (
              <div className="shp-stack">
                <div className="shp-lanes">{laneCards}</div>
                <div className="shp-pair">
                  <ClaudeCard node={N.claude} reg={reg} sel={sel === "claude"} onClick={() => select("claude")} />
                  <BrainCard node={N.brain} reg={reg} sel={sel === "brain"} onClick={() => select("brain")} />
                </div>
                <IdeasCard node={N.ideas_out} reg={reg} sel={sel === "ideas_out"} onClick={() => select("ideas_out")} />
                <div className="shp-depts">{deptCards}</div>
                <div className="shp-clients">{clients.map(clientRow)}</div>
              </div>
            )}
          </div>
        </div>

        {/* Live ticker: the real events behind the pulses */}
        {ticker.length ? (
          <div className={`glass pointer-events-auto absolute bottom-3 left-3 z-20 w-[min(360px,calc(100%-24px))] rounded-xl px-3 py-2.5 ${panelOpen ? "hidden md:block" : ""}`} data-testid="ship-ticker">
            <p className="eyebrow mb-1.5 flex items-center gap-2 !text-[9px]"><span className="live-dot" />Live through the ship</p>
            <ul className="space-y-0.5">
              {ticker.slice(0, width < 700 ? 2 : 5).map((t) => (
                <li key={t.key} className={t.fresh ? "shp-tick rounded" : ""}>
                  <Link to={recordPath(t.entity, t.id, t.rec)} className="flex items-center gap-2 rounded px-1 py-0.5 text-[11.5px] hover:bg-white/5">
                    <i className="inline-block h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: EVENT_COLOR[t.type], boxShadow: `0 0 6px ${EVENT_COLOR[t.type]}` }} />
                    <span className="min-w-0 flex-1 truncate text-[var(--ink-d)]">{t.label}</span>
                    <span className="mono shrink-0 text-[9.5px] text-[var(--ink-s)]">{relTime(new Date(t.at).toISOString())}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {tooltip ? <div className="glass pointer-events-none fixed z-50 max-w-[300px] rounded-lg px-3 py-2" style={{ left: Math.min(hover.x + 14, window.innerWidth - 310), top: hover.y + 14 }} data-testid="ship-tooltip">{tooltip}</div> : null}

        {panelOpen ? <ShipPanel key={sel} selId={sel} noteId={noteId} ship={ship} data={data} registry={registry} onClose={() => setP({ sel: null, note: null })} onSelect={(id) => setP({ sel: id, focus: id.startsWith("cgroup:") ? `client:${id.split(":")[1]}` : focus })} /> : null}
      </div>
    </div>
  );
}

