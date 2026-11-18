// Portal v2 pages that are new in the "new-age portal": Your Brain, Mentions & PR, Billing, and the
// "Do it yourself / Have us do it" strip every Studio shows on top. Real data only; designed empty states otherwise.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Brain, Check, Loader2, Send, ArrowUpRight, Link2, Newspaper, CreditCard, Fuel, Store, Wrench, Users, Lock, Sparkles } from "lucide-react";
import { fmtDate } from "@/lib/useData";
import { analyze, freqLabel } from "@/features/financing/schedule";
import RequestHelpButton from "@/features/studios/RequestHelpButton";
import FuelMeter from "@/features/fuel/FuelMeter";
import { inPeriod } from "./PortalHomeV2";

function Title({ eyebrow, children, sub }) {
  return (
    <div>
      <p className="label-cross">({eyebrow})</p>
      <h2 className="mt-2 text-[30px] font-semibold leading-[1.02] tracking-[-0.045em] sm:text-[40px]">{children}</h2>
      {sub && <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-ink/60">{sub}</p>}
    </div>
  );
}
const Card = ({ className = "", children }) => <div className={`overflow-hidden rounded-lg border border-hair bg-card ${className}`}>{children}</div>;
function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="px-5 py-10 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#ff3c00]/10"><Icon className="h-5 w-5 text-[#ff3c00]" /></span>
      <p className="mt-3 text-[16px] font-semibold tracking-[-0.02em]">{title}</p>
      <p className="mx-auto mt-1 max-w-md text-[13.5px] leading-relaxed text-ink/55">{children}</p>
    </div>
  );
}

// ------------------------------------------------------------------ Your Brain
function Answer({ q, call, onSaved, preview }) {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  const save = async () => {
    if (!v.trim() || busy) return;
    setBusy(true); setErr("");
    try { await call("brain_answer", { q: q.q, answer: v.trim() }); setDone(true); onSaved(); }
    catch (e) { setErr(e?.response?.data?.error || "Couldn't save that. Try again."); }
    finally { setBusy(false); }
  };
  return (
    <li className="px-4 py-4 sm:px-6">
      <p className="text-[15px] font-semibold leading-snug tracking-[-0.01em]">{q.q}</p>
      {done ? <p className="mt-2 inline-flex items-center gap-1.5 text-[13px] text-green-700"><Check className="h-4 w-4" /> {preview ? "Preview: answers save from the client's own login." : "Saved. Our team adds it to your Brain."}</p> : (
        <>
          <textarea aria-label={`Answer: ${q.q}`} rows={2} value={v} onChange={(e) => setV(e.target.value)} placeholder="Your answer" className="mt-2 w-full resize-none rounded-md border border-hair bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#ff3c00]" />
          <div className="mt-2 flex items-center gap-3">
            <button type="button" onClick={save} disabled={!v.trim() || busy} className="flame-bg inline-flex h-10 items-center gap-2 rounded-md px-4 text-[13px] font-semibold text-white disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Save</button>
            {err && <span role="alert" className="text-[12px] text-red-700">{err}</span>}
          </div>
        </>
      )}
    </li>
  );
}

export function BrainView({ call, scopeId, business, preview, openAudit }) {
  const q = useQuery({ queryKey: ["portal", scopeId, "brain"], queryFn: () => call("brain"), retry: false });
  const b = q.data;
  const pct = b?.pct;
  return (
    <div className="space-y-5">
      <Title eyebrow="Your Brain" sub={`Everything your business runs on starts here. The more ${business || "your Brain"} knows, the more runs itself: posts, emails, estimates and answers all draw on it.`}>
        Your Business <span className="text-[#ff3c00]">Brain</span>
      </Title>
      {q.isLoading ? <p className="text-[13px] text-ink/50">Loading…</p> : q.isError ? <Card><EmptyState icon={Brain} title="Couldn't load your Brain">Try again in a moment, or message us.</EmptyState></Card> : (
        <>
          <Card className="band-dark pv2-grain border-0">
            <div className="grid gap-5 p-5 sm:grid-cols-[auto_1fr] sm:items-center sm:p-6">
              <div className="relative mx-auto h-[112px] w-[112px]" aria-hidden="true">
                <svg viewBox="0 0 36 36" className="h-full w-full -rotate-90"><circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="3" /><circle cx="18" cy="18" r="15.5" fill="none" stroke="url(#pv2g)" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${((pct ?? 0) / 100) * 97.4} 97.4`} className="transition-[stroke-dasharray] duration-1000" /><defs><linearGradient id="pv2g"><stop offset="0" stopColor="#ff3c00" /><stop offset=".55" stopColor="#ff6a00" /><stop offset="1" stopColor="#ffaa00" /></linearGradient></defs></svg>
                <span className="absolute inset-0 flex flex-col items-center justify-center text-white"><span className="text-[26px] font-semibold tabular-nums tracking-[-0.04em]">{pct == null ? "—" : `${pct}%`}</span><span className="mono-label text-[8px] text-white/50">known</span></span>
              </div>
              <div className="text-white">
                <p className="text-[19px] font-semibold tracking-[-0.03em]">{pct == null ? "Your Brain is getting started" : pct >= 80 ? "Your Brain knows your business well" : "Every answer makes more of it run on its own"}</p>
                <p className="mt-1 text-[13px] text-white/60">{b?.facts_count || 0} things known{b?.answered != null && b?.total ? ` · ${b.answered} of ${b.total} questions answered in your Command System` : ""} · {b?.questions?.length || 0} {b?.questions?.length === 1 ? "question" : "questions"} waiting</p>
              </div>
            </div>
          </Card>

          <Card>
            <header className="border-b border-hair px-4 py-3.5 sm:px-6"><p className="mono-label text-[9.5px] text-ink/50">Questions for you</p><h3 className="text-[18px] font-semibold tracking-[-0.02em]">Teach it something</h3></header>
            {b?.questions?.length ? (
              <ul className="divide-y divide-hair">{b.questions.map((x) => <Answer key={x.q} q={x} call={call} onSaved={() => q.refetch()} preview={preview} />)}</ul>
            ) : <EmptyState icon={Check} title="No questions waiting">When we need to know something about how you work, the question shows up here and on your home screen.</EmptyState>}
          </Card>

          <div className="grid gap-4 lg:grid-cols-2 [&>*]:min-w-0">
            <Card>
              <header className="border-b border-hair px-4 py-3.5 sm:px-6"><p className="mono-label text-[9.5px] text-ink/50">What we know</p><h3 className="text-[18px] font-semibold tracking-[-0.02em]">Your business at a glance</h3></header>
              {b?.sections?.length ? (
                <ul className="divide-y divide-hair">{b.sections.map((s) => (
                  <li key={s.key} className="px-4 py-3.5 sm:px-6"><p className="mono-label text-[9px] text-[#ff3c00]">{s.label}</p><p className="mt-1 whitespace-pre-line text-[13.5px] leading-relaxed text-ink/75">{s.text}</p></li>
                ))}</ul>
              ) : <EmptyState icon={Brain} title="Filling in as we learn">Your offers, customers, brand and voice show here as we write them into your Brain.</EmptyState>}
            </Card>
            <Card>
              <header className="border-b border-hair px-4 py-3.5 sm:px-6"><p className="mono-label text-[9.5px] text-ink/50">Your answers</p><h3 className="text-[18px] font-semibold tracking-[-0.02em]">From your Command System</h3></header>
              {b?.facts?.length ? (
                <ul className="divide-y divide-hair">{b.facts.map((f) => (
                  <li key={f.id} className="px-4 py-3 sm:px-6">{f.question && <p className="text-[12px] text-ink/50">{f.question}</p>}<p className="mt-0.5 text-[13.5px] font-medium leading-snug">{f.answer}</p><p className="mt-1 text-[11px] text-ink/40">{String(f.area).replace(/_/g, " ")}{f.at ? ` · ${fmtDate(String(f.at).slice(0, 10))}` : ""}</p></li>
                ))}</ul>
              ) : <EmptyState icon={Brain} title="Nothing synced yet">Answers you give inside your own Command System app show up here automatically.</EmptyState>}
            </Card>
          </div>
          {openAudit && (
            <button type="button" onClick={openAudit} className="card-hover flex w-full items-center gap-3 rounded-lg border border-hair bg-card p-4 text-left sm:p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md flame-bg text-white"><Brain className="h-[18px] w-[18px]" /></span>
              <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold">Tell us how your business runs</span><span className="block text-[12.5px] text-ink/55">The business audit: answer what you can, it saves as you go.</span></span>
              <ArrowUpRight className="h-4 w-4 text-ink/40" />
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ------------------------------------------------------------------ Mentions & PR
export function MentionsView({ d }) {
  const items = (Array.isArray(d.work_feed) ? d.work_feed : []).filter((w) => w.category === "citations");
  const month = items.filter((w) => inPeriod(w.date, "month")).length;
  return (
    <div className="space-y-5">
      <Title eyebrow="Mentions & PR" sub="Directory listings, press, mentions and links our team earned for you. Each one helps Google, Bing and AI search trust your business.">
        Where <span className="text-[#ff3c00]">{d.client.business}</span> shows up
      </Title>
      <div className="grid grid-cols-2 gap-2.5 sm:max-w-md">
        <div className="rounded-md border border-hair bg-card p-4"><p className="text-[30px] font-semibold tabular-nums tracking-[-0.045em]">{items.length}</p><p className="mono-label text-[9.5px] text-ink/50">All time</p></div>
        <div className="rounded-md border border-hair bg-card p-4"><p className="text-[30px] font-semibold tabular-nums tracking-[-0.045em] text-[#ff3c00]">{month}</p><p className="mono-label text-[9.5px] text-ink/50">This month</p></div>
      </div>
      <Card>
        {items.length ? (
          <ul className="divide-y divide-hair">{items.map((w) => (
            <li key={w.id} className="flex gap-3 px-4 py-3.5 sm:px-6">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair bg-paper"><Link2 className="h-4 w-4 text-[#ff3c00]" /></span>
              <div className="min-w-0 flex-1"><p className="text-[14.5px] font-semibold leading-snug">{w.title}</p>{w.summary && <p className="mt-0.5 text-[13px] text-ink/60">{w.summary}</p>}<p className="mt-1 text-[11.5px] text-ink/45">{w.date ? fmtDate(w.date) : ""}</p></div>
              {w.url && <a href={w.url} target="_blank" rel="noreferrer" aria-label={`Open ${w.title}`} className="flex h-10 w-10 items-center justify-center text-ink/40 hover:text-[#ff3c00]"><ArrowUpRight className="h-4 w-4" /></a>}
            </li>
          ))}</ul>
        ) : <EmptyState icon={Newspaper} title="Your first mentions land here">As we list you in directories and earn press and links, every one is logged here with a link to see it live.</EmptyState>}
      </Card>
    </div>
  );
}

// ------------------------------------------------------------------ Billing
const money = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function BillingView({ d, fuel, go, scopeId, preview, onRefuel }) {
  const plans = d.needs_you?.financing || [];
  return (
    <div className="space-y-5">
      <Title eyebrow="Billing" sub="Your plan, any payment plans and your monthly fuel, in one place.">Billing &amp; <span className="text-[#ff3c00]">plan</span></Title>
      <div className="grid gap-4 lg:grid-cols-3 [&>*]:min-w-0">
        <Card className="p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-ink text-white"><CreditCard className="h-4 w-4" /></span>
          <p className="mono-label mt-3 text-[9.5px] text-ink/50">Your plan</p>
          <p className="mt-1 text-[19px] font-semibold tracking-[-0.03em]">{d.client.plan || "Set up with your account manager"}</p>
          <p className="mt-1 text-[12.5px] text-ink/55">Invoices and receipts come by email from our billing system.</p>
        </Card>
        <Card className="p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md flame-bg text-white"><Fuel className="h-4 w-4" /></span>
          <p className="mono-label mt-3 text-[9.5px] text-ink/50">Monthly fuel</p>
          {fuel ? (
            <div className="-mx-1 mt-2"><FuelMeter fuel={fuel} compact onRefuel={onRefuel} /></div>
          ) : <p className="mt-1 text-[13px] text-ink/55">Your fuel gauge shows here once it loads. Studios and Nøva use fuel; it resets each month.</p>}
        </Card>
        <Card className="p-5">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-ink text-white"><Store className="h-4 w-4" /></span>
          <p className="mono-label mt-3 text-[9.5px] text-ink/50">Add-ons</p>
          <p className="mt-1 text-[19px] font-semibold tracking-[-0.03em]">Upgrades</p>
          <p className="mt-1 text-[12.5px] text-ink/55">Try new features free, then keep the ones you like.</p>
          <button type="button" onClick={() => go("upgrades")} className="mt-3 h-10 rounded-md border border-hair bg-paper px-3.5 text-[13px] font-medium hover:border-[#ff3c00] hover:text-[#ff3c00]">Open Upgrades</button>
        </Card>
      </div>
      <Card>
        <header className="border-b border-hair px-4 py-3.5 sm:px-6"><p className="mono-label text-[9.5px] text-ink/50">Payment plans</p><h3 className="text-[18px] font-semibold tracking-[-0.02em]">{plans.length ? "Your schedule" : "No payment plans"}</h3></header>
        {plans.length ? (
          <ul className="divide-y divide-hair">{plans.map((p) => {
            const a = analyze(p);
            const paid = a.installments.filter((x) => x.state === "paid").length;
            return (
              <li key={p.id} className="px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-baseline justify-between gap-2"><p className="text-[15px] font-semibold">{p.title}</p><p className="text-[12.5px] text-ink/55">{money(p.payment_amount)} · {freqLabel(p.frequency)}</p></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink/[0.08]"><div className="h-full rounded-full bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)]" style={{ width: `${a.installments.length ? (paid / a.installments.length) * 100 : 0}%` }} /></div>
                <p className="mt-1.5 text-[12.5px] text-ink/60">{paid} of {a.installments.length} paid{a.next ? ` · next ${money(a.next.amount)} on ${fmtDate(a.next.date.toISOString().slice(0, 10))}` : " · paid off"}{a.installments.some((x) => x.state === "late") ? <span className="font-medium text-red-700"> · past due</span> : null}</p>
              </li>
            );
          })}</ul>
        ) : <p className="px-4 py-4 text-[13.5px] text-ink/55 sm:px-6">You don&apos;t have a payment plan with us. If you take one on, its schedule shows here.</p>}
      </Card>
      <div className="flex flex-wrap items-center gap-3"><p className="text-[13px] text-ink/55">Question about a bill?</p><RequestHelpButton studio="billing" studioLabel="Billing" scopeId={scopeId} preview={preview} context="Portal > Billing" placeholder="What would you like to know about your bill?" compact /></div>
    </div>
  );
}

// ------------------------------------------------------------------ Studios: Do it yourself | Have us do it
export function StudioDuo({ label, studio, state, scopeId, preview }) {
  // state: "on" (tool below is live) | "preview" (unlocking soon) | "plan" (HyperCare+) | "soon" (coming soon) | "free"
  const diy = {
    on: ["Open and ready below", "Use the tool yourself, any time."],
    free: ["Free for life, ready below", "Make as many as you like."],
    preview: ["Unlocking soon", "We switch it on for you when it's ready."],
    plan: ["Included with HyperCare+", "Upgrade and it unlocks right here."],
    soon: ["Coming soon", "We'll tell you the moment it's live."],
  }[state] || ["Ready below", ""];
  const ready = state === "on" || state === "free";
  return (
    <div className="grid gap-2.5 sm:grid-cols-2" data-studio-duo={studio}>
      <div className={`flex items-center gap-3 rounded-lg border p-4 ${ready ? "border-ink bg-white" : "border-hair bg-card"}`}>
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${ready ? "bg-ink text-white" : "bg-ink/[0.06] text-ink/50"}`}>{ready ? <Wrench className="h-[18px] w-[18px]" /> : <Lock className="h-4 w-4" />}</span>
        <div className="min-w-0"><p className="mono-label text-[9.5px] text-ink/50">Do it yourself</p><p className="text-[15px] font-semibold leading-tight tracking-[-0.02em]">{diy[0]}</p><p className="truncate text-[12px] text-ink/55">{diy[1]}</p></div>
      </div>
      <div className="flex items-center gap-3 rounded-lg border border-[#ff3c00]/40 bg-white p-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md flame-bg text-white"><Users className="h-[18px] w-[18px]" /></span>
        <div className="min-w-0 flex-1"><p className="mono-label text-[9.5px] text-ink/50">Have us do it</p><p className="text-[15px] font-semibold leading-tight tracking-[-0.02em]">Our team handles it</p><p className="truncate text-[12px] text-ink/55">Tell us what you need. We reply within 1 business day.</p></div>
        <RequestHelpButton studio={studio} studioLabel={label} scopeId={scopeId} preview={preview} context={`Portal > Studios > ${label}`} placeholder={`What should we do in ${label}?`} compact />
      </div>
    </div>
  );
}

// Playbook tab when nothing is published yet.
export function PlaybookPending({ business }) {
  return (
    <div className="space-y-5">
      <Title eyebrow="Your playbook">Your growth <span className="text-[#ff3c00]">playbook</span></Title>
      <Card><EmptyState icon={Sparkles} title="Being written for you">We write {business ? `${business}'s` : "your"} industry playbook from your Brain: the moves that grow businesses like yours, in order. It appears here once it's ready.</EmptyState></Card>
    </div>
  );
}
