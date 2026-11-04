import { useMemo, useState, useRef, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2, Send, Sparkles, ArrowUpRight, Lightbulb, Check, X, Radar, Telescope, Target, MessageCircle, LayoutGrid, CalendarClock } from "lucide-react";
import { useOracle, accuracyOf, askOracle, sendToVault, ago, host } from "@/features/oracle/oracleData";
import { TOPICS, TOPIC_BY_KEY, DISCLAIMER } from "@/features/oracle/topics";
import { base44 } from "@/api/base44Client";
import { panel, mono, Label, Title, Trend, Stat, Sources, RealityMeter, ProbBar, Outcome, Horizon } from "@/features/oracle/parts";

const VIEWS = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "signals", label: "Future signals", icon: Telescope },
  { key: "predictions", label: "Predictions", icon: Target },
  { key: "opportunities", label: "Opportunities", icon: Lightbulb },
  { key: "ask", label: "Ask the Oracle", icon: MessageCircle },
];

export default function IntelligencePage() {
  const o = useOracle();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") || "overview";
  const setView = (v) => setParams(v === "overview" ? {} : { view: v });
  const acc = useMemo(() => accuracyOf(o.predictions), [o.predictions]);
  const lastScan = useMemo(() => o.topics.map((t) => t.last_scanned_at).filter(Boolean).sort().pop(), [o.topics]);

  return (
    <div className="min-h-screen bg-[#0b0b0d] text-white">
      <div className="relative overflow-hidden border-b border-white/[0.07] px-5 pb-6 pt-7 md:px-8">
        <div className="pointer-events-none absolute -right-32 -top-40 h-96 w-96 rounded-full bg-[#ff3c00]/20 blur-3xl" />
        <div className="pointer-events-none absolute right-1/3 top-10 h-48 w-48 rounded-full bg-[#ffaa00]/10 blur-3xl" />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className={`${mono} text-[11px] text-white/50`}>(Command · Future Oracle)</p>
            <h1 className="mt-3 text-[34px] font-semibold leading-[0.95] tracking-[-0.045em] md:text-[46px]">The Oracle <span className="flame-text">/Intelligence</span></h1>
            <p className="mt-2 max-w-xl text-[13px] text-white/55">What is happening now, what is coming, and what to do about it. Every claim links to its source.</p>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-right"><Label>Last scan</Label><p className="mt-1 text-sm font-semibold">{ago(lastScan)}</p></div>
            <div className="text-right"><Label>Findings</Label><p className="mt-1 text-sm font-semibold tabular-nums">{o.findings.length}</p></div>
            <div className="text-right"><Label>Accuracy</Label><p className="mt-1 text-sm font-semibold tabular-nums">{acc.hit_rate === null ? "—" : `${Math.round(acc.hit_rate * 100)}%`}</p></div>
          </div>
        </div>
        <div className="relative mt-6 flex gap-1 overflow-x-auto">
          {VIEWS.map((v) => (
            <button key={v.key} onClick={() => setView(v.key)} className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors ${view === v.key ? "bg-white text-[#0b0b0d]" : "text-white/55 hover:bg-white/[0.06] hover:text-white"}`}>
              <v.icon className="h-3.5 w-3.5" />{v.label}
            </button>
          ))}
        </div>
        <span className="pointer-events-none absolute bottom-[-1px] left-0 h-[2px] w-40 flame-bg" />
      </div>

      <div className="px-4 py-6 md:px-8">
        {o.loading ? (
          <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-white/40" /></div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={view} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
              {view === "overview" && <Overview o={o} acc={acc} />}
              {view === "signals" && <SignalsBoard theses={o.theses} />}
              {view === "predictions" && <Predictions predictions={o.predictions} acc={acc} />}
              {view === "opportunities" && <Opportunities o={o} />}
              {view === "ask" && <Ask findings={o.findings} />}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}

/* ---------------- Overview: brief + topic grid ---------------- */
function Overview({ o, acc }) {
  const brief = o.briefs.find((b) => b.kind !== "weekly") || o.briefs[0];
  const findingsById = Object.fromEntries(o.findings.map((f) => [f.id, f]));
  const topics = TOPICS.map((t) => ({ ...t, row: o.topics.find((r) => r.key === t.key), count: o.findings.filter((f) => f.topic_key === t.key).length }));
  return (
    <div className="space-y-8">
      <section className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className={`${panel} relative overflow-hidden p-5 md:p-6`}>
          <span className="pointer-events-none absolute left-0 top-0 h-full w-[3px] flame-bg" />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Title lead="Today's" accent="brief" />
            {brief && <Label>{brief.date} · {brief.new_findings ?? "—"} new findings</Label>}
          </div>
          {!brief ? <p className="mt-4 text-sm text-white/50">No brief yet. The Future Oracle writes one every morning.</p> : (
            <>
              {brief.summary && <p className="mt-3 text-[14px] leading-relaxed text-white/70">{brief.summary}</p>}
              <ol className="mt-4 divide-y divide-white/[0.06]">
                {(brief.top_changes || []).slice(0, 5).map((c, i) => {
                  const f = findingsById[c.finding_id];
                  return (
                    <li key={i} className="flex gap-3 py-3">
                      <span className="flame-text w-6 shrink-0 text-xl font-bold leading-none tabular-nums">{String(i + 1).padStart(2, "0")}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {c.topic_key && <Link to={`/intelligence/${c.topic_key}`} className={`${mono} text-[9.5px] text-[#ff6a00] hover:underline`}>{TOPIC_BY_KEY[c.topic_key]?.name}</Link>}
                          {f?.trend && <Trend t={f.trend} />}
                        </div>
                        <p className="mt-0.5 text-[14.5px] font-semibold leading-snug text-white">{c.headline}</p>
                        {c.why_it_matters && <p className="mt-1 text-[12.5px] leading-snug text-white/60">{c.why_it_matters}</p>}
                        {c.source_url && <Sources sources={[{ url: c.source_url, title: c.source_title }]} className="mt-1.5" />}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
        </div>
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-xl p-5" style={{ background: "linear-gradient(135deg,#ff3c00,#ff6a00 55%,#ffaa00)" }}>
            <p className={`${mono} text-[10px] text-white/80`}>What this means for you</p>
            <p className="mt-2 text-[15px] font-semibold leading-snug text-white">{brief?.what_it_means || "Your first brief lands tomorrow morning."}</p>
          </div>
          <div className={`${panel} p-5`}>
            <Label>Prediction scorecard</Label>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Big n={acc.pending} l="Pending" />
              <Big n={acc.resolved} l="Resolved" />
              <Big n={acc.hit_rate === null ? "—" : `${Math.round(acc.hit_rate * 100)}%`} l="Hit rate" />
            </div>
            <Link to="/intelligence?view=predictions" className="mt-4 inline-flex items-center gap-1 text-xs text-white/60 hover:text-white">Open tracker<ArrowUpRight className="h-3.5 w-3.5" /></Link>
          </div>
          <div className={`${panel} p-5`}>
            <Label>Top opportunity</Label>
            {o.opportunities.filter((x) => x.status === "new")[0] ? (
              <Link to="/intelligence?view=opportunities" className="mt-2 block text-[14px] font-semibold leading-snug text-white hover:text-[#ffaa00]">{o.opportunities.filter((x) => x.status === "new")[0].title}</Link>
            ) : <p className="mt-2 text-sm text-white/50">Nothing new.</p>}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-3"><Title lead="Topic" accent="grid" /><Label>Click a tile for the deep page</Label></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {topics.map((t, i) => (
            <motion.div key={t.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}>
              <Link to={`/intelligence/${t.key}`} className={`${panel} group flex h-full flex-col p-4 transition-colors hover:border-[#ff6a00]/40 hover:bg-white/[0.05]`}>
                <div className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-md bg-white/[0.06] text-[#ff6a00]"><t.icon className="h-3.5 w-3.5" /></span>
                  <p className="flex-1 text-[13px] font-semibold text-white">{t.name}</p>
                  <Trend t={t.row?.trend} />
                </div>
                <p className="mt-3 line-clamp-3 text-[13px] leading-snug text-white/75">{t.row?.headline_answer || <span className="text-white/35">{t.question}</span>}</p>
                {t.row?.headline_stat?.source_url && <div className="mt-3 border-t border-white/[0.06] pt-3"><Stat s={t.row.headline_stat} /></div>}
                <div className="mt-auto flex items-center justify-between pt-3">
                  <span className={`${mono} text-[9px] text-white/35`}>{t.count} findings · {ago(t.row?.last_scanned_at)}</span>
                  <ArrowUpRight className="h-3.5 w-3.5 text-white/30 group-hover:text-[#ff6a00]" />
                </div>
                {DISCLAIMER[t.key] && <p className="mt-2 text-[10px] text-white/35">{DISCLAIMER[t.key]}</p>}
              </Link>
            </motion.div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Big({ n, l }) {
  return <div><p className="text-[24px] font-semibold tabular-nums leading-none text-white">{n}</p><p className={`${mono} mt-1 text-[9px] text-white/40`}>{l}</p></div>;
}

/* ---------------- Future signals board ---------------- */
function SignalsBoard({ theses }) {
  const [open, setOpen] = useState(null);
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><Title lead="Future" accent="signals" /><p className="mt-2 text-[13px] text-white/55">Justin's I, Robot theses, checked against the real world. The meter moves sci-fi → pilot → scaling → mainstream.</p></div>
        <Label>{theses.length} theses</Label>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {theses.map((t) => (
          <div key={t.id} className={`${panel} flex flex-col p-4`}>
            <div className="flex items-start justify-between gap-2">
              <p className="text-[15px] font-semibold leading-snug text-white">{t.title}</p>
              <span className={`${mono} shrink-0 rounded bg-white/[0.07] px-1.5 py-0.5 text-[9px] text-[#ffaa00]`}>{t.reality_stage}</span>
            </div>
            {t.seed_note && <p className="mt-1 text-[11.5px] italic text-white/40">"{t.seed_note}"</p>}
            <div className="mt-3"><RealityMeter stage={t.reality_stage} /></div>
            <p className="mt-3 text-[12.5px] leading-relaxed text-white/70">{t.current_status}</p>
            {open === t.id && (
              <div className="mt-3 space-y-2 border-t border-white/[0.06] pt-3">
                {(t.examples || []).map((e, i) => (
                  <div key={i} className="text-[12px] leading-snug text-white/65">
                    <span className="font-semibold text-white">{e.company}</span>{e.where ? <span className="text-white/40"> · {e.where}</span> : null} — {e.what}{e.status ? <span className="text-white/45"> ({e.status}{e.date ? `, ${e.date}` : ""})</span> : null}
                    {e.source_url && <a href={e.source_url} target="_blank" rel="noreferrer" className="ml-1 text-[#ff6a00] hover:underline">{host(e.source_url)}</a>}
                  </div>
                ))}
                {t.timeline_estimate && <p className="text-[12px] text-white/55"><span className={`${mono} mr-1.5 text-[9px] text-white/40`}>Timeline · estimate</span>{t.timeline_estimate}</p>}
                {t.interstellar_angle && <p className="text-[12px] text-white/55"><span className={`${mono} mr-1.5 text-[9px] text-[#ff6a00]`}>Interstellar angle</span>{t.interstellar_angle}</p>}
              </div>
            )}
            <div className="mt-auto pt-3">
              <Sources sources={t.sources} max={3} />
              <button onClick={() => setOpen(open === t.id ? null : t.id)} className="mt-2 text-[11.5px] text-white/50 hover:text-white">{open === t.id ? "Less" : `Evidence (${(t.examples || []).length})`}</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Prediction tracker ---------------- */
function Predictions({ predictions, acc }) {
  const [filter, setFilter] = useState("all");
  const list = predictions.filter((p) => filter === "all" || (filter === "pending" ? (p.outcome || "pending") === "pending" : (p.outcome || "pending") !== "pending"))
    .sort((a, b) => String(a.resolve_by).localeCompare(String(b.resolve_by)));
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><Title lead="Prediction" accent="tracker" /><p className="mt-2 text-[13px] text-white/55">The Oracle commits to probabilities, then grades itself when each one comes due. That is how it gets better.</p></div>
        <div className="flex gap-1">{["all", "pending", "resolved"].map((f) => <button key={f} onClick={() => setFilter(f)} className={`rounded-md px-3 py-1.5 text-xs capitalize ${filter === f ? "bg-white text-[#0b0b0d]" : "text-white/55 hover:text-white"}`}>{f}</button>)}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {[["Pending", acc.pending], ["Resolved", acc.resolved], ["Right / partial / wrong", `${acc.right} / ${acc.partial} / ${acc.wrong}`], ["Hit rate", acc.hit_rate === null ? "—" : `${Math.round(acc.hit_rate * 100)}%`], ["Brier score (lower is better)", acc.brier === null ? "—" : acc.brier.toFixed(3)]].map(([l, v]) => (
          <div key={l} className={`${panel} p-4`}><Label>{l}</Label><p className="mt-2 text-[22px] font-semibold tabular-nums">{v}</p></div>
        ))}
      </div>
      {acc.resolved === 0 && <p className="text-[12px] text-white/45">No predictions have come due yet, so accuracy starts blank. The first ones resolve {predictions.map((p) => p.resolve_by).filter(Boolean).sort()[0] || "soon"}.</p>}
      <div className="space-y-2">
        {list.map((p) => (
          <div key={p.id} className={`${panel} p-4`}>
            <div className="flex flex-wrap items-center gap-2">
              <Outcome o={p.outcome} />
              {p.topic_key && <Link to={`/intelligence/${p.topic_key}`} className={`${mono} text-[9.5px] text-[#ff6a00] hover:underline`}>{TOPIC_BY_KEY[p.topic_key]?.name}</Link>}
              <Horizon h={p.horizon} />
              <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-white/45"><CalendarClock className="h-3 w-3" />resolves {p.resolve_by}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
              <p className="min-w-0 flex-1 text-[14.5px] font-semibold leading-snug text-white">{p.claim}</p>
              <ProbBar p={p.probability} />
            </div>
            {p.reasoning && <p className="mt-1.5 text-[12.5px] leading-snug text-white/60">{p.reasoning}</p>}
            {p.resolution_criteria && <p className="mt-1 text-[11.5px] text-white/40">Resolves right if: {p.resolution_criteria}</p>}
            {p.calibration_note && <p className="mt-1 text-[11.5px] text-[#ffcf80]/80">Calibration: {p.calibration_note}</p>}
            <Sources sources={p.evidence} className="mt-2" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Opportunities feed ---------------- */
function Opportunities({ o }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(null);
  const [err, setErr] = useState("");
  const list = [...o.opportunities].sort((a, b) => (a.status === "new" ? 0 : 1) - (b.status === "new" ? 0 : 1) || (b.fit_score || 0) - (a.fit_score || 0));
  const send = async (opp) => {
    setBusy(opp.id); setErr("");
    try {
      const idea = await sendToVault(opp);
      o.setData((d) => ({ ...d, opportunities: d.opportunities.map((x) => (x.id === opp.id ? { ...x, status: "sent_to_vault", idea_id: idea.id } : x)) }));
    } catch (e) { setErr(e?.message || "Could not send to the Idea Vault"); } finally { setBusy(null); }
  };
  const dismiss = async (opp) => {
    await base44.entities.OracleOpportunity.update(opp.id, { status: "dismissed" });
    o.setData((d) => ({ ...d, opportunities: d.opportunities.map((x) => (x.id === opp.id ? { ...x, status: "dismissed" } : x)) }));
  };
  return (
    <div className="space-y-4">
      <div><Title lead="Opportunities" accent="feed" /><p className="mt-2 text-[13px] text-white/55">Ranked for Interstellar. The Oracle never adds ideas on its own: you send the ones you want to the Idea Vault, where they get scored.</p></div>
      {err && <p className="rounded-md border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">{err}</p>}
      {list.map((opp, i) => (
        <motion.div key={opp.id} layout className={`${panel} flex flex-col gap-3 p-4 md:flex-row md:items-start ${opp.status === "dismissed" ? "opacity-40" : ""}`}>
          <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-[15px] font-semibold ${i < 3 && opp.status === "new" ? "flame-bg" : "bg-white/[0.07] text-white/70"}`}>#{i + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {opp.topic_key && <span className={`${mono} text-[9.5px] text-[#ff6a00]`}>{TOPIC_BY_KEY[opp.topic_key]?.name}</span>}
              {opp.effort && <span className={`${mono} rounded border border-white/15 px-1.5 py-0.5 text-[9px] text-white/55`}>Effort {opp.effort}</span>}
              {typeof opp.fit_score === "number" && <span className={`${mono} text-[9.5px] text-white/50`}>Fit {opp.fit_score}/100</span>}
            </div>
            <p className="mt-1 text-[15px] font-semibold leading-snug text-white">{opp.title}</p>
            <p className="mt-1 text-[12.5px] leading-snug text-white/65">{opp.summary}</p>
            {opp.why_now && <p className="mt-1.5 text-[12px] text-white/55"><span className={`${mono} mr-1.5 text-[9px] text-white/40`}>Why now</span>{opp.why_now}</p>}
            {opp.revenue_band_estimate && <p className="mt-1 text-[12px] text-white/55"><span className={`${mono} mr-1.5 text-[9px] text-white/40`}>Revenue · estimate</span>{opp.revenue_band_estimate}</p>}
            <Sources sources={opp.sources} className="mt-2" />
          </div>
          <div className="flex shrink-0 gap-2">
            {opp.status === "sent_to_vault" ? (
              <button onClick={() => navigate(`/idea-vault${opp.idea_id ? `?idea=${opp.idea_id}` : ""}`)} className="inline-flex items-center gap-1.5 rounded-md border border-white/15 px-3 py-2 text-xs text-white/75 hover:text-white"><Check className="h-3.5 w-3.5 text-emerald-400" />In the Vault<ArrowUpRight className="h-3 w-3" /></button>
            ) : opp.status === "dismissed" ? <span className="text-xs text-white/40">Dismissed</span> : (
              <>
                <button onClick={() => send(opp)} disabled={busy === opp.id} className="inline-flex items-center gap-1.5 rounded-md flame-bg px-3 py-2 text-xs font-semibold text-white disabled:opacity-60">
                  {busy === opp.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="h-3.5 w-3.5" />}Send to Idea Vault
                </button>
                <button onClick={() => dismiss(opp)} title="Dismiss" className="rounded-md border border-white/10 p-2 text-white/40 hover:text-white"><X className="h-3.5 w-3.5" /></button>
              </>
            )}
          </div>
        </motion.div>
      ))}
      {!list.length && <p className="text-sm text-white/50">No opportunities yet.</p>}
    </div>
  );
}

/* ---------------- Ask the Oracle ---------------- */
const SUGGEST = ["Which white-collar jobs is AI hitting hardest right now?", "What should I sell home-service clients in the next 6 months?", "How is AI search changing local SEO?", "Where are robotaxis actually operating today?"];

function Ask({ findings }) {
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs]);
  const ask = async (text) => {
    const question = (text || q).trim();
    if (!question || busy) return;
    setQ("");
    const history = [...msgs, { role: "user", text: question }];
    setMsgs(history);
    setBusy(true);
    try {
      const { answer, map } = await askOracle(question, findings, msgs);
      setMsgs([...history, { role: "oracle", text: answer, map }]);
    } catch (e) {
      setMsgs([...history, { role: "oracle", text: `I couldn't answer that: ${e?.message || "AI request failed"}.`, map: {} }]);
    } finally { setBusy(false); }
  };
  return (
    <div className="mx-auto max-w-3xl">
      <Title lead="Ask the" accent="Oracle" />
      <p className="mt-2 text-[13px] text-white/55">Answers come only from the {findings.length} stored, sourced findings. Each claim cites the finding it came from.</p>
      <div className={`${panel} mt-5 flex min-h-[380px] flex-col p-4`}>
        <div className="flex-1 space-y-4">
          {!msgs.length && (
            <div className="grid gap-2 sm:grid-cols-2">
              {SUGGEST.map((s) => <button key={s} onClick={() => ask(s)} className="rounded-lg border border-white/10 bg-white/[0.02] p-3 text-left text-[12.5px] text-white/70 hover:border-[#ff6a00]/40 hover:text-white"><Sparkles className="mb-1.5 h-3.5 w-3.5 text-[#ff6a00]" />{s}</button>)}
            </div>
          )}
          {msgs.map((m, i) => m.role === "user" ? (
            <div key={i} className="flex justify-end"><p className="max-w-[85%] rounded-lg bg-white px-3 py-2 text-[13px] text-[#0b0b0d]">{m.text}</p></div>
          ) : <OracleAnswer key={i} text={m.text} map={m.map} />)}
          {busy && <p className="flex items-center gap-2 text-xs text-white/50"><Loader2 className="h-3.5 w-3.5 animate-spin" />Reading the findings…</p>}
          <div ref={end} />
        </div>
        <form onSubmit={(e) => { e.preventDefault(); ask(); }} className="mt-4 flex gap-2 border-t border-white/[0.06] pt-4">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about jobs, AI, the economy, your clients' industries…" className="flex-1 rounded-md border border-white/10 bg-white/[0.04] px-3 py-2 text-[13px] text-white outline-none placeholder:text-white/35 focus:border-[#ff6a00]/50" />
          <button type="submit" disabled={busy || !q.trim()} className="inline-flex items-center gap-1.5 rounded-md flame-bg px-4 py-2 text-xs font-semibold text-white disabled:opacity-50"><Send className="h-3.5 w-3.5" />Ask</button>
        </form>
      </div>
    </div>
  );
}

function OracleAnswer({ text, map }) {
  const cited = [...new Set((String(text).match(/\[F\d+\]/g) || []).map((x) => x.slice(1, -1)))].filter((k) => map?.[k]);
  const parts = String(text).split(/(\[F\d+\])/g);
  return (
    <div className="flex gap-2.5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md flame-bg"><Radar className="h-3.5 w-3.5 text-white" /></span>
      <div className="min-w-0 flex-1">
        <div className="whitespace-pre-wrap text-[13.5px] leading-relaxed text-white/85">
          {parts.map((p, i) => {
            const m = p.match(/^\[(F\d+)\]$/);
            if (!m) return <span key={i}>{p.replace(/\*\*/g, "")}</span>;
            const f = map?.[m[1]];
            const url = f?.sources?.[0]?.url;
            return url ? <a key={i} href={url} target="_blank" rel="noreferrer" title={f.headline} className="mx-0.5 rounded bg-[#ff6a00]/15 px-1 text-[11px] font-semibold text-[#ffaa00] hover:bg-[#ff6a00]/30">{m[1]}</a> : <span key={i} className="text-white/40">{p}</span>;
          })}
        </div>
        {cited.length > 0 && (
          <div className="mt-3 space-y-1 border-t border-white/[0.06] pt-2">
            {cited.map((k) => {
              const f = map[k];
              return <p key={k} className="text-[11px] text-white/45"><span className="font-semibold text-[#ffaa00]">{k}</span> {f.headline} — {(f.sources || []).slice(0, 2).map((s, i) => <a key={i} href={s.url} target="_blank" rel="noreferrer" className="ml-1 underline hover:text-white">{host(s.url)}</a>)}</p>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}

