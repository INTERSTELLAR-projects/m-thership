import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Check, Compass, Copy, Eye, EyeOff, Loader2, MessageSquareWarning, Sparkles, Trash2, X, Zap } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useClientRecords } from "@/features/clients/hooks";
import { timeAgo } from "@/lib/useData";
import { cn } from "@/lib/utils";
import { useJobs, useRefreshJobs, approveJob, requestChanges, cancelJob, chatPrompt, JOB_STATUS } from "@/features/claude/jobs";
import { gatherPlaybookInputs, inputChips, isPlaybookJob, normalizePlaybook, pillarLabel, pillarProgress, playbookBrief, playbookFromJob, queuePlaybook, quickDraftPlaybook } from "@/features/claude/playbook";
import { playbookDeckBrief } from "@/features/presentations/lib/deckFromDocs";
import DeckFromDocButton from "@/features/presentations/DeckFromDocButton";
import DictationBox from "@/features/voice/DictationBox";

const PRIORITY_TONE = { high: "bg-[#ff3c00] text-white", medium: "bg-[#ff6a00]/15 text-[#c24100]", low: "bg-ink/[0.07] text-ink/60" };
const SEVERITY_TONE = { high: "text-red-700 border-red-200 bg-red-50/60", medium: "text-amber-800 border-amber-200 bg-amber-50/60", low: "text-ink/65 border-hair bg-ink/[0.02]" };
const OWNER_LABEL = { client: "You", interstellar: "Interstellar", both: "Together" };

function Section({ title, children, aside }) {
  return (
    <section className="border-t border-hair pt-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="label-cross">({title})</p>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Bullets({ items, empty = null }) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return empty;
  return (
    <ul className="space-y-1.5">
      {list.map((x, i) => (
        <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-ink/80">
          <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-current opacity-60" />
          <span>{x}</span>
        </li>
      ))}
    </ul>
  );
}

const Est = () => <span className="mono-label ml-1 rounded-sm bg-amber-100 px-1 py-[1px] text-[8px] text-amber-800">est.</span>;
const Val = ({ v }) => (v && !/^unknown$/i.test(v) ? <span>{v}</span> : <span className="text-ink/35">unknown</span>);

function ProgressBar({ progress }) {
  if (!progress) return <p className="mono-label text-[8.5px] text-ink/40">No baseline yet</p>;
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="mono-label text-[8.5px] text-ink/45">Progress to target{progress.estimate ? " · est." : ""}</span>
        <span className="font-mono text-[11px] tabular-nums text-ink/70">{progress.pct}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full bg-ink/[0.07]">
        <div className={cn("h-full bg-gradient-to-r from-[#ff3c00] via-[#ff6a00] to-[#ffaa00]", progress.estimate && "opacity-60")} style={{ width: `${Math.max(2, progress.pct)}%` }} />
      </div>
      <p className="mt-1 text-[10.5px] text-ink/40">{progress.basis}</p>
    </div>
  );
}

function PillarCard({ p }) {
  const progress = pillarProgress(p);
  return (
    <article className="flex flex-col rounded-md border border-hair bg-card">
      <header className="border-b border-hair px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-[15px] font-semibold tracking-[-0.02em]">{p.name || pillarLabel(p.id)}</h4>
          <span className={cn("mono-label rounded-sm px-1.5 py-0.5 text-[8.5px]", PRIORITY_TONE[p.priority])}>{p.priority}</span>
        </div>
        <div className="mt-3"><ProgressBar progress={progress} /></div>
      </header>
      <div className="flex-1 space-y-3 px-4 py-3">
        <div className="grid gap-2 sm:grid-cols-2">
          <div><p className="mono-label text-[8.5px] text-ink/45">now</p><p className="mt-0.5 text-[12.5px] leading-relaxed text-ink/75">{p.current_state || <span className="text-ink/35">unknown</span>}</p></div>
          <div><p className="mono-label text-[8.5px] text-[#ff3c00]">target</p><p className="mt-0.5 text-[12.5px] leading-relaxed text-ink/85">{p.target || <span className="text-ink/35">unknown</span>}</p></div>
        </div>
        {p.interstellar_doing.length > 0 && <div><p className="mono-label mb-1 text-[8.5px] text-ink/45">interstellar is doing</p><Bullets items={p.interstellar_doing} /></div>}
        {p.owner_actions.length > 0 && <div><p className="mono-label mb-1 text-[8.5px] text-green-700">you do</p><Bullets items={p.owner_actions} /></div>}
        {p.kpis.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[11.5px]">
              <thead className="mono-label text-[8px] text-ink/45"><tr><th className="py-1 pr-2">KPI</th><th className="pr-2">Now</th><th>Target</th></tr></thead>
              <tbody>
                {p.kpis.map((k, i) => (
                  <tr key={i} className="border-t border-hair">
                    <td className="py-1 pr-2 text-ink/80" title={k.source}>{k.name}</td>
                    <td className="pr-2 tabular-nums"><Val v={k.current} /></td>
                    <td className="tabular-nums"><Val v={k.target} />{k.is_estimate && <Est />}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {p.next_services.length > 0 && (
          <div className="rounded-sm border border-dashed border-[#ff6a00]/50 p-2.5">
            <p className="mono-label mb-1 text-[8.5px] text-[#c24100]">could add next</p>
            {p.next_services.map((s, i) => <p key={i} className="text-[12px] text-ink/75"><span className="font-medium text-ink">{s.name}</span>{s.why ? ` — ${s.why}` : ""}</p>)}
          </div>
        )}
      </div>
    </article>
  );
}

function Milestones({ pillars }) {
  const cols = [["d30", "Day 30"], ["d60", "Day 60"], ["d90", "Day 90"]].map(([k, label]) => ({
    label,
    items: pillars.flatMap((p) => (p.milestones[k] || []).map((m) => ({ m, pillar: p.name || pillarLabel(p.id) }))),
  }));
  if (!cols.some((c) => c.items.length)) return null;
  return (
    <div className="relative grid gap-4 md:grid-cols-3">
      <div className="absolute left-0 right-0 top-[9px] hidden h-[2px] bg-gradient-to-r from-[#ff3c00] via-[#ff6a00] to-[#ffaa00] md:block" />
      {cols.map((c) => (
        <div key={c.label} className="relative">
          <div className="flex items-center gap-2">
            <span className="relative z-10 h-5 w-5 rounded-full border-2 border-[#ff3c00] bg-card" />
            <span className="text-[13px] font-semibold tracking-[-0.02em]">{c.label}</span>
          </div>
          <ul className="mt-3 space-y-2">
            {c.items.map((x, i) => (
              <li key={i} className="rounded-sm border border-hair bg-card px-2.5 py-2 text-[12px] leading-snug text-ink/80">
                <span className="mono-label block text-[8px] text-ink/40">{x.pillar}</span>
                {x.m}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

// Read-only (portal, review) or interactive (onToggleWin) playbook view.
export function PlaybookView({ playbook, body, done = [], onToggleWin, togglingWin = null }) {
  const p = normalizePlaybook(playbook);
  if (!p) {
    return body ? <div className="prose prose-sm max-w-none text-ink/80"><ReactMarkdown>{body}</ReactMarkdown></div> : <p className="text-[13px] text-ink/50">Nothing came back yet.</p>;
  }
  const g = p.goal_summary || {};
  const ind = p.industry_snapshot || {};
  const doneSet = new Set(done || []);
  return (
    <div className="space-y-6">
      <div className="overflow-hidden rounded-md border border-hair">
        <div className="h-1 bg-gradient-to-r from-[#ff3c00] via-[#ff6a00] to-[#ffaa00]" />
        <div className="grid gap-4 p-4 md:grid-cols-[1fr_auto_1fr] md:items-center">
          <div><p className="mono-label text-[8.5px] text-ink/45">where you are</p><p className="mt-1 text-[13px] leading-relaxed text-ink/80">{g.where_they_are || <span className="text-ink/35">unknown</span>}</p></div>
          <span className="hidden text-[22px] text-[#ff3c00] md:block">→</span>
          <div><p className="mono-label text-[8.5px] text-[#ff3c00]">where you&apos;re going{g.by_when ? ` · by ${g.by_when}` : ""}</p><p className="mt-1 text-[14px] font-medium leading-relaxed text-ink">{g.where_they_want_to_be || <span className="text-ink/35">unknown</span>}</p></div>
        </div>
        {(g.north_star || (g.goals || []).length > 0) && (
          <div className="border-t border-hair px-4 py-3">
            {g.north_star && <p className="text-[12.5px] text-ink/70"><span className="mono-label mr-2 text-[8.5px] text-ink/45">north star</span>{g.north_star}</p>}
            {(g.goals || []).length > 0 && (
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="mono-label text-[8px] text-ink/45"><tr><th className="py-1 pr-3">Goal</th><th className="pr-3">Now</th><th className="pr-3">Target</th><th className="pr-3">By</th><th>Source</th></tr></thead>
                  <tbody>
                    {g.goals.map((x, i) => (
                      <tr key={i} className="border-t border-hair">
                        <td className="py-1.5 pr-3 font-medium">{x.title || x.metric}</td>
                        <td className="pr-3 tabular-nums"><Val v={x.current || x.baseline} /></td>
                        <td className="pr-3 tabular-nums"><Val v={x.target} />{x.unit ? ` ${x.unit}` : ""}{x.is_estimate && <Est />}</td>
                        <td className="pr-3">{x.by_when || "—"}</td>
                        <td className="text-ink/50">{x.source || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
        {(g.unknowns || []).length > 0 && (
          <div className="border-t border-amber-200 bg-amber-50/60 px-4 py-2.5">
            <p className="mono-label mb-1 text-[8.5px] text-amber-800">still unknown — we need these to measure progress</p>
            <div className="flex flex-wrap gap-1.5">{g.unknowns.map((u, i) => <span key={i} className="rounded-sm border border-amber-200 bg-white px-1.5 py-0.5 text-[11.5px] text-amber-900">{u}</span>)}</div>
          </div>
        )}
      </div>

      {(ind.summary || (ind.whats_working || []).length > 0) && (
        <Section title={`Industry snapshot 2027${ind.trade ? ` · ${ind.trade}` : ""}`}>
          {ind.summary && <p className="mb-3 max-w-3xl text-[13px] leading-relaxed text-ink/75">{ind.summary}</p>}
          <div className="grid gap-4 md:grid-cols-3">
            {ind.whats_working.length > 0 && <div><p className="mono-label mb-1 text-[8.5px] text-green-700">what&apos;s working</p><Bullets items={ind.whats_working} /></div>}
            {ind.customer_behavior.length > 0 && <div><p className="mono-label mb-1 text-[8.5px] text-ink/45">how customers buy</p><Bullets items={ind.customer_behavior} /></div>}
            {ind.shifts_2027.length > 0 && <div><p className="mono-label mb-1 text-[8.5px] text-[#ff3c00]">shifts to plan for</p><Bullets items={ind.shifts_2027} /></div>}
          </div>
          {ind.sources.length > 0 && (
            <p className="mt-2 text-[10.5px] text-ink/40">Sources: {ind.sources.map((s, i) => (/^https?:\/\//.test(s) ? <a key={i} href={s} target="_blank" rel="noreferrer" className="mr-2 underline hover:text-[#ff3c00]">{s.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40)}</a> : <span key={i} className="mr-2">{s}</span>))}</p>
          )}
        </Section>
      )}

      {(p.pillars || []).length > 0 && (
        <Section title="Pillars">
          <div className="grid gap-4 lg:grid-cols-2">{p.pillars.map((x, i) => <PillarCard key={`${x.id}-${i}`} p={x} />)}</div>
        </Section>
      )}

      {(p.pillars || []).length > 0 && (
        <Section title="Milestones · 30 / 60 / 90 days"><Milestones pillars={p.pillars} /></Section>
      )}

      {(p.quick_wins || []).length > 0 && (
        <Section title="Quick wins this month" aside={<span className="font-mono text-[10.5px] text-ink/45">{p.quick_wins.filter((_, i) => doneSet.has(i)).length}/{p.quick_wins.length} done</span>}>
          <ul className="grid gap-2 md:grid-cols-2">
            {p.quick_wins.map((q, i) => {
              const isDone = doneSet.has(i);
              return (
                <li key={i}>
                  <button
                    type="button"
                    disabled={!onToggleWin || togglingWin === i}
                    onClick={() => onToggleWin && onToggleWin(i)}
                    className={cn("flex w-full items-start gap-2.5 rounded-sm border px-3 py-2.5 text-left", isDone ? "border-green-200 bg-green-50/60" : "border-hair bg-card", onToggleWin ? "hover:border-[#ff3c00]/60" : "cursor-default")}
                  >
                    <span className={cn("mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-sm border", isDone ? "border-green-600 bg-green-600 text-white" : "border-ink/30")}>
                      {togglingWin === i ? <Loader2 className="h-3 w-3 animate-spin text-ink/50" /> : isDone ? <Check className="h-3 w-3" /> : null}
                    </span>
                    <span className="min-w-0">
                      <span className={cn("block text-[12.5px] font-medium", isDone && "text-ink/50 line-through")}>{q.title}</span>
                      <span className="mono-label text-[8px] text-ink/40">{OWNER_LABEL[q.owner] || q.owner}{q.pillar ? ` · ${pillarLabel(q.pillar)}` : ""}</span>
                      {q.why && <span className="mt-0.5 block text-[11.5px] text-ink/55">{q.why}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Section>
      )}

      {((p.ignore || []).length > 0 || (p.risks || []).length > 0) && (
        <div className="grid gap-6 lg:grid-cols-2">
          {(p.ignore || []).length > 0 && (
            <Section title="Ignore for now">
              <ul className="space-y-2">{p.ignore.map((x, i) => <li key={i} className="text-[12.5px] text-ink/75"><span className="font-medium text-ink line-through decoration-ink/30">{x.item}</span>{x.why ? <span className="block text-[11.5px] text-ink/55">{x.why}</span> : null}</li>)}</ul>
            </Section>
          )}
          {(p.risks || []).length > 0 && (
            <Section title="Risks">
              <ul className="space-y-2">{p.risks.map((x, i) => (
                <li key={i} className={cn("rounded-sm border px-3 py-2", SEVERITY_TONE[x.severity])}>
                  <p className="text-[12.5px] font-medium">{x.risk}</p>
                  {x.mitigation && <p className="mt-0.5 text-[11.5px] opacity-80">{x.mitigation}</p>}
                </li>
              ))}</ul>
            </Section>
          )}
        </div>
      )}

      {(p.next_steps || []).length > 0 && (
        <Section title="Next steps">
          <ol className="space-y-1.5">{p.next_steps.map((s, i) => <li key={i} className="flex gap-2.5 text-[12.5px] text-ink/80"><span className="font-mono text-[11px] text-[#ff3c00]">{String(i + 1).padStart(2, "0")}</span>{s}</li>)}</ol>
        </Section>
      )}
    </div>
  );
}

function Composer({ client, revising, onClose, onDone }) {
  const [extra, setExtra] = useState("");
  const [web, setWeb] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const inputs = useQuery({ queryKey: ["PlaybookInputs", client.id], queryFn: () => gatherPlaybookInputs(client) });
  const brief = inputs.data ? playbookBrief(client, inputs.data, extra.trim()) : "";

  const run = async (key, fn) => {
    setBusy(key);
    setError("");
    try {
      await fn();
      setExtra("");
      onDone();
      onClose();
    } catch (e) {
      setError(e?.message || "That didn't go through");
    } finally {
      setBusy("");
    }
  };

  const copy = async () => {
    await navigator.clipboard.writeText(chatPrompt({ id: "(not queued yet)", instructions: brief }));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="rounded-md border border-[#ff3c00]/50 bg-card">
      <header className="flex items-start justify-between gap-3 border-b border-hair px-4 py-3">
        <div>
          <h3 className="text-[15px] font-semibold tracking-[-0.02em]">Send to Claude → {revising ? "Revise" : "Generate"} playbook</h3>
          <p className="mt-1 max-w-2xl text-[12.5px] text-ink/60">Built from {client.business}&apos;s goals, intake and onboarding answers, Constellations dossier, site health, Google rating, projects and brand kit. Nothing is saved or shown to the client until you approve it.</p>
        </div>
        <button type="button" onClick={onClose} disabled={!!busy} className="text-ink/40 hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
      </header>
      <div className="space-y-3 p-4">
        {inputs.isLoading ? (
          <p className="flex items-center gap-2 text-[12.5px] text-ink/55"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Gathering goals, answers, site health and projects…</p>
        ) : (
          <div className="flex flex-wrap gap-1.5 text-[11px]">
            {inputChips(inputs.data).map(([k, v]) => <span key={k} className="rounded-sm border border-hair px-1.5 py-0.5 text-ink/65"><span className="text-ink/40">{k}:</span> {v}</span>)}
          </div>
        )}
        <DictationBox
          label={revising ? "What should change from the current playbook?" : "Direction for Claude (optional) — type or dictate"}
          value={extra}
          onChange={setExtra}
          rows={3}
          placeholder="e.g. Owner wants to hire a second crew by summer. Skip paid ads until reviews pass 50."
        />
        {brief && (
          <details>
            <summary className="mono-label cursor-pointer text-[9.5px] text-ink/50 hover:text-[#ff3c00]">Show full brief</summary>
            <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-sm bg-ink/[0.04] p-3 text-[11px] text-ink/70">{brief}</pre>
          </details>
        )}
        {error && <p className="text-[12px] text-red-600">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-4">
            <button type="button" onClick={copy} disabled={!brief} className="inline-flex items-center gap-1.5 text-[12px] text-ink/60 hover:text-ink disabled:opacity-40">
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy prompt for a live chat"}
            </button>
            <label className="inline-flex items-center gap-1.5 text-[12px] text-ink/60" title="Quick draft only: let the in-app model read the web for the industry snapshot (slower)">
              <input type="checkbox" checked={web} onChange={(e) => setWeb(e.target.checked)} className="accent-[#ff3c00]" /> Web research in quick draft
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!!busy || inputs.isLoading} onClick={() => run("quick", () => quickDraftPlaybook(client, extra.trim(), { web }))} className="inline-flex items-center gap-1.5 rounded-sm border border-hair px-3.5 py-2 text-[12.5px] text-ink/80 hover:border-ink/40 disabled:opacity-50">
              {busy === "quick" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}{busy === "quick" ? "Drafting…" : "Quick draft (in-app)"}
            </button>
            <button type="button" disabled={!!busy || inputs.isLoading} onClick={() => run("claude", () => queuePlaybook(client, extra.trim()))} className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60">
              {busy === "claude" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Authorize Claude
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReviewCard({ job, onDone }) {
  const [notes, setNotes] = useState("");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const playbook = playbookFromJob(job);
  const quick = !!job.context?.quick_draft;

  const act = async (key, fn) => {
    setBusy(key);
    setError("");
    try {
      await fn();
      onDone();
    } catch (e) {
      setError(e?.message || "That didn't go through");
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="rounded-md border-2 border-[#ff3c00]/60 bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-hair px-4 py-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("mono-label rounded-sm px-1.5 py-0.5 text-[8.5px]", JOB_STATUS.needs_approval.tone)}>Needs your OK</span>
            <span className="mono-label rounded-sm bg-ink/[0.06] px-1.5 py-0.5 text-[8.5px] text-ink/60">{quick ? "Quick draft · in-app" : "Claude Queue"}</span>
          </div>
          <h3 className="mt-2 text-[15px] font-semibold tracking-[-0.02em]">{playbook?.headline || job.title}</h3>
          {job.result_summary && <p className="mt-1 max-w-2xl text-[12.5px] text-ink/60">{job.result_summary}</p>}
        </div>
        <Link to={`/claude?job=${job.id}`} className="mono-label text-[9px] text-ink/45 hover:text-[#ff3c00]">open in queue</Link>
      </header>
      <div className="max-h-[75vh] overflow-y-auto p-4">
        <PlaybookView playbook={playbook} body={job.result_body} />
        {job.needs_from_justin && (
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="mono-label mb-1 text-[8.5px] text-amber-800">needs from you</p>
            <p className="whitespace-pre-wrap text-[12.5px] text-amber-900">{job.needs_from_justin}</p>
          </div>
        )}
      </div>
      <footer className="space-y-2 border-t border-hair px-4 py-3">
        {asking && (
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} autoFocus placeholder="What should Claude change? (goals, pillars, targets, tone…)" className="w-full rounded-sm border border-hair bg-card px-3 py-2 text-[13px] outline-none focus:border-[#ff3c00]" />
        )}
        {error && <p className="text-[12px] text-red-600">{error}</p>}
        <div className="flex flex-wrap items-center justify-end gap-2">
          {asking ? (
            <>
              <button type="button" onClick={() => setAsking(false)} className="px-2 text-[12px] text-ink/55 hover:text-ink">Cancel</button>
              <button type="button" disabled={!notes.trim() || !!busy} onClick={() => act("changes", () => requestChanges(job, notes.trim()))} className="inline-flex items-center gap-1.5 rounded-sm border border-amber-400 bg-amber-50 px-3.5 py-2 text-[12.5px] font-medium text-amber-900 disabled:opacity-50">
                {busy === "changes" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquareWarning className="h-3.5 w-3.5" />} Send back to Claude
              </button>
            </>
          ) : (
            <>
              {quick && (
                <button type="button" disabled={!!busy} onClick={() => act("discard", () => cancelJob(job))} className="mr-auto inline-flex items-center gap-1.5 px-2 text-[12px] text-ink/50 hover:text-red-600">
                  {busy === "discard" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Discard draft
                </button>
              )}
              <button type="button" onClick={() => setAsking(true)} className="inline-flex items-center gap-1.5 rounded-sm border border-hair px-3.5 py-2 text-[12.5px] text-ink/75 hover:border-ink/40">
                <MessageSquareWarning className="h-3.5 w-3.5" /> Request changes
              </button>
              <button type="button" disabled={!!busy || !playbook} onClick={() => act("approve", () => approveJob(job))} className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-4 py-2 text-[12.5px] font-medium text-white disabled:opacity-60" title={playbook ? "" : "No structured playbook in result_data yet"}>
                {busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve &amp; save to profile
              </button>
            </>
          )}
        </div>
      </footer>
    </section>
  );
}

export default function PlaybookTab({ client }) {
  const me = useQuery({ queryKey: ["auth", "me"], queryFn: () => base44.auth.me(), staleTime: 300_000 });
  const { data: jobs = [] } = useJobs(400);
  const refreshJobs = useRefreshJobs();
  const books = useClientRecords("IndustryPlaybook", client.id, { sort: "-version" });
  const [composing, setComposing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [winBusy, setWinBusy] = useState(null);

  if (me.isLoading) return <p className="text-[13px] text-ink/50">Loading…</p>;
  if (me.data?.role !== "admin") return <p className="text-[13px] text-ink/50">Playbooks are managed by your Interstellar team.</p>;

  const pbJobs = jobs.filter((j) => j.client_id === client.id && isPlaybookJob(j));
  const review = pbJobs.filter((j) => j.status === "needs_approval");
  const working = pbJobs.filter((j) => ["queued", "running", "changes_requested", "failed"].includes(j.status));
  const current = books.rows.find((k) => k.status === "approved");
  const history = books.rows.filter((k) => k !== current);
  const refresh = () => { refreshJobs(); books.refresh(); };
  const inFlight = working.some((j) => j.status !== "failed");

  const togglePortal = async () => {
    if (!current) return;
    setToggling(true);
    try { await books.update(current.id, { portal_visible: !current.portal_visible }); } finally { setToggling(false); }
  };
  const toggleWin = async (i) => {
    if (!current) return;
    setWinBusy(i);
    const done = new Set(current.quick_wins_done || []);
    if (done.has(i)) done.delete(i); else done.add(i);
    try { await books.update(current.id, { quick_wins_done: [...done].sort((a, b) => a - b) }); } finally { setWinBusy(null); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-cross mb-2">(Industry playbook)</p>
          <p className="max-w-2xl text-[13px] text-ink/60">
            {client.business}&apos;s 2027 playbook, tied to their goals: where they are, where they want to be, and pillar by pillar how they get there. Claude drafts it from their profile, answers, site health and projects; you approve it before it&apos;s saved or shown to the client.
          </p>
        </div>
        {!composing && (
          <button type="button" onClick={() => setComposing(true)} disabled={inFlight} title={inFlight ? "A playbook job is already in the queue" : ""} className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-4 py-2.5 text-[13px] font-medium text-white disabled:opacity-50">
            <Sparkles className="h-3.5 w-3.5" /> Send to Claude → {current ? "Revise playbook" : "Generate playbook"}
          </button>
        )}
      </div>

      {composing && <Composer client={client} revising={!!current} onClose={() => setComposing(false)} onDone={refresh} />}

      {working.length > 0 && (
        <div className="rounded-md border border-hair bg-card">
          {working.map((j) => {
            const s = JOB_STATUS[j.status] || JOB_STATUS.queued;
            return (
              <Link key={j.id} to={`/claude?job=${j.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-ink/[0.03]">
                <span className={cn("mono-label shrink-0 rounded-sm px-1.5 py-0.5 text-[8.5px]", s.tone)}>{s.label}</span>
                <span className="min-w-0 flex-1 truncate text-[13px]">{j.title}</span>
                <span className="font-mono text-[10.5px] text-ink/40">{timeAgo(j.requested_at || j.created_date)}</span>
              </Link>
            );
          })}
        </div>
      )}

      {review.map((j) => <ReviewCard key={j.id} job={j} onDone={refresh} />)}

      {current ? (
        <section className="rounded-md border border-hair bg-card">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hair px-4 py-3">
            <div className="flex items-center gap-2.5">
              <Compass className="h-4 w-4 text-[#ff3c00]" strokeWidth={1.75} />
              <div>
                <h3 className="text-[15px] font-semibold tracking-[-0.02em]">Approved playbook · v{current.version || 1}</h3>
                <p className="text-[11.5px] text-ink/50">Approved {timeAgo(current.approved_at || current.created_date)}{current.approved_by ? ` by ${current.approved_by}` : ""}{current.generated_by === "quick_draft" ? " · quick draft" : ""}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <DeckFromDocButton
                client={client}
                source="industry_playbook"
                lastDeckId={current.presentation_id}
                makeBrief={() => playbookDeckBrief(client, current)}
                onCreated={(id) => books.update(current.id, { presentation_id: id })}
              />
              <button type="button" onClick={togglePortal} disabled={toggling} className={cn("inline-flex items-center gap-1.5 rounded-sm border px-3 py-1.5 text-[12px]", current.portal_visible ? "border-green-300 bg-green-50 text-green-800" : "border-hair text-ink/60")} title="Whether the client can see this playbook in their portal">
                {current.portal_visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}{current.portal_visible ? "Visible in portal" : "Hidden from portal"}
              </button>
            </div>
          </header>
          <div className="p-4">
            {current.playbook?.headline && <p className="mb-1 text-[20px] font-semibold tracking-[-0.03em]">{current.playbook.headline}</p>}
            {current.summary && <p className="mb-5 max-w-3xl text-[13px] text-ink/70">{current.summary}</p>}
            <PlaybookView playbook={current.playbook && Object.keys(current.playbook).length ? current.playbook : null} body={current.body_md} done={current.quick_wins_done || []} onToggleWin={toggleWin} togglingWin={winBusy} />
          </div>
        </section>
      ) : review.length === 0 && working.length === 0 && !composing ? (
        <div className="rounded-md border border-dashed border-hair px-6 py-12 text-center">
          <Compass className="mx-auto h-6 w-6 text-ink/30" strokeWidth={1.5} />
          <p className="mt-3 text-[13px] text-ink/55">No playbook yet. Send it to Claude (or run a quick draft) to build one from {client.business}&apos;s goals and current state.</p>
        </div>
      ) : null}

      {history.length > 0 && (
        <details className="rounded-md border border-hair bg-card px-4 py-3">
          <summary className="mono-label cursor-pointer text-[9.5px] text-ink/50">Earlier versions ({history.length})</summary>
          <ul className="mt-2 space-y-1">
            {history.map((k) => <li key={k.id} className="text-[12.5px] text-ink/65">v{k.version || 1} · {k.status} · {timeAgo(k.approved_at || k.created_date)}{k.summary ? ` — ${k.summary}` : ""}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
