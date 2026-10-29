export default function ShimmerBar({ value, max, grad = "from-orange-500 to-amber-400" }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className="relative h-2 w-full overflow-hidden bg-ink/[0.07]">
      <div className={`shimmer relative h-full overflow-hidden bg-gradient-to-r ${grad} transition-all duration-700`} style={{ width: `${pct}%` }} />
    </div>
  );
}
