// Deal value editor: one-time (amount + status, paid amount) and monthly plan (HyperCare+ / GravïtyCare / none,
// amount, start rule). Controlled: the parent owns the form and saves it (one Save for everything, or on blur).
import { ONE_STATUS, PLANS, STARTS } from "./deal";

const label = "mono-label text-[8.5px] text-ink/50";
const input = "mt-1 h-9 w-full rounded-sm border border-hair bg-card px-2 text-[13px] outline-none focus:border-[#ff3c00]";

export default function DealEditor({ value, onChange, onBlur, stripePaid }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  const num = (k) => (e) => onChange({ ...value, [k]: e.target.value.replace(/[^\d.]/g, "") });
  return (
    <div className="grid gap-3 rounded-md border border-hair bg-card/60 p-3 sm:grid-cols-2" data-testid="deal-editor" onBlur={onBlur}>
      <fieldset className="space-y-2">
        <legend className="text-[12.5px] font-semibold">One-time</legend>
        <div className="grid grid-cols-[1fr_130px] gap-2">
          <label className="block"><span className={label}>Amount ($)</span><input inputMode="decimal" value={value.one_amount} onChange={num("one_amount")} placeholder="2,500" className={input} /></label>
          <label className="block"><span className={label}>Status</span>
            <select value={value.one_status} onChange={set("one_status")} className={input}>{ONE_STATUS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
          </label>
        </div>
        {value.one_status === "partly_paid" ? (
          <label className="block"><span className={label}>Paid so far ($)</span><input inputMode="decimal" value={value.one_paid} onChange={num("one_paid")} className={input} /></label>
        ) : null}
        <p className="text-[11px] text-ink/45">{stripePaid != null ? `Stripe: $${stripePaid.toLocaleString()} paid (from the invoice).` : "Manual until there's a Stripe invoice; then paid comes from Stripe."}</p>
      </fieldset>
      <fieldset className="space-y-2">
        <legend className="text-[12.5px] font-semibold">Monthly plan</legend>
        <div className="grid grid-cols-[1fr_110px] gap-2">
          <label className="block"><span className={label}>Plan</span>
            <select value={value.mon_plan} onChange={set("mon_plan")} className={input}>{PLANS.map((p) => <option key={p.key} value={p.key}>{p.label}{p.hint ? ` (${p.hint})` : ""}</option>)}</select>
          </label>
          <label className="block"><span className={label}>$/month</span><input inputMode="decimal" value={value.mon_amount} disabled={value.mon_plan === "none"} onChange={num("mon_amount")} placeholder="500" className={input} /></label>
        </div>
        {value.mon_plan !== "none" ? (
          <div className="grid grid-cols-[1fr_140px] gap-2">
            <label className="block"><span className={label}>Starts</span>
              <select value={value.mon_start} onChange={set("mon_start")} className={input}>{STARTS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}</select>
            </label>
            {value.mon_start === "date" ? <label className="block"><span className={label}>Date</span><input type="date" value={value.mon_start_date} onChange={set("mon_start_date")} className={input} /></label> : null}
          </div>
        ) : null}
        <p className="text-[11px] text-ink/45">Counts as committed, not in Stripe yet, until the Stripe subscription exists. It never adds to Stripe MRR.</p>
      </fieldset>
    </div>
  );
}
