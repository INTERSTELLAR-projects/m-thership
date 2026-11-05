// Manager view: who's in training, % complete, stuck / overdue, quiz results, open questions, sign-off.
import { useState } from "react";
import { AlertTriangle, Award, Check, ChevronDown, Clock, Copy, ExternalLink, Link2, MessageCircleQuestion, Send, UserPlus } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Bar, Button, Chip, ConfirmButton, Field, Modal, Notice, ago, fmtDay, inputCls, plusDays, todayIso } from "./ui";
import { errText, traineeLink } from "./api";

const STATUS = {
  not_started: ["Not started", "muted"], in_progress: ["In training", "soft"], awaiting_signoff: ["Needs sign-off", "flame"], completed: ["Completed", "green"],
};

export function Stats({ list }) {
  const active = list.filter((a) => a.status !== "completed");
  const avg = active.length ? Math.round(active.reduce((s, a) => s + (a.pct || 0), 0) / active.length) : 0;
  const tiles = [
    ["In training", active.length, ""],
    ["Avg. complete", `${avg}%`, ""],
    ["Overdue", list.filter((a) => a.overdue).length, "red"],
    ["Stuck", list.filter((a) => a.stuck).length, "amber"],
    ["Needs sign-off", list.filter((a) => a.status === "awaiting_signoff").length, "flame"],
    ["Open questions", list.reduce((s, a) => s + (a.open_questions || 0), 0), "flame"],
  ];
  return (
    <div className="grid grid-cols-2 overflow-hidden border border-hair bg-card sm:grid-cols-3 xl:grid-cols-6">
      {tiles.map(([k, v, tone]) => (
        <div key={k} className="border-b border-r border-hair px-4 py-4 xl:border-b-0">
          <p className={`text-[28px] font-semibold leading-none tracking-[-0.04em] tabular-nums ${tone === "red" && v ? "text-red-700" : tone === "amber" && v ? "text-amber-700" : tone === "flame" && v ? "text-[#ff3c00]" : ""}`}>{v}</p>
          <p className="mono-label mt-2 text-[9.5px] text-ink/50">{k}</p>
        </div>
      ))}
    </div>
  );
}

export default function ManagerView({ data, call, refresh, portal, onAssign }) {
  const list = data?.assignments || [];
  const [open, setOpen] = useState(() => new Set(list.filter((a) => a.open_questions || a.status === "awaiting_signoff").slice(0, 1).map((a) => a.id)));
  const [filter, setFilter] = useState("active");
  const shown = list.filter((a) => (filter === "active" ? a.status !== "completed" : filter === "attention" ? a.overdue || a.stuck || a.open_questions || a.status === "awaiting_signoff" : filter === "done" ? a.status === "completed" : true));
  const toggle = (id) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <div className="space-y-4" data-training-manager>
      <Stats list={list} />
      <div className="flex flex-wrap items-center gap-2">
        {[["active", "In training"], ["attention", "Needs attention"], ["done", "Completed"], ["all", "All"]].map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k} className={`h-8 border px-3 text-[12.5px] font-medium ${filter === k ? "border-ink bg-ink text-white" : "border-hair bg-card text-ink/65 hover:border-ink/40"}`}>{l}</button>
        ))}
        <span className="ml-auto" />
        <Button kind="flame" icon={UserPlus} onClick={() => onAssign(null)} disabled={!data?.tracks?.length}>Assign a track</Button>
      </div>
      {!list.length ? (
        <div className="border border-dashed border-hair bg-card px-6 py-12 text-center">
          <p className="text-[15px] font-semibold">Nobody is in training yet.</p>
          <p className="mx-auto mt-1 max-w-md text-[13px] text-ink/55">Assign a track to a new team member. They get a private link that works on their phone, no login needed{portal ? "" : ", and you see their progress here"}.</p>
        </div>
      ) : !shown.length ? (
        <p className="border border-hair bg-card px-4 py-6 text-center text-[13px] text-ink/55">Nothing here.</p>
      ) : (
        <ul className="space-y-2">
          {shown.map((a) => <Row key={a.id} a={a} open={open.has(a.id)} toggle={() => toggle(a.id)} call={call} refresh={refresh} />)}
        </ul>
      )}
    </div>
  );
}

function Row({ a, open, toggle, call, refresh }) {
  const { toast } = useToast();
  const [st, tone] = STATUS[a.status] || STATUS.not_started;
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState("");
  const [due, setDue] = useState(a.due_date || "");
  const run = async (key, fn, ok) => {
    setBusy(key);
    try { await fn(); if (ok) toast({ title: ok }); await refresh(); } catch (e) { toast({ title: "Couldn't save", description: errText(e), variant: "destructive" }); } finally { setBusy(""); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(traineeLink(a)); toast({ title: "Training link copied", description: `Send it to ${a.trainee_name}. It opens on any phone, no login.` }); } catch { toast({ title: "Copy failed", description: traineeLink(a) }); } };
  const quizzes = a.modules.filter((m) => m.quiz);
  const avgQuiz = quizzes.filter((m) => m.quiz_score != null).length ? Math.round(quizzes.filter((m) => m.quiz_score != null).reduce((s, m) => s + m.quiz_score, 0) / quizzes.filter((m) => m.quiz_score != null).length) : null;

  return (
    <li className={`border bg-card ${a.overdue || a.stuck ? "border-amber-300/70" : "border-hair"}`} data-assignment={a.id}>
      <button type="button" onClick={toggle} aria-expanded={open} className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3.5 text-left">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center bg-ink text-[13px] font-semibold text-white">{a.trainee_name.split(/\s+/).map((x) => x[0]).slice(0, 2).join("").toUpperCase()}</span>
        <span className="min-w-[160px] flex-1">
          <span className="flex flex-wrap items-center gap-1.5 text-[14.5px] font-semibold tracking-[-0.01em]">{a.trainee_name}
            <Chip tone={tone}>{st}</Chip>
            {a.overdue && <Chip tone="red"><Clock className="h-2.5 w-2.5" />Overdue</Chip>}
            {a.stuck && <Chip tone="amber"><AlertTriangle className="h-2.5 w-2.5" />Stuck</Chip>}
            {a.open_questions > 0 && <Chip tone="flame"><MessageCircleQuestion className="h-2.5 w-2.5" />{a.open_questions} question{a.open_questions === 1 ? "" : "s"}</Chip>}
            {a.language === "es" && <Chip>ES</Chip>}
            {a.source === "hiring_plan" && <Chip>Hiring plan</Chip>}
          </span>
          <span className="block truncate text-[12px] text-ink/55">{a.track_title}</span>
        </span>
        <span className="flex w-full items-center gap-3 sm:w-[220px]">
          <Bar pct={a.pct} className="h-1.5 flex-1" />
          <span className="w-9 text-right font-mono text-[11.5px] tabular-nums text-ink/65">{a.pct}%</span>
        </span>
        <span className="hidden w-[150px] text-[11.5px] leading-tight text-ink/50 md:block">
          {a.due_date ? <>Due {fmtDay(a.due_date)}<br /></> : null}Active {ago(a.last_active_at)}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-ink/45 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="grid gap-5 border-t border-hair px-4 py-4 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="mono-label text-[9.5px] text-ink/50">Modules · quiz results{avgQuiz != null ? ` · avg ${avgQuiz}%` : ""}</p>
            <ol className="mt-2 divide-y divide-hair border border-hair">
              {a.modules.map((m, i) => (
                <li key={m.id} className="flex items-center gap-3 px-3 py-2 text-[12.5px]">
                  <span className={`flex h-6 w-6 shrink-0 items-center justify-center text-[11px] font-semibold ${m.completed_at ? "flame-bg text-white" : "bg-ink/[0.07] text-ink/55"}`}>{m.completed_at ? <Check className="h-3.5 w-3.5" /> : i + 1}</span>
                  <span className="min-w-0 flex-1 truncate">{m.title}</span>
                  <span className="hidden text-ink/45 sm:inline">{m.lesson_done ? "Read" : "Not read"} · {m.checks}/{m.checklist} tasks</span>
                  {m.quiz ? (
                    <span className={`w-[92px] text-right font-mono text-[11px] tabular-nums ${m.quiz_passed ? "text-green-700" : m.attempts >= 3 ? "text-amber-700" : "text-ink/55"}`}>
                      {m.quiz_score == null ? "No quiz yet" : `${m.quiz_score}%${m.attempts > 1 ? ` · ${m.attempts} tries` : ""}`}
                    </span>
                  ) : <span className="w-[92px] text-right text-[11px] text-ink/35">No quiz</span>}
                </li>
              ))}
            </ol>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <Field label="Due date" className="w-[160px]"><input type="date" value={due} onChange={(e) => setDue(e.target.value)} className={inputCls} /></Field>
              <Button size="sm" busy={busy === "due"} disabled={due === (a.due_date || "")} onClick={() => run("due", () => call("update_assignment", { assignment_id: a.id, due_date: due }), "Due date saved")}>Save date</Button>
              <span className="flex-1" />
              <Button size="sm" icon={Copy} onClick={copy}>Copy trainee link</Button>
              <a href={traineeLink(a)} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1.5 border border-hair bg-card px-2.5 text-[12px] font-medium hover:border-ink/40"><ExternalLink className="h-3.5 w-3.5" />Open</a>
              <ConfirmButton icon={Link2} confirmText="Yes, new link" onConfirm={() => run("link", () => call("update_assignment", { assignment_id: a.id, new_link: true }), "New link made. The old one stopped working.")}>New link</ConfirmButton>
              <ConfirmButton confirmText="Yes, remove" onConfirm={() => run("arch", () => call("update_assignment", { assignment_id: a.id, archive: true }), "Removed from training")}>Remove</ConfirmButton>
            </div>
          </div>
          <div className="space-y-4">
            <Questions a={a} call={call} refresh={refresh} />
            <div className="border border-hair bg-paper px-3 py-3">
              <p className="mono-label text-[9.5px] text-ink/50">Manager sign-off</p>
              {a.signoff?.at ? (
                <p className="mt-2 flex items-center gap-2 text-[13px]"><Award className="h-4 w-4 text-[#ff3c00]" />Signed off by {a.signoff.by} on {fmtDay(a.signoff.at)}{a.badge?.code ? ` · badge ${a.badge.code}` : ""}</p>
              ) : a.pct < 100 ? (
                <p className="mt-2 text-[12.5px] text-ink/55">Available when every required module is done ({a.pct}% now).</p>
              ) : (
                <div className="mt-2 space-y-2">
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Optional note (what they did well, what to watch)" className={`${inputCls} resize-none`} />
                  <Button kind="flame" icon={Award} busy={busy === "sign"} onClick={() => run("sign", () => call("signoff", { assignment_id: a.id, note }), `${a.trainee_name} signed off`)}>Sign off training</Button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </li>
  );
}

function Questions({ a, call, refresh }) {
  const qs = (a.questions || []).slice().reverse();
  const [drafts, setDrafts] = useState({});
  const [busy, setBusy] = useState("");
  const { toast } = useToast();
  if (!qs.length) return <p className="border border-hair bg-paper px-3 py-3 text-[12.5px] text-ink/50">No questions from {a.trainee_name.split(" ")[0]} yet.</p>;
  return (
    <div className="border border-hair bg-paper px-3 py-3">
      <p className="mono-label text-[9.5px] text-ink/50">Questions</p>
      <ul className="mt-2 space-y-2.5">
        {qs.map((q) => (
          <li key={q.id} className="border border-hair bg-card px-3 py-2.5">
            {q.module_title && <p className="mono-label text-[8.5px] text-[#ff3c00]">{q.module_title}</p>}
            <p className="text-[13px] font-medium">{q.text}</p>
            <p className="text-[10.5px] text-ink/40">{ago(q.asked_at)}</p>
            {q.answer ? (
              <p className="mt-1.5 border-l-2 border-[#ff3c00] pl-2 text-[12.5px] text-ink/75">{q.answer}</p>
            ) : (
              <div className="mt-2 flex gap-2">
                <input value={drafts[q.id] || ""} onChange={(e) => setDrafts((s) => ({ ...s, [q.id]: e.target.value }))} placeholder="Answer…" className={inputCls} />
                <Button size="sm" kind="ink" icon={Send} busy={busy === q.id} disabled={!String(drafts[q.id] || "").trim()} onClick={async () => {
                  setBusy(q.id);
                  try { await call("answer", { assignment_id: a.id, question_id: q.id, answer: drafts[q.id] }); toast({ title: "Answer sent", description: `${a.trainee_name} sees it in their training.` }); await refresh(); } catch (e) { toast({ title: "Couldn't send", description: errText(e), variant: "destructive" }); } finally { setBusy(""); }
                }}>Send</Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Assign a track to a trainee. Returns the private link to send them.
export function AssignDialog({ open, onClose, tracks, call, refresh, preset }) {
  const { toast } = useToast();
  const [v, setV] = useState({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  const list = (tracks || []).filter((t) => t.status !== "archived");
  const val = { track_id: preset?.track_id || list.find((t) => t.status === "published")?.id || list[0]?.id || "", trainee_name: preset?.trainee_name || "", trainee_email: preset?.trainee_email || "", start_date: preset?.start_date || todayIso(), due_date: plusDays(14), language: "en", ...v };
  const track = list.find((t) => t.id === val.track_id);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));
  const close = () => { setV({}); setErr(""); setDone(null); onClose(); };
  const submit = async () => {
    setBusy(true); setErr("");
    try {
      const r = await call("assign", { ...val, source: preset?.source, hire_key: preset?.hire_key });
      setDone({ ...r.assignment, name: val.trainee_name });
      await refresh?.();
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  const link = done ? traineeLink(done) : "";
  return (
    <Modal open={open} onClose={close} kicker="Assign training" title={done ? `${done.name} is enrolled` : "Assign a training track"}
      footer={done ? <Button kind="ink" onClick={close}>Done</Button> : <><Button kind="quiet" onClick={close}>Cancel</Button><Button kind="flame" busy={busy} disabled={!val.track_id || !val.trainee_name.trim()} onClick={submit}>Assign</Button></>}>
      {done ? (
        <div className="space-y-3">
          <p className="text-[13.5px] text-ink/70">Send {done.name.split(" ")[0]} this private link. It opens their training on any phone, no login, and picks up where they left off.</p>
          <div className="flex gap-2"><input readOnly value={link} className={`${inputCls} font-mono text-[12px]`} onFocus={(e) => e.target.select()} /><Button icon={Copy} onClick={async () => { try { await navigator.clipboard.writeText(link); toast({ title: "Link copied" }); } catch { /* shown above */ } }}>Copy</Button></div>
          <Notice>Anyone with the link can open this one trainee&apos;s training. Make a new link from People if it gets shared.</Notice>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Track" className="sm:col-span-2">
            <select value={val.track_id} onChange={set("track_id")} className={inputCls}>
              {list.map((t) => <option key={t.id} value={t.id}>{t.title}{t.status === "needs_sops" ? " (needs SOPs)" : t.status === "draft" ? " (draft)" : ""}</option>)}
            </select>
          </Field>
          {track?.status === "needs_sops" && <Notice tone="warn" className="sm:col-span-2">This track still has modules waiting on SOPs. The trainee will see those modules as outlines.</Notice>}
          <Field label="Trainee name"><input value={val.trainee_name} onChange={set("trainee_name")} className={inputCls} placeholder="First and last name" /></Field>
          <Field label="Email (optional)"><input type="email" value={val.trainee_email} onChange={set("trainee_email")} className={inputCls} placeholder="name@company.com" /></Field>
          <Field label="Start"><input type="date" value={val.start_date} onChange={set("start_date")} className={inputCls} /></Field>
          <Field label="Due" hint="Module due dates are spread evenly up to this date."><input type="date" value={val.due_date} onChange={set("due_date")} className={inputCls} /></Field>
          {track?.es_enabled && (
            <Field label="Language" className="sm:col-span-2" hint="Trainees can switch any time.">
              <select value={val.language} onChange={set("language")} className={inputCls}><option value="en">English</option><option value="es">Español</option></select>
            </Field>
          )}
          {err && <Notice tone="error" className="sm:col-span-2">{err}</Notice>}
        </div>
      )}
    </Modal>
  );
}
