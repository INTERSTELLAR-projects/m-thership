import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useOracle, seriesFor, ago } from "@/features/oracle/oracleData";
import { TOPIC_BY_KEY, DISCLAIMER, HORIZONS } from "@/features/oracle/topics";
import { panel, mono, Label, Title, Trend, Stat, Sources, FindingCard, SeriesChart, ProbBar, Outcome, Horizon, RealityMeter } from "@/features/oracle/parts";

export default function TopicPage() {
  const { topicKey } = useParams();
  const o = useOracle();
  const meta = TOPIC_BY_KEY[topicKey];
  const row = o.topics.find((t) => t.key === topicKey);
  const findings = useMemo(() => o.findings.filter((f) => f.topic_key === topicKey).sort((a, b) => String(b.date).localeCompare(String(a.date))), [o.findings, topicKey]);
  const series = useMemo(() => seriesFor(findings), [findings]);
  const preds = o.predictions.filter((p) => p.topic_key === topicKey);
  const opps = o.opportunities.filter((p) => p.topic_key === topicKey && p.status !== "dismissed");
  const theses = topicKey === "future_signals" || topicKey === "robotics_autonomy" ? o.theses : [];
  const [hz, setHz] = useState("all");
  const shown = findings.filter((f) => hz === "all" || f.horizon === hz);

  if (!meta) return <div className="min-h-screen bg-[#0b0b0d] p-8 text-white">Unknown topic. <Link to="/intelligence" className="text-[#ff6a00] underline">Back</Link></div>;
  const Icon = meta.icon;
  const words = meta.name.split(" ");
  const last = words.pop();
  if (!words.length) words.push("Topic");

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-white">
      <div className="relative overflow-hidden border-b border-white/[0.07] px-5 pb-6 pt-6 md:px-8">
        <div className="pointer-events-none absolute -right-32 -top-40 h-96 w-96 rounded-full bg-[#ff3c00]/20 blur-3xl" />
        <Link to="/intelligence" className={`${mono} relative inline-flex items-center gap-1.5 text-[10px] text-white/50 hover:text-[#ff6a00]`}><ArrowLeft className="h-3.5 w-3.5" />The Oracle</Link>
        <div className="relative mt-4 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg flame-bg"><Icon className="h-5 w-5 text-white" /></span>
            <h1 className="text-[30px] font-semibold leading-[0.95] tracking-[-0.045em] md:text-[40px]">{words.join(" ")} <span className="flame-text">/{last}</span></h1>
          </div>
          <div className="flex items-center gap-5">
            <div className="text-right"><Label>Findings</Label><p className="mt-1 text-sm font-semibold">{findings.length}</p></div>
            <div className="text-right"><Label>Updated</Label><p className="mt-1 text-sm font-semibold">{ago(row?.last_scanned_at)}</p></div>
          </div>
        </div>
        <p className="relative mt-3 max-w-2xl text-[13px] text-white/55">{meta.question}</p>
        {DISCLAIMER[topicKey] && <p className={`${mono} relative mt-3 inline-block rounded border border-[#ffaa00]/30 bg-[#ffaa00]/10 px-2 py-1 text-[9.5px] text-[#ffcf80]`}>{DISCLAIMER[topicKey]}</p>}
      </div>

      {o.loading ? <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div> : (
        <div className="space-y-8 px-4 py-6 md:px-8">
          <section className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`${panel} relative overflow-hidden p-5 md:p-6`}>
              <span className="pointer-events-none absolute left-0 top-0 h-full w-[3px] flame-bg" />
              <div className="flex items-center gap-2"><Label>The current answer</Label><Trend t={row?.trend} withLabel /></div>
              <p className="mt-3 text-[20px] font-semibold leading-snug tracking-[-0.025em] text-white md:text-[23px]">{row?.headline_answer || "No answer yet. The Oracle has not scanned this topic."}</p>
              {row?.what_it_means && <p className="mt-4 text-[13.5px] leading-relaxed text-white/65"><span className={`${mono} mr-2 text-[9.5px] text-[#ff6a00]`}>What it means for you</span>{row.what_it_means}</p>}
            </motion.div>
            <div className={`${panel} p-5`}>
              <Label>Key stat</Label>
              <div className="mt-3">{row?.headline_stat?.source_url ? <Stat s={row.headline_stat} big /> : <p className="text-sm text-white/45">No sourced stat yet.</p>}</div>
            </div>
          </section>

          {series.length > 0 && (
            <section>
              <div className="mb-3 flex items-end justify-between"><Title lead="Stat" accent="timeline" /><Label>Sourced data points only</Label></div>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{series.map((s) => <SeriesChart key={s.metric} series={s} />)}</div>
            </section>
          )}

          {theses.length > 0 && topicKey === "future_signals" && (
            <section>
              <div className="mb-3 flex items-end justify-between"><Title lead="Reality" accent="check" /><Link to="/intelligence?view=signals" className="text-xs text-white/55 hover:text-white">Open the board</Link></div>
              <div className="grid gap-2 md:grid-cols-2">
                {theses.map((t) => (
                  <div key={t.id} className={`${panel} p-3`}>
                    <div className="flex items-center justify-between gap-2"><p className="text-[13px] font-semibold text-white">{t.title}</p><span className={`${mono} text-[9px] text-[#ffaa00]`}>{t.reality_stage}</span></div>
                    <div className="mt-2"><RealityMeter stage={t.reality_stage} compact /></div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
              <Title lead="Recent" accent="findings" />
              <div className="flex gap-1">
                {["all", ...Object.keys(HORIZONS)].map((h) => <button key={h} onClick={() => setHz(h)} className={`rounded-md px-2.5 py-1 text-[11px] ${hz === h ? "bg-white text-[#0b0b0d]" : "text-white/55 hover:text-white"}`}>{h === "all" ? "All" : HORIZONS[h]}</button>)}
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">{shown.map((f) => <FindingCard key={f.id} f={f} />)}</div>
            {!shown.length && <p className="text-sm text-white/45">No findings for this filter yet.</p>}
          </section>

          <section className="grid gap-4 lg:grid-cols-2">
            <div>
              <Title lead="Predictions" accent="here" className="mb-3" />
              <div className="space-y-2">
                {preds.map((p) => (
                  <div key={p.id} className={`${panel} p-4`}>
                    <div className="flex items-center gap-2"><Outcome o={p.outcome} /><Horizon h={p.horizon} /><span className="ml-auto text-[11px] text-white/40">resolves {p.resolve_by}</span></div>
                    <div className="mt-2 flex items-start justify-between gap-3"><p className="text-[13.5px] font-semibold leading-snug text-white">{p.claim}</p><ProbBar p={p.probability} /></div>
                    {p.reasoning && <p className="mt-1 text-[12px] text-white/55">{p.reasoning}</p>}
                    <Sources sources={p.evidence} className="mt-2" />
                  </div>
                ))}
                {!preds.length && <p className="text-sm text-white/45">No predictions on this topic yet.</p>}
              </div>
            </div>
            <div>
              <Title lead="Opportunities" accent="here" className="mb-3" />
              <div className="space-y-2">
                {opps.map((p) => (
                  <Link key={p.id} to="/intelligence?view=opportunities" className={`${panel} block p-4 hover:border-[#ff6a00]/40`}>
                    <p className="text-[13.5px] font-semibold text-white">{p.title}</p>
                    <p className="mt-1 text-[12px] text-white/55">{p.summary}</p>
                  </Link>
                ))}
                {!opps.length && <p className="text-sm text-white/45">No opportunities tied to this topic yet.</p>}
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
