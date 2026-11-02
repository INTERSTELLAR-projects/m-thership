import { useMemo, useState } from "react";
import { ArrowLeft, ExternalLink, Loader2, Play, Smartphone, Monitor, Sparkles, ChevronDown, ShieldAlert, Gauge, ListChecks, Search, Eye, Wrench, CircleSlash, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChartTooltip, FlameDefs, axisProps, gridProps, cursorProps } from "@/components/charts/ChartKit";
import { fmtDate, timeAgo } from "@/lib/useData";
import { CLIENT_SCORE_FLOOR, CATEGORY_LABELS, CATEGORY_ORDER, SEVERITY, VITALS, isAutoAuditBlocked, siteUrl, clientHealthSummary } from "./policy";
import { guideFor } from "./issueGuide";
import { runAudit, latestPair } from "./useSiteData";
import { DarkPanel, DarkEmpty, ScoreRing, VitalTile, SeverityChip, DarkButton } from "./ui";
import FixDialog from "./FixDialog";
import ClientHealthSummary from "./ClientHealthSummary";

const CAT_FILTERS = [["all", "All"], ["seo", "SEO"], ["indexing", "Indexing"], ["performance", "Performance"], ["accessibility", "Accessibility"], ["best_practices", "Best practices"], ["intel", "Intel audit"]];
const FIX_STATUS = {
  proposed: { label: "Draft ready", tone: "text-[#ffc566] border-[#ffaa00]/30" },
  queued: { label: "With Claude", tone: "text-[#ff8a5c] border-[#ff6a00]/40" },
  applied: { label: "Applied", tone: "text-emerald-300 border-emerald-400/30" },
  dismissed: { label: "Dismissed", tone: "text-white/40 border-white/15" },
};

function Check({ ok, label, detail }) {
  const Icon = ok === true ? CheckCircle2 : ok === false ? XCircle : HelpCircle;
  const tone = ok === true ? "text-emerald-300" : ok === false ? "text-[#ff6a3d]" : "text-white/35";
  return (
    <li className="flex items-start gap-2.5 px-4 py-2.5">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] text-white/85">{label}</p>
        {detail && <p className="truncate text-[11.5px] text-white/45" title={typeof detail === "string" ? detail : ""}>{detail}</p>}
      </div>
    </li>
  );
}

function IssueRow({ issue, fix, onFix }) {
  const [open, setOpen] = useState(false);
  const g = guideFor(issue);
  const fs = fix ? FIX_STATUS[fix.status] : null;
  return (
    <li className="border-b border-white/[0.06] last:border-b-0">
      <div className="flex flex-wrap items-center gap-3 px-4 py-3 md:flex-nowrap">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
          <ChevronDown className={`h-4 w-4 shrink-0 text-white/35 transition-transform ${open ? "rotate-180" : ""}`} />
          <SeverityChip severity={issue.severity} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13.5px] font-medium text-white/90">{issue.title}</span>
            <span className="block truncate text-[11.5px] text-white/45">{issue.source === "intel" ? "Intel audit finding" : CATEGORY_LABELS[issue.category] || (issue.category === "indexing" ? "Indexing" : issue.category)}{issue.display_value ? ` · ${issue.display_value}` : ""}</span>
          </span>
        </button>
        {fs && <span className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${fs.tone}`}>{fs.label}</span>}
        <DarkButton variant={fix && fix.status !== "dismissed" ? "ghost" : "flame"} onClick={() => onFix(issue, fix)} className="shrink-0">
          <Sparkles className="h-3.5 w-3.5" /> {fix && fix.status !== "dismissed" ? "View fix" : "Fix with AI"}
        </DarkButton>
      </div>
      {open && (
        <div className="grid gap-5 px-4 pb-4 pl-11 md:grid-cols-2">
          <div>
            <p className="mono-label mb-1.5 text-[9.5px] text-white/40">What it means</p>
            <p className="text-[13px] leading-relaxed text-white/75">{g.why}</p>
            {issue.evidence && <p className="mt-2 text-[11.5px] text-white/45">Evidence: {issue.evidence}</p>}
            {(issue.items || []).length > 0 && (
              <>
                <p className="mono-label mb-1 mt-3 text-[9.5px] text-white/40">Affected</p>
                <ul className="space-y-1">
                  {issue.items.slice(0, 6).map((it, i) => (
                    <li key={i} className="truncate rounded-sm bg-white/[0.03] px-2 py-1 font-mono text-[10.5px] text-white/55" title={it.snippet || it.url || it.label}>
                      {it.label || it.url || it.snippet}{it.savings_ms ? ` · save ~${(it.savings_ms / 1000).toFixed(1)}s` : ""}{it.savings_bytes ? ` · ${Math.round(it.savings_bytes / 1024)} KB` : ""}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          <div>
            <p className="mono-label mb-1.5 text-[9.5px] text-white/40">Fix it by hand</p>
            <ol className="list-decimal space-y-1.5 pl-4 text-[12.5px] leading-relaxed text-white/75">
              {g.steps.map((s, i) => <li key={i} className="whitespace-pre-line">{s}</li>)}
            </ol>
          </div>
        </div>
      )}
    </li>
  );
}

export default function ClientSiteDashboard({ client, audits = [], fixes = [], gaps = [], snaps = [], work = [], onBack, onChanged }) {
  const [strategy, setStrategy] = useState("mobile");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [forceAsk, setForceAsk] = useState(false);
  const [sev, setSev] = useState("all");
  const [cat, setCat] = useState("all");
  const [fixing, setFixing] = useState(null);
  const blocked = isAutoAuditBlocked(client);

  const [cur, prev] = latestPair(audits, strategy);
  const sorted = useMemo(() => audits.filter((a) => (a.strategy || "mobile") === strategy && a.status !== "failed")
    .sort((a, b) => String(a.run_at).localeCompare(String(b.run_at))), [audits, strategy]);
  const trend = sorted.map((a) => ({ label: fmtDate(a.run_at), Health: a.health_score ?? null, SEO: a.scores?.seo ?? null, Performance: a.scores?.performance ?? null }));
  const lastFailed = audits.find((a) => a.status === "failed");

  const fixByKey = useMemo(() => {
    const m = new Map();
    [...fixes].sort((a, b) => String(b.updated_date || b.created_date).localeCompare(String(a.updated_date || a.created_date)))
      .forEach((f) => { if (!m.has(f.issue_key)) m.set(f.issue_key, f); });
    return m;
  }, [fixes]);

  const issues = useMemo(() => {
    const fromAudit = (cur?.issues || []).map((i) => ({ ...i }));
    const fromGaps = gaps.filter((g) => ["seo", "website"].includes(g.area) && g.status !== "fixed").map((g) => ({
      key: `gap-${g.id}`, source: "intel", category: "intel", area: g.area, title: g.title, severity: g.severity || "medium",
      description: g.impact || "", recommendation: g.recommendation || "", evidence: g.evidence || "",
    }));
    return [...fromAudit, ...fromGaps].sort((a, b) => (SEVERITY[a.severity]?.rank ?? 9) - (SEVERITY[b.severity]?.rank ?? 9));
  }, [cur, gaps]);
  const shown = issues.filter((i) => (sev === "all" || i.severity === sev) && (cat === "all" || i.category === cat));
  const counts = Object.fromEntries(Object.keys(SEVERITY).map((k) => [k, issues.filter((i) => i.severity === k).length]));

  const run = async (force = false) => {
    setBusy(true); setMsg(""); setForceAsk(false);
    try {
      const r = await runAudit(client.id, { strategy, force });
      if (r.skipped) setMsg(r.reason);
      else if (r.audit?.status === "failed") setMsg(r.audit.error || "The audit could not reach the site.");
      else if (r.audit?.error) setMsg(`Saved with a warning — ${r.audit.error}`);
      onChanged?.();
    } catch (e) {
      setMsg(e?.response?.data?.error || e?.message || "Audit failed");
    } finally { setBusy(false); }
  };

  const page = cur?.page || {};
  const gsc = snaps.filter((s) => s.source === "gsc").sort((a, b) => String(b.period_end).localeCompare(String(a.period_end)))[0];
  const delta = (k) => (cur && prev && typeof cur.scores?.[k] === "number" && typeof prev.scores?.[k] === "number" ? cur.scores[k] - prev.scores[k] : null);
  const hDelta = cur && prev && cur.health_score != null && prev.health_score != null ? cur.health_score - prev.health_score : null;
  const health = clientHealthSummary({ audits, fixes, work });
  const applied = fixes.filter((f) => f.status === "applied").length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <button type="button" onClick={onBack} className="mono-label inline-flex items-center gap-1.5 text-[10px] text-white/45 hover:text-[#ff8a5c]"><ArrowLeft className="h-3.5 w-3.5" /> All sites</button>
          <h2 className="mt-2 text-[28px] font-semibold leading-none tracking-[-0.045em] text-white md:text-[36px]">{client.business}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-white/50">
            <a href={siteUrl(client)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white">{client.domain || (client.websites || [])[0]} <ExternalLink className="h-3 w-3" /></a>
            <span>{cur ? `Audited ${timeAgo(cur.run_at)}` : "Never audited"}</span>
            {blocked && <span className="inline-flex items-center gap-1 rounded-sm border border-[#ffaa00]/30 px-1.5 py-0.5 text-[10.5px] text-[#ffc566]"><CircleSlash className="h-3 w-3" /> Auto-audit off until it leaves Framer</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border border-white/10 p-0.5">
            {[["mobile", Smartphone], ["desktop", Monitor]].map(([s, Icon]) => (
              <button key={s} type="button" onClick={() => setStrategy(s)} className={`inline-flex items-center gap-1 rounded px-2.5 py-1 text-[12px] capitalize transition ${strategy === s ? "bg-white/10 text-white" : "text-white/45 hover:text-white"}`}><Icon className="h-3.5 w-3.5" />{s}</button>
            ))}
          </div>
          {blocked ? (
            forceAsk ? (
              <span className="flex items-center gap-2 text-[12px] text-white/70">
                Run one manual audit anyway?
                <DarkButton variant="flame" onClick={() => run(true)} disabled={busy}>Run once</DarkButton>
                <DarkButton variant="subtle" onClick={() => setForceAsk(false)}>Cancel</DarkButton>
              </span>
            ) : (
              <DarkButton onClick={() => setForceAsk(true)} disabled={busy}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Manual audit</DarkButton>
            )
          ) : (
            <DarkButton variant="flame" onClick={() => run(false)} disabled={busy}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} {busy ? "Auditing… (~45s)" : "Run audit"}</DarkButton>
          )}
        </div>
      </div>
      {msg && <p className="rounded-md border border-[#ffaa00]/25 bg-[#ffaa00]/[0.06] px-3 py-2 text-[12.5px] text-[#ffd08a]">{msg}</p>}

      {!cur ? (
        <DarkPanel>
          <DarkEmpty icon={Gauge}>
            {lastFailed ? `The last audit couldn't complete: ${lastFailed.error || "the site did not respond"}.` : `No ${strategy} audit yet for this site. Run one to get scores, Core Web Vitals and a fix list — nothing is estimated.`}
          </DarkEmpty>
        </DarkPanel>
      ) : (
        <>
          {/* Scores */}
          <DarkPanel bodyClass="grid gap-6 p-5 md:grid-cols-[auto_1fr] md:p-6">
            <div className="flex flex-col items-center justify-center md:border-r md:border-white/[0.07] md:pr-8">
              <ScoreRing score={cur.health_score} size={168} stroke={13} />
              <p className="mt-3 text-[13px] font-medium text-white">Site health</p>
              <p className="text-[11px] text-white/45">{hDelta == null ? "First audit" : `${hDelta > 0 ? "+" : ""}${hDelta} since ${fmtDate(prev.run_at)}`}</p>
            </div>
            <div>
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                {CATEGORY_ORDER.map((k) => {
                  const d = delta(k);
                  return <ScoreRing key={k} score={cur.scores?.[k] ?? null} size={92} stroke={8} label={CATEGORY_LABELS[k]} sub={d == null ? " " : `${d > 0 ? "▲" : d < 0 ? "▼" : "•"} ${Math.abs(d)} vs last`} />;
                })}
              </div>
              <p className="mt-5 text-[11.5px] leading-relaxed text-white/40">
                Google Lighthouse via PageSpeed Insights ({strategy}). Site health = SEO 40% · Performance 30% · Accessibility 15% · Best practices 15%.
                {cur.status === "partial" && <span className="text-[#ffc566]"> PageSpeed did not return this run; on-page checks only. {cur.error}</span>}
              </p>
            </div>
          </DarkPanel>

          {/* Vitals + trend */}
          <div className="grid gap-5 xl:grid-cols-[1.1fr_1fr]">
            <DarkPanel label="Core Web Vitals" title={cur.vitals?.field_category ? `Real users: ${String(cur.vitals.field_category).toLowerCase().replace("_", " ")}` : "Lab measurements"}>
              <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3">
                {VITALS.map((v) => <VitalTile key={v.key} def={v} value={cur.vitals?.[v.key] ?? null} fieldValue={v.field ? cur.vitals?.[v.field] ?? null : null} />)}
              </div>
              {!cur.vitals?.field_category && <p className="px-4 pb-4 text-[11px] text-white/40">Not enough Chrome real-user traffic for field data yet — showing lab numbers.</p>}
            </DarkPanel>
            <DarkPanel label="Trend" title={`${sorted.length} ${strategy} audit${sorted.length === 1 ? "" : "s"}`}>
              {trend.length < 2 ? (
                <DarkEmpty>Run another audit to start the trend line. Each run adds a point.</DarkEmpty>
              ) : (
                <div className="h-[260px] px-2 pb-3 pt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trend} margin={{ top: 4, right: 12, left: -18, bottom: 0 }}>
                      <FlameDefs id="site-trend" />
                      <CartesianGrid {...gridProps(true)} />
                      <XAxis dataKey="label" {...axisProps(true)} minTickGap={24} />
                      <YAxis domain={[0, 100]} {...axisProps(true)} width={40} />
                      <Tooltip content={<ChartTooltip dark />} cursor={cursorProps(true)} />
                      <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }} />
                      <Area type="monotone" dataKey="Health" stroke="url(#site-trend-stroke)" strokeWidth={2.5} fill="url(#site-trend-area)" dot={false} activeDot={{ r: 4, fill: "#ff6a00", stroke: "#fff", strokeWidth: 1.5 }} connectNulls />
                      <Area type="monotone" dataKey="SEO" stroke="#ffaa00" strokeWidth={1.5} fill="none" dot={false} strokeDasharray="4 3" connectNulls />
                      <Area type="monotone" dataKey="Performance" stroke="rgba(255,255,255,0.55)" strokeWidth={1.5} fill="none" dot={false} connectNulls />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </DarkPanel>
          </div>

          {/* Indexing */}
          <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <DarkPanel label="Indexing" title="Can Google find and list it?">
              <ul className="divide-y divide-white/[0.05]">
                <Check ok={page.http_status ? page.http_status < 400 : undefined} label={`Home page responds${page.http_status ? ` (HTTP ${page.http_status})` : ""}`} detail={page.final_url} />
                <Check ok={page.noindex == null ? undefined : !page.noindex} label={page.noindex ? "Page is set to noindex" : "Indexable (no noindex)"} detail={page.robots_meta || page.x_robots || ""} />
                <Check ok={page.https} label="Served over HTTPS" />
                <Check ok={page.robots_txt?.status ? page.robots_txt.status < 400 && !page.robots_txt.blocks_all : undefined} label={page.robots_txt?.blocks_all ? "robots.txt blocks the whole site" : "robots.txt"} detail={page.robots_txt?.status ? `HTTP ${page.robots_txt.status}${page.robots_txt.sitemaps?.length ? ` · points to ${page.robots_txt.sitemaps[0]}` : ""}` : page.robots_txt?.error} />
                <Check ok={page.sitemap?.status ? page.sitemap.status < 400 : undefined} label={page.sitemap?.url_count ? `XML sitemap · ${page.sitemap.url_count} URLs` : "XML sitemap"} detail={page.sitemap?.url} />
                <Check ok={page.canonical ? true : page.http_status ? false : undefined} label="Canonical tag" detail={page.canonical || "Not set"} />
                <Check ok={(page.jsonld_types || []).length ? true : page.http_status ? false : undefined} label="Structured data" detail={(page.jsonld_types || []).join(", ") || "None found"} />
              </ul>
            </DarkPanel>
            <DarkPanel label="Search Console" title={gsc ? `${fmtDate(gsc.period_start)} – ${fmtDate(gsc.period_end)}` : "Not connected yet"}>
              {gsc ? (
                <div className="grid grid-cols-2 gap-3 p-4">
                  {[["clicks", "Clicks"], ["impressions", "Impressions"], ["ctr", "CTR %"], ["avg_position", "Avg position"]].map(([k, l]) => (
                    <div key={k} className="rounded-md border border-white/[0.07] bg-white/[0.02] p-3">
                      <p className="text-[22px] font-semibold tracking-[-0.03em] tabular-nums text-white">{gsc.metrics?.[k] != null ? Number(gsc.metrics[k]).toLocaleString() : "—"}</p>
                      <p className="mono-label mt-1 text-[9px] text-white/45">{l}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <DarkEmpty icon={Search}>Search Console numbers appear here once a PerformanceSnapshot is logged for this client (Client page → Performance).</DarkEmpty>
              )}
              <div className="grid grid-cols-2 gap-3 border-t border-white/[0.06] p-4 text-[12px] text-white/60">
                <p><span className="block text-[11px] text-white/40">Title</span><span className="line-clamp-2 text-white/80">{page.title || "—"}</span></p>
                <p><span className="block text-[11px] text-white/40">Meta description</span><span className="line-clamp-2 text-white/80">{page.meta_description || "—"}</span></p>
                <p><span className="block text-[11px] text-white/40">H1</span><span className="line-clamp-2 text-white/80">{(page.h1s || [])[0] || "—"}</span></p>
                <p><span className="block text-[11px] text-white/40">Images missing alt</span><span className="text-white/80">{page.images_total != null ? `${(page.images_missing_alt || []).length} of ${page.images_total}` : "—"}</span></p>
              </div>
            </DarkPanel>
          </div>
        </>
      )}

      {/* Issues */}
      <DarkPanel
        label="Issues"
        title={`${issues.length} to fix${counts.critical ? ` · ${counts.critical} critical` : ""}`}
        action={
          <div className="flex flex-wrap gap-1">
            {["all", "critical", "high", "medium", "low"].map((s) => (
              <button key={s} type="button" onClick={() => setSev(s)} className={`rounded px-2 py-1 text-[11px] capitalize transition ${sev === s ? "bg-white/10 text-white" : "text-white/45 hover:text-white"}`}>
                {s}{s !== "all" && counts[s] ? ` ${counts[s]}` : ""}
              </button>
            ))}
          </div>
        }
      >
        <div className="no-scrollbar flex gap-1 overflow-x-auto border-b border-white/[0.06] px-3 py-2">
          {CAT_FILTERS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setCat(k)} className={`whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] transition ${cat === k ? "bg-gradient-to-r from-[#ff3c00]/25 to-[#ff6a00]/15 text-[#ffb08a]" : "text-white/45 hover:text-white"}`}>{l}</button>
          ))}
        </div>
        {shown.length === 0 ? (
          <DarkEmpty icon={ListChecks}>{issues.length === 0 ? (cur ? "No failing checks in the latest audit." : "Issues appear after the first audit.") : "Nothing matches this filter."}</DarkEmpty>
        ) : (
          <ul>{shown.map((i) => <IssueRow key={i.key} issue={i} fix={fixByKey.get(i.key)} onFix={(issue, fix) => setFixing({ issue, fix })} />)}</ul>
        )}
      </DarkPanel>

      {/* Fixes + client view */}
      <div className="grid gap-5 xl:grid-cols-[1fr_1fr]">
        <DarkPanel label="Fix log" title={`${applied} applied · ${fixes.filter((f) => f.status === "queued").length} with Claude · ${fixes.filter((f) => f.status === "proposed").length} drafts`}>
          {fixes.length === 0 ? <DarkEmpty icon={Wrench}>Fixes you generate with AI are tracked here.</DarkEmpty> : (
            <ul className="max-h-[360px] divide-y divide-white/[0.05] overflow-y-auto">
              {fixes.map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => setFixing({ issue: { key: f.issue_key, title: f.issue_title, severity: f.severity, category: "", source: String(f.issue_key).startsWith("gap-") ? "intel" : "" }, fix: f })} className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-white/[0.02]">
                    <span className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${FIX_STATUS[f.status]?.tone || ""}`}>{FIX_STATUS[f.status]?.label || f.status}</span>
                    <span className="min-w-0 flex-1 truncate text-[13px] text-white/85">{f.issue_title}</span>
                    <span className="font-mono text-[10.5px] text-white/40">{fmtDate(f.applied_at || f.updated_date || f.created_date)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </DarkPanel>
        <div>
          <p className="mono-label mb-2 flex items-center gap-1.5 text-[9.5px] text-white/45"><Eye className="h-3.5 w-3.5" /> What the client sees{health.score == null && cur?.health_score != null ? ` (score hidden while under ${CLIENT_SCORE_FLOOR})` : ""}</p>
          <ClientHealthSummary health={health} businessName={client.business} />
          {blocked && <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/40"><ShieldAlert className="h-3.5 w-3.5" /> PowerLift is excluded from automatic audits until the site moves to Base44.</p>}
        </div>
      </div>

      <FixDialog
        open={!!fixing}
        onOpenChange={(o) => !o && setFixing(null)}
        client={client}
        audit={(fixing?.fix?.audit_id && audits.find((a) => a.id === fixing.fix.audit_id)) || cur}
        issue={fixing ? issues.find((i) => i.key === fixing.issue.key) || fixing.issue : null}
        existing={fixing?.fix || null}
        onChanged={onChanged}
      />
    </div>
  );
}
