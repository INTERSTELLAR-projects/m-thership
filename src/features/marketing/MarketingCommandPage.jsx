// /marketing-command — Interstellar's whole marketing plan on one screen (docs/marketing-command.md).
// Season header, the revenue line (daily target x days, with an editable deal mix), one row per pillar
// (weekly target vs actual, progress, pace, log today). ?wall=1 = full-screen TV wall mode, refreshes every minute.
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronDown, Loader2, Maximize2, Minimize2, Plus, Sparkles, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import { useList } from "@/lib/useData";
import { PILLARS, dealMixTotal, pace, revenueTargets, weekActual, weekOf } from "@/lib/marketingCommand";

const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString("en-US")}`;
const fmtNum = (n, unit) => (unit === "USD" ? money(n) : Math.round(Number(n) || 0).toLocaleString("en-US"));
const ptToday = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
const PACE = {
  done: { label: "Done", tone: "bg-green-100 text-green-800", bar: "#15803d" },
  ahead: { label: "Ahead", tone: "bg-green-100 text-green-800", bar: "#ff6a00" },
  on_pace: { label: "On pace", tone: "bg-amber-100 text-amber-800", bar: "#ff6a00" },
  behind: { label: "Behind", tone: "bg-red-100 text-red-700", bar: "#ff3c00" },
  no_target: { label: "No target", tone: "bg-ink/[0.07] text-ink/55", bar: "#999" },
};
const STATUS_TONE = { draft: "bg-amber-100 text-amber-800", active: "bg-green-100 text-green-800", archived: "bg-ink/[0.07] text-ink/55" };

function usePlanData(planId, week) {
  const targetsQ = useList("PillarTarget", { filter: { plan_id: planId || "__none__" }, sort: "pillar", limit: 50, enabled: !!planId });
  const logsQ = useList("PillarLog", { filter: { scope: "interstellar", date: { $gte: week.start, $lte: week.end } }, sort: "-date", limit: 500 });
  return { targets: targetsQ.data || [], logs: logsQ.data || [], loading: targetsQ.isLoading || logsQ.isLoading };
}

function rowsFor(targets, logs, week) {
  return PILLARS.map((p) => {
    const t = targets.find((x) => x.pillar === p.key);
    const actual = weekActual(logs, p.key, week);
    const unit = t?.unit || p.unit;
    return { ...p, target: t, unit, actual, pace: pace({ target: t?.weekly_target, actual, workdaysElapsed: week.workdaysElapsed }) };
  });
}

function Bar({ pct, color, dark = false, h = "h-2" }) {
  return (
    <div className={`${h} w-full overflow-hidden ${dark ? "bg-white/10" : "bg-ink/[0.08]"}`} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full transition-[width] duration-700" style={{ width: `${Math.min(100, pct)}%`, background: color }} />
    </div>
  );
}

function PillarRow({ row, plan, onChanged }) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState(null);
  const p = PACE[row.pace.state];
  const log = async () => {
    const n = Number(val);
    if (!Number.isFinite(n) || n <= 0) return;
    setBusy(true);
    try { await base44.entities.PillarLog.create({ date: ptToday(), pillar: row.key, actual: n, plan_id: plan?.id || "", source: "manual", scope: "interstellar" }); setVal(""); onChanged(); } finally { setBusy(false); }
  };
  const saveTarget = async () => {
    const n = Number(edit);
    if (!Number.isFinite(n) || n < 0 || !plan) { setEdit(null); return; }
    if (row.target) await base44.entities.PillarTarget.update(row.target.id, { weekly_target: Math.round(n) });
    else await base44.entities.PillarTarget.create({ plan_id: plan.id, pillar: row.key, weekly_target: Math.round(n), unit: row.unit, status: plan.status === "active" ? "approved" : "draft", scope: "interstellar" });
    setEdit(null); onChanged();
  };
  return (
    <li className="px-4 py-3.5 md:px-5" data-testid={`pillar-${row.key}`}>
      <div className="grid items-center gap-x-4 gap-y-2 md:grid-cols-[170px,1fr,190px,250px]">
        <div className="min-w-0">
          <p className="text-[14.5px] font-semibold tracking-[-0.01em]">{row.label}</p>
          <p className="truncate text-[11.5px] text-ink/50">{row.target?.owner ? `${row.target.owner} · ` : ""}{row.target?.channel_notes || row.hint}</p>
        </div>
        <div>
          <div className="mb-1 flex items-baseline justify-between gap-2 font-mono text-[12px] tabular-nums">
            <span><span className="text-[15px] font-semibold text-ink">{fmtNum(row.actual, row.unit)}</span><span className="text-ink/45"> / </span>
              {edit !== null ? (
                <input autoFocus type="number" min="0" value={edit} onChange={(e) => setEdit(e.target.value)} onBlur={saveTarget} onKeyDown={(e) => e.key === "Enter" && saveTarget()} className="w-20 border border-[#ff3c00] bg-white px-1 text-[12px]" aria-label={`${row.label} weekly target`} />
              ) : (
                <button type="button" onClick={() => setEdit(String(row.target?.weekly_target ?? ""))} disabled={!plan} className="text-ink/70 underline decoration-dotted underline-offset-2 hover:text-[#ff3c00]" title="Edit weekly target">{row.target ? fmtNum(row.target.weekly_target, row.unit) : "set target"}</button>
              )}
              <span className="text-ink/45"> {row.unit === "USD" ? "/wk" : `${row.unit}/wk`}</span></span>
            <span className="text-ink/45">{row.pace.pct}%</span>
          </div>
          <Bar pct={row.pace.pct} color={p.bar} />
        </div>
        <div className="flex items-center gap-2 text-[11.5px] text-ink/55">
          <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] ${p.tone}`}>{p.label}</span>
          {row.target ? <span>by today {fmtNum(row.pace.expected, row.unit)}</span> : null}
        </div>
        <div className="flex items-center gap-1.5">
          <input type="number" min="0" inputMode="decimal" value={val} onChange={(e) => setVal(e.target.value)} onKeyDown={(e) => e.key === "Enter" && log()} placeholder={`Today's ${row.unit}`} className="h-9 w-full min-w-0 border border-hair bg-white px-2.5 text-[13px] outline-none focus:border-[#ff3c00]" aria-label={`Log ${row.label} today`} />
          <button type="button" onClick={log} disabled={busy || !val} className="inline-flex h-9 shrink-0 items-center gap-1 bg-ink px-3 text-[12px] text-white hover:bg-[#ff3c00] disabled:opacity-40">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}Log</button>
          {row.target?.reasoning && <button type="button" onClick={() => setOpen((o) => !o)} className="p-1.5 text-ink/40 hover:text-ink" aria-label="Why this target"><ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} /></button>}
        </div>
      </div>
      {open && row.target?.reasoning && <p className="mt-2 border-l-2 border-[#ff6a00] pl-3 text-[12.5px] leading-[1.5] text-ink/65">{row.target.reasoning}</p>}
    </li>
  );
}

function RevenueLine({ plan, onChanged }) {
  const rev = revenueTargets(plan || {});
  const [mix, setMix] = useState(null);
  const [saving, setSaving] = useState(false);
  const rows = mix || plan?.deal_mix || [];
  const total = dealMixTotal(rows);
  const gap = rev.weekly - total;
  const set = (i, k, v) => setMix(rows.map((r, j) => (j === i ? { ...r, [k]: k === "label" ? v : Number(v) || 0 } : r)));
  const save = async (patch = {}) => {
    if (!plan) return;
    setSaving(true);
    try { await base44.entities.MarketingPlan.update(plan.id, { deal_mix: rows, ...patch }); setMix(null); onChanged(); } finally { setSaving(false); }
  };
  return (
    <section className="border border-hair bg-paper/80" aria-label="Revenue line" data-testid="revenue-line">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hair px-4 py-3 md:px-5">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Revenue line</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">Targets and a planned deal mix, not results</span>
      </header>
      <div className="grid gap-5 p-4 md:grid-cols-[260px,1fr] md:p-5">
        <div>
          <p className="font-mono text-[34px] font-semibold leading-none tracking-[-0.03em] tabular-nums">{money(rev.weekly)}<span className="text-[14px] text-ink/45">/wk</span></p>
          <p className="mt-2 text-[13px] text-ink/60">
            <input type="number" min="0" defaultValue={rev.daily} key={`d${plan?.id}${rev.daily}`} onBlur={(e) => Number(e.target.value) !== rev.daily && save({ daily_revenue_target: Number(e.target.value) || 0 })} disabled={!plan} className="w-20 border-b border-dotted border-ink/30 bg-transparent font-mono text-[13px] outline-none focus:border-[#ff3c00]" aria-label="Daily revenue target" />/day ×{" "}
            <input type="number" min="1" max="7" defaultValue={rev.days} key={`n${plan?.id}${rev.days}`} onBlur={(e) => Number(e.target.value) !== rev.days && save({ days_per_week: Number(e.target.value) || 5 })} disabled={!plan} className="w-10 border-b border-dotted border-ink/30 bg-transparent font-mono text-[13px] outline-none focus:border-[#ff3c00]" aria-label="Selling days per week" /> days
          </p>
          <div className="mt-4">
            <div className="mb-1 flex justify-between font-mono text-[11px] text-ink/55"><span>Deal mix {money(total)}</span><span>{rev.weekly ? Math.round((total / rev.weekly) * 100) : 0}%</span></div>
            <Bar pct={rev.weekly ? (total / rev.weekly) * 100 : 0} color="linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)" h="h-2.5" />
            <p className={`mt-1.5 text-[12px] ${gap > 0 ? "text-[#c23000]" : "text-green-800"}`}>{gap > 0 ? `This mix leaves ${money(gap)}/wk uncovered.` : gap < 0 ? `This mix plans ${money(-gap)}/wk over target.` : "This mix covers the weekly target."}</p>
          </div>
        </div>
        <div>
          <table className="w-full text-[13px]">
            <thead><tr className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-ink/45"><th className="pb-1.5 text-left">Deals / wk</th><th className="pb-1.5 text-left">At</th><th className="pb-1.5 text-left">What</th><th className="pb-1.5 text-right">Total</th><th /></tr></thead>
            <tbody className="divide-y divide-hair/70">
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="py-1.5 pr-2"><input type="number" min="0" value={r.count} onChange={(e) => set(i, "count", e.target.value)} className="w-14 border border-hair bg-white px-1.5 py-1 font-mono" aria-label="Deal count" /></td>
                  <td className="py-1.5 pr-2"><input type="number" min="0" value={r.amount} onChange={(e) => set(i, "amount", e.target.value)} className="w-24 border border-hair bg-white px-1.5 py-1 font-mono" aria-label="Deal amount" /></td>
                  <td className="py-1.5 pr-2"><input value={r.label || ""} onChange={(e) => set(i, "label", e.target.value)} className="w-full min-w-[120px] border border-hair bg-white px-1.5 py-1" aria-label="Deal type" /></td>
                  <td className="py-1.5 text-right font-mono tabular-nums">{money((Number(r.count) || 0) * (Number(r.amount) || 0))}</td>
                  <td className="py-1.5 pl-1 text-right"><button type="button" onClick={() => setMix(rows.filter((_, j) => j !== i))} className="p-1 text-ink/35 hover:text-red-600" aria-label="Remove row"><Trash2 className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => setMix([...rows, { count: 1, amount: 500, label: "" }])} disabled={!plan} className="inline-flex h-8 items-center gap-1 border border-hair bg-white px-2.5 text-[12px] hover:border-ink"><Plus className="h-3 w-3" />Add row</button>
            {mix && <button type="button" onClick={() => save()} disabled={saving} className="inline-flex h-8 items-center gap-1 bg-ink px-3 text-[12px] text-white hover:bg-[#ff3c00]">{saving && <Loader2 className="h-3 w-3 animate-spin" />}Save mix</button>}
          </div>
          {plan?.pricing_context?.length ? <ul className="mt-3 space-y-0.5 text-[11.5px] text-ink/50">{plan.pricing_context.map((c, i) => <li key={i}>· {c}</li>)}</ul> : null}
        </div>
      </div>
    </section>
  );
}

function WallMode({ plan, rows, week, onExit }) {
  const rev = revenueTargets(plan || {});
  const total = dealMixTotal(plan?.deal_mix);
  const behind = rows.filter((r) => r.pace.state === "behind").length;
  return (
    <div className="fixed inset-0 z-[90] flex flex-col overflow-hidden bg-[#0d0c0b] text-white" data-testid="marketing-wall">
      <div className="h-1.5 w-full" style={{ background: "linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)" }} />
      <div className="flex items-end justify-between gap-6 px-[3vw] pt-[2.5vh]">
        <div>
          <p className="font-mono text-[1.1vw] uppercase tracking-[0.2em] text-[#ff6a00]">Marketing Command · week of {week.start}</p>
          <h1 className="mt-1 text-[3.2vw] font-semibold leading-none tracking-[-0.04em]">{plan?.title || "No active plan"}</h1>
        </div>
        <div className="text-right">
          <p className="font-mono text-[3.4vw] font-semibold leading-none tabular-nums">{money(rev.weekly)}<span className="text-[1.4vw] text-white/45">/wk</span></p>
          <p className="mt-1 font-mono text-[1vw] text-white/55">{money(rev.daily)}/day × {rev.days} · planned mix {money(total)}</p>
        </div>
      </div>
      <ul className="grid flex-1 grid-cols-2 gap-[1.2vw] px-[3vw] py-[2.5vh] lg:grid-cols-3">
        {rows.map((r) => {
          const p = PACE[r.pace.state];
          return (
            <li key={r.key} className="flex flex-col justify-between border border-white/10 bg-white/[0.03] p-[1.4vw]">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[1.7vw] font-semibold tracking-[-0.02em]">{r.label}</p>
                <span className="font-mono text-[0.9vw] uppercase tracking-[0.12em]" style={{ color: r.pace.state === "behind" ? "#ff3c00" : r.pace.state === "no_target" ? "#888" : "#ffaa00" }}>{p.label}</span>
              </div>
              <p className="font-mono text-[4.2vw] font-semibold leading-none tabular-nums">{fmtNum(r.actual, r.unit)}<span className="text-[1.6vw] text-white/40"> / {r.target ? fmtNum(r.target.weekly_target, r.unit) : "—"}</span></p>
              <div><Bar pct={r.pace.pct} color={p.bar} dark h="h-[1vh]" /><p className="mt-1 font-mono text-[0.9vw] text-white/45">{r.unit} this week · {r.pace.pct}% · by today {fmtNum(r.pace.expected, r.unit)}</p></div>
            </li>
          );
        })}
      </ul>
      <div className="flex items-center justify-between px-[3vw] pb-[2vh] font-mono text-[0.9vw] text-white/40">
        <span>{behind ? `${behind} pillar${behind > 1 ? "s" : ""} behind pace` : "Every pillar on pace"} · refreshes every minute</span>
        <button type="button" onClick={onExit} className="inline-flex items-center gap-1.5 text-white/60 hover:text-white"><Minimize2 className="h-4 w-4" />Exit wall</button>
      </div>
    </div>
  );
}

export default function MarketingCommandPage() {
  const qc = useQueryClient();
  const [params, setParams] = useSearchParams();
  const wall = params.get("wall") === "1";
  const plansQ = useList("MarketingPlan", { filter: { scope: "interstellar", status: { $in: ["draft", "active"] } }, sort: "-created_date", limit: 30 });
  const plans = useMemo(() => plansQ.data || [], [plansQ.data]);
  const [pick, setPick] = useState("");
  const plan = plans.find((p) => p.id === pick) || plans.find((p) => p.status === "active") || plans[0] || null;
  const week = weekOf(ptToday());
  const { targets, logs, loading } = usePlanData(plan?.id, week);
  const rows = rowsFor(targets, logs, week);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const refresh = () => ["MarketingPlan", "PillarTarget", "PillarLog"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  // Wall display: re-read every minute.
  useEffect(() => { if (!wall) return undefined; const t = setInterval(refresh, 60_000); return () => clearInterval(t); }, [wall]); // eslint-disable-line react-hooks/exhaustive-deps

  const call = async (label, args, ok) => {
    setBusy(label); setMsg(null);
    try {
      const r = await base44.functions.invoke("marketing-command", args);
      if (r?.data?.error) throw new Error(r.data.error);
      setMsg({ ok: true, text: ok(r.data || {}) });
      if (r?.data?.plan_id) setPick(r.data.plan_id);
      refresh();
    } catch (e) { setMsg({ ok: false, text: e?.response?.data?.error || e.message }); } finally { setBusy(""); }
  };
  const generate = () => call("gen", { action: "generate" }, (d) => `Draft plan ready: ${d.targets} pillar targets.${d.missing?.length ? ` Missing: ${d.missing.join(", ")}.` : ""} Review, then approve.`);
  const approve = () => call("approve", { action: "approve", plan_id: plan.id }, () => "Plan approved and active. Approving spends nothing: ad budgets still go through Ads Studio approvals.");

  // Portalled to <body>: the layout's page-enter animation would otherwise trap position:fixed inside the page.
  if (wall) return createPortal(<WallMode plan={plan} rows={rows} week={week} onExit={() => setParams({}, { replace: true })} />, document.body);

  return (
    <div className="pb-16">
      <PageHeader breadcrumb="Sales / Marketing Command" title="Marketing /Command" rightText={`Week of ${week.start}`}>
        <Link to="/marketing-command?wall=1" className="inline-flex h-9 items-center gap-1.5 border border-hair bg-card px-3 text-[12.5px] text-ink/75 hover:border-ink" data-testid="wall-link"><Maximize2 className="h-3.5 w-3.5" />Wall mode</Link>
      </PageHeader>
      <div className="mx-auto w-full max-w-[1120px] space-y-4 px-4 pt-5 md:px-8">
        <section className="border border-hair bg-paper/80" aria-label="Season plan" data-testid="season-header">
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-4 md:px-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                {plan && <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] ${STATUS_TONE[plan.status]}`}>{plan.status}</span>}
                {plan?.is_sample && <span className="font-mono text-[10px] text-[#ff3c00]">[SAMPLE]</span>}
                {plans.length > 1 && (
                  <select value={plan?.id || ""} onChange={(e) => setPick(e.target.value)} className="h-7 border border-hair bg-white px-1.5 text-[12px]" aria-label="Plan">
                    {plans.map((p) => <option key={p.id} value={p.id}>{p.title} ({p.status})</option>)}
                  </select>
                )}
              </div>
              <h2 className="mt-2 text-[22px] font-semibold tracking-[-0.03em]">{plan ? plan.title : "No season plan yet"}</h2>
              {plan && <p className="mt-0.5 font-mono text-[11.5px] text-ink/50">{plan.season} · {plan.start_date} → {plan.end_date}</p>}
              {plan?.summary && <p className="mt-2 max-w-[720px] text-[13.5px] leading-[1.55] text-ink/70">{plan.summary}</p>}
              {plan?.holiday_windows?.length ? <p className="mt-2 flex flex-wrap gap-1.5">{plan.holiday_windows.map((h) => <span key={h.key + h.start} className="rounded-sm border border-hair bg-white px-1.5 py-0.5 text-[11px] text-ink/60">{h.label} · {h.start.slice(5)}–{h.end.slice(5)}</span>)}</p> : null}
              {plan?.notes && <p className="mt-2 text-[12px] text-ink/55">{plan.notes}</p>}
            </div>
            <div className="flex flex-wrap gap-2">
              {plan?.status === "draft" && <button type="button" onClick={approve} disabled={!!busy} className="inline-flex h-10 items-center gap-1.5 bg-ink px-4 text-[13px] text-white hover:bg-[#ff3c00] disabled:opacity-50">{busy === "approve" ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}Approve plan</button>}
              <button type="button" onClick={generate} disabled={!!busy} className="inline-flex h-10 items-center gap-1.5 bg-[#ff3c00] px-4 text-[13px] text-white hover:bg-ink disabled:opacity-50" data-testid="generate-plan">{busy === "gen" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}{busy === "gen" ? "Drafting…" : "Generate season plan"}</button>
            </div>
          </div>
          {msg && <p role="status" className={`border-t border-hair px-4 py-2.5 text-[13px] md:px-5 ${msg.ok ? "text-green-800" : "text-red-700"}`}>{msg.text}</p>}
        </section>

        <RevenueLine plan={plan} onChanged={refresh} />

        <section className="border border-hair bg-paper/80" aria-label="Pillars" data-testid="pillars">
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hair px-4 py-3 md:px-5">
            <h2 className="text-[15px] font-semibold tracking-[-0.01em]">Volume by pillar · this week</h2>
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">Mon–Fri pace · {week.workdaysElapsed}/5 days in</span>
          </header>
          {loading ? <p className="px-5 py-5 text-[13px] text-ink/50">Loading…</p> : <ul className="divide-y divide-hair">{rows.map((r) => <PillarRow key={r.key} row={r} plan={plan} onChanged={refresh} />)}</ul>}
        </section>
        <p className="text-[11.5px] text-ink/45">Targets are plans; actuals are only what someone logged. Approving a plan never spends money or sends anything.</p>
      </div>
    </div>
  );
}

