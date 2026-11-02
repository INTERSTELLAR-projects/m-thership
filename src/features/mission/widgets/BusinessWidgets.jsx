import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Target, Scale, Cpu, PlugZap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { fmtDate, timeAgo } from "@/lib/useData";
import { Tile, TileEmpty, TileLoading, TileError, Bar, asArray, money } from "./shell";

const DAY = 86400000;

/* ─── 2027 goal: $1M, from Stripe only ─────────────────────────────────── */
const GOAL = 1000000;
const GOAL_YEAR = 2027;
export function GoalWidget() {
  const q = useQuery({
    queryKey: ["stripe", "mission-goal"],
    queryFn: async () => {
      const [rev, subs] = await Promise.all([
        base44.functions.invoke("stripeRevenue", {}).then((r) => r.data).catch((e) => ({ error: e?.response?.data?.error || "Could not reach Stripe" })),
        base44.functions.invoke("stripeSubscriptions", {}).then((r) => r.data).catch(() => null),
      ]);
      return { rev, subs };
    },
    staleTime: 5 * 60 * 1000,
  });
  const rev = q.data?.rev;
  const notConnected = rev && rev.configured === false;
  const error = rev && !notConnected && rev.error;

  const months = asArray(rev?.months);
  const ytd = months.filter((m) => m.key.startsWith(String(GOAL_YEAR))).reduce((n, m) => n + (m.collected || 0) - (m.refunds || 0), 0);
  const trailing = months.reduce((n, m) => n + (m.collected || 0) - (m.refunds || 0), 0);
  const mrr = Number(q.data?.subs?.mrr) || 0;
  const runRate = mrr * 12;
  const now = new Date();
  const started = now.getFullYear() >= GOAL_YEAR;
  const daysToStart = Math.max(0, Math.ceil((new Date(GOAL_YEAR, 0, 1) - now) / DAY));
  const monthsLeft = started ? Math.max(1, 12 - now.getMonth()) : 12;
  const needPerMonth = Math.max(0, GOAL - (started ? ytd : 0)) / monthsLeft;
  const headline = started ? ytd : runRate;

  return (
    <Tile kicker={started ? `${GOAL_YEAR} collected · live from Stripe` : `${GOAL_YEAR} starts in ${daysToStart} days`} title="$1M in 2027" icon={Target} to="/financial" linkLabel="Financial">
      {q.isLoading ? <TileLoading /> : notConnected ? (
        <TileEmpty action={<span className="mono-label inline-flex items-center gap-1 border border-hair px-2.5 py-1.5 text-[9.5px] text-ink/60"><PlugZap className="h-3 w-3 text-[#ff3c00]" />Connect Stripe</span>}>
          Add STRIPE_SECRET_KEY in the app&apos;s Secrets and this tracks every dollar collected against the $1M goal. No numbers until then.
        </TileEmpty>
      ) : error ? <TileError>{error}</TileError> : (
        <div className="flex h-full flex-col gap-4 px-4 py-4">
          <div>
            <p className="mono-label text-[9px] text-ink/45">{started ? "Collected so far" : "Run rate going in (MRR × 12)"}</p>
            <p className="mt-1 text-[34px] font-semibold leading-none tracking-[-0.04em] tabular-nums">
              {money(headline)}<span className="text-[15px] text-ink/35"> / $1M</span>
            </p>
          </div>
          <div>
            <Bar value={headline} max={GOAL} />
            <div className="mt-1.5 flex justify-between font-mono text-[10px] tabular-nums text-ink/45">
              <span>{((headline / GOAL) * 100).toFixed(1)}%</span>
              <span>{money(GOAL - headline)} to go</span>
            </div>
          </div>
          <div className="mt-auto grid grid-cols-3 divide-x divide-hair border-t border-hair pt-3 text-center">
            <div><p className="font-mono text-[13px] tabular-nums">{money(mrr)}</p><p className="mono-label text-[8px] text-ink/45">MRR now</p></div>
            <div><p className="font-mono text-[13px] tabular-nums text-[#ff3c00]">{money(needPerMonth)}</p><p className="mono-label text-[8px] text-ink/45">Needed / mo</p></div>
            <div><p className="font-mono text-[13px] tabular-nums">{money(trailing)}</p><p className="mono-label text-[8px] text-ink/45">Last 12 mo</p></div>
          </div>
        </div>
      )}
    </Tile>
  );
}

/* ─── Next legal deadline ──────────────────────────────────────────────── */
// LegalItem.dueDate is free text ("April 15th", "Jun 30, 2026"). No year = recurs every year.
function parseDue(raw, today) {
  if (!raw) return null;
  const s = String(raw).replace(/(\d+)(st|nd|rd|th)\b/gi, "$1").trim();
  const hasYear = /\b\d{4}\b/.test(s);
  const d = new Date(hasYear ? s : `${s} ${today.getFullYear()}`);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  if (!hasYear && d < today) d.setFullYear(d.getFullYear() + 1);
  return { date: d, recurring: !hasYear };
}

export function LegalWidget() {
  const q = useQuery({
    queryKey: ["LegalItem", "mission-next"],
    queryFn: async () => asArray(await base44.entities.LegalItem.list("-created_date", 200)),
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const open = (q.data || []).filter((i) => !i.done);
  const dated = open
    .map((i) => ({ ...i, due: parseDue(i.dueDate, today) }))
    .filter((i) => i.due)
    .sort((a, b) => a.due.date - b.due.date);
  const missed = dated.filter((i) => i.due.date < today);
  const upcoming = dated.filter((i) => i.due.date >= today);
  const next = upcoming[0];
  const undated = open.length - dated.length;
  const days = next ? Math.round((next.due.date - today) / DAY) : null;
  const iso = (d) => d.toISOString().slice(0, 10);

  return (
    <Tile kicker={undated ? `${undated} legal to-do${undated > 1 ? "s" : ""} without a date` : "Legal"} title="Next legal deadline" icon={Scale} to="/legal" linkLabel="Legal">
      {q.isLoading ? <TileLoading /> : q.isError ? <TileError /> : !next && !missed.length ? (
        <TileEmpty>No dated legal deadlines. Add filing and renewal dates on Legal and the next one counts down here.</TileEmpty>
      ) : (
        <div className="flex h-full flex-col">
          {next && (
            <div className="border-b border-hair px-4 py-4">
              <p className="text-[15px] font-semibold tracking-[-0.02em]">{next.task}</p>
              <div className="mt-2 flex items-baseline gap-2">
                <span className={`text-[34px] font-semibold leading-none tabular-nums tracking-[-0.04em] ${days <= 30 ? "text-[#ff3c00]" : ""}`}>{days}</span>
                <span className="text-[12px] text-ink/55">{days === 1 ? "day" : "days"} · {fmtDate(iso(next.due.date))}{next.due.recurring ? " · yearly" : ""}</span>
              </div>
            </div>
          )}
          <ul className="divide-y divide-hair">
            {missed.map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 px-4 py-2 text-[12.5px]">
                <span className="truncate text-[#ff3c00]">{i.task}</span>
                <span className="mono-label shrink-0 text-[8.5px] text-[#ff3c00]">passed {fmtDate(iso(i.due.date))}</span>
              </li>
            ))}
            {upcoming.slice(1, 5).map((i) => (
              <li key={i.id} className="flex items-center justify-between gap-2 px-4 py-2 text-[12.5px]">
                <span className="truncate">{i.task}</span>
                <span className="shrink-0 font-mono text-[10.5px] text-ink/45">{fmtDate(iso(i.due.date))}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Tile>
  );
}

/* ─── Automations: status counts ───────────────────────────────────────── */
const AUTO_STATES = [
  ["active", "Running", "#1a1a1a"],
  ["setup", "Setup", "#ffaa00"],
  ["paused", "Paused", "rgba(26,26,26,.25)"],
  ["error", "Error", "#ff3c00"],
];
export function AutomationsWidget() {
  const q = useQuery({
    queryKey: ["Automation", "mission-counts"],
    queryFn: async () => asArray(await base44.entities.Automation.list("-last_run_at", 500)),
  });
  const all = q.data || [];
  const counts = Object.fromEntries(AUTO_STATES.map(([k]) => [k, all.filter((a) => (a.status || "setup") === k).length]));
  const broken = all.filter((a) => a.status === "error" || a.last_result === "failed");
  const upcoming = all
    .filter((a) => a.status === "active" && a.next_run_at && new Date(a.next_run_at) > new Date())
    .sort((a, b) => a.next_run_at.localeCompare(b.next_run_at))[0];

  return (
    <Tile kicker={broken.length ? `${broken.length} need you` : "All healthy"} title="Automations" icon={Cpu} to="/crm" linkLabel="Clients" stat={q.isLoading ? null : all.length}>
      {q.isLoading ? <TileLoading /> : q.isError ? <TileError /> : all.length === 0 ? (
        <TileEmpty>No automations registered. Add each client&apos;s blog, GBP and reporting automations from their cockpit.</TileEmpty>
      ) : (
        <div className="flex h-full flex-col">
          <div className="px-4 pt-4">
            <div className="flex h-2 w-full overflow-hidden rounded-full bg-ink/[0.07]">
              {AUTO_STATES.map(([k, , c]) => counts[k] ? <div key={k} style={{ width: `${(counts[k] / all.length) * 100}%`, background: c }} /> : null)}
            </div>
            <div className="mt-3 grid grid-cols-4 text-center">
              {AUTO_STATES.map(([k, label, c]) => (
                <div key={k}>
                  <p className="text-[20px] font-semibold tabular-nums tracking-[-0.03em]" style={{ color: k === "error" && counts[k] ? c : undefined }}>{counts[k]}</p>
                  <p className="mono-label text-[8px] text-ink/45">{label}</p>
                </div>
              ))}
            </div>
          </div>
          {upcoming && (
            <p className="mx-4 mt-3 truncate border-t border-hair pt-2.5 text-[11.5px] text-ink/55">
              Next: <span className="text-ink">{upcoming.name}</span> · {upcoming.client_name} · {fmtDate(upcoming.next_run_at)}
            </p>
          )}
          {broken.length > 0 && (
            <ul className="mt-2 divide-y divide-hair border-t border-hair">
              {broken.slice(0, 5).map((a) => (
                <li key={a.id}>
                  <Link to={`/clients/${a.client_id}?tab=automations`} className="flex items-center gap-3 px-4 py-2 hover:bg-ink/[0.03]">
                    <span className="h-2 w-2 shrink-0 rounded-full bg-[#ff3c00]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium">{a.name}</p>
                      <p className="truncate text-[11px] text-ink/55">{a.client_name}{a.last_message ? ` · ${a.last_message}` : ""}</p>
                    </div>
                    <span className="shrink-0 font-mono text-[10px] text-ink/40">{a.last_run_at ? timeAgo(a.last_run_at) : "never"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Tile>
  );
}
