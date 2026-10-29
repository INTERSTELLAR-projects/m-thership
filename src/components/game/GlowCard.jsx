export default function GlowCard({ children, className = "", bodyClassName = "p-5" }) {
  return (
    <div className={`relative overflow-hidden rounded-md border border-hair bg-card card-hover ${className}`}>
      <div className={`relative ${bodyClassName}`}>{children}</div>
    </div>
  );
}
