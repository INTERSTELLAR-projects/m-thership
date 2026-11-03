// Financial > Accounting & Taxes. Admin only (mounted inside the admin Financial page; entities are admin-RLS).
// Built scope-aware (business_id / client_id) so it can later be offered per client in the portal; not exposed there now.
import { useState } from "react";
import { Bell, Loader2 } from "lucide-react";
import useAccounting from "./useAccounting";
import OverviewTab from "./OverviewTab";
import TransactionsTab from "./TransactionsTab";
import TaxPlanTab from "./TaxPlanTab";
import FilingPackTab from "./FilingPackTab";
import SettingsTab from "./SettingsTab";
import { AssumptionBanner, Btn } from "./ui";

const SUBS = [
  ["overview", "Overview"],
  ["transactions", "Transactions"],
  ["plan", "Tax plan"],
  ["filing", "Filing pack"],
  ["settings", "Settings & connections"],
];

const fmt = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

export default function AccountingCenter() {
  const acct = useAccounting();
  const [sub, setSubState] = useState(() => {
    const s = new URLSearchParams(window.location.search).get("sub");
    return SUBS.some(([k]) => k === s) ? s : "overview";
  });
  const setSub = (s) => {
    setSubState(s);
    try {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", "accounting");
      url.searchParams.set("sub", s);
      window.history.replaceState(null, "", url.toString());
    } catch { /* cosmetic */ }
  };

  if (acct.loading) {
    return <div className="flex items-center justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-ink/35" /></div>;
  }

  const live = acct.alerts.filter((a) => a.status === "new");
  const thisYear = new Date().getFullYear();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 overflow-x-auto rounded-md border border-hair bg-card p-1">
          {SUBS.map(([k, label]) => (
            <button key={k} onClick={() => setSub(k)} className={`shrink-0 whitespace-nowrap rounded px-3 py-1.5 text-[12px] font-semibold transition-colors ${sub === k ? "bg-ink text-white" : "text-ink/55 hover:text-ink"}`}>
              {label}
              {k === "transactions" && acct.inbox.length > 0 && <span className="ml-1.5 rounded-full bg-[#ff3c00] px-1.5 py-px text-[10px] text-white">{acct.inbox.length}</span>}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2">
          <span className="mono-label text-ink/50">Tax year</span>
          <select value={acct.taxYear} onChange={(e) => acct.setTaxYear(Number(e.target.value))} className="rounded-md border border-hair bg-card px-2 py-1.5 text-[12px] font-semibold text-ink">
            {[thisYear + 1, thisYear, thisYear - 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      {live.map((a) => (
        <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-md border border-ink bg-ink px-4 py-3 text-white">
          <Bell className="h-4 w-4 text-[#ff6a00]" />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-semibold">{a.title}</p>
            {a.body && <p className="mt-0.5 text-[11.5px] text-white/60">{a.body}{a.due_date ? ` · due ${fmt(a.due_date)}` : ""}</p>}
          </div>
          <Btn kind="flame" onClick={() => { setSub(a.kind === "monthly_close" ? "transactions" : "plan"); acct.dismissAlert(a.id, "seen"); }}>Open</Btn>
          <button onClick={() => acct.dismissAlert(a.id)} className="text-[11px] text-white/55 hover:text-white">Dismiss</button>
        </div>
      ))}

      {!acct.profileComplete && sub !== "settings" && <AssumptionBanner onFix={() => setSub("settings")} />}

      {sub === "overview" && <OverviewTab acct={acct} go={setSub} />}
      {sub === "transactions" && <TransactionsTab acct={acct} />}
      {sub === "plan" && <TaxPlanTab acct={acct} go={setSub} />}
      {sub === "filing" && <FilingPackTab acct={acct} />}
      {sub === "settings" && <SettingsTab acct={acct} />}
    </div>
  );
}
