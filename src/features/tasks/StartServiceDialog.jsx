import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Rocket, ShieldCheck } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useList } from "@/lib/useData";

// Mirrors PACKAGES in base44/functions/start-service (the function is the source of truth).
// needsCare: hosted builds must run on HyperCare+ or GravïtyCare; the dialog starts the care plan in the same click.
export const SERVICE_GROUPS = [
  { label: "Missions", items: [
    { key: "mission_alpha", label: "Mission ALPHA", price: "$11,997", onboarding: true, needsCare: true, careDelay: 45, streams: ["intel_briefing", "website", "system", "ops_command", "brand_arsenal", "launch_grid", "transmission"] },
    { key: "mission_bravo", label: "Mission BRAVO", price: "$9,997", onboarding: true, needsCare: true, careDelay: 30, streams: ["intel_briefing", "website", "system"] },
  ] },
  { label: "Builds", items: [
    { key: "custom_website", label: "Custom Website", price: "$4,997", onboarding: true, needsCare: true, careDelay: 21, streams: ["intel_briefing", "website"] },
    { key: "command_system", label: "Command System", price: "$5,997", onboarding: true, needsCare: true, careDelay: 30, streams: ["intel_briefing", "system"] },
  ] },
  { label: "Add-ons", items: [
    { key: "ops_command", label: "Ops Command", price: "$3,000", onboarding: false, streams: ["ops_command"] },
    { key: "brand_arsenal", label: "Brand Arsenal", price: "$2,500", onboarding: false, streams: ["brand_arsenal"] },
    { key: "launch_grid", label: "Launch Grid", price: "$1,400", onboarding: false, streams: ["launch_grid"] },
    { key: "transmission", label: "Transmission Video", price: "$1,500", onboarding: false, streams: ["transmission"] },
  ] },
  { label: "Monthly", items: [
    { key: "orbit_local", label: "HyperCare+ Local", price: "$750/mo", onboarding: false, streams: ["orbit_setup", "orbit_local"] },
    { key: "orbit_multi", label: "HyperCare+ Multi-Location", price: "+$350/mo", onboarding: false, streams: ["orbit_multi"] },
    { key: "orbit_national", label: "HyperCare+ National", price: "$1,750/mo", onboarding: false, streams: ["orbit_setup", "orbit_national"] },
    { key: "orbit_global", label: "HyperCare+ Global", price: "$3,000/mo", onboarding: false, streams: ["orbit_setup", "orbit_national", "orbit_global"] },
    { key: "starship_care", label: "GravïtyCare", price: "$197/mo", onboarding: false, streams: ["starship"] },
  ] },
];
const ALL = SERVICE_GROUPS.flatMap((g) => g.items);
const CARE = [
  { key: "orbit_local", label: "HyperCare+ Local", base: 750 },
  { key: "orbit_national", label: "HyperCare+ National", base: 1750 },
  { key: "orbit_global", label: "HyperCare+ Global", base: 3000 },
  { key: "starship_care", label: "GravïtyCare", base: 197 },
];
const LOCAL_PRICES = [750, 700, 650, 600, 550, 500];
const today = () => new Date().toLocaleDateString("en-CA");
const plusDays = (iso, n) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return d.toLocaleDateString("en-CA"); };

function LocalPrice({ value, onChange }) {
  return (
    <div>
      <div className="grid grid-cols-6 gap-1">
        {LOCAL_PRICES.map((v) => (
          <button key={v} type="button" onClick={() => onChange(v)} className={`border px-1 py-1.5 font-mono text-[11.5px] ${value === v ? "border-ink bg-ink text-white" : "border-hair bg-paper hover:border-ink/40"}`}>${v}</button>
        ))}
      </div>
      <p className="mt-1 text-[10.5px] text-ink/45">$750 is the public price. $500–$700 is your referral / loyalty pricing — never shown on the site.</p>
    </div>
  );
}

export default function StartServiceDialog({ open, client, onClose }) {
  const [pkg, setPkg] = useState("mission_alpha");
  const [start, setStart] = useState(today());
  const [onb, setOnb] = useState(true);
  const [monthly, setMonthly] = useState(750);
  const [care, setCare] = useState("orbit_local");
  const [careMonthly, setCareMonthly] = useState(750);
  const [careStart, setCareStart] = useState(plusDays(today(), 45));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const nav = useNavigate();
  const qc = useQueryClient();
  const templates = useList("TaskTemplate", { sort: "sort_order", limit: 100, enabled: open });

  const chosen = ALL.find((p) => p.key === pkg);
  const coveredAlready = (client?.services_managed || []).some((s) => s === "orbit_seo" || s === "starship_care");
  const needsCare = Boolean(chosen?.needsCare) && !coveredAlready;
  useEffect(() => { if (chosen) { setOnb(chosen.onboarding); if (chosen.careDelay) setCareStart(plusDays(start, chosen.careDelay)); } }, [pkg]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) { setErr(""); setStart(today()); } }, [open]);
  useEffect(() => { const c = CARE.find((x) => x.key === care); if (c && care !== "orbit_local") setCareMonthly(c.base); if (care === "orbit_local") setCareMonthly(750); }, [care]);

  const plan = useMemo(() => {
    const byKey = new Map((templates.data || []).filter((t) => t.service_key).map((t) => [t.service_key, t]));
    const keys = [...(onb ? ["onboarding"] : []), ...(chosen?.streams || [])];
    const careStreams = needsCare ? (ALL.find((p) => p.key === care)?.streams || []) : [];
    return [...keys.map((k) => ({ key: k, t: byKey.get(k), care: false })), ...careStreams.map((k) => ({ key: k, t: byKey.get(k), care: true }))];
  }, [templates.data, chosen, onb, needsCare, care]);
  const total = plan.reduce((s, p) => s + (p.t?.items?.length || 0), 0);

  if (!open || !client) return null;

  const go = async () => {
    setBusy(true); setErr("");
    try {
      const res = await base44.functions.invoke("start-service", {
        client_id: client.id, package: pkg, start_date: start, include_onboarding: onb,
        ...(pkg === "orbit_local" ? { value: monthly } : {}),
        ...(needsCare ? { care_plan: { package: care, value: careMonthly, start_date: careStart } } : {}),
      });
      const d = res?.data || res;
      if (d?.error) throw new Error(d.error);
      ["Project", "Task", "CRMClient", "TaskTemplate"].forEach((e) => qc.invalidateQueries({ queryKey: [e] }));
      onClose();
      if (d?.project_id) nav(`/projects/${d.project_id}`);
    } catch (e) {
      setErr(e?.response?.data?.error || e.message || "Could not start the service");
    } finally { setBusy(false); }
  };

  return (
    <div role="dialog" className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-[6vh]" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-3xl border border-hair bg-canvas shadow-2xl">
        <div className="flex items-center justify-between border-b border-hair px-5 py-4">
          <div>
            <p className="mono-label text-[9.5px] text-ink/50">{client.business}</p>
            <h3 className="text-[20px] font-semibold tracking-[-0.03em]">Start a <span className="text-[#ff3c00]">/service</span></h3>
          </div>
          <button type="button" onClick={onClose} className="text-ink/50 hover:text-ink"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid gap-5 px-5 py-5 md:grid-cols-[1.3fr_1fr]">
          <div className="space-y-4">
            {SERVICE_GROUPS.map((g) => (
              <div key={g.label}>
                <p className="mono-label mb-1.5 text-[9.5px] text-ink/50">{g.label}</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {g.items.map((p) => (
                    <button key={p.key} type="button" onClick={() => setPkg(p.key)}
                      className={`border px-3 py-2 text-left transition-colors ${pkg === p.key ? "border-[#ff3c00] bg-[#ff3c00]/[0.06]" : "border-hair bg-paper hover:border-ink/40"}`}>
                      <p className="text-[13px] font-semibold">{p.label}</p>
                      {p.price && <p className="font-mono text-[10.5px] text-ink/50">{p.price}{p.needsCare ? " + care plan" : ""}</p>}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-4">
            <div>
              <label className="mono-label mb-1.5 block text-[9.5px] text-ink/55">Start date</label>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-full border border-hair bg-paper px-3 py-2 text-[13.5px] outline-none focus:border-[#ff3c00]" />
            </div>
            {pkg === "orbit_local" ? (
              <div>
                <label className="mono-label mb-1.5 block text-[9.5px] text-ink/55">HyperCare+ monthly price (what Stripe will charge)</label>
                <LocalPrice value={monthly} onChange={setMonthly} />
              </div>
            ) : null}

            {needsCare ? (
              <div className="border border-[#ff3c00]/40 bg-[#ff3c00]/[0.04] p-3">
                <p className="mono-label flex items-center gap-1.5 text-[9.5px] text-[#ff3c00]"><ShieldCheck className="h-3.5 w-3.5" /> Required care plan</p>
                <p className="mt-1 text-[11.5px] text-ink/60">Every hosted build runs on HyperCare+ or GravïtyCare. It starts as its own project and billing line in the same click.</p>
                <div className="mt-2 grid grid-cols-2 gap-1">
                  {CARE.map((c) => (
                    <button key={c.key} type="button" onClick={() => setCare(c.key)} className={`border px-2 py-1.5 text-left text-[12px] ${care === c.key ? "border-ink bg-ink text-white" : "border-hair bg-paper hover:border-ink/40"}`}>
                      {c.label}<span className="ml-1 font-mono text-[10px] opacity-70">${c.base}{c.key === "orbit_local" ? "" : ""}/mo</span>
                    </button>
                  ))}
                </div>
                {care === "orbit_local" ? <div className="mt-2"><LocalPrice value={careMonthly} onChange={setCareMonthly} /></div> : null}
                <label className="mono-label mb-1 mt-2 block text-[9px] text-ink/55">Care plan starts (billing begins at launch)</label>
                <input type="date" value={careStart} onChange={(e) => setCareStart(e.target.value)} className="w-full border border-hair bg-paper px-3 py-1.5 text-[13px] outline-none focus:border-[#ff3c00]" />
              </div>
            ) : chosen?.needsCare ? (
              <p className="border border-hair bg-paper px-3 py-2 text-[11.5px] text-ink/60">{client.business} is already on a care plan, so none is added.</p>
            ) : null}

            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <input type="checkbox" checked={onb} onChange={(e) => setOnb(e.target.checked)} className="h-4 w-4 accent-[#ff3c00]" />
              Include client onboarding (new client)
            </label>
            <div className="border border-hair bg-paper">
              <p className="mono-label border-b border-hair px-3 py-2 text-[9.5px] text-ink/50">What gets created · {total} tasks</p>
              <ul className="divide-y divide-hair">
                {plan.map(({ key, t, care: isCare }) => (
                  <li key={key + (isCare ? "-care" : "")} className="flex items-center justify-between px-3 py-2 text-[12.5px]">
                    <span>{t?.name || key}{isCare ? <span className="ml-1.5 mono-label text-[8.5px] text-[#ff3c00]">care plan</span> : null}{t?.sop_code ? <span className="ml-1.5 font-mono text-[10px] text-ink/40">{t.sop_code}</span> : null}</span>
                    <span className={`font-mono text-[11px] ${t ? "text-ink/50" : "text-red-700"}`}>{t ? `${t.items?.length || 0}` : "missing"}</span>
                  </li>
                ))}
              </ul>
            </div>
            {err && <p className="text-[12.5px] text-red-700">{err}</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-hair px-5 py-4">
          <button type="button" onClick={onClose} className="h-10 px-4 text-[13px] text-ink/60 hover:text-ink">Cancel</button>
          <button type="button" disabled={busy || !total} onClick={go} className="inline-flex h-10 items-center gap-2 bg-[#ff3c00] px-5 text-[13px] font-medium text-white transition-colors hover:bg-ink disabled:opacity-50">
            <Rocket className="h-3.5 w-3.5" /> {busy ? "Creating…" : `Start ${chosen?.label || ""}${needsCare ? " + care plan" : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
