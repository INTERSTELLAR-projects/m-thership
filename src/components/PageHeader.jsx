export default function PageHeader({ breadcrumb, rightText }) {
  return (
    <div className="flex items-center justify-between px-8 py-5 border-b border-white/[0.06] bg-gradient-to-r from-white/[0.01] to-transparent">
      <div className="flex items-center gap-3">
        <div className="w-1 h-4 rounded-full bg-orange-500 opacity-70" />
        <h1 className="font-orbitron text-white/80 font-bold text-xs tracking-[0.18em] uppercase">
          {breadcrumb}
        </h1>
      </div>
      {rightText && (
        <span className="text-white/25 text-[11px] tracking-widest uppercase font-medium">{rightText}</span>
      )}
    </div>
  );
}