import { useMemo, useState } from "react";
import { Download, FileText, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Btn, Card, ConfirmBtn, Disclaimer, Field, Heading, inputCls, NumberInput, Pill, Select } from "./ui";
import { FORM_LABEL, FORM_OF_ENTITY, money0, money2 } from "./ledger";
import { buildGuide, download, form1099s, ledgerCsv, packPdf, scheduleC, SCHED_C_LINES, toCsv } from "./filing";
import { depreciationForYear, homeOfficeDeduction, mileageDeduction, mileageRateOn } from "./extras";

const QUARTER_ITEMS = [
  ["sync", "Sync Stripe and QuickBooks, or import every bank/card CSV for the quarter"],
  ["inbox", "Review inbox at zero (bulk-approve suggestions, fix the rest)"],
  ["reconcile", "Ending balances match the bank statements (mark rows reconciled)"],
  ["receipts", "Receipts attached for anything $75+ and all meals/travel"],
  ["contractors", "Contractors paid this quarter have a W-9 on file"],
  ["mileage", "Business miles logged"],
  ["assets", "New equipment added to the depreciation list"],
  ["reserve", "Tax reserve topped up to the set-aside %"],
  ["estimates", "Federal 1040-ES and Oregon OR-40-V payments made and recorded"],
  ["backup", "Filing pack exported (PDF + CSV) as a backup"],
];

function quarterKey(d = new Date()) { return `${d.getFullYear()}-Q${Math.floor(d.getMonth() / 3) + 1}`; }

export default function FilingPackTab({ acct }) {
  const { plan, profile, cfg, summary, ledger, taxYear, assets, assetsApi, mileage, mileageApi, saveProfile } = acct;
  const { toast } = useToast();
  const [asset, setAsset] = useState({ name: "", cost: null, placed_in_service: "", business_use_pct: 100, asset_class: "computer", treatment: "undecided" });
  const [trip, setTrip] = useState({ date: new Date().toISOString().slice(0, 10), miles: null, purpose: "" });
  const [qKey, setQKey] = useState(quarterKey());

  const yearMiles = useMemo(() => mileage.filter((m) => String(m.date || "").startsWith(String(taxYear))), [mileage, taxYear]);
  const mil = useMemo(() => mileageDeduction(yearMiles, cfg), [yearMiles, cfg]);
  const home = useMemo(() => homeOfficeDeduction(profile, cfg), [profile, cfg]);
  const dep = useMemo(() => depreciationForYear(assets, taxYear, cfg), [assets, taxYear, cfg]);
  const sc = useMemo(() => scheduleC({ summary, mileage: mil, homeOffice: home, depreciation: dep }), [summary, mil, home, dep]);
  const f1099 = useMemo(() => form1099s({ ledger, threshold: cfg.form_1099_nec_threshold.value, kThreshold: cfg.form_1099_k_threshold.value }), [ledger, cfg]);
  const guide = useMemo(() => buildGuide({ plan, sc, profile, taxYear }), [plan, sc, profile, taxYear]);
  const form = FORM_OF_ENTITY[profile.entity_type] || "schedule_c";
  const checks = (profile.checklists || {})[qKey] || {};
  const uncategorized = acct.inbox.length;

  const exportPl = () => {
    const rows = [["form_line", "description", "amount"], ...SCHED_C_LINES.map(([l, label]) => [`Sch C ${l}`, label, sc.lines[l]]), ["Sch C 31", "Net profit", sc.line31]];
    if (form !== "schedule_c") summary.rows.forEach((r) => rows.push([r.line, r.label, Math.round((r.tax === "income" || r.tax === "contra" ? r.gross : r.deductible) * 100) / 100]));
    download(`pl-by-form-line-${taxYear}.csv`, toCsv(rows));
  };

  return (
    <div className="space-y-5">
      <Heading title="Filing" accent="pack" sub={`Everything you (or a CPA) need to file ${taxYear}: the P&L mapped to ${FORM_LABEL[form]} lines, 1099s, mileage, home office, depreciation and a line-by-line walkthrough.`}
        right={
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => download(`ledger-${taxYear}.csv`, ledgerCsv(ledger))}><Download className="h-3.5 w-3.5" />Ledger CSV</Btn>
            <Btn onClick={exportPl}><Download className="h-3.5 w-3.5" />P&L CSV</Btn>
            <Btn kind="flame" onClick={() => { try { packPdf({ plan, sc, guide, f1099, depreciation: dep, mileage: mil, homeOffice: home, profile, taxYear }); } catch (e) { toast({ title: "PDF failed", description: String(e.message || e), variant: "destructive" }); } }}><FileText className="h-3.5 w-3.5" />Filing pack PDF</Btn>
          </div>
        } />
      {uncategorized > 0 && <p className="rounded-md border border-[#ff3c00]/40 bg-[#ff3c00]/[0.06] px-3 py-2 text-[12px] text-ink/75">{uncategorized} transactions are still uncategorized and are left out of these totals until you review them.</p>}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={`P&L by ${FORM_LABEL[form]} line`} sub={form === "schedule_c" ? "Line numbers per the 2025 Schedule C; confirm on the 2026 form." : "Mapped to the entity return's lines (2025 forms)."}>
          {form === "schedule_c" ? (
            <div>
              {SCHED_C_LINES.filter(([l]) => sc.lines[l]).map(([l, label]) => (
                <div key={l} className="flex justify-between border-b border-hair/60 py-1.5 text-[12.5px]"><span><span className="mr-2 inline-block w-9 font-mono text-[11px] text-ink/45">L{l}</span>{label}</span><span className="tabular-nums">{money2(sc.lines[l])}</span></div>
              ))}
              <div className="flex justify-between border-b border-hair/60 py-1.5 text-[12.5px] font-semibold"><span><span className="mr-2 inline-block w-9 font-mono text-[11px] text-ink/45">L28</span>Total expenses</span><span className="tabular-nums">{money2(sc.line28)}</span></div>
              <div className="mt-2 flex justify-between rounded-md bg-ink px-3 py-2 text-white"><span className="text-[13px] font-semibold">L31 Net profit</span><span className="tabular-nums flame-text text-[15px] font-semibold">{money2(sc.line31)}</span></div>
            </div>
          ) : (
            summary.rows.map((r) => (
              <div key={r.key} className="flex justify-between border-b border-hair/60 py-1.5 text-[12.5px]"><span><span className="mr-2 font-mono text-[10.5px] text-ink/45">{r.line}</span>{r.label}</span><span className="tabular-nums">{money2(r.tax === "income" || r.tax === "contra" ? r.gross : r.deductible)}</span></div>
            ))
          )}
        </Card>

        <div className="space-y-4">
          <Card title="1099s" sub={`1099-NEC threshold ${money0(cfg.form_1099_nec_threshold.value)} for payments made after 2025 (IRS).`}>
            <p className="mono-label !text-[9px] text-ink/45">You issue (by Jan 31)</p>
            {f1099.toIssue.length ? f1099.toIssue.map((c) => <div key={c.payee} className="flex justify-between py-1 text-[12.5px]"><span>{c.payee} <Pill>W-9</Pill></span><span className="tabular-nums">{money0(c.total)}</span></div>)
              : <p className="mt-1 text-[12px] text-ink/50">No contractor at {money0(cfg.form_1099_nec_threshold.value)}+ in the ledger.{f1099.belowThreshold.length ? ` ${f1099.belowThreshold.length} below the threshold.` : ""}</p>}
            <p className="mt-1 text-[10.5px] text-ink/40">Payments made by card or PayPal are reported by the processor on a 1099-K, not by you.</p>
            <p className="mono-label mt-3 !text-[9px] text-ink/45">You may receive</p>
            <p className="mt-1 text-[12px] text-ink/65">{f1099.stripe.expectK ? `1099-K from Stripe (${money0(f1099.stripe.gross)}, ${f1099.stripe.count} payments).` : `Stripe 1099-K not expected (${money0(f1099.stripe.gross)}, ${f1099.stripe.count} payments; needs > $20,000 and > 200).`}</p>
            {f1099.clientsOverThreshold.slice(0, 8).map((c) => <div key={c.payee} className="flex justify-between py-0.5 text-[12px] text-ink/60"><span>{c.payee} may send a 1099-NEC</span><span className="tabular-nums">{money0(c.total)}</span></div>)}
            <p className="mt-1 text-[10.5px] text-ink/40">All of it is already in gross receipts. Match the forms against the ledger; never add them on top.</p>
          </Card>

          <Card title="Home office" sub={home.note}>
            <div className="grid grid-cols-3 gap-2">
              <Field label="Method"><Select value={profile.home_office_method} onChange={(v) => saveProfile({ home_office_method: v })} options={[["none", "None"], ["simplified", "Simplified"], ["regular", "Regular (8829)"]]} /></Field>
              <Field label="Office sq ft"><NumberInput value={profile.home_office_sqft} onChange={(v) => saveProfile({ home_office_sqft: v || 0 })} /></Field>
              {profile.home_office_method === "regular" && <Field label="Home sq ft"><NumberInput value={profile.home_total_sqft} onChange={(v) => saveProfile({ home_total_sqft: v || 0 })} /></Field>}
            </div>
            {profile.home_office_method === "regular" && <Field label="Annual home costs (rent/mortgage interest, utilities, insurance)" className="mt-2"><NumberInput value={profile.home_expenses_annual} onChange={(v) => saveProfile({ home_expenses_annual: v || 0 })} /></Field>}
            <p className="mt-2 text-[11px] text-ink/50">Only space used regularly and exclusively for the business qualifies. Deduction this year: <b>{money0(home.deduction)}</b>.</p>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Mileage log" sub={`${Math.round(mil.miles).toLocaleString()} business miles in ${taxYear} → ${money0(mil.deduction)} at the IRS standard rate (72.5¢ through Jun 30, 76¢ from Jul 1, 2026).`}>
          <div className="grid grid-cols-[1fr_80px_1.4fr_auto] items-end gap-2">
            <Field label="Date"><input type="date" className={inputCls} value={trip.date} onChange={(e) => setTrip({ ...trip, date: e.target.value })} /></Field>
            <Field label="Miles"><NumberInput value={trip.miles} onChange={(v) => setTrip({ ...trip, miles: v })} /></Field>
            <Field label="Purpose"><input className={inputCls} value={trip.purpose} placeholder="Client meeting — Palm Shore" onChange={(e) => setTrip({ ...trip, purpose: e.target.value })} /></Field>
            <Btn kind="ink" onClick={async () => { if (!trip.miles) return; await mileageApi.add({ ...trip, miles: Number(trip.miles) }); setTrip({ ...trip, miles: null, purpose: "" }); }}><Plus className="h-3.5 w-3.5" /></Btn>
          </div>
          <div className="mt-3 max-h-56 overflow-y-auto">
            {yearMiles.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 border-b border-hair/60 py-1.5 text-[12px]">
                <span className="font-mono text-[11px] text-ink/50">{m.date}</span><span className="flex-1 truncate text-ink/70">{m.purpose || "—"}</span>
                <span className="tabular-nums">{m.miles} mi · {money2(m.miles * mileageRateOn(m.date, cfg))}</span>
                <button onClick={() => mileageApi.remove(m.id)} className="text-ink/30 hover:text-red-700"><Trash2 className="h-3 w-3" /></button>
              </div>
            ))}
            {!yearMiles.length && <p className="text-[12px] text-ink/45">No trips logged. Commuting from home to a regular office doesn't count; client visits and errands for the business do. If you claim the standard rate you can't also deduct gas or repairs for that car.</p>}
          </div>
        </Card>

        <Card title="Depreciation list" sub={`Assets used in the business. ${money0(dep.total)} deductible in ${taxYear}. Section 179 limit ${money0(cfg.sec179_limit.value.limit)}; 100% bonus for property acquired after Jan 19, 2025.`}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Field label="Asset"><input className={inputCls} value={asset.name} placeholder="MacBook Pro" onChange={(e) => setAsset({ ...asset, name: e.target.value })} /></Field>
            <Field label="Cost"><NumberInput value={asset.cost} onChange={(v) => setAsset({ ...asset, cost: v })} /></Field>
            <Field label="Placed in service"><input type="date" className={inputCls} value={asset.placed_in_service} onChange={(e) => setAsset({ ...asset, placed_in_service: e.target.value })} /></Field>
            <Field label="Class"><Select value={asset.asset_class} onChange={(v) => setAsset({ ...asset, asset_class: v })} options={[["computer", "Computer / camera"], ["office_equipment", "Office equipment"], ["furniture", "Furniture"], ["vehicle", "Vehicle"], ["software", "Software (bought)"], ["other", "Other"]]} /></Field>
            <Field label="Treatment"><Select value={asset.treatment} onChange={(v) => setAsset({ ...asset, treatment: v })} options={[["undecided", "Undecided"], ["de_minimis", "De minimis (≤ $2,500)"], ["section_179", "Section 179"], ["bonus", "Bonus 100%"], ["macrs", "Regular MACRS"]]} /></Field>
            <Field label="Business use %"><NumberInput value={asset.business_use_pct} onChange={(v) => setAsset({ ...asset, business_use_pct: v })} /></Field>
          </div>
          <div className="mt-2 flex justify-end"><Btn kind="ink" onClick={async () => { if (!asset.name || !asset.cost) return; await assetsApi.add({ ...asset, cost: Number(asset.cost) }); setAsset({ ...asset, name: "", cost: null }); }}>Add asset</Btn></div>
          <div className="mt-3 space-y-1.5">
            {dep.rows.map((r) => (
              <div key={r.asset.id} className="flex items-start justify-between gap-2 border-b border-hair/60 pb-1.5 text-[12px]">
                <div className="min-w-0"><p className="font-medium text-ink/80">{r.asset.name} <span className="font-normal text-ink/45">· {money0(r.asset.cost)} · {r.asset.placed_in_service || "date?"}</span></p><p className="text-[10.5px] text-ink/45">{r.method}</p></div>
                <span className="flex items-center gap-2 tabular-nums">{money0(r.amount)}<ConfirmBtn className="!px-1.5 !py-0.5" confirmText="Delete?" onConfirm={() => assetsApi.remove(r.asset.id)}><Trash2 className="h-3 w-3" /></ConfirmBtn></span>
              </div>
            ))}
            {!dep.rows.length && <p className="text-[12px] text-ink/45">Bought a computer, camera, monitor or desk for the business? Add it here instead of expensing it, so the right method is used.</p>}
          </div>
        </Card>
      </div>

      <Card title="How to fill it out" sub="Line-by-line with this year's numbers. Line numbers follow the 2025 forms — the IRS and Oregon renumber lines some years, so match by description on the 2026 forms. Oregon lines are listed by description.">
        <div className="space-y-5">
          {guide.map((g) => (
            <div key={g.form}>
              <p className="label-cross">{g.form}</p>
              <ol className="mt-2 space-y-1">
                {g.items.map((it, i) => (
                  <li key={i} className="grid grid-cols-[52px_1fr_auto] items-baseline gap-3 border-b border-hair/50 py-1.5 text-[12.5px]">
                    <span className="font-mono text-[11px] text-[#ff3c00]">{it.line === "—" ? "" : `L${it.line}`}</span>
                    <span className="text-ink/75">{it.text}</span>
                    <span className="tabular-nums font-medium">{it.value == null ? "" : money0(it.value)}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </Card>

      <Card title="Quarter-close checklist" sub="Run this at the end of every quarter, before the estimated-tax due date."
        right={<select value={qKey} onChange={(e) => setQKey(e.target.value)} className="rounded-md border border-hair bg-card px-2 py-1 text-[12px]">{[taxYear, taxYear - 1].flatMap((y) => [4, 3, 2, 1].map((q) => `${y}-Q${q}`)).map((k) => <option key={k}>{k}</option>)}</select>}>
        <div className="grid gap-1.5 md:grid-cols-2">
          {QUARTER_ITEMS.map(([k, label]) => (
            <label key={k} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-[12.5px] hover:bg-ink/[0.03]">
              <input type="checkbox" className="mt-0.5 accent-[#ff3c00]" checked={!!checks[k]} onChange={(e) => saveProfile({ checklists: { ...(profile.checklists || {}), [qKey]: { ...checks, [k]: e.target.checked } } })} />
              <span className={checks[k] ? "text-ink/40 line-through" : "text-ink/75"}>{label}</span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-ink/45">{QUARTER_ITEMS.filter(([k]) => checks[k]).length}/{QUARTER_ITEMS.length} done for {qKey}.</p>
      </Card>

      <Disclaimer />
    </div>
  );
}
