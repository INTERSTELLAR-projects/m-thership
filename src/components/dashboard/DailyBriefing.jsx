import { useState, useEffect, useRef } from "react";
import { Volume2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import BriefingHUD from "./BriefingHUD";

const WEEKDAY_NAMES = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
const MONTH_NAMES = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function getTodayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function DailyBriefing() {
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hudData, setHudData] = useState(null);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    if (!window.speechSynthesis) { setSupported(false); return; }
    // Preload voices
    const load = () => window.speechSynthesis.getVoices();
    load();
    window.speechSynthesis.addEventListener("voiceschanged", load);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", load);
  }, []);

  useEffect(() => {
    if (localStorage.getItem("lastBriefingDate") !== getTodayKey()) setIsNew(true);
  }, []);

  const launch = async () => {
    if (loading || !supported) return;
    setLoading(true);

    localStorage.setItem("lastBriefingDate", getTodayKey());
    setIsNew(false);

    const [tasks, orbitClients, crmClients] = await Promise.all([
      base44.entities.ToDoItem.filter({ status: "In Progress" }, "-created_date", 50),
      base44.entities.OrbitSEOClient.list("-created_date", 200),
      base44.entities.CRMClient.filter({ status: "Active" }, "business", 200),
    ]);

    const mrr = (crmClients || []).reduce((sum, c) =>
      sum + (c.services || []).reduce((s, sv) => s + (sv.price || 0), 0), 0
    );

    let planToExecute = null;
    try {
      const rows = await base44.entities.AppSettings.filter({ key: "financial_panel" }, "-created_date", 1);
      if (rows[0]?.pageSettings?.planToExecute) planToExecute = rows[0].pageSettings.planToExecute;
    } catch (e) { /* ignore */ }

    const today = new Date();

    setHudData({
      tasks: tasks || [],
      orbitClients: orbitClients || [],
      mrr,
      planToExecute,
      weekday: WEEKDAY_NAMES[today.getDay()],
      month: MONTH_NAMES[today.getMonth()],
      day: today.getDate(),
    });
    setLoading(false);
  };

  if (!supported) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-white/25 text-xs">
        <Volume2 className="w-3.5 h-3.5" />
        Voice not supported
      </div>
    );
  }

  return (
    <>
      <button
        onClick={launch}
        disabled={loading}
        className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all ${
          isNew
            ? "bg-orange-500/15 border-orange-500/30 text-orange-400 animate-pulse"
            : "bg-white/[0.05] border-white/[0.08] text-white/60 hover:text-white/80 hover:bg-white/[0.08]"
        }`}
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Volume2 className="w-3.5 h-3.5" />}
        Daily Briefing
        {isNew && !loading && (
          <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-orange-500 border border-black flex items-center justify-center text-[8px] font-bold text-white">!</span>
        )}
      </button>

      {hudData && (
        <BriefingHUD
          data={hudData}
          onClose={() => { setHudData(null); window.speechSynthesis?.cancel(); }}
        />
      )}
    </>
  );
}