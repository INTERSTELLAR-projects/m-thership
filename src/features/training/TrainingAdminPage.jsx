// Operations > Training (Møthership admin). Justin builds tracks for Interstellar's own hires (the Hiring plan's
// Client Operations & Build Specialist) and for any client; the same workspace powers the portal's Training Studio.
import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import TrainingWorkspace from "./TrainingWorkspace";
import { inputCls } from "./ui";

export default function TrainingAdminPage() {
  const [sp, setSp] = useSearchParams();
  const scope = sp.get("scope") || "agency";
  const clients = useQuery({
    queryKey: ["training", "clients"],
    queryFn: async () => (await base44.entities.CRMClient.list("business", 500)) || [],
    staleTime: 300e3,
  });
  const list = useMemo(() => (clients.data || []).filter((c) => c.status !== "Lead" && c.business).sort((a, b) => String(a.business).localeCompare(String(b.business))), [clients.data]);
  const current = scope === "agency" ? null : list.find((c) => c.id === scope);

  return (
    <div className="min-h-screen bg-background pb-16">
      <PageHeader breadcrumb="Operations / People / Training" title="Training" rightText="Onboarding tracks built from SOPs">
        <label className="flex items-center gap-2">
          <span className="mono-label text-[9.5px] text-ink/50">For</span>
          <select value={scope} onChange={(e) => { const n = new URLSearchParams(sp); n.set("scope", e.target.value); n.delete("tab"); setSp(n, { replace: true }); }} className={`${inputCls} h-10 w-[240px] py-1.5`} aria-label="Whose training">
            <option value="agency">Interstellar (our team)</option>
            {list.map((c) => <option key={c.id} value={c.id}>{c.business}</option>)}
          </select>
        </label>
      </PageHeader>
      <div className="px-5 pt-6 md:px-8">
        {current && <p className="mb-4 text-[12.5px] text-ink/55">Building for <span className="font-medium text-ink">{current.business}</span>. AI drafting is recorded against their Fuel as admin usage; their owner sees these tracks in the portal&apos;s Training Studio when it&apos;s switched on.</p>}
        {scope === "agency" && <p className="mb-4 text-[12.5px] text-ink/55">Interstellar&apos;s own team. The onboarding track for the planned hire in the Hiring plan lives here; assign it from the Hiring plan when the hire is added.</p>}
        <TrainingWorkspace key={scope} scopeId={scope} initialTab={sp.get("tab") === "people" ? "people" : "tracks"} />
      </div>
    </div>
  );
}
