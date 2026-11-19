// Usage & cost: three meters (Claude plan weekly, Base44 credits, email + text sending) and a scale calculator,
// so Justin can plan spend as every client's agents, automations, emails and texts grow. Each meter says where its
// number comes from. Real mode shows only real readings; Presentation mode uses the sample dataset.
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Gauge, Mail, MessageSquare, Sparkles, Plus, Calculator as CalcIcon, Settings2 } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { base44 } from "@/api/base44Client";
import { DEFAULT_RATES, RATE_FIELDS, withRates, emailCost, burn, nextReset, scenario, PRESETS, money } from "./costModel";

const arr = (v) => (Array.isArray(v) ? v : (v && v.items) || []);
const fmtN = (v) => Number(v || 0).toLocaleString("en-US");
const fmtWhen = (t) => (t ? new Date(t).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");
const monthKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; };
const KEY = ["usage-cost"];

async function load() {
  const E = base44.entities;
  const [meters, ledger, clients] = await Promise.all([
    E.UsageMeter.list("-recorded_at", 400).then(arr).catch(() => []),
    E.UsageLedger.filter({ kind: "marketing_email", month: monthKey() }, "-created_date", 2000).then(arr).catch(() => []),
    E.CRMClient.filter({ status: "Active" }, "business", 500).then(arr).catch(() => []),
  ]);
  return { meters, ledger, clients };
}

function Card({ icon: Icon, kicker, title, source, children, right }) {
  return (
    <section className="overflow-hidden rounded-md border border-hair bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-hair px-4 py-3">
        <div className="min-w-0">
          <p className="label-cross text-[10.5px]">({kicker})</p>
          <h2 className="mt-0.5 flex items-center gap-2 text-[17px] font-semibold tracking-[-0.02em] text-ink"><Icon className="h-4 w-4 text-[#ff3c00]" />{title}</h2>
          <p className="mt-0.5 text-[11.5px] text-ink/50"><span className="mono-label text-[9px] text-ink/40">Source</span> {source}</p>
        </div>
        {right}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function Meter({ pct, label, warn }) {
  const v = Math.max(0, Math.min(100, Number(pct) || 0));
  const tone = warn ? "#b91c1c" : v >= 80 ? "#c2410c" : "#ff3c00";
  return (
    <div>
      <div className="flex items-baseline justify-between"><span className="text-[30px] font-semibold tabular-nums tracking-[-0.04em] text-ink">{pct == null ? "—" : `${Math.round(v)}%`}</span><span className="text-[12px] text-ink/50">{label}</span></div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-ink/[0.08]"><div className="h-full rounded-full transition-all" style={{ width: `${v}%`, background: tone }} /></div>
    </div>
  );
}

// Burn line: this week's readings against an even pace (straight line to 100% at reset).
function BurnLine({ b }) {
  if (!b || !b.points.length) return null;
  const W = 520; const H = 90; const span = b.reset - b.start;
  const x = (t) => ((t - b.start) / span) * W; const y = (p) => H - (Math.min(100, p) / 100) * H;
  const pts = [[b.start, 0], ...b.points.map((p) => [p.t, p.pct])];
  const last = pts[pts.length - 1];
  const proj = b.rate ? [last, [b.reset, Math.min(100, last[1] + b.rate * ((b.reset - last[0]) / 36e5))]] : null;
  return (
    <svg viewBox={`0 0 ${W} ${H + 14}`} className="mt-3 w-full" role="img" aria-label="This week's Claude usage against an even pace">
      <line x1="0" y1={y(0)} x2={W} y2={y(100)} stroke="rgba(26,26,26,.18)" strokeDasharray="4 4" />
      <line x1="0" y1={y(100)} x2={W} y2={y(100)} stroke="rgba(185,28,28,.25)" />
      {proj ? <polyline points={proj.map(([t, p]) => `${x(t)},${y(p)}`).join(" ")} fill="none" stroke="#c2410c" strokeWidth="1.5" strokeDasharray="3 4" /> : null}
      <polyline points={pts.map(([t, p]) => `${x(t)},${y(p)}`).join(" ")} fill="none" stroke="#ff3c00" strokeWidth="2.2" />
      {b.points.map((p) => <circle key={p.t} cx={x(p.t)} cy={y(p.pct)} r="3" fill="#ff3c00" />)}
      <text x="0" y={H + 12} fontSize="9" fill="rgba(26,26,26,.45)">week start</text>
      <text x={W} y={H + 12} fontSize="9" textAnchor="end" fill="rgba(26,26,26,.45)">reset</text>
    </svg>
  );
}

function ClaudeMeter({ readings, onSave }) {
  const latest = readings[0] || null;
  const [pct, setPct] = useState("");
  const [plan, setPlan] = useState(latest?.plan || "Max");
  const [reset, setReset] = useState(() => { const r = latest?.reset_at ? new Date(latest.reset_at) : nextReset(1, 0); return new Date(r.getTime() - r.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); });
  const b = useMemo(() => (latest ? burn(readings, latest.reset_at) : null), [readings, latest]);
  const weeks = useMemo(() => {
    const m = new Map();
    readings.forEach((r) => { const k = r.reset_at ? String(r.reset_at).slice(0, 10) : "?"; m.set(k, Math.max(m.get(k) || 0, Number(r.pct_used) || 0)); });
    return [...m].slice(0, 8);
  }, [readings]);
  const save = () => { if (pct === "") return; onSave({ kind: "claude", pct_used: Number(pct), plan, reset_at: new Date(reset).toISOString(), recorded_at: new Date().toISOString() }); setPct(""); };
  return (
    <Card icon={Sparkles} kicker="Meter 1 · weekly" title="Claude plan" source="You, typed in from claude.ai → Settings → Usage. There is no API for Claude.ai plan usage.">
      <p className="mb-3 text-[12.5px] leading-snug text-ink/60">This comes from your own Claude chats and background agents (building, research, videos), not from client apps or their automations.</p>
      {latest ? (
        <>
          <Meter pct={latest.pct_used} label={`${latest.plan || "Plan"} · resets ${fmtWhen(latest.reset_at)}`} warn={b && b.beforeReset} />
          {b && b.rate ? (
            <p className={`mt-2 flex items-start gap-1.5 text-[12.5px] ${b.beforeReset ? "font-medium text-red-700" : "text-ink/60"}`}>
              {b.beforeReset ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}
              {b.beforeReset ? `At this pace you run out ${fmtWhen(b.runOutAt)}, before the reset.` : `At this pace you reach about ${Math.min(100, Math.round(b.current + b.rate * ((b.reset - b.points[b.points.length - 1].t) / 36e5)))}% by the reset.`}
              <span className="text-ink/45"> ({b.rate.toFixed(2)}% per hour this week)</span>
            </p>
          ) : null}
          <BurnLine b={b} />
        </>
      ) : <p className="rounded-sm border border-dashed border-hair px-3 py-4 text-[12.5px] text-ink/55">No reading yet. Type today's % below and the bar, burn rate and run-out warning start working. Add one a day to learn your weekly pattern.</p>}
      <div className="mt-4 grid gap-2 sm:grid-cols-[110px_1fr_120px_auto]">
        <input type="number" min="0" max="100" value={pct} onChange={(e) => setPct(e.target.value)} placeholder="% used" aria-label="Percent used" className="h-9 rounded-sm border border-hair bg-canvas px-2 text-[13px] outline-none focus:border-[#ff3c00]" />
        <input type="datetime-local" value={reset} onChange={(e) => setReset(e.target.value)} aria-label="Resets at" className="h-9 rounded-sm border border-hair bg-canvas px-2 text-[13px] outline-none focus:border-[#ff3c00]" />
        <input value={plan} onChange={(e) => setPlan(e.target.value)} placeholder="Plan" aria-label="Plan tier" className="h-9 rounded-sm border border-hair bg-canvas px-2 text-[13px] outline-none focus:border-[#ff3c00]" />
        <button type="button" onClick={save} className="inline-flex h-9 items-center justify-center gap-1 rounded-sm bg-ink px-3 text-[12.5px] font-medium text-white hover:bg-[#ff3c00]"><Plus className="h-3.5 w-3.5" />Log reading</button>
      </div>
      {weeks.length > 1 ? (
        <div className="mt-4">
          <p className="mono-label mb-1.5 text-[9.5px] text-ink/45">Weekly peak (your pattern)</p>
          <div className="flex items-end gap-2">{weeks.slice().reverse().map(([k, v]) => <div key={k} className="flex flex-col items-center gap-1"><div className="w-7 rounded-sm bg-[#ff3c00]/70" style={{ height: `${Math.max(4, v * 0.6)}px` }} title={`${v}%`} /><span className="font-mono text-[9px] text-ink/45">{k.slice(5)}</span></div>)}</div>
        </div>
      ) : null}
    </Card>
  );
}

function Base44Meter({ readings, onSave }) {
  const units = ["message credits", "integration credits"];
  const latestOf = (u) => readings.find((r) => r.unit === u) || null;
  const [form, setForm] = useState({ unit: units[1], used: "", limit: "" });
  const save = () => { if (form.used === "" || form.limit === "") return; onSave({ kind: "base44", unit: form.unit, used: Number(form.used), limit: Number(form.limit), pct_used: Number(form.limit) ? (100 * Number(form.used)) / Number(form.limit) : null, recorded_at: new Date().toISOString() }); setForm({ ...form, used: "" }); };
  return (
    <Card icon={Gauge} kicker="Meter 2 · monthly" title="Base44 credits" source="You, typed in from the Base44 workspace billing page. The Base44 billing API returns invoices and your plan, not credit usage, so it can't be read live.">
      <p className="mb-3 text-[12.5px] leading-snug text-ink/60">Client app agents, LLM calls inside apps and built-in emails use these credits.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {units.map((u) => { const r = latestOf(u); return (
          <div key={u}>
            {r ? <Meter pct={r.pct_used} label={`${fmtN(r.used)} of ${fmtN(r.limit)} ${u}`} /> : <p className="rounded-sm border border-dashed border-hair px-3 py-3 text-[12.5px] text-ink/55">No {u} reading yet.</p>}
            {r ? <p className="mt-1 text-[11px] text-ink/45">As of {fmtWhen(r.recorded_at)}</p> : null}
          </div>
        ); })}
      </div>
      <div className="mt-4 grid gap-2 grid-cols-2 xl:grid-cols-[170px_1fr_1fr_auto]">
        <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} aria-label="Credit type" className="h-9 rounded-sm border border-hair bg-canvas px-2 text-[13px]">{units.map((u) => <option key={u} value={u}>{u}</option>)}</select>
        <input type="number" value={form.used} onChange={(e) => setForm({ ...form, used: e.target.value })} placeholder="Used" aria-label="Credits used" className="h-9 min-w-0 rounded-sm border border-hair bg-canvas px-2 text-[13px] outline-none focus:border-[#ff3c00]" />
        <input type="number" value={form.limit} onChange={(e) => setForm({ ...form, limit: e.target.value })} placeholder="Monthly limit" aria-label="Credit limit" className="h-9 min-w-0 rounded-sm border border-hair bg-canvas px-2 text-[13px] outline-none focus:border-[#ff3c00]" />
        <button type="button" onClick={save} className="inline-flex h-9 items-center justify-center gap-1 rounded-sm bg-ink px-3 text-[12.5px] font-medium text-white hover:bg-[#ff3c00]"><Plus className="h-3.5 w-3.5" />Log reading</button>
      </div>
    </Card>
  );
}

function SendingMeter({ ledger, clients, rates }) {
  const byClient = useMemo(() => {
    const name = Object.fromEntries(clients.map((c) => [c.id, c.business]));
    const m = new Map();
    ledger.forEach((r) => { const k = r.client_id || "agency"; m.set(k, (m.get(k) || 0) + (Number(r.units) || 0)); });
    return [...m].map(([id, count]) => ({ id, name: name[id] || (id === "agency" ? "Interstellar" : "Client"), count })).sort((a, b) => b.count - a.count);
  }, [ledger, clients]);
  const total = byClient.reduce((t, c) => t + c.count, 0);
  return (
    <Card icon={Mail} kicker="Meter 3 · this month" title="Sending costs: email and texts" source="Email: Møthership's usage ledger (marketing email batches sent through Email Studio). Texts: no text sender is connected yet.">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-sm border border-hair p-3">
          <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink"><Mail className="h-3.5 w-3.5 text-[#ff3c00]" />Email (Amazon SES)</p>
          <p className="mt-1 text-[26px] font-semibold tabular-nums tracking-[-0.03em]">{fmtN(total)}</p>
          <p className="text-[12px] text-ink/55">emails this month · {money(emailCost(total, rates))}</p>
        </div>
        <div className="rounded-sm border border-hair p-3">
          <p className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink"><MessageSquare className="h-3.5 w-3.5 text-[#ff3c00]" />Texts (Twilio)</p>
          <p className="mt-1 text-[26px] font-semibold tabular-nums tracking-[-0.03em]">0</p>
          <p className="text-[12px] text-ink/55">No texts are sent from Møthership yet, so nothing to count. Use the calculator below to price it.</p>
        </div>
      </div>
      {byClient.length ? (
        <ul className="mt-4 divide-y divide-hair rounded-sm border border-hair">
          {byClient.slice(0, 10).map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-3 py-2 text-[12.5px]">
              <span className="min-w-0 flex-1 truncate text-ink">{c.name}</span>
              <span className="font-mono tabular-nums text-ink/60">{fmtN(c.count)} emails</span>
              <span className="w-16 text-right font-mono tabular-nums text-ink">{money(emailCost(c.count, rates))}</span>
            </li>
          ))}
        </ul>
      ) : <p className="mt-4 rounded-sm border border-dashed border-hair px-3 py-3 text-[12.5px] text-ink/55">No marketing emails sent this month yet. The bar moves as clients send.</p>}
      <p className="mt-2 text-[11px] text-ink/45">One-off client emails (invites, updates) aren't in the ledger yet, so this counts marketing sends only.</p>
    </Card>
  );
}

function RatesEditor({ rates, onSave }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(rates);
  return (
    <section className="rounded-md border border-hair bg-card">
      <button type="button" onClick={() => { setDraft(rates); setOpen((v) => !v); }} aria-expanded={open} className="flex w-full items-center justify-between px-4 py-3 text-left">
        <span className="flex items-center gap-2 text-[13.5px] font-semibold text-ink"><Settings2 className="h-4 w-4 text-[#ff3c00]" />Rates</span>
        <span className="text-[12px] text-ink/50">SES {money(rates.ses_per_1000)}/1,000 · SMS ~{money(rates.sms_per_msg + rates.sms_carrier)} each · MMS ~{money(rates.mms_per_msg + rates.mms_carrier)} each</span>
      </button>
      {open ? (
        <div className="grid gap-2 border-t border-hair p-4 sm:grid-cols-2">
          {RATE_FIELDS.map(([k, l]) => (
            <label key={k} className="flex items-center justify-between gap-3 text-[12.5px] text-ink/70">{l}
              <input type="number" step="0.0001" value={draft[k]} onChange={(e) => setDraft({ ...draft, [k]: Number(e.target.value) })} className="h-8 w-28 rounded-sm border border-hair bg-canvas px-2 text-right text-[12.5px]" />
            </label>
          ))}
          <label className="flex items-center gap-2 text-[12.5px] text-ink/70"><input type="checkbox" checked={!!draft.ses_dedicated_ip} onChange={(e) => setDraft({ ...draft, ses_dedicated_ip: e.target.checked })} />Use a managed dedicated IP</label>
          <div className="flex justify-end gap-2 sm:col-span-2">
            <button type="button" onClick={() => setDraft(DEFAULT_RATES)} className="h-8 rounded-sm border border-hair px-3 text-[12px]">Reset to list prices</button>
            <button type="button" onClick={() => { onSave(draft); setOpen(false); }} className="h-8 rounded-sm bg-ink px-3 text-[12px] font-medium text-white hover:bg-[#ff3c00]">Save rates</button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

const INPUTS = [["clients", "Clients"], ["listSize", "List size per client"], ["campaignsPerMonth", "Campaigns per month"], ["textsPerMonth", "Texts per client per month"], ["mmsShare", "Share of texts that are MMS (0-1)"], ["agentRunsPerDay", "Agent runs per client per day"], ["subscription", "Client subscription $/mo"]];

function Calculator({ rates }) {
  const [input, setInput] = useState(PRESETS[0].input);
  const [preset, setPreset] = useState(PRESETS[0].key);
  const s = scenario(input, rates);
  const note = (PRESETS.find((p) => p.key === preset) || {}).note;
  return (
    <section className="overflow-hidden rounded-md border border-hair bg-card" data-testid="scale-calculator">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hair px-4 py-3">
        <div>
          <p className="label-cross text-[10.5px]">(Scale calculator)</p>
          <h2 className="mt-0.5 flex items-center gap-2 text-[17px] font-semibold tracking-[-0.02em]"><CalcIcon className="h-4 w-4 text-[#ff3c00]" />What would it cost at scale?</h2>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => <button key={p.key} type="button" onClick={() => { setInput(p.input); setPreset(p.key); }} className={`rounded-sm border px-2.5 py-1 text-[12px] ${preset === p.key ? "border-[#ff3c00] bg-[#ff3c00] text-white" : "border-hair text-ink/70 hover:border-ink/40"}`}>{p.label}</button>)}
        </div>
      </header>
      <div className="grid gap-5 p-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="grid gap-2">
          {INPUTS.map(([k, l]) => (
            <label key={k} className="flex items-center justify-between gap-3 text-[12.5px] text-ink/70">{l}
              <input type="number" value={input[k]} onChange={(e) => { setInput({ ...input, [k]: Number(e.target.value) }); setPreset(""); }} className="h-8 w-32 rounded-sm border border-hair bg-canvas px-2 text-right text-[12.5px]" />
            </label>
          ))}
          {note ? <p className="text-[11.5px] text-ink/50">{note}</p> : null}
        </div>
        <div>
          <table className="w-full text-[12.5px]">
            <thead><tr className="mono-label text-[9px] text-ink/45"><th className="pb-1.5 text-left font-normal">Vendor</th><th className="pb-1.5 text-right font-normal">Volume / mo</th><th className="pb-1.5 text-right font-normal">Cost / mo</th></tr></thead>
            <tbody>
              {s.vendors.map((v) => <tr key={v.key} className="border-t border-hair"><td className="py-1.5">{v.label}</td><td className="py-1.5 text-right font-mono tabular-nums text-ink/60">{fmtN(Math.round(v.volume))} {v.unit}</td><td className="py-1.5 text-right font-mono tabular-nums">{money(v.cost)}</td></tr>)}
              <tr className="border-t-2 border-ink/20 font-semibold"><td className="py-2">Total</td><td /><td className="py-2 text-right font-mono tabular-nums text-[#ff3c00]">{money(s.total)}</td></tr>
            </tbody>
          </table>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-sm border border-hair p-3"><p className="mono-label text-[9px] text-ink/45">Cost per client / mo</p><p className="mt-1 text-[20px] font-semibold tabular-nums">{money(s.perClient)}</p></div>
            <div className="rounded-sm border border-hair p-3"><p className="mono-label text-[9px] text-ink/45">Share of the ${fmtN(s.subscription)} subscription</p><p className={`mt-1 text-[20px] font-semibold tabular-nums ${s.shareOfSub > 0.25 ? "text-red-700" : "text-ink"}`}>{s.shareOfSub == null ? "—" : `${(s.shareOfSub * 100).toFixed(1)}%`}</p></div>
          </div>
          <p className="mt-2 text-[11px] text-ink/45">Prices from your saved rates. Agent runs are an estimate; Claude plan usage isn't billed per send and isn't included.</p>
        </div>
      </div>
    </section>
  );
}

export default function UsageCostPage() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: KEY, queryFn: load, staleTime: 30_000 });
  const d = q.data || { meters: [], ledger: [], clients: [] };
  const claude = d.meters.filter((m) => m.kind === "claude").sort((a, b) => String(b.recorded_at).localeCompare(String(a.recorded_at)));
  const b44 = d.meters.filter((m) => m.kind === "base44").sort((a, b) => String(b.recorded_at).localeCompare(String(a.recorded_at)));
  const ratesRow = d.meters.filter((m) => m.kind === "rates").sort((a, b) => String(b.recorded_at || b.updated_date).localeCompare(String(a.recorded_at || a.updated_date)))[0];
  const rates = withRates(ratesRow && ratesRow.data);
  const add = async (row) => { await base44.entities.UsageMeter.create(row); qc.invalidateQueries({ queryKey: KEY }); };
  const saveRates = async (data) => {
    if (ratesRow && ratesRow.id) await base44.entities.UsageMeter.update(ratesRow.id, { data, recorded_at: new Date().toISOString() });
    else await base44.entities.UsageMeter.create({ kind: "rates", data, recorded_at: new Date().toISOString() });
    qc.invalidateQueries({ queryKey: KEY });
  };
  return (
    <div className="min-h-full pb-28" data-testid="usage-cost">
      <PageHeader breadcrumb="Money / Usage & cost" title="Usage & /cost" rightText="Plan spend as clients scale" />
      <div className="space-y-5 px-5 py-6 md:px-8">
        {q.isLoading ? <p className="text-[13px] text-ink/50">Reading the meters…</p> : (
          <>
            <div className="grid gap-5 xl:grid-cols-2">
              <ClaudeMeter readings={claude} onSave={add} />
              <Base44Meter readings={b44} onSave={add} />
            </div>
            <SendingMeter ledger={d.ledger} clients={d.clients} rates={rates} />
            <RatesEditor rates={rates} onSave={saveRates} />
            <Calculator rates={rates} />
          </>
        )}
      </div>
    </div>
  );
}
