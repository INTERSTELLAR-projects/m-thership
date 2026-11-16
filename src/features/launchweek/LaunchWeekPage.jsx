import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, ExternalLink, MessageSquareText, SkipForward, Undo2, Pencil, Copy, Sparkles, AlertTriangle, ChevronDown, Mic, RefreshCw } from "lucide-react";
import { Mono, Meter } from "@/features/command/ui";
import { DictationBox, AnswerReview } from "@/features/command/Dictation";
import { useDictation } from "@/features/command/voice";
import { lwProgress, lwAskClientText } from "./core";
import { loadBoard, answerQuestion, setQuestionStatus, errMsg } from "./api";

// Launch Week: sit down, pick a client, answer what the agents need to finish the site. One tap for the default or an
// option; or talk / type it and confirm the Brain's clean-up. Every answer files a client fact in the Brain, and when a
// client's blocking questions are done the agent job to apply them is queued in the Claude Queue.

const sortQs = (a, b) => (b.blocks_launch ? 1 : 0) - (a.blocks_launch ? 1 : 0) || (a.order || 0) - (b.order || 0);
const MODE_LABEL = { default: "Default accepted", option: "Option picked", voice: "Dictated", typed: "Typed", exact: "Your exact words" };
const shortName = (n) => String(n || "").replace(/\s*\(.*?\)\s*/g, " ").trim();

function Logo({ src, name, size = 36, dark = false }) {
  const [bad, setBad] = useState(false);
  const initials = shortName(name).split(/\s+/).filter((w) => !/^the$/i.test(w)).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  if (src && !bad) return <img src={src} alt="" onError={() => setBad(true)} className={`shrink-0 object-contain p-1 ${dark ? "bg-white" : "bg-white border border-hair"}`} style={{ width: size, height: size }} />;
  return <span className={`flex shrink-0 items-center justify-center font-mono text-[11px] font-semibold ${dark ? "bg-white/10 text-white" : "bg-ink text-white"}`} style={{ width: size, height: size }} aria-hidden="true">{initials || "•"}</span>;
}

function ClientTab({ c, p, active, onPick }) {
  const left = p.blocking_total - p.blocking_answered;
  return (
    <button type="button" onClick={onPick} aria-current={active ? "true" : undefined}
      className={`flex w-[230px] shrink-0 snap-start items-center gap-3 border px-3 py-2.5 text-left transition-colors lg:w-full ${active ? "border-ink bg-ink text-white" : "border-hair bg-paper/80 hover:border-ink"}`}>
      <Logo src={c.logo_url} name={c.client_name} size={34} dark={active} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-medium">{shortName(c.client_name)}</span>
        <span className={`mt-0.5 block font-mono text-[10.5px] tabular-nums ${active ? "text-white/60" : "text-ink/50"}`}>
          {p.answered}/{p.total} answered{left > 0 ? ` · ${left} blocking` : p.total ? " · unblocked" : ""}
        </span>
        <span className={`mt-1.5 block h-[3px] ${active ? "bg-white/15" : "bg-ink/[0.08]"}`}><span className="block h-full bg-[#ff3c00]" style={{ width: `${p.total ? Math.round((p.answered / p.total) * 100) : 0}%` }} /></span>
      </span>
      {c.job_id ? <Sparkles className={`h-4 w-4 shrink-0 ${active ? "text-[#ffaa00]" : "text-[#ff6a00]"}`} aria-label="Agent job queued" /> : null}
    </button>
  );
}

function Composer({ q, onSaved, onCancel }) {
  const [review, setReview] = useState(null);
  const usedMic = useRef(false);
  const dict = useDictation({ onStop: (t) => { if (t.trim()) setReview(t.trim()); } });
  useEffect(() => { if (dict.listening) usedMic.current = true; }, [dict.listening]);
  const toReview = (e) => { e?.preventDefault(); if (dict.listening) { dict.stop(); return; } if (dict.text.trim()) setReview(dict.text.trim()); };
  if (review) {
    return (
      <div className="mt-3 border-t border-hair pt-3">
        <AnswerReview raw={review} question={q.question} onBack={() => { dict.setText(review); setReview(null); }}
          onSave={(statements, { exact }) => onSaved(statements, review, exact ? "exact" : usedMic.current ? "voice" : "typed")} />
      </div>
    );
  }
  return (
    <form onSubmit={toReview} className="mt-3 border-t border-hair pt-3">
      <DictationBox dict={dict} autoFocus rows={3} placeholder={dict.supported ? "Tap the mic and talk, then tap stop. Or type." : "Type your answer."} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" disabled={!dict.text.trim() && !dict.listening} className="inline-flex h-11 items-center gap-2 bg-ink px-4 text-[14px] font-medium text-white hover:bg-[#ff3c00] disabled:opacity-40"><Check className="h-4 w-4" />{dict.listening ? "Stop & review" : "Review & save"}</button>
        <button type="button" onClick={() => { dict.stop(); onCancel(); }} className="h-11 px-3 text-[13px] text-ink/55 hover:text-ink">Cancel</button>
      </div>
    </form>
  );
}

function QuestionCard({ q, open, onOpen, onClose, onAnswer, onStatus }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [changing, setChanging] = useState(false);
  const run = async (key, fn) => { setBusy(key); setErr(""); try { await fn(); setChanging(false); } catch (e) { setErr(errMsg(e)); } setBusy(""); };
  const answered = q.status === "answered";
  const waiting = q.status === "ask_client";
  const skipped = q.status === "skipped";
  const showActions = (!answered && !waiting && !skipped) || changing;
  const options = (q.options || []).filter((o) => o && o.trim().toLowerCase() !== String(q.default_answer || "").trim().toLowerCase());

  return (
    <article id={`lq-${q.id}`} className={`scroll-mt-24 border bg-paper/90 ${answered && !changing ? "border-hair/70" : waiting ? "border-[#ff6a00]/50" : "border-hair"}`} aria-label={q.question}>
      <div className="p-4 md:p-5">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {q.blocks_launch && <span className="inline-flex items-center gap-1 bg-[#ff3c00] px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.12em] text-white"><AlertTriangle className="h-3 w-3" />Blocks launch</span>}
          {q.category && <Mono className="text-ink/45">{q.category}</Mono>}
          {answered && <Mono className="text-[#1f8a5b]">✓ {MODE_LABEL[q.answer_mode] || "Answered"}</Mono>}
          {waiting && <Mono className="text-[#c24100]">Ask client</Mono>}
          {skipped && <Mono className="text-ink/40">Skipped</Mono>}
        </div>
        <h3 className={`mt-2 font-semibold leading-snug tracking-[-0.01em] ${answered && !changing ? "text-[15px] text-ink/75" : "text-[17px] md:text-[18px]"}`}>{q.question}</h3>
        {q.apply_to && showActions && <p className="mt-1 text-[12px] text-ink/50">Applies to: {q.apply_to}</p>}

        {answered && !changing && (
          <div className="mt-2 flex items-start justify-between gap-3">
            <p className="min-w-0 border-l-2 border-[#1f8a5b] pl-3 text-[14px] leading-relaxed text-ink">{q.answer}</p>
            <button type="button" onClick={() => setChanging(true)} className="inline-flex shrink-0 items-center gap-1 text-[12px] text-ink/50 hover:text-[#ff3c00]"><Pencil className="h-3 w-3" />Change</button>
          </div>
        )}
        {(waiting || skipped) && !changing && (
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setChanging(true)} className="inline-flex h-10 items-center gap-1.5 border border-hair px-3 text-[13px] hover:border-ink"><Pencil className="h-3.5 w-3.5" />Answer now</button>
            <button type="button" disabled={!!busy} onClick={() => run("undo", () => onStatus(q, "open"))} className="inline-flex h-10 items-center gap-1.5 px-2 text-[12.5px] text-ink/50 hover:text-ink disabled:opacity-40"><Undo2 className="h-3.5 w-3.5" />Back to open</button>
          </div>
        )}

        {showActions && (
          <>
            <div className="mt-3 space-y-2">
              {q.default_answer ? (
                <button type="button" disabled={!!busy} onClick={() => run("default", () => onAnswer(q, [q.default_answer], q.default_answer, "default"))}
                  className="group flex w-full items-start gap-3 bg-ink p-3 text-left text-white transition-colors hover:bg-[#ff3c00] disabled:opacity-50 md:p-3.5">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#ffaa00] group-hover:text-white" />
                  <span className="min-w-0"><span className="block font-mono text-[9.5px] uppercase tracking-[0.14em] text-white/55 group-hover:text-white/80">{busy === "default" ? "Saving…" : "Use the default"}</span><span className="mt-0.5 block text-[14.5px] leading-snug">{q.default_answer}</span></span>
                </button>
              ) : null}
              {options.length > 0 && (
                <div className="flex flex-wrap gap-2" role="group" aria-label="Options">
                  {options.map((o) => (
                    <button key={o} type="button" disabled={!!busy} onClick={() => run(`o:${o}`, () => onAnswer(q, [o], o, "option"))}
                      className="min-h-[44px] border border-ink/25 bg-white px-3.5 py-2 text-left text-[14px] leading-snug hover:border-ink hover:bg-ink hover:text-white disabled:opacity-50">
                      {busy === `o:${o}` ? "Saving…" : o}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {open ? (
              <Composer q={q} onCancel={onClose} onSaved={async (statements, raw, mode) => { await onAnswer(q, statements, raw, mode); setChanging(false); onClose(); }} />
            ) : (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={onOpen} className="inline-flex h-10 items-center gap-1.5 border border-hair bg-white px-3 text-[13px] hover:border-ink"><Mic className="h-3.5 w-3.5" />Say or type it</button>
                {q.status !== "ask_client" && <button type="button" disabled={!!busy} onClick={() => run("ask", () => onStatus(q, "ask_client"))} className="inline-flex h-10 items-center gap-1.5 border border-hair bg-white px-3 text-[13px] hover:border-[#ff6a00] disabled:opacity-40"><MessageSquareText className="h-3.5 w-3.5" />Ask client</button>}
                {q.status !== "skipped" && <button type="button" disabled={!!busy} onClick={() => run("skip", () => onStatus(q, "skipped"))} className="inline-flex h-10 items-center gap-1.5 px-2 text-[12.5px] text-ink/50 hover:text-ink disabled:opacity-40"><SkipForward className="h-3.5 w-3.5" />Skip</button>}
                {changing && <button type="button" onClick={() => setChanging(false)} className="h-10 px-2 text-[12.5px] text-ink/50 hover:text-ink">Keep {answered ? "answer" : "as is"}</button>}
              </div>
            )}
          </>
        )}
        {err && <p className="mt-2 text-[13px] text-[#c22a00]" role="alert">{err}</p>}
      </div>
    </article>
  );
}

function AskClientBox({ client, rows }) {
  const text = lwAskClientText(shortName(client.client_name), rows);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);
  if (!text) return null;
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch { ref.current?.select(); try { document.execCommand("copy"); } catch { /* manual copy */ } }
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };
  const n = rows.filter((q) => q.status === "ask_client").length;
  return (
    <section className="border border-[#ff6a00]/50 bg-white/70" aria-label="Ask client list">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hair px-4 py-3">
        <h3 className="text-[14px] font-semibold">Ask {shortName(client.client_name)} · {n}</h3>
        <div className="flex gap-2">
          <a href={`sms:?&body=${encodeURIComponent(text)}`} className="inline-flex h-9 items-center gap-1.5 border border-hair px-3 text-[12.5px] hover:border-ink md:hidden"><MessageSquareText className="h-3.5 w-3.5" />Text</a>
          <button type="button" onClick={copy} className="inline-flex h-9 items-center gap-1.5 bg-ink px-3 text-[12.5px] text-white hover:bg-[#ff3c00]"><Copy className="h-3.5 w-3.5" />{copied ? "Copied" : "Copy text"}</button>
        </div>
      </div>
      <textarea ref={ref} readOnly value={text} rows={Math.min(10, n + 4)} aria-label="Text to send the client" className="block w-full resize-none bg-transparent p-4 font-sans text-[13.5px] leading-relaxed outline-none" />
    </section>
  );
}

function ClientPanel({ client, rows, onAnswer, onStatus }) {
  const [filter, setFilter] = useState("todo");
  const [openId, setOpenId] = useState(null);
  // Cards settled in this sitting stay in "To answer" (collapsed) so the list doesn't jump under your thumb.
  const [recent, setRecent] = useState(() => new Set());
  const keep = (id) => setRecent((s) => new Set(s).add(id));
  const answer = async (q, ...a) => { await onAnswer(q, ...a); keep(q.id); };
  const status = async (q, st) => { await onStatus(q, st); keep(q.id); };
  const p = lwProgress(rows);
  const sorted = useMemo(() => [...rows].sort(sortQs), [rows]);
  const list = filter === "todo" ? sorted.filter((q) => !q.status || q.status === "open" || recent.has(q.id))
    : filter === "ask" ? sorted.filter((q) => q.status === "ask_client")
    : filter === "done" ? sorted.filter((q) => q.status === "answered" || q.status === "skipped") : sorted;
  useEffect(() => { setOpenId(null); }, [client.slug]);
  const blockingLeft = p.blocking_total - p.blocking_answered;
  const tabs = [["todo", "To answer", p.open], ["all", "All", p.total], ["ask", "Ask client", p.ask_client], ["done", "Done", p.resolved]];

  return (
    <div className="min-w-0 space-y-4">
      <section className="band-dark grain p-4 md:p-6" aria-label={`${client.client_name} status`}>
        <div className="relative z-10">
          <div className="flex items-start gap-3">
            <Logo src={client.logo_url} name={client.client_name} size={48} dark />
            <div className="min-w-0 flex-1">
              <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.03em] text-white md:text-[28px]">{shortName(client.client_name)}</h2>
              <p className="mt-1 font-mono text-[10.5px] uppercase tracking-[0.12em] text-white/50">{p.answered}/{p.total} answered · {blockingLeft > 0 ? `${blockingLeft} blocking left` : "nothing blocking"}{p.ask_client ? ` · ${p.ask_client} for the client` : ""}</p>
            </div>
            <div className="shrink-0 text-right">
              <p className="font-mono text-[30px] font-semibold leading-none tabular-nums text-white md:text-[38px]">{client.launch_readiness_pct ?? "—"}<span className="text-[14px] text-white/50">%</span></p>
              <Mono className="mt-1 text-white/45">ready at audit</Mono>
            </div>
          </div>
          <Meter value={client.launch_readiness_pct || 0} dark className="mt-4" />
          {client.status_summary && <p className="mt-4 max-w-[70ch] text-[14px] leading-relaxed text-white/75">{client.status_summary}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            {client.preview_url && <a href={client.preview_url} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-1.5 bg-[#ff3c00] px-4 text-[13px] font-medium text-white hover:bg-white hover:text-ink"><ExternalLink className="h-3.5 w-3.5" />Open preview</a>}
            {client.job_id ? (
              <Link to="/claude" className="inline-flex h-10 items-center gap-1.5 border border-white/25 px-3 text-[12.5px] text-white/85 hover:border-white"><Sparkles className="h-3.5 w-3.5 text-[#ffaa00]" />Agent job queued · Claude Queue</Link>
            ) : (
              <span className="inline-flex h-10 items-center px-1 text-[12px] text-white/50">{blockingLeft > 0 ? `The agent starts when the ${blockingLeft} blocking ${blockingLeft === 1 ? "question is" : "questions are"} answered.` : "Answer to hand it to the agent."}</span>
            )}
          </div>
        </div>
      </section>

      {(client.blocking?.length > 0 || client.done?.length > 0) && (
        <div className="grid gap-3 md:grid-cols-2">
          {client.blocking?.length > 0 && (
            <details className="group border border-hair bg-paper/80" open>
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3"><span className="text-[13.5px] font-semibold">Blocking launch · {client.blocking.length}</span><ChevronDown className="h-4 w-4 text-ink/40 transition-transform group-open:rotate-180" /></summary>
              <ul className="space-y-1.5 border-t border-hair px-4 py-3">{client.blocking.map((b) => <li key={b} className="flex gap-2 text-[13px] leading-snug text-ink/75"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 bg-[#ff3c00]" />{b}</li>)}</ul>
            </details>
          )}
          {client.done?.length > 0 && (
            <details className="group border border-hair bg-paper/80">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3"><span className="text-[13.5px] font-semibold">Done · {client.done.length}</span><ChevronDown className="h-4 w-4 text-ink/40 transition-transform group-open:rotate-180" /></summary>
              <ul className="space-y-1.5 border-t border-hair px-4 py-3">{client.done.map((b) => <li key={b} className="flex gap-2 text-[13px] leading-snug text-ink/70"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#1f8a5b]" />{b}</li>)}</ul>
            </details>
          )}
        </div>
      )}

      {client.screenshots?.length > 0 && (
        <section aria-label="Screenshots">
          <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
            {client.screenshots.map((u, i) => (
              <a key={u} href={u} target="_blank" rel="noreferrer" className="block shrink-0 snap-start border border-hair bg-white hover:border-ink">
                <img src={u} alt={`${shortName(client.client_name)} screenshot ${i + 1}`} loading="lazy" className="h-[150px] w-auto max-w-[260px] object-cover object-top md:h-[170px]" />
              </a>
            ))}
          </div>
        </section>
      )}

      <AskClientBox client={client} rows={rows} />

      <div className="flex gap-1 overflow-x-auto border-b border-hair" role="tablist" aria-label="Filter questions">
        {tabs.map(([k, label, n]) => (
          <button key={k} type="button" role="tab" aria-selected={filter === k} onClick={() => setFilter(k)}
            className={`-mb-px shrink-0 border-b-2 px-3 py-2.5 text-[13px] ${filter === k ? "border-[#ff3c00] font-medium text-ink" : "border-transparent text-ink/55 hover:text-ink"}`}>
            {label} <span className="font-mono text-[11px] tabular-nums text-ink/45">{n}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {list.length ? list.map((q) => (
          <QuestionCard key={q.id} q={q} open={openId === q.id} onOpen={() => setOpenId(q.id)} onClose={() => setOpenId(null)} onAnswer={answer} onStatus={status} />
        )) : (
          <p className="border border-dashed border-hair px-4 py-6 text-center text-[14px] text-ink/55">
            {filter === "todo" ? (p.total ? "Nothing left to answer here. Pick the next client." : "No questions for this site.") : "Nothing here."}
          </p>
        )}
      </div>
    </div>
  );
}

export default function LaunchWeekPage() {
  const [params, setParams] = useSearchParams();
  const [board, setBoard] = useState(null);
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setErr("");
    try { setBoard(await loadBoard()); } catch (e) { setErr(errMsg(e)); setBoard((b) => b || { clients: [], questions: [] }); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const byClient = useMemo(() => {
    const m = {};
    for (const q of board?.questions || []) (m[q.slug] = m[q.slug] || []).push(q);
    return m;
  }, [board]);
  const clients = useMemo(() => {
    const list = [...(board?.clients || [])].sort((a, b) => (a.order || 0) - (b.order || 0));
    // Questions whose status row has not landed yet still get a column.
    for (const slug of Object.keys(byClient)) if (!list.some((c) => c.slug === slug)) list.push({ slug, client_name: byClient[slug][0]?.client_name || slug, order: 99 });
    return list;
  }, [board, byClient]);
  const all = lwProgress(board?.questions || []);
  const selSlug = params.get("client");
  const sel = clients.find((c) => c.slug === selSlug)
    || clients.find((c) => { const p = lwProgress(byClient[c.slug]); return p.blocking_answered < p.blocking_total; })
    || clients[0];

  const pick = (slug, scroll = true) => { const next = new URLSearchParams(params); next.set("client", slug); setParams(next, { replace: true }); if (scroll) window.scrollTo({ top: 0, behavior: "smooth" }); };
  // Pin the first pick in the URL so finishing a client never swaps the panel out from under you.
  useEffect(() => { if (sel && sel.slug !== selSlug) pick(sel.slug, false); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [sel?.slug, selSlug]);

  const merge = (q) => setBoard((b) => ({ ...b, questions: b.questions.map((x) => (x.id === q.id ? { ...x, ...q } : x)) }));
  const scrollNext = (q) => {
    const rows = [...(byClient[q.slug] || [])].sort(sortQs);
    const next = rows.find((x) => x.id !== q.id && (!x.status || x.status === "open"));
    if (next) setTimeout(() => document.getElementById(`lq-${next.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 120);
  };
  const afterJob = async (job, name) => {
    if (job?.created) setNotice(`All blocking questions for ${shortName(name)} are answered. Queued for the agent: Apply launch answers to ${shortName(name)} site.`);
    if (job) { try { const fresh = await loadBoard(); setBoard((b) => ({ ...b, clients: fresh.clients })); } catch { /* keep */ } }
  };
  const onAnswer = async (q, statements, raw, mode) => {
    const r = await answerQuestion(q.id, { statements, raw_text: raw, mode });
    merge(r.question);
    await afterJob(r.job, q.client_name);
    scrollNext(q);
  };
  const onStatus = async (q, status) => {
    const r = await setQuestionStatus(q.id, status);
    merge(r.question);
    await afterJob(r.job, q.client_name);
    if (status !== "open") scrollNext(q);
  };
  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <div className="mx-auto w-full max-w-[1320px] px-4 pb-36 pt-4 md:px-8 md:pt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <Mono className="text-ink/50">(Launch Week) · Mon Nov 16 – Tue Nov 17 · {clients.length || 7} sites</Mono>
          <h1 className="mt-2 text-[30px] font-semibold leading-[1] tracking-[-0.04em] md:text-[40px]">Launch <span className="text-[#ff3c00]">/Week</span></h1>
          <p className="mt-2 max-w-[62ch] text-[14px] leading-snug text-ink/60">Answer what the agents need to finish each site. Tap the default or an option, or say it. Every answer goes into that client's Brain; when a site's blocking questions are done, the agent gets the job.</p>
        </div>
        <button type="button" onClick={refresh} disabled={refreshing} className="inline-flex h-9 items-center gap-1.5 border border-hair px-3 text-[12.5px] text-ink/70 hover:border-ink disabled:opacity-50"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin motion-reduce:animate-none" : ""}`} />Refresh</button>
      </div>

      <section className="mt-5 border border-hair bg-paper/80 px-4 py-3 md:px-5" aria-label="Overall progress">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-[14px]"><span className="font-mono text-[20px] font-semibold tabular-nums">{all.answered}</span><span className="text-ink/55">/{all.total} answered</span></p>
          <p className="font-mono text-[11px] tabular-nums text-ink/55">{all.blocking_total - all.blocking_answered} blocking left · {all.ask_client} for clients · {clients.filter((c) => c.job_id).length}/{clients.length} handed to the agent</p>
        </div>
        <Meter value={all.total ? (all.answered / all.total) * 100 : 0} className="mt-2" />
      </section>

      {notice && <p className="mt-3 flex items-start gap-2 border-l-2 border-[#1f8a5b] bg-white/70 px-3 py-2 text-[13.5px]" role="status"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#ff6a00]" />{notice}</p>}
      {err && <p className="mt-3 text-[13px] text-[#c22a00]" role="alert">{err}</p>}

      {!board ? (
        <div className="mt-5 grid gap-4 lg:grid-cols-[290px,1fr]" aria-busy="true"><div className="h-[300px] animate-pulse border border-hair bg-paper/60 motion-reduce:animate-none" /><div className="band-dark h-[300px] animate-pulse motion-reduce:animate-none" /></div>
      ) : !clients.length ? (
        <div className="mt-5 border border-dashed border-hair px-5 py-10 text-center">
          <p className="text-[16px] font-medium">The site audits are still running.</p>
          <p className="mx-auto mt-1 max-w-[52ch] text-[13.5px] text-ink/55">Each client's questions appear here as soon as its audit lands. Refresh in a few minutes.</p>
        </div>
      ) : (
        <div className="mt-5 lg:grid lg:grid-cols-[290px,minmax(0,1fr)] lg:items-start lg:gap-6">
          <nav aria-label="Clients" className="lg:sticky lg:top-4">
            <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
              {clients.map((c) => <ClientTab key={c.slug} c={c} p={lwProgress(byClient[c.slug])} active={sel?.slug === c.slug} onPick={() => pick(c.slug)} />)}
            </div>
          </nav>
          <div className="mt-3 lg:mt-0">{sel && <ClientPanel key={sel.slug} client={sel} rows={byClient[sel.slug] || []} onAnswer={onAnswer} onStatus={onStatus} />}</div>
        </div>
      )}
    </div>
  );
}
