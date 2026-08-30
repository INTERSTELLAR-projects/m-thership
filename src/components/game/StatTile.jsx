// Numeric summary tile. The large numeral uses the geometric Orbitron display
// face with a solid warm glow (matching the To-Do / Important Dates / Completed
// reference). Accent color drives both the text fill and the glow shade.
const STYLES = {
  orange: { text: "text-orange-400", glow: "drop-shadow-[0_0_14px_rgba(255,153,51,0.55)]" },
  yellow: { text: "text-amber-300", glow: "drop-shadow-[0_0_14px_rgba(255,204,102,0.55)]" },
  green: { text: "text-emerald-400", glow: "drop-shadow-[0_0_14px_rgba(51,204,102,0.55)]" },
  blue: { text: "text-sky-400", glow: "drop-shadow-[0_0_14px_rgba(56,189,248,0.55)]" },
};

export default function StatTile({ label, value, color = "orange", className = "" }) {
  const s = STYLES[color] || STYLES.orange;
  return (
    <div className={`relative overflow-hidden bg-card rounded-xl border border-white/[0.07] card-hover p-4 text-center ${className}`}>
      <div className="absolute -top-10 -right-10 w-20 h-20 rounded-full bg-orange-500/[0.06] blur-2xl pointer-events-none" />
      <p className={`relative text-4xl font-display font-extrabold tabular-nums leading-none ${s.text} ${s.glow}`}>{value}</p>
      <p className="relative text-white/30 text-[10px] mt-2 uppercase tracking-[0.18em]">{label}</p>
    </div>
  );
}