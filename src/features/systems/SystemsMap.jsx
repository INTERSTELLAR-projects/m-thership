import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Plus, Minus, Maximize2 } from "lucide-react";
import Starfield from "@/features/agents/Starfield";

// "How things connect": apps as nodes (Møthership at the core, each client's apps side by side), links as arcs labelled
// with the secret NAME / mechanism that guards them. Same deep-space visual family as the Agent Constellation (.agx/.cst).

const MOTHERSHIP = "69d80bb06c5ad07a795df54e";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const short = (s, n) => { const t = String(s || ""); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };

export const LINK_STATUS = {
  active: { label: "Active", color: "rgba(255,138,61,.85)", dash: "" },
  planned: { label: "Planned", color: "rgba(244,239,233,.45)", dash: "6 6" },
  not_configured: { label: "Not configured", color: "rgba(244,239,233,.3)", dash: "2 6" },
  broken: { label: "Broken", color: "rgba(255,68,51,.85)", dash: "4 4" },
  unknown: { label: "Unknown", color: "rgba(255,170,0,.6)", dash: "1 5" },
};

const ROLE_LABEL = { mothership: "MØTHERSHIP", command: "COMMAND", website: "WEBSITE", website_command: "SITE + COMMAND", funnel: "FUNNEL", brand_template: "BRAND APP", personal: "PERSONAL", agent: "AGENT", other: "APP" };

function layout(apps, links, onlyConnected) {
  const linked = new Set(links.flatMap((l) => [l.from_app_id, l.to_app_id]));
  const shown = apps.filter((a) => a.app_id === MOTHERSHIP || !onlyConnected || linked.has(a.app_id));
  const groups = new Map();
  for (const a of shown) {
    if (a.app_id === MOTHERSHIP) continue;
    const g = a.client_name || (a.role === "brand_template" ? "DIALD (brand)" : a.name);
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(a);
  }
  const order = [...groups.entries()].sort((x, y) => {
    const lx = x[1].some((a) => linked.has(a.app_id)) ? 0 : 1, ly = y[1].some((a) => linked.has(a.app_id)) ? 0 : 1;
    return lx - ly || x[0].localeCompare(y[0]);
  });
  const nodes = [];
  const m = shown.find((a) => a.app_id === MOTHERSHIP);
  if (m) nodes.push({ id: m.app_id, app: m, x: 0, y: 0, r: 30, core: true });
  const n = order.length || 1;
  const R = Math.max(300, n * 34);
  order.forEach(([group, list], i) => {
    const ang = -Math.PI / 2 + (i / n) * Math.PI * 2;
    const cx = Math.cos(ang) * R, cy = Math.sin(ang) * R;
    // Spread a client's apps along the tangent so the website and its command app sit side by side.
    const tx = -Math.sin(ang), ty = Math.cos(ang);
    const sorted = [...list].sort((a, b) => (a.role === "website" ? -1 : 1) - (b.role === "website" ? -1 : 1));
    sorted.forEach((a, j) => {
      const off = (j - (sorted.length - 1) / 2) * 58;
      const rOut = sorted.length > 2 ? (j % 2) * 40 : 0;
      nodes.push({ id: a.app_id, app: a, group, x: cx + tx * off + Math.cos(ang) * rOut, y: cy + ty * off + Math.sin(ang) * rOut, r: a.secret_names?.length ? 11 + Math.min(6, a.secret_names.length) : 9, ang });
    });
  });
  return { nodes, R };
}

export default function SystemsMap({ apps, links, keys, selected, onSelect, statusFilter, onlyConnected, query, height = 640 }) {
  const shownLinks = useMemo(() => links.filter((l) => !statusFilter.size || statusFilter.has(l.status || "unknown")), [links, statusFilter]);
  const { nodes, R } = useMemo(() => layout(apps, shownLinks, onlyConnected), [apps, shownLinks, onlyConnected]);
  const byId = useMemo(() => new Map(nodes.map((n) => [n.id, n])), [nodes]);
  const [view, setView] = useState({ k: 0, x: 0, y: 0 });
  const [hover, setHover] = useState(null);
  const drag = useRef(null);
  const svgRef = useRef(null);
  const [width, setWidth] = useState(900);
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.clientWidth || 900);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const fitK = useMemo(() => clamp(Math.min((height - 80) / (2 * R + 200), (width - 40) / (2 * R + 320)), 0.22, 1.2), [R, height, width]);
  const k = view.k || fitK;
  const q = String(query || "").trim().toLowerCase();

  const keyCount = useMemo(() => { const m = new Map(); for (const kk of keys) if (kk.presence !== "referenced_not_set") m.set(kk.app_id, (m.get(kk.app_id) || 0) + 1); return m; }, [keys]);
  const focus = hover || selected;
  const touching = useMemo(() => {
    if (!focus) return null;
    const ids = new Set([focus]);
    for (const l of shownLinks) { if (l.from_app_id === focus) ids.add(l.to_app_id); if (l.to_app_id === focus) ids.add(l.from_app_id); }
    return ids;
  }, [focus, shownLinks]);
  const matchQ = useCallback((a) => !q || `${a.name} ${a.client_name || ""} ${(a.secret_names || []).join(" ")}`.toLowerCase().includes(q), [q]);

  // Parallel links between the same two apps bend by a different amount so each label stays readable.
  const edges = useMemo(() => {
    const seen = new Map();
    return shownLinks.map((l) => {
      const a = byId.get(l.from_app_id), b = byId.get(l.to_app_id);
      if (!a || !b) return null;
      const pair = [l.from_app_id, l.to_app_id].sort().join("|");
      const idx = seen.get(pair) || 0; seen.set(pair, idx + 1);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const bend = (idx % 2 ? -1 : 1) * (18 + 26 * Math.ceil(idx / 2)) + (idx === 0 ? -8 : 0);
      const cx = mx + (-dy / len) * bend, cy = my + (dx / len) * bend;
      const lx = 0.25 * a.x + 0.5 * cx + 0.25 * b.x, ly = 0.25 * a.y + 0.5 * cy + 0.25 * b.y;
      return { l, a, b, d: `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`, lx, ly };
    }).filter(Boolean);
  }, [shownLinks, byId]);
  const syncCount = edges.filter((e) => /COMMAND_SYSTEM_SYNC_KEY/.test(e.l.secret_name || "") && /brain/i.test(e.l.mechanism || "")).length;

  const onWheel = (e) => {
    const nk = clamp(k * (e.deltaY < 0 ? 1.12 : 0.89), 0.25, 3);
    setView((v) => ({ ...v, k: nk }));
  };
  const onDown = (e) => { if (e.target.closest?.("[data-node]")) return; drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y }; e.currentTarget.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => { if (!drag.current) return; setView((v) => ({ ...v, x: drag.current.vx + (e.clientX - drag.current.x), y: drag.current.vy + (e.clientY - drag.current.y) })); };
  const onUp = () => { drag.current = null; };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--hair-d)]" style={{ height }}>
      <Starfield offset={{ x: view.x, y: view.y }} />
      <svg ref={svgRef} className="cst absolute inset-0 h-full w-full" role="img" aria-label="Map of how Justin's apps connect"
        onWheel={onWheel} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerLeave={onUp}
        onClick={(e) => { if (!e.target.closest?.("[data-node]") && !e.target.closest?.("[data-edge]")) onSelect(null); }}>
        <defs>
          <radialGradient id="sys-glow"><stop offset="0" stopColor="#ff6a00" stopOpacity=".45" /><stop offset=".45" stopColor="#ff3c00" stopOpacity=".12" /><stop offset="1" stopColor="#ff3c00" stopOpacity="0" /></radialGradient>
          <radialGradient id="sys-core" cx=".42" cy=".38"><stop offset="0" stopColor="#ffffff" /><stop offset=".28" stopColor="#ffd9bd" /><stop offset=".62" stopColor="#ff6a00" /><stop offset="1" stopColor="#5c1500" /></radialGradient>
          <radialGradient id="sys-app" cx=".4" cy=".35"><stop offset="0" stopColor="#ffe3cc" /><stop offset=".5" stopColor="#ff6a00" /><stop offset="1" stopColor="#7a1d00" /></radialGradient>
          <linearGradient id="sys-flame" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#ff3c00" /><stop offset=".55" stopColor="#ff6a00" /><stop offset="1" stopColor="#ffaa00" /></linearGradient>
          <marker id="sys-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="rgba(255,150,80,.8)" /></marker>
        </defs>
        <g transform={`translate(${width / 2 + view.x},${height / 2 + view.y}) scale(${k})`}>
          <circle r={R} fill="none" stroke="rgba(255,255,255,.05)" strokeDasharray="2 8" vectorEffect="non-scaling-stroke" />
          {edges.map((e) => {
            const st = LINK_STATUS[e.l.status] || LINK_STATUS.unknown;
            const on = touching ? touching.has(e.l.from_app_id) && touching.has(e.l.to_app_id) && (e.l.from_app_id === focus || e.l.to_app_id === focus) : false;
            const dim = touching && !on;
            const isSync = /brain/i.test(e.l.mechanism || "") && /COMMAND_SYSTEM_SYNC_KEY/.test(e.l.secret_name || "");
            const showLabel = on || (!touching && !isSync && k > 0.5);
            const label = e.l.secret_name || "public feed";
            return (
              <g key={e.l.id} data-edge="1" opacity={dim ? 0.12 : 1} style={{ transition: "opacity .25s" }}>
                <path d={e.d} fill="none" stroke={st.color} strokeWidth={on ? 2 : 1.2} strokeDasharray={st.dash} vectorEffect="non-scaling-stroke"
                  markerEnd={e.l.direction === "pull" ? undefined : "url(#sys-arrow)"} markerStart={e.l.direction === "pull" || e.l.direction === "two_way" ? "url(#sys-arrow)" : undefined} />
                {showLabel ? (
                  <text x={e.lx} y={e.ly} textAnchor="middle" className="lbl branch" style={{ fontSize: 9.5 / clamp(k, 0.55, 1.5), textTransform: "none" }}>
                    {short(label, 34)}
                  </text>
                ) : null}
              </g>
            );
          })}
          {nodes.map((n) => {
            const a = n.app;
            const sel = selected === n.id;
            const dim = (touching && !touching.has(n.id)) || (q && !matchQ(a));
            const ls = 1 / clamp(k, 0.55, 1.5);
            const count = keyCount.get(n.id) || 0;
            return (
              <g key={n.id} data-node="1" className={`node${sel ? " sel" : ""}${dim ? " dim" : ""}`} transform={`translate(${n.x},${n.y})`}
                onPointerEnter={() => setHover(n.id)} onPointerLeave={() => setHover(null)} onClick={() => onSelect(n.id)}
                role="button" tabIndex={0} aria-label={`${a.name}: ${count} secrets`} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onSelect(n.id); }}>
                {n.core ? (
                  <>
                    <circle r={n.r * 3} fill="url(#sys-glow)" className="breathe" />
                    <circle r={n.r + 18} fill="none" stroke="rgba(255,140,60,.28)" strokeDasharray="2 7" className="spin-slow" />
                    <circle r={n.r} fill="url(#sys-core)" />
                  </>
                ) : (
                  <>
                    <circle r={n.r * 2.3} fill="url(#sys-glow)" opacity=".55" />
                    <circle r={n.r} fill={a.role === "website" ? "#120d0b" : "url(#sys-app)"} stroke="url(#sys-flame)" strokeWidth="1.6" />
                    {a.role === "website" ? <circle r={n.r * 0.36} fill="#ff6a00" /> : null}
                  </>
                )}
                <circle r={n.r + 7} className="ring-h" />
                <circle r={n.r + 14} className="hit" />
                <text className={`lbl${n.core ? " dept" : ""}`} y={n.r + 18 * ls} textAnchor="middle" style={{ fontSize: (n.core ? 12 : 11) * ls, fontWeight: n.core ? 600 : 500 }}>{short(a.name, 30)}</text>
                <text className="lbl sub" y={n.r + 31 * ls} textAnchor="middle" style={{ fontSize: 9 * ls }}>{ROLE_LABEL[a.role] || "APP"}{count ? ` · ${count} KEY${count === 1 ? "" : "S"}` : ""}</text>
              </g>
            );
          })}
        </g>
      </svg>
      <div className="glass absolute bottom-3 right-3 z-20 flex flex-col overflow-hidden rounded-xl">
        <button type="button" aria-label="Zoom in" className="grid h-9 w-9 place-items-center text-[var(--ink-m)] hover:text-white" onClick={() => setView((v) => ({ ...v, k: clamp(k * 1.2, 0.25, 3) }))}><Plus className="h-4 w-4" /></button>
        <button type="button" aria-label="Zoom out" className="grid h-9 w-9 place-items-center border-t border-[var(--hair-d)] text-[var(--ink-m)] hover:text-white" onClick={() => setView((v) => ({ ...v, k: clamp(k / 1.2, 0.25, 3) }))}><Minus className="h-4 w-4" /></button>
        <button type="button" aria-label="Fit" className="grid h-9 w-9 place-items-center border-t border-[var(--hair-d)] text-[var(--ink-m)] hover:text-white" onClick={() => setView({ k: 0, x: 0, y: 0 })}><Maximize2 className="h-4 w-4" /></button>
      </div>
      <div className="glass pointer-events-none absolute bottom-3 left-3 z-20 hidden rounded-xl px-3.5 py-3 sm:block">
        <p className="eyebrow mb-2 !text-[9px]">Links</p>
        <ul className="space-y-1.5 text-[11px] text-[var(--ink-m)]">
          {Object.entries(LINK_STATUS).map(([s, m]) => (
            <li key={s} className="flex items-center gap-2"><svg width="26" height="6" aria-hidden="true"><line x1="0" y1="3" x2="26" y2="3" stroke={m.color} strokeWidth="2" strokeDasharray={m.dash} /></svg>{m.label}</li>
          ))}
          <li className="pt-0.5 text-[10px] text-[var(--ink-s)]">Solid core = command app · ring = website</li>
          {syncCount ? <li className="text-[10px] text-[var(--ink-s)]">{syncCount} brain-sync links share COMMAND_SYSTEM_SYNC_KEY (hover an app for labels)</li> : null}
        </ul>
      </div>
    </div>
  );
}
