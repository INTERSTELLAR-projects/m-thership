// More > How you use Møthership: private, from Justin's own sessions (UsageEvent, admin only, no third-party
// analytics). Most-used pages, the paths he repeats and the slow steps, to keep tuning the layout.
import { useMemo } from "react";
import { Link } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import { useList } from "@/lib/useData";
import { summarize } from "@/lib/usageSummary";
import { ALL_NAV } from "@/lib/nav";

const labelFor = (p) => {
  const path = String(p || "").split("?")[0];
  const hit = ALL_NAV.find((i) => i.path === p) || ALL_NAV.find((i) => i.path.split("?")[0] === path);
  if (hit) return hit.label;
  if (path.startsWith("/clients/")) return "Client page";
  return path || "?";
};
const mins = (ms) => (ms >= 60000 ? `${Math.round(ms / 60000)} min` : `${Math.round(ms / 1000)} s`);

const Card = ({ title, children }) => (
  <section className="border border-hair bg-paper/80"><h2 className="border-b border-hair px-4 py-2.5 text-[13.5px] font-semibold">{title}</h2>{children}</section>
);

export default function UsageInsights() {
  const q = useList("UsageEvent", { sort: "-at", limit: 2000 });
  const s = useMemo(() => summarize(q.data || []), [q.data]);
  const max = s.top[0]?.[1] || 1;
  return (
    <div className="pb-16">
      <PageHeader breadcrumb="More / How you use it" title="How you use /Møthership" rightText="Private · your sessions only" />
      <div className="space-y-4 px-5 pt-6 md:px-8" data-testid="usage-insights">
        <p className="max-w-2xl text-[13px] text-ink/60">From your own sessions (admin only, no third-party analytics): {s.views} page views across {s.sessions} sessions. Used to keep tuning where things live; the route map is in docs/route-map.md.</p>
        {q.isLoading ? <p className="text-[13px] text-ink/45">Loading…</p> : !s.views ? (
          <p className="border border-dashed border-hair px-4 py-6 text-[13px] text-ink/55">Nothing logged yet. It starts with your next session in the published app.</p>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Most-used pages">
              <ul className="space-y-1.5 px-4 py-3">{s.top.map(([p, n]) => (
                <li key={p}><div className="flex justify-between text-[12.5px]"><Link to={p} className="hover:text-[#ff3c00]">{labelFor(p)}</Link><span className="font-mono text-ink/50">{n}</span></div><div className="mt-1 h-1 bg-ink/[0.07]"><div className="h-full bg-[#ff3c00]" style={{ width: `${(n / max) * 100}%` }} /></div></li>
              ))}</ul>
            </Card>
            <Card title="Paths you repeat">
              {s.paths.length ? <ul className="divide-y divide-hair">{s.paths.map(([k, n]) => <li key={k} className="flex justify-between gap-3 px-4 py-2 text-[12.5px]"><span className="min-w-0 truncate">{k.split(" → ").map(labelFor).join(" → ")}</span><span className="font-mono text-ink/50">{n}×</span></li>)}</ul> : <p className="px-4 py-3 text-[12.5px] text-ink/50">No repeated paths yet.</p>}
            </Card>
            <Card title="Slow steps (median time before you move on)">
              {s.slow.length ? <ul className="divide-y divide-hair">{s.slow.map(([p, ms, n]) => <li key={p} className="flex justify-between gap-3 px-4 py-2 text-[12.5px]"><span>{labelFor(p)}</span><span className="font-mono text-ink/50">{mins(ms)} · {n} visits</span></li>)}</ul> : <p className="px-4 py-3 text-[12.5px] text-ink/50">Not enough data yet.</p>}
            </Card>
            <Card title="Main actions">
              {s.actions.length ? <ul className="divide-y divide-hair">{s.actions.map(([a, n]) => <li key={a} className="flex justify-between px-4 py-2 text-[12.5px]"><span>{String(a).replace(/_/g, " ")}</span><span className="font-mono text-ink/50">{n}</span></li>)}</ul> : <p className="px-4 py-3 text-[12.5px] text-ink/50">No actions logged yet.</p>}
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
