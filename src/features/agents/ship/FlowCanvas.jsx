// The living layer under the cards: luminous curved paths, orbs flowing along them, the Claude particle core and the
// brain shimmer. 2D canvas with additive blending (no WebGL needed, cheap on laptops and phones). Cards stay crisp HTML
// on top. Falls back to an SVG drawing when canvas is unavailable, and to a still frame for prefers-reduced-motion.
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import { COLORS } from "./graph";

const SAMPLES = 36;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

// ---------------------------------------------------------------- geometry (content coordinates)
function bez(p0, c1, c2, p3, t) {
  const u = 1 - t;
  return { x: u * u * u * p0.x + 3 * u * u * t * c1.x + 3 * u * t * t * c2.x + t * t * t * p3.x, y: u * u * u * p0.y + 3 * u * u * t * c1.y + 3 * u * t * t * c2.y + t * t * t * p3.y };
}
export function edgeCurve(a, b, kind, mode) {
  const vertical = kind === "intel" || kind === "ideas" || (b.x < a.x + a.w - 2);
  let p0; let p3; let c1; let c2;
  if (!vertical) {
    p0 = { x: a.x + a.w, y: a.y + a.h / 2 };
    p3 = { x: b.x, y: b.y + b.h / 2 };
    const dx = Math.max(40, p3.x - p0.x) * 0.55;
    c1 = { x: p0.x + dx, y: p0.y };
    c2 = { x: p3.x - dx, y: p3.y };
  } else {
    const down = b.y >= a.y + a.h / 2;
    p0 = { x: a.x + a.w / 2, y: down ? a.y + a.h : a.y };
    p3 = { x: b.x + b.w / 2, y: down ? b.y : b.y + b.h };
    const dy = Math.max(30, Math.abs(p3.y - p0.y)) * (mode === "stack" ? 0.5 : 0.6) * (down ? 1 : -1);
    c1 = { x: p0.x, y: p0.y + dy };
    c2 = { x: p3.x, y: p3.y - dy };
  }
  const pts = [];
  for (let i = 0; i <= SAMPLES; i++) pts.push(bez(p0, c1, c2, p3, i / SAMPLES));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  const xs = pts.map((p) => p.x); const ys = pts.map((p) => p.y);
  return { p0, c1, c2, p3, pts, cum, len: cum[cum.length - 1] || 1, box: { x0: Math.min(...xs) - 8, x1: Math.max(...xs) + 8, y0: Math.min(...ys) - 8, y1: Math.max(...ys) + 8 }, d: `M${p0.x},${p0.y} C${c1.x},${c1.y} ${c2.x},${c2.y} ${p3.x},${p3.y}` };
}
function pointAt(g, f) {
  const target = clamp(f, 0, 1) * g.len;
  let i = 1;
  while (i < g.cum.length - 1 && g.cum[i] < target) i++;
  const a = g.pts[i - 1]; const b = g.pts[i];
  const seg = g.cum[i] - g.cum[i - 1] || 1;
  const t = (target - g.cum[i - 1]) / seg;
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
function distToCurve(g, x, y) {
  let best = Infinity;
  for (let i = 1; i < g.pts.length; i++) {
    const a = g.pts[i - 1]; const b = g.pts[i];
    const dx = b.x - a.x; const dy = b.y - a.y;
    const L = dx * dx + dy * dy || 1;
    const t = clamp(((x - a.x) * dx + (y - a.y) * dy) / L, 0, 1);
    best = Math.min(best, Math.hypot(x - (a.x + dx * t), y - (a.y + dy * t)));
  }
  return best;
}

// ---------------------------------------------------------------- sprites
const spriteCache = {};
function sprite(color, core = "#ffffff") {
  const k = `${color}|${core}`;
  if (spriteCache[k]) return spriteCache[k];
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d");
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, core);
  grd.addColorStop(0.18, color);
  grd.addColorStop(0.45, hexA(color, 0.35));
  grd.addColorStop(1, hexA(color, 0));
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  spriteCache[k] = c;
  return c;
}
function hexA(hex, a) {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((x) => x + x).join("") : h, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

// Particle sphere for the Claude core (fixed seed so it looks the same every load).
function makeSphere(n) {
  const out = [];
  let s = 1234567;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) {
    const u = rnd() * 2 - 1; const th = rnd() * Math.PI * 2;
    const r = Math.pow(rnd(), 0.35);
    out.push({ x: Math.sqrt(1 - u * u) * Math.cos(th) * r, y: u * r, z: Math.sqrt(1 - u * u) * Math.sin(th) * r, hue: rnd(), tw: rnd() * Math.PI * 2 });
  }
  return out;
}
function makeMesh(n) {
  const out = [];
  let s = 98765;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) { const a = rnd() * Math.PI * 2; const r = Math.sqrt(rnd()); out.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.62, ph: rnd() * 6.28, sp: 0.4 + rnd() }); }
  const pairs = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (Math.hypot(out[i].x - out[j].x, out[i].y - out[j].y) < 0.32) pairs.push([i, j]);
  return { pts: out, pairs };
}

// ---------------------------------------------------------------- component
const FlowCanvas = forwardRef(function FlowCanvas({ anchors, edges, scrollRef, mode, lit, focusIds, hoverEdge, reduced, density = 1, forceSvg = false }, ref) {
  const canvasRef = useRef(null);
  const wrapRef = useRef(null);
  const [svg, setSvg] = useState(forceSvg);
  const st = useRef({ orbs: [], pulses: [], flashes: [], acc: {}, geom: {}, fps: 0 });

  // Geometry for every edge whose two ends are on screen.
  const geom = useMemo(() => {
    const out = {};
    if (!anchors) return out;
    edges.forEach((e) => {
      const a = anchors[e.from]; const b = anchors[e.to];
      if (a && b) out[e.id] = { e, g: edgeCurve(a, b, e.kind, mode) };
    });
    return out;
  }, [anchors, edges, mode]);
  st.current.geom = geom;
  st.current.lit = lit;
  st.current.focusIds = focusIds;
  st.current.hoverEdge = hoverEdge;
  st.current.anchors = anchors;

  const dimEdge = (e) => {
    const L = st.current.lit;
    return L ? !(L.has(e.from) && L.has(e.to)) : false;
  };
  const hiEdge = (e) => {
    const F = st.current.focusIds;
    return st.current.hoverEdge === e.id || (F && F.has(e.from) && F.has(e.to));
  };

  useImperativeHandle(ref, () => ({
    fire(path) {
      if (!path || reduced) return;
      const hops = path.hops.map((h) => ({ ...h, g: st.current.geom[h.edge]?.g })).filter((h) => h.g);
      if (!hops.length) return;
      st.current.pulses.push({ ...path, hops, s: 0, total: hops.reduce((s, h) => s + h.g.len, 0), trail: [], head: null });
      if (st.current.pulses.length > 14) st.current.pulses.shift();
    },
    hitTest(x, y) {
      for (const p of st.current.pulses) if (p.head && Math.hypot(p.head.x - x, p.head.y - y) < 18) return { type: "pulse", pulse: p };
      let best = null;
      Object.values(st.current.geom).forEach(({ e, g }) => {
        if (dimEdge(e)) return;
        if (x < g.box.x0 || x > g.box.x1 || y < g.box.y0 || y > g.box.y1) return;
        const dd = distToCurve(g, x, y);
        if (dd < 7 && (!best || dd < best.d)) best = { d: dd, edge: e };
      });
      return best ? { type: "edge", edge: best.edge } : null;
    },
  }));

  // Main loop.
  useEffect(() => {
    if (svg) return undefined;
    const cv = canvasRef.current;
    const ctx = cv && cv.getContext ? cv.getContext("2d") : null;
    if (!ctx) { setSvg(true); return undefined; }
    const S = st.current;
    const sphere = makeSphere(density < 1 ? 160 : 340);
    const mesh = makeMesh(density < 1 ? 40 : 64);
    const maxOrbs = density < 1 ? 160 : 420;
    let raf = 0; let last = performance.now(); let frames = 0; let fpsAt = last; let W = 0; let H = 0; let dpr = 1;

    const resize = () => {
      const r = wrapRef.current.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, density < 1 ? 1.5 : 1.75);
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      cv.style.width = `${W}px`; cv.style.height = `${H}px`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrapRef.current);

    const spawn = (dt) => {
      Object.values(S.geom).forEach(({ e, g }) => {
        const dim = dimEdge(e);
        const streams = [["f", e.fwd, e.color || COLORS.command, false], ["b", e.back, e.backColor || COLORS.result, true], ["i", e.idea, COLORS.idea, false]];
        streams.forEach(([k, s, color, rev]) => {
          if (!s || !s.rate) return;
          const key = `${e.id}|${k}`;
          S.acc[key] = (S.acc[key] || Math.random()) + s.rate * density * (dim ? 0.15 : 1) * dt;
          while (S.acc[key] >= 1) {
            S.acc[key] -= 1;
            if (S.orbs.length >= maxOrbs) return;
            S.orbs.push({ id: e.id, g, t: 0, dur: clamp(g.len / (120 + Math.random() * 70), 1.1, 5), rev, color, glow: s.glow * (dim ? 0.25 : 1), size: k === "i" ? 1.25 : rev ? 0.8 : 1 });
          }
        });
      });
    };

    const drawCore = (t, slot, still) => {
      if (!slot) return;
      const cx = slot.x + slot.w / 2; const cy = slot.y + slot.h / 2;
      const R = Math.min(slot.w, slot.h) * 0.46;
      ctx.globalAlpha = 0.9;
      const glow = sprite("#ff6a00", "#fff3e6");
      const gs = R * (2.6 + (still ? 0 : Math.sin(t * 1.3) * 0.12));
      ctx.drawImage(glow, cx - gs / 2, cy - gs / 2, gs, gs);
      const rot = still ? 0.6 : t * 0.35;
      const cs = Math.cos(rot); const sn = Math.sin(rot);
      const tilt = 0.35;
      const sp = [sprite("#ffb27a", "#ffffff"), sprite("#ff6a00", "#ffd9b8"), sprite("#b18cff", "#ffffff"), sprite("#38c8ff", "#ffffff")];
      for (const p of sphere) {
        const x = p.x * cs + p.z * sn; const z = -p.x * sn + p.z * cs;
        const y = p.y * Math.cos(tilt) - z * Math.sin(tilt); const zz = p.y * Math.sin(tilt) + z * Math.cos(tilt);
        const depth = (zz + 1) / 2;
        const tw = still ? 1 : 0.75 + 0.25 * Math.sin(t * 2.2 + p.tw);
        const s = (2.2 + depth * 4.2) * tw;
        ctx.globalAlpha = 0.25 + depth * 0.7;
        ctx.drawImage(sp[p.hue < 0.55 ? 0 : p.hue < 0.8 ? 1 : p.hue < 0.92 ? 2 : 3], cx + x * R - s / 2, cy + y * R - s / 2, s, s);
      }
      // A center star.
      const cs2 = R * 0.9;
      ctx.globalAlpha = 1;
      ctx.drawImage(sprite("#ffd9b8", "#ffffff"), cx - cs2 / 2, cy - cs2 / 2, cs2, cs2);
    };

    const drawBrain = (t, slot, still) => {
      if (!slot) return;
      const cx = slot.x + slot.w / 2; const cy = slot.y + slot.h / 2;
      const R = Math.min(slot.w * 0.5, slot.h * 0.8);
      const P = mesh.pts.map((p) => ({ x: cx + (p.x + (still ? 0 : Math.sin(t * p.sp + p.ph) * 0.03)) * R, y: cy + (p.y + (still ? 0 : Math.cos(t * p.sp * 0.8 + p.ph) * 0.03)) * R, f: still ? 0.6 : 0.5 + 0.5 * Math.sin(t * 1.7 * p.sp + p.ph) }));
      ctx.lineWidth = 0.8;
      for (const [i, j] of mesh.pairs) {
        const a = P[i]; const b = P[j];
        ctx.strokeStyle = hexA(COLORS.brain, 0.08 + 0.22 * a.f * b.f);
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
      }
      const s1 = sprite(COLORS.brain, "#f3ecff");
      for (const p of P) { const s = 3 + p.f * 5; ctx.globalAlpha = 0.35 + p.f * 0.6; ctx.drawImage(s1, p.x - s / 2, p.y - s / 2, s, s); }
      ctx.globalAlpha = 0.5;
      const gs = R * 2.4;
      ctx.drawImage(sprite(COLORS.brain, "#ffffff"), cx - gs / 2, cy - gs / 2, gs, gs);
    };

    const frame = (now, still = false) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;
      const sc = scrollRef.current;
      const sx = sc ? sc.scrollLeft : 0; const sy = sc ? sc.scrollTop : 0;
      const view = { x0: sx - 40, x1: sx + W + 40, y0: sy - 40, y1: sy + H + 40 };
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, W, H);
      ctx.translate(-sx, -sy);
      ctx.globalCompositeOperation = "lighter";

      // Paths.
      Object.values(S.geom).forEach(({ e, g }) => {
        if (g.box.x1 < view.x0 || g.box.x0 > view.x1 || g.box.y1 < view.y0 || g.box.y0 > view.y1) return;
        const dim = dimEdge(e); const hi = hiEdge(e);
        const base = 0.07 + 0.2 * (e.fwd ? e.fwd.glow : 0.4);
        const a = dim ? 0.025 : hi ? 0.85 : base;
        const path = g.p2 || (g.p2 = new Path2D(g.d));
        ctx.globalAlpha = 1;
        ctx.strokeStyle = hexA(e.color || COLORS.command, a * 0.35);
        ctx.lineWidth = hi ? 6 : 4;
        ctx.stroke(path);
        ctx.strokeStyle = hexA(e.color || COLORS.command, a);
        ctx.lineWidth = hi ? 1.6 : 1;
        ctx.stroke(path);
      });

      // Core + brain.
      drawCore(t, S.anchors && S.anchors["slot:claude"], still);
      drawBrain(t, S.anchors && S.anchors["slot:brain"], still);

      if (still) {
        // Reduced motion: a few fixed orbs so direction still reads.
        Object.values(S.geom).forEach(({ e, g }) => {
          if (dimEdge(e)) return;
          [0.35, 0.7].forEach((f) => { const p = pointAt(g, f); const s = 9; ctx.globalAlpha = 0.8; ctx.drawImage(sprite(e.color || COLORS.command), p.x - s / 2, p.y - s / 2, s, s); });
        });
        return;
      }

      // Orbs.
      spawn(dt);
      const keep = [];
      for (const o of S.orbs) {
        o.t += dt / o.dur;
        if (o.t >= 1 || !S.geom[o.id]) continue;
        keep.push(o);
        const g = S.geom[o.id].g;
        const p = pointAt(g, o.rev ? 1 - o.t : o.t);
        if (p.x < view.x0 || p.x > view.x1 || p.y < view.y0 || p.y > view.y1) continue;
        const fade = Math.min(1, o.t * 6, (1 - o.t) * 6);
        const s = (7 + o.glow * 8) * o.size;
        ctx.globalAlpha = fade * (0.45 + o.glow * 0.55);
        ctx.drawImage(sprite(o.color), p.x - s / 2, p.y - s / 2, s, s);
      }
      S.orbs = keep;

      // Event pulses: one bright comet per real event along its true path.
      const keepP = [];
      for (const p of S.pulses) {
        p.s += dt * 430;
        if (p.s >= p.total) {
          const lastHop = p.hops[p.hops.length - 1];
          const end = pointAt(lastHop.g, lastHop.forward ? 1 : 0);
          S.flashes.push({ x: end.x, y: end.y, t: 0, color: p.color });
          continue;
        }
        keepP.push(p);
        let s = p.s; let hop = p.hops[0];
        for (const h of p.hops) { if (s <= h.g.len) { hop = h; break; } s -= h.g.len; }
        const f = s / hop.g.len;
        const head = pointAt(hop.g, hop.forward ? f : 1 - f);
        p.head = head;
        p.trail.push(head);
        if (p.trail.length > 16) p.trail.shift();
        const sp = sprite(p.color, "#ffffff");
        p.trail.forEach((q, i) => { const k = (i + 1) / p.trail.length; const sz = 6 + 16 * k; ctx.globalAlpha = 0.12 + 0.5 * k; ctx.drawImage(sp, q.x - sz / 2, q.y - sz / 2, sz, sz); });
        ctx.globalAlpha = 1;
        ctx.drawImage(sp, head.x - 20, head.y - 20, 40, 40);
      }
      S.pulses = keepP;
      S.flashes = S.flashes.filter((fl) => {
        fl.t += dt;
        if (fl.t > 0.8) return false;
        ctx.globalAlpha = 1 - fl.t / 0.8;
        ctx.strokeStyle = fl.color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(fl.x, fl.y, 6 + fl.t * 46, 0, Math.PI * 2); ctx.stroke();
        return true;
      });

      frames++;
      if (now - fpsAt > 1000) { S.fps = Math.round((frames * 1000) / (now - fpsAt)); frames = 0; fpsAt = now; try { window.__shipFps = S.fps; cv.dataset.fps = String(S.fps); } catch { /* ignore */ } }
    };

    if (reduced) {
      const paint = () => frame(performance.now(), true);
      paint();
      const sc = scrollRef.current;
      const onScroll = () => requestAnimationFrame(paint);
      sc?.addEventListener("scroll", onScroll, { passive: true });
      const id = setInterval(paint, 1500); // picks up new layout / highlights without animating
      return () => { ro.disconnect(); clearInterval(id); sc?.removeEventListener("scroll", onScroll); };
    }
    const loop = (now) => { frame(now); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, [svg, reduced, density, scrollRef]); // eslint-disable-line react-hooks/exhaustive-deps

  if (svg) return <SvgFlow wrapRef={wrapRef} geom={geom} scrollRef={scrollRef} lit={lit} reduced={reduced} />;
  return (
    <div ref={wrapRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <canvas ref={canvasRef} className="shp-canvas block" data-testid="ship-canvas" />
    </div>
  );
});
export default FlowCanvas;

// SVG fallback: same curves, dashes drift along them (still when reduced motion is on).
function SvgFlow({ wrapRef, geom, scrollRef, lit, reduced }) {
  const [off, setOff] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const sc = scrollRef.current;
    if (!sc) return undefined;
    const on = () => setOff({ x: sc.scrollLeft, y: sc.scrollTop });
    sc.addEventListener("scroll", on, { passive: true });
    return () => sc.removeEventListener("scroll", on);
  }, [scrollRef]);
  return (
    <div ref={wrapRef} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <svg className="shp-svg absolute left-0 top-0 overflow-visible" width="10" height="10" style={{ transform: `translate(${-off.x}px, ${-off.y}px)` }} data-testid="ship-svg">
        {Object.values(geom).map(({ e, g }) => {
          const dim = lit ? !(lit.has(e.from) && lit.has(e.to)) : false;
          return (
            <g key={e.id} opacity={dim ? 0.12 : 1}>
              <path d={g.d} fill="none" stroke={e.color || COLORS.command} strokeOpacity={0.28} strokeWidth={1} />
              <path d={g.d} fill="none" stroke={e.color || COLORS.command} strokeWidth={2.2} strokeLinecap="round" strokeDasharray="2 26" className={reduced ? "" : "shp-dash"} />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
