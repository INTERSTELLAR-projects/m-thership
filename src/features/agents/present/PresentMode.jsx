// Present mode: a full-screen, cinematic walkthrough of the agent workforce for investors. The camera flies across
// the live constellation scene by scene; every number on screen is read from the app's records at open time.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Pause, Play, X, Maximize, Minimize } from "lucide-react";
import { base44 } from "@/api/base44Client";
import Constellation from "../Constellation";
import { INTERSTELLAR_DEPTS } from "../defs";
import { buildClusterOverview, buildHandoffs } from "../map/model";
import { buildScenes } from "./scenes";
import "./present.css";

const arr = (v) => (Array.isArray(v) ? v : (v && v.items) || []);
async function loadExtra() {
  const E = base44.entities;
  const [briefs, launch] = await Promise.all([
    Promise.resolve(E.DailyBrief.list("-generated_at", 1)).then(arr).catch(() => []),
    Promise.resolve(E.LaunchItem.filter({ blocking_launch: true }, "-updated_date", 400)).then(arr).catch(() => []),
  ]);
  return { brief: briefs[0] || null, launch: launch.filter((i) => i.status !== "done") };
}

function useReduced() {
  const q = typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
  const [r, setR] = useState(!!q?.matches);
  useEffect(() => { if (!q) return undefined; const on = () => setR(q.matches); q.addEventListener?.("change", on); return () => q.removeEventListener?.("change", on); }, [q]);
  return r;
}
function useSize() {
  const [s, setS] = useState({ w: typeof window !== "undefined" ? window.innerWidth : 1280, h: typeof window !== "undefined" ? window.innerHeight : 720 });
  useEffect(() => { const on = () => setS({ w: window.innerWidth, h: window.innerHeight }); window.addEventListener("resize", on); return () => window.removeEventListener("resize", on); }, []);
  return s;
}

function CountUp({ to, reduced, delay = 0 }) {
  const [v, setV] = useState(reduced ? to : 0);
  useEffect(() => {
    if (reduced) { setV(to); return undefined; }
    let raf = 0; const t0 = performance.now() + delay;
    const step = (now) => { const p = Math.max(0, Math.min(1, (now - t0) / 1400)); setV(Math.round(to * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [to, reduced, delay]);
  return <>{v}</>;
}

function Counts({ counts, reduced, big }) {
  const items = [["live", "Live", "#ff6a00"], ["paused", "Paused", "#8d8680"], ["planned", "Planned", "rgba(255,255,255,.6)"], ...(counts.broken ? [["broken", "Broken", "#ff4433"]] : [])];
  return (
    <div className={`pm-counts ${big ? "big" : ""}`}>
      {items.map(([k, l, c], i) => (
        <div key={k} className="pm-count">
          <span className="n" style={k === "live" ? undefined : { color: "#f4efe9" }}><CountUp to={counts[k] || 0} reduced={reduced} delay={i * 140} /></span>
          <span className="l"><i style={{ background: k === "planned" ? "transparent" : c, boxShadow: k === "live" ? "0 0 10px #ff6a00" : "none", border: k === "planned" ? `1.5px dashed ${c}` : "none" }} />{l}</span>
        </div>
      ))}
    </div>
  );
}

function Title({ lines }) {
  return <h2 className="pm-title">{lines.map((l, i) => <span key={i} className="block">{i === lines.length - 1 && lines.length > 1 ? <span className="flame">{l}</span> : l}</span>)}</h2>;
}

function Caption({ s, reduced, flowStep }) {
  return (
    <div className="pm-cap" key={s.id}>
      <p className="pm-eyebrow"><span className="plus">+</span>{s.eyebrow}</p>
      <Title lines={s.title} />
      {s.kind === "open" ? <Counts counts={s.counts} reduced={reduced} big /> : null}
      {s.lead ? <p className="pm-lead">{s.lead}</p> : null}
      {s.kind === "open" && s.foot ? <p className="pm-foot">{s.foot}</p> : null}
      {s.facts ? (
        <dl className="pm-facts">{s.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
      ) : null}
      {s.kind === "dept" ? (
        <>
          <Counts counts={s.counts} reduced={reduced} />
          {s.onDuty.length ? (
            <ul className="pm-duty">
              {s.onDuty.map((a) => <li key={a.key}><p className="nm">{a.name}{a.when ? <span className="when">{a.when}</span> : null}</p>{a.what ? <p className="wt">{a.what}</p> : null}</li>)}
            </ul>
          ) : null}
          <p className="pm-join">{s.joined}</p>
        </>
      ) : null}
      {s.kind === "flow" ? (
        <ol className="pm-flow">
          {s.steps.map((st, i) => (
            <li key={st.key} className={`${i <= flowStep ? "on" : ""} ${st.planned ? "planned" : ""}`}>
              <span className="ix">{String(i + 1).padStart(2, "0")}</span>
              <div className="min-w-0">
                <p className="lb">{st.label}{st.planned ? <span className="tag">Planned</span> : null}</p>
                <p className="ln">{st.line}</p>
                <p className="ag">{st.planned ? (st.plannedNames.length ? `Next: ${st.plannedNames.join(", ")}` : "No agent yet") : st.live.join(" · ")}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : null}
      {s.kind === "pillars" ? (
        <ul className="pm-pillars">
          {s.pillars.map((p) => (
            <li key={p.id} className={s.weakest === p.id ? "weak" : ""}>
              <span className="nm">{p.name}{s.weakest === p.id ? <span className="tag">Weakest</span> : null}</span>
              <span className="bar"><i style={{ width: `${p.score ?? 0}%` }} /></span>
              <span className="sc">{p.score ?? "—"}</span>
            </li>
          ))}
        </ul>
      ) : null}
      {s.kind === "next" ? (
        <>
          <ol className="pm-next">
            {s.actions.map((x, i) => (
              <li key={x.id}>
                <span className="ix">{i + 1}</span>
                <div className="min-w-0"><p className="tt">{x.title}</p><p className="wy"><span className="pl">{x.pillarName}</span>{x.why}</p></div>
              </li>
            ))}
          </ol>
          {s.foot ? <p className="pm-foot">{s.foot}</p> : null}
        </>
      ) : null}
    </div>
  );
}

export default function PresentMode({ data, registry, ceoName, onExit }) {
  const extra = useQuery({ queryKey: ["present-extra"], queryFn: loadExtra, staleTime: 60_000 });
  const reduced = useReduced();
  const size = useSize();
  const mapRef = useRef(null);
  const rootRef = useRef(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [fs, setFs] = useState(false);

  const hq = useMemo(() => registry.filter((a) => a.scope === "interstellar"), [registry]);
  const hqBrain = data.brains.find((b) => b.scope === "interstellar");
  const graph = useMemo(() => {
    const commander = hq.find((a) => a.key === "commander");
    return buildClusterOverview({ depts: INTERSTELLAR_DEPTS, agents: hq.filter((a) => a.key !== "commander"), ceo: commander ? { ...commander, name: ceoName } : null, brain: hqBrain, centerLabel: "Company Brain", centerSub: hqBrain ? `${Math.round(hqBrain.completeness || 0)}% MAPPED` : "" });
  }, [hq, hqBrain, ceoName]);
  const handoffs = useMemo(() => buildHandoffs(hq), [hq]);
  const scores = extra.data?.brief?.pillar_scores || null;
  const scoredOn = extra.data?.brief?.date ? new Date(`${extra.data.brief.date}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" }) : "";
  const scenes = useMemo(() => buildScenes({ registry, graph, handoffs, depts: INTERSTELLAR_DEPTS, hqBrain, scores, scoredOn, launchItems: extra.data?.launch || [], ceoName, clients: data.clients || [] }), [registry, graph, handoffs, hqBrain, scores, scoredOn, extra.data, ceoName, data.clients]);
  const s = scenes[Math.min(idx, scenes.length - 1)];

  // Flow scene: light the journey step by step.
  const flowStep = s.kind === "flow" ? Math.min(s.steps.length - 1, Math.floor(progress * (s.steps.length + 0.6))) : -1;
  const allLinks = useMemo(() => [...handoffs, ...scenes.flatMap((x) => x.flowLinks || [])], [handoffs, scenes]);
  const { lit, litLinks } = useMemo(() => {
    if (s.kind === "flow") {
      const ids = new Set(["brain"]);
      s.steps.slice(0, flowStep + 1).forEach((st) => st.nodeIds.forEach((id) => ids.add(id)));
      return { lit: ids, litLinks: new Set(s.flowLinks.filter((l) => l.step < flowStep).map((l) => l.id)) };
    }
    return { lit: s.lit, litLinks: s.links };
  }, [s, flowStep]);

  // Layout: caption column on the left on landscape screens, bottom sheet on portrait / phones.
  const wide = size.w >= 900 && size.w / size.h > 1.1;
  const pad = wide
    ? { left: Math.min(720, Math.round(size.w * 0.42)), right: 40, top: 80, bottom: 96 }
    : { left: 12, right: 12, top: 64, bottom: Math.round(size.h * 0.56) };

  // Camera per scene.
  useEffect(() => {
    const id = setTimeout(() => {
      const m = mapRef.current;
      if (!m) return;
      const c = s.camera || { type: "fit" };
      if (c.type === "cluster") m.flyToCluster(c.key, { duration: 1400, maxK: wide ? 2.6 : 1.8 });
      else if (c.type === "nodes") m.flyToNodes(c.ids, { pad: c.pad, maxK: c.maxK, duration: 1400 });
      else m.fit(true);
    }, 80);
    return () => clearTimeout(id);
  }, [s.id, wide, size.w, size.h]); // eslint-disable-line react-hooks/exhaustive-deps

  // Timeline: progress for the current scene, then advance (stops at the last scene).
  const progRef = useRef(0);
  useEffect(() => { progRef.current = 0; setProgress(0); }, [idx]);
  useEffect(() => {
    if (!playing) return undefined;
    let raf = 0; let last = performance.now();
    const tick = (now) => {
      const dt = Math.min(100, now - last); last = now;
      progRef.current += dt / (s.duration || 9000);
      if (progRef.current >= 1) {
        if (idx < scenes.length - 1) { setIdx(idx + 1); return; }
        progRef.current = 1; setProgress(1); setPlaying(false); return;
      }
      setProgress(progRef.current);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, idx, s.duration, scenes.length]);

  const go = useCallback((d) => setIdx((i) => Math.max(0, Math.min(scenes.length - 1, i + d))), [scenes.length]);
  const exit = useCallback(() => { try { if (document.fullscreenElement) document.exitFullscreen?.(); } catch { /* ignore */ } onExit(); }, [onExit]);
  const toggleFs = useCallback(() => {
    try { if (document.fullscreenElement) document.exitFullscreen?.(); else rootRef.current?.requestFullscreen?.(); } catch { /* ignore */ }
  }, []);
  useEffect(() => { const on = () => setFs(!!document.fullscreenElement); document.addEventListener("fullscreenchange", on); return () => document.removeEventListener("fullscreenchange", on); }, []);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") { e.preventDefault(); exit(); }
      else if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); go(1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); go(-1); }
      else if (e.key === " " || e.key === "k") { e.preventDefault(); setPlaying((p) => !p); }
      else if (e.key === "Home") { e.preventDefault(); setIdx(0); }
      else if (e.key === "End") { e.preventDefault(); setIdx(scenes.length - 1); }
      else if (e.key === "f") toggleFs();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [go, exit, toggleFs, scenes.length]);
  useEffect(() => { rootRef.current?.focus(); try { rootRef.current?.requestFullscreen?.().catch(() => {}); } catch { /* not allowed without a gesture */ } }, []);
  useEffect(() => { const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; return () => { document.body.style.overflow = prev; }; }, []);

  // Swipe on touch screens.
  const sw = useRef(null);
  const onPD = (e) => { if (e.pointerType !== "mouse") sw.current = { x: e.clientX, y: e.clientY }; };
  const onPU = (e) => { const st = sw.current; sw.current = null; if (!st) return; const dx = e.clientX - st.x; if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - st.y)) go(dx < 0 ? 1 : -1); };

  const total = scenes.length;
  return createPortal(
    <div ref={rootRef} className={`agx pm-root ${wide ? "wide" : "tall"}${reduced ? " reduced" : ""}`} role="dialog" aria-modal="true" aria-label="Agent workforce presentation" tabIndex={-1} onPointerDown={onPD} onPointerUp={onPU} data-testid="present">
      <div className="pm-map">
        <Constellation ref={mapRef} mode="present" graph={graph} handoffs={allLinks} viewKey="present" lit={lit} litLinks={litLinks} pad={pad} reduced={reduced} hideControls />
      </div>
      <div className="pm-vignette" aria-hidden="true" />
      <header className="pm-top">
        <p className="pm-brand"><span className="mark">INTERSTELLAR<sup>™</sup></span><span className="sep">/</span><span className="sub">Agent workforce</span></p>
        <div className="flex items-center gap-2">
          <span className="pm-counter" aria-live="polite">{String(idx + 1).padStart(2, "0")} <span>/ {String(total).padStart(2, "0")}</span></span>
          <button type="button" className="pm-icon hidden sm:grid" onClick={toggleFs} aria-label={fs ? "Exit full screen" : "Full screen"}>{fs ? <Minimize className="h-4 w-4" /> : <Maximize className="h-4 w-4" />}</button>
          <button type="button" className="pm-icon" onClick={exit} aria-label="Exit presentation (Esc)" data-testid="present-exit"><X className="h-4 w-4" /></button>
        </div>
      </header>
      <section className="pm-stage" aria-live="polite">
        <Caption s={s} reduced={reduced} flowStep={flowStep} />
      </section>
      <footer className="pm-bottom">
        <div className="pm-progress" role="progressbar" aria-label="Presentation progress" aria-valuemin={1} aria-valuemax={total} aria-valuenow={idx + 1}>
          {scenes.map((x, i) => (
            <button key={x.id} type="button" className="seg" onClick={() => setIdx(i)} aria-label={`Go to scene ${i + 1}: ${x.title.join(" ")}`}>
              <i style={{ width: `${i < idx ? 100 : i === idx ? progress * 100 : 0}%` }} />
            </button>
          ))}
        </div>
        <div className="pm-ctrls">
          <button type="button" className="pm-icon" onClick={() => go(-1)} disabled={idx === 0} aria-label="Previous scene"><ChevronLeft className="h-5 w-5" /></button>
          <button type="button" className="pm-play" onClick={() => { if (!playing && idx === total - 1 && progress >= 1) { setIdx(0); } setPlaying((p) => !p); }} aria-label={playing ? "Pause" : "Play"} data-testid="present-play">
            {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="h-4 w-4 fill-current" />}<span>{playing ? "Pause" : "Play"}</span>
          </button>
          <button type="button" className="pm-icon" onClick={() => go(1)} disabled={idx === total - 1} aria-label="Next scene" data-testid="present-next"><ChevronRight className="h-5 w-5" /></button>
          <span className="pm-hint hidden md:inline">← → to move · Space to pause · Esc to exit</span>
        </div>
      </footer>
    </div>,
    document.body,
  );
}
