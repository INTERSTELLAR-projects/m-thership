import { useMemo, useState } from "react";
import { Check, FileUp, Paperclip, Plus, RefreshCw, Sparkles, Wand2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";
import { occurrencesBetween } from "@/components/financial/finance/expenses";
import { Btn, Card, ConfirmBtn, Disclaimer, Empty, Field, Heading, inputCls, Modal, NumberInput, Pill, Select } from "./ui";
import { CAT, CATEGORIES, EXPENSE_CATEGORY_MAP, findRule, money2, normalize, payeePattern } from "./ledger";
import { invokeAccounting } from "./useAccounting";
import CsvImport from "./CsvImport";

const FILTERS = [["inbox", "Review inbox"], ["all", "All"], ["approved", "Approved"], ["excluded", "Excluded"]];
const SOURCE_LABEL = { stripe: "Stripe", quickbooks: "QuickBooks", csv: "Bank CSV", expense_schedule: "Expense schedule", manual: "Manual" };
const catOptions = [["", "— Uncategorized —"], ...CATEGORIES.map((c) => [c.key, c.label])];

export async function openReceipt(url) {
  if (!url) return;
  if (url.startsWith("private:")) {
    const { signed_url } = await base44.integrations.Core.CreateFileSignedUrl({ file_uri: url.slice(8), expires_in: 600 });
    window.open(signed_url, "_blank", "noopener");
  } else window.open(url, "_blank", "noopener");
}

export async function uploadReceipt(file) {
  const { file_uri } = await base44.integrations.Core.UploadPrivateFile({ file });
  return `private:${file_uri}`;
}

// Rule application: learned rules and high-priority system rules (≤10) categorize and approve;
// other default rules only suggest (the row stays in the inbox for Justin).
export function applyRulesTo(row, rules, catPatch) {
  const rule = findRule(rules, row);
  if (!rule || !CAT[rule.category]) return { row, rule: null };
  if (rule.learned || (rule.priority ?? 50) <= 10) {
    return { row: { ...row, ...catPatch(rule.category), rule_id: rule.id, review_status: "approved" }, rule };
  }
  return { row: { ...row, rule_id: rule.id, ai_suggestion: { category: rule.category, confidence: 0.85, reason: `Rule: "${rule.pattern}"`, by: "rule", at: new Date().toISOString() } }, rule };
}

function TxEditor({ tx, onClose, acct }) {
  const [form, setForm] = useState(() => ({ ...tx }));
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const isNew = !tx.id;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const save = async () => {
    if (!form.date || !form.amount) { toast({ title: "Date and amount are required" }); return; }
    setBusy(true);
    const patch = {
      date: form.date, amount: Math.abs(Number(form.amount)), direction: form.direction, payee: form.payee || "", description: form.description || "",
      account: form.account || "", notes: form.notes || "", receipt_url: form.receipt_url || "", reconciled: !!form.reconciled,
      ...(form.category ? acct.categoryPatch(form.category) : { category: "", tax_category: "", form_line: "" }),
      review_status: form.review_status === "excluded" ? "excluded" : form.category ? "approved" : "needs_review",
      tax_year: Number(String(form.date).slice(0, 4)),
    };
    if (isNew) await acct.addRows([{ ...acct.scope, source: "manual", dedupe_key: `manual:${Date.now()}`, ...patch }]);
    else await acct.patchRows([tx.id], patch);
    setBusy(false);
    onClose();
  };
  return (
    <Modal open onClose={onClose} title={isNew ? "Add transaction" : "Edit transaction"}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" className={inputCls} value={form.date || ""} onChange={(e) => set("date", e.target.value)} /></Field>
        <Field label="Amount"><NumberInput value={form.amount} onChange={(v) => set("amount", v)} /></Field>
        <Field label="Direction"><Select value={form.direction || "out"} onChange={(v) => set("direction", v)} options={[["out", "Money out"], ["in", "Money in"]]} /></Field>
        <Field label="Account"><input className={inputCls} value={form.account || ""} onChange={(e) => set("account", e.target.value)} placeholder="Mercury checking" /></Field>
        <Field label="Payee" className="col-span-2"><input className={inputCls} value={form.payee || ""} onChange={(e) => set("payee", e.target.value)} /></Field>
        <Field label="Category" className="col-span-2"><Select value={form.category || ""} onChange={(v) => set("category", v)} options={catOptions} /></Field>
        {form.category && CAT[form.category] && (
          <p className="col-span-2 -mt-1 text-[11px] text-ink/50">Maps to {acct.categoryPatch(form.category).form_line || "no form line (not on the P&L)"}. {CAT[form.category].note || ""}</p>
        )}
        <Field label="Notes" className="col-span-2"><textarea rows={2} className={inputCls} value={form.notes || ""} onChange={(e) => set("notes", e.target.value)} /></Field>
        <Field label="Receipt" className="col-span-2" hint="Stored privately; opens through a short-lived signed link.">
          <div className="flex flex-wrap items-center gap-2">
            <input type="file" accept="image/*,application/pdf" className="text-[12px]" onChange={async (e) => {
              const f = e.target.files && e.target.files[0];
              if (!f) return;
              setBusy(true);
              try { set("receipt_url", await uploadReceipt(f)); toast({ title: "Receipt attached" }); } catch (err) { toast({ title: "Upload failed", description: String(err.message || err), variant: "destructive" }); }
              setBusy(false);
            }} />
            {form.receipt_url && <Btn kind="subtle" onClick={() => openReceipt(form.receipt_url)}><Paperclip className="h-3.5 w-3.5" />View</Btn>}
          </div>
        </Field>
        <label className="col-span-2 flex items-center gap-2 text-[12px] text-ink/70"><input type="checkbox" checked={!!form.reconciled} onChange={(e) => set("reconciled", e.target.checked)} /> Reconciled to a bank statement</label>
        <label className="col-span-2 flex items-center gap-2 text-[12px] text-ink/70"><input type="checkbox" checked={form.review_status === "excluded"} onChange={(e) => set("review_status", e.target.checked ? "excluded" : "needs_review")} /> Exclude from the books (duplicate / not real)</label>
      </div>
      <div className="mt-5 flex items-center justify-between gap-2">
        {!isNew ? <ConfirmBtn onConfirm={async () => { await acct.deleteRows([tx.id]); onClose(); }}>Delete</ConfirmBtn> : <span />}
        <div className="flex gap-2"><Btn onClick={onClose}>Cancel</Btn><Btn kind="flame" busy={busy} onClick={save}>Save</Btn></div>
      </div>
    </Modal>
  );
}

export default function TransactionsTab({ acct }) {
  const { toast } = useToast();
  const [filter, setFilter] = useState(acct.inbox.length ? "inbox" : "all");
  const [source, setSource] = useState("");
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(() => new Set());
  const [learn, setLearn] = useState(true);
  const [busy, setBusy] = useState("");
  const [editing, setEditing] = useState(null);
  const [importing, setImporting] = useState(false);
  const [bulkCat, setBulkCat] = useState("");

  const rows = useMemo(() => {
    const nq = normalize(q);
    return acct.ledger.filter((t) => {
      if (filter === "inbox" && t.review_status !== "needs_review") return false;
      if (filter === "approved" && t.review_status !== "approved") return false;
      if (filter === "excluded" && t.review_status !== "excluded") return false;
      if (source && t.source !== source) return false;
      if (cat === "__none" ? t.category : cat && t.category !== cat) return false;
      if (nq && !normalize(`${t.payee} ${t.description} ${t.account} ${t.amount}`).includes(nq)) return false;
      return true;
    });
  }, [acct.ledger, filter, source, cat, q]);

  const shown = rows.slice(0, 400);
  const selectedRows = acct.ledger.filter((t) => sel.has(t.id));
  const toggle = (id) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const allOn = shown.length > 0 && shown.every((t) => sel.has(t.id));

  // Learn a payee rule from an approval (skips when an equivalent rule already exists).
  const learnFrom = async (tx, category) => {
    if (!learn) return;
    const pattern = payeePattern(tx.payee || tx.description);
    if (!pattern || pattern.length < 3 || ["transfer"].includes(category) && tx.direction === "out") return;
    const existing = findRule(acct.rules, tx);
    if (existing && existing.category === category) return;
    if (acct.rules.some((r) => normalize(r.pattern) === pattern && r.category === category)) return;
    await acct.addRule({ pattern, category, direction: tx.direction, learned: true, priority: 30, notes: `Learned from approving "${tx.payee || tx.description}"` });
  };

  const setCategory = async (tx, category) => {
    await acct.patchRows([tx.id], category ? { ...acct.categoryPatch(category), review_status: "approved" } : { category: "", tax_category: "", form_line: "", review_status: "needs_review" });
    if (category) await learnFrom(tx, category);
  };

  const approveSuggestions = async (list) => {
    const withSug = list.filter((t) => t.ai_suggestion && CAT[t.ai_suggestion.category]);
    if (!withSug.length) { toast({ title: "No suggestions in the selection" }); return; }
    setBusy("approve");
    await acct.patchRows(withSug.map((t) => t.id), (t) => ({ ...acct.categoryPatch(t.ai_suggestion.category), review_status: "approved" }));
    const seen = new Set();
    for (const t of withSug) {
      const key = `${payeePattern(t.payee || t.description)}|${t.ai_suggestion.category}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (t.ai_suggestion.by !== "rule") await learnFrom(t, t.ai_suggestion.category);
    }
    setSel(new Set());
    setBusy("");
    toast({ title: `Approved ${withSug.length} transaction${withSug.length === 1 ? "" : "s"}`, description: learn ? "New payee rules were learned from them." : undefined });
  };

  const runAi = async () => {
    const targets = acct.ledger.filter((t) => t.review_status === "needs_review" && !t.category && !t.ai_suggestion).slice(0, 180);
    if (!targets.length) { toast({ title: "Nothing to categorize", description: "Every inbox row already has a suggestion." }); return; }
    setBusy("ai");
    const examples = acct.ledger.filter((t) => t.review_status === "approved" && t.category && t.source !== "stripe").slice(0, 40).map((t) => ({ payee: t.payee, direction: t.direction, category: t.category }));
    const categories = CATEGORIES.map((c) => ({ key: c.key, label: c.label, dir: c.dir }));
    let got = 0;
    for (let i = 0; i < targets.length; i += 60) {
      const res = await invokeAccounting("ai_categorize", { ids: targets.slice(i, i + 60).map((t) => t.id), categories, examples });
      if (res.error) { toast({ title: "AI categorization failed", description: res.error, variant: "destructive" }); break; }
      got += (res.suggestions || []).length;
    }
    await acct.reload();
    setBusy("");
    toast({ title: `${got} suggestions ready`, description: "Review them, then approve in bulk." });
  };

  const reapplyRules = async () => {
    const targets = acct.ledger.filter((t) => t.review_status === "needs_review" && !t.category);
    let n = 0;
    setBusy("rules");
    for (const t of targets) {
      const { row, rule } = applyRulesTo(t, acct.rules, acct.categoryPatch);
      if (rule) { n++; const { id: _id, ...patch } = row; await acct.patchRows([t.id], patch); }
    }
    setBusy("");
    toast({ title: n ? `Rules matched ${n} transaction${n === 1 ? "" : "s"}` : "No rule matched the inbox" });
  };

  const syncStripe = async () => {
    setBusy("stripe");
    const res = await invokeAccounting("sync_stripe", { tax_year: acct.taxYear });
    setBusy("");
    if (res.error) toast({ title: "Stripe sync failed", description: res.error, variant: "destructive" });
    else if (res.configured === false) toast({ title: "Stripe isn't configured", description: "STRIPE_SECRET_KEY is not set for this app." });
    else { toast({ title: `Stripe: ${res.created} new rows`, description: `${res.fetched} balance transactions read for ${acct.taxYear}.` }); acct.reload(); }
  };

  const syncQbo = async () => {
    setBusy("qbo");
    const res = await invokeAccounting("qbo_sync", { tax_year: acct.taxYear });
    setBusy("");
    if (res.error) toast({ title: "QuickBooks sync failed", description: res.error, variant: "destructive" });
    else if (!res.connected) toast({ title: "QuickBooks isn't connected", description: "See Settings & connections." });
    else if (res.needs_realm) toast({ title: "QuickBooks company id needed", description: res.reason });
    else { toast({ title: `QuickBooks: ${res.created} new rows`, description: `${res.duplicates_skipped} duplicates of bank/CSV rows skipped.` }); acct.reload(); }
  };

  const importSchedule = async () => {
    const now = new Date();
    const end = new Date(Math.min(now.getTime(), new Date(acct.taxYear, 11, 31).getTime()));
    const occ = occurrencesBetween(acct.expenses, new Date(acct.taxYear, 0, 1), end, now);
    const have = new Set(acct.ledger.map((t) => t.dedupe_key));
    const drafts = occ
      .map((o) => {
        const key = `exp:${o.expense.id}:${o.cycle}`;
        if (have.has(key)) return null;
        const category = EXPENSE_CATEGORY_MAP[o.expense.category] || "other_expense";
        const d = o.date;
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        return {
          ...acct.scope, tax_year: acct.taxYear, date, amount: o.amount, direction: "out", payee: o.expense.platform, description: `${o.expense.frequency} bill (Expenses tab)`,
          account: "Expense schedule", source: "expense_schedule", source_ref: o.expense.id, dedupe_key: key, reconciled: false, review_status: "approved",
          ...acct.categoryPatch(category), notes: `Scheduled bill${o.paid ? " marked paid" : " (not marked paid)"} — replaced automatically when a matching bank/QuickBooks row is imported.`,
        };
      })
      .filter(Boolean);
    if (!drafts.length) { toast({ title: "Expense schedule already imported" }); return; }
    setBusy("exp");
    await acct.addRows(drafts);
    setBusy("");
    toast({ title: `${drafts.length} scheduled bills added`, description: "They stand in for bank data until a statement is imported." });
  };

  const bulk = async (patch, label) => {
    const ids = [...sel];
    if (!ids.length) return;
    await acct.patchRows(ids, patch);
    setSel(new Set());
    toast({ title: `${label} ${ids.length} row${ids.length === 1 ? "" : "s"}` });
  };

  const highConf = acct.inbox.filter((t) => t.ai_suggestion && (t.ai_suggestion.confidence || 0) >= 0.8);

  return (
    <div className="space-y-5">
      <Heading title="Transactions" accent="inbox" sub="Every money movement for the year. New rows land in the inbox; rules categorize what they can, AI suggests the rest, and you approve in bulk. Approvals teach new payee rules." />

      <div className="flex flex-wrap gap-2">
        <Btn kind="flame" onClick={() => setImporting(true)}><FileUp className="h-3.5 w-3.5" />Import bank CSV</Btn>
        <Btn busy={busy === "stripe"} onClick={syncStripe}><RefreshCw className="h-3.5 w-3.5" />Sync Stripe</Btn>
        <Btn busy={busy === "qbo"} onClick={syncQbo}><RefreshCw className="h-3.5 w-3.5" />Sync QuickBooks</Btn>
        <Btn busy={busy === "exp"} onClick={importSchedule}>Add expense schedule</Btn>
        <Btn onClick={() => setEditing({ date: new Date().toISOString().slice(0, 10), direction: "out", amount: null })}><Plus className="h-3.5 w-3.5" />Add</Btn>
        <span className="mx-1 hidden w-px bg-hair sm:block" />
        <Btn busy={busy === "rules"} onClick={reapplyRules}><Wand2 className="h-3.5 w-3.5" />Apply rules</Btn>
        <Btn busy={busy === "ai"} onClick={runAi}><Sparkles className="h-3.5 w-3.5" />AI suggest uncategorized</Btn>
        {highConf.length > 0 && <Btn kind="ink" busy={busy === "approve"} onClick={() => approveSuggestions(highConf)}><Check className="h-3.5 w-3.5" />Approve {highConf.length} suggestions ≥ 80%</Btn>}
      </div>

      <Card pad="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-hair p-3">
          <div className="flex gap-1 rounded-md bg-ink/[0.04] p-0.5">
            {FILTERS.map(([k, l]) => (
              <button key={k} onClick={() => { setFilter(k); setSel(new Set()); }} className={`rounded px-2.5 py-1 text-[11.5px] font-semibold ${filter === k ? "bg-card text-ink shadow-sm" : "text-ink/50 hover:text-ink"}`}>
                {l}{k === "inbox" ? ` (${acct.inbox.length})` : ""}
              </button>
            ))}
          </div>
          <select value={source} onChange={(e) => setSource(e.target.value)} className="rounded-md border border-hair bg-card px-2 py-1.5 text-[12px]">
            <option value="">All sources</option>{Object.entries(SOURCE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="max-w-[200px] rounded-md border border-hair bg-card px-2 py-1.5 text-[12px]">
            <option value="">All categories</option><option value="__none">Uncategorized</option>{CATEGORIES.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search payee, amount…" className="min-w-[160px] flex-1 rounded-md border border-hair bg-white/70 px-2.5 py-1.5 text-[12px] outline-none focus:border-[#ff3c00]/60" />
          <label className="flex items-center gap-1.5 text-[11.5px] text-ink/60"><input type="checkbox" checked={learn} onChange={(e) => setLearn(e.target.checked)} />Learn rules from approvals</label>
        </div>

        {sel.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-hair bg-ink px-3 py-2 text-white">
            <span className="text-[12px] font-semibold">{sel.size} selected</span>
            <Btn kind="flame" busy={busy === "approve"} onClick={() => approveSuggestions(selectedRows)}>Approve suggestions</Btn>
            <select value={bulkCat} onChange={(e) => setBulkCat(e.target.value)} className="rounded-md border border-white/20 bg-white/10 px-2 py-1.5 text-[12px] text-white">
              <option value="" className="text-ink">Set category…</option>{CATEGORIES.map((c) => <option key={c.key} value={c.key} className="text-ink">{c.label}</option>)}
            </select>
            {bulkCat && <Btn onClick={async () => { const list = selectedRows; await bulk({ ...acct.categoryPatch(bulkCat), review_status: "approved" }, "Categorized"); for (const t of list.slice(0, 25)) await learnFrom(t, bulkCat); setBulkCat(""); }}>Apply</Btn>}
            <Btn onClick={() => bulk({ reconciled: true }, "Reconciled")}>Mark reconciled</Btn>
            <Btn onClick={() => bulk({ review_status: "excluded" }, "Excluded")}>Exclude</Btn>
            <ConfirmBtn className="!border-white/25 !bg-transparent !text-white" onConfirm={async () => { const ids = [...sel]; await acct.deleteRows(ids); setSel(new Set()); }}>Delete</ConfirmBtn>
            <button onClick={() => setSel(new Set())} className="ml-auto text-[11.5px] text-white/60 hover:text-white">Clear</button>
          </div>
        )}

        {shown.length === 0 ? (
          <div className="p-4">
            <Empty title={filter === "inbox" ? "Inbox zero" : "No transactions here"} body={acct.ledger.length ? "Change the filters to see more." : "Start with Sync Stripe for revenue, then import a bank CSV (Mercury: Transactions → Export CSV) or connect QuickBooks for the bank feed."} />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-[12.5px]">
              <thead>
                <tr className="border-b border-hair text-ink/45">
                  <th className="w-8 px-3 py-2"><input type="checkbox" checked={allOn} onChange={() => setSel(allOn ? new Set() : new Set(shown.map((t) => t.id)))} /></th>
                  <th className="mono-label px-2 py-2 !text-[9px]">Date</th>
                  <th className="mono-label px-2 py-2 !text-[9px]">Payee</th>
                  <th className="mono-label px-2 py-2 text-right !text-[9px]">Amount</th>
                  <th className="mono-label px-2 py-2 !text-[9px]">Category</th>
                  <th className="mono-label px-2 py-2 !text-[9px]">Suggestion</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {shown.map((t) => {
                  const sug = t.ai_suggestion && CAT[t.ai_suggestion.category] ? t.ai_suggestion : null;
                  return (
                    <tr key={t.id} className={`border-b border-hair/70 align-top transition-colors hover:bg-[#ff3c00]/[0.03] ${t.review_status === "excluded" ? "opacity-45" : ""}`}>
                      <td className="px-3 py-2.5"><input type="checkbox" checked={sel.has(t.id)} onChange={() => toggle(t.id)} /></td>
                      <td className="whitespace-nowrap px-2 py-2.5 font-mono text-[11px] text-ink/60">{t.date}</td>
                      <td className="max-w-[280px] px-2 py-2.5">
                        <button onClick={() => setEditing(t)} className="block max-w-full truncate text-left font-medium text-ink/85 hover:text-[#ff3c00]">{t.payee || t.description || "—"}</button>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1">
                          <Pill>{SOURCE_LABEL[t.source] || t.source}</Pill>
                          {t.account && <span className="truncate text-[10.5px] text-ink/40">{t.account}</span>}
                          {t.reconciled && <Pill tone="good">rec</Pill>}
                          {t.receipt_url && <button onClick={() => openReceipt(t.receipt_url)} className="text-ink/40 hover:text-[#ff3c00]" title="Receipt"><Paperclip className="h-3 w-3" /></button>}
                        </div>
                      </td>
                      <td className={`whitespace-nowrap px-2 py-2.5 text-right font-semibold tabular-nums ${t.direction === "in" ? "text-[#c23000]" : "text-ink/85"}`}>{t.direction === "in" ? "+" : "−"}{money2(t.amount)}</td>
                      <td className="px-2 py-2.5">
                        <select value={t.category || ""} onChange={(e) => setCategory(t, e.target.value)} className={`w-[190px] rounded border px-1.5 py-1 text-[11.5px] ${t.category ? "border-hair bg-card" : "border-[#ff3c00]/40 bg-[#ff3c00]/[0.04]"}`}>
                          {catOptions.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                        </select>
                        {t.form_line && <p className="mt-0.5 font-mono text-[9.5px] text-ink/40">{t.form_line}</p>}
                      </td>
                      <td className="max-w-[240px] px-2 py-2.5">
                        {sug && t.category !== sug.category ? (
                          <button onClick={() => setCategory(t, sug.category)} title={sug.reason} className="group flex max-w-full items-center gap-1.5 rounded border border-dashed border-[#ff3c00]/40 px-1.5 py-1 text-left hover:bg-[#ff3c00]/[0.06]">
                            {sug.by === "rule" ? <Wand2 className="h-3 w-3 shrink-0 text-[#ff3c00]" /> : <Sparkles className="h-3 w-3 shrink-0 text-[#ff3c00]" />}
                            <span className="truncate text-[11px] text-ink/75">{CAT[sug.category].label}</span>
                            <span className="font-mono text-[9.5px] text-ink/40">{Math.round((sug.confidence || 0) * 100)}%</span>
                          </button>
                        ) : <span className="text-[11px] text-ink/25">—</span>}
                        {sug && sug.reason && t.category !== sug.category && <p className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-ink/40">{sug.reason}</p>}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        {t.review_status === "needs_review" && t.category && (
                          <button onClick={() => acct.patchRows([t.id], { review_status: "approved" })} className="rounded border border-hair px-1.5 py-0.5 text-[10.5px] text-ink/55 hover:border-[#ff3c00]/50 hover:text-ink">Approve</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {rows.length > shown.length && <p className="p-3 text-[11px] text-ink/45">Showing the first {shown.length} of {rows.length}. Narrow the filters to see the rest.</p>}
          </div>
        )}
      </Card>

      <Disclaimer compact />
      {editing && <TxEditor tx={editing} acct={acct} onClose={() => setEditing(null)} />}
      {importing && <CsvImport acct={acct} onClose={() => setImporting(false)} />}
    </div>
  );
}
