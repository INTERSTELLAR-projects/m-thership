// One line of Output numbers for the Commander brief on Mission Control (dark band).
import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { useLedger, useLedgerConfig, ledgerHeadline, fmtHours, fmtUsd } from "./ledger";

export default function OutputStrip() {
  const q = useLedger();
  const cfg = useLedgerConfig();
  const h = useMemo(() => ledgerHeadline(q.data || [], cfg.data?.hourly_rate || 75), [q.data, cfg.data]);
  if (q.isLoading || !(q.data || []).length) return null;
  const w = h.week;
  return (
    <Link to="/output-analytics" className="group mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-white/10 pt-3 text-[12.5px] text-white/60" data-output-strip>
      <span className="mono-label text-[9px] text-white/40">Output this week</span>
      <span><b className="font-semibold text-white">{w.tasks}</b> tasks done</span>
      <span><b className="font-semibold text-[#ff6a00]">{fmtHours(w.hours)}</b> saved <span className="text-white/40">({fmtUsd(w.value)})</span></span>
      <span>you by hand <b className="font-semibold text-white">{fmtHours(w.manualHours)}</b></span>
      <span className="text-white/40">all time {fmtHours(h.all.hours)} saved</span>
      <ArrowUpRight className="h-3.5 w-3.5 text-[#ff6a00] opacity-60 group-hover:opacity-100" />
    </Link>
  );
}
