export default function SectionTitle({ icon: Icon, title, count, className = "" }) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {Icon && <Icon className="h-4 w-4 shrink-0 text-[#ff3c00]" strokeWidth={1.75} />}
      <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-ink">{title}</h3>
      {count != null && (
        <span className="mono-label border border-hair bg-paper px-2 py-0.5 text-[9.5px] text-ink/60">{count} item{count !== 1 ? "s" : ""}</span>
      )}
      <span className="ml-1 h-px flex-1 bg-hair" />
    </div>
  );
}
