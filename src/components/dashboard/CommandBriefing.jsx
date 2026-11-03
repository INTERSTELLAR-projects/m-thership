import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle, ArrowUpRight, CalendarCheck, ChevronDown, Gauge, Inbox, Loader2, Megaphone, Radar, RefreshCw,
  Repeat, Scale, Sparkles, Square, Star, Target, Users, Volume2,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { compactMoney, money } from "@/components/financial/finance/metrics";
import { CountUp, FinanceStyles } from "@/components/financial/finance/ui";
import { loadBriefing } from "@/features/briefing/loadBriefing";
import { pickOneThing, polishOneThing, spokenBriefing } from "@/features/briefing/oneThing";
import { speak, stopSpeaking } from "@/features/tasks/lib/speech";
import { fmtDate } from "@/lib/useData";

// Mission Control's Command Briefing: the day in ten seconds. Every number is live from the
// current entities (see features/briefing/loadBriefing.js); empty sections collapse.
const COLLAPSE_KEY = "command_briefing_collapsed";
const OUTREACH_ROUTE = "/backlinks";

const readCollapsed = () => {
  try { return localStorage.getItem(COLLAPSE_KEY) === "1"; } catch { return false; }
};
const writeCollapsed = (v) => {
  try { localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0"); } catch { /* per-viewer convenience only */ }
};
const count = (v) => Math.round(v).toString();
const pct = (v) => `${Math.round(v)}%`;
const dayCount = (d) => (d === 0 ? "today" : d === 1 ? "1 day" : `${d} days`);

export default function CommandBriefing() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["CommandBriefing"], queryFn: loadBriefing, refetchInterval: 5 * 60 * 1000, staleTime: 60 * 1000 });
  const me = useQuery({ queryKey: ["auth", "me"], queryFn: () => base44.auth.me(), staleTime: 300000 });
  const b = q.data;
  const one = useMemo(() => (b ? pickOneThing(b) : null), [b]);
  const [polished, setPolished] = useState(null);
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [details, setDetails] = useState(false);
  const [talking, setTalking] = useState(false);
  const firstName = String(me.data?.full_name || "").split(" ")[0];

  useEffect(() => {
    if (!b || !one) return undefined;
    let alive = true;
    polishOneThing(b, one).then((line) => { if (alive) setPolished(line); });
    return () => { alive = false; };
  }, [b, one]);
  useEffect(() => () => stopSpeaking(), []);

  const toggleCollapse = () => { setCollapsed((v) => { writeCollapsed(!v); return !v; }); };
  const readAloud = () => {
    if (talking) { stopSpeaking(); setTalking(false); return; }
    if (!b || !one) return;
    setTalking(true);
    speak(spokenBriefing(b, polished || one.text, firstName), { onEnd: () => setTalking(false) }, { muted: false });
  };

  const now = new Date();
  const hour = now.getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const dateLine = now.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

  return (
    <section className="px-5 pt-6 md:px-8">
      <FinanceStyles />
      <div className="band-dark grain fin-rise relative overflow-hidden rounded-md border border-ink">
        <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: "linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)" }} />
        <div className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full opacity-25 blur-3xl" style={{ background: "radial-gradient(circle,#ff3c00,transparent 70%)" }} />
        <div className="relative p-4 md:p-6">
          <div className="flex items-start justify-between gap-3">
            <p className="mono-label text-[9.5px] text-white/50">(Command briefing) · MØTHERSHIP™</p>
            <div className="flex shrink-0 items-center gap-1.5">
              <HeroButton onClick={readAloud} disabled={!b} title={talking ? "Stop" : "Read it aloud (Core voice)"}>
                {talking ? <Square className="h-3 w-3" /> : <Volume2 className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">{talking ? "Stop" : "Brief me"}</span>
              </HeroButton>
              <HeroButton onClick={() => qc.invalidateQueries({ queryKey: ["CommandBriefing"] })} title="Refresh">
                <RefreshCw className={`h-3.5 w-3.5 ${q.isFetching ? "animate-spin" : ""}`} />
              </HeroButton>
              <HeroButton onClick={toggleCollapse} title={collapsed ? "Expand" : "Collapse"}>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${collapsed ? "" : "rotate-180"}`} />
              </HeroButton>
            </div>
          </div>

          <h2 className="mt-2 text-[22px] font-semibold leading-tight tracking-[-0.03em] text-white md:text-[30px]">
            {hello}{firstName ? `, ${firstName}` : ""}.
          </h2>
          <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-[0.12em] text-white/45">{dateLine}</p>

          {q.isLoading ? (
            <p className="mt-4 flex items-center gap-2 text-[13px] text-white/55"><Loader2 className="h-4 w-4 animate-spin" />Assembling today&apos;s briefing…</p>
          ) : q.isError || !b ? (
            <p className="mt-4 text-[13px] text-[#ff6a00]">Couldn&apos;t load the briefing. Hit refresh.</p>
          ) : (
            <>
              <Link to={one.to} className="group mt-4 block max-w-3xl">
                <p className="mono-label text-[9px] text-white/45">The one thing{polished ? " · polished" : ""}</p>
                <p className="flame-text mt-1 text-[18px] font-semibold leading-snug tracking-[-0.02em] md:text-[24px]">
                  {polished || one.text}
                  <ArrowUpRight className="ml-1 inline h-4 w-4 text-[#ff6a00] opacity-60 transition-opacity group-hover:opacity-100 md:h-5 md:w-5" />
                </p>
              </Link>
              <StatusChips b={b} />
            </>
          )}
        </div>
      </div>

      {b && !collapsed && (
        <>
          <KpiRow b={b} />
          <button type="button" onClick={() => setDetails((v) => !v)} className="mono-label mt-3 inline-flex items-center gap-1 text-[9.5px] text-ink/50 hover:text-[#ff3c00] md:hidden">
            <ChevronDown className={`h-3 w-3 transition-transform ${details ? "rotate-180" : ""}`} />{details ? "Hide details" : "Show details"}
          </button>
          <div className={`${details ? "grid" : "hidden"} mt-3 gap-3 md:grid md:grid-cols-2 xl:grid-cols-3`}>
            <TodaySection b={b} />
            <ClaudeSection b={b} />
            <PipelineSection b={b} />
            <RequestsSection b={b} />
            <MoneySection b={b} />
            <SitesSection b={b} />
            <LegalSection b={b} />
            <IntelSection b={b} />
            <OutreachSection b={b} />
          </div>
        </>
      )}
    </section>
  );
}

/* ─── Header pieces ─────────────────────────────────────────────────────── */
function HeroButton({ children, ...props }) {
  return (
    <button type="button" {...props} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 px-2.5 py-1.5 text-[11px] text-white/70 transition-colors hover:border-[#ff6a00] hover:text-white disabled:opacity-40">
      {children}
    </button>
  );
}

function StatusChips({ b }) {
  const chips = [];
  if (b.tasks.overdue.length) chips.push({ hot: true, label: `${b.tasks.overdue.length} overdue`, to: "/tasks" });
  if (b.claude.waiting.length) chips.push({ hot: true, label: `${b.claude.waiting.length} to approve`, to: "/claude" });
  if (b.requests.urgent.length) chips.push({ hot: true, label: `${b.requests.urgent.length} urgent request${b.requests.urgent.length > 1 ? "s" : ""}`, to: "/requests" });
  if (b.pipeline.callsToday.length) chips.push({ hot: true, label: `${b.pipeline.callsToday.length} call${b.pipeline.callsToday.length > 1 ? "s" : ""} today`, to: "/pipeline" });
  if (b.money.overdueBills.length) chips.push({ hot: true, label: `${b.money.overdueBills.length} bill${b.money.overdueBills.length > 1 ? "s" : ""} overdue`, to: "/financial?tab=overview" });
  if (b.legal.overdue.length) chips.push({ hot: true, label: "Legal deadline passed", to: "/legal" });
  if (b.goal.target) chips.push({ hot: !b.goal.onPace, label: b.goal.onPace ? "On pace" : "Behind pace", to: "/financial?tab=goal" });
  if (!b.money.stripeOk) chips.push({ hot: false, label: "Stripe not connected", to: "/financial?tab=stripe" });
  if (!chips.some((c) => c.hot)) chips.unshift({ hot: false, label: "All systems nominal", to: "/" });
  return (
    <div className="mt-4 flex flex-wrap gap-1.5">
      {chips.map((c) => (
        <Link key={c.label} to={c.to} className="inline-flex items-center gap-1.5 rounded-full border border-white/15 px-2.5 py-1 text-[11px] text-white/75 transition-colors hover:border-[#ff6a00] hover:text-white">
          <span className={`h-1.5 w-1.5 rounded-full ${c.hot ? "bg-[#ff3c00]" : "bg-white/35"}`} />{c.label}
        </Link>
      ))}
    </div>
  );
}

/* ─── KPI tiles ─────────────────────────────────────────────────────────── */
function KpiRow({ b }) {
  const tiles = [
    { icon: CalendarCheck, label: "Due today", value: b.tasks.due.length, format: count, sub: b.tasks.overdue.length ? `${b.tasks.overdue.length} overdue` : "none overdue", hot: b.tasks.overdue.length > 0, to: "/tasks" },
    { icon: Sparkles, label: "Claude queue", value: b.claude.waiting.length, format: count, sub: `${b.claude.running} running · ${b.claude.queued} queued`, hot: b.claude.waiting.length > 0, to: "/claude" },
    { icon: Users, label: "Calls this week", value: b.pipeline.callsWeek.length, format: count, sub: `${b.pipeline.newLeads.length} new lead${b.pipeline.newLeads.length === 1 ? "" : "s"}`, to: "/pipeline" },
    { icon: Inbox, label: "Requests", value: b.requests.open.length, format: count, sub: b.requests.urgent.length ? `${b.requests.urgent.length} urgent` : "none urgent", hot: b.requests.urgent.length > 0, to: "/requests" },
    { icon: Repeat, label: "MRR", value: b.money.mrr, format: (v) => money(v), sub: `${b.money.accounts} paying account${b.money.accounts === 1 ? "" : "s"}`, flame: true, to: "/financial" },
    { icon: Target, label: "Goal pace", value: b.goal.target ? b.goal.pace * 100 : null, format: pct, sub: b.goal.target ? `${compactMoney(b.goal.projected)} of ${compactMoney(b.goal.target)}` : "No goal set", hot: !b.goal.onPace, to: "/financial?tab=goal" },
  ];
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {tiles.map((t, i) => (
        <Link key={t.label} to={t.to} className="card-hover fin-rise group relative flex flex-col rounded-md border border-hair bg-card px-3.5 py-3" style={{ animationDelay: `${i * 40}ms` }}>
          <div className="flex items-center justify-between gap-2">
            <span className="mono-label text-[9px] text-ink/50">{t.label}</span>
            <t.icon className="h-3.5 w-3.5 text-ink/30 transition-colors group-hover:text-[#ff3c00]" />
          </div>
          <p className={`mt-1.5 text-[22px] font-semibold leading-none tracking-[-0.03em] ${t.flame ? "flame-text" : "text-ink"}`}>
            <CountUp value={t.value} format={t.format} />
          </p>
          <p className={`mt-1 truncate text-[10.5px] ${t.hot ? "text-[#d83300]" : "text-ink/45"}`}>{t.sub}</p>
        </Link>
      ))}
    </div>
  );
}

/* ─── Section shell ─────────────────────────────────────────────────────── */
function Section({ icon: Icon, title, meta, to, children }) {
  return (
    <section className="fin-rise relative overflow-hidden rounded-md border border-hair bg-card">
      <header className="flex items-center justify-between gap-2 border-b border-hair px-3.5 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="h-3.5 w-3.5 shrink-0 text-[#ff3c00]" strokeWidth={1.75} />
          <h3 className="truncate text-[13px] font-semibold tracking-[-0.01em]">{title}</h3>
          {meta && <span className="mono-label truncate text-[8.5px] text-ink/45">{meta}</span>}
        </div>
        {to && <Link to={to} className="mono-label inline-flex shrink-0 items-center gap-0.5 text-[9px] text-ink/50 hover:text-[#ff3c00]">Open<ArrowUpRight className="h-3 w-3" /></Link>}
      </header>
      <ul className="divide-y divide-hair">{children}</ul>
    </section>
  );
}

function Row({ to, title, sub, right, hot }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-3 px-3.5 py-2 hover:bg-ink/[0.03]">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium">{title}</p>
          {sub && <p className="truncate text-[11px] text-ink/50">{sub}</p>}
        </div>
        {right != null && <span className={`mono-label shrink-0 text-[8.5px] ${hot ? "text-[#ff3c00]" : "text-ink/45"}`}>{right}</span>}
      </Link>
    </li>
  );
}

const taskLink = (t) => (t.client_id ? `/clients/${t.client_id}?tab=tasks` : "/tasks");

/* ─── Sections ──────────────────────────────────────────────────────────── */
function TodaySection({ b }) {
  const { focus, due } = b.tasks;
  const focusIds = new Set(focus.map((t) => t.id));
  const rows = [...focus.slice(0, 2).map((t) => ({ t, focus: true })), ...due.filter((t) => !focusIds.has(t.id)).slice(0, 4 - Math.min(2, focus.length)).map((t) => ({ t }))];
  if (!rows.length) return null;
  return (
    <Section icon={CalendarCheck} title="Today" meta={`${due.length} due · ${focus.length} focus`} to="/tasks">
      {rows.map(({ t, focus: isFocus }) => {
        const late = t.due_date && t.due_date.slice(0, 10) < b.today;
        return <Row key={t.id} to={taskLink(t)} title={t.title} sub={t.client_name || "Interstellar"} right={isFocus ? "Focus" : late ? `due ${fmtDate(t.due_date)}` : "today"} hot={isFocus || late} />;
      })}
    </Section>
  );
}

function ClaudeSection({ b }) {
  const { waiting, running, queued } = b.claude;
  if (!waiting.length) return null;
  return (
    <Section icon={Sparkles} title={`Claude queue · ${waiting.length} to approve`} meta={`${running} running · ${queued} queued`} to="/claude">
      {waiting.slice(0, 3).map((j) => (
        <Row key={j.id} to={`/claude?job=${j.id}`} title={j.title} sub={j.needs_from_justin || j.client_name || "Interstellar"} right="Review" hot />
      ))}
    </Section>
  );
}

function PipelineSection({ b }) {
  const p = b.pipeline;
  if (!p.callsWeek.length && !p.overdueSteps.length && !p.newLeads.length) return null;
  return (
    <Section icon={Users} title="Pipeline" meta={`${p.open} open`} to="/pipeline">
      {p.callsWeek.slice(0, 2).map(({ c, call }) => (
        <Row key={`call-${c.id}`} to="/pipeline" title={c.business || "Lead"} sub="Strategy call" right={call.label} hot={call.at.toDateString() === new Date().toDateString()} />
      ))}
      {p.overdueSteps.slice(0, 2).map((c) => (
        <Row key={`step-${c.id}`} to="/pipeline" title={c.business || "Lead"} sub={c.next_step || "Next step"} right={`was ${fmtDate(c.next_step_at)}`} hot />
      ))}
      {p.newLeads.length > 0 && (
        <Row to="/pipeline" title={`${p.newLeads.length} new lead${p.newLeads.length > 1 ? "s" : ""} to reach out to`} sub={p.newLeads.slice(0, 3).map((c) => c.business).filter(Boolean).join(", ")} right={p.fresh ? `${p.fresh} in 24h` : null} hot={p.fresh > 0} />
      )}
    </Section>
  );
}

function RequestsSection({ b }) {
  const { open, urgent } = b.requests;
  if (!open.length) return null;
  return (
    <Section icon={Inbox} title="Client requests" meta={`${open.length} open${urgent.length ? ` · ${urgent.length} urgent` : ""}`} to="/requests">
      {open.slice(0, 3).map((r) => (
        <Row key={r.id} to={r.client_id ? `/clients/${r.client_id}?tab=requests` : "/requests"} title={r.title} sub={r.client_name} right={r.priority === "urgent" ? "Urgent" : String(r.status || "").replace("_", " ")} hot={r.priority === "urgent"} />
      ))}
    </Section>
  );
}

function MoneySection({ b }) {
  const m = b.money;
  const g = b.goal;
  const pacePct = Math.max(0, Math.min(100, (g.pace || 0) * 100));
  return (
    <Section icon={Repeat} title="Money" meta={m.stripeOk ? "Stripe live" : "Stripe not connected"} to="/financial">
      <li className="px-3.5 py-2.5">
        <div className="grid grid-cols-3 gap-2">
          <MiniStat label="MRR" value={money(m.mrr)} flame />
          <MiniStat label="Collected (mo)" value={m.collectedThisMonth != null ? money(m.collectedThisMonth) : "—"} />
          <MiniStat label="Overdue bills" value={m.overdueBills.length ? money(m.overdueBillsTotal) : "$0"} hot={m.overdueBills.length > 0} />
        </div>
      </li>
      {g.target > 0 && (
        <li>
          <Link to="/financial?tab=goal" className="block px-3.5 py-2.5 hover:bg-ink/[0.03]">
            <div className="flex items-baseline justify-between gap-2">
              <p className="truncate text-[12.5px] font-medium">{g.title}</p>
              <span className={`mono-label shrink-0 text-[8.5px] ${g.onPace ? "text-ink/45" : "text-[#ff3c00]"}`}>{g.onPace ? "On pace" : "Behind"}</span>
            </div>
            <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink/[0.07]">
              <div className="flame-bg h-full rounded-full" style={{ width: `${pacePct}%` }} />
            </div>
            <p className="mt-1 truncate text-[11px] text-ink/50">
              Projected {compactMoney(g.projected)} of {compactMoney(g.target)}
              {!g.onPace && g.mrrGap ? ` · need +${money(g.mrrGap)}/mo` : ""}
              {!g.onPace && g.clientsNeeded ? ` (~${g.clientsNeeded} account${g.clientsNeeded > 1 ? "s" : ""})` : ""}
              {g.monthsUntilStart ? ` · starts in ${g.monthsUntilStart} mo` : ""}
            </p>
          </Link>
        </li>
      )}
      {m.overdueBills.slice(0, 2).map((e) => (
        <Row key={e.id} to="/financial?tab=overview" title={e.platform || "Bill"} sub={`Due ${fmtDate(e.dueDate)}`} right={money(Number(e.amount) || 0)} hot />
      ))}
    </Section>
  );
}

function MiniStat({ label, value, flame, hot }) {
  return (
    <div className="min-w-0">
      <p className="mono-label truncate text-[8.5px] text-ink/45">{label}</p>
      <p className={`truncate text-[15px] font-semibold tabular-nums tracking-[-0.02em] ${flame ? "flame-text" : hot ? "text-[#d83300]" : "text-ink"}`}>{value}</p>
    </div>
  );
}

function SitesSection({ b }) {
  if (!b.sites.length && !b.reviews.length) return null;
  return (
    <Section icon={Gauge} title="Sites & reviews" meta={`${b.sites.length} flagged`} to="/performance">
      {b.sites.slice(0, 2).map((s) => (
        <Row key={`s-${s.clientId}`} to="/performance" title={s.name}
          sub={s.critical.length ? `New critical: ${s.critical[0]}` : `Score ${Math.round(s.score)}`}
          right={s.drop ? `−${s.drop} pts` : `${s.critical.length} critical`} hot />
      ))}
      {b.reviews.slice(0, 3).map((r) => (
        <Row key={`r-${r.id}`} to="/reviews" title={r.name}
          sub={r.error ? `Fetch failing: ${r.error}` : [r.fresh ? `${r.fresh} new review${r.fresh > 1 ? "s" : ""} this week` : null, r.totalDelta ? `${r.totalDelta > 0 ? "+" : ""}${r.totalDelta} since yesterday` : null].filter(Boolean).join(" · ")}
          right={r.rating != null ? <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-[#ffaa00] text-[#ffaa00]" />{r.rating.toFixed(1)}{r.ratingDelta ? ` (${r.ratingDelta > 0 ? "+" : ""}${r.ratingDelta.toFixed(2)})` : ""}</span> : null}
          hot={!!r.error || r.ratingDelta < 0} />
      ))}
    </Section>
  );
}

function LegalSection({ b }) {
  const { next, overdue } = b.legal;
  if (!next && !overdue.length) return null;
  return (
    <Section icon={Scale} title="Legal" meta={next ? `next in ${dayCount(next.days)}` : "deadline passed"} to="/legal">
      {overdue.slice(0, 2).map((d) => (
        <Row key={d.item.id} to="/legal" title={d.item.task} sub={`Passed ${fmtDate(d.due)}`} right="Overdue" hot />
      ))}
      {next && (
        <li>
          <Link to="/legal" className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-ink/[0.03]">
            <span className={`w-12 shrink-0 text-center text-[24px] font-semibold leading-none tabular-nums tracking-[-0.04em] ${next.days <= 30 ? "text-[#ff3c00]" : ""}`}>{next.days}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-medium">{next.item.task}</p>
              <p className="truncate text-[11px] text-ink/50">{next.days === 1 ? "day" : "days"} · {fmtDate(next.due)}{next.recurring ? " · yearly" : ""}</p>
            </div>
          </Link>
        </li>
      )}
    </Section>
  );
}

function IntelSection({ b }) {
  const i = b.intel;
  if (!i || (!i.top && !i.proposed)) return null;
  return (
    <Section icon={Radar} title="Search Intel" meta={i.date ? `brief ${fmtDate(i.date)}` : null} to="/packages/orbit-seo">
      {i.top && (
        <li>
          <Link to="/packages/orbit-seo" className="block px-3.5 py-2.5 hover:bg-ink/[0.03]">
            <p className="mono-label text-[8.5px] text-[#ff3c00]">The one thing · {i.top.impact || "medium"} impact</p>
            <p className="mt-0.5 text-[12.5px] font-medium leading-snug">{i.top.title}</p>
            {i.top.for_us && <p className="mt-0.5 line-clamp-2 text-[11px] text-ink/50">{i.top.for_us}</p>}
          </Link>
        </li>
      )}
      {(i.proposed > 0 || i.approved > 0) && (
        <Row to="/packages/orbit-seo" title={`${i.proposed} proposed action${i.proposed === 1 ? "" : "s"} to review`} sub={i.approved ? `${i.approved} approved, not yet implemented` : null} right={i.proposed ? "Review" : null} hot={i.proposed > 0} />
      )}
    </Section>
  );
}

function OutreachSection({ b }) {
  const o = b.outreach;
  if (!o || !o.waiting) return null;
  return (
    <Section icon={Megaphone} title="Outreach" meta="backlinks & citations" to={OUTREACH_ROUTE}>
      <Row to={OUTREACH_ROUTE} title={`${o.waiting} draft${o.waiting > 1 ? "s" : ""} awaiting approval`} sub={o.clients.slice(0, 3).join(", ")} right={<span className="inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Approve</span>} hot />
    </Section>
  );
}
