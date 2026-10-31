import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, Check, ChevronDown, Minus } from "lucide-react";
import { SUBSCRIPTIONS, DELIVERY_PACKAGES, packageByKey, packagePath } from "@/features/packages/registry";
import { DELIVERABLES, MISSIONS } from "@/features/packages/deliverables";
import { cn } from "@/lib/utils";

const OPEN_KEY = "ms_deliverables_open";

/* "What the client gets" — one tile per subscription and package across the top of every package page.
   Click a tile to read its full deliverables list; the page's own package is selected by default. */
export default function DeliverablesGlance({ current }) {
  const [sel, setSel] = useState(current);
  const [open, setOpen] = useState(() => {
    try { return localStorage.getItem(OPEN_KEY) !== "0"; } catch { return true; }
  });
  useEffect(() => setSel(current), [current]);
  const toggle = () => {
    setOpen((o) => {
      try { localStorage.setItem(OPEN_KEY, o ? "0" : "1"); } catch { /* storage blocked */ }
      return !o;
    });
  };

  const pkg = packageByKey(sel) || packageByKey(current);
  const d = DELIVERABLES[pkg.key] || { includes: [] };

  const Tile = ({ p }) => {
    const active = p.key === sel;
    return (
      <button
        type="button"
        onClick={() => { setSel(p.key); if (!open) toggle(); }}
        className={cn(
          "flex min-w-0 items-center gap-2 rounded-sm border px-2.5 py-2 text-left transition-colors",
          active ? "border-ink bg-ink text-white" : "border-hair bg-card text-ink/75 hover:border-ink/40 hover:text-ink"
        )}
      >
        <p.icon className="h-3.5 w-3.5 shrink-0" style={{ color: active ? "#fff" : p.color }} />
        <span className="truncate text-[12px] font-medium">{p.label}</span>
      </button>
    );
  };

  return (
    <section className="overflow-hidden rounded-md border border-hair bg-card">
      <button type="button" onClick={toggle} className="flex w-full items-center justify-between gap-3 border-b border-hair px-4 py-2.5 text-left">
        <span className="label-cross text-[10.5px] text-ink/60">(What the client gets)</span>
        <span className="flex items-center gap-1.5 text-[11px] text-ink/50">
          {open ? "Hide" : "Show"} deliverables
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </span>
      </button>

      <div className="grid gap-3 px-4 py-3 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
        <p className="mono-label text-[8.5px] text-ink/45">Subscriptions</p>
        <div className="grid grid-cols-2 gap-1.5 sm:max-w-sm">{SUBSCRIPTIONS.map((p) => <Tile key={p.key} p={p} />)}</div>
        <p className="mono-label text-[8.5px] text-ink/45">Packages</p>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 xl:grid-cols-7">{DELIVERY_PACKAGES.map((p) => <Tile key={p.key} p={p} />)}</div>
      </div>

      {open ? (
        <div className="border-t border-hair bg-canvas/50 px-4 py-4 md:px-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <pkg.icon className="h-4 w-4" style={{ color: pkg.color }} />
                <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-ink">{pkg.label}</h3>
                <span className="mono-label rounded-sm border border-hair bg-card px-1.5 py-[2px] text-[8.5px] text-ink/55">{d.cadence || (pkg.kind === "recurring" ? "Monthly subscription" : "One-time")}</span>
              </div>
              <p className="mt-1 text-[12px] text-ink/60">{pkg.tagline}</p>
              {d.price ? <p className="mt-1 font-mono text-[11.5px] text-ink">{d.price}</p> : null}
            </div>
            {pkg.key !== current ? (
              <Link to={packagePath(pkg.key)} className="inline-flex items-center gap-1.5 text-[11.5px] text-[#ff3c00] hover:underline">
                Open {pkg.label} <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>

          <ul className="mt-3 grid gap-x-6 gap-y-1.5 md:grid-cols-2">
            {d.includes.map((line) => (
              <li key={line} className="flex items-start gap-2 text-[12.5px] leading-snug text-ink/85">
                <Check className="mt-[2px] h-3.5 w-3.5 shrink-0 text-[#ff3c00]" />
                <span>{line}</span>
              </li>
            ))}
            {(d.excludes || []).map((line) => (
              <li key={line} className="flex items-start gap-2 text-[12.5px] leading-snug text-ink/50">
                <Minus className="mt-[2px] h-3.5 w-3.5 shrink-0" />
                <span>Not included: {line}</span>
              </li>
            ))}
          </ul>

          {pkg.kind === "delivery" ? (
            <p className="mt-3 border-t border-hair pt-2.5 text-[11px] text-ink/50">
              {MISSIONS.map((m) => <span key={m.name} className="mr-4 inline-block"><span className="font-medium text-ink/70">{m.name}</span> {m.price} — {m.note}</span>)}
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
