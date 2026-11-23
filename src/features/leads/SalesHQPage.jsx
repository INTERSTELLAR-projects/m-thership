// Sales HQ (admin only): who's dialing and what it turns into, per caller per day/week; funnel, pipeline, rep cost
// vs revenue, the 2027 goal tracker, price approvals, reps (add, invite, training), pay rules and price floors.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Loader2, Mail, Plus, Shuffle, Target, UserPlus, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { base44 } from "@/api/base44Client";
import { sales, engine, useSales, useEngine, money, pct, leadHref } from "./api";
import { Card, Pill, Loading, ErrorNote, Empty, Stat, btn, btnFlame, btnInk, input } from "./ui";

const TABS = [["overview", "Scoreboard"], ["approvals", "Approvals"], ["reps", "Reps"], ["pay", "Pay"], ["floors", "Price floors"]];

export default function SalesHQPage() {
  const [tab, setTab] = useState("overview");
  const [days, setDays] = useState(7);
  const hq = useSales("hq", { days });
  const pending = hq.data?.pending_approvals?.length || 0;
  return (
    <div className="pb-20">
      <PageHeader breadcrumb="Lead Engine / Sales HQ" title="Sales /HQ" rightText={hq.data ? `${hq.data.totals.calls} dials · ${money(hq.data.totals.revenue)} closed (${days === 1 ? "today" : `${days} days`})` : ""} />
      <div className="space-y-5 px-4 pt-5 md:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hair">
          <div role="tablist" className="flex flex-wrap gap-1">{TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={`relative h-10 px-3 text-[13px] font-medium ${tab === k ? "text-ink" : "text-ink/50 hover:text-ink"}`}>{l}{k === "approvals" && pending ? <span className="ml-1 bg-[#ff3c00] px-1 font-mono text-[10px] text-white">{pending}</span> : null}{tab === k ? <span className="absolute inset-x-3 -bottom-px h-[2px] bg-[#ff3c00]" /> : null}</button>)}</div>
          {tab === "overview" ? <div role="group" aria-label="Window" className="mb-1 inline-flex border border-hair bg-card p-0.5">{[[1, "Today"], [7, "Week"], [30, "30 days"]].map(([d, l]) => <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)} className={`h-8 px-3 text-[12px] ${days === d ? "bg-ink text-white" : "text-ink/60"}`}>{l}</button>)}</div> : null}
        </div>
        {tab === "overview" ? (hq.isLoading ? <Loading /> : hq.isError ? <ErrorNote error={hq.error} /> : <Overview d={hq.data} />) : null}
        {tab === "approvals" ? <Approvals d={hq.data} onDone={() => hq.refetch()} /> : null}
        {tab === "reps" ? <Reps /> : null}
        {tab === "pay" ? <Pay /> : null}
        {tab === "floors" ? <Floors /> : null}
      </div>
    </div>
  );
}

function Overview({ d }) {
  const g = d.goal || {};
  const maxAct = Math.max(1, ...d.activity.map((a) => a.calls));
  const fmax = Math.max(1, ...d.funnel.map((f) => f.n));
  const projectYtd = g.months.reduce((a, m) => a + m.project, 0);
  return (
    <div className="space-y-5">
      <Card title="Callers" kicker="Per caller · solo mode counts your own dials too" pad={false} testid="hq-callers">
        {!d.callers?.length ? <Empty icon={Target} title="No dials yet" hint="Log calls on the call sheet and they show up here." /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-[12.5px]">
            <thead><tr className="border-b border-hair text-left">{["Caller", "Dials", "Connect", "Owner", "Portal sent", "Login", "Meeting", "Close", "Deals", "Revenue", "Rev / dial", "Cost / dial"].map((h) => <th key={h} className="mono-label px-3 py-2 text-[9px] font-normal text-ink/50">{h}</th>)}</tr></thead>
            <tbody>{d.callers.map((r) => (
              <tr key={r.email} className="border-b border-hair/70">
                <td className="px-3 py-2.5"><p className="font-medium">{r.name}</p><p className="text-[11px] text-ink/45">{r.role}</p></td>
                <td className="px-3 font-mono tabular-nums"><b>{r.dials}</b></td>
                <td className="px-3 font-mono tabular-nums">{pct(r.connect_rate)}</td>
                <td className="px-3 font-mono tabular-nums">{pct(r.owner_rate)}</td>
                <td className="px-3 font-mono tabular-nums">{r.portals} · {pct(r.portal_rate)}</td>
                <td className="px-3 font-mono tabular-nums">{r.logins} · {pct(r.login_rate)}</td>
                <td className="px-3 font-mono tabular-nums">{r.meetings} · {pct(r.meeting_rate)}</td>
                <td className="px-3 font-mono tabular-nums">{pct(r.close_rate)}</td>
                <td className="px-3 font-mono tabular-nums">{r.deals}</td>
                <td className="px-3 font-mono tabular-nums">{money(r.revenue)}</td>
                <td className="px-3 font-mono tabular-nums">{money(r.revenue_per_dial)}</td>
                <td className="px-3 font-mono tabular-nums">{r.role === "rep" ? money(r.cost_per_dial) : "—"}</td>
              </tr>
            ))}</tbody>
          </table></div>
        )}
      </Card>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="Funnel" kicker="Lead Finder leads, all time">
          <ul className="space-y-2">{d.funnel.map((f, i) => <li key={f.key}><div className="flex justify-between text-[12.5px]"><span>{f.label}</span><span className="font-mono tabular-nums">{f.n}{i ? <span className="text-ink/45"> · {pct(f.n / Math.max(1, d.funnel[i - 1].n))}</span> : null}</span></div><div className="mt-1 h-2 bg-ink/[0.06]"><div className="h-full flame-bg" style={{ width: `${(f.n / fmax) * 100}%` }} /></div></li>)}</ul>
        </Card>
        <Card title="Activity" kicker="Last 8 weeks: dials (bar), meetings and deals">
          <div className="flex h-40 items-end gap-2">{d.activity.map((a) => <div key={a.week} className="flex flex-1 flex-col items-center gap-1" title={`Week ending ${a.week}: ${a.calls} dials, ${a.meetings} meetings, ${a.previews} previews, ${a.deals} deals`}><span className="font-mono text-[10px] text-ink/50">{a.meetings || ""}{a.deals ? `·${a.deals}` : ""}</span><div className="w-full bg-ink/80" style={{ height: `${Math.max(2, (a.calls / maxAct) * 120)}px` }} /><span className="font-mono text-[9px] text-ink/40">{a.week.slice(5)}</span></div>)}</div>
        </Card>
      </div>
      <Card title="Reps: cost vs revenue" kicker="This month · retainer + commission vs gross closed (one-time + 12 × monthly)" pad={false}>
        {!d.board.length ? <p className="p-4 text-[12.5px] text-ink/55">No reps yet. Solo mode: you're the whole team. Add reps on the Reps tab when you're ready.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-[12.5px]"><thead><tr className="border-b border-hair text-left">{["Rep", "Open leads", "Previews", "Meetings", "Deals", "SEO subs", "Gross this month", "Cost this month", "Profitable?"].map((h) => <th key={h} className="mono-label px-3 py-2 text-[9px] font-normal text-ink/50">{h}</th>)}</tr></thead>
            <tbody>{d.board.map((r) => <tr key={r.id} className="border-b border-hair/70"><td className="px-3 py-2.5 font-medium">{r.name} <span className="text-[11px] text-ink/45">{r.mode}</span></td><td className="px-3 font-mono">{r.open_leads}</td><td className="px-3 font-mono">{r.previews_built}</td><td className="px-3 font-mono">{r.meetings}</td><td className="px-3 font-mono">{r.deals_closed}</td><td className="px-3 font-mono">{r.seo_subs}</td><td className="px-3 font-mono">{money(r.month_gross)}</td><td className="px-3 font-mono">{money(r.month_cost)}</td><td className="px-3">{r.month_gross >= r.month_cost ? <Pill tone="green">yes</Pill> : <Pill tone="red">not yet</Pill>}</td></tr>)}</tbody></table></div>
        )}
      </Card>
      <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
        <Card title="Pipeline" kicker="Open leads by stage and industry">
          <div className="grid grid-cols-2 gap-4 text-[12.5px]">
            <ul className="space-y-1">{Object.entries(d.pipeline.stages).map(([k, n]) => <li key={k} className="flex justify-between"><span>{k.replace(/_/g, " ")}</span><span className="font-mono">{n}</span></li>)}</ul>
            <ul className="space-y-1">{Object.entries(d.pipeline.industries).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, n]) => <li key={k} className="flex justify-between"><span className="truncate">{k.replace(/_/g, " ")}</span><span className="font-mono">{n}</span></li>)}</ul>
          </div>
        </Card>
        <Card title={g.title || "$1M in 2027"} kicker={g.from_goal ? "From your revenue goal (Financial › Goal)" : "Default target until a revenue goal is set"}>
          <div className="grid grid-cols-3 gap-3"><Stat label="Target" value={money(g.target)} hint={`${money(Math.round(g.target / 12))} a month`} /><Stat label="Project revenue" value={money(projectYtd)} hint={`Won deals in ${g.year}`} /><Stat label="MRR today" value={money(g.stripe_mrr)} hint={`+ ${money(g.committed_mrr)}/mo committed from deals`} /></div>
          <div className="mt-4 flex h-28 items-end gap-1.5">{g.months.map((m) => { const tot = m.project + (g.stripe_mrr + m.new_mrr); const h = Math.min(100, (tot / Math.max(1, m.target)) * 100); return <div key={m.month} className="relative flex flex-1 flex-col items-center" title={`${m.month}: target ${money(m.target)} · projects ${money(m.project)} · new MRR ${money(m.new_mrr)}`}><div className="relative h-24 w-full bg-ink/[0.06]"><div className="absolute bottom-0 w-full flame-bg" style={{ height: `${h}%` }} /></div><span className="mt-1 font-mono text-[9px] text-ink/40">{m.month.slice(5)}</span></div>; })}</div>
          <p className="mt-2 text-[11.5px] text-ink/50">Bars: project revenue + MRR (Stripe today + new monthly from won deals) against the monthly target.</p>
        </Card>
      </div>
    </div>
  );
}

function Approvals({ d, onDone }) {
  const [busy, setBusy] = useState("");
  const list = d?.pending_approvals || [];
  const decide = async (id, decision) => { setBusy(id + decision); try { await sales("deal_decide", { id, decision }); onDone(); } catch { /* shown on refresh */ } setBusy(""); };
  if (!d) return <Loading />;
  return (
    <Card title="Prices that need your approval" kicker="Below your floors · reps only see “needs approval”">
      {!list.length ? <p className="text-[12.5px] text-ink/55">Nothing waiting.</p> : <ul className="divide-y divide-hair">{list.map((x) => (
        <li key={x.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
          <div><Link to={leadHref(x.client_id)} className="text-[14px] font-medium hover:text-[#ff3c00]">{x.client_name}</Link><p className="text-[12px] text-ink/55">{x.rep_name || "No rep"} · {(x.products || []).map((p) => `${p.label} ${money(p.price)}${p.billing === "monthly" ? "/mo" : ""} (list ${money(p.list_price)})`).join(" · ")}</p><p className="text-[11.5px] text-[#c24100]">Under floor: {(x.approval?.under || []).join(", ")}</p></div>
          <div className="flex gap-2"><button type="button" onClick={() => decide(x.id, "declined")} disabled={!!busy} className={btn}><X className="h-3.5 w-3.5" />Decline</button><button type="button" onClick={() => decide(x.id, "approved")} disabled={!!busy} className={btnFlame}><Check className="h-3.5 w-3.5" />Approve</button></div>
        </li>
      ))}</ul>}
    </Card>
  );
}

const EMPTY_REP = { name: "", email: "", phone: "", mode: "both", build_pct: 50, allowed_industries: [], multi_industry_ready: false, weight: 1, capacity: 40, base_retainer: 5000, status: "active", notes: "" };
function Reps() {
  const q = useSales("reps");
  const tpl = useEngine("templates");
  const tracks = useQueryTracks();
  const [edit, setEdit] = useState(null);
  const [msg, setMsg] = useState("");
  const [inv, setInv] = useState(null);
  const route = async () => { setMsg(""); try { const r = await engine("route_unassigned"); setMsg(`${r.assigned.length} lead(s) assigned round-robin${r.left ? `, ${r.left} left (no eligible rep: check industries and capacity)` : ""}.`); } catch (e) { setMsg(e.message); } };
  const save = async () => { setMsg(""); try { await sales("rep_save", { rep: edit }); setEdit(null); q.refetch(); setMsg("Saved."); } catch (e) { setMsg(e.message); } };
  const training = async (rep, track_id) => {
    setMsg("");
    try {
      const r = await base44.functions.invoke("training", { action: "assign", track_id, trainee_name: rep.name, trainee_email: rep.email });
      const a = r.data?.assignment;
      await sales("rep_save", { rep: { ...rep, training_track_id: track_id, training_assignment_id: a?.id || "", training_path: a?.path || "" } });
      q.refetch(); setMsg(`Training assigned to ${rep.name}. The link shows on their home screen; nothing was emailed.`);
    } catch (e) { setMsg(e?.response?.data?.error || e.message); }
  };
  const templates = tpl.data?.templates || [];
  if (q.isLoading) return <Loading />;
  if (q.isError) return <ErrorNote error={q.error} />;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setEdit({ ...EMPTY_REP })} className={btnFlame}><UserPlus className="h-3.5 w-3.5" />Add sales rep</button><button type="button" onClick={route} className={btn}><Shuffle className="h-3.5 w-3.5" />Route unassigned leads</button></div>
      {msg ? <p role="status" className="text-[12.5px] text-ink/70">{msg}</p> : null}
      {edit ? (
        <Card title={edit.id ? `Edit ${edit.name}` : "Add sales rep"} kicker="1099 contractor · signs in with their own (non-admin) login">
          <div className="grid gap-3 md:grid-cols-3">
            {[["name", "Name"], ["email", "Email"], ["phone", "Phone"]].map(([k, l]) => <label key={k} className="block"><span className="mono-label text-[9.5px] text-ink/50">{l}</span><input value={edit[k] || ""} onChange={(e) => setEdit({ ...edit, [k]: e.target.value })} className={`${input} mt-1`} /></label>)}
            <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Mode</span><select value={edit.mode} onChange={(e) => setEdit({ ...edit, mode: e.target.value })} className={`${input} mt-1`}><option value="both">Builder + closer</option><option value="builder">Builder</option><option value="closer">Closer</option></select></label>
            <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Time on building (%)</span><input type="number" min="0" max="100" value={edit.build_pct} onChange={(e) => setEdit({ ...edit, build_pct: e.target.value })} className={`${input} mt-1`} /></label>
            <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Base retainer ($/mo)</span><input type="number" min="0" value={edit.base_retainer} onChange={(e) => setEdit({ ...edit, base_retainer: e.target.value })} className={`${input} mt-1`} /></label>
            <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Round-robin weight</span><input type="number" step="0.5" min="0.5" max="5" value={edit.weight} onChange={(e) => setEdit({ ...edit, weight: e.target.value })} className={`${input} mt-1`} /></label>
            <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Capacity (open leads)</span><input type="number" min="1" value={edit.capacity} onChange={(e) => setEdit({ ...edit, capacity: e.target.value })} className={`${input} mt-1`} /></label>
            <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Status</span><select value={edit.status} onChange={(e) => setEdit({ ...edit, status: e.target.value })} className={`${input} mt-1`}>{["active", "paused", "inactive", "invited"].map((s) => <option key={s}>{s}</option>)}</select></label>
            <div className="md:col-span-3">
              <p className="mono-label text-[9.5px] text-ink/50">Industries {edit.multi_industry_ready ? "(multi-industry ready)" : "(one industry until marked ready)"}</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">{templates.map((t) => { const on = (edit.allowed_industries || []).includes(t.industry_key); return <button key={t.industry_key} type="button" onClick={() => setEdit({ ...edit, allowed_industries: edit.multi_industry_ready ? (on ? edit.allowed_industries.filter((x) => x !== t.industry_key) : [...edit.allowed_industries, t.industry_key]) : [t.industry_key] })} className={`px-2.5 py-1 text-[12px] ${on ? "bg-ink text-white" : "border border-hair bg-card hover:border-ink/40"}`}>{t.name}</button>; })}</div>
              <label className="mt-2 flex items-center gap-2 text-[12.5px]"><input type="checkbox" checked={!!edit.multi_industry_ready} onChange={(e) => setEdit({ ...edit, multi_industry_ready: e.target.checked, allowed_industries: e.target.checked ? edit.allowed_industries : (edit.allowed_industries || []).slice(0, 1) })} className="accent-[#ff3c00]" />Multi-industry ready</label>
            </div>
          </div>
          <div className="mt-3 flex gap-2"><button type="button" onClick={save} className={btnFlame}>Save rep</button><button type="button" onClick={() => setEdit(null)} className={btn}>Cancel</button></div>
        </Card>
      ) : null}
      {!(q.data?.reps || []).length ? <Card><Empty icon={UserPlus} title="No reps yet" hint="Solo mode: every lead is yours. Add a rep and new leads start routing round-robin within their industry." /></Card> : (
        <div className="grid gap-3 lg:grid-cols-2">{q.data.reps.map((r) => (
          <Card key={r.id} title={r.name} kicker={`${r.mode} · ${r.status}`} right={<div className="flex gap-1.5"><button type="button" onClick={() => setEdit({ ...EMPTY_REP, ...r })} className={btn}>Edit</button><button type="button" onClick={async () => { try { const x = await sales("rep_invite", { id: r.id }); setInv({ rep: r, ...x.preview }); } catch (e) { setMsg(e.message); } }} className={btn}><Mail className="h-3.5 w-3.5" />Invite</button></div>}>
            <p className="text-[12.5px] text-ink/60">{r.email} · {money(r.base_retainer)}/mo base · weight {r.weight} · cap {r.capacity} · {r.assigned_total || 0} assigned</p>
            <p className="mt-1 text-[12.5px]">Industries: {(r.allowed_industries || []).join(", ") || <span className="text-red-700">none (gets no leads)</span>}{r.multi_industry_ready ? " · multi-ready" : ""}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[12.5px]"><span className="text-ink/55">Training:</span>{r.training_path ? <a href={r.training_path} target="_blank" rel="noreferrer" className="text-[#ff3c00] hover:underline">Assigned</a> : null}<select defaultValue="" onChange={(e) => e.target.value && training(r, e.target.value)} className="h-8 border border-hair bg-card px-2 text-[12px]" aria-label="Assign training track"><option value="">{r.training_path ? "Reassign track…" : "Assign a training track…"}</option>{tracks.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}</select></div>
          </Card>
        ))}</div>
      )}
      {inv ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/50 p-4" role="dialog" aria-modal="true" aria-label="Rep invite">
          <div className="w-full max-w-[720px] border border-hair bg-canvas">
            <div className="flex items-center justify-between border-b border-hair px-4 py-3"><p className="text-[14px] font-semibold">Invite {inv.rep.name}: {inv.subject}</p><button type="button" onClick={() => setInv(null)} aria-label="Close"><X className="h-4 w-4" /></button></div>
            <iframe title="Invite preview" srcDoc={inv.html} sandbox="" className="block h-[520px] w-full bg-white" />
            <div className="flex justify-end gap-2 border-t border-hair p-3"><button type="button" onClick={() => setInv(null)} className={btn}>Close</button><button type="button" onClick={async () => { try { await sales("rep_invite", { id: inv.rep.id, confirm: true }); setMsg(`Invite sent to ${inv.rep.email}.`); setInv(null); q.refetch(); } catch (e) { setMsg(e.message); } }} className={btnInk}><Mail className="h-3.5 w-3.5" />Send invite</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function useQueryTracks() {
  const [list, setList] = useState([]);
  useEffect(() => { base44.entities.TrainingTrack.filter({ client_id: "agency" }, "-updated_date", 50).then((r) => setList(Array.isArray(r) ? r : [])).catch(() => setList([])); }, []);
  return list;
}

function Pay() {
  const comp = useSales("comp");
  const reps = useSales("reps");
  const [c, setC] = useState(null);
  const [msg, setMsg] = useState("");
  const [rid, setRid] = useState("");
  useEffect(() => { if (comp.data?.comp) setC(comp.data.comp); }, [comp.data]);
  const st = useSales("statement", { rep_id: rid }, { enabled: !!rid });
  if (!c) return comp.isError ? <ErrorNote error={comp.error} /> : <Loading />;
  const save = async () => { try { await sales("comp", { save: true, comp: c }); setMsg("Saved. Statements use the new rules."); comp.refetch(); } catch (e) { setMsg(e.message); } };
  return (
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title="Commission rules" kicker="Editable defaults · set your real plan">
        <p className="text-[12px] text-ink/55">{c.note}</p>
        <div className="mt-3 space-y-2">{(c.tiers || []).map((t, i) => (
          <div key={i} className="grid grid-cols-[1fr_1fr_32px] items-center gap-2 text-[12.5px]">
            <label>From {money(t.from)}/mo closed<input type="number" min="0" value={t.from} onChange={(e) => setC({ ...c, tiers: c.tiers.map((x, k) => (k === i ? { ...x, from: Number(e.target.value) } : x)) })} className={`${input} mt-1`} /></label>
            <label>Rate (%)<input type="number" min="0" max="50" step="0.5" value={Math.round(t.rate * 1000) / 10} onChange={(e) => setC({ ...c, tiers: c.tiers.map((x, k) => (k === i ? { ...x, rate: Number(e.target.value) / 100 } : x)) })} className={`${input} mt-1`} /></label>
            <button type="button" onClick={() => setC({ ...c, tiers: c.tiers.filter((_, k) => k !== i) })} aria-label="Remove tier" className="mt-5 text-ink/40 hover:text-red-700"><X className="h-4 w-4" /></button>
          </div>
        ))}<button type="button" onClick={() => setC({ ...c, tiers: [...(c.tiers || []), { from: 0, rate: 0.05 }] })} className={btn}><Plus className="h-3.5 w-3.5" />Tier</button></div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[12.5px]">
          <label>SEO subscription bonus ($ per new sub)<input type="number" min="0" value={c.seo_bonus_per_sub} onChange={(e) => setC({ ...c, seo_bonus_per_sub: Number(e.target.value) })} className={`${input} mt-1`} /></label>
          <label>Months of monthly value that count<input type="number" min="0" max="24" value={c.monthly_counts_months} onChange={(e) => setC({ ...c, monthly_counts_months: Number(e.target.value) })} className={`${input} mt-1`} /></label>
          <label>Default base retainer<input type="number" min="0" value={c.base_default} onChange={(e) => setC({ ...c, base_default: Number(e.target.value) })} className={`${input} mt-1`} /></label>
        </div>
        <button type="button" onClick={save} className={`${btnFlame} mt-3`}>Save rules</button>
        {msg ? <p className="mt-2 text-[12.5px] text-ink/65">{msg}</p> : null}
      </Card>
      <Card title="Earnings statements" kicker="What each rep sees on their own screen">
        <select value={rid} onChange={(e) => setRid(e.target.value)} className={input} aria-label="Rep"><option value="">Pick a rep…</option>{(reps.data?.reps || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
        {rid && st.data ? <Statements data={st.data} /> : null}
      </Card>
    </div>
  );
}

export function Statements({ data }) {
  return (
    <div className="mt-3 overflow-x-auto"><table className="w-full text-[12.5px]"><thead><tr className="border-b border-hair text-left">{["Month", "Base", "Closed revenue", "Rate", "Commission", "SEO bonus", "Total"].map((h) => <th key={h} className="mono-label px-2 py-1.5 text-[9px] font-normal text-ink/50">{h}</th>)}</tr></thead>
      <tbody>{data.statements.map((s) => <tr key={s.month} className="border-b border-hair/60"><td className="px-2 py-2 font-mono">{s.month}</td><td className="px-2 font-mono">{money(s.base)}</td><td className="px-2 font-mono">{money(s.revenue)}</td><td className="px-2 font-mono">{pct(s.tier_rate)}</td><td className="px-2 font-mono">{money(s.commission)}</td><td className="px-2 font-mono">{money(s.seo_bonus)}</td><td className="px-2 font-mono font-semibold">{money(s.total)}</td></tr>)}</tbody></table>
      <p className="mt-2 text-[11px] text-ink/45">1099 contractor statement. Commission counts deals marked won in the month.</p>
    </div>
  );
}

function Floors() {
  const q = useSales("floors");
  const [f, setF] = useState(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { if (q.data?.floors) setF(q.data.floors); }, [q.data]);
  if (!f) return q.isError ? <ErrorNote error={q.error} /> : <Loading />;
  return (
    <Card title="Price floors" kicker="Admin only · enforced on the server · never shown to reps or leads">
      <div className="grid gap-3 md:grid-cols-3">{[["website", "Website"], ["app", "Command System (app)"], ["bundle", "Website + app bundle"]].map(([k, l]) => <label key={k} className="text-[12.5px]">{l} minimum ($)<input type="number" min="0" value={f[k]} onChange={(e) => setF({ ...f, [k]: Number(e.target.value) })} className={`${input} mt-1`} /></label>)}</div>
      <p className="mt-2 text-[12px] text-ink/55">A rep's deal below a floor saves as “needs approval” and waits in Approvals. Reps only ever see “this price needs approval”.</p>
      <button type="button" onClick={async () => { try { await sales("floors", { save: true, floors: f }); setMsg("Saved."); } catch (e) { setMsg(e.message); } }} className={`${btnFlame} mt-3`}>Save floors</button>
      {msg ? <p className="mt-2 text-[12.5px] text-ink/65">{msg}</p> : null}
    </Card>
  );
}
