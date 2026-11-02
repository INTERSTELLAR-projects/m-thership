import { Link } from "react-router-dom";
import { ArrowUpRight, Loader2 } from "lucide-react";

// Shared chrome for Mission Control tiles: thin-border card, mono kicker, flame hairline.
export const asArray = (r) => (Array.isArray(r) ? r : (r && r.items) || []);
export const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("en-US");

export function Tile({ kicker, title, icon: Icon, to, linkLabel = "Open", stat, children, className = "" }) {
  return (
    <section className={`relative flex min-h-[260px] flex-col overflow-hidden rounded-md border border-hair bg-card ${className}`}>
      <span className="absolute inset-x-0 top-0 h-[2px] opacity-80" style={{ background: "linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)" }} />
      <header className="flex items-start justify-between gap-3 border-b border-hair px-4 pb-3 pt-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-[#ff3c00]" strokeWidth={1.75} />}
          <div className="min-w-0">
            <p className="mono-label text-[9px] text-ink/50">{kicker}</p>
            <h3 className="truncate text-[15px] font-semibold tracking-[-0.02em]">{title}</h3>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {stat != null && <span className="text-[22px] font-semibold leading-none tabular-nums tracking-[-0.04em]">{stat}</span>}
          {to && (
            <Link to={to} className="mono-label inline-flex items-center gap-0.5 text-[9.5px] text-ink/50 hover:text-[#ff3c00]">
              {linkLabel}<ArrowUpRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </header>
      <div className="flex-1 overflow-y-auto">{children}</div>
    </section>
  );
}

export function TileEmpty({ children, action }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-8 text-center">
      <p className="max-w-[30ch] text-[12.5px] leading-relaxed text-ink/55">{children}</p>
      {action}
    </div>
  );
}

export function TileLoading() {
  return (
    <div className="flex h-full items-center justify-center py-10 text-ink/35">
      <Loader2 className="h-4 w-4 animate-spin" />
    </div>
  );
}

export function TileError({ children = "Couldn't load this right now." }) {
  return <p className="px-4 py-8 text-center text-[12.5px] text-[#ff3c00]">{children}</p>;
}

export function Bar({ value, max = 100, tone = "flame" }) {
  const pct = Math.max(0, Math.min(100, max ? (value / max) * 100 : 0));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.07]">
      <div
        className="h-full rounded-full"
        style={{ width: `${pct}%`, background: tone === "flame" ? "linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)" : tone === "ink" ? "#1a1a1a" : tone }}
      />
    </div>
  );
}
