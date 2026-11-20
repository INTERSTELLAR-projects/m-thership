// Brain unlocks on the client page (Build Engine, Nov 19 2026). Four unlocks driven by real Brain completeness
// (ClientUnlock rows kept current by the brain-unlocks function). Each shows exactly what is missing and what it
// prepared when it turned on. Posting (blogs, GBP, citations) stays off: unlocks prepare plans and drafts only.
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Lock, Loader2, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useList, timeAgo } from "@/lib/useData";
import { UNLOCKS } from "@/lib/unlocks";

const PREP_LABEL = {
  listings_created: (v) => `${v} launch grid listings added`,
  social_brand: (v) => (v === "created" ? "Social Studio voice guide created" : "Social Studio voice guide in place"),
  signature_options: (v) => `${v} email signature options in the portal`,
  social_job: () => "First social drafts queued (drafts only)",
  blog_frequency: (v) => `Blog engine: ${String(v).replace(/_/g, " ")} (posting off)`,
  seo_steps: (v) => `${v}-step SEO foundation list`,
  content_plan_job: () => "Content plan queued",
  transmission_job: () => "Transmission videos queued",
};

export default function BrainUnlocksPanel({ client, pct }) {
  const qc = useQueryClient();
  const rowsQ = useList("ClientUnlock", { filter: { client_id: client.id }, limit: 10, sort: "key" });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const byKey = new Map((rowsQ.data || []).map((r) => [r.key, r]));
  const recheck = async () => {
    setBusy(true); setErr("");
    try {
      await base44.functions.invoke("brain-unlocks", { action: "client", client_id: client.id });
      await qc.invalidateQueries();
    } catch (e) { setErr(String(e?.message || e)); }
    setBusy(false);
  };
  const checked = (rowsQ.data || []).map((r) => r.checked_at).filter(Boolean).sort().pop();
  return (
    <div className="px-4 py-3" data-testid="brain-unlocks">
      <div className="flex items-baseline justify-between">
        <span className="text-[12.5px] text-ink/60">What we know</span>
        <span className="font-mono text-[22px] font-semibold tabular-nums">{pct}%</span>
      </div>
      <div className="mt-2 h-2 bg-ink/[0.08]"><div className="h-full bg-[#ff3c00]" style={{ width: `${pct}%` }} /></div>
      <ul className="mt-3 space-y-2">
        {UNLOCKS.map((u) => {
          const r = byKey.get(u.key);
          const on = !!r?.on;
          const prepared = Object.entries(r?.prepared || {}).map(([k, v]) => (PREP_LABEL[k] ? PREP_LABEL[k](v) : null)).filter(Boolean);
          return (
            <li key={u.key} className={`border px-2.5 py-2 text-[12px] ${on ? "border-[#ff3c00]/40 bg-[#ff3c00]/[0.05]" : "border-hair"}`} data-testid={`unlock-${u.key}`}>
              <div className="flex items-start gap-2">
                {on ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff3c00]" /> : <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/40" />}
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <b className="font-medium">{u.label}</b>
                    <span className="shrink-0 font-mono text-[10px] text-ink/45">{r ? `${r.done}/${r.total}` : "not checked"}</span>
                  </div>
                  <p className="text-[11px] leading-snug text-ink/55">{u.gives}</p>
                  {r && !on && (r.missing || []).length ? <p className="mt-1 text-[11px] text-[#c24100]">Missing: {r.missing.map((m) => m.label).join(", ")}</p> : null}
                  {on && prepared.length ? <p className="mt-1 text-[11px] text-ink/60">{prepared.join(" · ")}</p> : null}
                  {on && !r?.prepared_at ? <p className="mt-1 text-[11px] text-ink/45">Unlocked. Work is prepared automatically for Build Engine clients.</p> : null}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] text-ink/40">{checked ? `Checked ${timeAgo(checked)}` : "Checks daily"}</span>
        <button type="button" onClick={recheck} disabled={busy} className="inline-flex items-center gap-1 border border-hair px-2 py-1 text-[11.5px] text-ink/60 hover:border-[#ff3c00] hover:text-[#ff3c00] disabled:opacity-50">
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />} Recheck now
        </button>
      </div>
      {err ? <p className="mt-1 text-[11px] text-red-600">{err}</p> : null}
    </div>
  );
}
