// Road to Dec 31 (/launch): the launch command center. Countdown, overall %, workstreams, client readiness,
// Justin's thin list (ordered by what it unblocks), Claude's queue, questions, the 9-week plan and the 2027 lane.
// Data: LaunchItem (audit records), CRMClient, User, EngineStart, completeness meter, approvals inbox.
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Check, ChevronDown, ChevronRight, Lock, Sparkles, User as UserIcon } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import { useCompletenessMap } from "@/features/clients/hooks";
import { useLaunchItems, useLaunchMutations, summarize, daysLeft, currentWeek, WEEKS, fmtHours, streamOf } from "./data";
import { loadFacts, APP_SCOPE, COMPLETE_AT } from "./engine";
import ApprovalsInbox, { useWaiting, waitingTotal } from "./ApprovalsInbox";
import ApprovalPolicy from "./ApprovalPolicy";
import OffersPanel from "./OffersPanel";

const TABS = [["mission", "Mission"], ["approvals", "Approvals"], ["policy", "Approval policy"], ["offers", "Offers"]];

function Bar({ pct, dark = false, h = "h-1.5" }) {
  return (
    <div className={`${h} w-full overflow-hidden ${dark ? "bg-white/10" : "bg-ink/[0.08]"}`}>
      <div className="h-full bg-gradient-to-r from-[#ff3c00] via-[#ff6a00] to-[#ffaa00] transition-[width] duration-700" style={{ width: `${Math.max(pct ? 2 : 0, pct)}%` }} />
    </div>
  );
}

function Section({ label, title, accent, right, children, id }) {
  return (
    <section id={id} className="mb-10">
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-cross text-ink/60">({label})</p>
          <h2 className="mt-2 text-[24px] font-semibold leading-none tracking-[-0.04em] md:text-[28px]">{title} <span className="text-[#ff3c00]">/{accent}</span></h2>
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function Hero({ s, waiting }) {
  const days = daysLeft();
  const week = currentWeek();
  const stats = [
    [s.blockingOpen, "blocking items open"],
    [s.moves.length, "your moves"],
    [s.claude.length, "Claude's queue"],
    [s.questions.filter((q) => !q.answer).length, "questions for you"],
    [waiting, "approvals waiting"],
  ];
  return (
    <div className="grain relative overflow-hidden border border-ink bg-ink px-5 py-6 text-white md:px-8 md:py-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#ff3c00]/25 blur-3xl" />
      <div className="relative grid gap-6 lg:grid-cols-[auto_1fr] lg:items-end">
        <div>
          <p className="mono-label text-[10px] text-[#ffaa00]">T-minus · launch Dec 31, 2026 · week {week} of 9</p>
          <p className="mt-2 font-mono text-[72px] font-semibold leading-none tracking-[-0.06em] tabular-nums md:text-[104px]">{String(days).padStart(2, "0")}</p>
          <p className="mono-label mt-1 text-[10.5px] text-white/55">days left</p>
        </div>
        <div className="min-w-0">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-[15px] font-medium text-white/80">Overall launch</p>
            <p className="font-mono text-[40px] font-semibold leading-none tabular-nums text-[#ff6a00]">{s.overall}%</p>
          </div>
          <div className="mt-3"><Bar pct={s.overall} dark h="h-2.5" /></div>
          <p className="mt-2 text-[12px] text-white/50">Weighted by effort across {s.live.length} launch items. 2027 work and questions are tracked separately.</p>
          <div className="mt-5 grid grid-cols-2 gap-px bg-white/10 sm:grid-cols-5">
            {stats.map(([v, l]) => (
              <div key={l} className="bg-ink px-3 py-2.5">
                <p className="font-mono text-[22px] font-semibold tabular-nums">{Number(v || 0).toLocaleString()}</p>
                <p className="mono-label text-[9px] text-white/45">{l}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function Workstreams({ s }) {
  return (
    <div className="grid gap-px border border-hair bg-hair sm:grid-cols-2 xl:grid-cols-4">
      {s.streams.map((w) => (
        <div key={w.name} className="bg-card px-4 py-3.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className="truncate text-[13.5px] font-medium">{w.name}</p>
            <p className="font-mono text-[15px] tabular-nums text-[#ff3c00]">{w.pct}%</p>
          </div>
          <div className="mt-2"><Bar pct={w.pct} /></div>
          <p className="mono-label mt-2 text-[9.5px] text-ink/45">{w.open} open · {w.blocking} blocking · {w.rows.length} total</p>
        </div>
      ))}
    </div>
  );
}

function Move({ item, s, onToggle }) {
  const [open, setOpen] = useState(false);
  const blockers = s.blockedBy(item);
  const done = item.status === "done";
  return (
    <li className={`border border-hair bg-card ${done ? "opacity-60" : ""}`}>
      <div className="flex items-start gap-3 px-4 py-3">
        <button type="button" onClick={() => onToggle(item, !done)} aria-label={done ? "Mark not done" : "Mark done"} className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border ${done ? "border-[#ff3c00] bg-[#ff3c00] text-white" : "border-ink/30 hover:border-[#ff3c00]"}`}>{done && <Check className="h-3.5 w-3.5" />}</button>
        <button type="button" onClick={() => setOpen(!open)} className="min-w-0 flex-1 text-left" aria-expanded={open}>
          <p className={`text-[13.5px] font-medium leading-snug ${done ? "line-through" : ""}`}>{item.title}</p>
          <p className="mono-label mt-1 text-[9.5px] text-ink/45">
            {item.client_name ? `${item.client_name} · ` : ""}{fmtHours(item.effort_hours)} · week {item.week || "–"}{item.unblocks ? ` · unblocks ${item.unblocks}` : ""}{item.blocking_launch ? " · blocking" : ""}
          </p>
          {blockers.length > 0 && !done && <p className="mt-1 inline-flex items-center gap-1 text-[11.5px] text-ink/50"><Lock className="h-3 w-3" /> After: {blockers.map((b) => b.title).slice(0, 2).join("; ")}</p>}
        </button>
        {open ? <ChevronDown className="mt-1 h-4 w-4 shrink-0 text-ink/40" /> : <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-ink/40" />}
      </div>
      {open && (
        <div className="border-t border-hair px-4 py-3 pl-12">
          {item.why_it_matters && <p className="mb-2 text-[12.5px] text-ink/65">{item.why_it_matters}</p>}
          {(item.justin_steps || []).length > 0 && (
            <ol className="space-y-1.5">
              {item.justin_steps.map((st, i) => <li key={i} className="flex gap-2 text-[12.5px]"><span className="font-mono text-[#ff3c00]">{i + 1}.</span><span>{st}</span></li>)}
            </ol>
          )}
          {item.source && <p className="mt-2 font-mono text-[10.5px] text-ink/40">Evidence: {item.source}</p>}
        </div>
      )}
    </li>
  );
}

function Question({ item, onAnswer }) {
  const [text, setText] = useState(item.answer || "");
  const [saving, setSaving] = useState(false);
  const answered = !!item.answer;
  return (
    <li className={`border bg-card px-4 py-3 ${answered ? "border-hair opacity-70" : "border-[#ff3c00]/35"}`}>
      <p className="text-[13.5px] font-medium leading-snug">{item.title}</p>
      <p className="mt-0.5 text-[12px] text-ink/55">{item.why_it_matters}{item.unblocks ? ` · unblocks ${item.unblocks}` : ""}</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={1} placeholder="Your answer (Claude acts on it next run)" className="min-h-[36px] flex-1 resize-y border border-hair bg-canvas px-3 py-2 text-[12.5px] outline-none focus:border-[#ff3c00]" />
        <button type="button" disabled={saving || text === (item.answer || "")} onClick={async () => { setSaving(true); try { await onAnswer(item, text); } finally { setSaving(false); } }} className="h-9 shrink-0 bg-ink px-4 text-[12.5px] font-medium text-white hover:bg-[#ff3c00] disabled:opacity-40">{saving ? "Saving…" : answered ? "Update" : "Answer"}</button>
      </div>
    </li>
  );
}

function Light({ ok, label, na }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-[11.5px] ${na ? "text-ink/35" : ok ? "text-ink" : "text-ink/50"}`}>
      <span className={`h-2 w-2 ${na ? "border border-ink/20" : ok ? "bg-[#ff3c00]" : "border border-ink/35"}`} />{label}
    </span>
  );
}

function ClientCards({ items }) {
  const clients = useQuery({ queryKey: ["CRMClient", "active", "launch"], queryFn: async () => (await base44.entities.CRMClient.filter({ status: "Active" }, "business", 100)) || [] });
  const users = useQuery({ queryKey: ["User", "launch"], queryFn: async () => (await base44.entities.User.list("-created_date", 500).catch(() => [])) || [] });
  const facts = useQuery({ queryKey: ["launchFacts"], queryFn: loadFacts });
  const starts = useQuery({ queryKey: ["EngineStart", "all"], queryFn: async () => (await base44.entities.EngineStart.list("-started_at", 200).catch(() => [])) || [] });
  const comp = useCompletenessMap(clients.data || []).data || {};
  const emails = new Set((users.data || []).filter((u) => u.role !== "admin").map((u) => String(u.email || "").toLowerCase()));
  const byKey = Object.fromEntries(items.map((i) => [i.key, i]));
  const rows = (clients.data || []).map((c) => {
    const f = (facts.data || {})[c.id] || {};
    const app = APP_SCOPE[c.id];
    const appDone = app ? app.keys.every((k) => byKey[k] && (byKey[k].status === "done" || (byKey[k].kind === "question" && byKey[k].answer))) : null;
    const loggedIn = (c.portal_emails || []).some((e) => emails.has(String(e).toLowerCase()));
    const pct = comp[c.id];
    const engine = (starts.data || []).find((s) => s.client_id === c.id);
    const open = items.filter((i) => i.client_id === c.id && i.status !== "done" && (i.lane || "launch") === "launch" && i.kind !== "question");
    const checks = [!!c.portal_enabled, loggedIn, !!f.live, (pct || 0) >= COMPLETE_AT, app ? appDone : true, !!engine];
    return { c, f, app, appDone, loggedIn, pct, engine, open, score: checks.filter(Boolean).length };
  }).sort((a, b) => b.score - a.score || a.c.business.localeCompare(b.c.business));
  if (clients.isLoading) return <p className="text-[13px] text-ink/50">Loading clients…</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {rows.map(({ c, f, app, appDone, loggedIn, pct, engine, open, score }) => (
        <Link key={c.id} to={`/clients/${c.id}`} className="group border border-hair bg-card px-4 py-3.5 transition-colors hover:border-ink/35">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 truncate text-[14px] font-semibold tracking-[-0.02em]">{c.business}</p>
            <span className="font-mono text-[12px] tabular-nums text-[#ff3c00]">{score}/6</span>
          </div>
          <p className="mt-0.5 truncate text-[11.5px] text-ink/45">{f.domain || c.domain}{f.live ? " · on Base44" : f.old ? ` · still ${f.old}` : ""}</p>
          <div className="mt-2"><Bar pct={Math.round((score / 6) * 100)} /></div>
          <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1">
            <Light ok={!!c.portal_enabled} label="Portal on" />
            <Light ok={loggedIn} label="Client logged in" />
            <Light ok={!!f.live} label="New site live" />
            <Light ok={(pct || 0) >= COMPLETE_AT} label={`Profile ${pct ?? "…"}%`} />
            <Light ok={!!appDone} na={!app} label={app ? "App done" : "No app due"} />
            <Light ok={!!engine} label="Engine running" />
          </div>
          <p className="mono-label mt-2.5 text-[9.5px] text-ink/45 group-hover:text-[#ff3c00]">{open.length} open launch items <ArrowUpRight className="inline h-3 w-3" /></p>
        </Link>
      ))}
    </div>
  );
}

function ClaudeQueue({ s }) {
  const jobs = useQuery({ queryKey: ["ClaudeJob", "launchCounts"], queryFn: async () => (await base44.entities.ClaudeJob.filter({ status: { $in: ["queued", "running"] } }, "-created_date", 200).catch(() => [])) || [] });
  const byWeek = WEEKS.map((w) => ({ w, rows: s.claude.filter((i) => (i.week || 9) === w.n && i.lane !== "2027") })).filter((x) => x.rows.length);
  return (
    <div>
      <p className="mb-3 text-[12.5px] text-ink/60">{(jobs.data || []).length} Claude jobs queued or running now; the hourly queue runner (7 AM–9 PM PT) picks them up. Launch work by week:</p>
      <div className="space-y-3">
        {byWeek.map(({ w, rows }) => (
          <div key={w.n} className="border border-hair bg-card">
            <p className="mono-label border-b border-hair px-4 py-2 text-[10px] text-ink/55">Week {w.n} · {w.label} · {rows.length} items · {fmtHours(rows.reduce((n, i) => n + (Number(i.effort_hours) || 0), 0))}</p>
            <ul>
              {rows.map((i) => (
                <li key={i.id} className="flex gap-3 border-b border-hair/60 px-4 py-2 last:border-0">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#ff6a00]" />
                  <div className="min-w-0">
                    <p className="text-[12.5px] font-medium leading-snug">{i.title}{i.client_name && !i.title.includes(i.client_name) ? <span className="font-normal text-ink/45"> · {i.client_name}</span> : null}</p>
                    {i.claude_plan && <p className="text-[11.5px] text-ink/50">{i.claude_plan}</p>}
                    {s.blockedBy(i).length > 0 && <p className="text-[11px] text-[#c23000]">Waiting on: {s.blockedBy(i).map((b) => b.title).slice(0, 2).join("; ")}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}

function Plan({ items }) {
  const now = currentWeek();
  return (
    <div className="no-scrollbar -mx-5 overflow-x-auto px-5 md:mx-0 md:px-0">
      <div className="grid min-w-[860px] grid-cols-9 gap-px border border-hair bg-hair">
        {WEEKS.map((w) => {
          const rows = items.filter((i) => (i.week || 9) === w.n && (i.lane || "launch") === "launch" && i.kind !== "question");
          const mine = rows.filter((i) => i.owner === "justin");
          const hrs = mine.reduce((n, i) => n + (Number(i.effort_hours) || 0), 0);
          return (
            <div key={w.n} className={`flex flex-col px-3 py-3 ${w.n === now ? "bg-ink text-white" : "bg-card"}`}>
              <p className={`mono-label text-[9.5px] ${w.n === now ? "text-[#ffaa00]" : "text-ink/45"}`}>Week {w.n}</p>
              <p className="mt-0.5 text-[12.5px] font-semibold">{w.label}</p>
              <p className={`text-[11.5px] ${w.n === now ? "text-white/70" : "text-[#ff3c00]"}`}>{w.theme}</p>
              <p className={`mt-2 text-[11px] leading-snug ${w.n === now ? "text-white/60" : "text-ink/55"}`}>{w.note}</p>
              <div className={`mt-auto pt-3 text-[10.5px] ${w.n === now ? "text-white/60" : "text-ink/50"}`}>
                <p className="flex items-center gap-1"><UserIcon className="h-3 w-3" /> You: {mine.length} · {fmtHours(hrs)}</p>
                <p className="flex items-center gap-1"><Sparkles className="h-3 w-3" /> Claude: {rows.filter((i) => i.owner === "claude").length}</p>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11.5px] text-ink/50">Your hands-on time stays inside the KB limits (website ≤3 days, Command System ≤5 days, setup 1 day each): Claude builds and QA's, you approve, publish and save DNS. Sales calls are not on this plan.</p>
    </div>
  );
}

export default function LaunchPage() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") || "mission";
  const go = (t) => setParams(t === "mission" ? {} : { tab: t }, { replace: true });
  const q = useLaunchItems();
  const m = useLaunchMutations();
  const waiting = useWaiting();
  const items = q.data || [];
  const s = useMemo(() => summarize(items), [items]);
  const [showDone, setShowDone] = useState(false);
  const moves = showDone ? s.moves.concat(items.filter((i) => i.owner === "justin" && i.status === "done" && i.kind !== "question")) : s.moves;
  const wt = waitingTotal(waiting.data);

  return (
    <div className="min-h-screen bg-background pb-16">
      <PageHeader breadcrumb="Command / Road to Dec 31" title="Road to Dec 31" rightText="Launch · Dec 31, 2026" />
      <div className="px-5 pt-6 md:px-8">
        {q.isLoading ? <p className="py-10 text-[13px] text-ink/50">Loading the launch plan…</p> : <Hero s={s} waiting={wt} />}
        <nav className="no-scrollbar mt-6 flex overflow-x-auto border-b border-hair">
          {TABS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => go(k)} className={`whitespace-nowrap border-b-2 px-3.5 py-2.5 text-[13px] font-medium ${tab === k ? "border-[#ff3c00] text-ink" : "border-transparent text-ink/50 hover:text-ink"}`}>
              {l}{k === "approvals" && wt ? <span className="ml-1.5 font-mono text-[11px] text-[#ff3c00]">{wt.toLocaleString()}</span> : null}
            </button>
          ))}
        </nav>
        <div key={tab} className="page-enter pt-6">
          {tab === "mission" && !q.isLoading && (
            <>
              <Section label="Progress" title="Workstreams" accent="status"><Workstreams s={s} /></Section>
              <div className="grid gap-x-8 xl:grid-cols-2">
                <Section id="moves" label="Only what needs you" title="Your" accent="moves" right={<button type="button" onClick={() => setShowDone(!showDone)} className="text-[12px] text-ink/50 hover:text-ink">{showDone ? "Hide done" : "Show done"}</button>}>
                  <p className="mb-3 text-[12.5px] text-ink/60">Ordered by what each one unblocks. Calls, payments, logins, DNS, publishing and final approvals only; everything else is Claude's.</p>
                  <ul className="space-y-2">{moves.map((i) => <Move key={i.id} item={i} s={s} onToggle={m.setDone} />)}</ul>
                </Section>
                <Section id="questions" label="Unblock autonomous work" title="Questions for" accent="Justin">
                  <p className="mb-3 text-[12.5px] text-ink/60">Short answers are enough. Each one lets Claude run something on its own.</p>
                  <ul className="space-y-2">{s.questions.map((i) => <Question key={i.id} item={i} onAnswer={m.answer} />)}</ul>
                </Section>
              </div>
              <Section label="Clients" title="Launch" accent="readiness" right={<span className="mono-label text-[10px] text-ink/45">portal · login · site · profile ≥{COMPLETE_AT}% · app · engine</span>}><ClientCards items={items} /></Section>
              <Section label="9 weeks" title="Week-by-week" accent="plan"><Plan items={items} /></Section>
              <Section label="Claude + agents" title="Claude's" accent="queue"><ClaudeQueue s={s} /></Section>
              <Section label="After launch" title="The 2027" accent="lane">
                <div className="grid gap-px border border-hair bg-hair sm:grid-cols-2 xl:grid-cols-3">
                  {s.later.map((i) => (
                    <div key={i.id} className="bg-card px-4 py-3">
                      <p className="text-[13px] font-medium">{i.title}</p>
                      <p className="text-[11.5px] text-ink/50">{i.why_it_matters}</p>
                      <p className="mono-label mt-1 text-[9.5px] text-ink/40">{streamOf(i)}{i.client_name ? ` · ${i.client_name}` : ""}</p>
                    </div>
                  ))}
                </div>
              </Section>
            </>
          )}
          {tab === "approvals" && <ApprovalsInbox />}
          {tab === "policy" && <ApprovalPolicy />}
          {tab === "offers" && <OffersPanel />}
        </div>
      </div>
    </div>
  );
}
