import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Smartphone, Monitor, Tablet } from "lucide-react";

// Counts up from the last value it showed, so a new scan visibly ticks the number.
export function TickingNumber({ value = 0, className = "" }) {
  const [shown, setShown] = useState(value);
  const [bump, setBump] = useState(false);
  const from = useRef(value);
  useEffect(() => {
    const start = from.current;
    if (start === value) return undefined;
    if (value > start) setBump(true);
    const t0 = performance.now();
    const dur = Math.min(1200, 250 + Math.abs(value - start) * 60);
    let raf = 0;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      setShown(Math.round(start + (value - start) * (1 - (1 - k) ** 3)));
      if (k < 1) raf = requestAnimationFrame(step);
      else {
        from.current = value;
        setTimeout(() => setBump(false), 500);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <span className={`inline-block tabular-nums transition-transform duration-300 ${bump ? "scale-110 text-[#ff3c00]" : ""} ${className}`}>
      {shown.toLocaleString()}
    </span>
  );
}

const DEVICE_ICON = { mobile: Smartphone, tablet: Tablet, desktop: Monitor };

export default function ScanStats({ store, codeId, live = false, compact = false }) {
  const q = useQuery({
    queryKey: ["qr-stats", store.kind, codeId],
    queryFn: () => store.stats(codeId),
    enabled: !!codeId,
    refetchInterval: live ? 4000 : 30000,
    refetchIntervalInBackground: false,
  });
  const s = q.data;
  if (!codeId) return null;
  if (q.isLoading) return <p className="text-[12.5px] text-ink/50">Loading scans…</p>;
  if (!s) return <p className="text-[12.5px] text-ink/50">No scan data yet.</p>;
  const devices = Object.entries(s.devices || {}).sort((a, b) => b[1] - a[1]);
  const top = Math.max(1, ...devices.map(([, n]) => n));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 border border-hair bg-paper">
        <div className="border-r border-hair px-3 py-3">
          <p className="text-[30px] font-semibold leading-none tracking-[-0.04em]"><TickingNumber value={s.total} /></p>
          <p className="mono-label mt-2 text-[9px] text-ink/50">Total scans</p>
        </div>
        <div className="border-r border-hair px-3 py-3">
          <p className="text-[30px] font-semibold leading-none tracking-[-0.04em]"><TickingNumber value={s.last7} /></p>
          <p className="mono-label mt-2 text-[9px] text-ink/50">Last 7 days</p>
        </div>
        <div className="px-3 py-3">
          <p className="text-[30px] font-semibold leading-none tracking-[-0.04em]"><TickingNumber value={s.today} /></p>
          <p className="mono-label mt-2 text-[9px] text-ink/50">Today</p>
        </div>
      </div>
      {!compact && (
        <>
          <div className="h-[110px] border border-hair bg-card px-1 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={s.series} margin={{ top: 4, right: 6, bottom: 0, left: 6 }}>
                <defs>
                  <linearGradient id="qrScanFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#ff6a00" stopOpacity={0.45} />
                    <stop offset="100%" stopColor="#ff6a00" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" hide />
                <Tooltip
                  cursor={{ stroke: "#ff3c00", strokeWidth: 1 }}
                  contentStyle={{ fontSize: 12, border: "1px solid #cfccc7", borderRadius: 0 }}
                  formatter={(v) => [v, "Scans"]}
                  labelFormatter={(d) => new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                />
                <Area type="monotone" dataKey="scans" stroke="#ff3c00" strokeWidth={2} fill="url(#qrScanFill)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mono-label -mt-2 text-[9px] text-ink/45">Last 30 days</p>
          {devices.length > 0 && (
            <ul className="space-y-1.5">
              {devices.map(([k, n]) => {
                const Icon = DEVICE_ICON[k] || Smartphone;
                return (
                  <li key={k} className="flex items-center gap-2 text-[12px]">
                    <Icon className="h-3.5 w-3.5 text-ink/50" />
                    <span className="w-16 capitalize text-ink/70">{k}</span>
                    <span className="h-1.5 flex-1 bg-ink/[0.07]"><span className="block h-full flame-bg" style={{ width: `${(n / top) * 100}%` }} /></span>
                    <span className="w-8 text-right font-mono text-[11px] text-ink/55">{n}</span>
                  </li>
                );
              })}
            </ul>
          )}
          {s.last_scan_at && <p className="text-[11.5px] text-ink/50">Last scan {new Date(s.last_scan_at).toLocaleString()}</p>}
        </>
      )}
    </div>
  );
}
