export default function PageHeader({ breadcrumb, rightText }) {
  return (
    <div className="flex items-center justify-between px-8 py-5 border-b border-white/5">
      <h1 className="text-white font-bold text-sm tracking-wide uppercase">
        {breadcrumb}
      </h1>
      {rightText && (
        <span className="text-white/30 text-xs tracking-wide">{rightText}</span>
      )}
    </div>
  );
}