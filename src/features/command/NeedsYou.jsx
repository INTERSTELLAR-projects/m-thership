import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { Check, Pencil, SkipForward, Clock, ChevronLeft, ChevronRight, Send, MessageSquare, ArrowUpRight, Undo2, FlaskConical, X } from "lucide-react";
import { PillarChip, Mono } from "./ui";
import { useDictation } from "./voice";
import { DictationBox, AnswerReview } from "./Dictation";
import { act, undo, errMsg } from "./api";
import { TEST_EMAIL } from "./engine";

export const KIND_LABEL = {
  send_email: "Email draft", send_sms: "Text draft", record_change: "Confirm a change", create_task: "New task",
  log_expense: "Log an expense", client_note: "Client note", choice: "Choose", question: "Question for you",
};
const isTyping = (el) => el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT" || el.isContentEditable);

function EmailPreview({ p, edit, setEdit, editing }) {
  if (editing) {
    return (
      <div className="space-y-2">
        <label className="block"><Mono className="text-ink/45">To</Mono><input value={edit.to ?? p.to ?? ""} onChange={(e) => setEdit({ ...edit, to: e.target.value })} className="mt-1 h-10 w-full border border-hair bg-white px-3 text-[14px] outline-none focus:border-ink" /></label>
        <label className="block"><Mono className="text-ink/45">Subject</Mono><input value={edit.subject ?? p.subject ?? ""} onChange={(e) => setEdit({ ...edit, subject: e.target.value })} className="mt-1 h-10 w-full border border-hair bg-white px-3 text-[14px] outline-none focus:border-ink" /></label>
        <label className="block"><Mono className="text-ink/45">Message</Mono><textarea rows={8} value={edit.body ?? p.body ?? ""} onChange={(e) => setEdit({ ...edit, body: e.target.value })} className="mt-1 w-full border border-hair bg-white p-3 text-[14px] leading-relaxed outline-none focus:border-ink" /></label>
      </div>
    );
  }
  const v = { ...p, ...edit };
  return (
    <div className="border border-hair bg-white/70">
      <div className="border-b border-hair px-3 py-2 text-[12.5px] text-ink/70"><span className="text-ink/45">To </span>{v.to || <em className="text-[#ff3c00]">add a recipient</em>}</div>
      <div className="border-b border-hair px-3 py-2 text-[13px] font-medium">{v.subject}</div>
      <pre className="max-h-48 overflow-auto whitespace-pre-wrap px-3 py-2.5 font-sans text-[13.5px] leading-relaxed text-ink/80">{v.body}</pre>
    </div>
  );
}
function SmsPreview({ p, edit, setEdit, editing }) {
  if (editing) {
    return (
      <div className="space-y-2">
        <label className="block"><Mono className="text-ink/45">Phone</Mono><input value={edit.phone ?? p.phone ?? ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} className="mt-1 h-10 w-full border border-hair bg-white px-3 text-[14px] outline-none focus:border-ink" /></label>
        <label className="block"><Mono className="text-ink/45">Text</Mono><textarea rows={4} value={edit.body ?? p.body ?? ""} onChange={(e) => setEdit({ ...edit, body: e.target.value })} className="mt-1 w-full border border-hair bg-white p-3 text-[14px] outline-none focus:border-ink" /></label>
      </div>
    );
  }
  const v = { ...p, ...edit };
  return (
    <div>
      <p className="text-[12.5px] text-ink/55">To {v.phone || <em className="text-[#ff3c00]">add a number</em>}</p>
      <p className="mt-2 max-w-[42ch] rounded-2xl rounded-bl-sm bg-[#e9e6e1] px-3.5 py-2.5 text-[14px] leading-snug text-ink">{v.body}</p>
    </div>
  );
}
function ChangesPreview({ p }) {
  const ch = p.changes || [];
  return (
    <ul className="divide-y divide-hair/70 border border-hair bg-white/60">
      {ch.map((c, i) => (
        <li key={i} className="px-3 py-2 text-[13px] leading-snug">
          <span className="text-ink/80">{c.label || `${c.entity} ${c.id}`}</span>
          <span className="ml-2 font-mono text-[10.5px] text-ink/45">{Object.entries(c.patch || {}).map(([k, v]) => `${k} → ${Array.isArray(v) ? v[v.length - 1] : v === "$now" ? "now" : v}`).join(", ")}</span>
        </li>
      ))}
    </ul>
  );
}

function ConfirmSend({ card, payload, onClose, onDone }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [sent, setSent] = useState("");
  const isSms = card.kind === "send_sms";
  const go = async (test) => {
    setBusy(test ? "test" : "send"); setErr("");
    try {
      const res = await act("approve", card.id, { confirm: true, test, edits: payload });
      if (test) { setSent(`Test sent to ${res.to || TEST_EMAIL}. The card stays here until you send it for real.`); setBusy(""); return; }
      if (isSms && res?.result?.sms_url) {
        try { await navigator.clipboard?.writeText(payload.body || card.payload?.body || ""); } catch { /* clipboard blocked */ }
        window.location.href = res.result.sms_url;
      }
      onDone(res, isSms ? "Opened in Messages (text copied)" : `Sent to ${payload.to || card.payload?.to}`);
    } catch (e) { setErr(errMsg(e)); setBusy(""); }
  };
  const v = { ...(card.payload || {}), ...payload };
  // Portal: the page wrapper animates (a transform = its own stacking context), which would trap this sheet under the Ask bar.
  return createPortal(
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-ink/50 backdrop-blur-sm md:items-center" role="dialog" aria-modal="true" aria-label="Confirm send" onClick={onClose}>
      <div className="cmd-sheet w-full max-w-lg border border-hair bg-paper p-5 shadow-2xl md:p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <Mono className="text-[#ff3c00]">Final check · nothing has gone out yet</Mono>
            <h3 className="mt-1 text-[20px] font-semibold tracking-[-0.02em]">{isSms ? "Open this text in Messages?" : "Send this email?"}</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 text-ink/45 hover:text-ink" aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <div className="mt-4 space-y-2 border border-hair bg-white p-3 text-[13.5px]">
          <p><span className="text-ink/45">{isSms ? "Phone" : "To"}: </span><strong>{isSms ? v.phone : v.to}</strong></p>
          {!isSms && <p><span className="text-ink/45">Subject: </span>{v.subject}</p>}
          <pre className="max-h-[40vh] overflow-auto whitespace-pre-wrap border-t border-hair pt-2 font-sans leading-relaxed text-ink/85">{v.body}</pre>
        </div>
        {isSms && <p className="mt-2 text-[12px] text-ink/55">Møthership doesn't send texts (phase 2). This copies the text and opens your Messages app with it filled in.</p>}
        {err && <p className="mt-3 text-[13px] text-[#c22a00]">{err}</p>}
        {sent && <p className="mt-3 text-[13px] text-[#1f8a5b]">{sent}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="button" autoFocus onClick={() => go(false)} disabled={!!busy} className="inline-flex h-12 flex-1 items-center justify-center gap-2 bg-[#ff3c00] px-5 text-[15px] font-medium text-white hover:bg-ink disabled:opacity-50">
            {isSms ? <MessageSquare className="h-4 w-4" /> : <Send className="h-4 w-4" />}{busy === "send" ? "Working…" : isSms ? "Copy & open Messages" : "Send now"}
          </button>
          {!isSms && <button type="button" onClick={() => go(true)} disabled={!!busy} className="inline-flex h-12 items-center gap-2 border border-hair px-4 text-[13px] text-ink/75 hover:border-ink disabled:opacity-50" title={`Sends only to ${TEST_EMAIL}`}><FlaskConical className="h-4 w-4" />{busy === "test" ? "Sending…" : "Test to me"}</button>}
          <button type="button" onClick={onClose} className="h-12 px-3 text-[13px] text-ink/55 hover:text-ink">Cancel</button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// Question cards: dictate (tap to start, tap to stop), then review the cleaned-up wording before it is saved.
function QuestionAnswer({ card, onDone }) {
  const [review, setReview] = useState(null);
  const dict = useDictation({ onStop: (t) => { if (t.trim()) setReview(t.trim()); } });
  if (review) {
    return (
      <AnswerReview raw={review} question={card.payload?.question || card.title} questionKey={card.payload?.question_key}
        onBack={() => { dict.setText(review); setReview(null); }}
        onSave={async (statements, { about }) => { const res = await act("approve", card.id, { raw_text: review, answer: review, statements, client_name: about || card.payload?.client_name || undefined }); onDone(res, "Saved to the Brain"); }} />
    );
  }
  return (
    <div>
      <DictationBox dict={dict} rows={3} micSize={52} placeholder="Tap the mic and say it, or type it. Plain words are fine." />
      <button type="button" onClick={() => (dict.listening ? dict.stop() : dict.text.trim() && setReview(dict.text.trim()))} disabled={!dict.text.trim() && !dict.listening} className="mt-1 inline-flex h-11 items-center gap-2 bg-ink px-4 text-[14px] font-medium text-white hover:bg-[#ff3c00] disabled:opacity-40"><Check className="h-4 w-4" />{dict.listening ? "Stop & review" : "Review answer"}</button>
    </div>
  );
}

export default function NeedsYou({ items, loading, onChanged, compact = false }) {
  const [idx, setIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState({});
  const [answer, setAnswer] = useState("");
  const [option, setOption] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState("");
  const [last, setLast] = useState(null);
  const [err, setErr] = useState("");
  const [drag, setDrag] = useState({ x: 0, y: 0, on: false });
  const start = useRef(null);
  const list = useMemo(() => items || [], [items]);
  const card = list[Math.min(idx, Math.max(0, list.length - 1))];

  useEffect(() => { setEditing(false); setEdit({}); setAnswer(""); setOption(null); setErr(""); }, [card?.id]);
  useEffect(() => { if (idx > list.length - 1) setIdx(Math.max(0, list.length - 1)); }, [list.length, idx]);

  const finish = useCallback((res, label) => {
    const changed = res?.result?.changed || [];
    const auditId = changed[0]?.audit_id || res?.result?.audit_id || null;
    const undoable = card && ["record_change", "client_note", "choice", "create_task"].includes(card.kind) && auditId;
    setLast({ label, auditId: undoable ? auditId : null });
    setConfirm(false); setBusy(""); setEditing(false);
    onChanged?.();
  }, [card, onChanged]);

  const approve = useCallback(async () => {
    if (!card || busy) return;
    setErr("");
    if (card.kind === "send_email" || card.kind === "send_sms") { setConfirm(true); return; }
    if (card.kind === "choice" && option == null) { setErr("Pick one of the options first (1, 2 or 3)."); return; }
    if (card.kind === "question") { setErr("Answer above, then tap Review answer."); return; }
    setBusy("approve");
    try {
      const res = await act("approve", card.id, { edits: Object.keys(edit).length ? edit : undefined, option: option ?? undefined, answer: answer || undefined });
      finish(res, card.kind === "question" ? "Saved to the Brain" : card.kind === "choice" ? `Done: ${card.payload?.options?.[option]?.label}` : `Done: ${card.title}`);
    } catch (e) { setErr(errMsg(e)); setBusy(""); }
  }, [card, busy, option, answer, edit, finish]);

  const skip = useCallback(async () => { if (!card || busy) return; setBusy("skip"); try { await act("skip", card.id); finish(null, `Skipped: ${card.title}`); } catch (e) { setErr(errMsg(e)); setBusy(""); } }, [card, busy, finish]);
  const snooze = useCallback(async () => { if (!card || busy) return; setBusy("snooze"); try { await act("snooze", card.id); finish(null, "Snoozed for 3 hours"); } catch (e) { setErr(errMsg(e)); setBusy(""); } }, [card, busy, finish]);
  const canEdit = card && ["send_email", "send_sms"].includes(card.kind);

  useEffect(() => {
    if (compact) return undefined;
    const h = (e) => {
      if (confirm || e.metaKey || e.ctrlKey || e.altKey || isTyping(document.activeElement)) return;
      const k = e.key.toLowerCase();
      if (k === "a") { e.preventDefault(); approve(); }
      else if (k === "e" && canEdit) { e.preventDefault(); setEditing((x) => !x); }
      else if (k === "s") { e.preventDefault(); skip(); }
      else if (k === "z") { e.preventDefault(); snooze(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); setIdx((i) => Math.min(list.length - 1, i + 1)); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
      else if (card?.kind === "choice" && /^[1-9]$/.test(e.key) && card.payload?.options?.[Number(e.key) - 1]) setOption(Number(e.key) - 1);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [approve, skip, snooze, canEdit, confirm, list.length, card, compact]);

  // Swipe (touch): right = approve, left = skip, up = snooze.
  const onPointerDown = (e) => { if (e.pointerType !== "touch" || isTyping(e.target) || e.target.closest("button,a,input,textarea")) return; start.current = { x: e.clientX, y: e.clientY }; setDrag({ x: 0, y: 0, on: true }); };
  const onPointerMove = (e) => { if (!start.current) return; setDrag({ x: e.clientX - start.current.x, y: e.clientY - start.current.y, on: true }); };
  const onPointerUp = () => {
    if (!start.current) return;
    const { x, y } = drag;
    start.current = null;
    setDrag({ x: 0, y: 0, on: false });
    if (x > 90 && Math.abs(y) < 80) approve();
    else if (x < -90 && Math.abs(y) < 80) skip();
    else if (y < -90 && Math.abs(x) < 80) snooze();
  };

  const doUndo = async () => {
    if (!last?.auditId) return;
    try { await undo(last.auditId); setLast({ label: "Undone", auditId: null }); onChanged?.(); } catch (e) { setErr(errMsg(e)); }
  };

  return (
    <section aria-label="Needs you" className="border border-hair bg-paper/80">
      <div className="flex items-center justify-between gap-3 border-b border-hair px-4 py-3 md:px-6">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold tracking-[-0.01em]">
          Needs you
          <span className={`min-w-[22px] px-1.5 py-px text-center font-mono text-[11px] ${list.length ? "bg-[#ff3c00] text-white" : "bg-ink/[0.08] text-ink/50"}`}>{loading ? "…" : list.length}</span>
        </h2>
        {list.length > 1 && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setIdx((i) => Math.max(0, i - 1))} disabled={idx === 0} className="p-1.5 text-ink/50 hover:text-ink disabled:opacity-30" aria-label="Previous card"><ChevronLeft className="h-4 w-4" /></button>
            <span className="font-mono text-[11px] tabular-nums text-ink/50">{idx + 1} / {list.length}</span>
            <button type="button" onClick={() => setIdx((i) => Math.min(list.length - 1, i + 1))} disabled={idx >= list.length - 1} className="p-1.5 text-ink/50 hover:text-ink disabled:opacity-30" aria-label="Next card"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>

      {last && (
        <div className="flex items-center justify-between gap-3 border-b border-hair bg-[#1f8a5b]/[0.07] px-4 py-2 text-[12.5px] text-ink/75 md:px-6" role="status">
          <span className="inline-flex min-w-0 items-center gap-2"><Check className="h-3.5 w-3.5 shrink-0 text-[#1f8a5b]" /><span className="truncate">{last.label}</span></span>
          {last.auditId && <button type="button" onClick={doUndo} className="inline-flex shrink-0 items-center gap-1 font-medium text-ink hover:text-[#ff3c00]"><Undo2 className="h-3.5 w-3.5" />Undo</button>}
        </div>
      )}

      {!card ? (
        <div className="px-4 py-10 text-center md:px-6">
          <p className="text-[16px] font-medium">{loading ? "Loading what needs you…" : "Nothing needs you right now."}</p>
          {!loading && <p className="mt-1 text-[13px] text-ink/50">New drafts and questions land here. Ask the agent for anything with the bar below.</p>}
        </div>
      ) : (
        <div
          key={card.id}
          className="cmd-card touch-pan-y px-4 py-5 md:px-6 md:py-6"
          style={drag.on ? { transform: `translate(${drag.x}px, ${Math.min(0, drag.y)}px) rotate(${drag.x / 40}deg)`, transition: "none" } : undefined}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <Mono className={card.risk === "external" ? "text-[#ff3c00]" : card.risk === "money" ? "text-[#1f8a5b]" : "text-ink/50"}>{KIND_LABEL[card.kind] || card.kind}{card.risk === "external" ? " · goes outside" : card.risk === "money" ? " · money record" : ""}</Mono>
            <PillarChip id={card.pillar} />
            {card.source_ref?.path && <Link to={card.source_ref.path} className="inline-flex items-center gap-0.5 text-[11.5px] text-ink/45 hover:text-[#ff3c00]">{(card.source_ref.label || "Open").slice(0, 32)}<ArrowUpRight className="h-3 w-3" /></Link>}
          </div>
          <h3 className="mt-2 text-[20px] font-semibold leading-snug tracking-[-0.02em] md:text-[23px]">{card.title}</h3>
          {card.rationale && <p className="mt-1.5 text-[13.5px] leading-snug text-ink/60">{card.rationale}</p>}

          <div className="mt-4">
            {card.kind === "send_email" && <EmailPreview p={card.payload || {}} edit={edit} setEdit={setEdit} editing={editing} />}
            {card.kind === "send_sms" && <SmsPreview p={card.payload || {}} edit={edit} setEdit={setEdit} editing={editing} />}
            {card.kind === "record_change" && <ChangesPreview p={card.payload || {}} />}
            {card.kind === "client_note" && <p className="border border-hair bg-white/60 p-3 text-[13.5px]">{card.payload?.body}</p>}
            {card.kind === "log_expense" && <p className="border border-hair bg-white/60 p-3 text-[13.5px]">{card.payload?.expense?.platform} · ${card.payload?.expense?.amount} · {card.payload?.expense?.frequency || "Monthly"}</p>}
            {card.kind === "choice" && (
              <div className="grid gap-2">
                {(card.payload?.options || []).map((o, i) => (
                  <button key={i} type="button" onClick={() => setOption(i)} aria-pressed={option === i} className={`flex min-h-[48px] items-center gap-3 border px-3.5 text-left text-[14px] transition-colors ${option === i ? "border-ink bg-ink text-white" : "border-hair bg-white/60 hover:border-ink/50"}`}>
                    <span className={`font-mono text-[11px] ${option === i ? "text-[#ff6a00]" : "text-ink/40"}`}>{i + 1}</span>{o.label}
                  </button>
                ))}
              </div>
            )}
            {card.kind === "question" && <QuestionAnswer card={card} onDone={finish} />}
          </div>

          {err && <p className="mt-3 text-[13px] text-[#c22a00]" role="alert">{err}</p>}

          <div className="mt-5 grid grid-cols-4 gap-2 md:flex md:flex-wrap">
            {card.kind !== "question" && (
            <button type="button" onClick={approve} disabled={!!busy} className="col-span-4 inline-flex h-12 items-center justify-center gap-2 bg-ink px-5 text-[15px] font-medium text-white transition-colors hover:bg-[#ff3c00] disabled:opacity-50 md:col-span-1 md:min-w-[170px]">
              <Check className="h-4 w-4" />{busy === "approve" ? "Working…" : card.kind === "question" ? "Answer above" : card.kind === "send_email" ? "Approve & review send" : card.kind === "send_sms" ? "Approve text" : "Approve"}
              <kbd className="ml-1 hidden font-mono text-[10px] text-white/50 md:inline">A</kbd>
            </button>
            )}
            {canEdit && <button type="button" onClick={() => setEditing((x) => !x)} className="inline-flex h-12 items-center justify-center gap-1.5 border border-hair px-3 text-[13px] text-ink/75 hover:border-ink"><Pencil className="h-3.5 w-3.5" />{editing ? "Done" : "Edit"}<kbd className="hidden font-mono text-[10px] text-ink/35 md:inline">E</kbd></button>}
            <button type="button" onClick={skip} disabled={!!busy} className={`${canEdit ? "" : "col-span-2"} inline-flex h-12 items-center justify-center gap-1.5 border border-hair px-3 text-[13px] text-ink/75 hover:border-ink disabled:opacity-50`}><SkipForward className="h-3.5 w-3.5" />Skip<kbd className="hidden font-mono text-[10px] text-ink/35 md:inline">S</kbd></button>
            <button type="button" onClick={snooze} disabled={!!busy} className={`${canEdit ? "col-span-2" : "col-span-2"} inline-flex h-12 items-center justify-center gap-1.5 border border-hair px-3 text-[13px] text-ink/75 hover:border-ink disabled:opacity-50`}><Clock className="h-3.5 w-3.5" />Snooze 3h<kbd className="hidden font-mono text-[10px] text-ink/35 md:inline">Z</kbd></button>
          </div>
          <p className="mt-3 hidden font-mono text-[10px] uppercase tracking-[0.12em] text-ink/35 md:block">A approve · E edit · S skip · Z snooze · ← → move</p>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.12em] text-ink/35 md:hidden">Swipe right approve · left skip · up snooze</p>
        </div>
      )}
      {confirm && card && <ConfirmSend card={card} payload={edit} onClose={() => setConfirm(false)} onDone={finish} />}
    </section>
  );
}
