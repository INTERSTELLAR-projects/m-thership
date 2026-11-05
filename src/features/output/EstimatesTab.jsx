// Settings > Time-saved estimates: the transparent table behind "hours saved" on Output.
// minutes saved = estimate for the task type − Justin's own minutes on it (0 when Justin did it by hand).
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useLedgerConfig, CATEGORIES, DEFAULT_BASELINES, DEFAULT_RATE } from "./ledger";

export default function EstimatesTab() {
  const cfg = useLedgerConfig();
  const qc = useQueryClient();
  const [rows, setRows] = useState([]);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  useEffect(() => {
    if (cfg.data) { setRows(cfg.data.rows.map((r) => ({ ...r }))); setRate(cfg.data.hourly_rate); }
  }, [cfg.data]);
  const setMin = (i, v) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, minutes: v } : r)));
  const save = async () => {
    setBusy(true); setNote("");
    try {
      const r = (await base44.functions.invoke("work-ledger", { action: "config", rows: rows.map((x) => ({ ...x, minutes: Math.max(0, Math.round(Number(x.minutes) || 0)) })), hourly_rate: Number(rate) || DEFAULT_RATE }))?.data || {};
      setNote(`Saved. ${r.updated || 0} ledger entries re-estimated.`);
      qc.invalidateQueries({ queryKey: ["work-ledger"] });
      qc.invalidateQueries({ queryKey: ["WorkEntry"] });
    } catch (x) { setNote(x?.response?.data?.error || x?.message || "Couldn't save"); } finally { setBusy(false); }
  };
  const reset = () => { setRows(DEFAULT_BASELINES.map((r) => ({ ...r }))); setRate(DEFAULT_RATE); setNote("Defaults loaded. Save to apply."); };
  const input = "h-9 w-24 border border-hair bg-paper px-2.5 text-right text-[13px] tabular-nums outline-none focus:border-ink/40";

  return (
    <div className="max-w-3xl space-y-4" data-estimates>
      <div className="rounded-md border border-hair bg-card p-4 text-[13px] leading-relaxed text-ink/70">
        <p><b className="font-semibold text-ink">These are estimates.</b> Each row is how many minutes the task would take you by hand. Output counts <i>hours saved</i> as that estimate minus your own minutes on the task, and work you did by hand counts as your time, not savings. Value = hours saved × your hourly rate.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-hair bg-card px-4 py-3">
        <label className="flex items-center gap-2 text-[13px] font-medium">Hourly rate <span className="text-ink/50">$</span><input type="number" min="1" value={rate} onChange={(e) => setRate(e.target.value)} className={input} /></label>
        <span className="text-[12px] text-ink/50">/ hour, used for the $ value</span>
      </div>
      <div className="overflow-hidden rounded-md border border-hair bg-card">
        <table className="w-full text-[13px]">
          <thead><tr className="border-b border-hair text-left text-[11px] text-ink/50"><th className="px-4 py-2 font-medium">Task type</th><th className="hidden px-3 py-2 font-medium sm:table-cell">Category</th><th className="px-4 py-2 text-right font-medium">Minutes by hand</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.key} className="border-b border-hair last:border-b-0">
                <td className="px-4 py-2"><p className="font-medium">{r.label}</p><p className="font-mono text-[10.5px] text-ink/40">{r.key}</p></td>
                <td className="hidden px-3 py-2 text-ink/55 sm:table-cell">{CATEGORIES[r.category] || r.category}</td>
                <td className="px-4 py-2 text-right"><input type="number" min="0" aria-label={`${r.label} minutes`} value={r.minutes} onChange={(e) => setMin(i, e.target.value)} className={input} /><span className="ml-2 hidden text-[11px] text-ink/40 sm:inline">{(Number(r.minutes) / 60).toFixed(1)}h</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={save} disabled={busy || cfg.isLoading} className="h-10 bg-[#ff3c00] px-5 text-[13px] font-medium text-white hover:bg-ink disabled:opacity-50">{busy ? "Saving…" : "Save estimates"}</button>
        <button type="button" onClick={reset} className="h-10 border border-hair px-4 text-[13px] text-ink/65 hover:border-ink/30">Load defaults</button>
        {note && <span className="text-[12.5px] text-ink/60">{note}</span>}
      </div>
    </div>
  );
}
