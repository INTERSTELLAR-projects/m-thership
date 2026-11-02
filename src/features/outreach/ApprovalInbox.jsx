import { useEffect, useMemo, useState } from "react";
import { Check, ExternalLink, RotateCcw, X, CheckCheck, AlertTriangle } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Tag, Empty, Panel } from "@/features/clients/ui";
import { timeAgo } from "@/lib/useData";
import { KIND_LABEL, METHOD_LABEL, MSG_STATUS_LABEL, inputCls, isEmail, isBlocked, nowIso } from "./lib";

let meCache = null;
async function whoAmI() {
  if (meCache) return meCache;
  const me = await base44.auth.me().catch(() => null);
  meCache = me?.email || me?.full_name || "justin";
  return meCache;
}

function MessageCard({ m, target, rules, onPatch }) {
  const [draft, setDraft] = useState({ subject: m.subject || "", body: m.body || "", to_email: m.to_email || "" });
  const [busy, setBusy] = useState("");
  const [rewriting, setRewriting] = useState(false);
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { setDraft({ subject: m.subject || "", body: m.body || "", to_email: m.to_email || "" }); }, [m.id, m.subject, m.body, m.to_email]);

  const dirty = draft.subject !== (m.subject || "") || draft.body !== (m.body || "") || draft.to_email !== (m.to_email || "");
  const blocked = isBlocked(rules, draft.to_email, target?.url);
  const followUp = !!m.follow_up_of;

  const run = async (label, fn) => {
    setBusy(label); setErr("");
    try { await fn(); } catch (e) { setErr(e?.message || String(e)); } finally { setBusy(""); }
  };

  const save = () => run("save", async () => {
    await base44.entities.OutreachMessage.update(m.id, draft);
    onPatch("OutreachMessage", m.id, draft);
  });

  const approve = () => run("approve", async () => {
    if (!isEmail(draft.to_email)) throw new Error("Add a valid recipient email before approving.");
    if (!draft.subject.trim() || !draft.body.trim()) throw new Error("Subject and body can't be empty.");
    if (blocked) throw new Error("That domain is on the blocked list in Outreach rules.");
    const by = await whoAmI();
    const fields = { ...draft, status: "approved", approved_by: by, approved_at: nowIso(), rewrite_note: "" };
    await base44.entities.OutreachMessage.update(m.id, fields);
    onPatch("OutreachMessage", m.id, fields);
    if (target && !followUp) {
      await base44.entities.OutreachTarget.update(target.id, { status: "approved", last_action_at: nowIso() });
      onPatch("OutreachTarget", target.id, { status: "approved" });
    }
  });

  const reject = () => run("reject", async () => {
    await base44.entities.OutreachMessage.update(m.id, { status: "rejected" });
    onPatch("OutreachMessage", m.id, { status: "rejected" });
    if (target && !followUp) {
      await base44.entities.OutreachTarget.update(target.id, { status: "skip", last_action_at: nowIso() });
      onPatch("OutreachTarget", target.id, { status: "skip" });
    }
  });

  const requestRewrite = () => run("rewrite", async () => {
    if (!note.trim()) throw new Error("Say what should change so Claude can rewrite it.");
    const fields = { ...draft, status: "rewrite_requested", rewrite_note: note.trim() };
    await base44.entities.OutreachMessage.update(m.id, fields);
    onPatch("OutreachMessage", m.id, fields);
    setRewriting(false); setNote("");
  });

  return (
    <article className="border border-hair bg-paper">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hair px-4 py-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="text-[14px] font-semibold tracking-[-0.02em]">{target?.name || m.target_name || "Unknown target"}</p>
            {target?.kind && <Tag>{KIND_LABEL[target.kind] || target.kind}</Tag>}
            {followUp && <Tag tone="amber">Follow-up</Tag>}
            {m.status === "rewrite_requested" && <Tag tone="amber">Rewrite requested</Tag>}
            {target?.cost && target.cost !== "unknown" && <Tag tone={target.cost === "free" ? "green" : "amber"}>{target.cost}{target.cost_amount ? ` · ${target.cost_amount}` : ""}</Tag>}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-ink/55">
            {target?.url && <a href={target.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-[#ff3c00]">{target.url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48)} <ExternalLink className="h-3 w-3" /></a>}
            {target?.submission_url && <a href={target.submission_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-[#ff3c00]">Submission page <ExternalLink className="h-3 w-3" /></a>}
            {target?.submission_method && <span>{METHOD_LABEL[target.submission_method]}</span>}
            {target?.found_by && <span>Found by {target.found_by} {target.found_at ? timeAgo(target.found_at) : ""}</span>}
          </div>
        </div>
        <span className="mono-label text-[9px] text-ink/45">{m.client_name}</span>
      </div>

      {(target?.relevance || target?.domain_authority_note || target?.requirements || m.rewrite_note) && (
        <div className="space-y-1 border-b border-hair bg-card px-4 py-2.5 text-[12px] leading-relaxed text-ink/65">
          {target?.relevance && <p><span className="mono-label mr-1.5 text-[9px] text-ink/45">Why</span>{target.relevance}</p>}
          {target?.domain_authority_note && <p><span className="mono-label mr-1.5 text-[9px] text-ink/45">Outlet</span>{target.domain_authority_note}</p>}
          {target?.requirements && <p><span className="mono-label mr-1.5 text-[9px] text-ink/45">Needs</span>{target.requirements}</p>}
          {m.rewrite_note && <p className="text-amber-800"><span className="mono-label mr-1.5 text-[9px]">Your note</span>{m.rewrite_note}</p>}
        </div>
      )}

      <div className="space-y-2 px-4 py-3">
        <div className="grid gap-2 md:grid-cols-[1fr_2fr]">
          <label className="block">
            <span className="mono-label mb-1 block text-[9px] text-ink/50">To</span>
            <input className={inputCls} value={draft.to_email} placeholder="editor@outlet.com" onChange={(e) => setDraft((d) => ({ ...d, to_email: e.target.value }))} />
          </label>
          <label className="block">
            <span className="mono-label mb-1 block text-[9px] text-ink/50">Subject</span>
            <input className={inputCls} value={draft.subject} onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))} />
          </label>
        </div>
        <label className="block">
          <span className="mono-label mb-1 block text-[9px] text-ink/50">Body (signature and opt-out line are added when sent)</span>
          <textarea rows={8} className={`${inputCls} font-[inherit] leading-relaxed`} value={draft.body} onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))} />
        </label>
        {blocked && <p className="flex items-center gap-1.5 text-[12px] text-red-700"><AlertTriangle className="h-3.5 w-3.5" /> This domain is on your blocked list.</p>}
        {err && <p className="text-[12px] text-red-700">{err}</p>}

        {rewriting && (
          <div className="flex flex-wrap gap-2 border border-amber-500/40 bg-amber-500/5 p-2">
            <input autoFocus className={`${inputCls} min-w-[220px] flex-1`} value={note} placeholder="e.g. shorter, lead with the 20-year family story" onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && requestRewrite()} />
            <button onClick={requestRewrite} disabled={!!busy} className="h-9 bg-ink px-3 text-[12.5px] font-medium text-white disabled:opacity-50">{busy === "rewrite" ? "Saving…" : "Send to Claude"}</button>
            <button onClick={() => setRewriting(false)} className="h-9 px-2 text-[12.5px] text-ink/55 hover:text-ink">Cancel</button>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button onClick={approve} disabled={!!busy} className="inline-flex h-9 items-center gap-1.5 bg-[#ff3c00] px-4 text-[12.5px] font-medium text-white transition-colors hover:bg-ink disabled:opacity-50">
            <Check className="h-3.5 w-3.5" /> {busy === "approve" ? "Approving…" : dirty ? "Save & approve" : "Approve"}
          </button>
          {dirty && <button onClick={save} disabled={!!busy} className="h-9 border border-hair px-3 text-[12.5px] text-ink/70 hover:border-ink/40 disabled:opacity-50">{busy === "save" ? "Saving…" : "Save edits"}</button>}
          {!rewriting && <button onClick={() => setRewriting(true)} disabled={!!busy} className="inline-flex h-9 items-center gap-1.5 border border-hair px-3 text-[12.5px] text-ink/70 hover:border-ink/40"><RotateCcw className="h-3.5 w-3.5" /> Request rewrite</button>}
          <button onClick={reject} disabled={!!busy} className="inline-flex h-9 items-center gap-1.5 px-3 text-[12.5px] text-red-700 hover:underline disabled:opacity-50"><X className="h-3.5 w-3.5" /> {followUp ? "Reject" : "Reject & skip target"}</button>
          <span className="ml-auto text-[11px] text-ink/40">Drafted {timeAgo(m.created_date)}</span>
        </div>
      </div>
    </article>
  );
}

function ApproveAll({ group, targets, rules, onPatch }) {
  const [arm, setArm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const ready = group.items.filter((m) => m.status === "needs_approval" && isEmail(m.to_email) && m.subject && m.body && !isBlocked(rules, m.to_email));
  if (!ready.length) return null;
  const go = async () => {
    setBusy(true);
    const by = await whoAmI();
    let n = 0;
    for (const m of ready) {
      const fields = { status: "approved", approved_by: by, approved_at: nowIso() };
      try {
        await base44.entities.OutreachMessage.update(m.id, fields);
        onPatch("OutreachMessage", m.id, fields);
        const t = targets.find((x) => x.id === m.target_id);
        if (t && !m.follow_up_of) {
          await base44.entities.OutreachTarget.update(t.id, { status: "approved", last_action_at: nowIso() });
          onPatch("OutreachTarget", t.id, { status: "approved" });
        }
        n++;
      } catch { /* keep going */ }
    }
    setBusy(false); setArm(false);
    setMsg(`${n} approved. Unsaved edits on cards were not included.`);
  };
  if (msg) return <span className="text-[11.5px] text-ink/55">{msg}</span>;
  return arm ? (
    <span className="flex items-center gap-2">
      <span className="text-[12px] text-ink/60">Approve {ready.length} as written?</span>
      <button onClick={go} disabled={busy} className="h-8 bg-[#ff3c00] px-3 text-[12px] font-medium text-white disabled:opacity-50">{busy ? "Approving…" : "Yes, approve"}</button>
      <button onClick={() => setArm(false)} className="h-8 px-2 text-[12px] text-ink/55">Cancel</button>
    </span>
  ) : (
    <button onClick={() => setArm(true)} className="inline-flex h-8 items-center gap-1.5 border border-hair px-3 text-[12px] text-ink/70 hover:border-ink/40"><CheckCheck className="h-3.5 w-3.5" /> Approve all for client ({ready.length})</button>
  );
}

export default function ApprovalInbox({ messages, targets, rules, onPatch, showRewrites = true }) {
  const pending = useMemo(
    () => messages.filter((m) => m.status === "needs_approval" || (showRewrites && m.status === "rewrite_requested")),
    [messages, showRewrites],
  );
  const groups = useMemo(() => {
    const g = {};
    for (const m of pending) {
      const k = m.client_id || "none";
      (g[k] ||= { id: k, name: m.client_name || "No client", items: [] }).items.push(m);
    }
    return Object.values(g).sort((a, b) => a.name.localeCompare(b.name));
  }, [pending]);
  const approvedQueue = messages.filter((m) => m.status === "approved");

  if (!groups.length)
    return (
      <Panel>
        <Empty>
          Nothing waiting for approval. Claude's research task drafts pitches here as <b>Needs approval</b>.
          {approvedQueue.length ? ` ${approvedQueue.length} approved message${approvedQueue.length === 1 ? "" : "s"} waiting for the send task.` : ""}
        </Empty>
      </Panel>
    );

  return (
    <div className="space-y-6">
      {approvedQueue.length > 0 && (
        <p className="border border-hair bg-card px-3 py-2 text-[12.5px] text-ink/65">
          {approvedQueue.length} approved, queued for the SEND task ({MSG_STATUS_LABEL.approved}). Approving never sends from the browser.
        </p>
      )}
      {groups.map((g) => (
        <section key={g.id}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="label-cross">{g.name} · {g.items.length}</p>
            <ApproveAll group={g} targets={targets} rules={rules} onPatch={onPatch} />
          </div>
          <div className="space-y-3">
            {g.items.map((m) => <MessageCard key={m.id} m={m} target={targets.find((t) => t.id === m.target_id)} rules={rules} onPatch={onPatch} />)}
          </div>
        </section>
      ))}
    </div>
  );
}
