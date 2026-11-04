// Portal "Your plan usage" card. Renders nothing until at least one Studio is switched ON for this client
// (the usage function answers { visible: false } otherwise), and nothing on any error.
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { fmtNum } from "./plans";

export function UsageBar({ label, used, cap, unit }) {
  const unlimited = cap == null;
  const pct = unlimited || !cap ? 0 : Math.min(100, Math.round((used / cap) * 100));
  const tone = pct >= 100 ? "bg-red-600" : pct >= 80 ? "bg-[#ff6a00]" : "bg-ink";
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2 text-[12.5px]">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-ink/60">{fmtNum(used)} / {unlimited ? "Unlimited" : `${fmtNum(cap)}${unit ? ` ${unit}` : ""}`}</span>
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden bg-ink/[0.08]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
        <div className={`h-full ${tone}`} style={{ width: `${unlimited ? 0 : pct}%` }} />
      </div>
    </div>
  );
}

export default function PortalUsageCard({ previewId }) {
  const q = useQuery({
    queryKey: ["portal", previewId, "plan-usage"],
    retry: false,
    staleTime: 60_000,
    queryFn: async () => (await base44.functions.invoke("usage", { action: "summary", client_id: previewId })).data,
  });
  const d = q.data;
  if (!d || !d.visible) return null;
  const reset = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return (
    <section className="rounded-md border border-hair bg-card p-5" data-plan-usage>
      <p className="mono-label text-[9.5px] text-ink/50">Your plan usage · {d.plan_label}</p>
      <p className="mt-1 text-[17px] font-semibold tracking-[-0.02em]">This month&apos;s Studio allowance</p>
      <div className="mt-4 space-y-3.5">
        {d.caps.ai_action !== 0 && <UsageBar label="AI actions" used={d.usage.ai_action} cap={d.caps.ai_action} />}
        {d.caps.marketing_email !== 0 && <UsageBar label="Marketing emails" used={d.usage.marketing_email} cap={d.caps.marketing_email} />}
      </div>
      <p className="mt-3 text-[11.5px] leading-relaxed text-ink/50">Included free with your plan. Resets {reset}. If you reach the limit, new drafts and sends pause until then; everything you&apos;ve made stays yours.</p>
    </section>
  );
}
