// Agent Constellation map (v2). Geometry lives in world space (SVG, one transform), labels live in screen space
// (HTML, constant size, placed collision-free every frame). Semantic zoom: departments far out, agent names when
// there is room, full detail close in. The camera is a JS tween so labels follow it frame by frame.
import { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { Plus, Minus, Maximize2 } from "lucide-react";
import Starfield from "./Starfield";
import { isRecent } from "./layout";
import { boxOf, placeLabels, textWidth, truncate, runs30, clearTextCache } from "./map/model";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const K_MAX = 4.5;
const LV_MID = 0.62, LV_NEAR = 1.45;
const FONT_NAME = '500 11px "JetBrains Mono", ui-monospace, monospace';
const FONT_SUB = '400 9px "JetBrains Mono", ui-monospace, monospace';
const FONT_DEPT = '600 11px "JetBrains Mono", ui-monospace, monospace';
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const STATUS_TXT = { live: "LIVE", paused: "PAUSED", planned: "PLANNED", broken: "BROKEN" };

function star(R, r, n) {
  const pts = [];
  for (let i = 0; i < n * 2; i++) { const ang = (Math.PI / n) * i - Math.PI / 2; const rad = i % 2 === 0 ? R : r; pts.push(`${(Math.cos(ang) * rad).toFixed(2)},${(Math.sin(ang) * rad).toFixed(2)}`); }
  return pts.join(" ");
}

// World-space node art. No text here: labels are drawn in the screen layer.
const Node = memo(function Node({ n, selected, dim, lit }) {
  const cls = `node${selected ? " sel" : ""}${dim ? " dim" : ""}${lit ? " lit" : ""}`;
  if (n.type === "brain") {
    const r = n.r;
    return (
      <g className={cls} data-id={n.id} transform={`translate(${n.x},${n.y})`}>
        <circle r={r * 2.3} fill="url(#agx-brain-halo)" className="breathe" />
        <circle r={r + 18} fill="none" stroke="rgba(255,140,60,.26)" strokeDasharray="2 7" className="spin-slow" />
        <circle r={r} fill="url(#agx-brain-core)" />
        <circle r={r * 0.4} fill="#fff6ee" opacity=".85" />
        <circle r={r + 6} className="ring-h" />
        <circle r={r + 14} className="hit" />
      </g>
    );
  }
  if (n.type === "ceo") {
    return (
      <g className={cls} data-id={n.id} transform={`translate(${n.x},${n.y})`}>
        <circle r={n.r * 1.9} fill="url(#agx-glow)" />
        <circle r={n.r + 6} fill="none" stroke="rgba(255,170,0,.55)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
        <polygon points={star(n.r * 0.95, n.r * 0.42, 5)} fill="url(#agx-ceo)" />
        <circle r={n.r + 10} className="ring-h" />
        <circle r={n.r + 12} className="hit" />
      </g>
    );
  }
  if (n.type === "dept") {
    return (
      <g className={cls} data-id={n.id} transform={`translate(${n.x},${n.y})`}>
        {n.clusterR ? <circle r={n.clusterR} className="cluster" /> : null}
        <circle r={n.r} fill="#120d0b" stroke="url(#agx-flame)" strokeWidth={1.6} vectorEffect="non-scaling-stroke" />
        <circle r={n.r * 0.38} fill="#ff6a00" />
        <circle r={n.r + 6} className="ring-h" />
        <circle r={n.r + 12} className="hit" />
      </g>
    );
  }
  if (n.type === "client") {
    const pct = clamp(Number(n.brain?.completeness || 0), 0, 100);
    const R = n.r + 6, circ = 2 * Math.PI * R;
    return (
      <g className={cls} data-id={n.id} transform={`translate(${n.x},${n.y})`}>
        <circle r={R} fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        <circle r={R} fill="none" stroke="url(#agx-flame)" strokeWidth="2" strokeDasharray={`${(circ * pct) / 100} ${circ}`} transform="rotate(-90)" strokeLinecap="round" />
        <circle r={n.r} fill="url(#agx-client)" />
        <circle r={n.r + 10} className="ring-h" />
        <circle r={n.r + 14} className="hit" />
      </g>
    );
  }
  if (n.type === "sat") {
    return <circle className={cls} cx={n.x} cy={n.y} r={n.r} fill={n.status === "live" ? "#ff8a3d" : n.status === "broken" ? "#ff4433" : n.status === "paused" ? "#6f6863" : "rgba(255,255,255,.28)"} pointerEvents="none" />;
  }
  if (n.type === "branch") return null;
  const a = n.agent || {};
  const r = n.r;
  return (
    <g className={cls} data-id={n.id} transform={`translate(${n.x},${n.y})`}>
      {a.status === "live" ? (
        <>
          <circle r={r * 1.9} fill="url(#agx-glow)" />
          {isRecent(a) ? <circle r={r * 1.35} fill="none" stroke="rgba(255,170,0,.6)" strokeWidth="1" vectorEffect="non-scaling-stroke" className="pulse" /> : null}
          <circle r={r} fill="url(#agx-live)" />
        </>
      ) : a.status === "paused" ? (
        <circle r={r * 0.9} fill="#3a3532" stroke="#8d8680" strokeWidth="1" vectorEffect="non-scaling-stroke" />
      ) : a.status === "broken" ? (
        <>
          <circle r={r + 2} fill="none" stroke="#ff4433" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
          <circle r={r * 0.55} fill="#ff4433" />
        </>
      ) : (
        <circle r={r} fill="rgba(5,6,10,.7)" stroke="rgba(255,255,255,.55)" strokeWidth="1" strokeDasharray="2 2.2" vectorEffect="non-scaling-stroke" />
      )}
      <circle r={r + 4} className="ring-h" />
      <circle r={Math.max(r + 8, 13)} className="hit" />
    </g>
  );
});

function linkPath(a, b, center) {
  // Same cluster: bow toward the cluster center. Across clusters: bow toward the brain.
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const c = center || { x: 0, y: 0 };
  const f = center ? 0.45 : 0.55;
  const cx = mx + (c.x - mx) * f, cy = my + (c.y - my) * f;
  return `M${a.x.toFixed(1)},${a.y.toFixed(1)} Q${cx.toFixed(1)},${cy.toFixed(1)} ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
}

const Constellation = forwardRef(function Constellation({
  graph, handoffs = [], viewKey, selectedId, onSelect, onHover, isMatch, query = "",
  pad = {}, mode = "explore", lit = null, litLinks = null, reduced = false, onCamera, focusIds = null, hideControls = false,
}, ref) {
  const wrap = useRef(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [t, setT] = useState({ x: 0, y: 0, k: 0.5 });
  const tRef = useRef(t);
  tRef.current = t;
  const anim = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [hoverId, setHoverId] = useState(null);
  const [fontsReady, setFontsReady] = useState(0);
  const ptrs = useRef(new Map());
  const gesture = useRef(null);
  const P = { left: pad.left || 0, right: pad.right || 0, top: pad.top || 0, bottom: pad.bottom || 0 };
  const padKey = `${P.left}|${P.right}|${P.top}|${P.bottom}`;

  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph]);
  const byKey = useMemo(() => new Map(graph.nodes.filter((n) => n.agent).map((n) => [n.agent.key, n])), [graph]);
  const clusterOf = useMemo(() => new Map((graph.clusters || []).map((c) => [c.key, c])), [graph]);

  useEffect(() => { document.fonts?.ready?.then(() => { clearTextCache(); setFontsReady((x) => x + 1); }).catch(() => {}); }, []);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setSize({ w: Math.round(e.contentRect.width), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const vis = useCallback(() => ({ x: P.left, y: P.top, w: Math.max(200, size.w - P.left - P.right), h: Math.max(200, size.h - P.top - P.bottom) }), [size, padKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const fitK = useMemo(() => {
    if (!size.w) return 0.5;
    const b = boxOf(graph.nodes.filter((n) => n.type !== "sat"), 70);
    const v = vis();
    return Math.min(v.w / b.w, v.h / b.h);
  }, [graph, size, vis]);
  const kMin = Math.max(0.08, fitK * 0.6);

  const animateTo = useCallback((target, dur = 750) => {
    cancelAnimationFrame(anim.current);
    if (reduced || dur <= 0) { setT(target); return; }
    const from = { ...tRef.current };
    const t0 = performance.now();
    // Interpolate the visible-center in world space and the zoom in log space, so the fly reads as one move.
    const v = vis();
    const cw = (s) => ({ x: (v.x + v.w / 2 - s.x) / s.k, y: (v.y + v.h / 2 - s.y) / s.k });
    const c0 = cw(from), c1 = cw(target);
    const lk0 = Math.log(from.k), lk1 = Math.log(target.k);
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = ease(p);
      const k = Math.exp(lk0 + (lk1 - lk0) * e);
      const cx = c0.x + (c1.x - c0.x) * e, cy = c0.y + (c1.y - c0.y) * e;
      setT({ k, x: v.x + v.w / 2 - cx * k, y: v.y + v.h / 2 - cy * k });
      if (p < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  }, [reduced, vis]);

  const boxTarget = useCallback((b, maxK = K_MAX) => {
    const v = vis();
    const k = clamp(Math.min(v.w / b.w, v.h / b.h), kMin, maxK);
    return { k, x: v.x + v.w / 2 - (b.x + b.w / 2) * k, y: v.y + v.h / 2 - (b.y + b.h / 2) * k };
  }, [vis, kMin]);

  const fit = useCallback((animate = true) => {
    const b = boxOf(graph.nodes.filter((n) => n.type !== "sat"), 70);
    animateTo(boxTarget(b, 1.6), animate ? 750 : 0);
  }, [graph, animateTo, boxTarget]);

  const clusterBox = useCallback((key) => {
    const c = clusterOf.get(key);
    if (!c) return null;
    const m = c.r + 70; // room for names around the outer ring
    return { x: c.x - m, y: c.y - m, w: m * 2, h: m * 2 };
  }, [clusterOf]);

  const zoomAt = useCallback((factor, cx, cy) => {
    cancelAnimationFrame(anim.current);
    setT((p) => { const k = clamp(p.k * factor, kMin, K_MAX); const f = k / p.k; return { k, x: cx - (cx - p.x) * f, y: cy - (cy - p.y) * f }; });
  }, [kMin]);

  useImperativeHandle(ref, () => ({
    fit: (animate = true) => fit(animate),
    flyToBox: (b, opts = {}) => animateTo(boxTarget(b, opts.maxK || K_MAX), opts.duration ?? 900),
    flyToCluster: (key, opts = {}) => { const b = clusterBox(key); if (b) animateTo(boxTarget(b, opts.maxK || 3.2), opts.duration ?? 900); },
    flyToNode: (id, opts = {}) => {
      const n = byId.get(id) || byKey.get(id);
      if (!n) return;
      const k = clamp(Math.max(tRef.current.k, opts.k || 2.3), kMin, K_MAX);
      const v = vis();
      animateTo({ k, x: v.x + v.w / 2 - n.x * k, y: v.y + v.h / 2 - n.y * k }, opts.duration ?? 850);
    },
    flyToNodes: (ids, opts = {}) => {
      const ns = ids.map((id) => byId.get(id) || byKey.get(id)).filter(Boolean);
      if (!ns.length) return;
      animateTo(boxTarget(boxOf(ns, opts.pad ?? 90), opts.maxK || 3), opts.duration ?? 900);
    },
    zoomBy: (f) => { const v = vis(); zoomAt(f, v.x + v.w / 2, v.y + v.h / 2); },
    get k() { return tRef.current.k; },
    get fitK() { return fitK; },
  }), [fit, animateTo, boxTarget, clusterBox, byId, byKey, kMin, vis, zoomAt, fitK]);

  // Fit on first size and whenever the view changes.
  const lastView = useRef("");
  useEffect(() => {
    if (!size.w) return;
    if (lastView.current === viewKey) return;
    const first = !lastView.current;
    lastView.current = viewKey;
    fit(!first);
  }, [viewKey, size.w, fit]);
  // A panel opening/closing or resizing: keep the same world point at the center of what is still visible.
  const lastPad = useRef(null);
  useEffect(() => {
    if (!size.w) return;
    const prev = lastPad.current;
    lastPad.current = { ...P, w: size.w, h: size.h };
    if (!prev) return;
    const dx = (P.left - P.right - (prev.left - prev.right)) / 2 + (size.w - prev.w) / 2;
    const dy = (P.top - P.bottom - (prev.top - prev.bottom)) / 2 + (size.h - prev.h) / 2;
    if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
    const cur = tRef.current;
    animateTo({ k: cur.k, x: cur.x + dx, y: cur.y + dy }, 450);
  }, [padKey, size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { onCamera && onCamera(t, fitK); }, [t, fitK]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- input
  useEffect(() => {
    const el = wrap.current;
    if (!el || mode !== "explore") return undefined;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0016));
      zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomAt, mode]);

  const local = (e) => { const r = wrap.current.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const targetNode = (e) => {
    const el = e.target.closest?.("[data-id],[data-label-id]");
    if (!el) return null;
    return byId.get(el.getAttribute("data-id") || el.getAttribute("data-label-id")) || null;
  };
  const onPointerDown = (e) => {
    if (mode !== "explore" || e.button > 0 || e.target.closest?.("[data-ui]")) return;
    ptrs.current.set(e.pointerId, local(e));
    const n = targetNode(e);
    if (ptrs.current.size === 1) gesture.current = { start: local(e), moved: false, t0: tRef.current, node: n, pointerType: e.pointerType };
    if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()];
      gesture.current = { pinch: true, d0: Math.hypot(a.x - b.x, a.y - b.y), t0: tRef.current, mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }, moved: true };
    }
  };
  const hoverRef = useRef(null);
  const hoverEmit = (n, e) => {
    const id = n && n.type !== "sat" ? n.id : null;
    if (id === hoverRef.current) return;
    hoverRef.current = id;
    setHoverId(id);
    onHover && onHover(id ? n : null, e?.clientX, e?.clientY);
  };
  const onPointerMove = (e) => {
    if (!ptrs.current.has(e.pointerId)) { if (e.pointerType === "mouse") hoverEmit(targetNode(e), e); return; }
    const p = local(e);
    ptrs.current.set(e.pointerId, p);
    const g = gesture.current;
    if (!g) return;
    if (g.pinch && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const k = clamp(g.t0.k * (d / (g.d0 || 1)), kMin, K_MAX);
      const f = k / g.t0.k;
      cancelAnimationFrame(anim.current);
      setT({ k, x: g.mid.x - (g.mid.x - g.t0.x) * f, y: g.mid.y - (g.mid.y - g.t0.y) * f });
      return;
    }
    const dx = p.x - g.start.x, dy = p.y - g.start.y;
    if (!g.moved && Math.hypot(dx, dy) > 5) { g.moved = true; setDragging(true); try { wrap.current.setPointerCapture?.(e.pointerId); } catch { /* ignore */ } hoverEmit(null); }
    if (g.moved) { cancelAnimationFrame(anim.current); setT({ ...g.t0, x: g.t0.x + dx, y: g.t0.y + dy }); }
  };
  const onPointerUp = (e) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.delete(e.pointerId);
    const g = gesture.current;
    if (ptrs.current.size === 0) {
      if (g && !g.moved && !g.pinch) onSelect && onSelect(g.node || null, { pointerType: g.pointerType });
      gesture.current = null;
      setDragging(false);
    }
  };
  const onKeyDown = (e) => {
    if (mode !== "explore") return;
    const v = vis();
    const c = { x: v.x + v.w / 2, y: v.y + v.h / 2 };
    const pan = (dx, dy) => { e.preventDefault(); e.stopPropagation(); const cur = tRef.current; animateTo({ ...cur, x: cur.x + dx, y: cur.y + dy }, 220); };
    if (e.key === "+" || e.key === "=") { e.preventDefault(); zoomAt(1.3, c.x, c.y); }
    else if (e.key === "-" || e.key === "_") { e.preventDefault(); zoomAt(1 / 1.3, c.x, c.y); }
    else if (e.key === "0") { e.preventDefault(); fit(true); }
    else if (e.shiftKey && e.key === "ArrowLeft") pan(90, 0);
    else if (e.shiftKey && e.key === "ArrowRight") pan(-90, 0);
    else if (e.key === "ArrowUp") pan(0, 90);
    else if (e.key === "ArrowDown") pan(0, -90);
  };

  // ---------------------------------------------------------------- focus + links
  const activeKey = (hoverId && byId.get(hoverId)?.agent?.key) || (selectedId && byId.get(selectedId)?.agent?.key) || null;
  const neighborhood = useMemo(() => {
    if (lit) return null;
    if (!activeKey) return null;
    const S = new Set([`a:${activeKey}`]);
    handoffs.forEach((h) => { if (h.from === activeKey) S.add(`a:${h.to}`); if (h.to === activeKey) S.add(`a:${h.from}`); });
    return S;
  }, [activeKey, handoffs, lit]);
  const shownLinks = useMemo(() => {
    if (litLinks) return handoffs.filter((h) => litLinks.has(h.id));
    if (!activeKey) return [];
    return handoffs.filter((h) => h.from === activeKey || h.to === activeKey);
  }, [handoffs, litLinks, activeKey]);
  const focusSet = lit || neighborhood || focusIds;
  const isDim = (n) => {
    if (n.type === "brain" || n.type === "sat") return false;
    if (focusSet) return n.type === "agent" || n.type === "ceo" ? !focusSet.has(n.id) : n.type === "dept" ? !(focusSet.has(n.id) || [...focusSet].some((id) => byId.get(id)?.dept === n.dept)) : false;
    return !!(n.agent && isMatch && !isMatch(n.agent));
  };

  // ---------------------------------------------------------------- labels (screen space)
  const level = t.k < LV_MID ? "far" : t.k < LV_NEAR ? "mid" : "near";
  const labels = useMemo(() => {
    if (!size.w) return [];
    const S = (n) => ({ sx: n.x * t.k + t.x, sy: n.y * t.k + t.y });
    const bounds = { x0: P.left + 6, y0: P.top + 6, x1: size.w - P.right - 6, y1: size.h - P.bottom - 6 };
    const onScreen = (s, m = 40) => s.sx > bounds.x0 - m && s.sx < bounds.x1 + m && s.sy > bounds.y0 - m && s.sy < bounds.y1 + m;
    const discs = [];
    const items = [];
    const q = query.trim().toLowerCase();
    graph.nodes.forEach((n) => {
      if (n.type === "sat" || n.type === "branch") return;
      const s = S(n);
      if (!onScreen(s, 200)) return;
      const sr = Math.max(n.type === "agent" ? 3 : 4, n.r * t.k) + (n.type === "ceo" ? 4 * t.k : 0);
      discs.push({ id: n.id, sx: s.sx, sy: s.sy, sr });
      const dimmed = isDim(n);
      if (n.type === "brain") {
        const main = String(n.label).toUpperCase();
        const w = Math.max(textWidth(main, FONT_DEPT) * 1.3, n.sub ? textWidth(n.sub, FONT_SUB) * 1.16 : 0) + 14;
        items.push({ id: n.id, n, ...s, sr, w, h: n.sub ? 32 : 20, prio: 1000, mode: "below", kind: "brain", main, sub: n.sub, leader: false });
      } else if (n.type === "ceo") {
        const main = String(n.label).toUpperCase();
        const sub = "CEO AGENT";
        const w = Math.max(textWidth(main, FONT_DEPT) * 1.3, textWidth(sub, FONT_SUB) * 1.16) + 14;
        items.push({ id: n.id, n, ...s, sr, w, h: 32, prio: 990, mode: "title", kind: "ceo", main, sub, dim: dimmed });
      } else if (n.type === "dept") {
        const c = n.counts || {};
        const main = String(n.label).toUpperCase();
        const sub = `${c.live || 0} live${c.paused ? ` · ${c.paused} paused` : ""}${c.planned ? ` · ${c.planned} planned` : ""}${c.broken ? ` · ${c.broken} broken` : ""}`;
        const w = Math.max(textWidth(main, FONT_DEPT) * 1.3, textWidth(sub, FONT_SUB) * 1.16) + 16;
        const len = Math.hypot(n.x, n.y) || 1;
        const dir = { x: n.x / len, y: n.y / len };
        const edge = (n.clusterR || 30) * t.k + 8;
        items.push({ id: n.id, n, sx: s.sx + dir.x * edge, sy: s.sy + dir.y * edge, sr: 0, w, h: 32, prio: 980, dir, kind: "dept", main, sub, leader: false, dim: dimmed });
      } else if (n.type === "client") {
        const main = truncate(n.label, 26);
        const c = n.counts || {};
        const sub = `${c.live || 0} LIVE · BRAIN ${Math.round(Number(n.brain?.completeness || 0))}%`;
        const w = Math.max(textWidth(main, FONT_NAME), textWidth(sub, FONT_SUB) * 1.16) + 14;
        items.push({ id: n.id, n, ...s, sr: sr + 6, w, h: 32, prio: 600, mode: "below", kind: "client", main, sub, full: n.label, truncated: main !== n.label });
      } else if (n.type === "agent") {
        const a = n.agent || {};
        const isSel = selectedId === n.id, isHov = hoverId === n.id;
        const inFocus = focusSet ? focusSet.has(n.id) : false;
        const matched = q && String(a.name).toLowerCase().includes(q);
        // Present mode labels only the lit agents; exploring labels everyone once there is room (mid zoom and in).
        const wanted = lit ? (inFocus || isSel) && (level !== "far" || isSel) : isSel || isHov || matched || level !== "far";
        if (!wanted) return;
        // Hover never changes a label's size (it would re-place under the cursor); the hover card shows the rest.
        const max = level === "near" || isSel ? 30 : 22;
        const main = truncate(a.name, max);
        const sub = level === "near" || isSel ? `${STATUS_TXT[a.status] || ""}${a.status !== "planned" && runs30(a) ? ` · ${runs30(a)} RUNS / 30D` : ""}` : "";
        const w = Math.max(textWidth(main, FONT_NAME), sub ? textWidth(sub, FONT_SUB) * 1.16 : 0) + 12;
        const prio = isSel ? 970 : isHov ? 960 : matched ? 700 : inFocus ? 650 : 100 + Math.log2(1 + runs30(a)) * 12 + (a.status === "live" ? 40 : 0);
        items.push({ id: n.id, n, ...s, sr, w, h: sub ? 30 : 18, prio, mode: "side", kind: "agent", main, sub, full: a.name, truncated: main !== a.name, dim: dimmed && !inFocus, status: a.status });
      }
    });
    return placeLabels(items, discs, bounds);
  }, [graph, t, size, padKey, level, selectedId, hoverId, focusSet, query, lit, fontsReady]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------------------------------------------------------------- render
  const ctrlRight = P.right + 14;
  const ctrlBottom = P.bottom + 14;
  return (
    <div
      ref={wrap}
      className={`cst-wrap absolute inset-0 overflow-hidden${dragging ? " dragging" : ""}${mode === "present" ? " present" : ""}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") hoverEmit(null); }}
      onKeyDown={onKeyDown}
      tabIndex={mode === "explore" ? 0 : -1}
      role="application"
      aria-label="Agent constellation map. Drag to pan, scroll or pinch to zoom, plus and minus keys zoom, 0 fits everything."
      data-testid="constellation"
    >
      <Starfield offset={{ x: t.x * 0.25, y: t.y * 0.25 }} />
      <svg className="cst absolute inset-0 h-full w-full" aria-hidden="true">
        <defs>
          <radialGradient id="agx-glow"><stop offset="0" stopColor="#ff6a00" stopOpacity=".32" /><stop offset=".55" stopColor="#ff3c00" stopOpacity=".08" /><stop offset="1" stopColor="#ff3c00" stopOpacity="0" /></radialGradient>
          <radialGradient id="agx-live" cx=".38" cy=".35"><stop offset="0" stopColor="#fffaf4" /><stop offset=".45" stopColor="#ffd2ad" /><stop offset="1" stopColor="#ff6a00" /></radialGradient>
          <radialGradient id="agx-client" cx=".4" cy=".35"><stop offset="0" stopColor="#ffe3cc" /><stop offset=".5" stopColor="#ff6a00" /><stop offset="1" stopColor="#7a1d00" /></radialGradient>
          <radialGradient id="agx-ceo" cx=".45" cy=".35"><stop offset="0" stopColor="#ffffff" /><stop offset=".6" stopColor="#ffc199" /><stop offset="1" stopColor="#ff3c00" /></radialGradient>
          <radialGradient id="agx-brain-core" cx=".42" cy=".38"><stop offset="0" stopColor="#ffffff" /><stop offset=".28" stopColor="#ffd9bd" /><stop offset=".62" stopColor="#ff6a00" /><stop offset="1" stopColor="#5c1500" /></radialGradient>
          <radialGradient id="agx-brain-halo"><stop offset="0" stopColor="#ff6a00" stopOpacity=".3" /><stop offset=".4" stopColor="#ff3c00" stopOpacity=".08" /><stop offset="1" stopColor="#ff3c00" stopOpacity="0" /></radialGradient>
          <linearGradient id="agx-flame" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stopColor="#ff3c00" /><stop offset=".55" stopColor="#ff6a00" /><stop offset="1" stopColor="#ffaa00" /></linearGradient>
        </defs>
        <g className="world" style={{ transform: `translate(${t.x}px, ${t.y}px) scale(${t.k})` }}>
          <g key={viewKey} className="world-in">
            {graph.edges.map((e) => {
              const a = byId.get(e.from), b = byId.get(e.to);
              if (!a || !b) return null;
              const dim = focusSet ? !(focusSet.has(b.id) || focusSet.has(a.id)) : !!(b.agent && isMatch && !isMatch(b.agent));
              const hi = selectedId && (e.to === selectedId || e.from === selectedId);
              return <line key={`${e.from}>${e.to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`edge ${e.kind || ""}${hi ? " hi" : ""}${dim ? " dim" : ""}`} />;
            })}
            {shownLinks.map((h) => {
              const a = byKey.get(h.from), b = byKey.get(h.to);
              if (!a || !b) return null;
              const same = a.dept && a.dept === b.dept ? clusterOf.get(a.dept) : null;
              const d = linkPath(a, b, same);
              return (
                <g key={h.id} className="hand">
                  <path d={d} className={`link${a.dept !== b.dept ? " cross" : ""}`} />
                  {!reduced ? (
                    <circle r={2.6 / Math.max(0.6, t.k) + 1.2} className="pulse-dot">
                      <animateMotion dur={`${1.8 + (h.id.length % 7) * 0.12}s`} repeatCount="indefinite" path={d} begin={`${(h.id.length % 9) * 0.17}s`} />
                    </circle>
                  ) : null}
                </g>
              );
            })}
            {graph.nodes.map((n) => <Node key={n.id} n={n} selected={selectedId === n.id || hoverId === n.id} dim={isDim(n)} lit={!!(lit && lit.has(n.id))} />)}
          </g>
        </g>
      </svg>
      {/* Leader lines + labels: screen space, constant size. */}
      <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
        {labels.filter((l) => l.leader).map((l) => <line key={l.id} x1={l.leader.x1} y1={l.leader.y1} x2={l.leader.x2} y2={l.leader.y2} className={`leader${l.dim ? " dim" : ""}`} />)}
      </svg>
      <div className="cl-layer" aria-hidden={mode === "present"}>
        {labels.map((l) => (
          <button
            key={l.id}
            type="button"
            data-label-id={l.id}
            data-ui-label=""
            tabIndex={mode === "explore" && (l.kind === "agent" || l.kind === "dept" || l.kind === "client") ? 0 : -1}
            aria-label={l.kind === "agent" ? `${l.full}, ${l.status}` : l.full || l.main}
            className={`cl-lbl k-${l.kind}${l.dim ? " dim" : ""}${selectedId === l.id ? " sel" : ""}${l.status ? ` s-${l.status}` : ""}`}
            style={{ transform: `translate(${Math.round(l.x)}px, ${Math.round(l.y)}px)`, width: Math.ceil(l.w), height: l.h }}
            onFocus={(e) => { const r = e.currentTarget.getBoundingClientRect(); hoverRef.current = l.id; setHoverId(l.id); onHover && onHover(l.n, r.right, r.top); }}
            onBlur={() => { hoverRef.current = null; setHoverId(null); onHover && onHover(null); }}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onSelect && onSelect(l.n, { pointerType: "keyboard" }); } }}
          >
            <span className="m">{l.main}</span>
            {l.sub ? <span className="s">{l.sub}</span> : null}
          </button>
        ))}
      </div>
      {mode === "explore" && !hideControls ? (
        <div data-ui="" className="glass absolute z-20 flex flex-col overflow-hidden rounded-xl" style={{ right: ctrlRight, bottom: ctrlBottom }}>
          <button type="button" aria-label="Zoom in" className="grid h-9 w-9 place-items-center text-[var(--ink-m)] hover:text-white" onClick={() => { const v = vis(); zoomAt(1.35, v.x + v.w / 2, v.y + v.h / 2); }}><Plus className="h-4 w-4" /></button>
          <button type="button" aria-label="Zoom out" className="grid h-9 w-9 place-items-center border-t border-[var(--hair-d)] text-[var(--ink-m)] hover:text-white" onClick={() => { const v = vis(); zoomAt(1 / 1.35, v.x + v.w / 2, v.y + v.h / 2); }}><Minus className="h-4 w-4" /></button>
          <button type="button" aria-label="Fit all" title="Fit all (0)" className="grid h-9 w-9 place-items-center border-t border-[var(--hair-d)] text-[var(--ink-m)] hover:text-white" onClick={() => fit(true)}><Maximize2 className="h-3.5 w-3.5" /></button>
        </div>
      ) : null}
    </div>
  );
});

export default Constellation;
export { LV_MID, LV_NEAR };
