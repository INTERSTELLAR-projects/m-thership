import { useState } from "react";
import { CheckCircle2, CircleDashed, ExternalLink, Plus, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Btn, Card, ConfirmBtn, Disclaimer, Field, Heading, inputCls, NumberInput, Pill, Select, StatusTag } from "./ui";
import { CATEGORIES, ENTITY_LABEL, money0 } from "./ledger";
import { invokeAccounting } from "./useAccounting";
import { TAX_CONFIG } from "./taxConfig";

const fmtVal = (v) => (typeof v === "number" ? (v < 1 && v > 0 ? `${+(v * 100).toFixed(4)}%` : v.toLocaleString("en-US")) : typeof v === "boolean" ? (v ? "yes" : "no") : typeof v === "string" ? v : JSON.stringify(v));

function ProfileForm({ acct }) {
  const { profile, saveProfile, rawProfile } = acct;
  const { toast } = useToast();
  const [f, setF] = useState(() => ({ ...profile }));
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const save = async () => {
    setBusy(true);
    const keys = ["business_name", "entity_type", "state", "city", "county", "filing_status", "qualifying_children", "other_wages", "other_income", "withholding_federal", "withholding_oregon", "itemized_deductions", "se_health_insurance", "retirement_contributions", "is_sstb", "prior_year_federal_tax", "prior_year_oregon_tax", "prior_year_agi", "in_sctd_district", "in_metro_district", "cash_balance_manual", "reserve_account_name", "scorp_payroll_service_cost", "scorp_extra_prep_cost", "s_corp_salary"];
    const patch = Object.fromEntries(keys.map((k) => [k, f[k] === "" ? null : f[k]]));
    await saveProfile({ ...patch, completed: true });
    setBusy(false);
    toast({ title: "Business profile saved", description: "Every projection now uses these facts." });
  };
  const yes = [["true", "Yes"], ["false", "No"]];
  return (
    <Card title="Business profile" sub={rawProfile && rawProfile.completed ? "Saved. Change anything and save again." : "Not filled in yet — the center is assuming a single-member LLC taxed as a sole proprietor, filing single."}
      right={rawProfile && rawProfile.completed ? <Pill tone="good">complete</Pill> : <Pill tone="flame">assumed</Pill>}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Business name"><input className={inputCls} value={f.business_name || ""} onChange={(e) => set("business_name", e.target.value)} /></Field>
        <Field label="Entity / tax treatment" className="lg:col-span-2"><Select value={f.entity_type} onChange={(v) => set("entity_type", v)} options={Object.entries(ENTITY_LABEL)} /></Field>
        <Field label="State"><Select value={f.state} onChange={(v) => set("state", v)} options={[["OR", "Oregon"]]} /></Field>
        <Field label="City"><input className={inputCls} value={f.city || ""} onChange={(e) => set("city", e.target.value)} /></Field>
        <Field label="Filing status"><Select value={f.filing_status} onChange={(v) => set("filing_status", v)} options={[["single", "Single"], ["mfj", "Married filing jointly"], ["mfs", "Married filing separately"], ["hoh", "Head of household"]]} /></Field>
        <Field label="Qualifying children under 17" hint="Child tax credit (2026 amount needs confirmation)."><NumberInput value={f.qualifying_children} onChange={(v) => set("qualifying_children", v || 0)} /></Field>
        <Field label="Other household W-2 wages" hint="Spouse or other jobs (optional)."><NumberInput value={f.other_wages} onChange={(v) => set("other_wages", v || 0)} /></Field>
        <Field label="Other household income" hint="Interest, rentals, etc. (optional)."><NumberInput value={f.other_income} onChange={(v) => set("other_income", v || 0)} /></Field>
        <Field label="Federal withholding (W-2s)"><NumberInput value={f.withholding_federal} onChange={(v) => set("withholding_federal", v || 0)} /></Field>
        <Field label="Oregon withholding (W-2s)"><NumberInput value={f.withholding_oregon} onChange={(v) => set("withholding_oregon", v || 0)} /></Field>
        <Field label="Itemized deductions (if more than standard)"><NumberInput value={f.itemized_deductions} onChange={(v) => set("itemized_deductions", v || 0)} /></Field>
        <Field label="Self-employed health insurance premiums"><NumberInput value={f.se_health_insurance} onChange={(v) => set("se_health_insurance", v || 0)} /></Field>
        <Field label="SEP / Solo 401(k) contributions"><NumberInput value={f.retirement_contributions} onChange={(v) => set("retirement_contributions", v || 0)} /></Field>
        <Field label="Specified service business (SSTB)?" hint="Web design/dev is generally not an SSTB; pure consulting can be. Matters only above the QBI threshold."><Select value={String(!!f.is_sstb)} onChange={(v) => set("is_sstb", v === "true")} options={yes} /></Field>
        <Field label={`Prior-year total federal tax (${acct.taxYear - 1})`} hint="Form 1040 'total tax' line. Unlocks the 100%/110% safe harbor."><NumberInput value={f.prior_year_federal_tax} onChange={(v) => set("prior_year_federal_tax", v)} /></Field>
        <Field label={`Prior-year Oregon tax (${acct.taxYear - 1})`} hint="OR-40 tax after credits."><NumberInput value={f.prior_year_oregon_tax} onChange={(v) => set("prior_year_oregon_tax", v)} /></Field>
        <Field label={`Prior-year AGI (${acct.taxYear - 1})`} hint="Over $150,000 → 110% federal safe harbor."><NumberInput value={f.prior_year_agi} onChange={(v) => set("prior_year_agi", v)} /></Field>
        <Field label="Business inside the South Clackamas Transportation District?" hint="Molalla is SCTD's home; confirm your address with SCTD."><Select value={String(!!f.in_sctd_district)} onChange={(v) => set("in_sctd_district", v === "true")} options={yes} /></Field>
        <Field label="Live inside the Metro district?" hint="Molalla is outside Metro. Yes only if you moved."><Select value={String(!!f.in_metro_district)} onChange={(v) => set("in_metro_district", v === "true")} options={yes} /></Field>
        <Field label="Cash on hand (if QuickBooks not connected)"><NumberInput value={f.cash_balance_manual} onChange={(v) => set("cash_balance_manual", v)} /></Field>
        <Field label="S-corp what-if: payroll service $/yr" hint="Your assumption."><NumberInput value={f.scorp_payroll_service_cost} onChange={(v) => set("scorp_payroll_service_cost", v || 0)} /></Field>
        <Field label="S-corp what-if: extra return prep $/yr" hint="Your assumption (Form 1120-S)."><NumberInput value={f.scorp_extra_prep_cost} onChange={(v) => set("scorp_extra_prep_cost", v || 0)} /></Field>
      </div>
      <p className="mt-3 text-[11px] text-ink/45">Estimated payments already made are recorded on the Tax plan tab (or picked up automatically from IRS / Oregon DOR rows in your bank imports).</p>
      <div className="mt-4 flex justify-end"><Btn kind="flame" busy={busy} onClick={save}>Save profile</Btn></div>
    </Card>
  );
}

function Connections({ acct }) {
  const { profile, saveProfile } = acct;
  const { toast } = useToast();
  const [busy, setBusy] = useState("");
  const [qbo, setQbo] = useState(null);
  const [realm, setRealm] = useState(profile.qbo_realm_id || "");
  const snap = profile.qbo_snapshot;

  const check = async () => {
    setBusy("check");
    const res = await invokeAccounting("qbo_status", {});
    setQbo(res);
    setBusy("");
  };
  const sync = async () => {
    setBusy("sync");
    if (realm && realm !== profile.qbo_realm_id) await saveProfile({ qbo_realm_id: realm });
    const res = await invokeAccounting("qbo_sync", { tax_year: acct.taxYear, realm_id: realm || undefined });
    setBusy("");
    if (res.error) toast({ title: "QuickBooks sync failed", description: res.error, variant: "destructive" });
    else if (!res.connected) toast({ title: "Not connected yet", description: res.reason });
    else if (res.needs_realm) toast({ title: "Company id needed", description: res.reason });
    else { toast({ title: `QuickBooks synced: ${res.created} new rows` }); acct.reload(); }
  };

  return (
    <Card title="Connections" sub="Read-only. Nothing here can move money or change your bank, Stripe or QuickBooks.">
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-md border border-hair p-4">
          <div className="flex items-center gap-2">{profile.stripe_synced_at ? <CheckCircle2 className="h-4 w-4 text-[#ff3c00]" /> : <CircleDashed className="h-4 w-4 text-ink/30" />}<p className="text-[13px] font-semibold">Stripe (revenue)</p></div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink/60">Uses the app's existing Stripe key. Each payment becomes a revenue row (Schedule C line 1), refunds line 2, processing fees line 10. Payouts are skipped so bank deposits are never double counted.</p>
          <p className="mt-2 text-[11px] text-ink/45">{profile.stripe_synced_at ? `Last sync ${new Date(profile.stripe_synced_at).toLocaleString()}` : "Never synced"}</p>
          <div className="mt-3"><Btn busy={busy === "stripe"} onClick={async () => { setBusy("stripe"); const r = await invokeAccounting("sync_stripe", { tax_year: acct.taxYear }); setBusy(""); if (r.error) toast({ title: "Stripe sync failed", description: r.error, variant: "destructive" }); else { toast({ title: `Stripe: ${r.created || 0} new rows` }); acct.reload(); } }}>Sync now</Btn></div>
        </div>

        <div className="rounded-md border-2 border-ink p-4">
          <div className="flex items-center gap-2">{snap ? <CheckCircle2 className="h-4 w-4 text-[#ff3c00]" /> : <CircleDashed className="h-4 w-4 text-ink/30" />}<p className="text-[13px] font-semibold">Connect QuickBooks (bank feed)</p></div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink/60">QuickBooks Online links to your business bank and cards and pulls transactions daily. Møthership then reads accounts, the P&L, the balance sheet and every transaction.</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4 text-[11.5px] text-ink/65">
            <li>In QuickBooks Online: Transactions → Bank transactions → Link account, and connect Mercury / your bank.</li>
            <li>Authorize the QuickBooks connector for Møthership (Justin signs in to Intuit once; read access to accounting data).</li>
            <li>Click Check, then Sync. If no company id comes back, paste it below (QuickBooks → gear → Account and settings → Billing &amp; subscription → Company ID).</li>
          </ol>
          <Field label="QuickBooks company (realm) id" className="mt-3"><input className={inputCls} value={realm} onChange={(e) => setRealm(e.target.value)} placeholder="optional" /></Field>
          <div className="mt-3 flex gap-2"><Btn busy={busy === "check"} onClick={check}>Check</Btn><Btn kind="ink" busy={busy === "sync"} onClick={sync}>Sync</Btn></div>
          {qbo && <p className={`mt-2 text-[11.5px] ${qbo.connected ? "text-emerald-800" : "text-[#c23000]"}`}>{qbo.connected ? `Connected${qbo.realm ? ` · company ${qbo.realm}` : " · company id missing"}` : `Not connected: ${qbo.reason || qbo.error || "authorize the connector first"}`}</p>}
          {snap && (
            <div className="mt-3 space-y-1 border-t border-hair pt-3 text-[11.5px]">
              <p className="text-ink/45">Snapshot {new Date(snap.at).toLocaleString()}</p>
              {(snap.accounts || []).filter((a) => a.type === "Bank" || a.type === "Credit Card").map((a) => <div key={a.id} className="flex justify-between"><span>{a.name}</span><span className="tabular-nums">{money0(a.balance)}</span></div>)}
              {snap.pl && snap.pl.net != null && <div className="flex justify-between font-semibold"><span>QuickBooks net income YTD</span><span className="tabular-nums">{money0(snap.pl.net)}</span></div>}
              {snap.bs && snap.bs.assets != null && <div className="flex justify-between text-ink/60"><span>Assets / liabilities / equity</span><span className="tabular-nums">{money0(snap.bs.assets)} / {money0(snap.bs.liabilities)} / {money0(snap.bs.equity)}</span></div>}
            </div>
          )}
        </div>

        <div className="rounded-md border border-hair p-4">
          <div className="flex items-center gap-2">{profile.last_csv_import_at ? <CheckCircle2 className="h-4 w-4 text-[#ff3c00]" /> : <CircleDashed className="h-4 w-4 text-ink/30" />}<p className="text-[13px] font-semibold">Bank CSV (no subscription)</p></div>
          <p className="mt-2 text-[12px] leading-relaxed text-ink/60">The free fallback. Export a CSV from Mercury (Transactions → Export) or any bank and import it on the Transactions tab. Re-importing overlapping dates is safe: duplicates are skipped, scheduled bills are matched and replaced, rules and AI categorize the rest.</p>
          <p className="mt-2 text-[11px] text-ink/45">Direct bank links (Plaid) aren't available as a Base44 connector, which is why QuickBooks or CSV is the bank path.</p>
        </div>
      </div>
    </Card>
  );
}

function Rules({ acct }) {
  const [n, setN] = useState({ pattern: "", category: "software", direction: "any" });
  const catOpts = CATEGORIES.map((c) => [c.key, c.label]);
  const sorted = [...acct.rules].sort((a, b) => (b.learned ? 1 : 0) - (a.learned ? 1 : 0) || (a.priority ?? 50) - (b.priority ?? 50));
  return (
    <Card title="Categorization rules" sub="Payee text → category. Learned rules (from your approvals) and system rules with priority ≤ 10 categorize automatically; other rules only suggest.">
      <div className="grid grid-cols-[1.4fr_1.4fr_110px_auto] items-end gap-2">
        <Field label="Payee contains"><input className={inputCls} value={n.pattern} onChange={(e) => setN({ ...n, pattern: e.target.value })} placeholder="adobe" /></Field>
        <Field label="Category"><Select value={n.category} onChange={(v) => setN({ ...n, category: v })} options={catOpts} /></Field>
        <Field label="Direction"><Select value={n.direction} onChange={(v) => setN({ ...n, direction: v })} options={[["any", "Any"], ["out", "Out"], ["in", "In"]]} /></Field>
        <Btn kind="ink" onClick={async () => { if (!n.pattern.trim()) return; await acct.addRule({ ...n, pattern: n.pattern.trim().toLowerCase(), learned: true, priority: 30 }); setN({ ...n, pattern: "" }); }}><Plus className="h-3.5 w-3.5" />Add</Btn>
      </div>
      <div className="mt-3 max-h-80 overflow-y-auto">
        <table className="w-full text-[12px]">
          <tbody>
            {sorted.map((r) => (
              <tr key={r.id} className={`border-b border-hair/60 ${r.active === false ? "opacity-40" : ""}`}>
                <td className="py-1.5 font-mono text-[11.5px]">{r.pattern}</td>
                <td className="py-1.5"><select value={r.category} onChange={(e) => acct.updateRule(r.id, { category: e.target.value })} className="w-full max-w-[220px] rounded border border-hair bg-card px-1 py-0.5 text-[11.5px]">{catOpts.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></td>
                <td className="py-1.5 text-ink/45">{r.direction || "any"}</td>
                <td className="py-1.5">{r.learned ? <Pill tone="flame">learned</Pill> : <Pill>p{r.priority ?? 50}</Pill>}</td>
                <td className="py-1.5 text-right">
                  <button onClick={() => acct.updateRule(r.id, { active: r.active === false })} className="mr-2 text-[11px] text-ink/50 hover:text-ink">{r.active === false ? "Enable" : "Disable"}</button>
                  <button onClick={() => acct.deleteRule(r.id)} className="text-ink/30 hover:text-red-700"><Trash2 className="inline h-3 w-3" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function TaxFigures({ acct }) {
  const { profile, saveProfile, cfg } = acct;
  const { toast } = useToast();
  const [editing, setEditing] = useState(null);
  const [text, setText] = useState("");
  const overrides = profile.config_overrides || {};
  const saveOverride = async (key, val) => {
    const next = { ...overrides };
    if (val === undefined) delete next[key]; else next[key] = val;
    await saveProfile({ config_overrides: next });
  };
  const nc = Object.values(TAX_CONFIG).filter((e) => e.status === "needs_confirmation").length;
  return (
    <Card title="Tax figures" sub={`Every rate and threshold the engine uses, with its tax year and source. ${nc} figures are marked "needs confirmation" — override any of them once confirmed.`}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-[12px]">
          <thead><tr className="text-left text-ink/45"><th className="mono-label py-1.5 !text-[9px]">Figure</th><th className="mono-label py-1.5 !text-[9px]">Value</th><th className="mono-label py-1.5 !text-[9px]">Year</th><th className="mono-label py-1.5 !text-[9px]">Status</th><th className="mono-label py-1.5 !text-[9px]">Source</th><th /></tr></thead>
          <tbody>
            {Object.entries(cfg).map(([k, e]) => (
              <tr key={k} className="border-t border-hair/60 align-top">
                <td className="max-w-[300px] py-2 pr-3 text-ink/80">{e.label}{e.note && <p className="mt-0.5 text-[10.5px] text-ink/45">{e.note}</p>}</td>
                <td className="max-w-[220px] break-words py-2 pr-3 font-mono text-[11px]">
                  {editing === k ? (
                    <div className="space-y-1">
                      <textarea rows={2} className={`${inputCls} font-mono !text-[11px]`} value={text} onChange={(ev) => setText(ev.target.value)} />
                      <div className="flex gap-1">
                        <Btn kind="ink" className="!px-2 !py-1" onClick={async () => { try { await saveOverride(k, JSON.parse(text)); setEditing(null); toast({ title: "Override saved" }); } catch { toast({ title: "Use JSON: a number, [list] or {object}", variant: "destructive" }); } }}>Save</Btn>
                        <Btn className="!px-2 !py-1" onClick={() => setEditing(null)}>Cancel</Btn>
                      </div>
                    </div>
                  ) : (<>{fmtVal(e.value)}{e.overridden && <span className="ml-1"><Pill tone="flame">override</Pill></span>}</>)}
                </td>
                <td className="py-2 pr-3">{e.year}</td>
                <td className="py-2 pr-3"><StatusTag status={e.status} /></td>
                <td className="max-w-[220px] py-2 pr-3"><a href={e.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-[10.5px] text-[#ff3c00] hover:underline">{e.source}<ExternalLink className="mt-0.5 h-3 w-3 shrink-0" /></a></td>
                <td className="whitespace-nowrap py-2 text-right">
                  <button onClick={() => { setEditing(k); setText(JSON.stringify(e.value)); }} className="text-[11px] text-ink/50 hover:text-ink">Override</button>
                  {e.overridden && <button onClick={() => saveOverride(k, undefined)} className="ml-2 text-[11px] text-ink/50 hover:text-ink">Reset</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Reminders({ acct }) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Card title="Automations" sub="Workflow “Accounting reminders” runs daily at 7:43 am Pacific.">
      <ul className="space-y-1.5 text-[12px] text-ink/65">
        <li>• 14 days before each estimated-tax due date: a priority task (shows in the Command Briefing and Tasks) plus an in-app alert with the planned IRS and Oregon amounts.</li>
        <li>• On the 1st of each month: a “Monthly books close” task due the 5th, plus an alert.</li>
        <li>• Never pays, files or emails anything.</li>
      </ul>
      <div className="mt-3 flex items-center gap-2">
        <Btn busy={busy} onClick={async () => { setBusy(true); const r = await invokeAccounting("run_reminders", {}); setBusy(false); if (r.error) toast({ title: "Run failed", description: r.error, variant: "destructive" }); else { toast({ title: r.created && r.created.length ? `Created: ${r.created.join(", ")}` : "Nothing due right now" }); acct.reload(); } }}>Run now</Btn>
      </div>
      <div className="mt-3 space-y-1">
        {acct.alerts.slice(0, 8).map((a) => (
          <div key={a.id} className="flex items-center justify-between gap-2 border-b border-hair/60 py-1 text-[11.5px]">
            <span className="truncate text-ink/70">{a.title}</span>
            <span className="flex items-center gap-2"><Pill>{a.status}</Pill><ConfirmBtn className="!px-1.5 !py-0.5" confirmText="Sure?" onConfirm={() => acct.dismissAlert(a.id)}>Dismiss</ConfirmBtn></span>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function SettingsTab({ acct }) {
  return (
    <div className="space-y-5">
      <Heading title="Settings" accent="connections" sub="The facts the tax engine needs, where the numbers come from, and how transactions get categorized." />
      <ProfileForm acct={acct} />
      <Connections acct={acct} />
      <div className="grid gap-4 xl:grid-cols-2"><Rules acct={acct} /><Reminders acct={acct} /></div>
      <TaxFigures acct={acct} />
      <Disclaimer />
    </div>
  );
}
