import { useMemo } from "react";
import { ArrowRight, CheckCircle2, CircleDashed } from "lucide-react";
import { Bar, Btn, Card, Disclaimer, Heading, Pill, Stat } from "./ui";
import { money0, pct } from "./ledger";

const daysTo = (d) => Math.ceil((new Date(`${d}T12:00:00`).getTime() - Date.now()) / 86400000);
const fmt = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const ago = (s) => {
  if (!s) return null;
  const h = Math.round((Date.now() - new Date(s).getTime()) / 3600000);
  return h < 1 ? "just now" : h < 48 ? `${h}h ago` : `${Math.round(h / 24)}d ago`;
};

function MonthBars({ monthly, year }) {
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const map = Object.fromEntries(monthly.map((m) => [m.key, m]));
  const vals = months.map((k) => (map[k] ? map[k].gross - map[k].expenses : null));
  const max = Math.max(1, ...vals.map((v) => Math.abs(v || 0)));
  return (
    <div className="flex h-36 items-end gap-1.5">
      {months.map((k, i) => {
        const v = vals[i];
        const h = v == null ? 2 : Math.max(3, (Math.abs(v) / max) * 120);
        return (
          <div key={k} className="group flex flex-1 flex-col items-center gap-1">
            <span className="text-[9px] tabular-nums text-ink/0 transition-colors group-hover:text-ink/60">{v == null ? "" : money0(v)}</span>
            <div className="w-full rounded-sm" style={{ height: h, background: v == null ? "rgba(26,26,26,.08)" : v < 0 ? "#1a1a1a" : "linear-gradient(180deg,#ffaa00,#ff6a00 45%,#ff3c00)" }} />
            <span className="font-mono text-[9px] uppercase text-ink/40">{new Date(`${k}-15T12:00:00`).toLocaleDateString("en-US", { month: "narrow" })}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function OverviewTab({ acct, go }) {
  const { plan, profile, inbox, ledger, taxYear } = acct;
  const qbo = profile.qbo_snapshot;
  const cash = qbo && qbo.cash_total != null ? { v: qbo.cash_total, sub: `QuickBooks bank accounts · ${ago(qbo.at)}` } : profile.cash_balance_manual != null ? { v: profile.cash_balance_manual, sub: "Entered by hand in Settings" } : null;
  const sources = useMemo(() => {
    const count = (s) => ledger.filter((t) => t.source === s).length;
    return [
      { k: "Stripe revenue", ok: !!profile.stripe_synced_at, detail: profile.stripe_synced_at ? `${count("stripe")} rows · synced ${ago(profile.stripe_synced_at)}` : "Not synced yet" },
      { k: "QuickBooks (bank feed)", ok: !!qbo, detail: qbo ? `${count("quickbooks")} rows · ${ago(qbo.at)}` : "Not connected" },
      { k: "Bank CSV imports", ok: count("csv") > 0, detail: count("csv") ? `${count("csv")} rows · last ${ago(profile.last_csv_import_at) || "—"}` : "None yet" },
      { k: "Expense schedule", ok: count("expense_schedule") > 0, detail: count("expense_schedule") ? `${count("expense_schedule")} scheduled bills` : "Not imported" },
    ];
  }, [ledger, profile, qbo]);

  if (!plan) return null;
  const nd = plan.nextDue;
  const days = nd ? daysTo(nd.date) : null;

  return (
    <div className="space-y-5">
      <Heading title="Accounting" accent="taxes" sub={`Tax year ${taxYear}. Books from Stripe, QuickBooks, bank CSVs and your expense schedule; the tax plan projects the full year from them.`} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Cash" value={cash ? money0(cash.v) : "—"} sub={cash ? cash.sub : "Connect QuickBooks or enter it in Settings"} />
        <Stat label="Profit YTD" value={money0(plan.proj.ytdNet)} sub={`${money0(plan.proj.ytdGross)} in · ${money0(plan.proj.ytdExp)} out`} />
        <Stat hero label={`Tax owed ${taxYear} (est.)`} value={money0(plan.tax.total)} sub={`${pct(plan.effectiveRate)} effective on ${money0(plan.proj.fullNet)} projected profit`} />
        <Stat label="Set aside" value={`${money0(plan.reserve)}`} tone={plan.reserveFunded < 1 ? "warn" : undefined} sub={<span className="block"><Bar value={plan.reserveFunded} className="mb-1.5" />{money0(plan.neededInReserve)} needed now · {Math.round(plan.reserveFunded * 100)}% funded</span>} />
        <Stat label="Next due" value={nd ? `${days}d` : "—"} sub={nd ? `${fmt(nd.date)} · Q${nd.q} · ${money0(plan.nextDueAmount)} (safe harbor)` : "No upcoming due date in this tax year"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card dark className="lg:col-span-1" title="The rule">
          <p className="text-[13px] text-white/60">Set aside from every payment that lands:</p>
          <p className="mt-2 text-[64px] font-semibold leading-none tracking-[-0.05em] flame-text">{Math.ceil(plan.setAsidePct * 100)}%</p>
          <p className="mt-3 text-[12px] leading-relaxed text-white/55">
            Each extra $1,000 of profit adds about {money0(plan.marginal * 1000)} of tax ({pct(plan.marginal, 0)} all-in marginal: federal income, SE, Oregon, local).
          </p>
          <div className="mt-4"><Btn kind="flame" onClick={() => go("plan")}>See the tax plan <ArrowRight className="h-3.5 w-3.5" /></Btn></div>
        </Card>

        <Card className="lg:col-span-2" title="Monthly profit" sub="Net of categorized income and deductible expenses (meals at 50%)." right={<Pill>{plan.proj.used === "run_rate" ? "run-rate projection" : plan.proj.used}</Pill>}>
          <MonthBars monthly={acct.monthly} year={taxYear} />
          <div className="mt-4 grid grid-cols-3 gap-3 border-t border-hair pt-3 text-[12px]">
            <div><p className="mono-label !text-[9px] text-ink/45">Projected revenue</p><p className="mt-1 font-semibold tabular-nums">{money0(plan.proj.fullGross)}</p></div>
            <div><p className="mono-label !text-[9px] text-ink/45">Projected deductions</p><p className="mt-1 font-semibold tabular-nums">{money0(plan.proj.fullExp)}</p></div>
            <div><p className="mono-label !text-[9px] text-ink/45">Annualized profit</p><p className="mt-1 font-semibold tabular-nums">{money0(plan.proj.annualizedNet)}</p></div>
          </div>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Review inbox" sub="Transactions waiting for a category.">
          <p className="text-[40px] font-semibold leading-none tracking-[-0.04em] tabular-nums">{inbox.length}</p>
          <p className="mt-2 text-[12px] text-ink/55">{inbox.filter((t) => t.ai_suggestion).length} have a suggestion ready to bulk-approve.</p>
          <div className="mt-4"><Btn kind={inbox.length ? "flame" : "ghost"} onClick={() => go("transactions")}>Open inbox</Btn></div>
        </Card>
        <Card title="Data sources">
          <ul className="space-y-2.5">
            {sources.map((s) => (
              <li key={s.k} className="flex items-start gap-2.5">
                {s.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#ff3c00]" /> : <CircleDashed className="mt-0.5 h-4 w-4 text-ink/30" />}
                <div><p className="text-[12.5px] font-medium text-ink/85">{s.k}</p><p className="text-[11px] text-ink/45">{s.detail}</p></div>
              </li>
            ))}
          </ul>
          <div className="mt-4"><Btn onClick={() => go("settings")}>Manage connections</Btn></div>
        </Card>
        <Card title="Oregon flags">
          <p className="text-[12px] font-medium text-ink/80">Corporate Activity Tax (CAT)</p>
          <Bar value={plan.cat.registerPct} className="mt-2" />
          <p className="mt-1.5 text-[11px] text-ink/50">
            {money0(plan.cat.projected)} projected Oregon receipts vs {money0(plan.cat.register)} registration threshold. {plan.cat.mustRegister ? "Register within 30 days of crossing it." : "Not required yet."}
          </p>
          <p className="mt-3 text-[12px] font-medium text-ink/80">Local taxes (Molalla)</p>
          <p className="mt-1 text-[11px] leading-relaxed text-ink/50">
            SCTD self-employment tax {profile.in_sctd_district ? `≈ ${money0(plan.tax.sctd)}` : "off"} (needs confirmation) · TriMet: not applicable · Metro SHS: {profile.in_metro_district ? money0(plan.tax.metroTax) : "not applicable"} · Multnomah PFA: not applicable.
          </p>
        </Card>
      </div>

      <Disclaimer />
    </div>
  );
}
