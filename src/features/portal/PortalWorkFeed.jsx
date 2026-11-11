// Portal Home: "Work we did". Client-safe, team-voice lines from the work ledger (functions/portal home → work_feed).
// Never shows who or what did the work, minutes, costs or internal titles. Looks finished even when empty.
import { useState } from "react";
import { ArrowUpRight, Check, Globe, Search, PenLine, MapPin, Link2, LayoutGrid, Palette, Megaphone, Mail, BadgeDollarSign } from "lucide-react";
import { fmtDate } from "@/lib/useData";

const CAT = {
  website: ["Website", Globe], seo: ["Search", Search], content: ["Content", PenLine], gbp: ["Google profile", MapPin], citations: ["Listings", Link2],
  app_build: ["Your system", LayoutGrid], research: ["Strategy", Search], ops: ["Behind the scenes", LayoutGrid], security: ["Behind the scenes", LayoutGrid], brand: ["Brand", Palette], social: ["Social", Megaphone], email: ["Email", Mail], ads: ["Ads", BadgeDollarSign],
};

// Group by month so a long feed reads like a story of the relationship.
const monthOf = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString("en-US", { month: "long", year: "numeric" }) : "Earlier");

// "12 things done for you this month · 47 since we started" plus a by-category line. Counts only, never time.
// counts = work_counts from functions/portal (client-visible, finished work only); older responses without it show nothing.
export function workCountLines(counts) {
  if (!counts || !(Number(counts.all_time) > 0)) return null;
  const things = (n) => `${n} ${n === 1 ? "thing" : "things"}`;
  const month = Number(counts.this_month) || 0;
  const all = Number(counts.all_time) || 0;
  const headline = month > 0 ? `${things(month)} done for you this month` : `${things(all)} done for you since we started`;
  const since = month > 0 && all > month ? `${all} since we started` : "";
  const byLabel = new Map();
  for (const [k, n] of Object.entries(counts.by_category_this_month || {})) {
    const label = (CAT[k] || CAT.website)[0];
    if (Number(n) > 0) byLabel.set(label, (byLabel.get(label) || 0) + Number(n));
  }
  const cats = [...byLabel.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([label, n]) => ({ label, n }));
  return { headline, since, cats };
}

export default function PortalWorkFeed({ items = [], business, counts = null }) {
  const lines = items.length ? workCountLines(counts) : null;
  const [all, setAll] = useState(false);
  const list = all ? items : items.slice(0, 8);
  const groups = [];
  for (const it of list) {
    const m = monthOf(it.date);
    const g = groups[groups.length - 1];
    if (g && g.month === m) g.items.push(it); else groups.push({ month: m, items: [it] });
  }
  return (
    <section className="min-w-0 overflow-hidden rounded-md border border-hair bg-card" data-work-feed>
      <header className="flex items-end justify-between gap-3 border-b border-hair px-4 py-3.5 md:px-5">
        <div className="min-w-0">
          <p className="mono-label text-[9.5px] text-ink/50">Latest</p>
          <h2 className="mt-1 text-[19px] font-semibold tracking-[-0.03em]">Work we did</h2>
        </div>
        {items.length > 0 && <span className="shrink-0 font-mono text-[11px] text-ink/45">{items.length} {items.length === 1 ? "update" : "updates"}</span>}
      </header>
      {items.length === 0 ? (
        <div className="px-5 py-8">
          <div className="mx-auto max-w-sm text-center">
            <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-[#ff3c00]/10"><Check className="h-5 w-5 text-[#ff3c00]" /></span>
            <p className="mt-3 text-[15px] font-semibold tracking-[-0.02em]">Your first updates land here</p>
            <p className="mt-1 text-[13px] leading-relaxed text-ink/55">Every fix, launch, post and improvement we make for {business || "your business"} shows up in this feed as it&apos;s done.</p>
          </div>
        </div>
      ) : (
        <div>
          {lines && (
            <div className="border-b border-hair px-4 py-3 md:px-5" data-work-counts>
              <p className="text-[14px] font-semibold tracking-[-0.01em]"><span className="text-[#ff3c00]">{lines.headline}</span>{lines.since ? <span className="font-normal text-ink/55"> · {lines.since}</span> : null}</p>
              {lines.cats.length > 0 && (
                <p className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[12px] text-ink/55">
                  {lines.cats.map((c, i) => <span key={c.label}>{i > 0 && <span className="mr-2 text-ink/30">·</span>}{c.label} <b className="font-semibold tabular-nums text-ink/75">{c.n}</b></span>)}
                </p>
              )}
            </div>
          )}
          {groups.map((g) => (
            <div key={g.month}>
              <p className="border-b border-hair bg-ink/[0.025] px-4 py-1.5 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45 md:px-5">{g.month}</p>
              <ul className="divide-y divide-hair">
                {g.items.map((w) => {
                  const [label, Icon] = CAT[w.category] || CAT.website;
                  return (
                    <li key={w.id} className="flex gap-3 px-4 py-3.5 md:px-5">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-hair bg-paper"><Icon className="h-3.5 w-3.5 text-[#ff3c00]" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold leading-snug tracking-[-0.01em]">{w.title}</p>
                        {w.summary ? <p className="mt-0.5 text-[13px] leading-relaxed text-ink/60">{w.summary}</p> : null}
                        <p className="mt-1 flex items-center gap-2 text-[11px] text-ink/40"><span>{label}</span>{w.date ? <><span>·</span><span>{fmtDate(w.date)}</span></> : null}</p>
                      </div>
                      {w.url ? <a href={w.url} target="_blank" rel="noreferrer" className="mt-0.5 shrink-0 p-1 text-ink/40 hover:text-[#ff3c00]" aria-label="Open"><ArrowUpRight className="h-4 w-4" /></a> : null}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
          {items.length > 8 && (
            <button type="button" onClick={() => setAll((v) => !v)} className="w-full border-t border-hair py-2.5 text-[12.5px] font-medium text-ink/60 hover:text-[#ff3c00]">{all ? "Show less" : `See all ${items.length} updates`}</button>
          )}
        </div>
      )}
    </section>
  );
}
