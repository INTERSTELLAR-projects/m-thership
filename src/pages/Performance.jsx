import { useMemo, useState } from "react";
import { Search, Loader2, Gauge, PlayCircle, CircleSlash, ArrowUpRight, AlertTriangle } from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip, FlameDefs, KpiTile, axisProps, gridProps, cursorProps } from "@/components/charts/ChartKit";
import { timeAgo } from "@/lib/useData";
import { useSiteData, runDueAudits, latestPair } from "@/features/performance/useSiteData";
import { band, CATEGORY_LABELS, CATEGORY_ORDER, isAutoAuditBlocked } from "@/features/performance/policy";
import { DarkPanel, DarkEmpty, ScoreRing, MiniBar, DarkButton } from "@/features/performance/ui";
import ClientSiteDashboard from "@/features/performance/ClientSiteDashboard";

const WEEK = 7 * 864e5;
const weekStart = (d) => { const t = new Date(d); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() - t.getDay()); return t; };

function SiteCard({ client, audits, fixes, onOpen }) {
  const [cur, prev] = latestPair(audits, "mobile");
  const blocked = isAutoAuditBlocked(client);
  const issues = cur?.issues || [];
  const crit = issues.filter((i) => i.severity === "critical" || i.severity === "high").length;
  const d = cur && prev && cur.health_score != null && prev.health_score != null ? cur.health_score - prev.health_score : null;
  const pending = fixes.filter((f) => f.status === "proposed" || f.status === "queued").length;
  return (
    <button type="button" onClick={onOpen} className="group relative flex flex-col overflow-hidden rounded-lg border border-white/10 bg-[#161514] p-4 text-left transition hover:-translate-y-0.5 hover:border-[#ff6a00]/50 hover:shadow-[0_18px_40px_-24px_rgba(255,60,0,0.6)]">
      <span className="pointer-events-none absolute inset-0 opacity-0 transition-opacity group-hover:opacity-100" style={{ background: "radial-gradient(120% 90% at 0% 0%, rgba(255,60,0,.12), transparent 55%)" }} />
      <div className="relative flex items-start gap-4">
        <ScoreRing score={cur?.health_score ?? null} size={78} stroke={7} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold tracking-[-0.02em] text-white">{client.business}</p>
          <p className="truncate text-[11.5px] text-white/45">{client.domain || (client.websites || [])[0]}</p>
          <p className="mt-1.5 text-[11px] text-white/45">
            {cur ? <>Audited {timeAgo(cur.run_at)}{d != null && <span className={d > 0 ? "text-emerald-300" : d < 0 ? "text-[#ff8a5c]" : ""}> · {d > 0 ? "+" : ""}{d}</span>}</> : "Not audited yet"}
          </p>
        </div>
        <ArrowUpRight className="h-4 w-4 text-white/25 transition group-hover:text-[#ff8a5c]" />
      </div>
      <div className="relative mt-4 space-y-1.5">
        {CATEGORY_ORDER.map((k) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-[86px] shrink-0 text-[10.5px] text-white/45">{CATEGORY_LABELS[k]}</span>
            <MiniBar value={cur?.scores?.[k] ?? null} />
            <span className="w-7 text-right text-[11px] tabular-nums text-white/70">{cur?.scores?.[k] ?? "—"}</span>
          </div>
        ))}
      </div>
      <div className="relative mt-4 flex flex-wrap items-center gap-1.5">
        {cur && <span className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${crit ? "border-[#ff3c00]/40 text-[#ff8a5c]" : "border-emerald-400/30 text-emerald-300"}`}>{crit ? `${crit} high-priority` : "No high-priority issues"}</span>}
        {pending > 0 && <span className="rounded-sm border border-[#ffaa00]/30 px-1.5 py-0.5 text-[10px] font-semibold text-[#ffc566]">{pending} fix{pending === 1 ? "" : "es"} in progress</span>}
        {blocked && <span className="inline-flex items-center gap-1 rounded-sm border border-white/15 px-1.5 py-0.5 text-[10px] text-white/50"><CircleSlash className="h-3 w-3" /> No auto-audit (Framer)</span>}
      </div>
    </button>
  );
}

export default function Performance() {
  const data = useSiteData();
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [running, setRunning] = useState(false);
  const [note, setNote] = useState("");

  const rows = useMemo(() => data.sites.map((c) => {
    const audits = data.byClient.audits.get(c.id) || [];
    const [cur, prev] = latestPair(audits, "mobile");
    return { client: c, audits, cur, prev, fixes: data.byClient.fixes.get(c.id) || [] };
  }), [data.sites, data.byClient]);

  const audited = rows.filter((r) => r.cur?.health_score != null);
  const avg = audited.length ? Math.round(audited.reduce((s, r) => s + r.cur.health_score, 0) / audited.length) : null;
  const withPrev = audited.filter((r) => r.prev?.health_score != null);
  const prevAvg = withPrev.length ? withPrev.reduce((s, r) => s + r.prev.health_score, 0) / withPrev.length : null;
  const nowAvgSame = withPrev.length ? withPrev.reduce((s, r) => s + r.cur.health_score, 0) / withPrev.length : null;
  const openHigh = rows.reduce((s, r) => s + (r.cur?.issues || []).filter((i) => i.severity === "critical" || i.severity === "high").length, 0);
  const since30 = Date.now() - 30 * 864e5;
  const applied30 = data.allFixes.filter((f) => f.status === "applied" && new Date(f.applied_at || 0).getTime() >= since30).length;
  const applied60 = data.allFixes.filter((f) => f.status === "applied" && new Date(f.applied_at || 0).getTime() >= since30 - 30 * 864e5 && new Date(f.applied_at || 0).getTime() < since30).length;
  const inFlight = data.allFixes.filter((f) => f.status === "proposed" || f.status === "queued").length;

  // Portfolio trend: weekly average of each site's latest mobile health score that week (real audits only).
  const trend = useMemo(() => {
    const buckets = new Map();
    data.allAudits.filter((a) => (a.strategy || "mobile") === "mobile" && typeof a.health_score === "number" && a.run_at).forEach((a) => {
      const wk = weekStart(a.run_at).getTime();
      if (Date.now() - wk > 16 * WEEK) return;
      if (!buckets.has(wk)) buckets.set(wk, new Map());
      const m = buckets.get(wk);
      const prevA = m.get(a.client_id);
      if (!prevA || String(a.run_at) > String(prevA.run_at)) m.set(a.client_id, a);
    });
    return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([wk, m]) => {
      const vals = [...m.values()].map((a) => a.health_score);
      return { label: new Date(wk).toLocaleDateString("en-US", { month: "short", day: "numeric" }), "Avg health": Math.round(vals.reduce((s, v) => s + v, 0) / vals.length), Sites: vals.length };
    });
  }, [data.allAudits]);

  const selected = rows.find((r) => r.client.id === selectedId);

  const runDue = async () => {
    setRunning(true); setNote("");
    try {
      const r = await runDueAudits();
      const ok = (r.ran || []).filter((x) => !x.error).length;
      const bad = (r.ran || []).filter((x) => x.error);
      setNote([
        ok ? `Audited ${ok} site${ok === 1 ? "" : "s"}.` : (r.ran || []).length ? "" : "Every site has a recent audit.",
        bad.length ? `${bad.map((b) => `${b.client}: ${b.error}`).join("; ")}.` : "",
        r.remaining ? `${r.remaining} more due — run again.` : "",
        (r.skipped_blocked || []).length ? `Skipped ${r.skipped_blocked.join(", ")} (auto-audit off).` : "",
      ].filter(Boolean).join(" "));
      data.refresh();
    } catch (e) {
      setNote(e?.response?.data?.error || e?.message || "Could not run audits");
    } finally { setRunning(false); }
  };

  const filtered = rows.filter((r) => {
    if (search && !String(r.client.business).toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "attention") return r.cur && ((r.cur.health_score ?? 100) < 75 || (r.cur.issues || []).some((i) => i.severity === "critical"));
    if (filter === "unaudited") return !r.cur;
    return true;
  }).sort((a, b) => (a.cur?.health_score ?? 999) - (b.cur?.health_score ?? 999));

  return (
    <div className="min-h-screen bg-[#0e0d0c] text-white">
      <div className="relative overflow-hidden border-b border-white/[0.07] px-4 pb-6 pt-7 md:px-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-30 blur-3xl" style={{ background: "radial-gradient(circle, #ff3c00, #ff6a00 40%, transparent 70%)" }} />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mono-label text-[10.5px] text-white/45">(Command) · HyperCare+ Intelligence</p>
            <h1 className="mt-3 text-[34px] font-semibold leading-[0.95] tracking-[-0.045em] md:text-[46px]">Site <span className="flame-text">/Performance</span></h1>
            <p className="mt-2 max-w-xl text-[13px] text-white/50">Real Lighthouse audits, Core Web Vitals and indexing checks for every client site — with a fix for every issue.</p>
          </div>
          {!selected && (
            <DarkButton variant="flame" onClick={runDue} disabled={running}>
              {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
              {running ? "Auditing due sites…" : "Audit sites due (7+ days)"}
            </DarkButton>
          )}
        </div>
        <span className="pointer-events-none absolute bottom-[-1px] left-0 h-[2px] w-40 flame-bg" />
      </div>

      <div className="page-enter space-y-5 px-4 py-6 md:px-8">
        {note && <p className="rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-[12.5px] text-white/70">{note}</p>}

        {data.loading ? (
          <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
        ) : selected ? (
          <ClientSiteDashboard
            client={selected.client}
            audits={selected.audits}
            fixes={selected.fixes}
            gaps={data.byClient.gaps.get(selected.client.id) || []}
            snaps={data.byClient.snaps.get(selected.client.id) || []}
            work={data.byClient.work.get(selected.client.id) || []}
            onBack={() => setSelectedId(null)}
            onChanged={data.refresh}
          />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
              <KpiTile dark accent label="Avg site health" value={avg} display={avg == null ? "—" : undefined} prev={prevAvg != null && nowAvgSame != null ? prevAvg : undefined} sub={audited.length ? `${audited.length} audited site${audited.length === 1 ? "" : "s"}` : "No audits yet"} />
              <KpiTile dark label="Sites tracked" value={rows.length} sub={`${rows.length - audited.length} not audited`} />
              <KpiTile dark label="High-priority issues" value={openHigh} goodWhen="down" sub="critical + high, latest audits" />
              <KpiTile dark label="Fixes applied · 30d" value={applied30} prev={applied60 || undefined} sub="vs previous 30 days" />
              <KpiTile dark label="Fixes in progress" value={inFlight} sub="drafts + with Claude" />
            </div>

            <DarkPanel label="Portfolio" title="Average site health by week">
              {trend.length < 2 ? (
                <DarkEmpty icon={Gauge}>{audited.length ? "The trend line starts once audits span two different weeks." : "Run the first audits to see scores here. Nothing is estimated — every number comes from a real audit."}</DarkEmpty>
              ) : (
                <div className="h-[230px] px-2 pb-3 pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
                      <FlameDefs id="portfolio" />
                      <CartesianGrid {...gridProps(true)} />
                      <XAxis dataKey="label" {...axisProps(true)} minTickGap={20} />
                      <YAxis domain={[0, 100]} {...axisProps(true)} width={40} />
                      <Tooltip content={<ChartTooltip dark />} cursor={cursorProps(true)} />
                      <Area type="monotone" dataKey="Avg health" stroke="url(#portfolio-stroke)" strokeWidth={2.5} fill="url(#portfolio-area)" dot={false} activeDot={{ r: 4, fill: "#ff6a00", stroke: "#fff", strokeWidth: 1.5 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </DarkPanel>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative w-full max-w-xs">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search sites…" className="w-full rounded-md border border-white/10 bg-white/[0.03] py-2 pl-9 pr-3 text-[13px] text-white outline-none placeholder:text-white/35 focus:border-[#ff6a00]/60" />
              </div>
              <div className="flex rounded-md border border-white/10 p-0.5">
                {[["all", "All"], ["attention", "Needs attention"], ["unaudited", "Not audited"]].map(([k, l]) => (
                  <button key={k} type="button" onClick={() => setFilter(k)} className={`rounded px-2.5 py-1 text-[12px] transition ${filter === k ? "bg-white/10 text-white" : "text-white/45 hover:text-white"}`}>{l}</button>
                ))}
              </div>
              <span className="ml-auto text-[11.5px] text-white/40">{filtered.length} site{filtered.length === 1 ? "" : "s"} · lowest first</span>
            </div>

            {filtered.length === 0 ? (
              <DarkPanel><DarkEmpty icon={AlertTriangle}>{rows.length === 0 ? "No active clients with a website and a Website or HyperCare+ service yet." : "No sites match."}</DarkEmpty></DarkPanel>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {filtered.map((r) => <SiteCard key={r.client.id} client={r.client} audits={r.audits} fixes={r.fixes} onOpen={() => setSelectedId(r.client.id)} />)}
              </div>
            )}
            <p className="text-[11px] text-white/35">Health bands: {[95, 80, 60, 30].map((s) => band(s).label).join(" · ")}. Client portals never show a score under 70.</p>
          </>
        )}
      </div>
    </div>
  );
}
