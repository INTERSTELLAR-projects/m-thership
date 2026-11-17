import { useEffect, useMemo, useState } from "react";
import { Play, Check, Brain, Send } from "lucide-react";
import { CountUp } from "@/components/charts/ChartKit";
import { Spinner, relTime } from "@/features/agents/ui";
import { inWeek, agentCall, logPrompts } from "./data";

const W = 1000, H = 430, CX = 500, CY = 215;

function usePrefersReducedMotion() {
  const [r, setR] = useState(() => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const q = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (!q) return undefined;
    const on = () => setR(q.matches);
    q.addEventListener?.("change", on);
    return () => q.removeEventListener?.("change", on);
  }, []);
  return r;
}

const shortName = (n) => String(n || "").replace(" / Command System", "").replace(" & launch", " + launch").replace("Website ", "Site ").replace(" & citations", "");

// The brain: prompts stream in from the left, the core clusters them, upgraded prompts flow out to every area of work.
export function BrainVisual({ areas, prompts, pendingByArea, logs, busy, onPickArea }) {
  const reduce = usePrefersReducedMotion();
  const nodes = useMemo(() => {
    const n = areas.length || 1;
    return areas.map((a, i) => {
      const t = -Math.PI / 2 + (i / n) * Math.PI * 2;
      const x = CX + Math.cos(t) * 395, y = CY + Math.sin(t) * 168;
      const live = prompts.some((p) => p.area_id === a.id && p.status === "approved");
      return { a, x, y, live, pending: pendingByArea[a.id] || 0 };
    });
  }, [areas, prompts, pendingByArea]);
  const particles = useMemo(() => {
    const n = busy ? 14 : Math.min(9, Math.max(4, logs.length));
    return Array.from({ length: n }, (_, i) => {
      const sy = 40 + ((i * 97) % (H - 80));
      return { id: i, d: `M -10 ${sy} C 160 ${sy}, 300 ${CY + (sy - CY) * 0.25}, ${CX - 40} ${CY}`, dur: busy ? 1.6 + (i % 4) * 0.35 : 3.6 + (i % 5) * 0.8, begin: (i * 0.73) % 4 };
    });
  }, [busy, logs.length]);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="brain-svg block h-auto w-full" role="img" aria-label="Prompt agent brain: requests flow in, foundation prompts flow out to each area of work">
      <defs>
        <radialGradient id="pbk-core" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffb15a" stopOpacity=".95" />
          <stop offset="35%" stopColor="#ff6a00" stopOpacity=".55" />
          <stop offset="100%" stopColor="#ff3c00" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pbk-flame" x1="0" x2="1">
          <stop offset="0%" stopColor="#ff3c00" /><stop offset="55%" stopColor="#ff6a00" /><stop offset="100%" stopColor="#ffaa00" />
        </linearGradient>
        <filter id="pbk-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
      </defs>

      {/* inbound stream */}
      {particles.map((p) => (
        <g key={p.id}>
          <path d={p.d} fill="none" stroke="rgba(255,170,120,.07)" strokeWidth="1" />
          {!reduce ? (
            <circle r={busy ? 2.6 : 2} fill="#ffcf9a" filter="url(#pbk-glow)">
              <animateMotion dur={`${p.dur}s`} begin={`${p.begin}s`} repeatCount="indefinite" path={p.d} />
              <animate attributeName="opacity" values="0;1;1;0" dur={`${p.dur}s`} begin={`${p.begin}s`} repeatCount="indefinite" />
            </circle>
          ) : null}
        </g>
      ))}
      <text x="14" y="26" fill="rgba(244,239,233,.38)" fontSize="10" letterSpacing="2">YOUR PROMPTS IN</text>
      <text x={W - 14} y="26" textAnchor="end" fill="rgba(244,239,233,.38)" fontSize="10" letterSpacing="2">FOUNDATIONS OUT</text>

      {/* synapses to every area */}
      {nodes.map(({ a, x, y, live }) => {
        const mx = (CX + x) / 2, my = (CY + y) / 2 - 18;
        const d = `M ${CX} ${CY} Q ${mx} ${my} ${x} ${y}`;
        return (
          <g key={`e-${a.id}`}>
            <path d={d} fill="none" stroke={live ? "rgba(255,120,60,.22)" : "rgba(255,255,255,.07)"} strokeWidth="1.1" />
            {live ? <path d={d} fill="none" stroke="rgba(255,150,70,.45)" strokeWidth="1.1" className="syn" /> : null}
            {live && !reduce ? (
              <circle r="2.2" fill="#ffaa00">
                <animateMotion dur={busy ? "1.2s" : "3.2s"} begin={`${(a.order || 1) * 0.37}s`} repeatCount="indefinite" path={d} />
              </circle>
            ) : null}
          </g>
        );
      })}

      {/* core */}
      <circle cx={CX} cy={CY} r="96" fill="url(#pbk-core)" className="breathe" />
      <g className="core-ring spin"><circle cx={CX} cy={CY} r="70" fill="none" stroke="rgba(255,140,70,.5)" strokeWidth="1" strokeDasharray="2 7" /></g>
      <g className="core-ring spin-r"><circle cx={CX} cy={CY} r="84" fill="none" stroke="rgba(255,170,0,.28)" strokeWidth="1" strokeDasharray="30 14 4 14" /></g>
      <circle cx={CX} cy={CY} r="44" fill="#0b0c12" stroke="url(#pbk-flame)" strokeWidth="1.5" />
      <g transform={`translate(${CX - 15} ${CY - 22})`} opacity=".95"><Brain width="30" height="30" color="#ff8a3d" strokeWidth={1.5} /></g>
      <text x={CX} y={CY + 26} textAnchor="middle" fill="#fff" fontSize="9.5" letterSpacing="1.8">PROMPT AGENT</text>

      {/* area nodes */}
      {nodes.map(({ a, x, y, live, pending }) => (
        <g key={a.id} className="node-g" tabIndex={0} role="button" aria-label={`Open ${a.name}`} onClick={() => onPickArea(a)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPickArea(a); } }}>
          <circle cx={x} cy={y} r="22" fill="transparent" />
          {live ? <circle cx={x} cy={y} r="15" fill="rgba(255,90,0,.16)" className="pulse" /> : null}
          <circle className="node-c" cx={x} cy={y} r="9.5" fill={live ? "url(#pbk-flame)" : "#0b0c12"} stroke={live ? "rgba(255,190,120,.6)" : "rgba(255,255,255,.4)"} strokeWidth="1.2" strokeDasharray={live ? "0" : "2.5 2.5"} />
          {pending ? (
            <g>
              <circle cx={x + 10} cy={y - 10} r="7" fill="#ff3c00" />
              <text x={x + 10} y={y - 7} textAnchor="middle" fill="#fff" fontSize="8.5" fontWeight="700">{pending}</text>
            </g>
          ) : null}
          <text x={x} y={y + (y > CY ? 30 : -18)} textAnchor="middle" fill={live ? "rgba(244,239,233,.9)" : "rgba(244,239,233,.5)"} fontSize="10.5" letterSpacing=".6" style={{ paintOrder: "stroke", stroke: "rgba(5,6,10,.85)", strokeWidth: 3 }}>{shortName(a.name)}</text>
        </g>
      ))}
    </svg>
  );
}

const STEPS = [
  ["sync_checks", "Sweeping the standards matrix"],
  ["cluster", "Clustering your prompts into patterns"],
  ["draft", "Drafting upgraded foundation prompts"],
];

export function RunPanel({ state, refresh, setBusy }) {
  const [running, setRunning] = useState(null);
  const [done, setDone] = useState({});
  const [err, setErr] = useState("");
  const run = async () => {
    setErr(""); setDone({}); setBusy(true);
    try {
      for (const [k] of STEPS) {
        setRunning(k);
        const r = await agentCall(k);
        setDone((d) => ({ ...d, [k]: summarize(k, r) }));
        refresh();
      }
    } catch (e) {
      setErr(String(e.message || e));
    } finally {
      setRunning(null); setBusy(false); refresh();
    }
  };
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="eyebrow">Agent run</p>
          <p className="mt-1 text-[12.5px] text-[var(--ink-m)]">Weekly on Mondays, or now. Proposes only: nothing goes live without you.</p>
        </div>
        <button type="button" className="btn-f shrink-0" onClick={run} disabled={!!running}>{running ? <Spinner size={14} /> : <Play className="h-3.5 w-3.5" />}{running ? "Thinking…" : "Run now"}</button>
      </div>
      <ul className="mt-3 space-y-1.5">
        {STEPS.map(([k, label]) => (
          <li key={k} className="flex items-start gap-2 text-[12.5px]">
            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center">{running === k ? <Spinner size={12} /> : done[k] ? <Check className="h-3.5 w-3.5 text-[#ff8a3d]" /> : <span className="h-1.5 w-1.5 rounded-full bg-white/25" />}</span>
            <span className={running === k ? "text-white" : "text-[var(--ink-m)]"}>{label}{done[k] ? <span className="text-[var(--ink-s)]"> · {done[k]}</span> : null}</span>
          </li>
        ))}
      </ul>
      {err ? <p className="mt-2 text-[12px] text-[#ff8a7f]">{err}</p> : null}
      <p className="mono mt-3 text-[10.5px] text-[var(--ink-s)]">Last run {relTime(state.last_run_at)}{state.last_summary ? ` · ${state.last_summary}` : ""}</p>
    </div>
  );
}

function summarize(k, r) {
  if (k === "sync_checks") return `${r.created || 0} new checks`;
  if (k === "cluster") return `${r.clustered || 0} clustered, ${r.new_patterns || 0} new, ${r.proposed || 0} proposed`;
  if (k === "draft") return r.drafted?.length ? `${r.drafted.length} drafted` : "nothing new to fold in";
  return "done";
}

export function StatTiles({ logs, patterns, prompts, standards, checks }) {
  const learned = logs.filter((l) => inWeek(l.said_at || l.created_date)).length;
  const waiting = patterns.filter((p) => p.status === "proposed").length;
  const upgraded = prompts.filter((p) => p.status === "approved" && inWeek(p.approved_at)).length;
  const drafts = prompts.filter((p) => p.status === "draft").length;
  const added = standards.filter((s) => s.active !== false && inWeek(s.added_at)).length;
  const scored = checks.filter((c) => c.status !== "not_applicable");
  const pass = scored.filter((c) => c.status === "pass").length;
  const tiles = [
    ["Learned this week", learned, `${logs.length} requests logged in all`],
    ["Patterns waiting", waiting, waiting ? "need your call" : "queue clear"],
    ["Prompts upgraded", upgraded, `${drafts} draft${drafts === 1 ? "" : "s"} waiting`],
    ["Standards added", added, `${standards.filter((s) => s.active !== false).length} live · ${scored.length ? Math.round((pass / scored.length) * 100) : 0}% confirmed`],
  ];
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {tiles.map(([k, v, sub], i) => (
        <div key={k} className="card overflow-hidden px-3.5 py-3">
          {i === 1 && v ? <span className="run-border" /> : null}
          <p className="eyebrow !text-[9.5px]">{k}</p>
          <p className={`stat-big mt-2 ${v ? "flame-txt" : "text-white"}`}><CountUp value={v} duration={900} /></p>
          <p className="mt-1.5 truncate text-[11px] text-[var(--ink-s)]">{sub}</p>
        </div>
      ))}
    </div>
  );
}

export function Ticker({ logs, areas }) {
  const name = (id) => areas.find((a) => a.id === id)?.name || "Unsorted";
  const rows = logs.slice(0, 6);
  return (
    <div className="card p-4">
      <p className="eyebrow mb-2.5">Latest requests it learned from</p>
      {rows.length ? (
        <ul className="space-y-2">
          {rows.map((l, i) => (
            <li key={l.id} className="tick-row flex gap-2.5" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: l.pattern_id ? "#ff6a00" : "rgba(255,255,255,.3)", boxShadow: l.pattern_id ? "0 0 8px #ff6a00" : "none" }} />
              <div className="min-w-0">
                <p className="line-clamp-2 text-[12.5px] text-[var(--ink-d)]">{l.text}</p>
                <p className="mono mt-0.5 truncate text-[10px] text-[var(--ink-s)]">{l.client_name || "Interstellar"} · {name(l.area_id)} · {l.phase || "—"} · {relTime(l.said_at)}{l.pattern_id ? " · clustered" : ""}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : <p className="text-[12.5px] text-[var(--ink-s)]">Nothing logged yet.</p>}
    </div>
  );
}

const PHASES = ["build", "tweak", "polish", "launch", "maintain"];
export function TeachForm({ areas, clients, refresh }) {
  const [text, setText] = useState("");
  const [area, setArea] = useState("");
  const [client, setClient] = useState("");
  const [phase, setPhase] = useState("tweak");
  const [state, setState] = useState({ busy: false, msg: "" });
  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setState({ busy: true, msg: "" });
    try {
      const r = await logPrompts([{ text, area_id: area, client_id: client, phase, source: "manual" }]);
      setText("");
      setState({ busy: false, msg: r.redacted ? "Logged. Something that looked like a secret was removed." : "Logged. The agent clusters it on its next run." });
      refresh();
    } catch (er) {
      setState({ busy: false, msg: String(er.message || er) });
    }
  };
  return (
    <form onSubmit={submit} className="card p-4">
      <p className="eyebrow mb-2">Teach it a request</p>
      <textarea className="inp w-full" rows={2} value={text} onChange={(e) => setText(e.target.value)} placeholder="Something you asked for again (never paste passwords or keys)" aria-label="Request text" />
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <select className="inp" value={area} onChange={(e) => setArea(e.target.value)} aria-label="Area"><option value="">Area: let it decide</option>{areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}</select>
        <select className="inp" value={client} onChange={(e) => setClient(e.target.value)} aria-label="Client"><option value="">Interstellar / all</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.business}</option>)}</select>
        <select className="inp" value={phase} onChange={(e) => setPhase(e.target.value)} aria-label="Phase">{PHASES.map((p) => <option key={p} value={p}>{p}</option>)}</select>
        <button type="submit" className="btn-d" disabled={state.busy || !text.trim()}>{state.busy ? <Spinner size={12} /> : <Send className="h-3.5 w-3.5" />}Log it</button>
      </div>
      {state.msg ? <p className="mt-2 text-[11.5px] text-[var(--ink-m)]">{state.msg}</p> : null}
    </form>
  );
}
