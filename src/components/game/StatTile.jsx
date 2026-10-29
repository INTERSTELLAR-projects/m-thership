const TONES = { orange: "text-[#ff3c00]", yellow: "text-amber-600", green: "text-green-700", blue: "text-sky-700" };
export default function StatTile({ label, value, color = "orange", className = "" }) {
  return (
    <div className={`relative overflow-hidden rounded-md border border-hair bg-card p-4 card-hover ${className}`}>
      <p className={`text-[28px] font-semibold leading-none tracking-[-0.04em] tabular-nums ${TONES[color] || "text-ink"}`}>{value}</p>
      <p className="mono-label mt-2 text-[9.5px] text-ink/55">{label}</p>
    </div>
  );
}
