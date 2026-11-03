import { useMemo, useState } from "react";
import { ExternalLink, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Bar, Btn, Card, Disclaimer, Field, Heading, inputCls, NumberInput, Pill, Select, SourceLink, StatusTag } from "./ui";
import { money0, pct } from "./ledger";
import { scorpCompare } from "./taxEngine";
import { DUE_DATES } from "./taxConfig";

const fmt = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

function Row({ label, value, sub, strong, neg, indent }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 border-b border-hair/60 py-1.5 ${strong ? "font-semibold text-ink" : "text-ink/75"}`}>
      <span className={`text-[12.5px] ${indent ? "pl-4 text-ink/55" : ""}`}>{label}{sub && <span className="ml-2 text-[10.5px] font-normal text-ink/40">{sub}</span>}</span>
      <span className="text-[12.5px] tabular-nums">{neg ? "−" : ""}{money0(value)}</span>
    </div>
  );
}

function QuarterTable({ q, label }) {
  return (
    <Card title={label} sub={q.usingPrior ? `Safe harbor uses the prior-year rule (${money0(q.byPrior)}) — lower than 90% of this year (${money0(q.byCurrent)}).` : q.byPrior == null ? "Prior-year tax not entered: safe harbor = 90% of this year's projected tax." : `Safe harbor uses 90% of this year (${money0(q.byCurrent)}).`}
      right={q.mustPay ? <Pill tone="flame">estimates required</Pill> : <Pill>under ${q.threshold.toLocaleString()} threshold</Pill>}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-[12px]">
          <thead><tr className="text-left text-ink/45"><th className="mono-label py-1.5 !text-[9px]">Due</th><th className="mono-label py-1.5 !text-[9px]">Covers</th><th className="mono-label py-1.5 text-right !text-[9px]">Safe-harbor cum.</th><th className="mono-label py-1.5 text-right !text-[9px]">Paid in period</th><th className="mono-label py-1.5 text-right !text-[9px]">Status</th></tr></thead>
          <tbody>
            {q.rows.map((r) => {
              const behind = r.cumSafe - r.paidCum;
              return (
                <tr key={r.q} className={`border-t border-hair/60 ${q.next && q.next.q === r.q ? "bg-[#ff3c00]/[0.05]" : ""}`}>
                  <td className="py-2 font-medium">Q{r.q} · {fmt(r.date)}</td>
                  <td className="py-2 text-ink/50">{r.covers}</td>
                  <td className="py-2 text-right tabular-nums">{money0(r.cumSafe)}</td>
                  <td className="py-2 text-right tabular-nums">{money0(r.paidThisPeriod)}</td>
                  <td className="py-2 text-right">{r.past ? (behind > 1 ? <Pill tone="warn">short {money0(behind)}</Pill> : <Pill tone="good">on track</Pill>) : q.next && q.next.q === r.q ? <Pill tone="flame">next</Pill> : <Pill>upcoming</Pill>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {q.next && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="rounded-md bg-ink/[0.04] p-3"><p className="mono-label !text-[9px] text-ink/45">Pay by {fmt(q.next.date)} — safe harbor</p><p className="mt-1 text-xl font-semibold tabular-nums">{money0(q.nextSafe)}</p><p className="text-[10.5px] text-ink/45">Catches up to the cumulative safe-harbor amount; avoids the underpayment penalty.</p></div>
          <div className="rounded-md bg-ink/[0.04] p-3"><p className="mono-label !text-[9px] text-ink/45">Pay to cover projected tax</p><p className="mt-1 text-xl font-semibold tabular-nums">{money0(q.nextActual)}</p><p className="text-[10.5px] text-ink/45">Spreads the full projected bill over the remaining dates; smaller balance due at filing.</p></div>
        </div>
      )}
    </Card>
  );
}

export default function TaxPlanTab({ acct, go }) {
  const { plan, profile, cfg, saveProfile } = acct;
  const { toast } = useToast();
  const t = plan.tax;
  const [pay, setPay] = useState({ date: new Date().toISOString().slice(0, 10), jurisdiction: "federal", amount: null, tax_year: acct.taxYear });
  const [reserve, setReserve] = useState(profile.reserve_balance ?? 0);
  const np = Math.max(0, plan.proj.fullNet);
  const [salaryPct, setSalaryPct] = useState(() => (profile.s_corp_salary && np ? Math.round((profile.s_corp_salary / np) * 100) : 45));
  const salary = Math.round((np * salaryPct) / 100);
  const sc = useMemo(() => scorpCompare(np, profile, cfg, salary), [np, profile, cfg, salary]);

  const addPayment = async () => {
    if (!pay.amount || !pay.date) { toast({ title: "Enter a date and amount" }); return; }
    const list = [...(profile.estimated_payments || []), { ...pay, amount: Number(pay.amount), note: "recorded in Møthership" }];
    await saveProfile({ estimated_payments: list });
    setPay({ ...pay, amount: null });
    toast({ title: "Payment recorded" });
  };
  const removePayment = async (i) => {
    const list = (profile.estimated_payments || []).filter((_, idx) => idx !== i);
    await saveProfile({ estimated_payments: list });
  };

  return (
    <div className="space-y-5">
      <Heading title="Tax" accent="plan" sub="Full-year projection, what you owe, when, and how much to set aside. Change the projection method any time."
        right={
          <div className="flex gap-1 rounded-md border border-hair bg-card p-1">
            {[["run_rate", "Run-rate"], ["annualized", "Annualized"]].map(([k, l]) => (
              <button key={k} onClick={() => saveProfile({ projection_method: k })} className={`rounded px-2.5 py-1 text-[11.5px] font-semibold ${profile.projection_method === k ? "bg-ink text-white" : "text-ink/55"}`}>{l}</button>
            ))}
          </div>
        } />
      <p className="-mt-2 text-[11.5px] text-ink/50">
        Run-rate = actual year-to-date + the average of the last 3 complete months for the rest of the year. Annualized = year-to-date ÷ share of the year elapsed ({pct(plan.proj.frac, 0)}).
        {plan.proj.used === "annualized" && profile.projection_method === "run_rate" ? " Not enough complete months yet, so annualized is used." : ""}
      </p>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3" title={`${acct.taxYear} projection — ${t.mode === "schedule_c" ? "Schedule C" : t.mode}`} sub="Estimate. Every figure traces to Settings › Tax figures.">
          <Row label="Projected revenue (net of refunds)" value={plan.proj.fullGross} />
          <Row label="Projected deductible expenses" value={plan.proj.fullExp} neg sub="incl. mileage, home office, depreciation" />
          <Row label="Net profit (Schedule C line 31)" value={t.netProfit} strong />
          <p className="mono-label mt-4 !text-[9.5px] text-ink/45">Federal</p>
          <Row label="Self-employment tax (Schedule SE)" value={t.seTax} sub={`${money0(t.seSS)} SS + ${money0(t.seMed)} Medicare on ${money0(t.nese)}`} />
          <Row indent label="Half of SE tax deducted (Schedule 1)" value={t.halfSe} neg />
          {t.seHealth > 0 && <Row indent label="Self-employed health insurance" value={t.seHealth} neg />}
          {t.retirement > 0 && <Row indent label="Retirement contributions" value={t.retirement} neg />}
          <Row label="Adjusted gross income" value={t.agi} />
          <Row indent label={t.itemized > t.stdDed ? "Itemized deductions" : "Standard deduction"} value={t.deduction} neg />
          <Row indent label="QBI deduction (Form 8995)" value={t.qbi} neg sub={t.qbiNote} />
          <Row label="Taxable income" value={t.taxable} />
          <Row label="Federal income tax" value={t.incomeTax} sub={`${pct(t.fedMarginal, 0)} bracket`} />
          {t.ctc > 0 && <Row indent label="Child tax credit (non-refundable part)" value={t.ctc} neg />}
          {t.addlMedicare > 0 && <Row label="Additional Medicare tax (Form 8959)" value={t.addlMedicare} />}
          <Row label="Federal total" value={t.federalTotal} strong />
          <p className="mono-label mt-4 !text-[9.5px] text-ink/45">Oregon</p>
          <Row indent label="Oregon standard deduction" value={t.orStd} neg />
          <Row indent label="Federal tax subtraction" value={t.fedSub} neg sub="phase-out bands assumed = 2025" />
          <Row label="Oregon taxable income" value={t.orTaxable} />
          <Row label="Oregon tax" value={t.orTaxRaw} sub={`${pct(t.orMarginal, 2)} bracket`} />
          {t.exCredit > 0 && <Row indent label="Personal exemption credit" value={t.exCredit} neg />}
          <Row label="Oregon total" value={t.oregonTotal} strong />
          <p className="mono-label mt-4 !text-[9.5px] text-ink/45">Local</p>
          <Row label="SCTD self-employment tax (Molalla)" value={t.sctd} sub={profile.in_sctd_district ? "0.5% — needs confirmation" : "off in Settings"} />
          {t.metroTax > 0 && <Row label="Metro SHS tax" value={t.metroTax} />}
          <div className="mt-3 flex items-baseline justify-between rounded-md bg-ink px-3 py-2.5 text-white">
            <span className="text-[13px] font-semibold">Total projected tax</span>
            <span className="text-[20px] font-semibold tabular-nums flame-text">{money0(t.total)}</span>
          </div>
          <p className="mt-2 text-[11px] text-ink/45">Effective rate {pct(plan.effectiveRate)} of profit. Annualized method would give {money0(plan.taxAnnualized.total)}.</p>
        </Card>

        <div className="space-y-4 lg:col-span-2">
          <Card dark title="Set aside">
            <p className="text-[56px] font-semibold leading-none tracking-[-0.05em] flame-text">{Math.ceil(plan.setAsidePct * 100)}%</p>
            <p className="mt-2 text-[12px] text-white/60">of every payment that lands (tax ÷ projected revenue). Marginal: {pct(plan.marginal, 0)} of each extra dollar of profit.</p>
          </Card>
          <Card title="Tax reserve" sub="Money parked for taxes vs what has accrued so far this year.">
            <div className="flex items-baseline justify-between"><span className="text-[12px] text-ink/55">Needed now</span><span className="text-lg font-semibold tabular-nums">{money0(plan.neededInReserve)}</span></div>
            <p className="text-[10.5px] text-ink/40">{money0(plan.accrued)} accrued on {money0(plan.proj.ytdNet)} profit YTD − {money0(plan.totalPaid)} paid.</p>
            <Bar value={plan.reserveFunded} className="my-3" />
            <div className="flex items-end gap-2">
              <Field label="Reserve balance" className="flex-1"><NumberInput value={reserve} onChange={setReserve} /></Field>
              <Btn kind="ink" onClick={() => saveProfile({ reserve_balance: Number(reserve) || 0 })}>Save</Btn>
            </div>
            <p className="mt-2 text-[10.5px] text-ink/45">{Math.round(plan.reserveFunded * 100)}% funded. Tip: a separate Mercury account named "Tax reserve"; Møthership never moves the money.</p>
          </Card>
          <Card title="Record an estimated payment" sub="Payments to the IRS / Oregon found in bank imports count automatically.">
            <div className="grid grid-cols-2 gap-2">
              <Field label="Date"><input type="date" className={inputCls} value={pay.date} onChange={(e) => setPay({ ...pay, date: e.target.value })} /></Field>
              <Field label="Amount"><NumberInput value={pay.amount} onChange={(v) => setPay({ ...pay, amount: v })} /></Field>
              <Field label="To"><Select value={pay.jurisdiction} onChange={(v) => setPay({ ...pay, jurisdiction: v })} options={[["federal", "IRS (1040-ES)"], ["oregon", "Oregon (OR-40-V)"]]} /></Field>
              <Field label="Tax year"><Select value={String(pay.tax_year)} onChange={(v) => setPay({ ...pay, tax_year: Number(v) })} options={[String(acct.taxYear - 1), String(acct.taxYear), String(acct.taxYear + 1)]} /></Field>
            </div>
            <div className="mt-3 flex justify-end"><Btn kind="flame" onClick={addPayment}>Record</Btn></div>
            <ul className="mt-3 space-y-1">
              {plan.payments.map((p, i) => (
                <li key={`${p.date}-${i}`} className="flex items-center justify-between gap-2 text-[12px]">
                  <span className="text-ink/70">{fmt(p.date)} · {p.jurisdiction === "oregon" ? "Oregon" : "IRS"} {p.origin === "ledger" && <Pill>bank</Pill>}</span>
                  <span className="flex items-center gap-2 tabular-nums">{money0(p.amount)}
                    {p.origin === "manual" && <button onClick={() => removePayment((profile.estimated_payments || []).findIndex((x) => x.date === p.date && Number(x.amount) === p.amount && x.jurisdiction === p.jurisdiction))} className="text-ink/30 hover:text-red-700"><Trash2 className="h-3 w-3" /></button>}
                  </span>
                </li>
              ))}
              {!plan.payments.length && <li className="text-[11.5px] text-ink/40">No {acct.taxYear} payments recorded.</li>}
            </ul>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
              <a className="inline-flex items-center gap-1 text-[#ff3c00] hover:underline" href="https://www.irs.gov/payments/direct-pay" target="_blank" rel="noreferrer">IRS Direct Pay <ExternalLink className="h-3 w-3" /></a>
              <a className="inline-flex items-center gap-1 text-[#ff3c00] hover:underline" href="https://revenueonline.dor.oregon.gov/" target="_blank" rel="noreferrer">Oregon Revenue Online <ExternalLink className="h-3 w-3" /></a>
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <QuarterTable q={plan.fed} label={`Federal 1040-ES · ${money0(plan.fed.projectedTax)} projected`} />
        <QuarterTable q={plan.or} label={`Oregon OR-40-V · ${money0(plan.or.projectedTax)} projected`} />
      </div>
      <p className="text-[11px] text-ink/45">
        Due dates: {DUE_DATES[acct.taxYear] ? DUE_DATES[acct.taxYear].source : "not configured for this year"}{DUE_DATES[acct.taxYear] && DUE_DATES[acct.taxYear].status !== "verified" ? " (needs confirmation)" : ""}.
        Safe harbor: pay the smaller of 90% of this year's tax or 100% of last year's (110% if last year's AGI was over $150,000) — {profile.prior_year_federal_tax == null ? <button className="text-[#ff3c00] hover:underline" onClick={() => go("settings")}>enter last year's tax to use the prior-year rule</button> : "prior-year figures entered"}. <SourceLink entry={cfg.safe_harbor_high_income_pct} />
      </p>

      <Card title="S-corp election — what-if" sub="ESTIMATE ONLY. Compares staying a Schedule C LLC with electing S-corp status at the salary you choose."
        right={<Pill tone={sc.savings > 0 ? "flame" : "ink"}>{sc.savings > 0 ? `saves ≈ ${money0(sc.savings)}/yr` : `costs ≈ ${money0(-sc.savings)}/yr`}</Pill>}>
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Field label={`Owner salary: ${money0(salary)} (${salaryPct}% of ${money0(np)} profit)`}>
              <input type="range" min={10} max={100} value={salaryPct} onChange={(e) => setSalaryPct(Number(e.target.value))} className="w-full accent-[#ff3c00]" />
            </Field>
            <p className="mt-3 text-[11.5px] leading-relaxed text-ink/55">
              The IRS requires a <b>reasonable salary</b> for the work you do before any distributions; a low salary is the most-audited part of an S-corp. Common practice puts it near what you'd pay someone else to do the job. The rest comes out as distributions free of SE tax. Elections are made on Form 2553 (and Oregon follows the federal election).
            </p>
            <div className="mt-3 flex items-end gap-2">
              <Btn onClick={() => saveProfile({ s_corp_salary: salary })}>Save this salary</Btn>
            </div>
          </div>
          <div className="lg:col-span-3">
            <table className="w-full text-[12px]">
              <thead><tr className="text-left text-ink/45"><th className="mono-label py-1.5 !text-[9px]" /><th className="mono-label py-1.5 text-right !text-[9px]">Schedule C</th><th className="mono-label py-1.5 text-right !text-[9px]">S-corp</th></tr></thead>
              <tbody className="tabular-nums">
                {[
                  ["Self-employment tax", sc.sole.seTax, 0],
                  ["Payroll FICA (employer + employee)", 0, sc.sc.payroll ? sc.sc.payroll.employer.fica + sc.sc.payroll.employee.fica : 0],
                  ["FUTA + Oregon UI + Paid Leave + transit", 0, sc.sc.payroll ? sc.sc.payroll.employer.futa + sc.sc.payroll.employer.or_ui + sc.sc.payroll.employer.paid_leave + sc.sc.payroll.employee.paid_leave + sc.sc.payroll.employee.transit : 0],
                  ["Federal income tax", sc.sole.fedIncomeTax + sc.sole.addlMedicare, sc.sc.fedIncomeTax + sc.sc.addlMedicare],
                  ["Oregon income tax", sc.sole.oregonTotal, sc.sc.oregonTotal],
                  ["SCTD (SE tax vs payroll tax)", sc.sole.sctd, sc.sc.sctd],
                  ["Oregon S-corp minimum tax", 0, sc.sc.payroll ? sc.sc.payroll.costs.or_minimum : 0],
                  ["Payroll service + extra return prep", 0, sc.sc.extraCosts],
                ].map(([l, a, b]) => (
                  <tr key={l} className="border-t border-hair/60"><td className="py-1.5 text-ink/65">{l}</td><td className="py-1.5 text-right">{money0(a)}</td><td className="py-1.5 text-right">{money0(b)}</td></tr>
                ))}
                <tr className="border-t-2 border-ink font-semibold"><td className="py-2">All-in</td><td className="py-2 text-right">{money0(sc.sole.allIn)}</td><td className="py-2 text-right">{money0(sc.sc.allIn)}</td></tr>
              </tbody>
            </table>
            <p className="mt-2 text-[10.5px] leading-relaxed text-ink/45">
              K-1 income {money0(sc.sc.payroll ? sc.sc.payroll.k1 : 0)}; QBI limited by W-2 wages above the threshold. Payroll service ({money0(profile.scorp_payroll_service_cost)}) and extra prep ({money0(profile.scorp_extra_prep_cost)}) are your assumptions (Settings). Oregon UI, Paid Leave split, statewide transit, FUTA and the $150 minimum are marked "needs confirmation".
            </p>
          </div>
        </div>
      </Card>

      <Card title="Oregon & local items" sub="What applies to a Molalla (Clackamas County) business, and what doesn't.">
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["Oregon personal income tax", "Applies", cfg.or_brackets_single],
            ["Oregon estimated payments (OR-40-V)", plan.or.mustPay ? "Required (≥ $1,000 expected)" : "Not required yet", cfg.or_est_required_threshold],
            ["Corporate Activity Tax (CAT)", plan.cat.mustRegister ? "Register now" : `Not yet — ${money0(plan.cat.projected)} of ${money0(plan.cat.register)}`, cfg.or_cat],
            ["South Clackamas Transportation District SE tax", profile.in_sctd_district ? "Likely applies (Molalla is SCTD's home)" : "Turned off", cfg.sctd_se_rate],
            ["TriMet self-employment tax", "Not applicable (Molalla left TriMet in 1989)", cfg.trimet_applies],
            ["Metro Supportive Housing Services tax", profile.in_metro_district ? "Applies (set in Settings)" : "Not applicable (outside Metro)", cfg.metro_shs],
            ["Multnomah County Preschool for All", "Not applicable (Clackamas County)", cfg.multnomah_pfa],
          ].map(([name, status, entry]) => (
            <div key={name} className="rounded-md border border-hair p-3">
              <div className="flex items-start justify-between gap-2"><p className="text-[12.5px] font-medium text-ink/85">{name}</p><StatusTag status={entry && entry.status} /></div>
              <p className="mt-1 text-[12px] text-ink/65">{status}</p>
              {entry && entry.note && <p className="mt-1 text-[10.5px] text-ink/45">{entry.note}</p>}
              <div className="mt-1.5"><SourceLink entry={entry} /></div>
            </div>
          ))}
        </div>
      </Card>

      <Disclaimer />
    </div>
  );
}
