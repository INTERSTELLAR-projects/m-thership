export default function PageHeader({ breadcrumb, rightText }) {
  return (
    <div className="relative overflow-hidden flex items-center justify-between px-8 py-5 border-b border-orange-500/[0.12]">
      <div className="absolute -top-10 left-1/4 w-40 h-40 rounded-full bg-orange-500/[0.05] blur-3xl pointer-events-none" />
      <div className="absolute -bottom-12 right-12 w-40 h-40 rounded-full bg-yellow-400/[0.04] blur-3xl pointer-events-none" />
      <div className="relative flex items-center gap-3">
        <div className="w-1 h-5 rounded-full bg-gradient-to-b from-orange-500 to-yellow-400 shadow-[0_0_10px_rgba(255,106,0,0.7)]" />
        <h1 className="font-display font-bold text-[13px] tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">
          {breadcrumb}
        </h1>
      </div>
      {rightText && (
        <span className="relative text-[11px] tracking-[0.2em] uppercase font-medium text-orange-300/40">{rightText}</span>
      )}
    </div>
  );
}