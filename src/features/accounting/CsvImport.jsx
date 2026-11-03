// Bank statement CSV import (Mercury or any bank): column mapping, dedupe, rules, cross-source matching.
import { useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { Btn, Field, inputCls, Modal, Pill } from "./ui";
import { applyRulesTo, findCrossSourceMatch, guessMapping, money2, parseCsv, rowsToDrafts } from "./ledger";

const FIELDS = [
  ["date", "Date *"], ["description", "Description"], ["payee", "Payee / name"], ["amount", "Amount (signed)"],
  ["debit", "Debit / money out"], ["credit", "Credit / money in"], ["account", "Account"], ["status", "Status"], ["category", "Bank category"],
];

export default function CsvImport({ acct, onClose }) {
  const { toast } = useToast();
  const [rows, setRows] = useState(null);
  const [fileName, setFileName] = useState("");
  const [mapping, setMapping] = useState(null);
  const [account, setAccount] = useState("Mercury checking");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const onFile = async (f) => {
    if (!f) return;
    const text = await f.text();
    const parsed = parseCsv(text);
    if (parsed.length < 2) { toast({ title: "That file has no rows", variant: "destructive" }); return; }
    setRows(parsed);
    setFileName(f.name);
    setMapping(guessMapping(parsed[0]));
    if (/mercury/i.test(f.name)) setAccount("Mercury");
  };

  const preview = useMemo(() => (rows && mapping ? rowsToDrafts(rows.slice(0, 13), mapping, { account }) : null), [rows, mapping, account]);
  const headers = rows ? rows[0] : [];

  const run = async () => {
    setBusy(true);
    const batch = `csv-${Date.now()}`;
    const { drafts, errors } = rowsToDrafts(rows, mapping, { account, batch });
    // Dedupe against every CSV row ever imported (all years), not just the loaded tax year.
    const prior = await base44.entities.LedgerTransaction.filter({ ...acct.scope, source: "csv" }, "-date", 20000).catch(() => []);
    const keys = new Set([...(Array.isArray(prior) ? prior : []), ...acct.ledger].map((t) => t.dedupe_key).filter(Boolean));
    const fresh = drafts.filter((d) => !keys.has(d.dedupe_key));
    const matches = [];
    let ruled = 0;
    const out = fresh.map((d) => {
      const base = { ...acct.scope, ...d, tax_year: Number(d.date.slice(0, 4)), review_status: "needs_review", reconciled: true };
      delete base.bank_category;
      const notes = d.bank_category ? `Bank category: ${d.bank_category}` : "";
      const { patch, rule } = applyRulesTo(base, acct.rules, acct.categoryPatch);
      if (rule) ruled++;
      const m = findCrossSourceMatch(base, acct.ledger.filter((t) => t.source === "expense_schedule" || t.source === "quickbooks"));
      if (m) {
        matches.push({ draftKey: d.dedupe_key, existing: m });
        if (m.source === "quickbooks") return { ...base, ...patch, review_status: "excluded", matched_id: m.id, notes: `Duplicate of QuickBooks row (${m.payee}). ${notes}`.trim() };
        const inherit = !patch.category && m.category ? acct.categoryPatch(m.category) : {};
        return { ...base, ...inherit, ...patch, review_status: patch.review_status || (inherit.category ? "approved" : base.review_status), matched_id: m.id, notes: `Matches scheduled bill "${m.payee}". ${notes}`.trim() };
      }
      return { ...base, ...patch, notes };
    });
    const created = out.length ? await acct.addRows(out) : [];
    // Scheduled bills that the bank confirmed: exclude them so the money counts once.
    const byKey = Object.fromEntries(created.map((c) => [c.dedupe_key, c]));
    const sched = matches.filter((m) => m.existing.source === "expense_schedule");
    for (const m of sched) {
      const c = byKey[m.draftKey];
      await acct.patchRows([m.existing.id], { review_status: "excluded", matched_id: c ? c.id : "", notes: "Replaced by the matching bank row" });
    }
    await acct.saveProfile({ last_csv_import_at: new Date().toISOString() });
    setBusy(false);
    setResult({
      read: drafts.length, imported: created.length, duplicates: drafts.length - fresh.length, errors: errors.length,
      matched: matches.length, ruled, review: out.filter((o) => o.review_status === "needs_review").length,
    });
  };

  return (
    <Modal open onClose={onClose} title="Import a bank statement (CSV)" wide>
      {result ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[["Imported", result.imported], ["Duplicates skipped", result.duplicates], ["Matched to bills / QuickBooks", result.matched], ["Need review", result.review]].map(([l, v]) => (
              <div key={l} className="rounded-md border border-hair bg-card p-3"><p className="mono-label !text-[9px] text-ink/45">{l}</p><p className="mt-1 text-2xl font-semibold tabular-nums">{v}</p></div>
            ))}
          </div>
          <p className="text-[12px] text-ink/60">{result.ruled} rows matched a rule. {result.errors ? `${result.errors} lines had no usable date/amount and were skipped.` : ""} Duplicates are detected by date + amount + direction + payee, so re-importing an overlapping export is safe.</p>
          <div className="flex justify-end"><Btn kind="flame" onClick={onClose}>Done</Btn></div>
        </div>
      ) : !rows ? (
        <div className="space-y-4">
          <p className="text-[12.5px] leading-relaxed text-ink/65">
            No bank subscription needed. In Mercury: Transactions → filter the dates → Export → CSV. Any bank works: the importer reads a signed Amount column or separate Debit/Credit columns. Stripe payouts are recognized as transfers, so revenue is never counted twice.
          </p>
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-hair bg-card px-6 py-12 text-center hover:border-[#ff3c00]/50">
            <span className="text-sm font-medium text-ink/75">Choose a .csv file</span>
            <span className="mt-1 text-[11px] text-ink/45">Read in your browser; only the rows are saved.</span>
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => onFile(e.target.files && e.target.files[0])} />
          </label>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="flame">{fileName}</Pill><Pill>{rows.length - 1} rows</Pill>
            <button onClick={() => setRows(null)} className="text-[11.5px] text-ink/50 hover:text-ink">Choose another file</button>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {FIELDS.map(([k, label]) => (
              <Field key={k} label={label}>
                <select className={inputCls} value={mapping[k]} onChange={(e) => setMapping({ ...mapping, [k]: Number(e.target.value) })}>
                  <option value={-1}>— none —</option>
                  {headers.map((h, i) => <option key={i} value={i}>{h || `Column ${i + 1}`}</option>)}
                </select>
              </Field>
            ))}
            <Field label="Account name" hint="Used when the file has no account column."><input className={inputCls} value={account} onChange={(e) => setAccount(e.target.value)} /></Field>
          </div>
          <div className="overflow-x-auto rounded-md border border-hair bg-card">
            <table className="w-full text-[12px]">
              <thead><tr className="border-b border-hair text-ink/45"><th className="mono-label px-3 py-2 text-left !text-[9px]">Date</th><th className="mono-label px-3 py-2 text-left !text-[9px]">Payee</th><th className="mono-label px-3 py-2 text-right !text-[9px]">Amount</th></tr></thead>
              <tbody>
                {(preview ? preview.drafts : []).map((d) => (
                  <tr key={d.dedupe_key} className="border-b border-hair/60"><td className="px-3 py-1.5 font-mono text-[11px]">{d.date}</td><td className="px-3 py-1.5">{d.payee}</td><td className={`px-3 py-1.5 text-right tabular-nums ${d.direction === "in" ? "text-[#c23000]" : ""}`}>{d.direction === "in" ? "+" : "−"}{money2(d.amount)}</td></tr>
                ))}
              </tbody>
            </table>
            {preview && !preview.drafts.length && <p className="p-3 text-[12px] text-[#c23000]">No rows parse with this mapping. Pick the date and amount (or debit/credit) columns.</p>}
          </div>
          <div className="flex justify-end gap-2">
            <Btn onClick={onClose}>Cancel</Btn>
            <Btn kind="flame" busy={busy} disabled={mapping.date < 0 || (mapping.amount < 0 && mapping.debit < 0 && mapping.credit < 0)} onClick={run}>Import {rows.length - 1} rows</Btn>
          </div>
        </div>
      )}
    </Modal>
  );
}
