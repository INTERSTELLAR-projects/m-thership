import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowUpRight, Calculator, Check, ChevronDown, ClipboardCheck, Copy, ExternalLink, Info, Loader2,
  Pencil, RotateCcw, Save, Settings2, Target, UserPlus, X,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import { useToast } from "@/components/ui/use-toast";
import { GROUPS, SEED_BLOCKS } from "./content";
import { ensurePlan, loadHiring, monthLabel } from "./engine";

const money = (n) => "$" + Math.round(Number(n) || 0).toLocaleString("en-US");
const signed = (n) => (n < 0 ? `−${money(-n)}` : money(n));
const STATE_STYLE = {
  start: "bg-[#ff3c00] text-white border-[#ff3c00]",
  ready: "bg-[#ffaa00]/15 text-[#b85400] border-[#ffaa00]/50",
  idle: "bg-ink/[0.05] text-ink/60 border-hair",
};

async function copyText(text) {
  try { await navigator.clipboard.writeText(text || ""); return true; } catch { return false; }
}

export const HIRING_QUERY = ["hiring", "plan"];

export default function HiringPlanPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useQuery({ queryKey: HIRING_QUERY, queryFn: () => loadHiring({ months: 6 }), staleTime: 60 * 1000 });
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    let alive = true;
    ensurePlan()
      .then(() => { if (alive) { setSeeded(true); qc.invalidateQueries({ queryKey: HIRING_QUERY }); } })
      .catch((e) => toast({ title: "Couldn't set up the hiring plan", description: e.message, variant: "destructive" }));
    return () => { alive = false; };
  }, [qc, toast]);

  const d = q.data;
  const plan = d?.plan;

  const save = async (patch, msg) => {
    if (!plan) return false;
    try {
      await base44.entities.HiringPlan.update(plan.id, patch);
      await qc.invalidateQueries({ queryKey: HIRING_QUERY });
      qc.invalidateQueries({ queryKey: ["hiring", "trigger"] });
      if (msg) toast({ title: msg });
      return true;
    } catch (e) {
      toast({ title: "Could not save", description: e.message, variant: "destructive" });
      return false;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-16">
      <PageHeader breadcrumb="Agency / Growth / Hiring plan" title="Hiring plan" rightText="Admin only · never in the portal" />
      {q.isError ? (
        <p className="px-5 py-10 text-sm text-[#d83300] md:px-8">Couldn&apos;t load the hiring plan. Refresh the page.</p>
      ) : q.isLoading || !plan ? (
        <p className="flex items-center gap-2 px-5 py-10 text-sm text-ink/55 md:px-8"><Loader2 className="h-4 w-4 animate-spin" />{seeded ? "Loading the hiring plan…" : "Setting up the hiring plan…"}</p>
      ) : (
        <div className="space-y-6 px-5 pt-6 md:px-8">
          <Intro />
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.35fr)]">
            <TriggerPanel d={d} />
            <MonthTable d={d} plan={plan} save={save} />
          </div>
          <Decisions plan={plan} save={save} />
          <div className="grid gap-4 xl:grid-cols-2">
            <CapacityCard d={d} />
            <HowCounted d={d} />
          </div>
          <ContentArea plan={plan} save={save} toast={toast} />
          <div className="grid gap-4 xl:grid-cols-2">
            <Checklist plan={plan} save={save} />
            <TriggerSettings d={d} plan={plan} save={save} />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Shell ─────────────────────────────────────────────────────────────── */
function Card({ icon: Icon, kicker, title, right, children, className = "", tone }) {
  return (
    <section className={`relative overflow-hidden rounded-md border bg-card ${tone === "flag" ? "border-[#ff6a00]/60" : "border-hair"} ${className}`}>
      <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: "linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)" }} />
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-hair px-4 pb-3 pt-3.5">
        <div className="flex min-w-0 items-center gap-2.5">
          {Icon && <Icon className="h-4 w-4 shrink-0 text-[#ff3c00]" strokeWidth={1.75} />}
          <div className="min-w-0">
            {kicker && <p className="mono-label text-[9px] text-ink/50">{kicker}</p>}
            <h2 className="text-[15px] font-semibold tracking-[-0.02em]"><Accent text={title} /></h2>
          </div>
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

// "Title /accent": the part after " /" renders in flame orange.
function Accent({ text }) {
  const s = String(text || "");
  const i = s.lastIndexOf(" /");
  if (i < 0) return s;
  return <>{s.slice(0, i)} <span className="text-[#ff3c00]">/{s.slice(i + 2)}</span></>;
}

function Btn({ children, onClick, primary, disabled, title }) {
  return (
    <button type="button" title={title} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors disabled:opacity-40 ${primary ? "border-ink bg-ink text-white hover:border-[#ff3c00] hover:bg-[#ff3c00]" : "border-hair bg-card text-ink/70 hover:border-[#ff3c00] hover:text-[#ff3c00]"}`}>
      {children}
    </button>
  );
}

function Intro() {
  return (
    <p className="max-w-3xl text-[13.5px] leading-relaxed text-ink/65">
      The plan: launch ads and raise spend until there are 6 Mission ALPHA deals a month that also take HyperCare+ or GravïtyCare.
      Justin runs 3 a month. One hire runs the other 3. When monthly signings get close to 6, start hiring. Later the hire becomes a
      manager, training a team on templates that raise what each person can ship.
    </p>
  );
}

/* ─── Trigger ───────────────────────────────────────────────────────────── */
function TriggerPanel({ d }) {
  const s = d.settings;
  const cur = d.current;
  const pct = Math.max(0, Math.min(100, (cur.count / s.target_per_month) * 100));
  return (
    <Card icon={Target} kicker={`${monthLabel(cur.key)} · month in progress`} title="Hiring /trigger"
      right={<span className={`mono-label rounded-full border px-2.5 py-1 text-[9.5px] ${STATE_STYLE[d.trigger.state]}`}>{d.trigger.label}</span>}>
      <div className="px-4 py-4">
        <p className="mono-label text-[9px] text-ink/45">Mission ALPHA + care plan signings</p>
        <p className="mt-1 text-[44px] font-semibold leading-none tracking-[-0.05em] tabular-nums">
          {cur.count}<span className="text-[18px] text-ink/35"> of {s.target_per_month}</span>
        </p>
        <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink/[0.07]">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)" }} />
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[10px] tabular-nums text-ink/45">
          <span>Justin&apos;s capacity: {s.justin_per_month}</span>
          <span>{Math.max(0, s.target_per_month - cur.count)} to go</span>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-ink/70">{d.trigger.reason}</p>
        {cur.manual != null && <p className="mt-2 text-[11.5px] text-ink/50">This month uses your manual count ({cur.manual}). Derived from records: {cur.derived}.</p>}
        {cur.deals.length > 0 && (
          <ul className="mt-3 divide-y divide-hair border-t border-hair">
            {cur.deals.map((s2) => (
              <li key={s2.client_id || s2.client_name} className="flex items-center justify-between gap-2 py-2 text-[12.5px]">
                <Link to={s2.client_id ? `/clients/${s2.client_id}` : "/crm"} className="truncate font-medium hover:text-[#ff3c00]">{s2.client_name}</Link>
                <span className="shrink-0 font-mono text-[10px] text-ink/45">{s2.care}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function MonthTable({ d, plan, save }) {
  const [draft, setDraft] = useState({});
  const commit = async (k) => {
    if (!(k in draft)) return;
    const v = String(draft[k]).trim();
    const next = { ...(plan.manual_counts || {}) };
    if (v === "") delete next[k];
    else next[k] = Math.max(0, Math.round(Number(v) || 0));
    const ok = await save({ manual_counts: next }, v === "" ? `${monthLabel(k)}: back to the derived count` : `${monthLabel(k)} count saved`);
    if (ok) setDraft((x) => { const y = { ...x }; delete y[k]; return y; });
  };
  return (
    <Card icon={Calculator} kicker="Last 6 months · ads from Ads Studio" title="Signings & ad /spend">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-[12.5px]">
          <thead>
            <tr className="border-b border-hair text-left">
              {["Month", "From records", "Manual count", "Counted", "Sales ad spend", "Cost / deal", "Hiring ads"].map((h) => (
                <th key={h} className="mono-label px-3 py-2 text-[8.5px] font-normal text-ink/45">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-hair">
            {[...d.rows].reverse().map((r) => (
              <tr key={r.key}>
                <td className="whitespace-nowrap px-3 py-2 font-medium">{monthLabel(r.key)}</td>
                <td className="px-3 py-2 font-mono tabular-nums text-ink/60">{r.derived}</td>
                <td className="px-3 py-1.5">
                  <input
                    type="number" min={0} inputMode="numeric" aria-label={`Manual count for ${monthLabel(r.key)}`}
                    value={r.key in draft ? draft[r.key] : r.manual ?? ""}
                    placeholder={String(r.derived)}
                    onChange={(e) => setDraft((x) => ({ ...x, [r.key]: e.target.value }))}
                    onBlur={() => commit(r.key)}
                    onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
                    className="w-16 rounded border border-hair bg-background px-2 py-1 font-mono text-[12px] tabular-nums focus:border-[#ff3c00] focus:outline-none"
                  />
                </td>
                <td className="px-3 py-2 font-mono font-semibold tabular-nums">{r.count}</td>
                <td className="px-3 py-2 font-mono tabular-nums text-ink/60">{r.spend == null ? "—" : money(r.spend)}</td>
                <td className="px-3 py-2 font-mono tabular-nums">{r.costPerDeal == null ? "—" : money(r.costPerDeal)}</td>
                <td className="px-3 py-2 font-mono tabular-nums text-ink/60">{r.hiringSpend ? money(r.hiringSpend) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-1.5 border-t border-hair px-4 py-3 text-[11.5px] leading-relaxed text-ink/55">
        <p>Leave Manual count empty to use the number from records (shown greyed as the suggestion). Type a number to override that month.</p>
        {d.hasAdData ? (
          <p>Cost / deal = Interstellar&apos;s own sales ad spend that month ÷ that month&apos;s signings. It&apos;s spend per deal, not attribution. Hiring ads (Special Ad Category: Employment) are kept out of it.</p>
        ) : (
          <p>No ad spend synced for Interstellar&apos;s own ads yet. Once Ads Studio syncs a connected account, spend and cost per Mission ALPHA deal fill in here. <Link to="/ads" className="text-[#ff3c00] hover:underline">Ads Studio</Link></p>
        )}
      </div>
    </Card>
  );
}

/* ─── Decisions ─────────────────────────────────────────────────────────── */
function Decisions({ plan, save }) {
  const list = plan.decisions || [];
  const open = list.filter((x) => !x.decided).length;
  const [editing, setEditing] = useState(null);
  const [answer, setAnswer] = useState("");
  const update = (key, patch, msg) => save({ decisions: list.map((x) => (x.key === key ? { ...x, ...patch } : x)) }, msg);
  return (
    <Card icon={AlertTriangle} tone="flag" kicker={open ? `${open} open` : "All decided"} title="Needs Justin's /decision">
      <ul className="divide-y divide-hair">
        {list.map((x) => (
          <li key={x.key} className={`px-4 py-3.5 ${x.decided ? "opacity-60" : ""}`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 max-w-3xl">
                <p className="text-[13.5px] font-semibold tracking-[-0.01em]">{x.question}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-ink/65">{x.detail}</p>
                {x.source_url && (
                  <a href={x.source_url} target="_blank" rel="noreferrer" className="mono-label mt-1.5 inline-flex items-center gap-1 text-[9px] text-[#ff3c00] hover:underline">
                    Source: {x.source_label || x.source_url}<ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Btn onClick={() => { setEditing(x.key); setAnswer(x.answer || ""); }}><Pencil className="h-3 w-3" />{x.answer ? "Edit" : "Answer"}</Btn>
                <Btn onClick={() => update(x.key, { decided: !x.decided }, x.decided ? "Reopened" : "Marked decided")}>
                  <Check className="h-3 w-3" />{x.decided ? "Reopen" : "Decided"}
                </Btn>
              </div>
            </div>
            {editing === x.key ? (
              <div className="mt-2.5 space-y-2">
                {(x.options || []).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {x.options.map((o) => (
                      <button key={o} type="button" onClick={() => setAnswer(o)}
                        className={`rounded-full border px-2.5 py-1 text-[11px] ${answer === o ? "border-[#ff3c00] bg-[#ff3c00]/10 text-[#d83300]" : "border-hair text-ink/65 hover:border-ink/40"}`}>{o}</button>
                    ))}
                  </div>
                )}
                <textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={2} placeholder="Your decision"
                  className="w-full rounded-md border border-hair bg-background px-3 py-2 text-[12.5px] focus:border-[#ff3c00] focus:outline-none" />
                <div className="flex gap-1.5">
                  <Btn primary onClick={async () => { if (await update(x.key, { answer: answer.trim() }, "Decision saved")) setEditing(null); }}><Save className="h-3 w-3" />Save</Btn>
                  <Btn onClick={() => setEditing(null)}><X className="h-3 w-3" />Cancel</Btn>
                </div>
              </div>
            ) : x.answer ? (
              <p className="mt-2 rounded border-l-2 border-[#ff3c00] bg-ink/[0.03] px-3 py-1.5 text-[12.5px]"><span className="mono-label mr-2 text-[8.5px] text-ink/45">Answer</span>{x.answer}</p>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/* ─── Capacity math ─────────────────────────────────────────────────────── */
function CapacityCard({ d }) {
  const s = d.settings;
  const o = d.offers;
  const per = s.per_hire_per_month;
  const hires = Math.max(0, Math.ceil(Math.max(0, s.target_per_month - s.justin_per_month) / Math.max(1, per)));
  const full = per * o.alphaPrice;
  const firstMonth = per * o.down;
  const steady = per * o.down + per * o.installments * o.installment;
  const careLow = per * o.careLow;
  const careHigh = per * o.careHigh;
  const rows = [
    { label: `Hires needed for ${s.target_per_month}/month`, formula: `(${s.target_per_month} − ${s.justin_per_month} Justin) ÷ ${per} per hire`, value: String(hires) },
    { label: `${per} Mission ALPHA paid in full`, formula: `${per} × ${money(o.alphaPrice)}`, value: money(full) },
    { label: "Minus one hire", formula: `${money(full)} − ${money(s.hire_monthly_cost)}`, value: signed(full - s.hire_monthly_cost), hot: full - s.hire_monthly_cost < 0 },
    { label: `${per} financed, first month cash`, formula: `${per} × ${money(o.down)} down`, value: money(firstMonth) },
    { label: "Minus one hire (first financed month)", formula: `${money(firstMonth)} − ${money(s.hire_monthly_cost)}`, value: signed(firstMonth - s.hire_monthly_cost), hot: firstMonth - s.hire_monthly_cost < 0 },
    { label: `Financed, steady state (after ${o.installments} months at ${per}/mo)`, formula: `${per} × ${money(o.down)} + ${per} × ${o.installments} × ${money(o.installment)}`, value: money(steady) },
    { label: `Care MRR added by each month's ${per} deals`, formula: `${per} × ${money(o.careLow)} GravïtyCare to ${per} × ${money(o.careHigh)} HyperCare+ Local`, value: `${money(careLow)}–${money(careHigh)}/mo` },
  ];
  return (
    <Card icon={Calculator} kicker="A model, not a forecast" title="Capacity /math">
      <div className="px-4 py-3 text-[12px] leading-relaxed text-ink/60">
        {per} Mission ALPHA builds per person per month. Hire cost {money(s.hire_monthly_cost)}/month (pay only). Prices from{" "}
        <Link to="/settings" className="text-[#ff3c00] hover:underline">Agency knowledge</Link>
        {o.fromKnowledge ? "" : " (not loaded, using the app's fallback prices)"}: {money(o.alphaPrice)} in full, or {money(o.down)} down + {o.installments} × {money(o.installment)}.
      </div>
      <ul className="divide-y divide-hair border-t border-hair">
        {rows.map((r) => (
          <li key={r.label} className="flex items-start justify-between gap-3 px-4 py-2.5">
            <div className="min-w-0">
              <p className="text-[12.5px] font-medium">{r.label}</p>
              <p className="font-mono text-[10.5px] text-ink/45">{r.formula}</p>
            </div>
            <span className={`shrink-0 font-mono text-[13px] font-semibold tabular-nums ${r.hot ? "text-[#d83300]" : ""}`}>{r.value}</span>
          </li>
        ))}
      </ul>
      <p className="border-t border-hair px-4 py-3 text-[11.5px] leading-relaxed text-ink/50">
        Not included: payroll taxes, workers&apos; comp, benefits, equipment, software and ad spend. Get those from your payroll provider before the offer.
        Financed deals mean the hire is cash-negative in the first month and covered once installments stack up.
      </p>
    </Card>
  );
}

function HowCounted({ d }) {
  const { withoutCare, undated } = d.derived;
  return (
    <Card icon={Info} kicker="Where the number comes from" title="How signings are /counted">
      <div className="space-y-2 px-4 py-3 text-[12.5px] leading-relaxed text-ink/65">
        <p>One signing = one client who bought Mission ALPHA <em>and</em> is on HyperCare+ or GravïtyCare. Read from:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>Flight Plan onboarding flights sold as Mission ALPHA (dated by start date), and Mission ALPHA projects created by Start service.</li>
          <li>The care plan: the flight&apos;s care plan, a HyperCare+/GravïtyCare project, or an active HyperCare+/GravïtyCare billing line synced from Stripe.</li>
        </ul>
        <p>Stripe itself only tells us subscriptions, not one-time Mission ALPHA payments, so a deal sold outside Flight Plan or Start service won&apos;t show up. Use the manual count for those months.</p>
      </div>
      {(withoutCare.length > 0 || undated.length > 0) && (
        <ul className="divide-y divide-hair border-t border-hair">
          {withoutCare.map((s) => (
            <li key={`nc-${s.client_id || s.client_name}`} className="flex items-center justify-between gap-2 px-4 py-2 text-[12px]">
              <span className="truncate font-medium">{s.client_name}</span>
              <span className="mono-label shrink-0 text-[8.5px] text-[#d83300]">ALPHA, no care plan · not counted</span>
            </li>
          ))}
          {undated.map((c) => (
            <li key={`ud-${c.id}`} className="flex items-center justify-between gap-2 px-4 py-2 text-[12px]">
              <Link to={`/clients/${c.id}`} className="truncate font-medium hover:text-[#ff3c00]">{c.business}</Link>
              <span className="mono-label shrink-0 text-[8.5px] text-ink/45">ALPHA on file, no sale date · not counted</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/* ─── Content blocks ────────────────────────────────────────────────────── */
function ContentArea({ plan, save, toast }) {
  const [group, setGroup] = useState(GROUPS[0].key);
  const blocks = useMemo(() => [...(plan.blocks || [])].filter((b) => b.group === group).sort((a, b) => (a.sort || 0) - (b.sort || 0)), [plan.blocks, group]);
  const update = (key, patch, msg) => save({ blocks: (plan.blocks || []).map((b) => (b.key === key ? { ...b, ...patch } : b)) }, msg);
  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="mono-label text-[9.5px] text-ink/50">Drafts · edit in place · copy per block</p>
          <h2 className="text-[22px] font-semibold tracking-[-0.03em]">The role &amp; the <span className="text-[#ff3c00]">/ads</span></h2>
        </div>
        <div className="flex rounded-md border border-hair bg-card p-0.5">
          {GROUPS.map((g) => (
            <button key={g.key} type="button" onClick={() => setGroup(g.key)}
              className={`rounded px-3 py-1.5 text-[12px] font-medium ${group === g.key ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}>{g.label}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {blocks.map((b) => <Block key={b.key} b={b} update={update} toast={toast} />)}
      </div>
    </section>
  );
}

function Block({ b, update, toast }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(b.body || "");
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(b.key === "job_description" || b.key === "ad_linkedin");
  const seed = SEED_BLOCKS.find((x) => x.key === b.key);
  const copy = async () => {
    if (await copyText(b.body)) { setCopied(true); setTimeout(() => setCopied(false), 1600); }
    else toast({ title: "Copy failed", description: "Select the text and copy it by hand.", variant: "destructive" });
  };
  return (
    <Card kicker={b.edited_at ? `Edited ${new Date(b.edited_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : "Draft"} title={b.title}
      className={b.key === "job_description" ? "xl:col-span-2" : ""}
      right={
        <div className="flex flex-wrap items-center gap-1.5">
          <Btn onClick={copy}>{copied ? <Check className="h-3 w-3 text-[#ff3c00]" /> : <Copy className="h-3 w-3" />}{copied ? "Copied" : "Copy"}</Btn>
          {!editing && <Btn onClick={() => { setText(b.body || ""); setEditing(true); setOpen(true); }}><Pencil className="h-3 w-3" />Edit</Btn>}
          <Btn onClick={() => setOpen((v) => !v)} title={open ? "Collapse" : "Expand"}><ChevronDown className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`} /></Btn>
        </div>
      }>
      {editing ? (
        <div className="space-y-2 px-4 py-3">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={Math.min(30, Math.max(8, text.split("\n").length + 1))}
            className="w-full rounded-md border border-hair bg-background px-3 py-2 font-mono text-[12px] leading-relaxed focus:border-[#ff3c00] focus:outline-none" />
          <div className="flex flex-wrap gap-1.5">
            <Btn primary onClick={async () => { if (await update(b.key, { body: text, edited_at: new Date().toISOString() }, `${b.title} saved`)) setEditing(false); }}><Save className="h-3 w-3" />Save</Btn>
            <Btn onClick={() => setEditing(false)}><X className="h-3 w-3" />Cancel</Btn>
            {seed && <Btn onClick={() => setText(seed.body)} title="Load the original draft into the editor (save to keep it)"><RotateCcw className="h-3 w-3" />Original draft</Btn>}
          </div>
        </div>
      ) : open ? (
        <Prose text={b.body} />
      ) : (
        <p className="line-clamp-2 px-4 py-3 text-[12.5px] text-ink/55">{String(b.body || "").replace(/^#+\s*/gm, "").split("\n").filter(Boolean).slice(0, 2).join(" · ")}</p>
      )}
    </Card>
  );
}

// Tiny renderer: "# " / "## " headings, "- " bullets, "1. " numbered lines, [PLACEHOLDERS] highlighted.
function Prose({ text }) {
  const mark = (line) => String(line).split(/(\[[^\]]+\])/g).map((part, i) =>
    /^\[[^\]]+\]$/.test(part) ? <mark key={i} className="rounded bg-[#ffaa00]/25 px-0.5 text-ink">{part}</mark> : <span key={i}>{part}</span>);
  return (
    <div className="space-y-1.5 px-4 py-3 text-[13px] leading-relaxed text-ink/80">
      {String(text || "").split("\n").map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1.5" />;
        if (line.startsWith("# ")) return <p key={i} className="text-[16px] font-semibold tracking-[-0.02em] text-ink">{mark(line.slice(2))}</p>;
        if (line.startsWith("## ")) return <p key={i} className="mono-label pt-2 text-[9.5px] text-[#ff3c00]">{mark(line.slice(3))}</p>;
        if (/^\s*-\s/.test(line)) return <p key={i} className={`flex gap-2 ${/^\s{2,}-/.test(line) ? "pl-5" : ""}`}><span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-[#ff3c00]" /><span>{mark(line.replace(/^\s*-\s/, ""))}</span></p>;
        return <p key={i}>{mark(line)}</p>;
      })}
    </div>
  );
}

/* ─── Checklist + settings ──────────────────────────────────────────────── */
function Checklist({ plan, save }) {
  const list = plan.checklist || [];
  const done = list.filter((c) => c.done).length;
  const toggle = (key) => save({ checklist: list.map((c) => (c.key === key ? { ...c, done: !c.done, done_at: !c.done ? new Date().toISOString() : null } : c)) });
  return (
    <Card icon={ClipboardCheck} kicker={`${done} of ${list.length} done`} title="Launch /checklist">
      <ul className="divide-y divide-hair">
        {list.map((c) => (
          <li key={c.key}>
            <button type="button" onClick={() => toggle(c.key)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-ink/[0.03]">
              <span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${c.done ? "border-[#ff3c00] bg-[#ff3c00] text-white" : "border-ink/30"}`}>
                {c.done && <Check className="h-3 w-3" />}
              </span>
              <span className={`text-[12.5px] ${c.done ? "text-ink/45 line-through" : ""}`}>{c.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

const SETTING_FIELDS = [
  ["target_per_month", "Target signings / month"],
  ["justin_per_month", "Justin's capacity / month"],
  ["per_hire_per_month", "Each hire's capacity / month"],
  ["hire_monthly_cost", "Hire cost / month ($)"],
  ["streak_months", "Consecutive months…"],
  ["streak_min", "…each at least"],
  ["any_month_min", "Or any single month at"],
  ["ready_min", "\"Get ready\" from"],
];

function TriggerSettings({ d, plan, save }) {
  const [form, setForm] = useState(d.settings);
  useEffect(() => { setForm(d.settings); }, [d.settings]);
  const dirty = SETTING_FIELDS.some(([k]) => Number(form[k]) !== Number(d.settings[k]));
  const submit = () => {
    const next = Object.fromEntries(SETTING_FIELDS.map(([k]) => [k, Math.max(0, Number(form[k]) || 0)]));
    save({ settings: { ...(plan.settings || {}), ...next } }, "Trigger settings saved");
  };
  return (
    <Card icon={Settings2} kicker="Default: 2 months at 4+, or any month at 5+" title="Trigger /settings">
      <div className="grid grid-cols-2 gap-3 px-4 py-3">
        {SETTING_FIELDS.map(([k, label]) => (
          <label key={k} className="block">
            <span className="mono-label text-[8.5px] text-ink/50">{label}</span>
            <input type="number" min={0} value={form[k] ?? ""} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))}
              className="mt-1 w-full rounded-md border border-hair bg-background px-2.5 py-1.5 font-mono text-[12.5px] tabular-nums focus:border-[#ff3c00] focus:outline-none" />
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-hair px-4 py-3">
        <p className="text-[11.5px] text-ink/50">Start hiring = {form.streak_months} months in a row at {form.streak_min}+, or any month at {form.any_month_min}+.</p>
        <Btn primary disabled={!dirty} onClick={submit}><Save className="h-3 w-3" />Save</Btn>
      </div>
    </Card>
  );
}

/* ─── Dashboard card (Mission Control, under the Command Briefing) ──────── */
export function HiringTriggerCard() {
  const q = useQuery({ queryKey: ["hiring", "trigger"], queryFn: () => loadHiring({ months: 3 }), staleTime: 5 * 60 * 1000 });
  if (q.isLoading || q.isError || !q.data) return null;
  const d = q.data;
  const s = d.settings;
  const pct = Math.max(0, Math.min(100, (d.current.count / s.target_per_month) * 100));
  return (
    <Link to="/growth/hiring" className="card-hover group mt-3 flex items-center gap-4 rounded-md border border-hair bg-card px-3.5 py-2.5">
      <UserPlus className="h-4 w-4 shrink-0 text-[#ff3c00]" strokeWidth={1.75} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <p className="text-[12.5px] font-semibold">Hiring trigger: {d.current.count} of {s.target_per_month} this month</p>
          <span className={`mono-label rounded-full border px-2 py-0.5 text-[8.5px] ${STATE_STYLE[d.trigger.state]}`}>{d.trigger.label}</span>
        </div>
        <div className="mt-1.5 h-1 w-full max-w-md overflow-hidden rounded-full bg-ink/[0.07]">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: "linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)" }} />
        </div>
      </div>
      <span className="mono-label hidden shrink-0 items-center gap-0.5 text-[9px] text-ink/50 group-hover:text-[#ff3c00] sm:inline-flex">Hiring plan<ArrowUpRight className="h-3 w-3" /></span>
    </Link>
  );
}
