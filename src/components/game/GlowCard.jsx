export default function GlowCard({ children, className = "", bodyClassName = "p-5", orbs = true }) {
  return (
    <div className={`relative overflow-hidden bg-card rounded-2xl border border-ink/[0.13] card-hover ${className}`}>
      {orbs && (
        <>
          <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-orange-500/[0.06] blur-3xl pointer-events-none" />
          <div className="absolute -bottom-20 -left-10 w-40 h-40 rounded-full bg-yellow-400/[0.04] blur-3xl pointer-events-none" />
        </>
      )}
      <div className={`relative ${bodyClassName}`}>{children}</div>
    </div>
  );
}