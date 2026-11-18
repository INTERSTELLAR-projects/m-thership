// Portal v2 Home: one screen, no hunting (Justin's brief, Nov 17 2026).
//   Hero + Nøva ("Ask or request anything")
//   1. What we did for you   — the live work feed (client-safe, finished, LIVE work only), Today / Week / Month / Year
//   2. What needs you        — brain questions, requests waiting on an answer, payments due. Usually empty.
//   3. Your business health  — search, reviews, listings, website, revenue & leads (only when a Command System syncs)
//   Everything else, one tap away.
// Real data only. Anything not connected yet shows a designed empty state, never a made-up number.
import { useMemo, useState } from "react";
import { ArrowUpRight, Check, Globe, Search, PenLine, MapPin, Link2, LayoutGrid, Palette, Megaphone, Mail, BadgeDollarSign, Brain, ClipboardList, CreditCard, Star, Gauge, TrendingUp, PlugZap, Loader2, Send, ChevronRight } from "lucide-react";
import { fmtDate } from "@/lib/useData";
import { analyze } from "@/features/financing/schedule";
import NovaBar from "./NovaBar";
import { EverythingGrid } from "./Everything";
import { inPeriod, pacificToday } from "./portalMap";

const CAT = {
  website: ["Website", Globe], seo: ["Search", Search], content: ["Content", PenLine], gbp: ["Google profile", MapPin], citations: ["Listings & PR", Link2],
  app_build: ["Your system", LayoutGrid], research: ["Strategy", Search], ops: ["Behind the scenes", LayoutGrid], security: ["Behind the scenes", LayoutGrid], brand: ["Brand", Palette], social: ["Social", Megaphone], email: ["Email", Mail], ads: ["Ads", BadgeDollarSign], reviews: ["Reviews", Star],
};

export const PERIODS = [["today", "Today", "today"], ["week", "This week", "this week"], ["month", "This month", "this month"], ["year", "This year", "this year"]];
const COUNT_KEY = { today: "today", week: "this_week", month: "this_month", year: "this_year" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false }).format(new Date()));
  return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

function Band({ eyebrow, title, right, children, id }) {
  return (
    <section aria-labelledby={id} className="overflow-hidden rounded-lg border border-hair bg-card">
      <header className="flex flex-wrap items-end justify-between gap-3 border-b border-hair px-4 pb-3.5 pt-4 sm:px-6">
        <div className="min-w-0">
          <p className="mono-label text-[9.5px] text-[#ff3c00]">{eyebrow}</p>
          <h2 id={id} className="mt-1 text-[22px] font-semibold leading-tight tracking-[-0.035em] sm:text-[26px]">{title}</h2>
        </div>
        {right}
      </header>
      {children}
    </section>
  );
}

// ---------------------------------------------------------------- 1. What we did for you
function WorkBand({ items = [], counts, business }) {
  const [period, setPeriod] = useState("month");
  const [all, setAll] = useState(false);
  const today = pacificToday();
  const list = useMemo(() => items.filter((w) => inPeriod(w.date, period, today)), [items, period, today]);
  const n = counts && Number.isFinite(Number(counts[COUNT_KEY[period]])) ? Number(counts[COUNT_KEY[period]]) : list.length;
  const label = PERIODS.find((p) => p[0] === period)[2];
  const cats = useMemo(() => {
    const m = new Map();
    for (const w of list) { const l = (CAT[w.category] || CAT.website)[0]; m.set(l, (m.get(l) || 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [list]);
  const recent = list.length ? list : items.slice(0, 3);
  const shown = all ? recent : recent.slice(0, 6);
  return (
    <Band
      id="band-work" eyebrow="(01) What we did for you"
      title={<><span className="tabular-nums text-[#ff3c00]">{n}</span> {n === 1 ? "task" : "tasks"} completed for you {label}</>}
      right={
        <div role="tablist" aria-label="Period" className="flex w-full gap-1 rounded-md bg-ink/[0.05] p-1 sm:w-auto">
          {PERIODS.map(([k, l]) => (
            <button key={k} type="button" role="tab" aria-selected={period === k} onClick={() => { setPeriod(k); setAll(false); }} className={`h-9 flex-1 whitespace-nowrap rounded px-3 text-[12.5px] font-medium transition-colors sm:flex-none ${period === k ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}>{l}</button>
          ))}
        </div>
      }
    >
      {items.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-[#ff3c00]/10"><Check className="h-5 w-5 text-[#ff3c00]" /></span>
          <p className="mt-3 text-[16px] font-semibold tracking-[-0.02em]">Your first updates land here</p>
          <p className="mx-auto mt-1 max-w-md text-[13.5px] leading-relaxed text-ink/55">Every post, Google update, blog, website change, listing and fix our team makes for {business || "your business"} shows up here the moment it goes live.</p>
        </div>
      ) : (
        <div>
          {cats.length > 0 && (
            <p className="flex flex-wrap gap-1.5 border-b border-hair px-4 py-2.5 sm:px-6">
              {cats.map(([l, c]) => <span key={l} className="rounded-full border border-hair bg-paper px-2.5 py-1 text-[12px] text-ink/65">{l} <b className="font-semibold tabular-nums text-ink">{c}</b></span>)}
            </p>
          )}
          {!list.length && <p className="border-b border-hair bg-ink/[0.025] px-4 py-2 text-[12.5px] text-ink/55 sm:px-6">Nothing has gone live {label} yet. The latest from our team:</p>}
          <ul className="divide-y divide-hair">
            {shown.map((w) => {
              const [l, Icon] = CAT[w.category] || CAT.website;
              return (
                <li key={w.id} className="flex gap-3 px-4 py-3.5 sm:px-6">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-hair bg-paper"><Icon className="h-4 w-4 text-[#ff3c00]" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[14.5px] font-semibold leading-snug tracking-[-0.01em]">{w.title}</p>
                    {w.summary ? <p className="mt-0.5 text-[13px] leading-relaxed text-ink/60">{w.summary}</p> : null}
                    <p className="mt-1 flex items-center gap-2 text-[11.5px] text-ink/45"><span className="inline-flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-green-600" aria-hidden="true" />Live</span><span>·</span><span>{l}</span>{w.date ? <><span>·</span><span>{fmtDate(w.date)}</span></> : null}</p>
                  </div>
                  {w.url ? <a href={w.url} target="_blank" rel="noreferrer" className="flex h-10 w-10 shrink-0 items-center justify-center text-ink/40 hover:text-[#ff3c00]" aria-label={`Open ${w.title}`}><ArrowUpRight className="h-4 w-4" /></a> : null}
                </li>
              );
            })}
          </ul>
          {recent.length > 6 && (
            <button type="button" onClick={() => setAll((v) => !v)} className="h-12 w-full border-t border-hair text-[13px] font-medium text-ink/60 hover:text-[#ff3c00]">{all ? "Show less" : `See all ${recent.length}`}</button>
          )}
        </div>
      )}
    </Band>
  );
}

// ---------------------------------------------------------------- 2. What needs you
function QuestionRow({ q, call, onDone, preview }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const save = async () => {
    if (!v.trim() || busy) return;
    setBusy(true); setErr("");
    try { await call("brain_answer", { q: q.q, answer: v.trim() }); setDone(true); onDone?.(); }
    catch (e) { setErr(e?.response?.data?.error || "Couldn't save that. Try again."); }
    finally { setBusy(false); }
  };
  return (
    <li className="px-4 py-3.5 sm:px-6">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink text-white"><Brain className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="mono-label text-[9px] text-ink/45">Question for your Brain</p>
          <p className="mt-0.5 text-[14.5px] font-semibold leading-snug tracking-[-0.01em]">{q.q}</p>
          {done ? <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] text-green-700"><Check className="h-3.5 w-3.5" /> {preview ? "Preview: answers save from the client's own login." : "Thanks. Our team adds it to your Brain."}</p> : open ? (
            <div className="mt-2">
              <label htmlFor={`qa-${q.q.length}-${q.q.slice(0, 8)}`} className="sr-only">Your answer</label>
              <textarea id={`qa-${q.q.length}-${q.q.slice(0, 8)}`} rows={3} value={v} onChange={(e) => setV(e.target.value)} placeholder="Type your answer. A sentence or two is plenty." className="w-full resize-none rounded-md border border-hair bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#ff3c00]" />
              <div className="mt-2 flex items-center gap-2">
                <button type="button" onClick={save} disabled={!v.trim() || busy} className="flame-bg inline-flex h-10 items-center gap-2 rounded-md px-4 text-[13px] font-semibold text-white disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Save answer</button>
                <button type="button" onClick={() => setOpen(false)} className="h-10 px-3 text-[13px] text-ink/55 hover:text-ink">Later</button>
              </div>
              {err && <p role="alert" className="mt-1.5 text-[12px] text-red-700">{err}</p>}
            </div>
          ) : (
            <button type="button" onClick={() => setOpen(true)} className="mt-2 inline-flex h-10 items-center gap-1.5 rounded-md border border-hair bg-paper px-3.5 text-[13px] font-medium hover:border-[#ff3c00] hover:text-[#ff3c00]">Answer <ChevronRight className="h-3.5 w-3.5" /></button>
          )}
        </div>
      </div>
    </li>
  );
}

const money = (n) => `$${Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: Number(n) % 1 ? 2 : 0, maximumFractionDigits: 2 })}`;

export function paymentsNeedingYou(financing = [], now = new Date()) {
  const out = [];
  for (const p of financing) {
    const a = analyze(p, now);
    const next = a.next;
    if (!next) continue;
    const late = next.state === "late";
    const days = Math.round((new Date(next.date).setHours(0, 0, 0, 0) - new Date(now).setHours(0, 0, 0, 0)) / 864e5);
    if (late || days <= 7) out.push({ id: p.id, title: p.title, amount: next.amount, date: next.date, late, days });
  }
  return out;
}

function NeedsBand({ needs, call, go, refresh, preview, brain }) {
  const qs = needs?.questions || [];
  const reqs = needs?.requests || [];
  const pays = paymentsNeedingYou(needs?.financing || []);
  const total = qs.length + reqs.length + pays.length;
  return (
    <Band id="band-needs" eyebrow="(02) What needs you" title={total ? <>{total} {total === 1 ? "thing needs" : "things need"} <span className="text-[#ff3c00]">you</span></> : "Nothing needs you today."}>
      {total === 0 ? (
        <div className="flex items-start gap-3 px-4 py-5 sm:px-6">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-green-600 text-white"><Check className="h-4 w-4" /></span>
          <p className="text-[13.5px] leading-relaxed text-ink/60">We&apos;re running everything. When we need an answer, an OK or a payment from you, it shows up right here, and only here.</p>
        </div>
      ) : (
        <ul className="divide-y divide-hair">
          {qs.map((q) => <QuestionRow key={q.q} q={q} call={call} onDone={refresh} preview={preview} />)}
          {reqs.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => go("requests")} className="flex min-h-[64px] w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-paper sm:px-6">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-white"><ClipboardList className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="mono-label block text-[9px] text-ink/45">We need a detail from you</span>
                  <span className="mt-0.5 block text-[14.5px] font-semibold leading-snug">{r.title}</span>
                  {r.note && <span className="mt-0.5 block text-[13px] text-ink/60">{r.note}</span>}
                </span>
                <ChevronRight className="mt-2 h-4 w-4 text-ink/35" />
              </button>
            </li>
          ))}
          {pays.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => go("billing")} className="flex min-h-[64px] w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-paper sm:px-6">
                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white ${p.late ? "bg-red-600" : "bg-ink"}`}><CreditCard className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="mono-label block text-[9px] text-ink/45">{p.late ? "Payment past due" : "Payment coming up"}</span>
                  <span className="mt-0.5 block text-[14.5px] font-semibold leading-snug">{money(p.amount)} for {p.title} · {p.late ? `due ${fmtDate(p.date)}` : p.days <= 0 ? "due today" : `due ${fmtDate(p.date)}`}</span>
                </span>
                <ChevronRight className="mt-2 h-4 w-4 text-ink/35" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <BrainMeter brain={brain} go={go} />
    </Band>
  );
}

function BrainMeter({ brain, go }) {
  const pct = brain?.pct;
  return (
    <button type="button" onClick={() => go("brain")} className="group flex w-full items-center gap-4 border-t border-hair bg-paper/70 px-4 py-3.5 text-left hover:bg-paper sm:px-6" data-brain-meter>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ink text-white"><Brain className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="text-[13.5px] font-semibold">Your Business Brain</span>
          <span className="font-mono text-[11px] tabular-nums text-ink/55">{pct == null ? "Getting started" : `${pct}% known`}</span>
        </span>
        <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-ink/[0.08]"><span className="block h-full rounded-full bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)] transition-[width] duration-700" style={{ width: `${Math.max(pct ?? 0, 3)}%` }} /></span>
        <span className="mt-1 block text-[11.5px] text-ink/50">The more it knows, the more runs itself.</span>
      </span>
      <ChevronRight className="h-4 w-4 text-ink/35 group-hover:text-[#ff3c00]" />
    </button>
  );
}

// ---------------------------------------------------------------- 3. Your business health
const latestOf = (snaps, src) => (snaps || []).filter((s) => s.source === src).sort((a, b) => String(b.period_end).localeCompare(String(a.period_end)));
function delta(cur, prev, k) {
  const v = Number(cur?.metrics?.[k]); const p = Number(prev?.metrics?.[k]);
  if (!Number.isFinite(v) || !Number.isFinite(p) || p === 0) return null;
  return Math.round(((v - p) / p) * 100);
}

function HealthTile({ icon: Icon, label, value, sub, trend, empty, onClick, tone = "ink" }) {
  return (
    <button type="button" onClick={onClick} className="card-hover flex min-h-[132px] flex-col rounded-md border border-hair bg-white p-4 text-left">
      <span className="flex items-center gap-2">
        <span className={`flex h-8 w-8 items-center justify-center rounded-md ${empty ? "bg-ink/[0.06] text-ink/45" : tone === "flame" ? "flame-bg text-white" : "bg-ink text-white"}`}><Icon className="h-4 w-4" /></span>
        <span className="mono-label text-[9.5px] text-ink/55">{label}</span>
      </span>
      {empty ? (
        <span className="mt-3 block text-[13px] leading-snug text-ink/55">{empty}</span>
      ) : (
        <>
          <span className="mt-3 block text-[28px] font-semibold leading-none tracking-[-0.045em] tabular-nums">{value}</span>
          {sub && <span className="mt-1.5 block text-[12px] text-ink/55">{sub}</span>}
          {trend != null && <span className={`mt-auto pt-2 text-[11.5px] font-medium ${trend.good ? "text-green-700" : "text-ink/55"}`}>{trend.text}</span>}
        </>
      )}
    </button>
  );
}

function HealthBand({ d, go }) {
  const h = d.health || {};
  const gsc = latestOf(d.snapshots, "gsc");
  const gbp = latestOf(d.snapshots, "gbp");
  const cur = gsc[0]; const prev = gsc[1];
  const imp = delta(cur, prev, "impressions");
  const pos = Number(cur?.metrics?.avg_position);
  const reviews = (h.reviews || []).filter((r) => r.rating != null || r.count != null);
  const revCount = reviews.reduce((s, r) => s + (Number(r.count) || 0), 0);
  const revRating = reviews.length ? reviews.reduce((s, r) => s + (Number(r.rating) || 0) * (Number(r.count) || 1), 0) / reviews.reduce((s, r) => s + (Number(r.count) || 1), 0) : null;
  const site = d.site_health;
  const calls = Number(gbp[0]?.metrics?.calls);
  const listings = h.listings || { total: 0, this_month: 0 };
  const cs = h.command_system || {};
  return (
    <Band id="band-health" eyebrow="(03) Your business health" title="How your business is doing" right={<button type="button" onClick={() => go("results")} className="inline-flex h-10 items-center gap-1.5 text-[13px] font-medium text-ink/60 hover:text-[#ff3c00]">Full results <ArrowUpRight className="h-3.5 w-3.5" /></button>}>
      <div className="grid gap-2.5 p-3 sm:grid-cols-2 sm:p-4 lg:grid-cols-3 xl:grid-cols-5">
        <HealthTile
          icon={TrendingUp} label="Search presence" onClick={() => go("results")} tone="flame"
          value={cur ? Number(cur.metrics?.impressions || 0).toLocaleString() : ""}
          sub={cur ? `Google searches showed you · ${Number.isFinite(pos) ? `avg. position ${pos.toFixed(1)}` : fmtDate(cur.period_end)}` : ""}
          trend={imp == null ? null : { good: imp > 0, text: `${imp > 0 ? "+" : ""}${imp}% vs the month before` }}
          empty={cur ? null : "Your Google Search numbers appear here after your first full month."}
        />
        <HealthTile
          icon={Star} label="Reviews" onClick={() => go("gbp")}
          value={revRating != null ? <>{revRating.toFixed(1)}<span className="text-[16px] text-[#ff3c00]"> ★</span></> : ""}
          sub={reviews.length ? `${revCount.toLocaleString()} Google reviews${reviews.length > 1 ? ` · ${reviews.length} locations` : ""}` : ""}
          trend={reviews[0]?.as_of ? { good: false, text: `Checked ${fmtDate(String(reviews[0].as_of).slice(0, 10))}` } : null}
          empty={reviews.length ? null : "Your Google rating and review count show here once your profile is connected."}
        />
        <HealthTile
          icon={Link2} label="Listings & citations" onClick={() => go("mentions")}
          value={listings.total || ""}
          sub={listings.total ? `listings, mentions and links${listings.this_month ? ` · ${listings.this_month} this month` : ""}` : ""}
          trend={h.local_keywords ? { good: true, text: `Tracking ${h.local_keywords} local searches` } : null}
          empty={listings.total ? null : "Every directory listing and mention we build for you is counted here."}
        />
        <HealthTile
          icon={Gauge} label="Website" onClick={() => go("results")}
          value={site?.score != null ? site.score : site?.band === "Improving" ? "Improving" : ""}
          sub={site?.score != null ? `${site.band} · speed & indexing check` : site?.band === "Improving" ? "We're working on speed and indexing" : ""}
          trend={site?.fixes_applied ? { good: true, text: `${site.fixes_applied} fixes applied` } : site?.last_checked ? { good: false, text: `Checked ${fmtDate(String(site.last_checked).slice(0, 10))}` } : null}
          empty={site?.score != null || site?.band ? null : "Speed and indexing checks show here after your first site check."}
        />
        <HealthTile
          icon={cs.connected ? PlugZap : CreditCard} label="Revenue & leads" onClick={() => go("brain")}
          value="" empty={cs.connected
            ? `Your Command System is connected. Revenue and leads appear here when it starts sharing them.${Number.isFinite(calls) ? ` Calls from Google last month: ${calls}.` : ""}`
            : `Shows revenue and new leads once your Command System is connected.${Number.isFinite(calls) ? ` Calls from Google last month: ${calls}.` : ""}`}
        />
      </div>
    </Band>
  );
}

// ---------------------------------------------------------------- Home
export default function PortalHomeV2({ d, groups, go, call, refresh, preview, onAsk, unread }) {
  const first = String(d.client?.contact || "").trim().split(/\s+/)[0];
  const tasksMonth = Number(d.work_counts?.this_month) || 0;
  return (
    <div className="space-y-5 sm:space-y-6">
      <section className="pv2-rise">
        <p className="label-cross">({greeting()}{first && !preview ? `, ${first}` : ""})</p>
        <h1 className="mt-3 text-[34px] font-semibold leading-[0.98] tracking-[-0.05em] sm:text-[48px] lg:text-[60px]">
          Everything we&apos;re doing for <span className="text-[#ff3c00]">{d.client.business}</span>, live.
        </h1>
        <p className="mt-3 max-w-2xl text-[14.5px] leading-relaxed text-ink/60 sm:text-[15.5px]">We built your business its own operating system, and we run it with you every month. Done for you, or do it yourself.</p>
        <ol className="mt-4 flex flex-wrap gap-2" aria-label="How it works">
          {[["Build it", "done"], ["Run it", "live"], ["Grow it", "next"]].map(([t, s], i) => (
            <li key={t} className={`inline-flex h-9 items-center gap-2 rounded-full border px-3.5 text-[12.5px] font-medium ${s === "live" ? "border-[#ff3c00] bg-white text-ink" : "border-hair bg-card text-ink/65"}`}>
              <span className={`h-2 w-2 rounded-full ${s === "live" ? "pv2-live bg-[#ff3c00]" : s === "done" ? "bg-ink" : "bg-ink/25"}`} aria-hidden="true" />
              <span className="font-mono text-[10px] text-ink/40">0{i + 1}</span> {t}
              {s === "live" && tasksMonth > 0 && <span className="text-ink/45">· {tasksMonth} this month</span>}
            </li>
          ))}
        </ol>
      </section>

      <NovaBar onSend={onAsk} business={d.client.business} />

      <div className="grid gap-5 sm:gap-6 xl:grid-cols-[1.35fr_1fr] [&>*]:min-w-0">
        <WorkBand items={Array.isArray(d.work_feed) ? d.work_feed : []} counts={d.work_counts} business={d.client.business} />
        <NeedsBand needs={d.needs_you} brain={d.brain} call={call} go={go} refresh={refresh} preview={preview} />
      </div>

      <HealthBand d={d} go={go} />

      <section aria-labelledby="everything" className="pt-2">
        <p className="label-cross">(Everything else)</p>
        <h2 id="everything" className="mb-4 mt-2 text-[24px] font-semibold tracking-[-0.035em] sm:text-[28px]">One tap away</h2>
        <EverythingGrid groups={groups} tab="home" onPick={go} unread={unread} />
      </section>
    </div>
  );
}
