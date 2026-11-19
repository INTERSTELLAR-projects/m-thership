// Portal home "One tap away" launcher. Same destinations as portalMap.js (routes unchanged), laid out as a tactile
// launcher in the website's grainy style: a "Suggested for you" strip, then each group with its own treatment
// (the business system as a Brain cluster on a dark grain band, Studios as flame tiles, the rest as hairline cards
// with corner brackets). Rows never leave gaps: spans are worked out from how many tiles a client actually has.
// Locked / coming-soon tiles are one quiet dimmed card with a small lock; the reason shows on hover or focus.
import { useMemo, useState } from "react";
import { Lock, ArrowUpRight, Clock } from "lucide-react";

const RECENT_KEY = "pv2_recent_tiles";
const DEFAULT_SUGGESTED = ["requests", "messages", "brain", "results", "gbp", "files"];
const ORDER = ["system", "work", "growth", "studios", "account"];

function readRecent() {
  try { const v = JSON.parse(window.localStorage.getItem(RECENT_KEY) || "[]"); return Array.isArray(v) ? v.slice(0, 8) : []; } catch { return []; }
}
function remember(k) {
  try { window.localStorage.setItem(RECENT_KEY, JSON.stringify([k, ...readRecent().filter((x) => x !== k)].slice(0, 8))); } catch { /* per-viewer convenience only */ }
}

// Columns + spans so every row is full: phone/tablet 2 columns, desktop 3 or 4, first tiles widen to fill.
function layout(count, max = 4) {
  const opts = [max, 3].filter((c, i, a) => c <= max && a.indexOf(c) === i);
  let best = { c: Math.min(count, max) || 1, s: 0 };
  if (count > max) {
    best = null;
    opts.forEach((c) => { const s = (c - (count % c)) % c; if (!best || s < best.s) best = { c, s }; });
  }
  const phoneSpan = count % 2; // odd count: the first tile is full width on phones
  return { cols: best.c, spanFirst: best.s, phoneSpan };
}
const LG_COLS = { 1: "lg:grid-cols-1", 2: "lg:grid-cols-2", 3: "lg:grid-cols-3", 4: "lg:grid-cols-4" };
const spanCls = (i, L) => `${i < L.phoneSpan ? "col-span-2" : "col-span-1"} ${i < L.spanFirst ? "lg:col-span-2" : "lg:col-span-1"}`;

function Badge({ n }) {
  if (!n) return null;
  return <span className="absolute right-3 top-3 flex h-5 min-w-5 items-center justify-center bg-[#ff3c00] px-1.5 font-mono text-[10.5px] text-white" aria-label={`${n} new`}>{n}</span>;
}

// One tile. tone: "light" (hairline card), "studio" (flame grain icon tile), "dark" (on the Brain band).
function Tile({ i, onPick, badge = 0, tone = "light", big = false, className = "" }) {
  const Icon = i.icon;
  const locked = Boolean(i.locked);
  const lockText = i.locked === "Soon" ? "Coming soon" : `Included with ${i.locked}`;
  return (
    <button
      type="button"
      data-tile={i.k}
      onClick={() => onPick(i.k)}
      title={locked ? lockText : undefined}
      aria-label={`${i.label}${locked ? `, ${lockText}` : ""}`}
      className={`lx-tile ticks-ms group relative flex w-full text-left ${tone === "dark" ? "lx-dark" : tone === "studio" ? "lx-studio" : "lx-light"} ${locked ? "lx-locked" : ""} ${big ? "lx-big" : ""} ${className}`}
    >
      <span className={`lx-well ${tone === "studio" ? "lx-well-flame pm-dots" : tone === "dark" ? (big ? "lx-well-flame" : "lx-well-glass") : "lx-well-ink"}`} aria-hidden="true">
        <Icon className={big ? "h-6 w-6" : "h-[19px] w-[19px]"} />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-semibold leading-tight tracking-[-0.02em] ${big ? "text-[20px]" : "text-[15px]"}`}>{i.label}</span>
        <span className="lx-desc mt-1 block text-[12.5px] leading-snug">{i.desc}</span>
        {locked ? <span className="lx-lockline mt-1 block text-[12px] leading-snug">{lockText}</span> : null}
      </span>
      {locked ? <Lock className="lx-lock absolute right-3 top-3 h-3.5 w-3.5" aria-hidden="true" /> : <ArrowUpRight className="lx-arrow absolute right-3 top-3 h-4 w-4" aria-hidden="true" />}
      <Badge n={badge} />
    </button>
  );
}

function Head({ label, hint, n }) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <h3 className="mono-label text-[10px] text-ink/70"><span className="text-[#ff3c00]">+</span>&nbsp; {label}</h3>
      <span className="text-[12px] text-ink/45">{hint}</span>
      {n ? <span className="ml-auto font-mono text-[10.5px] text-ink/35">{String(n).padStart(2, "0")}</span> : null}
    </div>
  );
}

function Grid({ items, onPick, badgeOf, tone, max = 4 }) {
  const L = layout(items.length, max);
  return (
    <div className={`grid grid-cols-2 gap-2.5 ${LG_COLS[L.cols]}`}>
      {items.map((i, n) => <Tile key={i.k} i={i} onPick={onPick} badge={badgeOf(i)} tone={tone} className={spanCls(n, L)} />)}
    </div>
  );
}

// The business system: Brain in the middle of a dark grain band, the rest wired to it.
function BrainCluster({ items, onPick, badgeOf }) {
  const brain = items.find((i) => i.k === "brain");
  const rest = items.filter((i) => i.k !== "brain");
  if (!brain) return <Grid items={items} onPick={onPick} badgeOf={badgeOf} tone="dark" />;
  const left = rest.slice(0, Math.ceil(rest.length / 2));
  const right = rest.slice(Math.ceil(rest.length / 2));
  return (
    <div className="band-dark pm-grain lx-cluster relative overflow-hidden rounded-lg p-3 sm:p-4">
      <div className="h-[3px] flame-bg absolute inset-x-0 top-0" />
      <div className="relative z-[1] grid gap-2.5 lg:grid-cols-[1fr_1.15fr_1fr] lg:items-center">
        <div className="lx-side lx-left order-2 grid grid-cols-2 gap-2.5 lg:order-1 lg:grid-cols-1">{left.map((i, n) => <Tile key={i.k} i={i} onPick={onPick} badge={badgeOf(i)} tone="dark" className={left.length % 2 && n === 0 && !right.length ? "col-span-2 lg:col-span-1" : ""} />)}</div>
        <div className="lx-core order-1 lg:order-2"><Tile i={brain} onPick={onPick} badge={badgeOf(brain)} tone="dark" big /></div>
        {right.length ? <div className="lx-side lx-right order-3 grid grid-cols-2 gap-2.5 lg:grid-cols-1">{right.map((i, n) => <Tile key={i.k} i={i} onPick={onPick} badge={badgeOf(i)} tone="dark" className={right.length % 2 && n === right.length - 1 ? "col-span-2 lg:col-span-1" : ""} />)}</div> : null}
      </div>
    </div>
  );
}

export default function Launcher({ groups, onPick, unread = 0 }) {
  const [recent, setRecent] = useState(readRecent);
  const all = useMemo(() => groups.flatMap((g) => g.items.map((i) => ({ ...i, group: g.id }))), [groups]);
  const byKey = useMemo(() => Object.fromEntries(all.map((i) => [i.k, i])), [all]);
  const pick = (k) => { remember(k); setRecent(readRecent()); onPick(k); };
  const badgeOf = (i) => (i.k === "messages" ? unread : i.k === "brain" ? i.badge || 0 : 0);

  const usedRecent = recent.filter((k) => byKey[k] && !byKey[k].locked);
  const suggested = [...usedRecent, ...DEFAULT_SUGGESTED.filter((k) => byKey[k] && !byKey[k].locked && !usedRecent.includes(k))].slice(0, 4).map((k) => byKey[k]);
  const ordered = ORDER.map((id) => groups.find((g) => g.id === id)).filter(Boolean);
  // Unlocked first inside each group, so what they can use today leads.
  const sortItems = (items) => [...items.filter((i) => !i.locked), ...items.filter((i) => i.locked)];

  return (
    <div className="space-y-7" data-everything data-launcher>
      {suggested.length ? (
        <section aria-label={usedRecent.length ? "Recently used" : "Suggested for you"}>
          <Head label={usedRecent.length ? "Recently used" : "Suggested for you"} hint={usedRecent.length ? "Pick up where you left off" : "Where most people start"} />
          <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
            {suggested.map((i) => (
              <button key={i.k} type="button" onClick={() => pick(i.k)} className="lx-chip ticks-ms group relative flex items-center gap-3 text-left" data-tile={i.k}>
                <span className="lx-well lx-well-flame pm-dots" aria-hidden="true"><i.icon className="h-[18px] w-[18px]" /></span>
                <span className="min-w-0 flex-1"><span className="block text-[14px] font-semibold leading-tight tracking-[-0.015em]">{i.label}</span>{usedRecent.includes(i.k) ? <span className="mt-0.5 flex items-center gap-1 font-mono text-[9.5px] uppercase tracking-[.12em] text-ink/40"><Clock className="h-2.5 w-2.5" />recent</span> : null}</span>
                <Badge n={badgeOf(i)} />
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {ordered.map((g) => {
        const items = sortItems(g.items);
        return (
          <section key={g.id} aria-labelledby={`lx-${g.id}`}>
            <span id={`lx-${g.id}`} className="sr-only">{g.label}</span>
            <Head label={g.label} hint={g.hint} n={items.length} />
            {g.id === "system" ? <BrainCluster items={items} onPick={pick} badgeOf={badgeOf} />
              : g.id === "studios" ? <Grid items={items} onPick={pick} badgeOf={badgeOf} tone="studio" />
                : <Grid items={items} onPick={pick} badgeOf={badgeOf} tone="light" max={g.id === "work" ? 3 : 4} />}
          </section>
        );
      })}
    </div>
  );
}
