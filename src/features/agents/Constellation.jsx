import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Plus, Minus, Maximize2 } from "lucide-react";
import Starfield from "./Starfield";
import { bbox, isRecent } from "./layout";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const K_MIN = 0.22, K_MAX = 3.2;

function curve(a, b) {
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  // Pull the control point slightly toward the origin so branches arc like a tree.
  const cx = mx * 0.9, cy = my * 0.9 + (b.y < a.y ? 10 : -10) * 0.4;
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
}

function short(s, n) { const t = String(s || ""); return t.length > n ? `${t.slice(0, n - 1)}…` : t; }

// Two lines of at most about `n` characters, breaking on spaces.
function wrap2(s, n) {
  const dot = String(s || "").split(" · ");
  if (dot.length === 2) return dot.map((l) => short(l, n + 2));
  const words = String(s || "").split(" ");
  const lines = [""];
  for (const w of words) {
    const cur = lines[lines.length - 1];
    if (!cur) lines[lines.length - 1] = w;
    else if ((cur + " " + w).length <= n || lines.length === 2) lines[lines.length - 1] = cur + " " + w;
    else lines.push(w);
  }
  return lines.map((l) => short(l, n + 2));
}

// Renders one node. Purely presentational; hit-testing is done by the parent through data-id.
function Node({ n, k, selected, dim, showLabel, query }) {
  const ls = 1 / clamp(k, 0.55, 1.5);
  const cls = `node${selected ? " sel" : ""}${dim ? " dim" : ""}`;
  if (n.type === "brain") {
    const r = n.r;
    return (
      <g className={cls} data-id={n.id} transform={`translate(${n.x},${n.y})`}>
        <circle r={r * 3.1} fill="url(#agx-brain-halo)" className="breathe" />
        <circle r={r + 22} fill="none" stroke="rgba(255,140,60,.28)" strokeDasharray="2 7" className="spin-slow" />
        <circle r={r + 38} fill="none" stroke="rgba(255,170,0,.12)" strokeDasharray="1 11" className="spin-rev" />
        <circle r={r} fill="url(#agx-brain-core)" />
        <circle r={r * 0.42} fill="#fff6ee" opacity=".9" />
        <circle r={r + 6} className="ring-h" />
        <circle r={r + 20} className="hit" />
        <text className="lbl dept" y={r + 30 * ls} textAnchor="middle" style={{ fontSize: 12 * ls }}>{String(n.label).toUpperCase()}</text>
        {n.sub ? <text className="lbl sub" y={r + 46 * ls} textAnchor="middle" style={{ fontSize: 10 * ls }}>{n.sub}</text> : null}
      </g>
    );
  }
  if (n.type === "ceo") {
    return (
      <g className={cls} data-id={n.id} transform={`translate(${n.x},${n.y})`}>
        <circle r={n.r * 2.6} fill="url(#agx-glow)" className="breathe" />
        <circle r={n.r + 7} fill="none" stroke="rgba(255,170,0,.55)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <polygon points={star(n.r * 0.95, n.r * 0.42, 5)} fill="url(#agx-ceo)" />
        <circle r={n.r + 11} className="ring-h" />
        <circle r={n.r + 14} className="hit" />
        <text className="lbl dept" y={-(n.r + 16)} textAnchor="middle" style={{ fontSize: 11 * ls }}>{String(n.label).toUpperCase()}</text>
        <text className="lbl sub" y={n.r + 22 * ls} textAnchor="middle" style={{ fontSize: 9.5 * ls }}>CEO AGENT · ASK ME</text>
      </g>
    );
  }
  if (n.type === "dept") {
    const c = n.counts || {};
    return (
      <g className={cls} data-id={n.id} transform={`translate(${n.x},${n.y})`}>
        <circle r={n.r * 2.4} fill="url(#agx-glow-soft)" />
        <circle r={n.r} fill="#120d0b" stroke="url(#agx-flame)" strokeWidth={n.big ? 2 : 1.6} />
        <circle r={n.r * 0.38} fill="#ff6a00" />
        <circle r={n.r + 6} className="ring-h" />
        <circle r={n.r + 16} className="hit" />
        <text className="lbl dept" y={n.r + (n.big ? 26 : 22) * ls} textAnchor="middle" style={{ fontSize: (n.big ? 14 : 11.5) * ls }}>{String(n.label).toUpperCase()}</text>
        <text className="lbl sub" y={n.r + (n.big ? 44 : 37) * ls} textAnchor="middle" style={{ fontSize: (n.big ? 11 : 9.5) * ls }}>
          {c.live || 0} live{c.paused ? ` · ${c.paused} paused` : ""}{c.planned ? ` · ${c.planned} planned` : ""}{c.broken ? ` · ${c.broken} broken` : ""}
        </text>
      </g>
    );
  }
  if (n.type === "branch") {
    return (
      <g className={cls} data-id={n.id} transform={`translate(${n.x},${n.y})`}>
        <circle r={n.r} fill="#0b0b10" stroke="rgba(255,150,80,.7)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        {showLabel ? <text className="lbl branch" y={-n.r - 8} textAnchor="middle" style={{ fontSize: 9.5 * ls }}>{n.label}</text> : null}
      </g>
    );
  }
  if (n.type === "client") {
    const pct = clamp(Number(n.brain?.completeness || 0), 0, 100);
    const R = n.r + 6;
    const circ = 2 * Math.PI * R;
    const c = n.counts || {};
    return (
      <g className={cls} data-id={n.id} transform={`translate(${n.x},${n.y})`}>
        <circle r={n.r * 2.4} fill="url(#agx-glow-soft)" />
        <circle r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <circle r={R} fill="none" stroke="url(#agx-flame)" strokeWidth="2" strokeDasharray={`${(circ * pct) / 100} ${circ}`} transform="rotate(-90)" strokeLinecap="round" />
        <circle r={n.r} fill="url(#agx-client)" />
        <circle r={n.r + 12} className="ring-h" />
        <circle r={n.r + 16} className="hit" />
        <text className="lbl" y={n.r + 52 * ls} textAnchor="middle" style={{ fontSize: 12 * ls, fontWeight: 600 }}>{short(n.label, 26)}</text>
        <text className="lbl sub" y={n.r + 67 * ls} textAnchor="middle" style={{ fontSize: 9.5 * ls }}>{c.live || 0} LIVE · {c.planned || 0} PLANNED · BRAIN {pct}%</text>
      </g>
    );
  }
  if (n.type === "sat") {
    return <circle className={cls} cx={n.x} cy={n.y} r={n.r} fill={n.status === "live" ? "#ff8a3d" : n.status === "broken" ? "#ff4433" : n.status === "paused" ? "#6f6863" : "rgba(255,255,255,.28)"} pointerEvents="none" />;
  }
  // agent
  const a = n.agent || {};
  const r = n.r;
  const recent = isRecent(a);
  const label = showLabel || selected || (query && String(a.name).toLowerCase().includes(query));
  return (
    <g className={cls} data-id={n.id} transform={`translate(${n.x},${n.y})`}>
      {a.status === "live" ? (
        <>
          <circle r={r * 3} fill="url(#agx-glow)" />
          {recent ? <circle r={r * 1.35} fill="none" stroke="rgba(255,170,0,.7)" strokeWidth="1" vectorEffect="non-scaling-stroke" className="pulse" /> : null}
          <circle r={r} fill="url(#agx-live)" />
        </>
      ) : a.status === "paused" ? (
        <circle r={r * 0.85} fill="#3a3532" stroke="#8d8680" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      ) : a.status === "broken" ? (
        <>
          <circle r={r * 2.4} fill="url(#agx-bad)" />
          <circle r={r + 2} fill="none" stroke="#ff4433" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
          <circle r={r * 0.5} fill="#ff4433" />
        </>
      ) : (
        <circle r={r} fill="rgba(5,6,10,.6)" stroke="rgba(255,255,255,.55)" strokeWidth="1" strokeDasharray="2 2.2" vectorEffect="non-scaling-stroke" />
      )}
      <circle r={r + 5} className="ring-h" />
      <circle r={Math.max(r + 9, 14)} className="hit" />
      {label ? (n.wrap ? (
        <text className="lbl" y={r + 15 * ls} textAnchor="middle" style={{ fontSize: 11 * ls }}>
          {wrap2(a.name, 20).map((line, i) => <tspan key={i} x="0" dy={i ? 13 * ls : 0}>{line}</tspan>)}
        </text>
      ) : <text className="lbl" y={r + 15 * ls} textAnchor="middle" style={{ fontSize: 11 * ls }}>{short(a.name, 28)}</text>) : null}
    </g>
  );
}

function star(R, r, n) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) {
    const ang = (Math.PI / n) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? R : r;
    pts.push(`${(Math.cos(ang) * rad).toFixed(2)},${(Math.sin(ang) * rad).toFixed(2)}`);
  }
  return pts.join(" ");
}

export default function Constellation({ graph, viewKey, selectedId, onSelect, onHover, isMatch, query = "", labelsAlways = false, padRight = 0 }) {
  const wrap = useRef(null);
  const svg = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [t, setT] = useState({ x: 0, y: 0, k: 1 });
  const [dragging, setDragging] = useState(false);
  const [instant, setInstant] = useState(true);
  const ptrs = useRef(new Map());
  const gesture = useRef(null);

  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);

  const fit = useCallback((animate = true) => {
    if (!size.w || !size.h) return;
    const b = bbox(graph.nodes);
    // Leave room for an open side panel on wide screens so the map centers in what is still visible.
    const w = size.w >= 768 ? Math.max(320, size.w - padRight) : size.w;
    const k = clamp(Math.min(w / b.w, size.h / b.h), K_MIN, 1.6);
    setInstant(!animate);
    setT({ k, x: w / 2 - (b.x + b.w / 2) * k, y: size.h / 2 - (b.y + b.h / 2) * k });
  }, [graph, size, padRight]);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Refit whenever the view changes or the canvas is resized.
  const lastFit = useRef("");
  useEffect(() => {
    if (!size.w) return;
    const key = `${viewKey}|${Math.round(size.w / 40)}|${Math.round(size.h / 40)}|${padRight}`;
    if (lastFit.current === key) return;
    const first = !lastFit.current;
    lastFit.current = key;
    fit(!first);
  }, [viewKey, size, fit]);

  const zoomAt = useCallback((factor, cx, cy) => {
    setInstant(true);
    setT((p) => {
      const k = clamp(p.k * factor, K_MIN, K_MAX);
      const f = k / p.k;
      return { k, x: cx - (cx - p.x) * f, y: cy - (cy - p.y) * f };
    });
  }, []);

  useEffect(() => {
    const el = svg.current;
    if (!el) return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0018));
      zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  const local = (e) => { const r = svg.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };

  const onPointerDown = (e) => {
    svg.current.setPointerCapture?.(e.pointerId);
    ptrs.current.set(e.pointerId, local(e));
    const target = e.target.closest?.("[data-id]");
    if (ptrs.current.size === 1) gesture.current = { start: local(e), moved: false, t0: t, id: target?.getAttribute("data-id") || null };
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      gesture.current = { pinch: true, d0: Math.hypot(a.x - b.x, a.y - b.y), t0: t, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, moved: true };
    }
  };
  const onPointerMove = (e) => {
    const p = local(e);
    if (!ptrs.current.has(e.pointerId)) {
      if (onHover) {
        const target = e.target.closest?.("[data-id]");
        const n = target ? byId.get(target.getAttribute("data-id")) : null;
        onHover(n && n.type !== "sat" ? n : null, e.clientX, e.clientY);
      }
      return;
    }
    ptrs.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    if (g.pinch && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const k = clamp(g.t0.k * (d / (g.d0 || 1)), K_MIN, K_MAX);
      const f = k / g.t0.k;
      setInstant(true);
      setT({ k, x: g.mid.x - (g.mid.x - g.t0.x) * f, y: g.mid.y - (g.mid.y - g.t0.y) * f });
      return;
    }
    const dx = p.x - g.start.x, dy = p.y - g.start.y;
    if (!g.moved && Math.hypot(dx, dy) > 4) { g.moved = true; setDragging(true); onHover && onHover(null); }
    if (g.moved) setT({ ...g.t0, x: g.t0.x + dx, y: g.t0.y + dy });
  };
  const onPointerUp = (e) => {
    ptrs.current.delete(e.pointerId);
    const g = gesture.current;
    if (ptrs.current.size === 0) {
      if (g && !g.moved && !g.pinch) {
        const n = g.id ? byId.get(g.id) : null;
        onSelect && onSelect(n || null);
      }
      gesture.current = null;
      setDragging(false);
    }
  };

  const center = () => ({ x: size.w / 2, y: size.h / 2 });
  const showAgentLabels = labelsAlways || t.k > 1.35;

  return (
    <div ref={wrap} className="absolute inset-0 overflow-hidden">
      <Starfield offset={{ x: t.x * 0.25, y: t.y * 0.25 }} />
      <svg
        ref={svg}
        className={`cst absolute inset-0 h-full w-full${dragging ? " dragging" : ""}${instant ? " instant" : ""}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => onHover && onHover(null)}
        role="img"
        aria-label="Agent constellation map"
      >
        <defs>
          <radialGradient id="agx-glow"><stop offset="0" stopColor="#ff6a00" stopOpacity=".55" /><stop offset=".45" stopColor="#ff3c00" stopOpacity=".16" /><stop offset="1" stopColor="#ff3c00" stopOpacity="0" /></radialGradient>
          <radialGradient id="agx-glow-soft"><stop offset="0" stopColor="#ff6a00" stopOpacity=".25" /><stop offset="1" stopColor="#ff3c00" stopOpacity="0" /></radialGradient>
          <radialGradient id="agx-bad"><stop offset="0" stopColor="#ff4433" stopOpacity=".45" /><stop offset="1" stopColor="#ff4433" stopOpacity="0" /></radialGradient>
          <radialGradient id="agx-live" cx=".38" cy=".35"><stop offset="0" stopColor="#fffaf4" /><stop offset=".45" stopColor="#ffd2ad" /><stop offset="1" stopColor="#ff6a00" /></radialGradient>
          <radialGradient id="agx-client" cx=".4" cy=".35"><stop offset="0" stopColor="#ffe3cc" /><stop offset=".5" stopColor="#ff6a00" /><stop offset="1" stopColor="#7a1d00" /></radialGradient>
          <radialGradient id="agx-ceo" cx=".45" cy=".35"><stop offset="0" stopColor="#ffffff" /><stop offset=".6" stopColor="#ffc199" /><stop offset="1" stopColor="#ff3c00" /></radialGradient>
          <radialGradient id="agx-brain-core" cx=".42" cy=".38"><stop offset="0" stopColor="#ffffff" /><stop offset=".28" stopColor="#ffd9bd" /><stop offset=".62" stopColor="#ff6a00" /><stop offset="1" stopColor="#5c1500" /></radialGradient>
          <radialGradient id="agx-brain-halo"><stop offset="0" stopColor="#ff6a00" stopOpacity=".42" /><stop offset=".35" stopColor="#ff3c00" stopOpacity=".14" /><stop offset="1" stopColor="#ff3c00" stopOpacity="0" /></radialGradient>
          <linearGradient id="agx-flame" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#ff3c00" /><stop offset=".55" stopColor="#ff6a00" /><stop offset="1" stopColor="#ffaa00" /></linearGradient>
        </defs>
        <g className="world" style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})` }}>
          <g key={viewKey} style={{ animation: "agx-in .5s cubic-bezier(.22,1,.36,1) both" }}>
            {graph.edges.map((e) => {
              const a = byId.get(e.from), b = byId.get(e.to);
              if (!a || !b) return null;
              const bAgent = b.agent;
              const dim = bAgent && isMatch && !isMatch(bAgent);
              const hi = selectedId && (e.to === selectedId || e.from === selectedId);
              return <path key={`${e.from}>${e.to}`} d={curve(a, b)} className={`edge${e.kind === "trunk" ? " trunk" : ""}${hi ? " hi" : ""}${dim ? " dim" : ""}`} />;
            })}
            {graph.nodes.map((n) => (
              <Node
                key={n.id}
                n={n}
                k={t.k}
                selected={selectedId === n.id}
                dim={!!(n.agent && isMatch && !isMatch(n.agent))}
                showLabel={n.showLabel || (n.type === "agent" && showAgentLabels) || (n.type === "branch" && t.k > 1)}
                query={query}
              />
            ))}
          </g>
        </g>
      </svg>
      <div className="absolute bottom-4 right-4 z-20 flex flex-col overflow-hidden rounded-xl glass">
        <button type="button" aria-label="Zoom in" className="grid h-9 w-9 place-items-center text-[var(--ink-m)] hover:text-white" onClick={() => { const c = center(); zoomAt(1.3, c.x, c.y); }}><Plus className="h-4 w-4" /></button>
        <button type="button" aria-label="Zoom out" className="grid h-9 w-9 place-items-center border-t border-[var(--hair-d)] text-[var(--ink-m)] hover:text-white" onClick={() => { const c = center(); zoomAt(1 / 1.3, c.x, c.y); }}><Minus className="h-4 w-4" /></button>
        <button type="button" aria-label="Fit to screen" className="grid h-9 w-9 place-items-center border-t border-[var(--hair-d)] text-[var(--ink-m)] hover:text-white" onClick={() => fit(true)}><Maximize2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}
