import { useState, useEffect, useRef } from "react";
import { X } from "lucide-react";

// ── Constants ────────────────────────────────────────────────────────────────
const MRR_GOAL = 10000;
const GOAL_PLAN = "14 more Ørbit SEO base-level subscriptions, supported by the Prestige referral programme";
const WEEKDAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function fmt$(n) { return "$" + Math.round(n).toLocaleString("en-US"); }

function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  const kw = ["Female","Sonia","Libby","Hazel","Kate","Serena","Stephanie","Google UK English Female"];
  return voices.find(v => v.lang.startsWith("en-GB") && kw.some(k => v.name.includes(k)))
    || voices.find(v => v.lang.startsWith("en-GB"))
    || voices.find(v => v.name.includes("Female"))
    || voices[0] || null;
}

function applyVoice(utt) {
  const v = pickVoice(); if (v) utt.voice = v;
  utt.rate = 0.97; utt.pitch = 1.0; utt.volume = 1.0;
}

// ── Arc reactor rings (SVG) ──────────────────────────────────────────────────
function ArcReactor({ pulse, isSpeaking }) {
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return (
    <div className="relative flex items-center justify-center" style={{ width: 220, height: 220 }}>
      {/* Outer glow */}
      <div className="absolute inset-0 rounded-full" style={{
        background: "radial-gradient(circle, rgba(63,198,255,0.08) 0%, transparent 70%)",
        filter: isSpeaking ? "blur(12px)" : "blur(6px)",
        transition: "filter 0.3s"
      }} />

      {/* SVG rings */}
      <svg width="220" height="220" className="absolute inset-0" style={{ overflow: "visible" }}>
        {/* Outermost ring – ticks */}
        <circle cx="110" cy="110" r="104" fill="none" stroke="#3FC6FF" strokeWidth="1" strokeOpacity="0.25" />
        {/* Rotating ring 1 */}
        <g style={{ transformOrigin: "110px 110px", animation: reduced ? "none" : "spin-cw 8s linear infinite" }}>
          <circle cx="110" cy="110" r="88" fill="none" stroke="#3FC6FF" strokeWidth="1.5" strokeOpacity="0.5"
            strokeDasharray="12 6" />
          <circle cx="110" cy="22" r="3" fill="#3FC6FF" opacity="0.8" />
          <circle cx="198" cy="110" r="3" fill="#3FC6FF" opacity="0.8" />
        </g>
        {/* Counter-rotating ring 2 */}
        <g style={{ transformOrigin: "110px 110px", animation: reduced ? "none" : "spin-ccw 5s linear infinite" }}>
          <circle cx="110" cy="110" r="72" fill="none" stroke="#F47C20" strokeWidth="1" strokeOpacity="0.6"
            strokeDasharray="4 20" />
          <rect x="108" y="40" width="4" height="10" fill="#F47C20" opacity="0.9" rx="1" />
        </g>
        {/* Inner ring */}
        <circle cx="110" cy="110" r="56" fill="none" stroke="#3FC6FF" strokeWidth="1" strokeOpacity="0.3" />
        {/* Core circle */}
        <circle cx="110" cy="110" r="36" fill="rgba(5,8,15,0.9)" stroke="#3FC6FF" strokeWidth="1.5" strokeOpacity="0.7" />
        {/* Orange inner glow */}
        <circle cx="110" cy="110" r="26"
          fill="rgba(244,124,32,0.15)"
          stroke="#F47C20"
          strokeWidth={isSpeaking ? "2.5" : "1.5"}
          strokeOpacity="0.9"
          style={{ transition: "stroke-width 0.2s" }}
        />
      </svg>

      {/* Central pulse dot */}
      <div style={{
        width: 20, height: 20, borderRadius: "50%",
        background: "radial-gradient(circle, #F47C20 0%, rgba(244,124,32,0.3) 100%)",
        boxShadow: isSpeaking
          ? `0 0 ${12 + pulse * 24}px ${6 + pulse * 12}px rgba(244,124,32,0.6)`
          : "0 0 12px 4px rgba(244,124,32,0.3)",
        transform: `scale(${1 + pulse * 0.4})`,
        transition: "box-shadow 0.1s, transform 0.1s"
      }} />
    </div>
  );
}

// ── Audio-bar visualizer ─────────────────────────────────────────────────────
function AudioBars({ isSpeaking, pulseRef }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);
  const barsRef = useRef(Array.from({ length: 32 }, () => 0.05));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const R = 118, CX = 150, CY = 150, BARS = 32;

    function draw() {
      ctx.clearRect(0, 0, 300, 300);
      const speaking = isSpeaking;
      const spike = pulseRef.current;

      barsRef.current = barsRef.current.map((v, i) => {
        const target = speaking
          ? 0.05 + Math.random() * (0.45 + spike * 0.5) + Math.sin(Date.now() / 300 + i) * 0.1
          : 0.03 + Math.sin(Date.now() / 1200 + i * 0.4) * 0.025 + 0.02;
        return v + (target - v) * 0.18;
      });

      for (let i = 0; i < BARS; i++) {
        const angle = (i / BARS) * Math.PI * 2 - Math.PI / 2;
        const h = barsRef.current[i] * 36;
        const x1 = CX + Math.cos(angle) * R;
        const y1 = CY + Math.sin(angle) * R;
        const x2 = CX + Math.cos(angle) * (R + h);
        const y2 = CY + Math.sin(angle) * (R + h);
        const alpha = 0.4 + barsRef.current[i] * 1.2;
        ctx.strokeStyle = speaking ? `rgba(63,198,255,${Math.min(alpha, 1)})` : `rgba(63,198,255,0.2)`;
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
      }
      rafRef.current = requestAnimationFrame(draw);
    }
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [isSpeaking]);

  return <canvas ref={canvasRef} width={300} height={300} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />;
}

// ── Boot log ─────────────────────────────────────────────────────────────────
function BootLog({ onDone }) {
  const lines = ["INITIALIZING…", "INTERSTELLAR OS ONLINE", "GOOD MORNING, JUSTIN."];
  const [shown, setShown] = useState([]);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const step = () => {
      if (i < lines.length) {
        setShown(prev => [...prev, lines[i++]]);
        setTimeout(step, i === lines.length ? 500 : 320);
      } else {
        setTimeout(() => { setDone(true); setTimeout(onDone, 400); }, 300);
      }
    };
    step();
  }, []);

  return (
    <div style={{
      opacity: done ? 0 : 1,
      transition: "opacity 0.4s",
      position: "absolute", inset: 0, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 10, zIndex: 10
    }}>
      <div style={{ width: 2, height: "100%", position: "absolute", top: 0, left: "50%",
        background: "linear-gradient(to bottom, transparent, #3FC6FF, transparent)",
        animation: "scan-line 1.2s ease-out forwards", pointerEvents: "none" }} />
      {shown.map((l, i) => (
        <p key={i} style={{
          fontFamily: "monospace", color: i === shown.length - 1 ? "#F47C20" : "#3FC6FF",
          fontSize: i === shown.length - 1 ? 22 : 13,
          letterSpacing: "0.25em", textTransform: "uppercase",
          textShadow: `0 0 12px ${i === shown.length - 1 ? "#F47C20" : "#3FC6FF"}`,
          animation: "fade-in 0.25s ease-out"
        }}>{l}</p>
      ))}
    </div>
  );
}

// ── HUD Panel ────────────────────────────────────────────────────────────────
function HudPanel({ title, active, done, children, style }) {
  return (
    <div style={{
      background: "rgba(5,8,15,0.75)",
      backdropFilter: "blur(6px)",
      border: `1px solid ${active ? "#F47C20" : done ? "rgba(63,198,255,0.3)" : "rgba(63,198,255,0.15)"}`,
      borderRadius: 12,
      padding: "14px 16px",
      boxShadow: active ? "0 0 20px rgba(244,124,32,0.25), inset 0 0 12px rgba(244,124,32,0.05)"
        : done ? "0 0 8px rgba(63,198,255,0.1)" : "none",
      transition: "border-color 0.3s, box-shadow 0.3s",
      opacity: done ? 0.55 : active ? 1 : 0.7,
      ...style
    }}>
      <p style={{
        fontFamily: "monospace", fontSize: 9, letterSpacing: "0.22em",
        color: active ? "#F47C20" : "#3FC6FF", textTransform: "uppercase",
        marginBottom: 8, textShadow: active ? "0 0 8px #F47C20" : "0 0 6px #3FC6FF"
      }}>
        {active && "▶ "}{done && "✓ "}{title}
      </p>
      <div style={{ color: "#C8E8FF", fontFamily: "monospace", fontSize: 11, lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  );
}

// ── Main HUD overlay ─────────────────────────────────────────────────────────
export default function BriefingHUD({ data, onClose }) {
  const { tasks, orbitClients, mrr, weekday, month, day } = data;
  const arr = mrr * 12;
  const gap = MRR_GOAL - mrr;
  const mrrProgress = Math.min((mrr / MRR_GOAL) * 100, 100);

  // section index: 0=greeting, 1=tasks, 2=orbit, 3=financial, 4=signoff
  const [section, setSection] = useState(-1); // -1 = boot
  const [booted, setBooted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const [time, setTime] = useState(new Date());
  const pulseRef = useRef(0);
  const utterancesRef = useRef([]);
  const cancelledRef = useRef(false);
  const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

  // Fade in
  useEffect(() => { requestAnimationFrame(() => setVisible(true)); }, []);

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Pulse loop
  useEffect(() => {
    if (!isSpeaking) { setPulse(0); pulseRef.current = 0; return; }
    let raf;
    const tick = () => {
      const v = 0.3 + Math.sin(Date.now() / 180) * 0.2 + Math.random() * 0.15;
      setPulse(v); pulseRef.current = v;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [isSpeaking]);

  // Esc key
  useEffect(() => {
    const handler = (e) => { if (e.key === "Escape") dismiss(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => { cancelledRef.current = true; window.speechSynthesis.cancel(); };
  }, []);

  const dismiss = () => {
    cancelledRef.current = true;
    window.speechSynthesis.cancel();
    setExiting(true);
    setTimeout(onClose, 500);
  };

  const startBriefing = () => {
    if (cancelledRef.current) return;
    window.speechSynthesis.cancel();

    const today = new Date();
    const todayDow = today.getDay();

    const taskTitles = (tasks || []).map(t => t.title).filter(Boolean);
    const todayOrbit = (orbitClients || []).filter(c => (c.blogDays || []).includes(todayDow) && c.status === "Active");

    const scripts = [
      `Good morning, Justin. Here's your briefing for ${weekday}, ${month} ${day}.`,
      taskTitles.length === 0
        ? "Your priority list is clear today — nice work staying ahead."
        : (() => {
            const spoken = taskTitles.slice(0, 5);
            const extra = taskTitles.length > 5 ? ` …and ${taskTitles.length - 5} more on your dashboard.` : "";
            return `Your priority tasks for today. You have ${taskTitles.length} on the list: ${spoken.join(", ")}.${extra}`;
          })(),
      todayOrbit.length === 0
        ? "Nothing scheduled on Orbit SEO today."
        : (() => {
            const names = todayOrbit.slice(0, 5).map(c => c.businessName);
            const extra = todayOrbit.length > 5 ? " …and a few more on your dashboard." : "";
            return `Your Orbit SEO schedule. Today you're focused on ${names.join(", ")}.${extra}`;
          })(),
      (() => {
        const gapText = gap > 0 ? `${fmt$(gap)} to go` : "you've hit your goal — brilliant";
        return `Your financial snapshot. Monthly recurring revenue sits at ${fmt$(mrr)}. Annually, that's ${fmt$(arr)}. Your goal is ${fmt$(MRR_GOAL)} — ${gapText}. The plan: ${GOAL_PLAN}.`;
      })(),
      "That's everything. Have a wonderfully productive day.",
    ];

    let idx = 0;
    const speakNext = () => {
      if (cancelledRef.current || idx >= scripts.length) {
        setIsSpeaking(false);
        if (!cancelledRef.current) {
          // hold 3s then auto-close
          setTimeout(dismiss, 3000);
        }
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

  const taskTitles = (tasks || []).map(t => t.title).filter(Boolean);
  const todayOrbit = (orbitClients || []).filter(c => (c.blogDays || []).includes(new Date().getDay()) && c.status === "Active");

  return (
    <>
      {/* Keyframes injected once */}
      <style>{`
        @keyframes spin-cw  { from { transform: rotate(0deg);   } to { transform: rotate(360deg);  } }
        @keyframes spin-ccw { from { transform: rotate(0deg);   } to { transform: rotate(-360deg); } }
        @keyframes scan-line {
          0%   { transform: translateY(-100vh) scaleX(0.8); opacity: 0.8; }
          100% { transform: translateY(100vh)  scaleX(0.8); opacity: 0; }
        }
        @keyframes fade-in  { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes grid-drift {
          0%   { background-position: 0 0; }
          100% { background-position: 40px 40px; }
        }
        @keyframes particle-float {
          0%,100% { transform: translateY(0px) translateX(0px); opacity:0.4; }
          50%      { transform: translateY(-18px) translateX(8px); opacity: 0.7; }
        }
      `}</style>

      {/* Backdrop */}
      <div
        onClick={dismiss}
        style={{
          position: "fixed", inset: 0, zIndex: 1000,
          background: "rgba(5,8,15,0.92)",
          backdropFilter: "blur(8px)",
          opacity: exiting ? 0 : visible ? 1 : 0,
          transform: exiting ? "scale(1.04)" : visible ? "scale(1)" : "scale(1.04)",
          transition: "opacity 0.5s ease, transform 0.5s ease",
        }}
      >
        {/* Grid texture */}
        <div style={{
          position: "absolute", inset: 0, pointerEvents: "none",
          backgroundImage: "linear-gradient(rgba(63,198,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(63,198,255,0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
          animation: reduced ? "none" : "grid-drift 8s linear infinite",
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
            position: "absolute", top: p.top, left: p.left,
            width: p.size, height: p.size, borderRadius: "50%",
            background: "#3FC6FF", opacity: 0.4,
            animation: `particle-float ${3 + i * 0.7}s ease-in-out infinite`,
            animationDelay: p.delay,
            boxShadow: "0 0 4px #3FC6FF",
          }} />
        ))}

        {/* Header strip */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0,
          borderBottom: "1px solid rgba(63,198,255,0.15)",
          padding: "10px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }} onClick={e => e.stopPropagation()}>
          <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.2em", color: "#3FC6FF", opacity: 0.7 }}>
            INTERSTELLAR COMMAND OS // DAILY BRIEFING
          </span>
          <span style={{ fontFamily: "monospace", fontSize: 10, letterSpacing: "0.15em", color: "#3FC6FF", opacity: 0.5 }}>
            {dateStr} &nbsp;·&nbsp; {timeStr} &nbsp;·&nbsp; SYSTEM STATUS: ONLINE
          </span>
          <button
            onClick={dismiss}
            style={{
              background: "rgba(244,124,32,0.1)", border: "1px solid rgba(244,124,32,0.3)",
              borderRadius: 6, padding: "4px 12px", color: "#F47C20",
              fontFamily: "monospace", fontSize: 10, letterSpacing: "0.15em",
              cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
            }}
          >
            <X size={10} /> EXIT
          </button>
        </div>

        {/* Main layout */}
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: "absolute", inset: 0, top: 44,
            display: "grid",
            gridTemplateColumns: "1fr 300px 1fr",
            gridTemplateRows: "1fr auto",
            gap: 16,
            padding: "20px 28px 24px",
            alignItems: "center",
          }}
        >
          {/* TOP-LEFT: Priority Tasks */}
          <HudPanel title="Priority Tasks // In Progress" active={section === 1} done={section > 1}
            style={{ alignSelf: "center", maxHeight: 200, overflowY: "auto" }}>
            {taskTitles.length === 0
              ? <span style={{ color: "#3FC6FF", opacity: 0.5 }}>ALL CLEAR</span>
              : taskTitles.slice(0, 7).map((t, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                  <span style={{ color: section === 1 ? "#F47C20" : "#3FC6FF", marginTop: 1 }}>◆</span>
                  <span style={{ opacity: 0.85 }}>{t}</span>
                </div>
              ))}
            {taskTitles.length > 7 && <div style={{ color: "#3FC6FF", opacity: 0.5, marginTop: 4 }}>+{taskTitles.length - 7} more…</div>}
          </HudPanel>

          {/* CENTER: Arc reactor + visualizer */}
          <div style={{ position: "relative", width: 300, height: 300, margin: "0 auto", justifySelf: "center", alignSelf: "center" }}>
            <AudioBars isSpeaking={isSpeaking} pulseRef={pulseRef} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ArcReactor pulse={pulse} isSpeaking={isSpeaking} />
            </div>
            {/* Section label below core */}
            <div style={{
              position: "absolute", bottom: -32, left: 0, right: 0,
              textAlign: "center", fontFamily: "monospace", fontSize: 10,
              letterSpacing: "0.2em", color: "#F47C20",
              textShadow: "0 0 8px #F47C20", opacity: section >= 0 ? 1 : 0,
              transition: "opacity 0.3s",
            }}>
              {["GREETING", "PRIORITY TASKS", "ORBIT SEO", "FINANCIALS", "SIGNING OFF"][section] || ""}
            </div>
          </div>

          {/* TOP-RIGHT: Orbit SEO */}
          <HudPanel title="Orbit SEO // Today's Schedule" active={section === 2} done={section > 2}
            style={{ alignSelf: "center", maxHeight: 200, overflowY: "auto" }}>
            {todayOrbit.length === 0
              ? <span style={{ color: "#3FC6FF", opacity: 0.5 }}>ALL CLEAR</span>
              : todayOrbit.slice(0, 7).map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                  <span style={{ color: section === 2 ? "#F47C20" : "#3FC6FF", marginTop: 1 }}>◆</span>
                  <span style={{ opacity: 0.85 }}>{c.businessName}</span>
                </div>
              ))}
            {todayOrbit.length > 7 && <div style={{ color: "#3FC6FF", opacity: 0.5, marginTop: 4 }}>+{todayOrbit.length - 7} more…</div>}
          </HudPanel>

          {/* BOTTOM: Financial */}
          <div style={{ gridColumn: "1 / -1" }}>
            <HudPanel title="Financial Snapshot" active={section === 3} done={section > 3}>
              <div style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
                {/* Big numbers */}
                <div style={{ display: "flex", gap: 28 }}>
                  {[
                    { label: "MRR", value: fmt$(mrr), highlight: true },
                    { label: "ARR", value: fmt$(arr) },
                    { label: "GOAL", value: fmt$(MRR_GOAL) },
                    { label: "GAP", value: gap > 0 ? fmt$(gap) : "ACHIEVED", color: gap > 0 ? "#F47C20" : "#4ADE80" },
                  ].map(m => (
                    <div key={m.label} style={{ textAlign: "center" }}>
                      <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "#3FC6FF", opacity: 0.6, marginBottom: 3 }}>{m.label}</div>
                      <div style={{
                        fontSize: 22, fontWeight: "bold", letterSpacing: "0.05em",
                        color: m.color || (m.highlight ? "#F47C20" : "#E6F4FF"),
                        textShadow: `0 0 12px ${m.color || (m.highlight ? "#F47C20" : "#3FC6FF")}`,
                      }}>{m.value}</div>
                    </div>
                  ))}
                </div>

                {/* Progress arc (bar) */}
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 9, letterSpacing: "0.15em", color: "#3FC6FF", opacity: 0.6 }}>PROGRESS TO GOAL</span>
                    <span style={{ fontSize: 9, color: "#F47C20" }}>{mrrProgress.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 4, background: "rgba(63,198,255,0.1)", borderRadius: 2, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", borderRadius: 2,
                      background: "linear-gradient(90deg, #F47C20, #FFB366)",
                      width: section >= 3 ? `${mrrProgress}%` : "0%",
                      transition: "width 1.5s ease",
                      boxShadow: "0 0 8px rgba(244,124,32,0.5)",
                    }} />
                  </div>
                  <div style={{ marginTop: 8, fontSize: 10, color: "#3FC6FF", opacity: 0.65, letterSpacing: "0.05em" }}>
                    PLAN: {GOAL_PLAN}
                  </div>
                </div>
              </div>
            </HudPanel>
          </div>
        </div>

        {/* Boot overlay */}
        {!booted && (
          <div style={{ position: "absolute", inset: 0, top: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={e => e.stopPropagation()}>
            <BootLog onDone={() => { setBooted(true); startBriefing(); }} />
          </div>
        )}
      </div>
    </>
  );
}