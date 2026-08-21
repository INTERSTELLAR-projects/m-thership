export default function ShimmerBar({ value, max, grad = "from-orange-500 to-amber-400", glow = "shadow-[0_0_12px_rgba(255,106,0,0.35)]" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="relative h-2.5 w-full bg-white/[0.04] rounded-full overflow-hidden border border-white/[0.04]">
      <div className={`relative h-full rounded-full overflow-hidden bg-gradient-to-r ${grad} ${glow} transition-all duration-700 shimmer`} style={{ width: `${pct}%` }} />
    </div>
  );
}