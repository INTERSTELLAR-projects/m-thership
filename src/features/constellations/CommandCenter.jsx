import { useEffect, useRef, useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { Maximize2, Minimize2, Crosshair, MousePointer2 } from "lucide-react";
import { PILLARS, PILLAR_BY_ID, defcon } from "./pillars";
import BriefPanel from "./BriefPanel";

// First-person command room: the mouse turns your head, the wheel walks you in and out,
// clicking a screen turns to face it and opens that sector's brief.
const R = 980; // wall radius
const COLS = [
  { ang: 52, ids: ["payload", "insignia"] },
  { ang: 26, ids: ["signal", "beacon"] },
  { ang: 0, ids: ["command"] },
  { ang: -26, ids: ["shield", "intercept"] },
  { ang: -52, ids: ["engine", "orbit"] },
];
const ANGLE_OF = Object.fromEntries(COLS.flatMap((c) => c.ids.map((id) => [id, c.ang])));

const CSS = `
.cc-root{--teal:#3df5c8;--ice:#9ff3ff;background:radial-gradient(120% 90% at 50% 35%,#0b2a2e 0%,#06161a 45%,#020709 100%);font-family:"JetBrains Mono",ui-monospace,monospace;color:#d6fbff;user-select:none}
.cc-scan{background:repeating-linear-gradient(0deg,rgba(255,255,255,.035) 0 1px,transparent 1px 3px);mix-blend-mode:overlay;pointer-events:none}
.cc-screen{position:absolute;left:50%;top:50%;transform-style:preserve-3d;cursor:pointer;transition:filter .3s}
.cc-face{position:absolute;inset:0;border-radius:10px;overflow:hidden;background:linear-gradient(180deg,rgba(14,58,64,.88),rgba(5,24,28,.92));border:1px solid var(--c);box-shadow:0 0 0 1px rgba(0,0,0,.6) inset,0 0 28px -6px var(--c),0 0 90px -30px var(--c);transition:transform .35s cubic-bezier(.2,.8,.2,1),box-shadow .35s}
.cc-screen:hover .cc-face{transform:translateZ(26px) scale(1.03);box-shadow:0 0 0 1px rgba(0,0,0,.6) inset,0 0 40px -4px var(--c),0 0 140px -20px var(--c)}
.cc-screen.is-dim{filter:brightness(.45) saturate(.6)}
.cc-screen.is-on .cc-face{box-shadow:0 0 0 2px var(--c),0 0 60px 0 var(--c),0 0 200px -20px var(--c)}
.cc-grid{background-image:linear-gradient(rgba(61,245,200,.18) 1px,transparent 1px),linear-gradient(90deg,rgba(61,245,200,.18) 1px,transparent 1px);background-size:80px 80px;-webkit-mask-image:radial-gradient(circle at 50% 50%,#000 0%,transparent 62%);mask-image:radial-gradient(circle at 50% 50%,#000 0%,transparent 62%)}
@keyframes cc-blink{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes cc-sweep{0%{transform:translateY(-100%)}100%{transform:translateY(400%)}}
@keyframes cc-wave{0%{transform:scaleY(.3)}50%{transform:scaleY(1)}100%{transform:scaleY(.3)}}
@keyframes cc-spin{to{transform:rotate(360deg)}}
.cc-blink{animation:cc-blink 1.4s steps(2) infinite}
.cc-sweep{animation:cc-sweep 5s linear infinite}
`;

function Particles() {
  const ref = useRef(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    const ctx = cv.getContext("2d");
    let w, h, raf;
    const fit = () => { w = cv.width = cv.offsetWidth * devicePixelRatio; h = cv.height = cv.offsetHeight * devicePixelRatio; };
    fit();
    const ro = new ResizeObserver(fit); ro.observe(cv);
    const N = 70;
    const pts = Array.from({ length: N }, () => ({ x: Math.random(), y: Math.random(), vx: (Math.random() - 0.5) * 0.0004, vy: (Math.random() - 0.5) * 0.0004, r: Math.random() * 1.6 + 0.4, hue: Math.random() < 0.7 ? 180 : 255 }));
    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (const p of pts) { p.x = (p.x + p.vx + 1) % 1; p.y = (p.y + p.vy + 1) % 1; }
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const a = pts[i], b = pts[j];
        const dx = (a.x - b.x) * w, dy = (a.y - b.y) * h, d = Math.hypot(dx, dy), max = 150 * devicePixelRatio;
        if (d < max) { ctx.strokeStyle = `hsla(${a.hue},90%,70%,${(1 - d / max) * 0.18})`; ctx.lineWidth = devicePixelRatio * 0.6; ctx.beginPath(); ctx.moveTo(a.x * w, a.y * h); ctx.lineTo(b.x * w, b.y * h); ctx.stroke(); }
      }
      for (const p of pts) { ctx.fillStyle = `hsla(${p.hue},95%,78%,.8)`; ctx.shadowColor = `hsl(${p.hue},95%,70%)`; ctx.shadowBlur = 8; ctx.beginPath(); ctx.arc(p.x * w, p.y * h, p.r * devicePixelRatio, 0, 7); ctx.fill(); }
      ctx.shadowBlur = 0;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []);
  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full opacity-70" />;
}

function Ring({ value, color, size = 150, stroke = 9 }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = value ?? 0;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(159,243,255,.12)" strokeWidth={stroke} fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v / 100)} style={{ filter: `drop-shadow(0 0 8px ${color})`, transition: "stroke-dashoffset 1.4s cubic-bezier(.2,.8,.2,1)" }} />
    </svg>
  );
}

function Bars({ items }) {
  return (
    <div className="flex gap-[3px]">
      {items.map((i) => <span key={i.id} className="h-[5px] flex-1 rounded-[1px]" style={{ background: i.status === "done" ? "#3df5c8" : i.status === "partial" ? "#ffaa00" : i.status === "na" ? "#33464a" : "rgba(255,60,0,.55)" }} />)}
    </div>
  );
}

function PillarScreen({ p, r, w, h, ty, ang, selected, onSelect }) {
  const dc = defcon(r.score);
  return (
    <div className={`cc-screen ${selected ? (selected === p.id ? "is-on" : "is-dim") : ""}`} style={{ width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2, transform: `rotateY(${ang}deg) translateZ(${-R}px) translateY(${ty}px)`, "--c": dc.color }} onClick={(e) => { e.stopPropagation(); onSelect(p.id); }}>
      <div className="cc-face p-4">
        <div className="cc-scan absolute inset-0" />
        <div className="cc-sweep pointer-events-none absolute inset-x-0 top-0 h-1/4" style={{ background: `linear-gradient(180deg,transparent,${dc.color}14,transparent)` }} />
        <div className="relative flex h-full flex-col">
          <div className="flex items-center justify-between text-[9px] tracking-[.22em] text-[#9ff3ff]/60">
            <span>{p.code} // SECTOR</span>
            <span className="flex items-center gap-1.5" style={{ color: dc.color }}><span className="cc-blink h-1.5 w-1.5 rounded-full" style={{ background: dc.color }} />DEFCON {dc.level}</span>
          </div>
          <div className="mt-auto flex items-end justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[22px] font-bold leading-none tracking-[.12em]" style={{ color: "#e9feff", textShadow: `0 0 18px ${dc.color}88` }}>{p.name}</p>
              <p className="mt-1.5 truncate text-[10px] tracking-[.14em] text-[#9ff3ff]/60">{p.title.toUpperCase()}</p>
            </div>
            <p className="text-[34px] font-bold leading-none tabular-nums" style={{ color: dc.color, textShadow: `0 0 20px ${dc.color}` }}>{r.score ?? "—"}</p>
          </div>
          <div className="mt-3"><Bars items={r.items} /></div>
          <div className="mt-2 flex justify-between text-[9px] tracking-[.18em] text-[#9ff3ff]/50">
            <span>{r.done}/{r.total} SECURED</span>
            <span style={{ color: dc.color }}>{dc.label}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CoreScreen({ client, health, constraint, by, moves, selected, onSelect }) {
  const dc = defcon(health);
  const w = 380, h = 380;
  return (
    <div className={`cc-screen ${selected ? (selected === "command" ? "is-on" : "is-dim") : ""}`} style={{ width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2, transform: `translateZ(${-R}px)`, "--c": dc.color }} onClick={(e) => { e.stopPropagation(); onSelect("command"); }}>
      <div className="cc-face flex flex-col items-center p-5 text-center">
        <div className="cc-scan absolute inset-0" />
        <p className="relative text-[9px] tracking-[.3em] text-[#9ff3ff]/60">S-00 // COMMAND · BUSINESS HEALTH</p>
        <p className="relative mt-1 max-w-full truncate text-[13px] font-bold tracking-[.16em] text-[#e9feff]">{(client.business || "").toUpperCase()}</p>
        <div className="relative mt-3 grid place-items-center">
          <div className="absolute h-[176px] w-[176px] rounded-full border border-dashed opacity-30" style={{ borderColor: dc.color, animation: "cc-spin 30s linear infinite" }} />
          <Ring value={health} color={dc.color} size={156} stroke={10} />
          <div className="absolute">
            <p className="text-[46px] font-bold leading-none tabular-nums" style={{ color: dc.color, textShadow: `0 0 26px ${dc.color}` }}>{health ?? "—"}</p>
            <p className="mt-1 text-[9px] tracking-[.25em]" style={{ color: dc.color }}>DEFCON {dc.level} · {dc.label}</p>
          </div>
        </div>
        <div className="relative mt-auto w-full space-y-1.5 text-left text-[10px] tracking-[.1em]">
          {constraint && (
            <p className="flex justify-between gap-2"><span className="text-[#9ff3ff]/55">PRIMARY CONSTRAINT</span><span className="font-bold" style={{ color: defcon(by[constraint.id].score).color }}>{constraint.name} · {by[constraint.id].score}</span></p>
          )}
          {moves[0] && <p className="truncate text-[#e9feff]"><span className="text-[#ffaa00]">▶ NEXT MOVE </span>{moves[0].item.label}</p>}
        </div>
      </div>
    </div>
  );
}

export default function CommandCenter({ client, con, onOpenDeck }) {
  const { by, health, constraint, moves } = con;
  const root = useRef(null);
  const cam = useRef(null);
  const view = useRef({ yaw: 0, pitch: 0, z: 0, ty: 0, tx: 0, mx: 0, my: 0, zoom: 140 });
  const [selected, setSelected] = useState(null);
  const [full, setFull] = useState(false);
  const selRef = useRef(null);
  selRef.current = selected;

  // Smooth camera: mouse = head, selection = turn to face that screen.
  useEffect(() => {
    let raf;
    const tick = () => {
      const v = view.current;
      const sel = selRef.current;
      const faceYaw = sel ? -(ANGLE_OF[sel] ?? 0) : 0;
      const tYaw = faceYaw + v.mx * (sel ? 4 : 16);
      const tPitch = -v.my * (sel ? 2 : 7);
      const tZ = sel ? 360 : v.zoom;
      const narrow = (root.current?.offsetWidth || 1200) < 900;
      const tTx = sel && !narrow ? -(root.current?.offsetWidth || 1200) * 0.12 : 0;
      const col = COLS.find((c) => c.ids.includes(sel));
      const tTy = sel && col && col.ids.length > 1 ? (col.ids.indexOf(sel) === 0 ? 92 : -92) : 0;
      v.yaw += (tYaw - v.yaw) * 0.07;
      v.pitch += (tPitch - v.pitch) * 0.07;
      v.z += (tZ - v.z) * 0.07;
      v.ty += (tTy - v.ty) * 0.07;
      v.tx += (tTx - v.tx) * 0.07;
      if (cam.current) cam.current.style.transform = `translateX(${v.tx}px) translateZ(${v.z}px) rotateX(${v.pitch}deg) rotateY(${v.yaw}deg) translateY(${v.ty}px)`;
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const el = root.current; if (!el) return;
    const wheel = (e) => { if (selRef.current) return; e.preventDefault(); view.current.zoom = Math.max(-380, Math.min(420, view.current.zoom - e.deltaY * 0.6)); };
    el.addEventListener("wheel", wheel, { passive: false });
    const key = (e) => { if (e.key === "Escape") setSelected(null); };
    window.addEventListener("keydown", key);
    const fs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", fs);
    return () => { el.removeEventListener("wheel", wheel); window.removeEventListener("keydown", key); document.removeEventListener("fullscreenchange", fs); };
  }, []);

  const onMove = useCallback((e) => {
    const r = root.current.getBoundingClientRect();
    view.current.mx = ((e.clientX - r.left) / r.width) * 2 - 1;
    view.current.my = ((e.clientY - r.top) / r.height) * 2 - 1;
  }, []);

  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else root.current.requestFullscreen?.();
  };

  const sel = selected ? PILLAR_BY_ID[selected] : null;

  return (
    <div ref={root} className={`cc-root relative overflow-hidden ${full ? "h-screen" : "h-[78vh] min-h-[560px] rounded-2xl"}`} onMouseMove={onMove} onMouseLeave={() => { view.current.mx = 0; view.current.my = 0; }} onClick={() => setSelected(null)}>
      <style>{CSS}</style>
      <Particles />

      {/* 3D room */}
      <div className="absolute inset-0" style={{ perspective: "1000px", perspectiveOrigin: "50% 46%" }}>
        <div ref={cam} className="absolute left-1/2 top-1/2 h-0 w-0" style={{ transformStyle: "preserve-3d" }}>
          {/* floor + ceiling */}
          <div className="cc-grid absolute" style={{ width: 3200, height: 3200, left: -1600, top: -1600, transform: "translateY(330px) rotateX(90deg)" }} />
          <div className="absolute" style={{ width: 3200, height: 3200, left: -1600, top: -1600, transform: "translateY(-360px) rotateX(-90deg)", background: "repeating-linear-gradient(90deg,transparent 0 260px,rgba(159,243,255,.10) 260px 270px)", WebkitMaskImage: "radial-gradient(circle,#000,transparent 55%)", maskImage: "radial-gradient(circle,#000,transparent 55%)" }} />
          {/* wall glow behind screens */}
          {COLS.map((c) => (
            <div key={`wall${c.ang}`} className="absolute" style={{ width: 300, height: 640, left: -150, top: -320, transform: `rotateY(${c.ang}deg) translateZ(${-R - 40}px)`, background: "linear-gradient(180deg,rgba(61,245,200,.05),rgba(10,40,46,.35) 50%,rgba(61,245,200,.04))", borderLeft: "1px solid rgba(159,243,255,.08)", borderRight: "1px solid rgba(159,243,255,.08)" }} />
          ))}
          {COLS.map((c) => c.ids.length === 1
            ? <CoreScreen key="core" client={client} health={health} constraint={constraint} by={by} moves={moves} selected={selected} onSelect={setSelected} />
            : c.ids.map((id, i) => (
              <PillarScreen key={id} p={PILLAR_BY_ID[id]} r={by[id]} w={290} h={168} ty={i === 0 ? -98 : 98} ang={c.ang} selected={selected} onSelect={setSelected} />
            )))}
        </div>
      </div>

      {/* vignette + scanlines */}
      <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at center,transparent 45%,rgba(0,0,0,.75) 100%)" }} />
      <div className="cc-scan pointer-events-none absolute inset-0 opacity-60" />

      {/* HUD */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-4 md:p-5">
        <div>
          <p className="text-[10px] tracking-[.35em] text-[#3df5c8]">CONSTELLATIONS 1.0</p>
          <p className="mt-1 text-[15px] font-bold tracking-[.18em] text-[#e9feff]">COMMAND CENTER</p>
          <p className="mt-1 text-[9px] tracking-[.2em] text-[#9ff3ff]/50">{PILLARS.length} SECTORS · {(client.business || "").toUpperCase()}</p>
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          {selected && <button onClick={(e) => { e.stopPropagation(); setSelected(null); }} className="flex items-center gap-1.5 rounded border border-[#3df5c8]/40 bg-black/40 px-2.5 py-1.5 text-[10px] tracking-[.2em] text-[#3df5c8] hover:bg-[#3df5c8]/10"><Crosshair className="h-3 w-3" /> BACK [ESC]</button>}
          <button onClick={(e) => { e.stopPropagation(); toggleFull(); }} className="rounded border border-[#3df5c8]/40 bg-black/40 p-1.5 text-[#3df5c8] hover:bg-[#3df5c8]/10" title={full ? "Exit full screen" : "Full screen"}>{full ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}</button>
        </div>
      </div>

      {/* console strip */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24" style={{ background: "linear-gradient(180deg,transparent,rgba(2,10,12,.95))" }}>
        <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-4 text-[9px] tracking-[.2em] text-[#9ff3ff]/50 md:inset-x-6">
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {PILLARS.filter((p) => p.id !== "command").map((p) => {
              const s = by[p.id].score, dc = defcon(s);
              return <span key={p.id} className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full" style={{ background: dc.color, boxShadow: `0 0 6px ${dc.color}` }} />{p.name} <span style={{ color: dc.color }}>{s ?? "—"}</span></span>;
            })}
          </div>
          <span className="hidden items-center gap-1.5 md:flex"><MousePointer2 className="h-3 w-3" /> MOVE TO LOOK · SCROLL TO WALK · CLICK A SCREEN</span>
        </div>
      </div>

      <AnimatePresence>
        {sel && <BriefPanel key={sel.id} pillar={sel} r={by[sel.id]} con={con} client={client} onClose={() => setSelected(null)} onOpenDeck={() => onOpenDeck(sel.id)} />}
      </AnimatePresence>
    </div>
  );
}
