import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { X, Rocket } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { useList } from "@/lib/useData";

// Mirrors PACKAGES in base44/functions/start-service (the function is the source of truth).
export const SERVICE_GROUPS = [
  { label: "Missions", items: [
    { key: "mission_alpha", label: "Mission ALPHA", price: "$8,997", onboarding: true, streams: ["intel_briefing", "website", "system", "ops_command", "brand_arsenal", "launch_grid", "transmission", "starship"] },
    { key: "mission_bravo", label: "Mission BRAVO", price: "$6,497", onboarding: true, streams: ["website", "system"] },
  ] },
  { label: "Builds", items: [
    { key: "custom_website", label: "Custom Website", price: "", onboarding: true, streams: ["website"] },
    { key: "command_system", label: "Command System", price: "", onboarding: true, streams: ["system"] },
  ] },
  { label: "Add-ons", items: [
    { key: "ops_command", label: "Ops Command", price: "$3,000", onboarding: false, streams: ["ops_command"] },
    { key: "brand_arsenal", label: "Brand Arsenal", price: "$2,500", onboarding: false, streams: ["brand_arsenal"] },
    { key: "intel_briefing", label: "Intel Briefing", price: "$1,500", onboarding: false, streams: ["intel_briefing"] },
    { key: "launch_grid", label: "Launch Grid", price: "$1,400", onboarding: false, streams: ["launch_grid"] },
    { key: "transmission", label: "Transmission Video", price: "", onboarding: false, streams: ["transmission"] },
  ] },
  { label: "Monthly", items: [
    { key: "orbit_local", label: "Ørbit Local", price: "$750/mo", onboarding: false, streams: ["orbit_setup", "orbit_local", "starship"] },
    { key: "orbit_multi", label: "Ørbit Multi-Location", price: "+$350/mo", onboarding: false, streams: ["orbit_multi"] },
    { key: "orbit_national", label: "Ørbit National", price: "$1,750/mo", onboarding: false, streams: ["orbit_setup", "orbit_national", "starship"] },
    { key: "orbit_global", label: "Ørbit Global", price: "$3,000/mo", onboarding: false, streams: ["orbit_setup", "orbit_national", "orbit_global", "starship"] },
    { key: "starship_care", label: "Starshïp Care", price: "$197/mo", onboarding: false, streams: ["starship"] },
  ] },
];
const ALL = SERVICE_GROUPS.flatMap((g) => g.items);
const today = () => new Date().toLocaleDateString("en-CA");

export default function StartServiceDialog({ open, client, onClose }) {
  const [pkg, setPkg] = useState("mission_alpha");
  const [start, setStart] = useState(today());
  const [onb, setOnb] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const nav = useNavigate();
  const qc = useQueryClient();
  const templates = useList("TaskTemplate", { sort: "sort_order", limit: 100, enabled: open });

  const chosen = ALL.find((p) => p.key === pkg);
  useEffect(() => { if (chosen) setOnb(chosen.onboarding); }, [pkg]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (open) { setErr(""); setStart(today()); } }, [open]);

  const plan = useMemo(() => {
    const byKey = new Map((templates.data || []).filter((t) => t.service_key).map((t) => [t.service_key, t]));
    const keys = [...(onb ? ["onboarding"] : []), ...(chosen?.streams || [])];
    return keys.map((k) => ({ key: k, t: byKey.get(k) }));
  }, [templates.data, chosen, onb]);
  const total = plan.reduce((s, p) => s + (p.t?.items?.length || 0), 0);

  if (!open || !client) return null;

  const go = async () => {
    setBusy(true); setErr("");
    try {
      const res = await base44.functions.invoke("start-service", { client_id: client.id, package: pkg, start_date: start, include_onboarding: onb });
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
                      {p.price && <p className="font-mono text-[10.5px] text-ink/50">{p.price}</p>}
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
            <label className="flex cursor-pointer items-center gap-2 text-[13px]">
              <input type="checkbox" checked={onb} onChange={(e) => setOnb(e.target.checked)} className="h-4 w-4 accent-[#ff3c00]" />
              Include client onboarding (new client)
            </label>
            <div className="border border-hair bg-paper">
              <p className="mono-label border-b border-hair px-3 py-2 text-[9.5px] text-ink/50">What gets created · {total} tasks</p>
              <ul className="divide-y divide-hair">
                {plan.map(({ key, t }) => (
                  <li key={key} className="flex items-center justify-between px-3 py-2 text-[12.5px]">
                    <span>{t?.name || key}{t?.sop_code ? <span className="ml-1.5 font-mono text-[10px] text-ink/40">{t.sop_code}</span> : null}</span>
                    <span className={`font-mono text-[11px] ${t ? "text-ink/50" : "text-red-700"}`}>{t ? `${t.items?.length || 0}` : "missing"}</span>
                  </li>
                ))}
              </ul>
            </div>
            <p className="text-[11.5px] leading-relaxed text-ink/50">Creates one project with every SOP step as a task, dated from the start date, adds the service to the client and marks them Active. Edit the steps any time in Tasks → SOP Library.</p>
            {err && <p className="text-[12.5px] text-red-700">{err}</p>}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-hair px-5 py-4">
          <button type="button" onClick={onClose} className="h-10 px-4 text-[13px] text-ink/60 hover:text-ink">Cancel</button>
          <button type="button" disabled={busy || !total} onClick={go} className="inline-flex h-10 items-center gap-2 bg-[#ff3c00] px-5 text-[13px] font-medium text-white transition-colors hover:bg-ink disabled:opacity-50">
            <Rocket className="h-3.5 w-3.5" /> {busy ? "Creating…" : `Start ${chosen?.label || ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
