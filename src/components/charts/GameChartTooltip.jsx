export default function GameChartTooltip({ active, payload, label, prefix = "", suffix = "" }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  const display = typeof v === "number" ? v.toLocaleString() : v;
  return (
    <div className="bg-card border border-orange-500/30 rounded-lg px-2.5 py-1.5 shadow-[0_0_12px_rgba(255,170,0,0.25)]">
      {label != null && label !== "" && (
        <p className="text-[9px] text-white/40 uppercase tracking-wider">{label}</p>
      )}
      <p className="text-orange-400 text-xs font-bold">
        {prefix}
        {display}
        {suffix}
      </p>
    </div>
  );
}