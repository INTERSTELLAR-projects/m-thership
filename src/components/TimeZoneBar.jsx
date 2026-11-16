import { useState, useEffect } from "react";
import BrandSwitcher from "@/features/brands/BrandSwitcher";
import ErrorBoundary from "@/components/ErrorBoundary";

const ZONES = [
  { label: "HI", tz: "Pacific/Honolulu" },
  { label: "AK", tz: "America/Anchorage" },
  { label: "PT", tz: "America/Los_Angeles" },
  { label: "MT", tz: "America/Denver" },
  { label: "CT", tz: "America/Chicago" },
  { label: "ET", tz: "America/New_York" },
];

const getTime = (tz) => new Date().toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", hour12: true });

export default function TimeZoneBar() {
  const [times, setTimes] = useState(() => ZONES.map((z) => getTime(z.tz)));
  useEffect(() => {
    const id = setInterval(() => setTimes(ZONES.map((z) => getTime(z.tz))), 15000);
    return () => clearInterval(id);
  }, []);

  return (
    <div data-no-trail className="sticky top-0 z-20 flex h-[38px] items-center overflow-x-auto border-b border-hair bg-canvas/95 px-3 backdrop-blur no-scrollbar md:px-6">
      {/* House of Brands: switch between brand dashboards (Interstellar, DIALD, ...). */}
      <ErrorBoundary compact where="brand switcher"><BrandSwitcher /></ErrorBoundary>
      <span className="mono-label mr-3 flex items-center gap-2 text-[10px] text-ink/50">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff3c00]" /> Systems live
      </span>
      {ZONES.map((z, i) => (
        <div key={z.label} className="flex items-center">
          <div className="flex items-center gap-1.5 px-3">
            <span className="mono-label text-[9.5px] text-ink/40">{z.label}</span>
            <span className="font-mono text-[11.5px] font-medium tabular-nums text-ink">{times[i]}</span>
          </div>
          {i < ZONES.length - 1 && <div className="h-3 w-px bg-hair" />}
        </div>
      ))}
    </div>
  );
}
