import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Volume2, VolumeX, X } from "lucide-react";
import PrestigeEmblem from "./PrestigeEmblem";

// Full-screen "prestige unlock" moment.
// White field + orange code rain (canvas) -> rain collapses into the emblem -> slam, shockwaves,
// particle burst -> "Unlocking rewards…" bar -> rewards list. ~6.5s, then it holds until closed.
// Click / Enter / Space skips to the end; Escape closes. prefers-reduced-motion gets a calm fade.
// Sound is synthesized with WebAudio (no files) and only plays when `sound` is true (the opener
// was a click) or the viewer turns it on with the speaker button.

const T = { collapse: 2.1, slam: 3.0, bar: 3.9, reveal: 6.2 }; // seconds
const RANK = { rain: 0, collapse: 1, slam: 2, bar: 3, reveal: 4 };
const GLYPHS = "0123456789ABCDEFGHJKLMNPQRSTUVWXYZ0123456789<>/+=*#%$&@ØΣΔΛΞΠΦΨΩ";
const PALETTE = ["#ff3c00", "#ff6a00", "#ffaa00"];
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (s) => s[(Math.random() * s.length) | 0];
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOut = (p) => 1 - Math.pow(1 - p, 3);
const easeInOut = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

export default function PrestigeUnlock({ open, ...props }) {
  if (!open || typeof document === "undefined") return null;
  return createPortal(<UnlockScene {...props} />, document.body);
}

// ---------- synthesized audio ----------
function noiseBuffer(ctx, secs) {
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * secs), ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}
function playWhoosh(ctx) {
  const t = ctx.currentTime;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, 1.1);
  const bp = ctx.createBiquadFilter();
  bp.type = "bandpass"; bp.Q.value = 1.4;
  bp.frequency.setValueAtTime(250, t);
  bp.frequency.exponentialRampToValueAtTime(3200, t + 0.85);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.35, t + 0.7);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 1.05);
  src.connect(bp).connect(g).connect(ctx.destination);
  src.start(t); src.stop(t + 1.1);
}
function playImpact(ctx) {
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  o.type = "sine";
  o.frequency.setValueAtTime(140, t);
  o.frequency.exponentialRampToValueAtTime(38, t + 0.6);
  const og = ctx.createGain();
  og.gain.setValueAtTime(0.9, t);
  og.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
  o.connect(og).connect(ctx.destination);
  o.start(t); o.stop(t + 0.95);
  const n = ctx.createBufferSource();
  n.buffer = noiseBuffer(ctx, 0.35);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass"; lp.frequency.value = 1800;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.5, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  n.connect(lp).connect(ng).connect(ctx.destination);
  n.start(t); n.stop(t + 0.35);
}
function playChime(ctx) {
  const t = ctx.currentTime;
  [660, 990, 1320].forEach((f, i) => {
    const o = ctx.createOscillator();
    o.type = "triangle"; o.frequency.value = f;
    const g = ctx.createGain();
    const s = t + i * 0.07;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(0.12, s + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, s + 0.9);
    o.connect(g).connect(ctx.destination);
    o.start(s); o.stop(s + 0.95);
  });
}

// ---------- scene ----------
function UnlockScene({ tierIndex = 1, title = "PRESTIGE I", subtitle = "", memberName = "", rewards = [], sound = false, onClose }) {
  const reduced = useMemo(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches, []);
  const [phase, setPhase] = useState(reduced ? "reveal" : "rain");
  const [soundOn, setSoundOn] = useState(!!sound && !reduced);
  const canvasRef = useRef(null);
  const emblemRef = useRef(null);
  const barRef = useRef(null);
  const pctRef = useRef(null);
  const skipRef = useRef(false);
  const phaseRef = useRef(reduced ? "reveal" : "rain");
  const soundRef = useRef(soundOn);
  const audioRef = useRef(null);
  const closeRef = useRef(onClose);

  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  useEffect(() => { soundRef.current = soundOn; }, [soundOn]);

  const audio = () => {
    if (!soundRef.current) return null;
    try {
      if (!audioRef.current) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        audioRef.current = new AC();
      }
      if (audioRef.current.state === "suspended") audioRef.current.resume();
      return audioRef.current;
    } catch {
      return null;
    }
  };
  const audioFnRef = useRef(audio);
  useEffect(() => { audioFnRef.current = audio; });

  // lock page scroll + keyboard
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); closeRef.current?.(); }
      else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (phaseRef.current !== "reveal") skipRef.current = true; else closeRef.current?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
      try { audioRef.current?.close(); } catch { /* ignore */ }
    };
  }, []);

  // main animation loop
  useEffect(() => {
    if (reduced) return undefined;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, fs = 18, drops = [];
    let raf = 0;
    let start = performance.now();
    let last = start;
    let collapsed = false, slammed = false, revealed = false;
    let pulls = [];   // glyphs being sucked into the emblem
    let sparks = [];  // burst particles
    let rings = [];   // shockwaves
    let flash = 0;
    let cx = 0, cy = 0;

    const newDrop = (init) => ({ y: init ? -rand(0, h / fs) * 1.1 : -rand(0, 18), speed: rand(9, 30), bright: rand(0.3, 1), row: -999 });
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth; h = window.innerHeight;
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`; canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      fs = Math.max(13, Math.min(22, Math.round(w / 72)));
      const n = Math.ceil(w / fs);
      drops = Array.from({ length: n }, (_, i) => drops[i] || newDrop(true));
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
      locate();
    };
    const locate = () => {
      const r = emblemRef.current?.getBoundingClientRect();
      if (r && r.width) { cx = r.left + r.width / 2; cy = r.top + r.height / 2; }
      else { cx = w / 2; cy = h * 0.32; }
    };
    resize();
    window.addEventListener("resize", resize);

    const setP = (p) => {
      if (phaseRef.current === p) return;
      phaseRef.current = p;
      setPhase(p);
      const a = audioFnRef.current?.();
      if (a) {
        if (p === "collapse") playWhoosh(a);
        if (p === "slam") playImpact(a);
        if (p === "reveal") playChime(a);
      }
    };

    const boom = () => {
      locate();
      flash = 1;
      const n = Math.min(220, Math.round((w * h) / 9000) + 90);
      for (let i = 0; i < n; i++) {
        const ang = rand(0, Math.PI * 2);
        const sp = rand(260, 1200);
        sparks.push({ x: cx, y: cy, vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp, life: rand(0.7, 1.7), age: 0, size: rand(1.5, 5), c: pick(PALETTE), glyph: Math.random() < 0.3 ? pick(GLYPHS) : null });
      }
      rings = [0, 0.13, 0.3].map((d) => ({ delay: d, age: 0 }));
    };

    const frame = (now) => {
      raf = requestAnimationFrame(frame);
      if (skipRef.current) {
        skipRef.current = false;
        start = now - T.reveal * 1000;
        collapsed = slammed = true;
        pulls = []; sparks = []; rings = []; flash = 0;
        ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
      }
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = (now - start) / 1000;

      // phases
      if (t >= T.collapse && !collapsed) {
        collapsed = true;
        locate();
        drops.forEach((d, i) => {
          const x = i * fs + fs / 2;
          for (let k = 0; k < 3; k++) {
            const y = (d.row - k * rand(2, 9)) * fs;
            if (y < -fs || y > h + fs) continue;
            pulls.push({ x0: x, y0: y, g: pick(GLYPHS), a: d.bright, delay: rand(0, 0.28), dir: Math.random() < 0.5 ? -1 : 1 });
          }
        });
      }
      if (t >= T.slam && !slammed) { slammed = true; boom(); }
      const p = t >= T.reveal ? "reveal" : t >= T.bar ? "bar" : t >= T.slam ? "slam" : t >= T.collapse ? "collapse" : "rain";
      setP(p);
      if (p === "reveal" && !revealed) {
        revealed = true;
        if (barRef.current) barRef.current.style.transform = "scaleX(1)";
        if (pctRef.current) pctRef.current.textContent = "100%";
      }

      // fade previous frame toward white (creates the trails)
      const base = t < T.collapse ? 0.075 : t < T.slam ? 0.3 : 0.22;
      ctx.fillStyle = `rgba(255,255,255,${1 - Math.pow(1 - base, dt * 60)})`;
      ctx.fillRect(0, 0, w, h);

      // rain: full -> gone during collapse -> faint ambient after the slam
      let rainA = 1;
      if (t >= T.collapse && t < T.slam) rainA = 0;
      else if (t >= T.slam) rainA = 0.16 * clamp01((t - T.slam - 0.6) / 1.2);
      if (rainA > 0.002) {
        ctx.font = `600 ${fs}px "JetBrains Mono", ui-monospace, monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        for (let i = 0; i < drops.length; i++) {
          const d = drops[i];
          d.y += d.speed * dt;
          const row = Math.floor(d.y);
          if (row !== d.row) {
            d.row = row;
            const y = row * fs;
            if (y >= -fs && y <= h) {
              const hot = Math.random() < 0.12;
              ctx.globalAlpha = rainA * (hot ? 1 : d.bright);
              ctx.fillStyle = hot ? "#ff3c00" : d.bright > 0.7 ? "#ff6a00" : "#ffaa00";
              ctx.fillText(pick(GLYPHS), i * fs + fs / 2, y);
            }
          }
          if (row * fs > h + rand(0, h * 0.4)) drops[i] = newDrop(false);
        }
        ctx.globalAlpha = 1;
      } else {
        for (let i = 0; i < drops.length; i++) { drops[i].y += drops[i].speed * dt; drops[i].row = Math.floor(drops[i].y); if (drops[i].row * fs > h) drops[i] = newDrop(false); }
      }

      // collapse: glyphs swirl into the emblem
      if (pulls.length && t < T.slam + 0.05) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const D = T.slam - T.collapse;
        for (const q of pulls) {
          const pr = clamp01((t - T.collapse - q.delay) / (D - q.delay));
          const e = pr * pr * pr;
          const dx = q.x0 - cx, dy = q.y0 - cy;
          const rot = e * 1.5 * q.dir;
          const r = 1 - e;
          const x = cx + (dx * Math.cos(rot) - dy * Math.sin(rot)) * r;
          const y = cy + (dx * Math.sin(rot) + dy * Math.cos(rot)) * r;
          const size = fs * (1 - e * 0.55);
          ctx.globalAlpha = q.a * (1 - e * 0.5);
          ctx.fillStyle = e > 0.6 ? "#ff3c00" : "#ff6a00";
          ctx.font = `700 ${size.toFixed(1)}px "JetBrains Mono", ui-monospace, monospace`;
          ctx.fillText(Math.random() < 0.08 ? (q.g = pick(GLYPHS)) : q.g, x, y);
        }
        ctx.globalAlpha = 1;
        // charging core
        const charge = clamp01((t - T.collapse) / D);
        const rad = 20 + charge * 90;
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        grd.addColorStop(0, `rgba(255,106,0,${0.35 * charge})`);
        grd.addColorStop(1, "rgba(255,106,0,0)");
        ctx.fillStyle = grd;
        ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      } else if (pulls.length && t >= T.slam + 0.05) {
        pulls = [];
      }

      // flash
      if (flash > 0) {
        const R = Math.max(w, h) * 0.75;
        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
        grd.addColorStop(0, `rgba(255,170,0,${0.45 * flash})`);
        grd.addColorStop(0.35, `rgba(255,106,0,${0.18 * flash})`);
        grd.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
        flash = Math.max(0, flash - dt * 2.6);
      }

      // shockwave rings
      if (rings.length) {
        const maxR = Math.hypot(w, h) * 0.62;
        rings = rings.filter((rg) => {
          rg.age += dt;
          const life = 1.15;
          const pr = (rg.age - rg.delay) / life;
          if (pr < 0) return true;
          if (pr >= 1) return false;
          const r = 30 + easeOut(pr) * maxR;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,${60 + Math.round(pr * 110)},0,${(1 - pr) * 0.9})`;
          ctx.lineWidth = 14 * (1 - pr) + 1;
          ctx.stroke();
          return true;
        });
      }

      // sparks
      if (sparks.length) {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        sparks = sparks.filter((s) => {
          s.age += dt;
          if (s.age >= s.life) return false;
          const drag = Math.pow(0.12, dt);
          s.vx *= drag; s.vy = s.vy * drag + 140 * dt;
          s.x += s.vx * dt; s.y += s.vy * dt;
          const a = 1 - s.age / s.life;
          ctx.globalAlpha = a;
          ctx.fillStyle = s.c;
          if (s.glyph) {
            ctx.font = `700 ${Math.round(fs * 0.9)}px "JetBrains Mono", ui-monospace, monospace`;
            ctx.fillText(s.glyph, s.x, s.y);
          } else {
            const sz = s.size * (0.6 + a * 0.6);
            ctx.fillRect(s.x - sz / 2, s.y - sz / 2, sz, sz);
          }
          return true;
        });
        ctx.globalAlpha = 1;
      }

      // progress bar (written straight to the DOM: no React renders per frame)
      if (t >= T.bar && t < T.reveal) {
        const bp = easeInOut(clamp01((t - T.bar) / (T.reveal - T.bar)));
        if (barRef.current) barRef.current.style.transform = `scaleX(${bp})`;
        if (pctRef.current) pctRef.current.textContent = `${Math.round(bp * 100)}%`;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, [reduced]);

  const rank = RANK[phase];
  const onSurfaceClick = () => { if (phaseRef.current !== "reveal") skipRef.current = true; };
  const toggleSound = (e) => {
    e.stopPropagation();
    const next = !soundOn;
    soundRef.current = next;
    setSoundOn(next);
    if (next) audio();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${title} unlocked`}
      onClick={onSurfaceClick}
      className={`pu-root fixed inset-0 z-[9999] overflow-hidden bg-white text-[#1a1a1a] ${reduced ? "pu-reduced" : ""} ${rank >= 2 && rank < 3 ? "pu-shake" : ""}`}
    >
      <style>{CSS}</style>
      <canvas ref={canvasRef} className="pointer-events-none absolute inset-0" />

      <div className="absolute right-3 top-3 z-20 flex gap-1.5">
        <button type="button" onClick={toggleSound} className="flex h-9 w-9 items-center justify-center border border-[#1a1a1a]/15 bg-white/80 text-[#1a1a1a]/60 backdrop-blur hover:text-[#ff3c00]" title={soundOn ? "Mute" : "Sound on"}>
          {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
        </button>
        <button type="button" onClick={(e) => { e.stopPropagation(); onClose?.(); }} className="flex h-9 w-9 items-center justify-center border border-[#1a1a1a]/15 bg-white/80 text-[#1a1a1a]/60 backdrop-blur hover:text-[#ff3c00]" title="Close (Esc)">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="relative z-10 flex h-full flex-col items-center overflow-y-auto px-4 pb-10 pt-[9vh] text-center">
        <div ref={emblemRef} className={`pu-emblem ${rank >= 2 ? "is-in" : ""}`}>
          <div className="pu-glow" />
          <PrestigeEmblem tier={tierIndex} size={220} className="relative h-auto w-[min(48vw,30vh,220px)]" />
        </div>

        <div className={`pu-text mt-5 ${rank >= 2 ? "is-in" : ""}`}>
          {memberName && <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#1a1a1a]/55">{memberName}</p>}
          <p className="mt-2 font-mono text-[12px] font-semibold uppercase tracking-[0.42em] text-[#ff3c00] md:text-[13px]">You have entered</p>
          <h2 className="pu-title mt-1 text-[44px] font-black leading-[0.92] tracking-[-0.04em] md:text-[84px]">{title}</h2>
          {subtitle && <p className="mt-2 font-mono text-[12px] uppercase tracking-[0.3em] text-[#1a1a1a]/60">{subtitle}</p>}
        </div>

        <div className={`pu-bar mt-7 w-full max-w-[420px] ${rank >= 3 ? "is-in" : ""}`}>
          <div className="flex items-center justify-between font-mono text-[10.5px] uppercase tracking-[0.2em] text-[#1a1a1a]/60">
            <span>{rank >= 4 ? "Rewards unlocked" : "Unlocking rewards…"}</span>
            <span ref={pctRef} className="tabular-nums">{reduced ? "100%" : "0%"}</span>
          </div>
          <div className="mt-2 h-[6px] overflow-hidden bg-[#1a1a1a]/[0.08]">
            <div ref={barRef} className="pu-fill h-full origin-left" style={{ transform: reduced ? "scaleX(1)" : "scaleX(0)" }} />
          </div>
        </div>

        {rank >= 4 && (
          <div className="mt-7 w-full max-w-[520px] text-left">
            <ul className="space-y-2">
              {rewards.map((r, i) => (
                <li key={i} className="pu-reward flex items-start gap-3 border border-[#1a1a1a]/10 bg-white/90 p-3.5 shadow-[0_10px_30px_-18px_rgba(255,60,0,.6)] backdrop-blur" style={{ animationDelay: `${120 + i * 140}ms` }}>
                  <span className="pu-check mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center text-[12px] font-bold text-white">✓</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-[15px] font-semibold tracking-[-0.02em]">{r.title}</span>
                      {r.value ? <span className="font-mono text-[12px] font-semibold text-[#ff3c00]">{r.value}</span> : null}
                    </span>
                    {r.detail && <span className="mt-0.5 block text-[12.5px] leading-snug text-[#1a1a1a]/60">{r.detail}</span>}
                  </span>
                </li>
              ))}
            </ul>
            <div className="pu-reward mt-5 flex justify-center" style={{ animationDelay: `${200 + rewards.length * 140}ms` }}>
              <button type="button" onClick={(e) => { e.stopPropagation(); onClose?.(); }} className="pu-cta h-11 px-8 text-[13px] font-semibold uppercase tracking-[0.18em] text-white">
                Continue
              </button>
            </div>
          </div>
        )}

        {rank < 4 && <p className="pointer-events-none fixed bottom-4 left-0 right-0 font-mono text-[10px] uppercase tracking-[0.25em] text-[#1a1a1a]/35">Click to skip · Esc to close</p>}
      </div>
    </div>
  );
}

const CSS = `
.pu-root .pu-emblem{position:relative;opacity:0;transform:scale(2.6);filter:blur(10px)}
.pu-root .pu-emblem.is-in{animation:pu-slam .62s cubic-bezier(.2,1.4,.35,1) forwards}
.pu-root .pu-glow{position:absolute;inset:-30%;border-radius:9999px;background:radial-gradient(circle,rgba(255,106,0,.35),rgba(255,170,0,.12) 45%,transparent 70%);animation:pu-pulse 2.4s ease-in-out infinite}
.pu-root .pu-text{opacity:0;transform:scale(1.35)}
.pu-root .pu-text.is-in{animation:pu-text .55s .12s cubic-bezier(.2,1.2,.35,1) forwards}
.pu-root .pu-title{background:linear-gradient(90deg,#ff3c00,#ff6a00 55%,#ffaa00);-webkit-background-clip:text;background-clip:text;color:transparent}
.pu-root .pu-bar{opacity:0;transform:translateY(10px);transition:opacity .4s ease,transform .4s ease}
.pu-root .pu-bar.is-in{opacity:1;transform:none}
.pu-root .pu-fill,.pu-root .pu-check,.pu-root .pu-cta{background:linear-gradient(90deg,#ff3c00,#ff6a00 55%,#ffaa00)}
.pu-root .pu-fill{box-shadow:0 0 14px rgba(255,106,0,.7)}
.pu-root .pu-cta{transition:filter .2s ease,transform .2s ease}
.pu-root .pu-cta:hover{filter:brightness(1.08);transform:translateY(-1px)}
.pu-root .pu-reward{opacity:0;animation:pu-up .5s cubic-bezier(.2,1,.35,1) forwards}
.pu-shake{animation:pu-shake .42s linear}
@keyframes pu-slam{0%{opacity:0;transform:scale(2.6);filter:blur(10px)}55%{opacity:1;transform:scale(.9);filter:blur(0)}78%{transform:scale(1.05)}100%{opacity:1;transform:scale(1);filter:blur(0)}}
@keyframes pu-text{0%{opacity:0;transform:scale(1.35)}60%{opacity:1;transform:scale(.97)}100%{opacity:1;transform:scale(1)}}
@keyframes pu-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@keyframes pu-pulse{0%,100%{opacity:.75;transform:scale(1)}50%{opacity:1;transform:scale(1.08)}}
@keyframes pu-shake{0%,100%{transform:none}15%{transform:translate(-7px,4px)}30%{transform:translate(6px,-5px)}45%{transform:translate(-4px,-3px)}60%{transform:translate(4px,3px)}80%{transform:translate(-2px,1px)}}
.pu-reduced .pu-emblem,.pu-reduced .pu-text,.pu-reduced .pu-bar,.pu-reduced .pu-reward{animation:pu-fade .6s ease forwards!important;transform:none!important;filter:none!important}
.pu-reduced .pu-glow{animation:none}
@keyframes pu-fade{from{opacity:0}to{opacity:1}}
@media (prefers-reduced-motion: reduce){.pu-shake{animation:none}}
`;
