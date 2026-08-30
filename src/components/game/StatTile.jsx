const GRADS = {
  orange: "from-orange-400 to-amber-300",
  yellow: "from-yellow-300 to-amber-200",
  green: "from-green-400 to-emerald-300",
  blue: "from-sky-400 to-blue-300",
};

export default function StatTile({ label, value, color = "orange", className = "" }) {
  const grad = GRADS[color] || GRADS.orange;
  return (
    <div className={`relative overflow-hidden bg-card rounded-xl border border-white/[0.07] card-hover p-4 text-center ${className}`}>
      <div className="absolute -top-10 -right-10 w-20 h-20 rounded-full bg-orange-500/[0.06] blur-2xl pointer-events-none" />
      <p className={`relative text-2xl font-display font-extrabold bg-gradient-to-r ${grad} bg-clip-text text-transparent`}>{value}</p>
      <p className="relative text-white/30 text-[10px] mt-1.5 uppercase tracking-[0.18em]">{label}</p>
    </div>
  );
}