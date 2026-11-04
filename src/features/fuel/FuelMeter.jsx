// Fuel gauge for the portal header Studios menu (compact) and the Studio pages (full).
// Fuel = this month's plan allowance + Refuel credits. 80%+ used turns amber; empty turns red.
import { Fuel } from "lucide-react";
import { fmt, fuelTone, leftShare } from "./useFuel";

function Bar({ label, k, unit }) {
  const share = leftShare(k);
  const usedPct = k?.cap ? Math.min(100, Math.round(((k.used || 0) / k.cap) * 100)) : 0;
  const tone = k?.out ? "bg-red-600" : k?.alert ? "bg-[#ff6a00]" : "bg-ink";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[12px]">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-ink/60">
          {k?.cap == null ? "Unlimited" : <><b className={`font-semibold ${k.out ? "text-red-700" : "text-ink"}`}>{fmt(k.left)}</b> left{unit ? ` ${unit}` : ""}</>}
        </span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden bg-ink/[0.08]" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(share * 100)} aria-label={`${label} fuel left`}>
        <div className={`h-full ${tone} transition-[width] duration-500`} style={{ width: `${Math.round(share * 100)}%` }} />
      </div>
      {k?.cap != null && (
        <p className="mt-0.5 text-[10.5px] text-ink/45 tabular-nums">
          {fmt(k.used)} of {fmt(k.cap)} used this month ({usedPct}%){k.wallet ? ` · ${fmt(k.wallet)} Refuel credits` : ""}
        </p>
      )}
    </div>
  );
}

export default function FuelMeter({ fuel, compact = false, onRefuel }) {
  if (!fuel) return null;
  const tone = fuelTone(fuel);
  const head = tone === "out" ? "Out of fuel" : tone === "alert" ? "Running low" : "Fuel";
  return (
    <div data-fuel-meter data-fuel-tone={tone} className={compact ? "border-b border-hair bg-white/70 px-4 py-3" : "rounded-md border border-hair bg-card p-5"}>
      <div className="flex items-center gap-2">
        <span className={`flex h-6 w-6 items-center justify-center ${tone === "out" ? "bg-red-600 text-white" : tone === "alert" ? "bg-[#ff6a00] text-white" : "flame-bg text-white"}`}><Fuel className="h-3.5 w-3.5" aria-hidden="true" /></span>
        <p className={`text-[13px] font-semibold tracking-[-0.01em] ${tone === "out" ? "text-red-700" : ""}`}>{head}</p>
        <span className="ml-auto mono-label text-[8.5px] text-ink/45">{fuel.plan_label}{fuel.tier_label ? ` · ${fuel.tier_label}` : ""}</span>
      </div>
      <div className="mt-2.5 space-y-2.5">
        {fuel.nova_only ? (
          <Bar label="Nøva messages" k={fuel.ai} />
        ) : (
          <>
            <Bar label="AI actions" k={fuel.ai} />
            <Bar label="Marketing emails" k={fuel.email} />
          </>
        )}
      </div>
      <p className="mt-2 text-[10.5px] leading-snug text-ink/50">
        {fuel.nova_only ? "Studios are included with HyperCare+." : `Resets ${fuel.reset_label}.`}
        {fuel.paused?.posts || fuel.paused?.campaigns ? ` ${[fuel.paused.posts ? `${fuel.paused.posts} post${fuel.paused.posts === 1 ? "" : "s"}` : "", fuel.paused.campaigns ? `${fuel.paused.campaigns} campaign${fuel.paused.campaigns === 1 ? "" : "s"}` : ""].filter(Boolean).join(" and ")} paused.` : ""}
      </p>
      {onRefuel && !fuel.nova_only && (tone !== "ok" || !compact) && (
        <button type="button" onClick={onRefuel} className={`mt-2.5 flex h-8 w-full items-center justify-center gap-1.5 text-[12px] font-semibold ${tone === "ok" ? "border border-hair bg-white hover:bg-ink hover:text-white" : "flame-bg text-white"}`}>
          <Fuel className="h-3.5 w-3.5" aria-hidden="true" /> Refuel
        </button>
      )}
    </div>
  );
}
