import { useState, useEffect, useRef, useCallback } from "react";
import { Volume2, Square, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";

const MRR_GOAL = 10000;
const GOAL_PLAN = "14 more Ørbit SEO base level subscriptions, supported by the Prestige referral programme";

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatCurrency(n) {
  return "$" + n.toLocaleString("en-US");
}

// Get today's day-of-week number (0=Sun)
function todayDow() {
  return new Date().getDay();
}

function pickVoice() {
  const voices = window.speechSynthesis.getVoices();
  const gbFemaleKeywords = ["Female", "Sonia", "Libby", "Hazel", "Kate", "Serena", "Stephanie", "Google UK English Female"];

  // Priority 1: en-GB + female name
  const p1 = voices.find(v => v.lang.startsWith("en-GB") && gbFemaleKeywords.some(k => v.name.includes(k)));
  if (p1) return p1;
  // Priority 2: any en-GB
  const p2 = voices.find(v => v.lang.startsWith("en-GB"));
  if (p2) return p2;
  // Priority 3: any voice with "Female" in name
  const p3 = voices.find(v => v.name.includes("Female"));
  if (p3) return p3;
  // Priority 4: default
  return voices[0] || null;
}

export default function DailyBriefing() {
  const [isNew, setIsNew] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [showTranscript, setShowTranscript] = useState(false);
  const [supported, setSupported] = useState(true);
  const [voicesReady, setVoicesReady] = useState(false);
  const cancelRef = useRef(false);

  // Check speech synthesis support + load voices
  useEffect(() => {
    if (!window.speechSynthesis) {
      setSupported(false);
      return;
    }
    const loadVoices = () => {
      const v = window.speechSynthesis.getVoices();
      if (v.length > 0) setVoicesReady(true);
    };
    loadVoices();
    window.speechSynthesis.addEventListener("voiceschanged", loadVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", loadVoices);
  }, []);

  // Once-per-day highlight logic
  useEffect(() => {
    const last = localStorage.getItem("lastBriefingDate");
    if (last !== getTodayKey()) setIsNew(true);
  }, []);

  // Cancel speech on unmount / navigation
  useEffect(() => {
    return () => {
      cancelRef.current = true;
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const buildScript = async () => {
    const today = new Date();
    const weekday = WEEKDAY_NAMES[today.getDay()];
    const month = MONTH_NAMES[today.getMonth()];
    const day = today.getDate();
    const todayDowNum = today.getDay();

    // Fetch data in parallel
    const [tasks, orbitClients, crmClients] = await Promise.all([
      base44.entities.ToDoItem.filter({ status: "Pending", category: "Priority" }, "-created_date", 50),
      base44.entities.OrbitSEOClient.list("-created_date", 200),
      base44.entities.CRMClient.filter({ status: "Active" }, "business", 200),
    ]);

    // 1. Greeting
    const greeting = `Good morning, Justin. Here's your briefing for ${weekday}, ${month} ${day}.`;

    // 2. Priority tasks
    const taskTitles = (tasks || []).map(t => t.title).filter(Boolean);
    let taskLine;
    if (taskTitles.length === 0) {
      taskLine = "Your priority list is clear today — nice work staying ahead.";
    } else {
      const spoken = taskTitles.slice(0, 5);
      const overflow = taskTitles.length > 5 ? ` …and ${taskTitles.length - 5} more on your dashboard.` : "";
      taskLine = `First, your priority tasks for today. You have ${taskTitles.length} on the list: ${spoken.join(", ")}.${overflow}`;
    }

    // 3. Orbit SEO schedule — clients with blog posts scheduled today
    const todayClients = (orbitClients || []).filter(c =>
      (c.blogDays || []).includes(todayDowNum) && c.status === "Active"
    );
    let orbitLine;
    if (todayClients.length === 0) {
      orbitLine = "Nothing scheduled on Orbit SEO today.";
    } else {
      const names = todayClients.slice(0, 5).map(c => c.businessName);
      const overflow = todayClients.length > 5 ? ` …and a few more on your dashboard.` : "";
      orbitLine = `Next, your Orbit SEO schedule. Today you're focused on ${names.join(", ")}.${overflow}`;
    }

    // 4. Financial snapshot
    const mrr = (crmClients || []).reduce((sum, c) =>
      sum + (c.services || []).reduce((s, sv) => s + (sv.price || 0), 0), 0
    );
    const arr = mrr * 12;
    const gap = MRR_GOAL - mrr;
    const gapText = gap > 0 ? `${formatCurrency(gap)} to go` : "you've hit your goal — brilliant";
    const finLine = `Now your financial snapshot. Your monthly recurring revenue currently sits at ${formatCurrency(mrr)}. Annually, that's ${formatCurrency(arr)}. Your monthly recurring revenue goal is ${formatCurrency(MRR_GOAL)} — that leaves you ${gapText}. The plan to get there: ${GOAL_PLAN}.`;

    // 5. Sign-off
    const signoff = "That's everything. Have a wonderfully productive day.";

    return [greeting, taskLine, orbitLine, finLine, signoff].join(" ");
  };

  const speak = async () => {
    if (!supported) return;

    // Stop if already speaking
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }

    setLoading(true);
    cancelRef.current = false;

    // Mark as seen (clear "new" highlight)
    localStorage.setItem("lastBriefingDate", getTodayKey());
    setIsNew(false);

    const script = await buildScript();

    if (cancelRef.current) { setLoading(false); return; }

    setTranscript(script);
    setShowTranscript(true);
    setLoading(false);

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(script);
    utterance.rate = 0.97;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;

    // Assign voice — may need to wait a tick if voices aren't loaded
    const assignVoice = () => {
      const v = pickVoice();
      if (v) utterance.voice = v;
    };
    assignVoice();

    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  if (!supported) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/25 text-xs">
        <Volume2 className="w-3.5 h-3.5" />
        Voice not supported on this device
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {/* Main button */}
      <button
        onClick={speak}
        disabled={loading}
        className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all ${
          speaking
            ? "bg-orange-500/20 border-orange-500/40 text-orange-400"
            : isNew
            ? "bg-orange-500/15 border-orange-500/30 text-orange-400 animate-pulse"
            : "bg-white/[0.05] border-white/[0.08] text-white/60 hover:text-white/80 hover:bg-white/[0.08]"
        }`}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : speaking ? (
          <Square className="w-3.5 h-3.5 fill-orange-400" />
        ) : (
          <Volume2 className="w-3.5 h-3.5" />
        )}
        {speaking ? "Stop" : "Daily Briefing"}
        {isNew && !speaking && (
          <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-orange-500 border border-black flex items-center justify-center text-[8px] font-bold text-white">!</span>
        )}
      </button>

      {/* Transcript toggle */}
      {transcript && (
        <button
          onClick={() => setShowTranscript(!showTranscript)}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-[10px] text-white/30 hover:text-white/60 border border-white/[0.06] hover:border-white/[0.12] transition-all"
        >
          {showTranscript ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          Transcript
        </button>
      )}

      {/* Transcript panel — rendered below in the page flow via portal-less approach; the Dashboard will render it */}
      {transcript && showTranscript && (
        <div className="fixed bottom-6 right-6 z-50 w-[420px] max-h-64 bg-card border border-orange-500/20 rounded-xl shadow-xl overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.06] shrink-0">
            <span className="text-white/50 text-[10px] uppercase tracking-widest font-semibold">Briefing Transcript</span>
            <button onClick={() => setShowTranscript(false)} className="text-white/20 hover:text-white/60 text-xs">✕</button>
          </div>
          <div className="px-4 py-3 overflow-y-auto text-white/60 text-xs leading-relaxed">
            {transcript}
          </div>
        </div>
      )}
    </div>
  );
}