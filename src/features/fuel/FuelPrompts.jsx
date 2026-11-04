// Out-of-fuel banner (whole portal), the Refuel modal (Studio pages), the wallet panel and the Upgrade CTA.
// Buying a Refuel opens Stripe Checkout (one-time payment). Credits land after Stripe confirms the payment
// (webhook), last 12 months and are used only after the monthly allowance runs out.
import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, Check, Fuel, Loader2, Rocket, X, Zap } from "lucide-react";
import { fuelCall, fmt, fmtDate, fuelTone } from "./useFuel";
import FuelMeter from "./FuelMeter";

function useBuy(scopeId, preview) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const buy = async (pack) => {
    if (preview) { setErr("Admin preview: only the client's own login can buy a Refuel. Use Grant credits in Fuel economics."); return; }
    setBusy(pack); setErr("");
    try {
      const d = await fuelCall("checkout", { pack, client_id: scopeId });
      if (d?.url) window.location.assign(d.url);
      else setErr(d?.error || "Couldn't open checkout. Try again.");
    } catch (e) {
      setErr(e?.response?.data?.error || "Couldn't open checkout. Try again.");
    } finally { setBusy(""); }
  };
  return { busy, err, buy };
}

export function PackButtons({ fuel, scopeId, preview, size = "md" }) {
  const { busy, err, buy } = useBuy(scopeId, preview);
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {(fuel?.packs || []).map((p, i) => (
          <button key={p.key} type="button" data-pack={p.key} onClick={() => buy(p.key)} disabled={!!busy}
            className={`flex items-center gap-2 px-4 text-left font-semibold disabled:opacity-60 ${size === "lg" ? "h-12 text-[14px]" : "h-10 text-[13px]"} ${i === 0 ? "flame-bg text-white" : "bg-ink text-white"}`}>
            {busy === p.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <Fuel className="h-4 w-4" aria-hidden="true" />}
            <span>{p.label} ${p.price_usd}<span className="block text-[10.5px] font-normal opacity-80">+{fmt(p.ai_actions)} AI · +{fmt(p.emails)} emails</span></span>
          </button>
        ))}
      </div>
      {err && <p role="alert" className="mt-2 text-[12px] text-red-700">{err}</p>}
    </div>
  );
}

// Portal-wide notice at the top of every page: amber at 80%+, red when out of fuel.
export function FuelBanner({ fuel, onOpen }) {
  const tone = fuelTone(fuel);
  if (!fuel || fuel.nova_only || tone === "ok") return null;
  const out = tone === "out";
  const pct = Math.round(Math.max(fuel.ai?.pct || 0, fuel.email?.pct || 0) * 100);
  return (
    <div role="status" data-fuel-banner={tone} className={`relative z-10 border-b ${out ? "border-red-700 bg-red-600 text-white" : "border-[#ff6a00]/40 bg-[#fff3e8] text-ink"}`}>
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-[13px] md:px-8">
        {out ? <AlertTriangle className="h-4 w-4 shrink-0" /> : <Fuel className="h-4 w-4 shrink-0 text-[#ff3c00]" />}
        <p className="min-w-0 flex-1">
          {out
            ? <><b>You&apos;re out of fuel for this month.</b> Paused items resume automatically.</>
            : <><b>{pct}% of this month&apos;s fuel used.</b> Refuel any time, or it resets {fuel.reset_label}.</>}
        </p>
        <button type="button" onClick={onOpen} className={`h-8 shrink-0 px-3 text-[12.5px] font-semibold ${out ? "bg-white text-red-700" : "flame-bg text-white"}`}>
          {out ? "Refuel options" : "Refuel"}
        </button>
      </div>
    </div>
  );
}

export function RefuelModal({ open, onClose, fuel, scopeId, preview, onUpgrade }) {
  useEffect(() => {
    if (!open) return undefined;
    const k = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open || !fuel) return null;
  const out = fuel.out_of_fuel;
  const paused = [fuel.paused?.posts ? `${fuel.paused.posts} scheduled post${fuel.paused.posts === 1 ? "" : "s"}` : "", fuel.paused?.campaigns ? `${fuel.paused.campaigns} email campaign${fuel.paused.campaigns === 1 ? "" : "s"} (${fmt(fuel.paused.campaign_emails)} emails)` : ""].filter(Boolean);
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-ink/50 p-0 backdrop-blur-[2px] sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="refuel-title" data-refuel-modal className="w-full max-w-[520px] overflow-hidden bg-[#f7f5f2] shadow-[0_30px_80px_-20px_rgba(0,0,0,.5)]">
        <div className="h-[3px] bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)]" />
        <div className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center ${out ? "bg-red-600" : "flame-bg"} text-white`}><Fuel className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="mono-label text-[9.5px] text-ink/50">(Studios fuel)</p>
              <h2 id="refuel-title" className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.03em]">
                {out ? "You're out of fuel for this month." : "Top up your Studios fuel."}
              </h2>
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink/65">
                {out ? "Paused items resume automatically." : "Refuel credits are used only after your monthly allowance runs out."} Credits last {fuel.credit_validity_months} months and roll over. One-time payment, no subscription.
              </p>
            </div>
            <button type="button" onClick={onClose} className="-mr-1 -mt-1 p-1.5 text-ink/45 hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
          </div>
          {out && paused.length > 0 && (
            <div className="mt-4 border-l-2 border-[#ff3c00] bg-card px-3.5 py-2.5 text-[12.5px]">
              <p className="font-medium">Waiting in place: {paused.join(" and ")}.</p>
              <p className="mt-0.5 text-ink/55">They keep their order. Anything whose time passes moves to the next open slot, spaced out, so nothing goes out in a burst.</p>
            </div>
          )}
          <div className="mt-5"><PackButtons fuel={fuel} scopeId={scopeId} preview={preview} size="lg" /></div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={onUpgrade} data-upgrade className="flex h-10 items-center gap-2 border border-ink px-4 text-[13px] font-semibold hover:bg-ink hover:text-white"><Rocket className="h-4 w-4" /> Upgrade plan</button>
            <button type="button" onClick={onClose} data-wait className="flex h-10 items-center gap-2 border border-hair bg-white px-4 text-[13px] font-medium text-ink/70 hover:text-ink"><CalendarClock className="h-4 w-4" /> Wait for reset on {fuel.reset_label}</button>
          </div>
          {preview && <p className="mt-3 text-[11.5px] text-ink/45">Admin preview: checkout works from the client&apos;s own login.</p>}
        </div>
      </div>
    </div>
  );
}

// Studio pages (HyperCare+): the gauge, the wallet's lots, Refuel buttons and the Auto-refuel opt-in (off by default).
export function WalletPanel({ fuel, scopeId, preview, onChanged, onRefuel }) {
  const [auto, setAuto] = useState(!!fuel?.auto_refuel?.enabled);
  const [ceiling, setCeiling] = useState(String(fuel?.auto_refuel?.monthly_ceiling_usd || 50));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  if (!fuel || fuel.nova_only) return null;
  const save = async (enabled) => {
    setSaving(true); setSaved(false);
    try {
      await fuelCall("set_auto_refuel", { client_id: scopeId, enabled, monthly_ceiling_usd: Number(ceiling) || 0, pack: fuel.auto_refuel?.pack || "refuel" });
      setAuto(enabled && Number(ceiling) > 0); setSaved(true); onChanged?.();
    } finally { setSaving(false); }
  };
  const lots = fuel.wallet?.lots || [];
  return (
    <section className="grid gap-4 lg:grid-cols-[1fr_1.1fr]" data-wallet>
      <FuelMeter fuel={fuel} onRefuel={onRefuel} />
      <div className="rounded-md border border-hair bg-card p-5">
        <p className="mono-label text-[9.5px] text-ink/50">Refuel wallet</p>
        <p className="mt-1 text-[17px] font-semibold tracking-[-0.02em]">
          {fmt(fuel.wallet?.ai_action)} AI actions · {fmt(fuel.wallet?.marketing_email)} emails
        </p>
        {lots.length ? (
          <ul className="mt-3 divide-y divide-hair border border-hair bg-white text-[12px]">
            {lots.map((l, i) => (
              <li key={i} className="flex items-center gap-2 px-3 py-2">
                <Check className="h-3.5 w-3.5 shrink-0 text-[#ff3c00]" />
                <span className="font-medium">{l.pack_label}</span>
                <span className="text-ink/55 tabular-nums">{fmt(l.ai_left)} AI · {fmt(l.emails_left)} emails left</span>
                <span className="ml-auto text-[11px] text-ink/45">expires {fmtDate(l.expires_at)}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-[12.5px] text-ink/55">No Refuel credits yet. They&apos;re only used after your monthly allowance runs out.</p>}
        <div className="mt-4"><PackButtons fuel={fuel} scopeId={scopeId} preview={preview} /></div>
        <div className="mt-4 border-t border-hair pt-3">
          <label className="flex items-center gap-2 text-[13px] font-medium">
            <input type="checkbox" checked={auto} disabled={saving || preview} onChange={(e) => save(e.target.checked)} className="h-4 w-4 accent-[#ff3c00]" data-auto-refuel />
            <Zap className="h-3.5 w-3.5 text-[#ff3c00]" /> Auto-refuel
            <span className="text-[11.5px] font-normal text-ink/50">(off unless you turn it on)</span>
          </label>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink/60">
            Buy a {fuel.packs?.find((p) => p.key === (fuel.auto_refuel?.pack || "refuel"))?.label || "Refuel"} when I run out, up to
            <span className="inline-flex items-center border border-hair bg-white"><span className="pl-2 text-ink/45">$</span>
              <input type="number" min="0" max={fuel.auto_refuel?.max_ceiling_usd || 500} step="25" value={ceiling} disabled={saving || preview} onChange={(e) => setCeiling(e.target.value)} onBlur={() => auto && save(true)} className="h-8 w-16 bg-transparent px-1 text-[12.5px] tabular-nums outline-none" aria-label="Monthly Auto-refuel ceiling in dollars" />
            </span> a month.
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{saved && !saving && <span className="text-green-700">Saved</span>}
          </div>
          {auto && !fuel.auto_refuel?.live && <p className="mt-1.5 text-[11px] text-ink/45">Opted in. Automatic charges start once Interstellar switches them on; until then you&apos;ll get the Refuel prompt instead.</p>}
        </div>
      </div>
    </section>
  );
}

// GravïtyCare / Website-only Studio pages: locked preview, upgrade through a call or a request (never self-serve).
export function UpgradeCta({ call, client, preview, studioLabel, onSchedule }) {
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const ask = async () => {
    if (preview || busy || sent) return;
    setBusy(true); setErr("");
    try {
      await call("create_request", {
        kind: "billing", title: "Upgrade to HyperCare+", priority: "normal",
        details: `${client?.business || "This client"} asked about upgrading to HyperCare+ from the ${studioLabel} preview in the portal.`,
        fields: { topic: "Plan upgrade", to_plan: "HyperCare+", from_studio: studioLabel },
      });
      setSent(true);
    } catch (e) { setErr(e?.response?.data?.error || "Couldn't send that. Try again or message us."); } finally { setBusy(false); }
  };
  return (
    <div data-upgrade-cta>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onSchedule} className="flame-bg flex h-11 items-center gap-2 px-5 text-[13.5px] font-semibold text-white"><Rocket className="h-4 w-4" /> Upgrade to HyperCare+</button>
        {sent ? (
          <span className="inline-flex h-11 items-center gap-2 border border-hair bg-card px-4 text-[13px] font-medium"><Check className="h-4 w-4 text-[#ff3c00]" /> Request sent. We&apos;ll be in touch.</span>
        ) : (
          <button type="button" onClick={ask} disabled={preview || busy} className="flex h-11 items-center gap-2 border border-hair bg-card px-4 text-[13px] font-medium disabled:opacity-50" title={preview ? "Admin preview: only the client's own login can send this" : undefined}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Or send us a request
          </button>
        )}
      </div>
      <p className="mt-2 text-[12px] text-ink/55">Book a quick call and we&apos;ll walk you through HyperCare+. Nothing changes on your plan until you say so.</p>
      {err && <p role="alert" className="mt-2 text-[12px] text-red-700">{err}</p>}
    </div>
  );
}
