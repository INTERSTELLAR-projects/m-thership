// House of Brands (/brands): Interstellar Strategies as the big central orb, every niche brand orbiting it, Interstellar
// direct clients hanging off the root and each brand's clients off their brand. Brain-flow orbs move UP (client ->
// brand -> Interstellar); template orbs move down. Same visual language as the /agents ship (FlowCanvas, ship.css).
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Plus, ExternalLink, Brain, Users, LayoutGrid, Orbit, ChevronRight } from "lucide-react";
import "@/features/agents/agents.css";
import "@/features/agents/ship/ship.css";
import "./brands.css";
import FlowCanvas from "@/features/agents/ship/FlowCanvas";
import { Spinner } from "@/features/agents/ui";
import { buildHouse, orientEdges, themeVars, STATUS_LABEL, BRAIN_COLOR, TEMPLATE_COLOR, ROOT_ID } from "./graph";
import { useHouseData } from "./useHouseData";
import AddBrandDialog from "./AddBrandDialog";

export const templateAppUrl = (id) => (id ? `https://app.base44.com/apps/${id}/editor/preview` : null);

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
export function usePrefersReducedMotion() {
  const q = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const [r, setR] = useState(!!q?.matches);
  useEffect(() => { if (!q) return undefined; const on = () => setR(q.matches); q.addEventListener?.("change", on); return () => q.removeEventListener?.("change", on); }, [q]);
  return r;
}

const pctText = (v) => (v == null ? "—" : `${v}%`);

function BrandMark({ node, size = 44 }) {
  const [bad, setBad] = useState(false);
  return (
    <span className="hb-borb" style={{ width: size, height: size }}>
      {node.logo && !bad ? <img src={node.logo} alt="" loading="lazy" onError={() => setBad(true)} /> : <span className="relative z-[1] text-[15px] font-semibold text-white">{String(node.label || "?")[0]}</span>}
    </span>
  );
}

function ClientLogo({ node }) {
  const [bad, setBad] = useState(false);
  const ring = { boxShadow: `0 0 0 1px ${node.color}88, 0 0 12px -3px ${node.color}` };
  if (node.logo && !bad) return <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-md bg-white/90 p-0.5" style={ring}><img src={node.logo} alt="" className="h-full w-full object-contain" loading="lazy" onError={() => setBad(true)} /></span>;
  return <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[12px] font-semibold text-white" style={{ ...ring, background: `${node.color}33` }}>{String(node.label || "?").trim()[0]}</span>;
}

// Compact "Connected: brain ✓ / sync ✓" line. Brain = BrainFacts have arrived from the client's app; sync = profile has_sync.
function ConnectedLine({ c }) {
  const mark = (ok, part) => (ok ? <span className="text-[#3ddc84]">✓</span> : part ? <span className="text-[#ffaa00]">~</span> : <span className="opacity-60">✗</span>);
  return (
    <span className="mono block truncate text-[9px] text-[var(--ink-s)]" data-testid="client-connected" title={`Brain ${c.brain ? "connected (facts received)" : "not connected yet"} · sync ${c.sync}`}>
      brain {mark(c.brain)} / sync {mark(c.sync === "yes", c.sync === "partial")}
    </span>
  );
}

function ClientChip({ node, reg, dim }) {
  return (
    <Link ref={reg(node.id)} data-node={node.id} to={`/clients/${node.clientId}`} className={`shp-card hb-chip flex items-center gap-2.5 ${dim ? "dim" : ""}`} title={`${node.label}: open client`}>
      <span className="shp-tint" style={{ background: node.color, boxShadow: `0 0 8px ${node.color}` }} />
      <ClientLogo node={node} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-medium text-white">{node.label}</span>
        <span className="mono block truncate text-[9.5px] text-[var(--ink-s)]">{node.brain ? `brain ${pctText(node.brain.score)} · ${node.brain.answered}/${node.brain.total}` : node.hasApp ? "app · brain not reporting yet" : "no app brain yet"}</span>
        {node.connected && node.connected.apps > 0 && <ConnectedLine c={node.connected} />}
      </span>
    </Link>
  );
}

function RootCard({ node, brands, reg, onOpen, reduced, compact }) {
  const b = node.brand;
  const planets = brands.map((x, i) => {
    const a = (-90 + (360 / Math.max(1, brands.length)) * i) * (Math.PI / 180);
    return { id: x.id, color: x.theme.primary, label: x.label, left: `${50 + 50 * Math.cos(a)}%`, top: `${50 + 50 * Math.sin(a)}%` };
  });
  return (
    <div ref={reg(ROOT_ID)} data-node={ROOT_ID} className="shp-card shp-clear hb-root" data-testid="house-root">
      <p className="eyebrow flex items-center justify-center gap-1.5 !text-[9.5px]"><Orbit className="h-3 w-3 text-[#ff6a00]" />Mother brand</p>
      <div className="hb-orbit" style={compact ? { maxWidth: 210 } : null}>
        <div className="hb-ring" style={reduced ? { animation: "none" } : { "--dur": "80s" }} aria-hidden="true">
          {planets.map((p) => <span key={p.id} className="hb-planet" style={{ left: p.left, top: p.top, "--c": p.color }} title={p.label}><i /></span>)}
        </div>
        <div className="hb-ring r2" style={reduced ? { animation: "none" } : { "--dur": "120s" }} aria-hidden="true" />
        <div ref={reg("slot:claude")} className="hb-core" />
      </div>
      <button type="button" onClick={onOpen} className="group mx-auto block text-center" aria-label="Open the Interstellar Strategies dashboard">
        <span className="block text-[20px] font-semibold tracking-[-0.03em] text-white">{node.label}</span>
        <span className="mt-0.5 block text-[12px] text-[var(--ink-m)]">{(b && b.tagline) || "The mother brand"} · {node.sub}</span>
      </button>
      <div className="mt-3 grid grid-cols-3 gap-2 text-left">
        {[["Brands", node.metrics.brands], ["Clients", node.metrics.clients], ["Brains in", `${node.rollup.reporting + node.brandsBrain.reporting}`]].map(([l, v]) => (
          <div key={l} className="min-w-0 rounded-lg border border-[var(--hair-d)] bg-black/20 px-2.5 py-2"><p className="mono text-[16px] leading-none text-white">{v}</p><p className="mono mt-1 truncate text-[8.5px] uppercase tracking-[.12em] text-[var(--ink-s)]">{l}</p></div>
        ))}
      </div>
      <button type="button" onClick={onOpen} className="btn-d mt-3 w-full">Interstellar dashboard <ChevronRight className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function BrandCard({ node, reg, onOpen, onHover, dim }) {
  const m = node.metrics;
  return (
    <button
      type="button" ref={reg(node.id)} data-node={node.id} onClick={onOpen}
      onMouseEnter={(e) => onHover(node, e.currentTarget)} onMouseLeave={() => onHover(null)} onFocus={(e) => onHover(node, e.currentTarget)} onBlur={() => onHover(null)}
      className={`shp-card hb-brand ${dim ? "dim" : ""}`} style={themeVars(node.brand)} aria-label={`${node.label}: open brand dashboard`} data-testid={`brand-card-${node.slug}`}
    >
      <div className="flex items-center gap-3">
        <BrandMark node={node} />
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2"><span className="truncate text-[15px] font-semibold tracking-[-0.02em] text-white">{node.label}</span><span className="mono shrink-0 rounded-full px-1.5 py-px text-[9px] uppercase tracking-[.1em]" style={{ color: node.color, boxShadow: `inset 0 0 0 1px ${node.color}66` }}>{STATUS_LABEL[node.status] || node.status}</span></p>
          <p className="truncate text-[11.5px] text-[var(--ink-m)]">{node.sub}</p>
          <p className="mono mt-0.5 truncate text-[9.5px] text-[var(--ink-s)]">{m.clients} {m.clients === 1 ? "client" : "clients"} · brain {node.own.reporting ? pctText(node.own.score) : "not reporting"} · {m.templateFeatures} template features</p>
        </div>
      </div>
    </button>
  );
}

function BrandPopup({ hover, onKeep, onLeave }) {
  if (!hover) return null;
  const { node, rect } = hover;
  const left = Math.max(12, Math.min(rect.left, window.innerWidth - 302));
  const below = rect.bottom + 10 + 230 < window.innerHeight;
  const tpl = node.brand.template_app_id;
  return (
    <div className="hb-pop" role="tooltip" style={{ ...themeVars(node.brand), left, top: below ? rect.bottom + 8 : Math.max(12, rect.top - 238), pointerEvents: "auto" }} onMouseEnter={onKeep} onMouseLeave={onLeave} data-testid="brand-popup">
      <div className="flex items-center gap-2.5">
        <BrandMark node={node} size={34} />
        <div className="min-w-0"><p className="truncate text-[14.5px] font-semibold text-white">{node.label}</p><p className="truncate text-[11.5px]" style={{ color: node.color }}>{node.tagline || node.sub}</p></div>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2.5 text-[12px]">
        <div className="col-span-2"><dt className="k">Niche</dt><dd className="mt-0.5 text-white/90">{node.sub || "—"}</dd></div>
        <div><dt className="k">Status</dt><dd className="mt-0.5 text-white/90">{STATUS_LABEL[node.status] || node.status}</dd></div>
        <div><dt className="k">Clients</dt><dd className="mt-0.5 text-white/90">{node.metrics.clients ? node.metrics.clients : "No clients yet"}</dd></div>
        <div><dt className="k">Brand brain</dt><dd className="mt-0.5 text-white/90">{node.own.reporting ? `${pctText(node.own.score)} · ${node.own.factsActive} facts` : "Not reporting yet"}</dd></div>
        <div><dt className="k">Client brains</dt><dd className="mt-0.5 text-white/90">{node.rollup.reporting ? `${pctText(node.rollup.score)} · ${node.rollup.reporting} reporting` : "None yet"}</dd></div>
      </dl>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-2.5">
        {tpl ? <a href={templateAppUrl(tpl)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12px] text-white/75 hover:text-white">Template app <ExternalLink className="h-3 w-3" /></a> : <span className="text-[12px] text-white/40">No template app yet</span>}
        <span className="mono text-[9.5px] uppercase tracking-[.12em] text-white/45">click to open</span>
      </div>
    </div>
  );
}

export default function BrandsPage() {
  const { data, isLoading, error } = useHouseData();
  const navigate = useNavigate();
  const reduced = usePrefersReducedMotion();
  const [fillRef, height] = useFillHeight();
  const stageRef = useRef(null);
  const scrollRef = useRef(null);
  const contentRef = useRef(null);
  const canvasApi = useRef(null);
  const els = useRef({});
  const [anchors, setAnchors] = useState(null);
  const [width, setWidth] = useState(1280);
  const [stageH, setStageH] = useState(640);
  const [hover, setHover] = useState(null);
  const [params, setParams] = useSearchParams();
  const adding = params.get("add") === "1";
  const setAdding = (on) => { const next = new URLSearchParams(params); if (on) next.set("add", "1"); else next.delete("add"); setParams(next, { replace: true }); };
  const leaveT = useRef(0);

  const house = useMemo(() => (data ? buildHouse(data) : null), [data]);
  const mode = width >= 1100 ? "cols" : "stack";
  const density = width < 700 ? 0.5 : 1;

  useEffect(() => {
    const el = stageRef.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => { setWidth(Math.round(e.contentRect.width)); setStageH(Math.round(e.contentRect.height)); });
    ro.observe(el);
    return () => ro.disconnect();
  }, [isLoading]);

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
  useLayoutEffect(() => { measure(); }, [measure, house, mode, width]);
  useEffect(() => {
    const c = contentRef.current;
    if (!c) return undefined;
    const ro = new ResizeObserver(() => measure());
    ro.observe(c);
    document.fonts?.ready?.then(measure).catch(() => {});
    return () => ro.disconnect();
  }, [measure, isLoading]);
  // The root column is sticky: keep the flow layer glued to it while the lists scroll.
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return undefined;
    let raf = 0; let idle = 0;
    const on = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => { const out = read(); if (out) canvasApi.current?.setAnchors(out); });
      clearTimeout(idle);
      idle = setTimeout(measure, 180);
      setHover(null);
    };
    sc.addEventListener("scroll", on, { passive: true });
    return () => { sc.removeEventListener("scroll", on); cancelAnimationFrame(raf); clearTimeout(idle); };
  }, [read, measure, isLoading]);

  const flowEdges = useMemo(() => {
    if (!house) return [];
    const list = mode === "stack" ? house.edges.filter((e) => e.parent !== ROOT_ID || e.kind === "brand") : house.edges;
    return orientEdges(list, anchors, mode);
  }, [house, anchors, mode]);

  // Hover lights the brand's branch.
  const focusIds = useMemo(() => {
    if (!hover || !house) return null;
    const id = hover.node.id;
    const S = new Set([ROOT_ID, id]);
    house.edges.forEach((e) => { if (e.parent === id) S.add(e.child); });
    return S;
  }, [hover, house]);

  const onHover = (node, el) => {
    clearTimeout(leaveT.current);
    if (!node) { leaveT.current = setTimeout(() => setHover(null), 160); return; }
    if (mode === "stack" && !window.matchMedia?.("(hover: hover)").matches) return; // touch: tap opens the dashboard
    setHover({ node, rect: el.getBoundingClientRect() });
  };
  const open = (slug) => navigate(`/brands/${slug}`);

  if (isLoading || !house) {
    return (
      <div ref={fillRef} className="agx shp grid place-items-center" style={{ height: height || "calc(100dvh - 48px)" }}>
        {error ? <p className="text-[13px] text-[#ff8a7f]">Couldn&apos;t load the House of Brands: {String(error.message || error)}</p> : <div className="flex items-center gap-3 text-[13px] text-[var(--ink-m)]"><Spinner size={18} />Lighting up the house…</div>}
      </div>
    );
  }

  const N = house.nodes;
  const rootNode = house.rootNode;
  const brandNodes = house.brands.map((b) => N[`brand:${b.id}`]).filter(Boolean);
  const childrenOf = (pid) => Object.values(N).filter((n) => n.type === "client" && n.parent === pid).sort((a, b) => (b.brain ? 1 : 0) - (a.brain ? 1 : 0) || String(a.label).localeCompare(String(b.label)));
  const direct = childrenOf(ROOT_ID);
  const isDim = (id) => (focusIds ? !focusIds.has(id) : false);
  const rootSlug = (house.root && house.root.slug) || "interstellar";
  const S = house.summary;

  const addCard = (
    <button type="button" onClick={() => setAdding(true)} className="shp-card hb-add flex items-center gap-3 px-3.5 py-3" data-testid="add-brand-card">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-dashed border-white/25 text-white/70"><Plus className="h-4 w-4" /></span>
      <span className="min-w-0 text-left"><span className="block text-[13px] font-medium text-white">Add a brand</span><span className="block text-[11px] text-[var(--ink-s)]">A new niche, same 45-day rebuild</span></span>
    </button>
  );
  const brandRow = (n) => {
    const kids = childrenOf(n.id);
    const list = kids.length ? kids.map((c) => <ClientChip key={c.id} node={c} reg={reg} dim={isDim(c.id)} />) : <p className="hb-ghost" style={{ borderColor: `${n.color}33` }}>No clients yet. Set a client&apos;s brand to {n.label} in its client form.</p>;
    return mode === "cols" ? (
      <div key={n.id} className="hb-brow">
        <BrandCard node={n} reg={reg} onOpen={() => open(n.slug)} onHover={onHover} dim={isDim(n.id)} />
        <div className="hb-bclients">{list}</div>
      </div>
    ) : (
      <div key={n.id} className="hb-bgroup">
        <BrandCard node={n} reg={reg} onOpen={() => open(n.slug)} onHover={onHover} dim={isDim(n.id)} />
        <div className="hb-bclients">{list}</div>
      </div>
    );
  };
  const directList = direct.length ? direct.map((c) => <ClientChip key={c.id} node={c} reg={reg} dim={isDim(c.id)} />) : <p className="hb-ghost">No Interstellar direct clients yet.</p>;

  return (
    <div ref={fillRef} className="agx shp flex flex-col overflow-hidden" style={{ height: height || "calc(100dvh - 48px)" }} data-testid="brands-view">
      <header className="relative z-20 border-b border-[var(--hair-d)] px-4 pb-3 pt-3 md:px-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
          <div className="min-w-0">
            <h1 className="text-[24px] font-semibold leading-[0.95] tracking-[-0.045em] text-white sm:text-[28px] md:text-[30px]">House <span className="text-[#ff3c00]">/of Brands</span></h1>
            <p className="mt-1.5 flex items-start gap-2 text-[12.5px] leading-snug text-[var(--ink-d)]" data-testid="brands-summary">
              <span className="live-dot mt-[5px] shrink-0" />
              <span>{S.brands} {S.brands === 1 ? "brand" : "brands"} under Interstellar · {S.clients} active clients ({S.direct} direct) · {S.reporting + S.brandsReporting} {S.reporting + S.brandsReporting === 1 ? "brain" : "brains"} reporting</span>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link to={`/brands/${rootSlug}`} className="btn-d"><LayoutGrid className="h-3.5 w-3.5" />Dashboards</Link>
            <button type="button" className="btn-d" onClick={() => setAdding(true)} data-testid="add-brand-button"><Plus className="h-3.5 w-3.5" />Add brand</button>
          </div>
        </div>
        <div className="mono mt-2 hidden flex-wrap items-center gap-x-3 gap-y-1 text-[9.5px] uppercase tracking-[.12em] text-[var(--ink-s)] sm:flex">
          <span className="flex items-center gap-1.5"><i className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "#ff6a00", boxShadow: "0 0 6px #ff6a00" }} />brains flowing up (brand color)</span>
          <span className="flex items-center gap-1.5"><i className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: TEMPLATE_COLOR, boxShadow: `0 0 6px ${TEMPLATE_COLOR}` }} />template flowing down</span>
          <span className="flex items-center gap-1.5"><Brain className="h-3 w-3" style={{ color: BRAIN_COLOR }} />client app → brand → Møthership</span>
          <span className="flex items-center gap-1.5"><Users className="h-3 w-3" />hover a brand · click to open</span>
        </div>
      </header>

      <div ref={stageRef} className="shp-stage relative min-h-0 flex-1">
        <FlowCanvas ref={canvasApi} anchors={anchors} edges={flowEdges} scrollRef={scrollRef} mode={mode} lit={null} focusIds={focusIds} hoverEdge={null} reduced={reduced} density={density} />
        <div ref={scrollRef} className="shp-scroll absolute inset-0 overflow-y-auto overflow-x-hidden">
          <div ref={contentRef} className="relative" style={{ "--stage-h": `${stageH}px` }}>
            {mode === "cols" ? (
              <div className="hb-cols">
                <div className="hb-direct">
                  <p className="hb-label">Interstellar direct · {direct.length}</p>
                  {directList}
                </div>
                <div className="hb-sticky"><RootCard node={rootNode} brands={brandNodes} reg={reg} onOpen={() => open(rootSlug)} reduced={reduced} /></div>
                <div className="hb-brands">
                  <div className="hb-brow"><p className="hb-label">Brands · {brandNodes.length}</p><p className="hb-label">Their clients</p></div>
                  {brandNodes.map(brandRow)}
                  <div className="hb-brow">{addCard}<span /></div>
                </div>
              </div>
            ) : (
              <div className="hb-stack">
                <RootCard node={rootNode} brands={brandNodes} reg={reg} onOpen={() => open(rootSlug)} reduced={reduced} compact />
                <p className="hb-label">Brands · {brandNodes.length}</p>
                {brandNodes.map(brandRow)}
                {addCard}
                <p className="hb-label">Interstellar direct · {direct.length}</p>
                <div className="hb-direct">{directList}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <BrandPopup hover={hover} onKeep={() => clearTimeout(leaveT.current)} onLeave={() => onHover(null)} />
      <AddBrandDialog open={adding} brands={(data && data.brands) || []} onClose={() => setAdding(false)} onCreated={(b) => b?.slug && navigate(`/brands/${b.slug}`)} />
    </div>
  );
}
