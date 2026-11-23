// The lead's Command System preview: a clickable, read-only demo of their operating system (dashboard, pipeline,
// schedule, customers, invoices and the industry's modules), in their name and brand color, filled with clearly
// labeled SAMPLE data from the template's generator (base44/shared/leadEngine.js sampleData). Nothing saves.
import { useMemo, useState } from "react";
import { LayoutDashboard, KanbanSquare, CalendarDays, Users, Receipt, Star, Calculator, Lock } from "lucide-react";

const ICON = { dashboard: LayoutDashboard, pipeline: KanbanSquare, schedule: CalendarDays, customers: Users, invoices: Receipt, reviews: Star, pricing: Calculator };
const money = (n) => `$${Math.round(Number(n) || 0).toLocaleString("en-US")}`;
const fmtKpi = (k) => (k.format === "money" ? money(k.value) : String(k.value));
const day = (d) => new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

const CSS = `
.cp{container-type:inline-size;font-family:Inter,system-ui,sans-serif;color:#17181a;background:#f6f6f4;font-size:14px;line-height:1.45;border:1px solid #dcdad6}
.cp *{box-sizing:border-box}
.cp-banner{display:flex;align-items:center;justify-content:center;gap:8px;background:#17181a;color:#fff;font-size:11.5px;letter-spacing:.06em;padding:7px 12px;text-align:center}
.cp-banner b{color:var(--cp-p);font-weight:700;text-transform:uppercase;letter-spacing:.14em}
.cp-shell{display:grid;grid-template-columns:1fr;min-height:560px}
.cp-side{background:#111214;color:#d7d7d7;padding:12px;display:flex;gap:6px;overflow-x:auto}
.cp-brand{display:none}
.cp-side button{display:flex;align-items:center;gap:8px;border:0;background:transparent;color:inherit;padding:9px 10px;border-radius:6px;font:500 13px Inter,system-ui,sans-serif;cursor:pointer;white-space:nowrap}
.cp-side button:hover{background:rgba(255,255,255,.06)}
.cp-side button[aria-current=page]{background:var(--cp-p);color:var(--cp-on)}
.cp-side button:focus-visible{outline:2px solid var(--cp-p);outline-offset:2px}
.cp-main{padding:18px;min-width:0}
.cp-top{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:8px;margin-bottom:16px}
.cp-top h2{margin:0;font-size:22px;font-weight:700;letter-spacing:-.02em}
.cp-top p{margin:2px 0 0;color:#6b6c70;font-size:12.5px}
.cp-ro{display:inline-flex;align-items:center;gap:6px;font-size:11.5px;color:#6b6c70;border:1px solid #dcdad6;padding:5px 9px;border-radius:999px;background:#fff}
.cp-kpis{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.cp-card{background:#fff;border:1px solid #e3e1dd;border-radius:10px;padding:14px;min-width:0}
.cp-card small{display:block;color:#6b6c70;font-size:11.5px;text-transform:uppercase;letter-spacing:.08em}
.cp-card strong{display:block;font-size:24px;font-weight:700;letter-spacing:-.03em;margin-top:6px;font-variant-numeric:tabular-nums}
.cp-grid2{display:grid;gap:10px;margin-top:10px}
.cp-h{font-size:13px;font-weight:700;margin:0 0 10px;display:flex;justify-content:space-between}
.cp-bars{display:flex;align-items:flex-end;gap:6px;height:120px}
.cp-bars i{flex:1;background:color-mix(in srgb,var(--cp-p) 25%,#fff);border-radius:4px 4px 0 0;position:relative}
.cp-bars i.hot{background:var(--cp-p)}
.cp-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 0;border-top:1px solid #efeeeb;font-size:13px}
.cp-row:first-of-type{border-top:0}
.cp-row span:first-child{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cp-pill{font-size:11px;font-weight:600;padding:3px 8px;border-radius:999px;background:#efeeeb;color:#4a4b4f;white-space:nowrap}
.cp-pill.ok{background:#e3f4e8;color:#1d6b35}.cp-pill.warn{background:#fdecdc;color:#9a4a07}.cp-pill.bad{background:#fde3e3;color:#9b1c1c}.cp-pill.go{background:color-mix(in srgb,var(--cp-p) 16%,#fff);color:#17181a}
.cp-board{display:grid;grid-auto-flow:column;grid-auto-columns:minmax(200px,1fr);gap:10px;overflow-x:auto;padding-bottom:6px}
.cp-col{background:#efeeeb;border-radius:10px;padding:10px;min-height:300px}
.cp-col h4{margin:0 0 8px;font-size:12px;text-transform:uppercase;letter-spacing:.08em;color:#55565a;display:flex;justify-content:space-between}
.cp-deal{background:#fff;border:1px solid #e3e1dd;border-radius:8px;padding:10px;margin-bottom:8px;font-size:13px}
.cp-deal b{display:block;font-weight:600}.cp-deal span{color:#6b6c70;font-size:12px}
.cp-table{width:100%;border-collapse:collapse;font-size:13px}
.cp-table th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#6b6c70;font-weight:600;padding:8px 10px;border-bottom:1px solid #e3e1dd}
.cp-table td{padding:10px;border-bottom:1px solid #efeeeb;white-space:nowrap}
.cp-table td.num{text-align:right;font-variant-numeric:tabular-nums}
.cp-scroll{overflow-x:auto;background:#fff;border:1px solid #e3e1dd;border-radius:10px}
.cp-day{margin-bottom:14px}.cp-day h4{margin:0 0 6px;font-size:12px;color:#55565a;text-transform:uppercase;letter-spacing:.08em}
.cp-job{display:grid;grid-template-columns:76px 1fr auto;gap:10px;align-items:center;background:#fff;border:1px solid #e3e1dd;border-left:3px solid var(--cp-p);border-radius:8px;padding:10px;margin-bottom:6px}
.cp-job time{font-size:12px;font-weight:600;color:#55565a}
.cp-mod{background:#fff;border:1px dashed #cfccc7;border-radius:10px;padding:18px}
.cp-mod ul{margin:10px 0 0;padding-left:18px;color:#4a4b4f}
@container (min-width:720px){
  .cp-shell{grid-template-columns:210px 1fr}
  .cp-side{flex-direction:column;overflow:visible;padding:16px 12px}
  .cp-brand{display:block;color:#fff;font-weight:700;font-size:15px;letter-spacing:-.01em;padding:4px 10px 14px;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:8px}
  .cp-brand span{display:block;font-size:10.5px;font-weight:500;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.4);margin-top:2px}
  .cp-main{padding:24px}
  .cp-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}
  .cp-grid2{grid-template-columns:1.3fr 1fr}
}
`;

const tone = (s) => (/paid|done|confirmed|won|regular|managed/i.test(s) ? "ok" : /overdue|lost/i.test(s) ? "bad" : /sent|progress|scheduled|booked/i.test(s) ? "go" : "warn");

export default function CommandPreview({ config }) {
  const c = config || {};
  const modules = c.modules?.length ? c.modules : [{ key: "dashboard", label: "Dashboard" }];
  const [view, setView] = useState(modules[0].key);
  const style = useMemo(() => ({ "--cp-p": c.theme?.primary || "#ff3c00", "--cp-on": c.theme?.on_primary || "#fff" }), [c.theme?.primary, c.theme?.on_primary]);
  if (!config) return null;
  const nouns = c.nouns || { job: "Job", customer: "Customer", money: "Invoice" };
  const cards = c.pipeline?.cards || [];
  const stages = c.pipeline?.stages || [];
  const jobs = c.jobs || [];
  const label = modules.find((m) => m.key === view)?.label || "Dashboard";
  const byDay = jobs.reduce((a, j) => { (a[j.date] ||= []).push(j); return a; }, {});
  const bars = [4, 6, 5, 8, 7, 9, 6, 10, 8, 11, 9, 12].map((v, i) => ({ v, hot: i === 11 }));

  const body = () => {
    if (view === "dashboard") return (
      <>
        <div className="cp-kpis">{(c.kpis || []).map((k) => <div key={k.key} className="cp-card"><small>{k.label}</small><strong>{fmtKpi(k)}</strong></div>)}</div>
        <div className="cp-grid2">
          <div className="cp-card"><p className="cp-h">Last 12 weeks <span style={{ color: "#6b6c70", fontWeight: 500 }}>{nouns.job}s</span></p><div className="cp-bars">{bars.map((b, i) => <i key={i} className={b.hot ? "hot" : ""} style={{ height: `${b.v * 8}%` }} />)}</div></div>
          <div className="cp-card"><p className="cp-h">Up next</p>{jobs.slice(0, 5).map((j) => <div key={j.id} className="cp-row"><span>{j.time} · {j.title}</span><span className={`cp-pill ${tone(j.status)}`}>{j.status}</span></div>)}</div>
        </div>
        <div className="cp-card" style={{ marginTop: 10 }}><p className="cp-h">Pipeline</p><div className="cp-kpis">{stages.slice(0, 4).map((s) => { const list = cards.filter((x) => x.stage === s); return <div key={s}><small style={{ color: "#6b6c70", fontSize: 11.5 }}>{s}</small><strong style={{ display: "block", fontSize: 18, fontWeight: 700 }}>{list.length} · {money(list.reduce((a, x) => a + x.value, 0))}</strong></div>; })}</div></div>
      </>
    );
    if (view === "pipeline") return <div className="cp-board">{stages.map((s) => { const list = cards.filter((x) => x.stage === s); return <div key={s} className="cp-col"><h4>{s}<span>{list.length}</span></h4>{list.map((d) => <div key={d.id} className="cp-deal"><b>{d.name}</b><span>{d.service} · {money(d.value)} · {d.age}d</span></div>)}</div>; })}</div>;
    if (view === "schedule") return <div>{Object.entries(byDay).map(([d, list]) => <div key={d} className="cp-day"><h4>{day(d)}</h4>{list.map((j) => <div key={j.id} className="cp-job"><time>{j.time}</time><div><b style={{ fontWeight: 600 }}>{j.title}</b><div style={{ color: "#6b6c70", fontSize: 12.5 }}>{j.customer}</div></div><span className={`cp-pill ${tone(j.status)}`}>{j.status}</span></div>)}</div>)}</div>;
    if (view === "customers") return <div className="cp-scroll"><table className="cp-table"><thead><tr><th>{nouns.customer}</th><th>City</th><th>Phone</th><th>Last visit</th><th style={{ textAlign: "right" }}>Lifetime</th></tr></thead><tbody>{(c.customers || []).map((x) => <tr key={x.id}><td>{x.name}</td><td>{x.city}</td><td>{x.phone}</td><td>{day(x.last)}</td><td className="num">{money(x.total)}</td></tr>)}</tbody></table></div>;
    if (view === "invoices") return <div className="cp-scroll"><table className="cp-table"><thead><tr><th>Number</th><th>{nouns.customer}</th><th>Due</th><th>Status</th><th style={{ textAlign: "right" }}>Amount</th></tr></thead><tbody>{(c.invoices || []).map((x) => <tr key={x.id}><td>{x.number}</td><td>{x.customer}</td><td>{day(x.due)}</td><td><span className={`cp-pill ${tone(x.status)}`}>{x.status}</span></td><td className="num">{money(x.amount)}</td></tr>)}</tbody></table></div>;
    if (view === "reviews") return <div className="cp-grid2"><div className="cp-card"><small>Review requests sent</small><strong>{c.reviews?.requested ?? 0}</strong><p style={{ color: "#6b6c70", margin: "6px 0 0", fontSize: 13 }}>Sent automatically when a {nouns.customer.toLowerCase()} pays.</p></div><div className="cp-card"><small>Opened the review link</small><strong>{c.reviews?.clicked ?? 0}</strong><p style={{ color: "#6b6c70", margin: "6px 0 0", fontSize: 13 }}>Happy customers land on your Google review page.</p></div></div>;
    if (view === "pricing") return <div className="cp-mod"><b>Pricing engine</b><p style={{ color: "#6b6c70", margin: "6px 0 0" }}>Your yearly costs and working days turn into the price you need per hour or per day, and the profit on every {nouns.job.toLowerCase()}.</p><ul><li>Yearly costs: trucks, insurance, payroll, tools</li><li>Working days and crew hours</li><li>Required charge per hour / per day, and margin per {nouns.job.toLowerCase()}</li></ul></div>;
    return <div className="cp-mod"><b>{label}</b><p style={{ color: "#6b6c70", margin: "6px 0 0" }}>Built around how {c.business || "you"} work{(c.entities || []).length ? `: ${(c.entities || []).map((e) => e.name).join(", ")}` : ""}.</p></div>;
  };

  return (
    <div className="cp" style={style} data-testid="command-preview">
      <style>{CSS}</style>
      <div className="cp-banner" role="note"><b>Sample data</b> Clickable demo · nothing here is real and nothing saves</div>
      <div className="cp-shell">
        <nav className="cp-side" aria-label="Command System">
          <div className="cp-brand">{c.business}<span>Command System</span></div>
          {modules.map((m) => { const I = ICON[m.key] || LayoutDashboard; return <button key={m.key} type="button" aria-current={view === m.key ? "page" : undefined} onClick={() => setView(m.key)}><I size={15} />{m.label}</button>; })}
        </nav>
        <main className="cp-main">
          <div className="cp-top"><div><h2>{label}</h2><p>{c.business} · demo with sample data</p></div><span className="cp-ro"><Lock size={12} /> Read-only preview</span></div>
          {body()}
        </main>
      </div>
    </div>
  );
}
