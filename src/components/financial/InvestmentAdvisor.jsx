import { useEffect, useMemo, useState } from "react";
import { BrainCircuit, Check, CheckCheck, Clock, Loader2, RefreshCw, ShieldAlert, ThumbsDown, Lightbulb, CalendarClock } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { computeGoal, money } from "./finance/metrics";
import { EmptyState, EstimateTag, FinanceStyles, Panel } from "./finance/ui";
import useRevenueGoal from "./finance/useRevenueGoal";
import { generateAdvice } from "./finance/ai";

const CATEGORY_LABEL = {
  hire: "Hire", ads: "Ads", tools: "Tools", productized_offer: "Productized offer", systems: "Systems",
  sales: "Sales", training: "Training", personal_general: "Personal (general info)", other: "Other",
};
const FILTERS = [["open", "Open"], ["accepted", "Accepted"], ["done", "Done"], ["rejected", "Rejected"], ["all", "All"]];

export default function InvestmentAdvisor({ data }) {
  const { finance: f, loading } = data;
  const { goal } = useRevenueGoal(true);
  const [items, setItems] = useState(null);
  const [filter, setFilter] = useState("open");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    base44.entities.InvestmentAdvice.list("-generated_at", 300).then(setItems).catch(() => setItems([]));
  }, []);

  const goalMath = useMemo(() => (goal && f ? computeGoal(goal, f) : null), [goal, f]);

  const batches = useMemo(() => {
    const map = new Map();
    (items || []).forEach((r) => { if (!map.has(r.batch_id)) map.set(r.batch_id, r); });
    return [...map.values()];
  }, [items]);
  const latest = batches[0] || null;
  const daysSince = latest?.generated_at ? Math.floor((Date.now() - new Date(latest.generated_at).getTime()) / 86400000) : null;
  const lastScheduled = (items || []).find((r) => r.trigger === "scheduled");

  const stats = useMemo(() => {
    const all = items || [];
    const c = (s) => all.filter((r) => r.status === s).length;
    return { total: all.length, accepted: c("accepted"), done: c("done"), rejected: c("rejected"), open: c("new"), batches: batches.length };
  }, [items, batches]);

  const visible = useMemo(() => {
    const all = items || [];
    if (filter === "open") return all.filter((r) => r.status === "new" || r.status === "accepted");
    if (filter === "all") return all;
    return all.filter((r) => r.status === filter);
  }, [items, filter]);

  const refresh = async () => {
    if (!f) return;
    setBusy(true); setError("");
    try {
      const created = await generateAdvice({ finance: f, goal, goalMath, existing: items || [] });
      setItems((prev) => [...(created || []), ...(prev || [])]);
      setFilter("open");
    } catch (e) {
      setError(e?.message || "Could not generate insights — try again.");
    }
    setBusy(false);
  };

  const setFeedback = async (rec, fields) => {
    const patch = { ...fields, feedback_at: new Date().toISOString() };
    setItems((prev) => prev.map((r) => (r.id === rec.id ? { ...r, ...patch } : r)));
    await base44.entities.InvestmentAdvice.update(rec.id, patch).catch(() => {});
  };

  if (loading || !f || items == null) {
    return <div className="flex items-center justify-center gap-2 py-24 text-ink/40"><Loader2 className="h-5 w-5 animate-spin" /><span className="text-xs">Loading advisor memory…</span></div>;
  }

  return (
    <div className="space-y-5">
      <FinanceStyles />

      <section className="band-dark grain fin-rise relative overflow-hidden rounded-md border border-ink p-5 md:p-6">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] flame-bg" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2">
              <BrainCircuit className="h-4 w-4 text-[#ff6a00]" />
              <span className="mono-label text-white/55">(Investment advisor · always learning)</span>
            </div>
            <h2 className="mt-2 text-[26px] font-semibold leading-tight tracking-[-0.035em] text-white">Where your next dollar and hour should go.</h2>
            <p className="mt-2 text-[12.5px] leading-relaxed text-white/60">
              Each refresh reads today&apos;s MRR {money(f.mrr)}, {f.accounts.length} accounts, {money(f.expensesMonthly)}/mo expenses
              {goal ? ` and your ${goal.title || "revenue"} goal` : ""}, plus every past recommendation and your accept / reject / done notes, so it adapts to you.
            </p>
          </div>
          <button type="button" disabled={busy} onClick={refresh} className="btn-roll is-flame rounded-md disabled:opacity-60">
            <span className="roll"><span>{busy ? "Thinking…" : "Refresh insights"}</span><span>{busy ? "Thinking…" : "Refresh insights"}</span></span>
            <span className="box rounded">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}</span>
          </button>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[["Recommendations", stats.total], ["Batches", stats.batches], ["Accepted", stats.accepted], ["Done", stats.done], ["Rejected", stats.rejected]].map(([l, v]) => (
            <div key={l} className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2">
              <p className="mono-label !text-[9px] text-white/40">{l}</p>
              <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">{v}</p>
            </div>
          ))}
        </div>

        {latest?.learning_summary && (
          <div className="mt-4 rounded-md border border-[#ff6a00]/30 bg-[#ff3c00]/[0.08] p-3">
            <p className="mono-label !text-[9px] text-[#ffaa00]">What it learned · {fmtDateTime(latest.generated_at)}</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-white/80">{latest.learning_summary}</p>
          </div>
        )}
        {daysSince != null && daysSince >= 7 && !busy && (
          <p className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] text-[#ffaa00]"><Clock className="h-3.5 w-3.5" />Last refresh was {daysSince} days ago. Numbers have probably moved; refresh to re-learn.</p>
        )}
        {error && <p className="mt-3 text-[12px] text-[#ff8a5c]">{error}</p>}
      </section>

      <div className="flex flex-wrap items-center gap-1.5">
        {FILTERS.map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded-full border px-3 py-1 text-[11px] transition-colors ${filter === k ? "border-[#ff3c00] bg-[#ff3c00] text-white" : "border-hair text-ink/55 hover:text-ink"}`}>
            {l}{k === "open" ? ` · ${stats.open + stats.accepted}` : ""}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={Lightbulb} title={stats.total ? "Nothing in this view" : "No recommendations yet"}
          body={stats.total ? "Switch filters or refresh for a new batch." : "Hit Refresh insights. The advisor uses only your real numbers and remembers your feedback for next time."} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visible.map((r, i) => <AdviceCard key={r.id} rec={r} index={i} onFeedback={setFeedback} />)}
        </div>
      )}

      <Panel title="(Weekly refresh)" subtitle="How the advisor keeps learning without you clicking">
        <div className="flex items-start gap-3 text-[12px] leading-relaxed text-ink/65">
          <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-[#ff3c00]" />
          <div className="space-y-1.5">
            <p>The backend function <code className="rounded bg-ink/[0.05] px-1 font-mono text-[11px]">financeAdvisorWeekly</code> builds a fresh snapshot from CRM, expenses, pipeline and your goal, feeds it the last 40 recommendations with your feedback, and saves a new batch (marked <i>scheduled</i>). It skips itself if a batch was made in the last 6 days.</p>
            <p>{lastScheduled ? `Last scheduled run: ${fmtDateTime(lastScheduled.generated_at)}.` : "No scheduled run has happened yet. To turn it on, schedule that function weekly in the Base44 dashboard (Workflows → new scheduled workflow → run backend function financeAdvisorWeekly)."}</p>
          </div>
        </div>
      </Panel>

      <p className="flex items-start gap-2 text-[11px] text-ink/45">
        <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Advisory only. This never executes trades, moves money or spends anything. Costs, impact and payback are estimates. Personal-investing items are general information, not financial advice.
      </p>
    </div>
  );
}

function AdviceCard({ rec, index, onFeedback }) {
  const [note, setNote] = useState(rec.feedback_note || "");
  const dirty = note !== (rec.feedback_note || "");
  const personal = rec.kind === "personal";
  const statusStyle = { accepted: "border-[#ff6a00]/50", done: "border-ink/40 opacity-80", rejected: "border-hair opacity-60" }[rec.status] || "border-hair";
  const costLabel = rec.cost_type === "monthly" ? "/mo" : rec.cost_type === "time_only" ? " (time only)" : " one-time";

  return (
    <section className={`card-hover fin-rise flex flex-col rounded-md border bg-card p-5 ${statusStyle}`} style={{ animationDelay: `${index * 50}ms` }}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${personal ? "bg-ink/[0.07] text-ink/65" : "bg-[#ff3c00]/10 text-[#d83300]"}`}>{CATEGORY_LABEL[rec.category] || rec.category}</span>
          {rec.priority != null && <span className="font-mono text-[9.5px] uppercase tracking-wider text-ink/40">P{rec.priority}</span>}
          {rec.confidence && <span className="font-mono text-[9.5px] uppercase tracking-wider text-ink/40">{rec.confidence} conf.</span>}
          {rec.trigger === "scheduled" && <span className="font-mono text-[9.5px] uppercase tracking-wider text-ink/40">auto</span>}
        </div>
        <StatusPill status={rec.status} />
      </div>

      <h4 className="mt-3 text-[16px] font-semibold leading-snug tracking-[-0.02em] text-ink">{rec.title}</h4>
      {rec.rationale && <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/65">{rec.rationale}</p>}
      {personal && <p className="mt-2 text-[11px] font-medium text-ink/55">General information, not financial advice.</p>}
      {rec.first_step && (
        <p className="mt-3 rounded-md bg-ink/[0.035] px-3 py-2 text-[12px] text-ink/75"><b className="font-semibold text-ink">First step:</b> {rec.first_step}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[11.5px] text-ink/60">
        {rec.est_cost != null && <span>Cost <b className="text-ink">{money(rec.est_cost)}</b>{costLabel}</span>}
        {rec.hours_per_week != null && <span><b className="text-ink">{rec.hours_per_week}</b> h/wk</span>}
        {rec.est_monthly_impact != null && <span>Impact <b className="flame-text">+{money(rec.est_monthly_impact)}</b>/mo</span>}
        {rec.payback_months != null && <span>Payback <b className="text-ink">{rec.payback_months}</b> mo</span>}
        <EstimateTag />
      </div>

      <div className="mt-auto pt-4">
        <div className="flex flex-wrap gap-1.5">
          <FbButton active={rec.status === "accepted"} onClick={() => onFeedback(rec, { status: rec.status === "accepted" ? "new" : "accepted" })} icon={Check} label="Accept" />
          <FbButton active={rec.status === "done"} onClick={() => onFeedback(rec, { status: rec.status === "done" ? "accepted" : "done" })} icon={CheckCheck} label="Done" />
          <FbButton active={rec.status === "rejected"} onClick={() => onFeedback(rec, { status: rec.status === "rejected" ? "new" : "rejected" })} icon={ThumbsDown} label="Reject" muted />
        </div>
        <div className="mt-2 flex gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && dirty) onFeedback(rec, { feedback_note: note }); }}
            placeholder="Why? (the advisor reads this next time)" className="min-w-0 flex-1 rounded-md border border-hair bg-transparent px-2.5 py-1.5 text-[12px] text-ink outline-none placeholder:text-ink/35 focus:border-[#ff3c00]/60" />
          {dirty && <button type="button" onClick={() => onFeedback(rec, { feedback_note: note })} className="rounded-md px-3 text-[11px] font-semibold text-white flame-bg">Save</button>}
        </div>
        <p className="mt-2 font-mono text-[9px] uppercase tracking-[0.1em] text-ink/35">
          {fmtDateTime(rec.generated_at)}{rec.snapshot?.mrr != null ? ` · MRR then ${money(rec.snapshot.mrr)}` : ""}
        </p>
      </div>
    </section>
  );
}

function FbButton({ active, onClick, icon: Icon, label, muted }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors ${active ? (muted ? "border-ink bg-ink text-white" : "border-[#ff3c00] bg-[#ff3c00] text-white") : "border-hair text-ink/60 hover:border-ink/40 hover:text-ink"}`}>
      <Icon className="h-3 w-3" />{label}
    </button>
  );
}

function StatusPill({ status }) {
  const map = { new: ["New", "text-ink/50 border-hair"], accepted: ["Accepted", "text-[#d83300] border-[#ff3c00]/40"], done: ["Done", "text-ink border-ink/40"], rejected: ["Rejected", "text-ink/40 border-hair"] };
  const [l, c] = map[status] || map.new;
  return <span className={`rounded border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wider ${c}`}>{l}</span>;
}

function fmtDateTime(d) { return d ? new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—"; }
