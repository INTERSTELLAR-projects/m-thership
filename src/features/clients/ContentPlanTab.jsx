import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import {
  ArrowDown, ArrowUp, CalendarDays, Check, CircleAlert, Copy, ExternalLink, FileStack, Loader2, MessageSquareWarning, Pencil, Plus, Sparkles, Trash2, X, Zap,
} from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useClientRecords } from "@/features/clients/hooks";
import { timeAgo } from "@/lib/useData";
import { cn } from "@/lib/utils";
import { useJobs, useRefreshJobs, approveJob, requestChanges, cancelJob, chatPrompt, JOB_STATUS } from "@/features/claude/jobs";
import {
  GBP_COMPLIANCE, PROJECT_PIPELINE_STEPS, QUEUE_STATUSES, contentPlanBrief, contentPlanCriteria, contentPlanFromJob, fmtDay, gatherContentPlanInputs,
  gbpCalendar, inputChips, isContentPlanJob, nextBlogSlots, normalizeContentPlan, normalizeQueueRow, queueContentPlan, quickDraftContentPlan, slugify,
} from "@/features/claude/contentPlan";

const inputCls = "w-full rounded-sm border border-hair bg-card px-2 py-1 text-[12px] outline-none focus:border-[#ff3c00]";
const STATUS_TONE = { planned: "bg-ink/[0.07] text-ink/60", written: "bg-[#ff6a00]/15 text-[#c24100]", published: "bg-green-100 text-green-800" };
const PRIORITY_TONE = { primary: "bg-[#ff3c00] text-white", secondary: "bg-[#ff6a00]/15 text-[#c24100]", long_tail: "bg-ink/[0.07] text-ink/60" };
const AUTO_TONE = { active: "border-green-300 bg-green-50 text-green-800", paused: "border-amber-300 bg-amber-50 text-amber-800", not_set_up: "border-hair text-ink/55" };
const AUTO_LABEL = { active: "Running", paused: "Paused", not_set_up: "Not set up" };

function Section({ title, children, aside, className }) {
  return (
    <section className={cn("border-t border-hair pt-4", className)}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="label-cross">({title})</p>
        {aside}
      </div>
      {children}
    </section>
  );
}

function Bullets({ items }) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return <p className="text-[12px] text-ink/40">Not set yet.</p>;
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

const Pill = ({ children, className }) => <span className={cn("mono-label inline-block rounded-sm px-1.5 py-0.5 text-[8.5px]", className)}>{children}</span>;

/* ---------------- readiness ---------------- */

function Readiness({ client, criteria, onEdit }) {
  const missing = criteria.filter((c) => !c.ok);
  return (
    <div className={cn("rounded-md border p-3", missing.length ? "border-amber-200 bg-amber-50/60" : "border-green-200 bg-green-50/50")}>
      <p className={cn("mono-label mb-2 text-[8.5px]", missing.length ? "text-amber-800" : "text-green-800")}>
        {missing.length ? `${missing.length} thing${missing.length > 1 ? "s" : ""} to fill before a plan can be generated` : "Ready: everything the plan needs is on file"}
      </p>
      <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
        {criteria.map((c) => (
          <li key={c.key} className="flex items-start gap-2 text-[12px]">
            {c.ok ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-700" /> : <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700" />}
            <span className="min-w-0">
              <span className="font-medium text-ink">{c.label}</span>
              <span className="block truncate text-[11px] text-ink/55">{c.detail}</span>
              {!c.ok && (c.fix === "edit" ? (
                <button type="button" onClick={onEdit} className="text-[11px] text-[#ff3c00] underline">Edit client profile</button>
              ) : (
                <Link to={`/clients/${client.id}?tab=${c.fix}`} className="text-[11px] text-[#ff3c00] underline">{c.fix === "goals" ? "Open Goals & Gaps" : "Open Constellations dossier"}</Link>
              ))}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------------- composer + review ---------------- */

function Composer({ client, inputs, revising, onClose, onDone }) {
  const [extra, setExtra] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const brief = inputs ? contentPlanBrief(client, inputs, extra.trim()) : "";
  const run = async (key, fn) => {
    setBusy(key);
    setError("");
    try { await fn(); onDone(); onClose(); } catch (e) { setError(e?.message || "That didn't go through"); } finally { setBusy(""); }
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
          <h3 className="text-[15px] font-semibold tracking-[-0.02em]">{revising ? "Revise" : "Generate"} content plan</h3>
          <p className="mt-1 max-w-2xl text-[12.5px] text-ink/60">Built from the CRM profile, the dossier&apos;s keywords, services and cities, the approved playbook, brand voice and existing posts. Nothing is saved until you approve it.</p>
        </div>
        <button type="button" onClick={onClose} disabled={!!busy} className="text-ink/40 hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
      </header>
      <div className="space-y-3 p-4">
        <div className="flex flex-wrap gap-1.5 text-[11px]">
          {inputChips(inputs).map(([k, v]) => <span key={k} className="rounded-sm border border-hair px-1.5 py-0.5 text-ink/65"><span className="text-ink/40">{k}:</span> {v}</span>)}
        </div>
        <label className="block">
          <span className="mono-label text-[9.5px] text-ink/50">{revising ? "What should change?" : "Direction for Claude (optional)"}</span>
          <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={3} placeholder="e.g. Push the industrial cluster harder this quarter. GBP once a week only." className="mt-1.5 w-full rounded-sm border border-hair bg-card px-3 py-2 text-[13px] outline-none focus:border-[#ff3c00]" />
        </label>
        {brief && (
          <details>
            <summary className="mono-label cursor-pointer text-[9.5px] text-ink/50 hover:text-[#ff3c00]">Show full brief</summary>
            <pre className="mt-2 max-h-64 overflow-y-auto whitespace-pre-wrap rounded-sm bg-ink/[0.04] p-3 text-[11px] text-ink/70">{brief}</pre>
          </details>
        )}
        {error && <p className="text-[12px] text-red-600">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button type="button" onClick={copy} disabled={!brief} className="inline-flex items-center gap-1.5 text-[12px] text-ink/60 hover:text-ink disabled:opacity-40">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy prompt for a live chat"}
          </button>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!!busy} onClick={() => run("quick", () => quickDraftContentPlan(client, extra.trim()))} className="inline-flex items-center gap-1.5 rounded-sm border border-hair px-3.5 py-2 text-[12.5px] text-ink/80 hover:border-ink/40 disabled:opacity-50">
              {busy === "quick" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}{busy === "quick" ? "Drafting…" : "Quick draft (in-app)"}
            </button>
            <button type="button" disabled={!!busy} onClick={() => run("claude", () => queueContentPlan(client, extra.trim()))} className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-4 py-2 text-[13px] font-medium text-white disabled:opacity-60">
              {busy === "claude" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Send to Claude
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReviewCard({ job, client, onDone }) {
  const [notes, setNotes] = useState("");
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const plan = contentPlanFromJob(job);
  const quick = !!job.context?.quick_draft;
  const act = async (key, fn) => {
    setBusy(key);
    setError("");
    try { await fn(); onDone(); } catch (e) { setError(e?.message || "That didn't go through"); } finally { setBusy(""); }
  };
  return (
    <section className="rounded-md border-2 border-[#ff3c00]/60 bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-hair px-4 py-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill className={JOB_STATUS.needs_approval.tone}>Needs your OK</Pill>
            <Pill className="bg-ink/[0.06] text-ink/60">{quick ? "Quick draft · in-app" : "Claude Queue"}</Pill>
          </div>
          <h3 className="mt-2 text-[15px] font-semibold tracking-[-0.02em]">{job.title}</h3>
          {job.result_summary && <p className="mt-1 max-w-2xl text-[12.5px] text-ink/60">{job.result_summary}</p>}
        </div>
        <Link to={`/claude?job=${job.id}`} className="mono-label text-[9px] text-ink/45 hover:text-[#ff3c00]">open in queue</Link>
      </header>
      <div className="max-h-[75vh] overflow-y-auto p-4">
        {plan ? <PlanView plan={plan} client={client} /> : job.result_body ? <div className="prose prose-sm max-w-none"><ReactMarkdown>{job.result_body}</ReactMarkdown></div> : <p className="text-[13px] text-ink/50">Nothing came back yet.</p>}
        {job.needs_from_justin && (
          <div className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-3">
            <p className="mono-label mb-1 text-[8.5px] text-amber-800">needs from you</p>
            <p className="whitespace-pre-wrap text-[12.5px] text-amber-900">{job.needs_from_justin}</p>
          </div>
        )}
      </div>
      <footer className="space-y-2 border-t border-hair px-4 py-3">
        {asking && <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} autoFocus placeholder="What should Claude change?" className="w-full rounded-sm border border-hair bg-card px-3 py-2 text-[13px] outline-none focus:border-[#ff3c00]" />}
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
              <button type="button" onClick={() => setAsking(true)} className="inline-flex items-center gap-1.5 rounded-sm border border-hair px-3.5 py-2 text-[12.5px] text-ink/75 hover:border-ink/40"><MessageSquareWarning className="h-3.5 w-3.5" /> Request changes</button>
              <button type="button" disabled={!!busy || !plan} onClick={() => act("approve", () => approveJob(job))} className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-4 py-2 text-[12.5px] font-medium text-white disabled:opacity-60">
                {busy === "approve" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Approve &amp; save as new version
              </button>
            </>
          )}
        </div>
      </footer>
    </section>
  );
}

/* ---------------- plan pieces ---------------- */

function RotationStrip({ rotation, nextCategory, lastCategory }) {
  if (!(rotation || []).length) return <p className="text-[12px] text-ink/40">No rotation set.</p>;
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {rotation.map((c, i) => (
        <span key={`${c}-${i}`} className="flex items-center gap-1.5">
          <span className={cn("rounded-sm border px-2 py-1 text-[12px]", c === nextCategory ? "border-[#ff3c00] bg-[#ff3c00] text-white" : c === lastCategory ? "border-[#ff6a00]/40 bg-[#ff6a00]/10 text-[#c24100]" : "border-hair bg-card text-ink/75")}>
            <span className="mr-1 font-mono text-[10px] opacity-60">{i + 1}</span>{c}
          </span>
          {i < rotation.length - 1 && <span className="text-[11px] text-ink/30">→</span>}
        </span>
      ))}
      <span className="ml-1 text-[11px] text-ink/35">↺</span>
    </div>
  );
}

function GeoRings({ rings }) {
  if (!(rings || []).length) return <p className="text-[12px] text-ink/40">No geo plan set.</p>;
  return (
    <ol className="space-y-2">
      {rings.map((r, i) => (
        <li key={`${r.ring}-${i}`} className="flex items-start gap-3">
          <span className="relative mt-0.5 grid shrink-0 place-items-center" style={{ width: 40, height: 22 }}>
            {Array.from({ length: i + 1 }).map((_, k) => (
              <span key={k} className="absolute rounded-full border border-[#ff3c00]" style={{ width: 8 + k * 9, height: 8 + k * 9 > 22 ? 22 : 8 + k * 9, opacity: 1 - k * 0.2 }} />
            ))}
          </span>
          <div className="min-w-0">
            <p className="text-[12.5px]"><span className="font-mono text-[11px] font-semibold text-[#ff3c00]">{r.ring}</span>{r.label ? <span className="ml-2 text-ink/55">{r.label}</span> : null}</p>
            <p className="text-[12.5px] text-ink/80">{r.cities.join(" · ")}</p>
            {r.notes && <p className="text-[11px] text-ink/45">{r.notes}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}

function KeywordMap({ targets }) {
  const [all, setAll] = useState(false);
  if (!(targets || []).length) return <p className="text-[12px] text-ink/40">No keyword map yet.</p>;
  const rank = { primary: 0, secondary: 1, long_tail: 2 };
  const rows = [...targets].sort((a, b) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3));
  const shown = all ? rows : rows.slice(0, 12);
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] text-left text-[12px]">
        <thead className="mono-label text-[8px] text-ink/45"><tr><th className="py-1 pr-3">Keyword</th><th className="pr-3">Priority</th><th className="pr-3">Intent</th><th>Target page</th></tr></thead>
        <tbody>
          {shown.map((k, i) => (
            <tr key={i} className="border-t border-hair">
              <td className="py-1.5 pr-3 font-medium">{k.keyword}{k.city ? <span className="ml-1 text-[10.5px] font-normal text-ink/40">· {k.city}</span> : null}</td>
              <td className="pr-3"><Pill className={PRIORITY_TONE[k.priority] || "bg-ink/[0.05] text-ink/50"}>{(k.priority || "—").replace("_", " ")}</Pill></td>
              <td className="pr-3 text-ink/60">{k.intent || "—"}</td>
              <td className="max-w-[320px] truncate">{k.target_page ? <a href={k.target_page} target="_blank" rel="noreferrer" className="text-ink/65 hover:text-[#ff3c00]">{k.target_page.replace(/^https?:\/\/(www\.)?[^/]+/, "") || "/"}</a> : <span className="text-ink/35">no page yet</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 12 && <button type="button" onClick={() => setAll(!all)} className="mt-2 text-[11.5px] text-[#ff3c00]">{all ? "Show fewer" : `Show all ${rows.length}`}</button>}
    </div>
  );
}

function GbpCalendar({ plan }) {
  const items = gbpCalendar(plan, 4);
  if (!items.length) return <p className="text-[12px] text-ink/40">No GBP days set.</p>;
  const weeks = [];
  items.forEach((it) => {
    const d = new Date(it.date);
    d.setDate(d.getDate() - d.getDay());
    const key = d.toDateString();
    let w = weeks.find((x) => x.key === key);
    if (!w) { w = { key, start: d, items: [] }; weeks.push(w); }
    w.items.push(it);
  });
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      {weeks.slice(0, 4).map((w) => (
        <div key={w.key} className="rounded-md border border-hair bg-card">
          <p className="mono-label border-b border-hair px-3 py-1.5 text-[8.5px] text-ink/45">week of {w.start.toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
          <ul className="divide-y divide-hair">
            {w.items.map((it, i) => (
              <li key={i} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[12px] font-medium">{fmtDay(it.date)}</span>
                  <Pill className="bg-[#ff6a00]/15 text-[#c24100]">{it.type}</Pill>
                </div>
                <p className="mt-0.5 text-[11.5px] leading-snug text-ink/60">{it.blog ? `From blog: ${it.blog.title}` : it.theme || "Theme from the plan"}</p>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function QueueRow({ row, index, total, editable, onChange, onMove, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(row);
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  if (editing) {
    return (
      <tr className="border-t border-hair bg-[#ff6a00]/[0.04] align-top">
        <td className="py-2 pr-2 font-mono text-[11px] text-ink/45">{index + 1}</td>
        <td className="py-2 pr-2" colSpan={5}>
          <div className="grid gap-1.5 md:grid-cols-2">
            <input className={inputCls} value={draft.title} onChange={(e) => set("title", e.target.value)} placeholder="Title" />
            <input className={inputCls} value={draft.slug} onChange={(e) => set("slug", e.target.value)} placeholder="slug" />
            <input className={inputCls} value={draft.category} onChange={(e) => set("category", e.target.value)} placeholder="Category" />
            <input className={inputCls} value={draft.primary_keyword} onChange={(e) => set("primary_keyword", e.target.value)} placeholder="Primary keyword" />
            <input className={inputCls} value={draft.ring} onChange={(e) => set("ring", e.target.value)} placeholder="Ring (R0…)" />
            <input className={inputCls} value={draft.city} onChange={(e) => set("city", e.target.value)} placeholder="City" />
            <input className={cn(inputCls, "md:col-span-2")} value={draft.published_url} onChange={(e) => set("published_url", e.target.value)} placeholder="Published URL (when live)" />
          </div>
          <div className="mt-2 flex justify-end gap-2">
            <button type="button" onClick={() => { setDraft(row); setEditing(false); }} className="px-2 text-[12px] text-ink/55">Cancel</button>
            <button type="button" onClick={() => { onChange({ ...draft, slug: draft.slug || slugify(draft.title) }); setEditing(false); }} className="rounded-sm bg-[#ff3c00] px-3 py-1 text-[12px] text-white">Save row</button>
          </div>
        </td>
      </tr>
    );
  }
  return (
    <tr className="border-t border-hair align-top">
      <td className="py-2 pr-2 font-mono text-[11px] text-ink/45">{index + 1}</td>
      <td className="py-2 pr-3 text-[11.5px] text-ink/60">{row.category}</td>
      <td className="py-2 pr-3">
        <p className="text-[12.5px] font-medium leading-snug">{row.title}</p>
        <p className="font-mono text-[10.5px] text-ink/40">{row.slug}</p>
        {row.published_url && <a href={row.published_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10.5px] text-[#ff3c00]">live <ExternalLink className="h-2.5 w-2.5" /></a>}
      </td>
      <td className="py-2 pr-3 text-[11.5px] text-ink/65">{row.ring}{row.city && row.city !== row.ring ? <span className="block text-ink/45">{row.city}</span> : null}</td>
      <td className="py-2 pr-3 text-[11.5px] text-ink/65">{row.primary_keyword}</td>
      <td className="py-2">
        {editable ? (
          <div className="flex items-center gap-1">
            <select value={row.status} onChange={(e) => onChange({ ...row, status: e.target.value, published_at: e.target.value === "published" && !row.published_at ? new Date().toISOString().slice(0, 10) : row.published_at })} className={cn("rounded-sm border-0 px-1.5 py-0.5 text-[10.5px]", STATUS_TONE[row.status])}>
              {QUEUE_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button type="button" disabled={index === 0} onClick={() => onMove(-1)} className="p-0.5 text-ink/40 hover:text-ink disabled:opacity-20" aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
            <button type="button" disabled={index === total - 1} onClick={() => onMove(1)} className="p-0.5 text-ink/40 hover:text-ink disabled:opacity-20" aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={() => { setDraft(row); setEditing(true); }} className="p-0.5 text-ink/40 hover:text-ink" aria-label="Edit row"><Pencil className="h-3.5 w-3.5" /></button>
            <button type="button" onClick={onRemove} className="p-0.5 text-ink/30 hover:text-red-600" aria-label="Remove row"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ) : <Pill className={STATUS_TONE[row.status]}>{row.status}</Pill>}
      </td>
    </tr>
  );
}

function EditorialQueue({ queue, editable, onSave }) {
  const [confirmRemove, setConfirmRemove] = useState(null);
  const rows = (queue || []).map(normalizeQueueRow).sort((a, b) => a.order - b.order);
  const commit = (next) => onSave(next.map((r, i) => ({ ...r, order: i + 1 })));
  const move = (i, dir) => {
    const next = [...rows];
    const j = i + dir;
    [next[i], next[j]] = [next[j], next[i]];
    commit(next);
  };
  const add = () => commit([...rows, normalizeQueueRow({ title: "New post", category: "", status: "planned" }, rows.length)]);
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-left">
          <thead className="mono-label text-[8px] text-ink/45"><tr><th className="py-1 pr-2">#</th><th className="pr-3">Category</th><th className="pr-3">Title / slug</th><th className="pr-3">Ring</th><th className="pr-3">Keyword</th><th>Status</th></tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <QueueRow
                key={`${r.slug}-${i}`}
                row={r}
                index={i}
                total={rows.length}
                editable={editable}
                onChange={(nr) => commit(rows.map((x, k) => (k === i ? nr : x)))}
                onMove={(dir) => move(i, dir)}
                onRemove={() => setConfirmRemove(i)}
              />
            ))}
          </tbody>
        </table>
      </div>
      {confirmRemove != null && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
          Remove &ldquo;{rows[confirmRemove]?.title}&rdquo; from the queue?
          <button type="button" onClick={() => { commit(rows.filter((_, k) => k !== confirmRemove)); setConfirmRemove(null); }} className="rounded-sm bg-red-600 px-2 py-0.5 text-white">Remove</button>
          <button type="button" onClick={() => setConfirmRemove(null)} className="text-red-700/70">Keep</button>
        </div>
      )}
      {editable && <button type="button" onClick={add} className="mt-2 inline-flex items-center gap-1 text-[12px] text-[#ff3c00]"><Plus className="h-3.5 w-3.5" /> Add a post to the queue</button>}
    </div>
  );
}

export function ProjectPipelineCard({ plan, client, automations = [], onSave }) {
  const [editing, setEditing] = useState(false);
  const pr = (plan && plan.projects) || {};
  const [draft, setDraft] = useState(pr);
  const auto = automations.find((a) => a.kind === "project_page");
  const enabled = !!pr.enabled;
  const fields = [["source_app_id", "Portal / ops app id"], ["source_entity", "Entity"], ["source_status", "Status that publishes"], ["publish_url_pattern", "Publishes to"], ["cadence", "Cadence"], ["automation_name", "Automation"]];
  return (
    <div className="rounded-md border border-hair bg-card">
      <div className="h-1 bg-gradient-to-r from-[#ff3c00] via-[#ff6a00] to-[#ffaa00]" />
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <FileStack className="h-4 w-4 text-[#ff3c00]" strokeWidth={1.75} />
          <div>
            <h4 className="text-[14px] font-semibold tracking-[-0.02em]">Project submissions → website pages</h4>
            <p className="text-[11.5px] text-ink/50">{enabled ? `${pr.source_entity || "Submissions"} marked "${pr.source_status || "ready"}" publish to ${pr.publish_url_pattern || "the site"}${pr.cadence ? ` · ${pr.cadence}` : ""}` : "No submission pipeline for this client yet"}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Pill className={enabled ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}>{enabled ? "on" : "not set up"}</Pill>
          {onSave && !editing && <button type="button" onClick={() => { setDraft(pr); setEditing(true); }} className="text-ink/40 hover:text-ink" aria-label="Edit pipeline"><Pencil className="h-3.5 w-3.5" /></button>}
        </div>
      </div>
      {editing ? (
        <div className="space-y-2 border-t border-hair px-4 py-3">
          <label className="flex items-center gap-2 text-[12px]"><input type="checkbox" className="accent-[#ff3c00]" checked={!!draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} /> Pipeline is on</label>
          <div className="grid gap-1.5 md:grid-cols-2">
            {fields.map(([k, label]) => <label key={k} className="block"><span className="mono-label text-[8.5px] text-ink/45">{label}</span><input className={inputCls} value={draft[k] || ""} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })} /></label>)}
          </div>
          <textarea className={inputCls} rows={2} value={draft.notes || ""} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} placeholder="Notes" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(false)} className="px-2 text-[12px] text-ink/55">Cancel</button>
            <button type="button" onClick={async () => { await onSave(draft); setEditing(false); }} className="rounded-sm bg-[#ff3c00] px-3 py-1 text-[12px] text-white">Save</button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 border-t border-hair px-4 py-3 lg:grid-cols-[1fr_1.3fr]">
          <div className="space-y-1.5 text-[12px]">
            {enabled ? fields.map(([k, label]) => (pr[k] ? <p key={k}><span className="mono-label mr-2 text-[8.5px] text-ink/45">{label}</span><span className="font-mono text-[11.5px] text-ink/80">{pr[k]}</span></p> : null)) : (
              <div className="rounded-sm border border-amber-200 bg-amber-50/70 p-2.5 text-[12px] text-amber-900">
                {client.ops_app_id ? `${client.business} has an ops app (${client.ops_app_id}) but no submission → page task is recorded. Set the entity, status and URL pattern here once the daily task exists.` : `${client.business} has no ops / portal app where jobs are submitted, so finished work can't become website pages automatically yet.`}
              </div>
            )}
            {pr.published_count != null && <p><span className="mono-label mr-2 text-[8.5px] text-ink/45">project pages live</span><span className="font-mono">{pr.published_count}</span></p>}
            {auto && <p><span className="mono-label mr-2 text-[8.5px] text-ink/45">automation record</span>{auto.name} · {auto.status}{auto.schedule ? ` · ${auto.schedule}` : ""}</p>}
            {pr.notes && <p className="text-[11.5px] text-ink/55">{pr.notes}</p>}
          </div>
          <PipelineSteps />
        </div>
      )}
    </div>
  );
}

export function PipelineSteps() {
  return (
    <ol className="space-y-1.5">
      <p className="mono-label text-[8.5px] text-ink/45">how a portal submission becomes a page (any client)</p>
      {PROJECT_PIPELINE_STEPS.map(([h, d], i) => (
        <li key={h} className="flex gap-2.5 text-[11.5px] leading-snug text-ink/70">
          <span className="font-mono text-[10.5px] text-[#ff3c00]">{String(i + 1).padStart(2, "0")}</span>
          <span><span className="font-medium text-ink">{h}.</span> {d}</span>
        </li>
      ))}
    </ol>
  );
}

/* ---------------- full plan view ---------------- */

export function PlanView({ plan, client, automations = [], editable = false, onPatch }) {
  const p = normalizeContentPlan(plan);
  if (!p) return <p className="text-[13px] text-ink/50">This plan has no structured data.</p>;
  const b = p.blog;
  const g = p.gbp;
  const slots = nextBlogSlots(p, 6);
  const lastPublished = [...(b.published_log || [])].sort((x, y) => String(y.date).localeCompare(String(x.date)))[0];
  const saveBlog = (patch) => onPatch && onPatch({ blog: { ...(plan.blog || {}), ...patch } });
  const paused = plan.automation_status === "paused" || b.automation_status === "paused";
  const queued = b.editorial_queue.filter((r) => r.status !== "published").length;
  return (
    <div className="space-y-6">
      {p.summary && <p className="max-w-3xl text-[13px] leading-relaxed text-ink/70">{p.summary}</p>}

      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border border-hair bg-card p-3">
          <p className="mono-label text-[8.5px] text-ink/45">blog cadence</p>
          <p className="mt-1 text-[17px] font-semibold tracking-[-0.03em]">{b.days.length ? b.days.join(" + ") : b.frequency || "—"}</p>
          <p className="text-[11.5px] text-ink/55">{b.frequency}{b.url_pattern ? ` · ${b.url_pattern}` : ""}</p>
        </div>
        <div className="rounded-md border border-hair bg-card p-3">
          <p className="mono-label text-[8.5px] text-ink/45">gbp cadence</p>
          <p className="mt-1 text-[17px] font-semibold tracking-[-0.03em]">{g.enabled ? (g.days.length ? g.days.join(" + ") : g.frequency || "—") : "Off"}</p>
          <p className="text-[11.5px] text-ink/55">{g.frequency}{g.derived_from_blog ? " · one per blog post" : ""}</p>
        </div>
        <div className="rounded-md border border-hair bg-card p-3">
          <p className="mono-label text-[8.5px] text-ink/45">queue</p>
          <p className="mt-1 text-[17px] font-semibold tracking-[-0.03em]">{queued} to write</p>
          <p className="text-[11.5px] text-ink/55">{b.editorial_queue.length - queued} published from this queue{lastPublished ? ` · last post ${lastPublished.date}` : ""}</p>
        </div>
      </div>
      {(b.cadence_notes || g.cadence_notes) && <p className="max-w-3xl text-[12px] text-ink/55">{b.cadence_notes} {g.cadence_notes}</p>}
      {paused && <p className="rounded-sm border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">The scheduled tasks for this plan are paused. Dates below show when each post would run once they resume.</p>}

      <Section title="Next 6 posts" aside={<CalendarDays className="h-3.5 w-3.5 text-ink/35" />}>
        {slots.length ? (
          <ol className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {slots.map((s, i) => (
              <li key={`${s.slug}-${i}`} className="rounded-md border border-hair bg-card px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="mono-label text-[8.5px] text-[#ff3c00]">{s.due ? fmtDay(s.due) : "no day set"}</span>
                  <Pill className={STATUS_TONE[s.status]}>{s.status}</Pill>
                </div>
                <p className="mt-1 text-[12.5px] font-medium leading-snug">{s.title}</p>
                <p className="mt-0.5 text-[11px] text-ink/50">{s.category}{s.ring ? ` · ${s.ring}` : ""}{s.primary_keyword ? ` · “${s.primary_keyword}”` : ""}</p>
              </li>
            ))}
          </ol>
        ) : <p className="text-[12px] text-ink/40">Queue is empty.</p>}
      </Section>

      <Section title="Category rotation">
        <RotationStrip rotation={b.category_rotation} nextCategory={slots[0]?.category} lastCategory={lastPublished?.category} />
        <p className="mt-2 text-[11px] text-ink/40">Filled: next post · tinted: most recent published post. Consecutive posts never share a category.</p>
        {b.pillars.length > 0 && (
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {b.pillars.map((x, i) => <div key={i} className="rounded-sm border border-hair px-3 py-2"><p className="text-[12.5px] font-medium">{x.name}</p><p className="text-[11.5px] text-ink/55">{x.description}</p></div>)}
          </div>
        )}
      </Section>

      <Section title="Editorial queue">
        <EditorialQueue queue={b.editorial_queue} editable={editable} onSave={(rows) => saveBlog({ editorial_queue: rows })} />
      </Section>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Section title="Keyword map"><KeywordMap targets={b.keyword_targets} /></Section>
        <Section title="Geo rings"><GeoRings rings={b.geo_plan} /></Section>
      </div>

      <Section title="GBP calendar · next 4 weeks"><GbpCalendar plan={p} /></Section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Section title="GBP rules">
          <p className="mono-label mb-1 text-[8.5px] text-ink/45">post types (rotation)</p>
          <p className="mb-3 text-[12.5px] text-ink/80">{g.post_types.join(" → ")}</p>
          {g.themes.length > 0 && <><p className="mono-label mb-1 text-[8.5px] text-ink/45">themes</p><p className="mb-3 text-[12.5px] text-ink/80">{g.themes.join(" · ")}</p></>}
          {g.keyword_angles.length > 0 && <><p className="mono-label mb-1 text-[8.5px] text-ink/45">keyword angles</p><p className="mb-3 text-[12.5px] text-ink/80">{g.keyword_angles.join(" · ")}</p></>}
          <p className="mono-label mb-1 text-[8.5px] text-red-700">compliance (always)</p>
          <Bullets items={g.compliance_rules.length ? g.compliance_rules : GBP_COMPLIANCE} />
          {g.photo_rules.length > 0 && <><p className="mono-label mb-1 mt-3 text-[8.5px] text-ink/45">photos</p><Bullets items={g.photo_rules} /></>}
        </Section>
        <Section title="Sample GBP posts">
          {g.sample_posts.length ? (
            <div className="space-y-2">
              {g.sample_posts.map((s, i) => (
                <div key={i} className="rounded-md border border-hair bg-card p-3">
                  <div className="flex items-center justify-between gap-2"><span className="text-[12.5px] font-medium">{s.title || `Sample ${i + 1}`}</span><Pill className="bg-[#ff6a00]/15 text-[#c24100]">{s.type}</Pill></div>
                  <p className="mt-1 whitespace-pre-wrap text-[12px] leading-relaxed text-ink/75">{s.body}</p>
                  <p className="mt-2 inline-block rounded-sm border border-hair px-2 py-0.5 text-[11px] text-ink/60">{s.cta} → blog URL</p>
                </div>
              ))}
            </div>
          ) : <p className="text-[12px] text-ink/40">No samples yet. The live task writes each GBP post from that day&apos;s blog.</p>}
        </Section>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Section title="Internal linking"><Bullets items={b.internal_linking} /></Section>
        <Section title="Format · AEO / GEO"><Bullets items={b.format_rules} /></Section>
        <Section title="Cover images"><Bullets items={b.cover_image_rules} /></Section>
      </div>

      <Section title="Project publishing">
        <ProjectPipelineCard plan={p} client={client} automations={automations} onSave={editable && onPatch ? (projects) => onPatch({ projects: { ...(plan.projects || {}), ...projects } }) : null} />
      </Section>

      {p.kpis.length > 0 && (
        <Section title="KPIs">
          <table className="w-full text-left text-[12px]">
            <thead className="mono-label text-[8px] text-ink/45"><tr><th className="py-1 pr-3">KPI</th><th className="pr-3">Now</th><th className="pr-3">Target</th><th>Source</th></tr></thead>
            <tbody>{p.kpis.map((k, i) => <tr key={i} className="border-t border-hair"><td className="py-1.5 pr-3 font-medium">{k.name}</td><td className="pr-3">{k.current || <span className="text-ink/35">unknown</span>}</td><td className="pr-3">{k.target || "—"}</td><td className="text-ink/50">{k.source || "—"}</td></tr>)}</tbody>
          </table>
        </Section>
      )}

      {b.published_log.length > 0 && (
        <details className="rounded-md border border-hair bg-card px-4 py-3">
          <summary className="mono-label cursor-pointer text-[9.5px] text-ink/50">Already published ({b.published_log.length})</summary>
          <ul className="mt-2 space-y-1">
            {[...b.published_log].sort((x, y) => String(y.date).localeCompare(String(x.date))).map((x) => (
              <li key={x.slug} className="flex flex-wrap gap-2 text-[12px] text-ink/70"><span className="font-mono text-[11px] text-ink/45">{x.date}</span><span className="text-ink/50">{x.category}</span>{x.url ? <a href={x.url} target="_blank" rel="noreferrer" className="hover:text-[#ff3c00]">{x.title}</a> : x.title}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/* ---------------- tab ---------------- */

export default function ContentPlanTab({ client, onEdit }) {
  const me = useQuery({ queryKey: ["auth", "me"], queryFn: () => base44.auth.me(), staleTime: 300_000 });
  const { data: jobs = [] } = useJobs(400);
  const refreshJobs = useRefreshJobs();
  const plans = useClientRecords("ContentPlan", client.id, { sort: "-version" });
  const inputs = useQuery({ queryKey: ["ContentPlanInputs", client.id], queryFn: () => gatherContentPlanInputs(client) });
  const [composing, setComposing] = useState(false);
  const [autoEdit, setAutoEdit] = useState(null);
  const [saveErr, setSaveErr] = useState("");

  if (me.isLoading) return <p className="text-[13px] text-ink/50">Loading…</p>;
  if (me.data?.role !== "admin") return <p className="text-[13px] text-ink/50">Content plans are managed by your Interstellar team.</p>;

  const cpJobs = jobs.filter((j) => j.client_id === client.id && isContentPlanJob(j));
  const review = cpJobs.filter((j) => j.status === "needs_approval");
  const working = cpJobs.filter((j) => ["queued", "running", "changes_requested", "failed"].includes(j.status));
  const current = plans.rows.find((k) => k.status === "approved");
  const history = plans.rows.filter((k) => k !== current);
  const inFlight = working.some((j) => j.status !== "failed");
  const criteria = inputs.data ? contentPlanCriteria(client, inputs.data) : [];
  const ready = criteria.length > 0 && criteria.every((c) => c.ok);
  const refresh = () => { refreshJobs(); plans.refresh(); inputs.refetch(); };
  const patch = async (fields) => {
    setSaveErr("");
    try { await plans.update(current.id, fields); } catch (e) { setSaveErr(e?.message || "Couldn't save that change"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="label-cross mb-2">(Content plan)</p>
          <p className="max-w-2xl text-[13px] text-ink/60">The plan of attack for {client.business}&apos;s blog, Google Business Profile posts and project pages: what gets published, when, for which keyword and city. Edits here are saved on the approved plan; generating again creates a new version.</p>
        </div>
        {!composing && (
          <button
            type="button"
            onClick={() => setComposing(true)}
            disabled={!ready || inFlight}
            title={inFlight ? "A content plan job is already in the queue" : !ready ? "Fill the missing criteria first" : ""}
            className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-4 py-2.5 text-[13px] font-medium text-white disabled:opacity-50"
          >
            <Sparkles className="h-3.5 w-3.5" /> {current ? "Revise content plan" : "Generate content plan"}
          </button>
        )}
      </div>

      {inputs.isLoading ? <p className="flex items-center gap-2 text-[12.5px] text-ink/55"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking the profile, dossier and goals…</p> : (!ready || !current) && <Readiness client={client} criteria={criteria} onEdit={onEdit} />}

      {composing && ready && <Composer client={client} inputs={inputs.data} revising={!!current} onClose={() => setComposing(false)} onDone={refresh} />}

      {working.length > 0 && (
        <div className="rounded-md border border-hair bg-card">
          {working.map((j) => {
            const s = JOB_STATUS[j.status] || JOB_STATUS.queued;
            return (
              <Link key={j.id} to={`/claude?job=${j.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-ink/[0.03]">
                <Pill className={s.tone}>{s.label}</Pill>
                <span className="min-w-0 flex-1 truncate text-[13px]">{j.title}</span>
                <span className="font-mono text-[10.5px] text-ink/40">{timeAgo(j.requested_at || j.created_date)}</span>
              </Link>
            );
          })}
        </div>
      )}

      {review.map((j) => <ReviewCard key={j.id} job={j} client={client} onDone={refresh} />)}

      {current ? (
        <section className="rounded-md border border-hair bg-card">
          <div className="h-1 bg-gradient-to-r from-[#ff3c00] via-[#ff6a00] to-[#ffaa00]" />
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-hair px-4 py-3">
            <div>
              <h3 className="text-[15px] font-semibold tracking-[-0.02em]">Approved content plan · v{current.version || 1}</h3>
              <p className="text-[11.5px] text-ink/50">
                Approved {timeAgo(current.approved_at || current.created_date)}{current.approved_by ? ` by ${current.approved_by}` : ""}
                {current.generated_by === "import" ? " · imported" : current.generated_by === "quick_draft" ? " · quick draft" : ""}
              </p>
              {current.import_note && <p className="mt-0.5 text-[11.5px] text-ink/45">{current.import_note}</p>}
            </div>
            {autoEdit ? (
              <div className="flex flex-wrap items-center gap-2">
                <input className={cn(inputCls, "w-64")} value={autoEdit.automation_name} onChange={(e) => setAutoEdit({ ...autoEdit, automation_name: e.target.value })} placeholder="Scheduled automation(s)" />
                <select className={cn(inputCls, "w-28")} value={autoEdit.automation_status} onChange={(e) => setAutoEdit({ ...autoEdit, automation_status: e.target.value })}>
                  {Object.entries(AUTO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button type="button" onClick={async () => { await patch(autoEdit); setAutoEdit(null); }} className="rounded-sm bg-[#ff3c00] px-3 py-1 text-[12px] text-white">Save</button>
                <button type="button" onClick={() => setAutoEdit(null)} className="text-[12px] text-ink/50">Cancel</button>
              </div>
            ) : (
              <button type="button" onClick={() => setAutoEdit({ automation_name: current.automation_name || "", automation_status: current.automation_status || "not_set_up" })} className={cn("inline-flex max-w-full items-center gap-1.5 rounded-sm border px-3 py-1.5 text-left text-[12px]", AUTO_TONE[current.automation_status || "not_set_up"])} title="Which scheduled automation runs this plan">
                <span className="mono-label text-[8.5px]">{AUTO_LABEL[current.automation_status || "not_set_up"]}</span>
                <span className="truncate">{current.automation_name || "Set the automation"}</span>
                <Pencil className="h-3 w-3 shrink-0 opacity-60" />
              </button>
            )}
          </header>
          {saveErr && <p className="px-4 pt-3 text-[12px] text-red-600">{saveErr}</p>}
          <div className="p-4">
            <PlanView plan={current} client={client} automations={inputs.data?.automations || []} editable onPatch={patch} />
          </div>
        </section>
      ) : review.length === 0 && working.length === 0 && !composing ? (
        <div className="space-y-4">
          <div className="rounded-md border border-dashed border-hair px-6 py-10 text-center">
            <CalendarDays className="mx-auto h-6 w-6 text-ink/30" strokeWidth={1.5} />
            <p className="mt-3 text-[13px] text-ink/55">No content plan yet. {ready ? "Generate one to lay out the blog queue, keyword map, geo rings and GBP calendar." : "Fill the items above, then generate one."}</p>
          </div>
          <ProjectPipelineCard plan={null} client={client} automations={inputs.data?.automations || []} />
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
