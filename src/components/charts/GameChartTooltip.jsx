export default function GameChartTooltip({ active, payload, label, prefix = "", suffix = "" }) {
  if (!active || !payload?.length) return null;
  const v = payload[0].value;
  const display = typeof v === "number" ? v.toLocaleString() : v;
  return (
    <div className="bg-card border border-orange-500/30 rounded-lg px-2.5 py-1.5">
      {label != null && label !== "" && (
        <p className="text-[9px] text-ink/[0.58] uppercase tracking-wider">{label}</p>
      )}
      <p className="text-orange-600 text-xs font-bold">
        {prefix}
        {display}
        {suffix}
      </p>
    </div>
  );
}