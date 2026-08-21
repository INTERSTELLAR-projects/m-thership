import { useState, useEffect, useRef } from "react";
import { X, Sparkles, ListChecks, Globe, TrendingUp, DollarSign, Rocket, CheckCircle2, ArrowUp, Target, Flame } from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────────
const MRR_GOAL = 10000;
const FALLBACK_PLAN = "14 more Ørbit SEO base-level subscriptions, supported by the Prestige referral programme";
const WEEKDAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

const STEPS = [
  { label: "Greeting", icon: Sparkles },
  { label: "Priority Tasks", icon: ListChecks },
  { label: "Orbit SEO", icon: Globe },
  { label: "30-Day Momentum", icon: TrendingUp },
  { label: "Financials", icon: DollarSign },
  { label: "Mission", icon: Rocket },
  { label: "Sign-off", icon: CheckCircle2 },
];

function fmt$(n) { return "$" + Math.round(n).toLocaleString("en-US"); }

function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  const kw = ["Google US English","Microsoft David","Microsoft Mark","Alex","Daniel","Oliver","Male"];
  return voices.find(v => kw.some(k => v.name.toLowerCase().includes(k.toLowerCase())))
    || voices.find(v => v.lang.startsWith("en-US") && /male|david|mark|alex/i.test(v.name))
    || voices.find(v => /male/i.test(v.name) && v.lang.startsWith("en"))
    || voices.find(v => v.lang.startsWith("en-US"))
    || voices[0] || null;
}

function applyVoice(utt) {
  const voices = window.speechSynthesis.getVoices();
  let v = null;
  try {
    const uri = localStorage.getItem("briefing_voice_uri");
    const name = localStorage.getItem("briefing_voice_name");
    if (uri) v = voices.find((x) => x.voiceURI === uri);
    if (!v && name) v = voices.find((x) => x.name === name);
  } catch (e) {}
  if (!v) v = pickVoice();
  if (v) utt.voice = v;
  utt.rate = 0.95; utt.pitch = 0.92; utt.volume = 1.0;
}

// ── Count-up helper for animated metrics ────────────────────────────────────
function CountUp({ target, prefix = "$", duration = 900 }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - start) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return <>{prefix}{Math.round(val).toLocaleString("en-US")}</>;
}

// ── Arc reactor (orange/yellow) ──────────────────────────────────────────────
function ArcReactor({ pulse, isSpeaking }) {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
      <div className="absolute inset-0 rounded-full" style={{
        background: "radial-gradient(circle, rgba(255,150,0,0.14) 0%, transparent 70%)",
        filter: isSpeaking ? "blur(14px)" : "blur(7px)",
        transition: "filter 0.3s",
      }} />
      <svg width="220" height="220" className="absolute inset-0" style={{ overflow: "visible" }}>
        <circle cx="110" cy="110" r="104" fill="none" stroke="#FACC15" strokeWidth="1" strokeOpacity="0.25" />
        <g style={{ transformOrigin: "110px 110px", animation: reduced ? "none" : "spin-cw 8s linear infinite" }}>
          <circle cx="110" cy="110" r="88" fill="none" stroke="#FF8C00" strokeWidth="1.5" strokeOpacity="0.55" strokeDasharray="12 6" />
          <circle cx="110" cy="22" r="3" fill="#FF8C00" opacity="0.85" />
          <circle cx="198" cy="110" r="3" fill="#FF8C00" opacity="0.85" />
        </g>
        <g style={{ transformOrigin: "110px 110px", animation: reduced ? "none" : "spin-ccw 5s linear infinite" }}>
          <circle cx="110" cy="110" r="72" fill="none" stroke="#FACC15" strokeWidth="1" strokeOpacity="0.6" strokeDasharray="4 20" />
          <rect x="108" y="40" width="4" height="10" fill="#F47C20" opacity="0.9" rx="1" />
        </g>
        <circle cx="110" cy="110" r="56" fill="none" stroke="#FF8C00" strokeWidth="1" strokeOpacity="0.3" />
        <circle cx="110" cy="110" r="36" fill="rgba(20,12,2,0.9)" stroke="#FACC15" strokeWidth="1.5" strokeOpacity="0.7" />
        <circle cx="110" cy="110" r="26"
          fill="rgba(244,124,32,0.18)" stroke="#F47C20"
          strokeWidth={isSpeaking ? "2.5" : "1.5"} strokeOpacity="0.95"
          style={{ transition: "stroke-width 0.2s" }} />
      </svg>
      <div style={{
        width: 20, height: 20, borderRadius: "50%",
        background: "radial-gradient(circle, #FFB300 0%, rgba(244,124,32,0.3) 100%)",
        boxShadow: isSpeaking
          ? `0 0 ${12 + pulse * 26}px ${6 + pulse * 12}px rgba(255,170,0,0.65)`
          : "0 0 12px 4px rgba(255,170,0,0.4)",
        transform: `scale(${1 + pulse * 0.4})`,
        transition: "box-shadow 0.1s, transform 0.1s",
      }} />
    </div>
  );
}

// ── Boot log ─────────────────────────────────────────────────────────────────
function BootLog({ onDone }) {
  const lines = ["INITIALIZING…", "INTERSTELLAR OS ONLINE", "GOOD MORNING, JUSTIN."];
  const [shown, setShown] = useState([]);
  const [done, setDone] = useState(false);
  useEffect(() => {
    let i = 0;
    const step = () => {
      if (i < lines.length) { setShown(prev => [...prev, lines[i++]]); setTimeout(step, i === lines.length ? 500 : 320); }
      else { setTimeout(() => { setDone(true); setTimeout(onDone, 400); }, 300); }
    };
    step();
  }, []);
  return (
    <div style={{
      opacity: done ? 0 : 1, transition: "opacity 0.4s",
      position: "absolute", inset: 0, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 10, zIndex: 10,
    }}>
      <div style={{ width: 2, height: "100%", position: "absolute", top: 0, left: "50%",
        background: "linear-gradient(to bottom, transparent, #FF8C00, transparent)",
        animation: "scan-line 1.2s ease-out forwards", pointerEvents: "none" }} />
      {shown.map((l, i) => (
        <p key={i} style={{
          fontFamily: "monospace", color: i === shown.length - 1 ? "#F47C20" : "#FACC15",
          fontSize: i === shown.length - 1 ? 22 : 13,
          letterSpacing: "0.25em", textTransform: "uppercase",
          textShadow: `0 0 12px ${i === shown.length - 1 ? "#F47C20" : "#FACC15"}`,
          animation: "fade-in 0.25s ease-out",
        }}>{l}</p>
      ))}
    </div>
  );
}

// ── Main HUD overlay ─────────────────────────────────────────────────────────
export default function BriefingHUD({ data, onClose }) {
  const {
    tasks, orbitClients, mrr = 0,
    pastMrr, mrrGained, clientsAdded30 = 0,
    planToExecute, weekday, month, day,
  } = data;

  const arr = mrr * 12;
  const gap = MRR_GOAL - mrr;
  const mrrProgress = Math.min((mrr / MRR_GOAL) * 100, 100);
  const GOAL_PLAN = planToExecute || FALLBACK_PLAN;

  const pastSafe = (typeof pastMrr === "number") ? pastMrr : mrr;
  const gainedSafe = (typeof mrrGained === "number") ? mrrGained : (mrr - pastSafe);
  const addedSafe = clientsAdded30 || 0;

  const [section, setSection] = useState(-1);
  const [booted, setBooted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [time, setTime] = useState(new Date());
  const [cycle, setCycle] = useState(0);
  const [badge, setBadge] = useState(null);
  const [voices, setVoices] = useState([]);
  const [selURI, setSelURI] = useState(() => (typeof localStorage !== "undefined" && localStorage.getItem("briefing_voice_uri")) || "");
  const [started, setStarted] = useState(false);
  const pulseRef = useRef(0);
  const cancelledRef = useRef(false);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  useEffect(() => {
    if (!isSpeaking) { setPulse(0); pulseRef.current = 0; return; }
    let raf;
    const tick = () => { const v = 0.3 + Math.sin(Date.now() / 180) * 0.2 + Math.random() * 0.15; setPulse(v); pulseRef.current = v; raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isSpeaking]);

  // Cycle highlight through list items while on tasks/orbit slides
  useEffect(() => {
    setCycle(0);
    if (section !== 1 && section !== 2) return;
    const id = setInterval(() => setCycle(c => c + 1), 2100);
    return () => clearInterval(id);
  }, [section]);

  // Achievement pop whenever a new section begins
  useEffect(() => {
    if (section <= 0) return;
    setBadge(`${STEPS[section].label} cleared`);
    const id = setTimeout(() => setBadge(null), 1700);
    return () => clearTimeout(id);
  }, [section]);

  // Load available speech voices
  useEffect(() => {
    const load = () => setVoices(window.speechSynthesis.getVoices());
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.onvoiceschanged = null; };
  }, []);

  const previewVoice = (v) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance("Good morning, Justin. Here is your daily briefing.");
    u.voice = v; u.rate = 0.95; u.pitch = 0.92; window.speechSynthesis.speak(u);
  };
  const selectVoice = (v) => {
    setSelURI(v.voiceURI);
    try { localStorage.setItem("briefing_voice_uri", v.voiceURI); localStorage.setItem("briefing_voice_name", v.name); } catch (e) {}
  };
  const beginBriefing = () => {
    window.speechSynthesis.cancel();
    setStarted(true);
    startBriefing();
  };


  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") dismiss(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
  useEffect(() => () => { cancelledRef.current = true; window.speechSynthesis.cancel(); }, []);

  const dismiss = () => { cancelledRef.current = true; window.speechSynthesis.cancel(); setExiting(true); setTimeout(onClose, 500); };

  const taskTitles = (tasks || []).map(t => t.title).filter(Boolean);
  const todayOrbit = (orbitClients || []).filter(c => (c.blogDays || []).includes(new Date().getDay()) && c.status === "Active");

  const startBriefing = () => {
    if (cancelledRef.current) return;
    window.speechSynthesis.cancel();
    const scripts = [
      `Good morning, Justin. Here is your daily briefing for ${weekday}, ${month} ${day}.`,
      taskTitles.length === 0
        ? "Your priority list is clear today — nice work staying ahead."
        : (() => {
            const spoken = taskTitles.slice(0, 5);
            const extra = taskTitles.length > 5 ? ` …and ${taskTitles.length - 5} more on your dashboard.` : "";
            return `Your priority tasks. You have ${taskTitles.length} on the list: ${spoken.join(", ")}.${extra}`;
          })(),
      todayOrbit.length === 0
        ? "Nothing scheduled on Orbit SEO today — clear runway."
        : (() => {
            const names = todayOrbit.slice(0, 5).map(c => c.businessName);
            const extra = todayOrbit.length > 5 ? " …and a few more on your dashboard." : "";
            return `Your Orbit SEO schedule. Today you're focused on ${names.join(", ")}.${extra}`;
          })(),
      (() => {
        const dir = gainedSafe >= 0 ? "up" : "down";
        return `Your momentum over the last 30 days. Recurring revenue went from ${fmt$(pastSafe)} to ${fmt$(mrr)}, ${dir} ${fmt$(Math.abs(gainedSafe))}. You added ${addedSafe} ${addedSafe === 1 ? "client" : "clients"} in that window.`;
      })(),
      (() => {
        const gapText = gap > 0 ? `${fmt$(gap)} to go` : "you've hit your goal — brilliant";
        return `Your financial snapshot. Monthly recurring revenue sits at ${fmt$(mrr)}. Annually, that's ${fmt$(arr)}. Your goal is ${fmt$(MRR_GOAL)} — ${gapText}.`;
      })(),
      (() => gap > 0
        ? `Here's your mission. ${GOAL_PLAN}. At ${fmt$(mrr)} a month, you're ${fmt$(gap)} from your ${fmt$(MRR_GOAL)} goal. Push hard today — land one more site this month and close that gap.`
        : `Here's your mission. ${GOAL_PLAN}. You've hit your goal — keep the momentum and aim higher.`)(),
      "That's everything, Justin. Have a wonderfully productive day.",
    ];

    let idx = 0;
    const speakNext = () => {
      if (cancelledRef.current || idx >= scripts.length) {
        setIsSpeaking(false);
        if (!cancelledRef.current) setTimeout(dismiss, 3000);
        return;
      }
      const utt = new SpeechSynthesisUtterance(scripts[idx]);
      applyVoice(utt);
      const currentIdx = idx;
      utt.onstart = () => { setSection(currentIdx); setIsSpeaking(true); };
      utt.onboundary = () => { pulseRef.current = Math.min(1, pulseRef.current + 0.4); };
      utt.onend = () => { idx++; speakNext(); };
      utt.onerror = () => { idx++; speakNext(); };
      window.speechSynthesis.speak(utt);
    };
    speakNext();
  };

  const timeStr = time.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const dateStr = `${WEEKDAY_NAMES[time.getDay()].toUpperCase()} ${time.getDate()} ${MONTH_NAMES[time.getMonth()].toUpperCase()} ${time.getFullYear()}`;

  const activeRow = (list) => list.length ? cycle % list.length : -1;

  return (
    <>
      <style>{`
        @keyframes spin-cw  { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spin-ccw { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        @keyframes scan-line { 0% { transform: translateY(-100vh) scaleX(0.8); opacity: 0.8; } 100% { transform: translateY(100vh) scaleX(0.8); opacity: 0; } }
        @keyframes fade-in  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes slide-in { from { opacity: 0; transform: translateY(16px) scale(0.985); } to { opacity: 1; transform: none; } }
        @keyframes grid-drift { 0% { background-position: 0 0; } 100% { background-position: 40px 40px; } }
        @keyframes particle-float { 0%,100% { transform: translateY(0px) translateX(0px); opacity:0.4; } 50% { transform: translateY(-18px) translateX(8px); opacity: 0.7; } }
        @keyframes goal-pulse { 0%,100% { box-shadow: 0 0 16px rgba(255,170,0,0.35); } 50% { box-shadow: 0 0 28px rgba(255,170,0,0.65); } }
        @keyframes badge-pop { from { opacity: 0; transform: translateY(10px) scale(0.9); } 12% { opacity: 1; transform: none; } 80% { opacity: 1; } to { opacity: 0; transform: translateY(-8px); } }
      `}</style>

      <div onClick={dismiss} style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(10,6,2,0.94)", backdropFilter: "blur(10px)",
        opacity: exiting ? 0 : visible ? 1 : 0,
        transform: exiting ? "scale(1.03)" : visible ? "scale(1)" : "scale(1.03)",
        transition: "opacity 0.5s ease, transform 0.5s ease",
      }}>
        {/* Grid */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "linear-gradient(rgba(255,150,0,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,150,0,0.035) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          animation: reduced ? "none" : "grid-drift 9s linear infinite",
        }} />
        {/* Particles */}
        {!reduced && [
          { top: "15%", left: "8%", delay: "0s", size: 3 },
          { top: "72%", left: "92%", delay: "1.3s", size: 2 },
          { top: "40%", left: "5%", delay: "2.1s", size: 2 },
          { top: "85%", left: "20%", delay: "0.7s", size: 3 },
          { top: "20%", left: "88%", delay: "1.8s", size: 2 },
          { top: "60%", left: "96%", delay: "3s", size: 2 },
        ].map((p, i) => (
          <div key={i} style={{
            position: "absolute", top: p.top, left: p.left, width: p.size, height: p.size, borderRadius: "50%",
            background: i % 2 ? "#FACC15" : "#FF8C00", opacity: 0.45,
            animation: `particle-float ${3 + i * 0.7}s ease-in-out infinite`, animationDelay: p.delay,
            boxShadow: "0 0 5px rgba(255,170,0,0.6)",
          }} />
        ))}

        {/* Header strip */}
        <div onClick={e => e.stopPropagation()} style={{
          position: "absolute", top: 0, left: 0, right: 0, borderBottom: "1px solid rgba(255,150,0,0.15)",
          padding: "10px 24px", display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.2em", color: "#FF8C00", opacity: 0.85 }}>
            INTERSTELLAR COMMAND OS // DAILY BRIEFING
          </span>
          <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.15em", color: "#FACC15", opacity: 0.6 }}>
            {dateStr} &nbsp;·&nbsp; {timeStr} &nbsp;·&nbsp; SYSTEM ONLINE
          </span>
          <button onClick={dismiss} style={{
            background: "rgba(244,124,32,0.12)", border: "1px solid rgba(244,124,32,0.35)",
            borderRadius: 6, padding: "4px 12px", color: "#FF8C00",
            fontFamily: "monospace", fontSize: 10, letterSpacing: "0.15em", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
          }}>
            <X size={10} /> EXIT
          </button>
        </div>

        {/* Main layout */}
        <div onClick={e => e.stopPropagation()} style={{
          position: "absolute", inset: 0, top: 44, display: "flex", gap: 20, padding: "24px 28px",
        }}>
          {/* Timeline */}
          <div style={{ width: 230, flexShrink: 0, display: "flex", flexDirection: "column", gap: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8, paddingBottom: 14, borderBottom: "1px solid rgba(255,150,0,0.12)" }}>
              <div style={{ width: 10, height: 10, borderRadius: "50%", background: "radial-gradient(circle,#FFB300,rgba(244,124,32,0.3))", boxShadow: "0 0 10px rgba(255,170,0,0.7)" }} />
              <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.22em", color: "#FACC15", opacity: 0.85 }}>BRIEFING SEQUENCE</span>
            </div>
            {STEPS.map((s, i) => {
              const active = section === i; const done = section > i;
              const Icon = s.icon;
              return (
                <div key={s.label} style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8,
                  border: `1px solid ${active ? "rgba(244,124,32,0.5)" : "rgba(255,150,0,0.08)"}`,
                  background: active ? "linear-gradient(90deg, rgba(244,124,32,0.16), rgba(250,204,21,0.04))" : "transparent",
                  boxShadow: active ? "0 0 16px rgba(255,170,0,0.25)" : "none",
                  opacity: done ? 0.5 : 1,
                  transition: "all 0.3s",
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center",
                    background: active ? "linear-gradient(135deg,#F47C20,#FACC15)" : "rgba(255,150,0,0.06)",
                    boxShadow: active ? "0 0 10px rgba(255,170,0,0.5)" : "none",
                  }}>
                    {done ? <CheckCircle2 size={14} color="#FACC15" /> : <Icon size={13} color={active ? "#1a0d00" : "#FF8C00"} />}
                  </div>
                  <span style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase",
                    color: active ? "#FFE7B3" : done ? "#FACC15" : "rgba(255,200,120,0.5)",
                    textShadow: active ? "0 0 8px rgba(255,170,0,0.5)" : "none" }}>
                    {s.label}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Stage */}
          <div style={{ flex: 1, position: "relative", minHeight: 0 }}>
            <div key={section} style={{
              height: "100%", overflowY: "auto",
              animation: "slide-in 0.45s ease-out both",
            }}>
              {/* 0 Greeting */}
              {section <= 0 && (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 18 }}>
                  <ArcReactor pulse={pulse} isSpeaking={isSpeaking} />
                  <div style={{ textAlign: "center" }}>
                    <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.3em", color: "#FACC15", opacity: 0.7, marginBottom: 10 }}>INTERSTELLAR COMMAND</p>
                    <h1 style={{ fontSize: 42, fontWeight: 800, letterSpacing: "0.08em", margin: 0,
                      background: "linear-gradient(90deg,#FF8C00,#FACC15)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent",
                      textShadow: "0 0 30px rgba(255,170,0,0.4)" }}>
                      GOOD MORNING, JUSTIN
                    </h1>
                    <p style={{ fontFamily: "monospace", fontSize: 13, letterSpacing: "0.2em", color: "#FFE7B3", opacity: 0.7, marginTop: 10 }}>
                      {weekday.toUpperCase()} · {month.toUpperCase()} {day}
                    </p>
                  </div>
                </div>
              )}

              {/* 1 Tasks */}
              {section === 1 && (
                <StageCard title="PRIORITY TASKS" sub={`${taskTitles.length} on the list`} icon={ListChecks}>
                  {taskTitles.length === 0
                    ? <Empty text="ALL CLEAR TODAY" />
                    : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {taskTitles.slice(0, 7).map((t, i) => (
                          <SpotlightRow key={i} active={activeRow(taskTitles.slice(0, 7)) === i} index={i + 1}>
                            {t}
                          </SpotlightRow>
                        ))}
                        {taskTitles.length > 7 && <div style={{ color: "#FACC15", opacity: 0.5, fontSize: 11, textAlign: "center", marginTop: 6 }}>+{taskTitles.length - 7} more on your dashboard</div>}
                      </div>}
                </StageCard>
              )}

              {/* 2 Orbit */}
              {section === 2 && (
                <StageCard title="ORBIT SEO · TODAY'S SCHEDULE" sub={`${todayOrbit.length} clients`} icon={Globe}>
                  {todayOrbit.length === 0
                    ? <Empty text="CLEAR RUNWAY" />
                    : <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {todayOrbit.slice(0, 7).map((c, i) => (
                          <SpotlightRow key={i} active={activeRow(todayOrbit.slice(0, 7)) === i} index={i + 1} accent="yellow">
                            {c.businessName}
                          </SpotlightRow>
                        ))}
                        {todayOrbit.length > 7 && <div style={{ color: "#FACC15", opacity: 0.5, fontSize: 11, textAlign: "center", marginTop: 6 }}>+{todayOrbit.length - 7} more</div>}
                      </div>}
                </StageCard>
              )}

              {/* 3 Momentum */}
              {section === 3 && (
                <StageCard title="30-DAY MOMENTUM" sub="revenue & client growth" icon={TrendingUp}>
                  <div className="slide-in" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 18 }}>
                    <Metric label="30 DAYS AGO" num={pastSafe} color="#FACC15" />
                    <Metric label="TODAY" num={mrr} color="#FF8C00" highlight />
                  </div>
                  <div className="slide-in" style={{
                    display: "flex", alignItems: "center", gap: 12, padding: "14px 16px", borderRadius: 12,
                    border: `1px solid ${gainedSafe >= 0 ? "rgba(74,222,128,0.3)" : "rgba(244,124,32,0.35)"}`,
                    background: gainedSafe >= 0 ? "rgba(74,222,128,0.06)" : "rgba(244,124,32,0.08)",
                    boxShadow: "0 0 16px rgba(255,170,0,0.15)",
                  }}>
                    <ArrowUp size={20} color={gainedSafe >= 0 ? "#4ADE80" : "#F47C20"} style={{ transform: gainedSafe >= 0 ? "none" : "rotate(180deg)" }} />
                    <div>
                      <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#FACC15", opacity: 0.7 }}>MRR {gainedSafe >= 0 ? "GAINED" : "DROPPED"}</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: gainedSafe >= 0 ? "#4ADE80" : "#F47C20" }}>
                        {gainedSafe >= 0 ? "+" : "−"}<CountUp target={Math.abs(gainedSafe)} prefix="$" />
                      </div>
                    </div>
                    <div style={{ marginLeft: "auto", textAlign: "right" }}>
                      <div style={{ fontSize: 10, letterSpacing: "0.2em", color: "#FACC15", opacity: 0.7 }}>NEW CLIENTS</div>
                      <div style={{ fontSize: 24, fontWeight: 800, color: "#FFE7B3" }}><CountUp target={addedSafe} prefix="" /></div>
                    </div>
                  </div>
                </StageCard>
              )}

              {/* 4 Financials */}
              {section === 4 && (
                <StageCard title="FINANCIAL SNAPSHOT" sub="monthly recurring revenue" icon={DollarSign}>
                  <div className="slide-in" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 22 }}>
                    <Metric label="MRR" num={mrr} color="#FF8C00" highlight />
                    <Metric label="ARR" num={arr} color="#FACC15" />
                    <Metric label="GOAL" num={MRR_GOAL} color="#FFE7B3" />
                    <Metric label="GAP" num={gap > 0 ? gap : undefined} value={gap > 0 ? undefined : "✓"} color={gap > 0 ? "#F47C20" : "#4ADE80"} />
                  </div>
                  <div className="slide-in">
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
                      <span style={{ fontSize: 10, letterSpacing: "0.15em", color: "#FACC15", opacity: 0.7 }}>PROGRESS TO GOAL</span>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#FF8C00" }}>{mrrProgress.toFixed(0)}%</span>
                    </div>
                    <div style={{ height: 10, background: "rgba(255,150,0,0.08)", borderRadius: 6, overflow: "hidden", border: "1px solid rgba(255,150,0,0.1)" }}>
                      <div style={{
                        height: "100%", borderRadius: 6,
                        background: "linear-gradient(90deg,#F47C20,#FF8C00,#FACC15)",
                        width: `${mrrProgress}%`, transition: "width 1.4s ease",
                        boxShadow: "0 0 12px rgba(255,170,0,0.6)",
                      }} />
                    </div>
                  </div>
                </StageCard>
              )}

              {/* 5 Mission */}
              {section === 5 && (
                <StageCard title="TODAY'S MISSION" sub="your push" icon={Rocket}>
                  <div className="slide-in" style={{
                    padding: "20px 22px", borderRadius: 14,
                    border: "1px solid rgba(244,124,32,0.45)",
                    background: "linear-gradient(135deg, rgba(244,124,32,0.14), rgba(250,204,21,0.05))",
                    marginBottom: 16, animation: "goal-pulse 2.4s ease-in-out infinite",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <Target size={14} color="#FF8C00" />
                      <span style={{ fontSize: 10, letterSpacing: "0.2em", color: "#FACC15", opacity: 0.85 }}>PLAN TO EXECUTE</span>
                    </div>
                    <p style={{ fontSize: 17, fontWeight: 700, color: "#FFE7B3", lineHeight: 1.5, margin: 0 }}>{GOAL_PLAN}</p>
                  </div>
                  <div className="slide-in" style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "16px 18px", borderRadius: 12,
                    border: "1px solid rgba(250,204,21,0.4)", background: "rgba(250,204,21,0.07)",
                  }}>
                    <Flame size={22} color="#FF8C00" />
                    <div>
                      <div style={{ fontSize: 11, letterSpacing: "0.18em", color: "#FACC15", opacity: 0.8 }}>THE PUSH</div>
                      <div style={{ fontSize: 19, fontWeight: 800, color: "#FFE7B3" }}>
                        {gap > 0 ? `Land ONE more site this month` : "Goal hit — aim higher"}
                      </div>
                      {gap > 0 && <div style={{ fontSize: 12, color: "#FF8C00", marginTop: 2 }}>{fmt$(gap)} from your {fmt$(MRR_GOAL)} goal</div>}
                    </div>
                  </div>
                </StageCard>
              )}

              {/* 6 Sign-off */}
              {section === 6 && (
                <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14 }}>
                  <CheckCircle2 size={48} color="#FACC15" style={{ filter: "drop-shadow(0 0 14px rgba(250,204,21,0.6))" }} />
                  <h2 style={{ fontSize: 30, fontWeight: 800, margin: 0,
                    background: "linear-gradient(90deg,#FF8C00,#FACC15)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
                    BRIEFING COMPLETE
                  </h2>
                  <p style={{ fontFamily: "monospace", fontSize: 13, letterSpacing: "0.2em", color: "#FFE7B3", opacity: 0.7 }}>
                    HAVE A PRODUCTIVE DAY, JUSTIN.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Gamified session XP bar */}
        <div style={{ position: "absolute", left: 28, right: 28, bottom: 16, pointerEvents: "none" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 5 }}>
            <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.22em", color: "#FACC15", opacity: 0.85 }}>SESSION XP</span>
            <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.15em", color: section >= 6 ? "#4ADE80" : "#FF8C00" }}>
              {section >= 0 ? `${String(section + 1).padStart(2, "0")} / 07` : "STANDBY"} · {section >= 0 ? STEPS[section].label.toUpperCase() : "READY"}
            </span>
          </div>
          <div style={{ height: 8, background: "rgba(255,150,0,0.08)", borderRadius: 4, overflow: "hidden", border: "1px solid rgba(255,150,0,0.12)" }}>
            <div style={{
              height: "100%", borderRadius: 4,
              background: section >= 6 ? "linear-gradient(90deg,#4ADE80,#FACC15)" : "linear-gradient(90deg,#F47C20,#FF8C00,#FACC15)",
              width: `${((Math.max(0, section) + 1) / STEPS.length) * 100}%`,
              transition: "width 0.7s ease",
              boxShadow: "0 0 12px rgba(255,170,0,0.6)",
            }} />
          </div>
        </div>

        {badge && section > 0 && (
          <div style={{
            position: "absolute", right: 32, bottom: 46, pointerEvents: "none",
            display: "flex", alignItems: "center", gap: 10,
            padding: "10px 16px", borderRadius: 10,
            border: "1px solid rgba(244,124,32,0.45)",
            background: "linear-gradient(135deg, rgba(244,124,32,0.18), rgba(250,204,21,0.06))",
            boxShadow: "0 0 20px rgba(255,170,0,0.3)",
            animation: "badge-pop 1.7s ease-out forwards",
          }}>
            <CheckCircle2 size={16} color="#FACC15" style={{ filter: "drop-shadow(0 0 6px rgba(250,204,21,0.7))" }} />
            <span style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.15em", color: "#FFE7B3", textTransform: "uppercase" }}>{badge}</span>
          </div>
        )}

        {booted && !started && (
          <VoicePicker
            voices={voices}
            selURI={selURI}
            onSelect={selectVoice}
            onPreview={previewVoice}
            onBegin={beginBriefing}
          />
        )}

        {!booted && (
          <div style={{ position: "absolute", inset: 0, top: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={e => e.stopPropagation()}>
            <BootLog onDone={() => setBooted(true)} />
          </div>
        )}
      </div>
    </>
  );
}

// ── Voice picker (shown before briefing begins) ───────────────────────────────
function VoicePicker({ voices, selURI, onSelect, onPreview, onBegin }) {
  const en = voices.filter((v) => v.lang && v.lang.toLowerCase().startsWith("en")).sort((a, b) => a.name.localeCompare(b.name));
  const list = en.length ? en : voices;
  return (
    <div style={{ position: "absolute", inset: 0, top: 44, zIndex: 20, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(12,8,2,0.6)", pointerEvents: "auto" }} onClick={(e) => e.stopPropagation()}>
      <div style={{ width: 540, maxHeight: "72vh", display: "flex", flexDirection: "column", borderRadius: 16, border: "1px solid rgba(244,124,32,0.4)", background: "linear-gradient(160deg, rgba(20,12,4,0.96), rgba(30,18,6,0.94))", boxShadow: "0 0 40px rgba(255,170,0,0.18)", overflow: "hidden" }}>
        <div style={{ padding: "18px 20px 12px", borderBottom: "1px solid rgba(255,150,0,0.12)" }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, letterSpacing: "0.08em", background: "linear-gradient(90deg,#FF8C00,#FACC15)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>SELECT BRIEFING VOICE</h2>
          <p style={{ margin: "4px 0 0", fontFamily: "monospace", fontSize: 10, letterSpacing: "0.15em", color: "#FACC15", opacity: 0.6 }}>TAP A VOICE · HIT PREVIEW TO HEAR IT</p>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "10px 12px", display: "flex", flexDirection: "column", gap: 6 }}>
          {list.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#FACC15", opacity: 0.5, fontFamily: "monospace", fontSize: 11 }}>LOADING VOICES…</div>}
          {list.map((v) => {
            const active = selURI === v.voiceURI;
            return (
              <div key={v.voiceURI} onClick={() => onSelect(v)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", borderRadius: 9, border: `1px solid ${active ? "rgba(244,124,32,0.55)" : "rgba(255,150,0,0.08)"}`, background: active ? "linear-gradient(90deg, rgba(244,124,32,0.16), transparent)" : "transparent", cursor: "pointer", transition: "all 0.2s" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", border: `2px solid ${active ? "#FF8C00" : "rgba(255,150,0,0.3)"}`, background: active ? "#FF8C00" : "transparent", boxShadow: active ? "0 0 8px rgba(255,170,0,0.6)" : "none" }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: active ? "#FFE7B3" : "rgba(255,220,180,0.85)", fontSize: 13, fontWeight: 600 }}>{v.name}</div>
                  <div style={{ color: "#FACC15", fontSize: 10, fontFamily: "monospace", opacity: 0.55 }}>{v.lang}</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onPreview(v); }} style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid rgba(244,124,32,0.4)", background: "rgba(244,124,32,0.1)", color: "#FF8C00", fontSize: 10, letterSpacing: "0.1em", cursor: "pointer" }}>PREVIEW</button>
              </div>
            );
          })}
        </div>
        <div style={{ padding: 14, borderTop: "1px solid rgba(255,150,0,0.12)", display: "flex", justifyContent: "flex-end" }}>
          <button onClick={onBegin} style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 22px", borderRadius: 10, border: "none", background: "linear-gradient(135deg,#F47C20,#FACC15)", color: "#1a0d00", fontWeight: 800, fontSize: 13, letterSpacing: "0.1em", cursor: "pointer", boxShadow: "0 0 18px rgba(255,170,0,0.4)" }}>BEGIN BRIEFING →</button>
        </div>
      </div>
    </div>
  );
}

// ── Stage primitives ──────────────────────────────────────────────────────────
function StageCard({ title, sub, icon: Icon, children }) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <div style={{ marginBottom: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#F47C20,#FACC15)", boxShadow: "0 0 12px rgba(255,170,0,0.4)" }}>
            <Icon size={16} color="#1a0d00" />
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "0.06em",
            background: "linear-gradient(90deg,#FF8C00,#FACC15)", WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>
            {title}
          </h2>
        </div>
        {sub && <p style={{ fontFamily: "monospace", fontSize: 11, letterSpacing: "0.18em", color: "#FACC15", opacity: 0.6, margin: "0 0 0 40px" }}>{sub.toUpperCase()}</p>}
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

function SpotlightRow({ children, active, index, accent = "orange" }) {
  const color = accent === "yellow" ? "#FACC15" : "#FF8C00";
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 14, padding: "13px 16px", borderRadius: 10,
      border: `1px solid ${active ? `${color}55` : "rgba(255,150,0,0.08)"}`,
      background: active
        ? `linear-gradient(90deg, ${accent === "yellow" ? "rgba(250,204,21,0.12)" : "rgba(244,124,32,0.14)"}, transparent)`
        : "rgba(255,150,0,0.02)",
      boxShadow: active ? `0 0 18px ${accent === "yellow" ? "rgba(250,204,21,0.25)" : "rgba(255,170,0,0.3)"}` : "none",
      transform: active ? "scale(1.015)" : "scale(1)",
      opacity: active ? 1 : 0.6,
      transition: "all 0.35s ease",
    }}>
      <span style={{ fontFamily: "monospace", fontSize: 11, color, opacity: 0.7, minWidth: 18 }}>{String(index).padStart(2, "0")}</span>
      <span style={{ fontSize: 15, fontWeight: 600, color: active ? "#FFE7B3" : "rgba(255,220,180,0.8)" }}>{children}</span>
      <span style={{ marginLeft: "auto", width: 6, height: 6, borderRadius: "50%", background: active ? color : "transparent", boxShadow: active ? `0 0 8px ${color}` : "none" }} />
    </div>
  );
}

function Metric({ label, value, num, prefix = "$", color, highlight }) {
  return (
    <div style={{
      padding: "14px 16px", borderRadius: 12,
      border: `1px solid ${highlight ? "rgba(244,124,32,0.4)" : "rgba(255,150,0,0.1)"}`,
      background: highlight ? "linear-gradient(135deg, rgba(244,124,32,0.12), rgba(250,204,21,0.04))" : "rgba(255,150,0,0.03)",
      boxShadow: highlight ? "0 0 16px rgba(255,170,0,0.2)" : "none",
    }}>
      <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#FACC15", opacity: 0.65, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, textShadow: highlight ? `0 0 12px ${color}` : "none" }}>
        {num !== undefined ? <CountUp target={num} prefix={prefix} /> : value}
      </div>
    </div>
  );
}

function Empty({ text }) {
  return <div style={{ textAlign: "center", padding: 40, fontFamily: "monospace", letterSpacing: "0.25em", color: "#FACC15", opacity: 0.5, fontSize: 16 }}>{text}</div>;
}