import { Fragment, useMemo, useState } from "react";
import { useDeepLinkParam, useDeepLinkFocus } from "@/lib/deepLink";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CalendarClock, ChevronDown, Edit, HandCoins, Landmark, Loader2, Plus, Receipt, Rocket, Sparkles, Trash2, Wallet } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyState, FinanceStyles, KpiTile } from "@/components/financial/finance/ui";
import { FREE_UNDER, FREQUENCIES, HEALTH, PACKAGE_CARE, PACKAGE_PLANS, PACKAGE_REFERRAL_OFF, PACKAGE_START, analyze, fmtDate, freqLabel, parseDate, startOfDay, suggestPayment, toISODate } from "@/features/financing/schedule";

const money = (v, d = 0) => `$${(Number(v) || 0).toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })}`;
const money2 = (v) => money(v, 2);

export const FINANCING_KEY = ["clientFinancing"];
export const loadFinancing = () => base44.entities.ClientFinancing.list("-created_date", 500).then((r) => (Array.isArray(r) ? r : []));

const FILTERS = [
  { id: "attention", label: "Needs attention" },
  { id: "active", label: "Active" },
  { id: "short", label: "Short-term" },
  { id: "long", label: "Long-term" },
  { id: "done", label: "Paid off / closed" },
  { id: "all", label: "All" },
];

export default function Financing() {
  const qc = useQueryClient();
  const plansQ = useQuery({ queryKey: FINANCING_KEY, queryFn: loadFinancing, staleTime: 60_000 });
  const clientsQ = useQuery({
    queryKey: ["financingClients"],
    queryFn: () => base44.entities.CRMClient.list("business", 500).then((r) => (Array.isArray(r) ? r : [])),
    staleTime: 300_000,
  });
  // ?plan=<id> (from Command): show every plan, open that one and focus it.
  const linkedPlan = useDeepLinkParam("plan");
  const [filter, setFilter] = useState(linkedPlan ? "all" : "attention");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [pkgOpen, setPkgOpen] = useState(false);
  const [upgrading, setUpgrading] = useState(null);
  const [paying, setPaying] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [open, setOpen] = useState(() => new Set(linkedPlan ? [linkedPlan] : []));

  const now = useMemo(() => new Date(), []);
  const plans = plansQ.data || [];
  useDeepLinkFocus(linkedPlan, [plans.length]);
  const rows = useMemo(() => plans.map((p) => ({ plan: p, a: analyze(p, now) })), [plans, now]);

  const live = rows.filter((r) => !["paid_off", "cancelled"].includes(r.a.health));
  const outstanding = live.reduce((s, r) => s + r.a.balance, 0);
  const collected = rows.reduce((s, r) => s + r.a.paid, 0);
  const late = rows.filter((r) => r.a.health === "late");
  const behindTotal = late.reduce((s, r) => s + r.a.behind, 0);
  const horizon = new Date(startOfDay(now).getTime() + 30 * 86400000);
  const due30 = live.flatMap((r) => r.a.installments.filter((i) => i.state !== "paid" && i.date <= horizon).map((i) => ({ ...i, row: r })));
  const due30Total = due30.reduce((s, i) => s + i.amount - (i.partial || 0), 0);

  const order = { late: 0, due_soon: 1, on_track: 2, paused: 3, defaulted: 4, paid_off: 5, cancelled: 6 };
  const shown = rows
    .filter(({ plan, a }) => {
      if (filter === "attention") return ["late", "due_soon", "defaulted"].includes(a.health);
      if (filter === "active") return !["paid_off", "cancelled"].includes(a.health);
      if (filter === "short") return (plan.term_type || "short") === "short";
      if (filter === "long") return plan.term_type === "long";
      if (filter === "done") return ["paid_off", "cancelled"].includes(a.health);
      return true;
    })
    .sort((x, y) => order[x.a.health] - order[y.a.health] || (x.a.next?.date || 0) - (y.a.next?.date || 0));

  const refresh = () => qc.invalidateQueries({ queryKey: FINANCING_KEY });
  const save = async (fields) => {
    if (editing) await base44.entities.ClientFinancing.update(editing.id, fields);
    else await base44.entities.ClientFinancing.create({ ...fields, payments: [] });
    await refresh();
  };
  const recordPayment = async (plan, payment) => {
    const payments = [...(plan.payments || []), payment];
    const after = analyze({ ...plan, payments }, now);
    const changes = { payments };
    if (after.balance <= 0.004 && plan.status === "active") changes.status = "paid_off";
    await base44.entities.ClientFinancing.update(plan.id, changes);
    await refresh();
  };
  const removePayment = async (plan, idx) => {
    const payments = (plan.payments || []).filter((_, i) => i !== idx);
    const changes = { payments };
    if (plan.status === "paid_off") changes.status = "active";
    await base44.entities.ClientFinancing.update(plan.id, changes);
    await refresh();
  };
  const savePackage = async (fields) => {
    if (editing) await base44.entities.ClientFinancing.update(editing.id, fields);
    else await base44.entities.ClientFinancing.create({ ...fields, payments: [], upgrades: [] });
    await refresh();
  };
  const addUpgrade = async (plan, up) => {
    if (up.mode === "balance") {
      const upgrades = [...(plan.upgrades || []), { date: up.date, label: up.label, amount: up.amount, from_installment: up.from_installment }];
      await base44.entities.ClientFinancing.update(plan.id, { upgrades, status: plan.status === "paid_off" ? "active" : plan.status });
      const after = analyze({ ...plan, upgrades }, now);
      await base44.entities.Task.create({
        title: `${plan.client_name}: update Stripe to ${money2(after.amt)}/mo`,
        notes: `Upgrade "${up.label}" (${money2(up.amount)}) was added to the 40-Day Business Rebuild balance. New balance ${money2(after.balance)} over ${after.monthsLeft} month${after.monthsLeft === 1 ? "" : "s"}: change the Stripe subscription amount to ${money2(after.amt)}/mo from the next billing date.`,
        client_id: plan.client_id || "", client_name: plan.client_name || "", category: "finance", priority: 1, status: "next", source: "automation",
      }).catch(() => null);
    } else {
      const line = `${up.date}: upgrade "${up.label}" ${up.amount < FREE_UNDER ? "done free (under $250)" : `${money2(up.amount)} paid up front`}`;
      await base44.entities.ClientFinancing.update(plan.id, { notes: [plan.notes, line].filter(Boolean).join("\n") });
    }
    await refresh();
  };
  const del = async () => {
    if (!toDelete) return;
    await base44.entities.ClientFinancing.delete(toDelete.id);
    setToDelete(null);
    await refresh();
  };

  const toggle = (id) => setOpen((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="min-h-screen bg-background">
      <FinanceStyles />
      <PageHeader breadcrumb="Sales / Financing" title="Client /Financing" rightText="Payment plans" />
      <div className="mx-auto max-w-7xl space-y-5 px-4 py-6 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-[12px] text-ink/55">
            Every client on a payment plan, short or long term. Record payments as they land; anything past its due date plus the grace days shows as late.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => { setEditing(null); setPkgOpen(true); }} className="h-9 gap-2 border-0 font-semibold text-white flame-bg hover:opacity-90">
              <Rocket className="h-4 w-4" />New 40-Day Rebuild
            </Button>
            <Button variant="outline" onClick={() => { setEditing(null); setFormOpen(true); }} className="h-9 gap-2">
              <Plus className="h-4 w-4" />Other payment plan
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <KpiTile index={0} hero icon={Wallet} label="Outstanding" value={outstanding} format={money}
            sub={`${live.length} open plan${live.length === 1 ? "" : "s"}`} />
          <KpiTile index={1} icon={AlertTriangle} label="Behind" value={behindTotal} format={money}
            sub={late.length ? `${late.length} plan${late.length === 1 ? "" : "s"} late` : "Everyone is up to date"} />
          <KpiTile index={2} icon={CalendarClock} label="Due next 30 days" value={due30Total} format={money}
            sub={due30.length ? `${due30.length} installment${due30.length === 1 ? "" : "s"} through ${fmtDate(horizon)}` : "Nothing due"} />
          <KpiTile index={3} icon={HandCoins} label="Collected to date" value={collected} format={money}
            sub={`across ${rows.length} plan${rows.length === 1 ? "" : "s"}`} />
        </div>

        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter plans">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" role="tab" aria-selected={filter === f.id} onClick={() => setFilter(f.id)}
              className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition ${filter === f.id ? "border-ink bg-ink text-white" : "border-hair bg-card text-ink/70 hover:text-ink"}`}>
              {f.label}
            </button>
          ))}
        </div>

        {plansQ.isLoading ? (
          <div className="flex items-center gap-2 py-16 text-ink/45"><Loader2 className="h-4 w-4 animate-spin" />Loading payment plans</div>
        ) : rows.length === 0 ? (
          <EmptyState icon={Landmark} title="No payment plans yet"
            body="Add a plan when a client pays for a build or package over time. You'll see who's late, what's due and what's still owed."
            action={<Button onClick={() => { setEditing(null); setFormOpen(true); }} className="gap-2"><Plus className="h-4 w-4" />New payment plan</Button>} />
        ) : shown.length === 0 ? (
          <EmptyState compact icon={Receipt} title={filter === "attention" ? "Nothing needs attention" : "No plans in this view"} body="Switch the filter to see the rest." />
        ) : (
          <div className="space-y-3">
            {shown.map(({ plan, a }) => (
              <PlanCard key={plan.id} plan={plan} a={a} expanded={open.has(plan.id)} onToggle={() => toggle(plan.id)}
                onPay={() => setPaying(plan)} onUpgrade={() => setUpgrading(plan)}
                onEdit={() => { setEditing(plan); if (plan.kind === "package") setPkgOpen(true); else setFormOpen(true); }} onDelete={() => setToDelete(plan)}
                onRemovePayment={(idx) => removePayment(plan, idx)} />
            ))}
          </div>
        )}
      </div>

      <PlanForm open={formOpen} onOpenChange={setFormOpen} initial={editing} clients={clientsQ.data || []} onSubmit={save} />
      <PackageForm open={pkgOpen} onOpenChange={setPkgOpen} initial={editing} clients={clientsQ.data || []} onSubmit={savePackage} />
      <UpgradeDialog plan={upgrading} onClose={() => setUpgrading(null)} onSubmit={addUpgrade} />
      <PaymentDialog plan={paying} onClose={() => setPaying(null)} onSubmit={recordPayment} />

      <AlertDialog open={!!toDelete} onOpenChange={(o) => { if (!o) setToDelete(null); }}>
        <AlertDialogContent className="border-hair bg-card text-ink">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this payment plan?</AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete ? `${toDelete.client_name} · ${toDelete.title}` : ""} and its payment history will be removed. If the plan just ended, mark it Paid off or Cancelled instead to keep the record.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep it</AlertDialogCancel>
            <AlertDialogAction onClick={del} className="bg-[#ff3c00] text-white hover:bg-[#e03500]">Delete plan</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function HealthPill({ health }) {
  const h = HEALTH[health] || HEALTH.on_track;
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${h.tone}`}>{h.label}</span>;
}

function PlanCard({ plan, a, expanded, onToggle, onPay, onUpgrade, onEdit, onDelete, onRemovePayment }) {
  const pkg = a.isPackage ? PACKAGE_PLANS[plan.package_plan] : null;
  const launched = plan.launch_date && parseDate(plan.launch_date) <= startOfDay(new Date());
  const closed = ["paid_off", "cancelled"].includes(a.health);
  const nextLine = closed
    ? a.health === "paid_off" ? `Paid off · ${money2(a.paid)} collected` : "Cancelled"
    : a.health === "late"
      ? `${money2(a.behind)} behind · ${a.daysLate} day${a.daysLate === 1 ? "" : "s"} late since ${fmtDate(a.lateItems[0].date)}`
      : a.next
        ? `Next ${money2(a.next.amount - (a.next.partial || 0))} on ${fmtDate(a.next.date)}${a.daysToNext === 0 ? " (today)" : a.daysToNext > 0 ? ` (in ${a.daysToNext} day${a.daysToNext === 1 ? "" : "s"})` : ""}`
        : "No installments scheduled";

  return (
    <article data-record-id={plan.id} className={`fin-rise rounded-md border bg-card ${a.health === "late" ? "border-[#ff3c00]/50" : "border-hair"}`}>
      <div className="flex flex-wrap items-start gap-4 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[15px] font-semibold text-ink">{plan.client_name}</h3>
            <HealthPill health={a.health} />
            {pkg ? (
              <span className="rounded-full bg-[#ff6a00]/12 px-2 py-0.5 text-[10.5px] font-semibold text-[#c2410c]">40-Day Rebuild · {pkg.label}</span>
            ) : (
              <span className="mono-label text-[10px] text-ink/45">{plan.term_type === "long" ? "Long-term" : "Short-term"}</span>
            )}
            {plan.financed_by === "third_party" && <span className="mono-label text-[10px] text-ink/45">via {plan.lender || "lender"}</span>}
          </div>
          <p className="mt-0.5 text-[13px] text-ink/70">{plan.title}</p>
          <p className={`mt-2 text-[12.5px] font-medium ${a.health === "late" ? "text-[#ff3c00]" : "text-ink/80"}`}>{nextLine}</p>
          {pkg && (
            <p className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-ink/60">
              <span>{plan.start_paid_date ? `Start ${money(plan.start_payment)} paid ${fmtDate(parseDate(plan.start_paid_date))}` : <span className="font-semibold text-[#ff3c00]">Start {money(plan.start_payment)} not paid yet</span>}</span>
              <span>{launched ? `Launched ${fmtDate(parseDate(plan.launch_date))}` : `Monthly starts at launch (${plan.launch_date ? fmtDate(parseDate(plan.launch_date)) : "date not set"})`}</span>
              <span>{a.health === "paid_off" ? `Now HyperCare+ ${money(plan.after_payoff_monthly || PACKAGE_CARE)}/mo · client owns the code` : `Then HyperCare+ ${money(plan.after_payoff_monthly || PACKAGE_CARE)}/mo`}</span>
              {plan.stripe_subscription_id ? <span>Stripe linked · auto-tracked</span> : <span>Stripe links on the first matching invoice</span>}
            </p>
          )}
        </div>
        <div className="grid grid-cols-3 gap-4 text-right">
          <div><p className="mono-label text-[9.5px] text-ink/45">{pkg ? "Monthly now" : "Installment"}</p><p className="text-[14px] font-semibold tabular-nums">{money2(a.amt)}</p><p className="text-[10.5px] text-ink/45">{pkg ? `${a.monthsLeft} month${a.monthsLeft === 1 ? "" : "s"} left` : freqLabel(plan.frequency)}</p></div>
          <div><p className="mono-label text-[9.5px] text-ink/45">Paid</p><p className="text-[14px] font-semibold tabular-nums">{a.covered}/{a.n}</p><p className="text-[10.5px] text-ink/45">{money(a.paid)}</p></div>
          <div><p className="mono-label text-[9.5px] text-ink/45">Balance</p><p className="text-[14px] font-semibold tabular-nums">{money2(a.balance)}</p><p className="text-[10.5px] text-ink/45">ends {fmtDate(a.endDate)}</p></div>
        </div>
      </div>

      <div className="px-4">
        <div className="h-1.5 overflow-hidden rounded-full bg-ink/8" aria-label={`${Math.round(a.progress * 100)}% paid`}>
          <div className="h-full rounded-full flame-bg" style={{ width: `${a.progress * 100}%` }} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 p-4 pt-3">
        {!closed && (
          <Button size="sm" onClick={onPay} className="h-8 gap-1.5 border-0 text-white flame-bg hover:opacity-90"><HandCoins className="h-3.5 w-3.5" />Record payment</Button>
        )}
        {pkg && (
          <Button size="sm" variant="outline" onClick={onUpgrade} className="h-8 gap-1.5"><Sparkles className="h-3.5 w-3.5" />Add upgrade</Button>
        )}
        <Button size="sm" variant="outline" onClick={onToggle} className="h-8 gap-1.5">
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />Schedule & payments
        </Button>
        <div className="ml-auto flex gap-1">
          <Button size="sm" variant="ghost" onClick={onEdit} className="h-8 gap-1.5 text-ink/60"><Edit className="h-3.5 w-3.5" />Edit</Button>
          <Button size="sm" variant="ghost" onClick={onDelete} className="h-8 text-ink/40 hover:text-[#ff3c00]" aria-label="Delete plan"><Trash2 className="h-3.5 w-3.5" /></Button>
        </div>
      </div>

      {expanded && (
        <div className="grid gap-4 border-t border-hair p-4 md:grid-cols-2">
          <div>
            <p className="mono-label mb-2 text-[10px] text-ink/50">Schedule</p>
            <ol className="max-h-72 space-y-1 overflow-y-auto pr-1">
              {a.installments.map((i) => (
                <li key={i.index} className="flex items-center justify-between gap-2 rounded px-2 py-1 text-[12px] odd:bg-ink/[0.03]">
                  <span className="tabular-nums text-ink/55">#{i.index}</span>
                  <span className="flex-1 tabular-nums">{fmtDate(i.date)}</span>
                  <span className="tabular-nums">{money2(i.amount)}</span>
                  <span className={`w-20 text-right text-[10.5px] font-semibold uppercase ${i.state === "paid" ? "text-emerald-700" : i.state === "late" ? "text-[#ff3c00]" : i.state === "due" ? "text-[#8a4b00]" : "text-ink/40"}`}>
                    {i.state === "paid" ? "Paid" : i.partial ? `${money(i.partial)} in` : i.state === "late" ? "Late" : i.state === "due" ? "Due" : "Upcoming"}
                  </span>
                </li>
              ))}
            </ol>
          </div>
          <div>
            <p className="mono-label mb-2 text-[10px] text-ink/50">Payments received</p>
            {(plan.payments || []).length === 0 ? (
              <p className="text-[12px] text-ink/45">No payments recorded yet.</p>
            ) : (
              <ul className="space-y-1">
                {(plan.payments || []).map((p, idx) => (
                  <li key={idx} className="flex items-center gap-2 rounded px-2 py-1 text-[12px] odd:bg-ink/[0.03]">
                    <span className="tabular-nums">{p.date}</span>
                    <span className="font-semibold tabular-nums">{money2(p.amount)}</span>
                    <span className="flex-1 truncate text-ink/50">{[p.method, p.note].filter(Boolean).join(" · ")}</span>
                    <button type="button" onClick={() => onRemovePayment(idx)} className="text-ink/30 hover:text-[#ff3c00]" aria-label="Remove payment"><Trash2 className="h-3 w-3" /></button>
                  </li>
                ))}
              </ul>
            )}
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1 text-[11.5px] text-ink/60">
              {plan.total_price ? (<><dt>{pkg ? "Package balance at start" : "Price"}</dt><dd className="text-right tabular-nums">{money2(plan.total_price)}</dd></>) : null}
              {pkg && (plan.upgrades || []).map((u, i) => (<Fragment key={i}><dt>Upgrade · {u.label}</dt><dd className="text-right tabular-nums">+{money2(u.amount)}</dd></Fragment>))}
              {plan.down_payment ? (<><dt>Down payment</dt><dd className="text-right tabular-nums">{money2(plan.down_payment)}</dd></>) : null}
              {plan.interest_rate ? (<><dt>APR</dt><dd className="text-right tabular-nums">{plan.interest_rate}%</dd></>) : null}
              <dt>Scheduled total</dt><dd className="text-right tabular-nums">{money2(a.scheduledTotal)}</dd>
              <dt>Grace period</dt><dd className="text-right">{plan.grace_days ?? 3} days</dd>
              <dt>Last payment</dt><dd className="text-right">{fmtDate(a.lastPayment)}</dd>
            </dl>
            {plan.notes && <p className="mt-3 whitespace-pre-wrap rounded bg-ink/[0.03] p-2 text-[12px] text-ink/70">{plan.notes}</p>}
          </div>
        </div>
      )}
    </article>
  );
}

const EMPTY = {
  client_id: "", client_name: "", title: "", term_type: "short", financed_by: "in_house", lender: "",
  total_price: "", down_payment: "", interest_rate: "", payment_amount: "", frequency: "monthly",
  num_payments: "", first_due_date: "", grace_days: 3, status: "active", notes: "",
};

function PlanForm({ open, onOpenChange, initial, clients, onSubmit }) {
  const [f, setF] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [lastKey, setLastKey] = useState(null);
  const key = open ? (initial?.id || "new") : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (open) { setF(initial ? { ...EMPTY, ...initial } : EMPTY); setErr(""); }
  }
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e?.target ? e.target.value : e }));
  const suggestion = suggestPayment(f);

  const submit = async (e) => {
    e.preventDefault();
    if (!f.client_name.trim() || !f.title.trim()) return setErr("Pick a client and say what's being financed.");
    if (!(Number(f.payment_amount) > 0) || !(Number(f.num_payments) > 0) || !f.first_due_date) return setErr("Installment amount, number of payments and first due date are required.");
    const n = Math.floor(Number(f.num_payments));
    const months = f.frequency === "weekly" ? n / 4.33 : f.frequency === "biweekly" ? n / 2.17 : f.frequency === "quarterly" ? n * 3 : n;
    const fields = {
      client_id: f.client_id || "", client_name: f.client_name.trim(), title: f.title.trim(),
      term_type: f.term_type || (months > 12 ? "long" : "short"), financed_by: f.financed_by, lender: f.financed_by === "third_party" ? f.lender.trim() : "",
      total_price: Number(f.total_price) || 0, down_payment: Number(f.down_payment) || 0, interest_rate: Number(f.interest_rate) || 0,
      payment_amount: Number(f.payment_amount), frequency: f.frequency, num_payments: n, first_due_date: f.first_due_date,
      grace_days: Math.max(0, Math.floor(Number(f.grace_days) || 0)), status: f.status, notes: f.notes || "",
    };
    setSaving(true);
    try { await onSubmit(fields); onOpenChange(false); } catch (x) { setErr(x?.message || "Couldn't save. Try again."); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-hair bg-card text-ink sm:max-w-xl">
        <DialogHeader><DialogTitle>{initial ? "Edit payment plan" : "New payment plan"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label htmlFor="fin-client">Client</Label>
            <Select value={f.client_id || (f.client_name ? "__custom" : "")} onValueChange={(v) => {
              const c = clients.find((x) => x.id === v);
              setF((p) => ({ ...p, client_id: c ? c.id : "", client_name: c ? (c.business || p.client_name) : p.client_name }));
            }}>
              <SelectTrigger id="fin-client"><SelectValue placeholder="Choose a client" /></SelectTrigger>
              <SelectContent>
                {clients.filter((c) => c.business).map((c) => <SelectItem key={c.id} value={c.id}>{c.business}</SelectItem>)}
                <SelectItem value="__custom">Someone not in the client list…</SelectItem>
              </SelectContent>
            </Select>
            {(!f.client_id) && (
              <Input id="fin-client-name" className="mt-2" placeholder="Client name" value={f.client_name} onChange={set("client_name")} />
            )}
          </div>
          <div className="col-span-2">
            <Label htmlFor="fin-title">What's financed</Label>
            <Input id="fin-title" placeholder="e.g. Website build, Command Center app" value={f.title} onChange={set("title")} />
          </div>
          <div>
            <Label htmlFor="fin-term">Term</Label>
            <Select value={f.term_type} onValueChange={set("term_type")}>
              <SelectTrigger id="fin-term"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="short">Short-term (≤ 12 months)</SelectItem><SelectItem value="long">Long-term</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="fin-by">Financed by</Label>
            <Select value={f.financed_by} onValueChange={set("financed_by")}>
              <SelectTrigger id="fin-by"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="in_house">In-house (client pays us)</SelectItem><SelectItem value="third_party">Third-party lender</SelectItem></SelectContent>
            </Select>
          </div>
          {f.financed_by === "third_party" && (
            <div className="col-span-2"><Label htmlFor="fin-lender">Lender</Label><Input id="fin-lender" value={f.lender} onChange={set("lender")} placeholder="Lender or platform" /></div>
          )}
          <div><Label htmlFor="fin-price">Total price</Label><Input id="fin-price" type="number" step="0.01" min="0" value={f.total_price} onChange={set("total_price")} /></div>
          <div><Label htmlFor="fin-down">Down payment</Label><Input id="fin-down" type="number" step="0.01" min="0" value={f.down_payment} onChange={set("down_payment")} /></div>
          <div><Label htmlFor="fin-apr">APR %</Label><Input id="fin-apr" type="number" step="0.01" min="0" value={f.interest_rate} onChange={set("interest_rate")} placeholder="0" /></div>
          <div>
            <Label htmlFor="fin-freq">Frequency</Label>
            <Select value={f.frequency} onValueChange={set("frequency")}>
              <SelectTrigger id="fin-freq"><SelectValue /></SelectTrigger>
              <SelectContent>{FREQUENCIES.map((x) => <SelectItem key={x.value} value={x.value}>{x.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label htmlFor="fin-n">Number of payments</Label><Input id="fin-n" type="number" min="1" step="1" value={f.num_payments} onChange={set("num_payments")} /></div>
          <div>
            <Label htmlFor="fin-amt">Installment amount</Label>
            <Input id="fin-amt" type="number" step="0.01" min="0" value={f.payment_amount} onChange={set("payment_amount")} />
            {suggestion && Number(f.payment_amount) !== suggestion && (
              <button type="button" onClick={() => setF((p) => ({ ...p, payment_amount: suggestion }))} className="mt-1 text-[11px] font-medium text-[#ff3c00] hover:underline">
                Use {money2(suggestion)} (from price, down payment and APR)
              </button>
            )}
          </div>
          <div><Label htmlFor="fin-first">First payment due</Label><Input id="fin-first" type="date" value={f.first_due_date} onChange={set("first_due_date")} /></div>
          <div><Label htmlFor="fin-grace">Grace days</Label><Input id="fin-grace" type="number" min="0" step="1" value={f.grace_days} onChange={set("grace_days")} /></div>
          {initial && (
            <div className="col-span-2">
              <Label htmlFor="fin-status">Status</Label>
              <Select value={f.status} onValueChange={set("status")}>
                <SelectTrigger id="fin-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem><SelectItem value="paused">Paused</SelectItem><SelectItem value="paid_off">Paid off</SelectItem>
                  <SelectItem value="defaulted">Defaulted</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="col-span-2"><Label htmlFor="fin-notes">Notes</Label><Textarea id="fin-notes" rows={2} value={f.notes} onChange={set("notes")} placeholder="Agreement details, how they pay, anything to remember" /></div>
          {err && <p className="col-span-2 text-[12px] text-[#ff3c00]">{err}</p>}
          <div className="col-span-2 flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving} className="border-0 text-white flame-bg hover:opacity-90">{saving ? "Saving…" : initial ? "Save changes" : "Create plan"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({ plan, onClose, onSubmit }) {
  const [p, setP] = useState({ date: "", amount: "", method: "", note: "" });
  const [lastId, setLastId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  if ((plan?.id || null) !== lastId) {
    setLastId(plan?.id || null);
    if (plan) {
      const a = analyze(plan);
      setP({ date: toISODate(new Date()), amount: a.next ? Math.round((a.next.amount - (a.next.partial || 0)) * 100) / 100 : "", method: "", note: "" });
      setErr("");
    }
  }
  const submit = async (e) => {
    e.preventDefault();
    if (!(Number(p.amount) > 0) || !p.date) return setErr("Enter the amount and the date it was received.");
    setSaving(true);
    try { await onSubmit(plan, { date: p.date, amount: Number(p.amount), method: p.method.trim(), note: p.note.trim() }); onClose(); }
    catch (x) { setErr(x?.message || "Couldn't save. Try again."); }
    finally { setSaving(false); }
  };
  return (
    <Dialog open={!!plan} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="border-hair bg-card text-ink sm:max-w-md">
        <DialogHeader><DialogTitle>Record payment{plan ? ` · ${plan.client_name}` : ""}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <div><Label htmlFor="pay-amt">Amount</Label><Input id="pay-amt" type="number" step="0.01" min="0" value={p.amount} onChange={(e) => setP({ ...p, amount: e.target.value })} /></div>
          <div><Label htmlFor="pay-date">Received</Label><Input id="pay-date" type="date" value={p.date} onChange={(e) => setP({ ...p, date: e.target.value })} /></div>
          <div className="col-span-2"><Label htmlFor="pay-method">Method</Label><Input id="pay-method" value={p.method} onChange={(e) => setP({ ...p, method: e.target.value })} placeholder="Stripe, Zelle, check…" /></div>
          <div className="col-span-2"><Label htmlFor="pay-note">Note</Label><Input id="pay-note" value={p.note} onChange={(e) => setP({ ...p, note: e.target.value })} /></div>
          {err && <p className="col-span-2 text-[12px] text-[#ff3c00]">{err}</p>}
          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="border-0 text-white flame-bg hover:opacity-90">{saving ? "Saving…" : "Record payment"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/* ---------- The 40-Day Business Rebuild (Nov 25 2026) ---------- */
const addDays = (iso, d) => { const x = parseDate(iso) || new Date(); return toISODate(new Date(x.getTime() + d * 86400000)); };
const PKG_EMPTY = { client_id: "", client_name: "", package_plan: "p24", referred: false, start_paid_date: "", launch_date: "", grace_days: 3, status: "active", notes: "" };

function PackageForm({ open, onOpenChange, initial, clients, onSubmit }) {
  const [f, setF] = useState(PKG_EMPTY);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  const [lastKey, setLastKey] = useState(null);
  const key = open ? (initial?.id || "new") : null;
  if (key !== lastKey) {
    setLastKey(key);
    if (open) {
      setF(initial ? { ...PKG_EMPTY, ...initial, launch_date: initial.launch_date || initial.first_due_date || "" } : { ...PKG_EMPTY, launch_date: addDays(toISODate(new Date()), 40) });
      setErr("");
    }
  }
  const plan = PACKAGE_PLANS[f.package_plan] || PACKAGE_PLANS.p24;
  const start = f.referred ? PACKAGE_START - PACKAGE_REFERRAL_OFF : PACKAGE_START;
  const changingPlanLater = initial && initial.package_plan !== f.package_plan && (initial.payments || []).length > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!f.client_name.trim()) return setErr("Pick the client.");
    if (!f.launch_date) return setErr("Set the launch date (or the expected one). Monthly payments start then.");
    const fields = {
      kind: "package", client_id: f.client_id || "", client_name: f.client_name.trim(),
      title: `40-Day Business Rebuild · ${plan.label}`, package_plan: f.package_plan,
      term_type: plan.months > 12 ? "long" : "short", financed_by: "in_house",
      total_price: plan.total, down_payment: 0, interest_rate: 0, payment_amount: plan.monthly, frequency: "monthly", num_payments: plan.months,
      first_due_date: f.launch_date, launch_date: f.launch_date,
      start_payment: initial?.start_payment && initial.referred === f.referred ? initial.start_payment : start,
      referred: !!f.referred, start_paid_date: f.start_paid_date || "", after_payoff_monthly: initial?.after_payoff_monthly || PACKAGE_CARE,
      grace_days: Math.max(0, Math.floor(Number(f.grace_days) || 0)), status: f.status || "active", notes: f.notes || "",
    };
    setSaving(true);
    try { await onSubmit(fields); onOpenChange(false); } catch (x) { setErr(x?.message || "Couldn't save. Try again."); } finally { setSaving(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-hair bg-card text-ink sm:max-w-xl">
        <DialogHeader><DialogTitle>{initial ? "Edit 40-Day Business Rebuild" : "New 40-Day Business Rebuild"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <Label htmlFor="pkg-client">Client</Label>
            <Select value={f.client_id || (f.client_name ? "__custom" : "")} onValueChange={(v) => {
              const c = clients.find((x) => x.id === v);
              setF((p) => ({ ...p, client_id: c ? c.id : "", client_name: c ? (c.business || p.client_name) : p.client_name }));
            }}>
              <SelectTrigger id="pkg-client"><SelectValue placeholder="Choose a client" /></SelectTrigger>
              <SelectContent>
                {clients.filter((c) => c.business).map((c) => <SelectItem key={c.id} value={c.id}>{c.business}</SelectItem>)}
                <SelectItem value="__custom">Someone not in the client list…</SelectItem>
              </SelectContent>
            </Select>
            {!f.client_id && <Input className="mt-2" placeholder="Client name" value={f.client_name} onChange={(e) => setF({ ...f, client_name: e.target.value })} />}
          </div>
          <div className="col-span-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Plan">
            {Object.entries(PACKAGE_PLANS).map(([k, p]) => (
              <button key={k} type="button" role="radio" aria-checked={f.package_plan === k} onClick={() => setF({ ...f, package_plan: k })}
                className={`rounded-md border p-3 text-left transition ${f.package_plan === k ? "border-[#ff6a00] bg-[#ff6a00]/8" : "border-hair hover:border-ink/30"}`}>
                <p className="text-[12px] font-semibold">{p.label}</p>
                <p className="text-[18px] font-semibold tabular-nums">{money(p.monthly)}<span className="text-[11px] font-normal text-ink/55">/mo × {p.months}</span></p>
                <p className="text-[11px] text-ink/55">Balance {money(p.total)}</p>
              </button>
            ))}
          </div>
          {changingPlanLater && <p className="col-span-2 rounded bg-[#ffaa00]/15 p-2 text-[11.5px] text-[#8a4b00]">Payments are already recorded. Switching plans recalculates the balance from the new plan's total.</p>}
          <label className="col-span-2 flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={!!f.referred} onChange={(e) => setF({ ...f, referred: e.target.checked })} className="h-4 w-4 accent-[#ff6a00]" />
            Referred client ({money(PACKAGE_REFERRAL_OFF)} off the start payment)
          </label>
          <div className="col-span-2 rounded-md bg-ink/[0.04] p-3 text-[12px] text-ink/70">
            Start payment <b className="tabular-nums">{money(start)}</b> (separate from the balance), then <b>{money(plan.monthly)}/mo</b> from launch for {plan.months} months. Once paid off: HyperCare+ {money(PACKAGE_CARE)}/mo and the client owns the code.
          </div>
          <div><Label htmlFor="pkg-start">Start payment received</Label><Input id="pkg-start" type="date" value={f.start_paid_date} onChange={(e) => setF({ ...f, start_paid_date: e.target.value })} /><p className="mt-1 text-[10.5px] text-ink/45">Leave empty until paid. A Stripe invoice for {money(start)} fills it in.</p></div>
          <div><Label htmlFor="pkg-launch">Launch date (monthly starts)</Label><Input id="pkg-launch" type="date" value={f.launch_date} onChange={(e) => setF({ ...f, launch_date: e.target.value })} /><p className="mt-1 text-[10.5px] text-ink/45">Expected launch until it goes live; update it on launch day.</p></div>
          <div><Label htmlFor="pkg-grace">Grace days</Label><Input id="pkg-grace" type="number" min="0" step="1" value={f.grace_days} onChange={(e) => setF({ ...f, grace_days: e.target.value })} /></div>
          {initial && (
            <div>
              <Label htmlFor="pkg-status">Status</Label>
              <Select value={f.status} onValueChange={(v) => setF({ ...f, status: v })}>
                <SelectTrigger id="pkg-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem><SelectItem value="paused">Paused</SelectItem><SelectItem value="paid_off">Paid off</SelectItem>
                  <SelectItem value="defaulted">Defaulted</SelectItem><SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="col-span-2"><Label htmlFor="pkg-notes">Notes</Label><Textarea id="pkg-notes" rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} placeholder="Agreement details, who referred them, anything to remember" /></div>
          {err && <p className="col-span-2 text-[12px] text-[#ff3c00]">{err}</p>}
          <div className="col-span-2 flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saving} className="border-0 text-white flame-bg hover:opacity-90">{saving ? "Saving…" : initial ? "Save changes" : "Create package"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function UpgradeDialog({ plan, onClose, onSubmit }) {
  const [u, setU] = useState({ label: "", amount: "", mode: "balance", date: "" });
  const [lastId, setLastId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");
  if ((plan?.id || null) !== lastId) {
    setLastId(plan?.id || null);
    if (plan) { setU({ label: "", amount: "", mode: "balance", date: toISODate(new Date()) }); setErr(""); }
  }
  const a = plan ? analyze(plan) : null;
  const amount = Number(u.amount) || 0;
  const free = amount > 0 && amount < FREE_UNDER;
  const mode = free ? "free" : u.mode;
  const preview = a && mode === "balance" && amount > 0 && a.monthsLeft > 0 ? (a.balance + amount) / a.monthsLeft : null;

  const submit = async (e) => {
    e.preventDefault();
    if (!u.label.trim() || !(amount > 0)) return setErr("Say what the upgrade is and its quoted amount.");
    if (mode === "balance" && !(a?.monthsLeft > 0)) return setErr("No months left on the term. Bill this one up front.");
    setSaving(true);
    try {
      await onSubmit(plan, { label: u.label.trim(), amount, mode: mode === "balance" ? "balance" : "upfront", date: u.date, from_installment: a.covered });
      onClose();
    } catch (x) { setErr(x?.message || "Couldn't save. Try again."); } finally { setSaving(false); }
  };

  return (
    <Dialog open={!!plan} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="border-hair bg-card text-ink sm:max-w-md">
        <DialogHeader><DialogTitle>Add upgrade{plan ? ` · ${plan.client_name}` : ""}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <div className="col-span-2"><Label htmlFor="up-label">What's being built</Label><Input id="up-label" value={u.label} onChange={(e) => setU({ ...u, label: e.target.value })} placeholder="e.g. Quote calculator, waiver forms" /></div>
          <div><Label htmlFor="up-amt">Quoted amount</Label><Input id="up-amt" type="number" min="0" step="0.01" value={u.amount} onChange={(e) => setU({ ...u, amount: e.target.value })} /></div>
          <div><Label htmlFor="up-date">Date</Label><Input id="up-date" type="date" value={u.date} onChange={(e) => setU({ ...u, date: e.target.value })} /></div>
          {free ? (
            <p className="col-span-2 rounded bg-emerald-500/10 p-2 text-[12px] text-emerald-800">Under {money(FREE_UNDER)}: done free. It's logged in the notes and nothing is added to the balance.</p>
          ) : (
            <div className="col-span-2 grid grid-cols-2 gap-2" role="radiogroup" aria-label="How it's paid">
              {[["balance", "Add to balance"], ["upfront", "Paid up front"]].map(([k, l]) => (
                <button key={k} type="button" role="radio" aria-checked={u.mode === k} onClick={() => setU({ ...u, mode: k })}
                  className={`rounded-md border px-3 py-2 text-left text-[12.5px] ${u.mode === k ? "border-[#ff6a00] bg-[#ff6a00]/8 font-semibold" : "border-hair"}`}>{l}</button>
              ))}
            </div>
          )}
          {preview !== null && (
            <p className="col-span-2 rounded bg-ink/[0.04] p-2 text-[12px] text-ink/75">
              Balance {money2(a.balance)} + {money2(amount)} = {money2(a.balance + amount)} over {a.monthsLeft} month{a.monthsLeft === 1 ? "" : "s"}: <b>{money2(preview)}/mo</b> instead of {money2(a.amt)}. A task is created to update the Stripe amount.
            </p>
          )}
          {err && <p className="col-span-2 text-[12px] text-[#ff3c00]">{err}</p>}
          <div className="col-span-2 flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="border-0 text-white flame-bg hover:opacity-90">{saving ? "Saving…" : "Add upgrade"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
