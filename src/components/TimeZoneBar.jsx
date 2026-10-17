import { useState, useEffect } from "react";

const ZONES = [
  { label: "HI",  tz: "Pacific/Honolulu" },
  { label: "AK",  tz: "America/Anchorage" },
  { label: "PT",  tz: "America/Los_Angeles" },
  { label: "MT",  tz: "America/Denver" },
  { label: "CT",  tz: "America/Chicago" },
  { label: "ET",  tz: "America/New_York" },
];

function getTime(tz) {
  return new Date().toLocaleTimeString("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function TimeZoneBar() {
  const [times, setTimes] = useState(() => ZONES.map((z) => getTime(z.tz)));

  useEffect(() => {
    const update = () => setTimes(ZONES.map((z) => getTime(z.tz)));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative z-20 flex items-center gap-0 border-b border-white/[0.05] bg-black/40 backdrop-blur-sm px-3 py-1.5 overflow-x-auto no-scrollbar md:px-6">
      {ZONES.map((z, i) => (
        <div key={z.label} className="flex items-center">
          <div className="flex items-center gap-1.5 px-3">
            <span className="font-orbitron text-white/25 text-[9px] tracking-[0.18em] uppercase">{z.label}</span>
            <span className="font-orbitron text-orange-500/80 text-[11px] font-semibold tracking-wide">{times[i]}</span>
          </div>
          {i < ZONES.length - 1 && <div className="w-px h-3 bg-white/10" />}
        </div>
      ))}
    </div>
  );
}