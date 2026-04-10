export default function PageHeader({ breadcrumb, rightText }) {
  return (
    <div className="flex items-center justify-between px-4 md:px-8 py-4 md:py-5 border-b border-white/5">
      <h1 className="font-orbitron text-white font-bold text-sm tracking-wide uppercase">
        {breadcrumb}
      </h1>
      {rightText && (
        <span className="text-white/30 text-xs tracking-wide hidden sm:inline">{rightText}</span>
      )}
    </div>
  );
}