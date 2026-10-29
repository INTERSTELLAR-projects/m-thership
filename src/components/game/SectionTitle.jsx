export default function SectionTitle({ icon: Icon, title, count, className = "" }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {Icon && (
        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500/20 to-yellow-400/10 border border-orange-500/20 flex items-center justify-center shrink-0">
          <Icon className="w-3.5 h-3.5 text-orange-400" />
        </div>
      )}
      <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">{title}</h3>
      {count != null && (
        <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded border border-orange-500/25 bg-orange-500/10 text-orange-300/80">{count} item{count !== 1 ? "s" : ""}</span>
      )}
      <span className="h-px flex-1 ml-1 bg-gradient-to-r from-orange-500/25 via-ink/5 to-transparent" />
    </div>
  );
}