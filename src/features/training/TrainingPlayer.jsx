// Trainee player: lesson -> hands-on checklist -> quick check -> next module. Mobile first, one thumb.
// mode "trainee": progress saves through training-player (quiz graded on the server, answers never sent down).
// mode "preview": owners try the track; progress stays in this tab and quizzes grade locally.
// Client-facing: reads as the business's own training.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, ArrowRight, Award, BookOpen, Check, CheckCircle2, ChevronDown, Clock, HelpCircle, ListChecks, Loader2, MessageCircleQuestion, RotateCcw, Send, X } from "lucide-react";
import Lesson from "./Lesson";
import { Bar } from "./ui";

const L = {
  en: {
    lesson: "Lesson", tasks: "Hands-on", quiz: "Quick check", of: "of", module: "Module", min: "min", read: "I've read this", cont: "Continue",
    check: "Check my answers", retry: "Try again", next: "Next module", finish: "Finish", ask: "Ask a question", askTitle: "Ask your manager",
    askHint: "Stuck on something? Your question goes straight to your manager.", send: "Send question", sent: "Sent. Your manager will answer here.",
    yourQs: "Your questions", waiting: "Waiting for an answer", tasksHint: "Do each task for real, then tick it off.", passed: "Passed", score: "Score",
    need: "You need", toPass: "to pass", allModules: "All modules", doneTitle: "Training complete", doneSign: "Nice work. Your manager will sign off soon.",
    doneBody: "You finished every module.", badge: "Badge", due: "Due", preview: "Preview: progress isn't saved.", sources: "From", required: "Required",
    optional: "Optional", noTasks: "No hands-on tasks in this module.", noQuiz: "No quick check in this module.", pick: "Pick an answer for every question.",
    correct: "Correct", wrong: "Not quite", answer: "Answer", resume: "Pick up where you left off", close: "Close", lang: "Language",
  },
  es: {
    lesson: "Lección", tasks: "Práctica", quiz: "Repaso rápido", of: "de", module: "Módulo", min: "min", read: "Ya lo leí", cont: "Continuar",
    check: "Revisar respuestas", retry: "Intentar de nuevo", next: "Siguiente módulo", finish: "Terminar", ask: "Hacer una pregunta", askTitle: "Pregúntale a tu gerente",
    askHint: "¿Tienes una duda? Tu pregunta le llega directo a tu gerente.", send: "Enviar pregunta", sent: "Enviada. Tu gerente te responderá aquí.",
    yourQs: "Tus preguntas", waiting: "Esperando respuesta", tasksHint: "Haz cada tarea de verdad y luego márcala.", passed: "Aprobado", score: "Puntaje",
    need: "Necesitas", toPass: "para aprobar", allModules: "Todos los módulos", doneTitle: "Capacitación completa", doneSign: "¡Buen trabajo! Tu gerente lo aprobará pronto.",
    doneBody: "Terminaste todos los módulos.", badge: "Insignia", due: "Fecha límite", preview: "Vista previa: el progreso no se guarda.", sources: "De", required: "Obligatorio",
    optional: "Opcional", noTasks: "Este módulo no tiene tareas prácticas.", noQuiz: "Este módulo no tiene repaso.", pick: "Elige una respuesta en cada pregunta.",
    correct: "Correcto", wrong: "No exactamente", answer: "Respuesta", resume: "Sigue donde te quedaste", close: "Cerrar", lang: "Idioma",
  },
};

const isDone = (m, p) => !!p && !!p.lesson_done && (m.checklist || []).every((c) => p.checks?.[c.id]) && (!(m.quiz || []).length || !!p.quiz_passed);
const firstStep = (m, p) => (!p?.lesson_done ? "lesson" : (m.checklist || []).some((c) => !p?.checks?.[c.id]) ? "tasks" : (m.quiz || []).length && !p?.quiz_passed ? "quiz" : "lesson");

export default function TrainingPlayer({ data, mode = "trainee", onSave, onAsk, onClose }) {
  const preview = mode === "preview";
  const modules = useMemo(() => data?.modules || [], [data]);
  const [progress, setProgress] = useState(() => data?.assignment?.progress || {});
  const [questions, setQuestions] = useState(() => data?.assignment?.questions || []);
  const [lang, setLang] = useState(() => (data?.assignment?.language === "es" && data?.track?.es_available ? "es" : "en"));
  const start = Math.max(0, modules.findIndex((m) => m.id === data?.assignment?.current_module_id));
  const [idx, setIdx] = useState(start);
  const [step, setStep] = useState(() => (modules[start] ? firstStep(modules[start], (data?.assignment?.progress || {})[modules[start].id]) : "lesson"));
  const [picks, setPicks] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [menu, setMenu] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  // A trainee who already finished lands on the completion screen.
  const [finished, setFinished] = useState(() => mode === "trainee" && (data?.modules || []).length > 0 && (data.modules || []).every((m) => isDone(m, (data?.assignment?.progress || {})[m.id])));
  const topRef = useRef(null);
  const t = L[lang];

  useEffect(() => { if (data?.assignment) { setProgress(data.assignment.progress || {}); setQuestions(data.assignment.questions || []); } }, [data]);

  const mod = modules[idx];
  const view = (m) => (lang === "es" && m?.es ? { ...m, ...m.es, quiz: m.es.quiz.map((q, i) => ({ ...m.quiz[i], ...q })) } : m);
  const v = mod ? view(mod) : null;
  const p = mod ? progress[mod.id] || {} : {};
  const doneCount = modules.filter((m) => isDone(m, progress[m.id])).length;
  const pct = modules.length ? Math.round((doneCount / modules.length) * 100) : 0;
  const allDone = modules.length > 0 && doneCount === modules.length;
  const signed = !!data?.assignment?.signoff;
  const steps = mod ? [["lesson", t.lesson, BookOpen], ...((mod.checklist || []).length ? [["tasks", t.tasks, ListChecks]] : []), ...((mod.quiz || []).length ? [["quiz", t.quiz, HelpCircle]] : [])] : [];

  const scrollTop = () => { try { topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); } catch { window.scrollTo(0, 0); } };
  const go = (i, s) => { setIdx(i); setStep(s || firstStep(modules[i], progress[modules[i].id])); setPicks({}); setResult(null); setErr(""); setMenu(false); setFinished(false); scrollTop(); };

  // Save one action. Preview: local only (quiz graded here, answers are in the preview payload).
  const save = async (args) => {
    setErr("");
    if (preview) {
      const cur = { ...(progress[mod.id] || {}) };
      if (args.lesson_done) cur.lesson_done = true;
      if (args.check) cur.checks = { ...(cur.checks || {}), [args.check.id]: args.check.value };
      let res = null;
      if (args.quiz_answers) {
        const per = mod.quiz.map((q, i) => ({ id: q.id, picked: args.quiz_answers[i], correct: args.quiz_answers[i] === q.answer_index, answer_index: q.answer_index, explanation: v.quiz[i]?.explanation || q.explanation || "" }));
        const score = Math.round((per.filter((x) => x.correct).length / per.length) * 100);
        const pass = score >= (data.track.pass_score ?? 80);
        cur.attempts = (cur.attempts || 0) + 1;
        cur.quiz_score = Math.max(cur.quiz_score || 0, score);
        if (pass) cur.quiz_passed = true;
        res = { score, pass, per, pass_score: data.track.pass_score ?? 80 };
      }
      setProgress((s) => ({ ...s, [mod.id]: cur }));
      return { result: res, progress: { ...progress, [mod.id]: cur } };
    }
    setBusy(true);
    try {
      const d = await onSave({ module_id: mod.id, language: lang, ...args });
      setProgress(d.assignment?.progress || {});
      setQuestions(d.assignment?.questions || []);
      return { result: d.result, progress: d.assignment?.progress || {} };
    } catch (e) {
      setErr(e?.message || "Couldn't save. Check your connection and try again.");
      return null;
    } finally { setBusy(false); }
  };

  const nextAfter = (s, prog) => {
    const order = steps.map((x) => x[0]);
    const i = order.indexOf(s);
    if (i < order.length - 1) { setStep(order[i + 1]); scrollTop(); return; }
    const nextIdx = modules.findIndex((m, j) => j > idx && !isDone(m, prog[m.id]));
    const anyLeft = modules.findIndex((m) => !isDone(m, prog[m.id]));
    if (nextIdx >= 0) go(nextIdx, "lesson");
    else if (anyLeft >= 0) go(anyLeft);
    else { setFinished(true); scrollTop(); }
  };

  const onPrimary = async () => {
    if (step === "lesson") {
      const r = p.lesson_done ? { progress } : await save({ lesson_done: true });
      if (r) nextAfter("lesson", r.progress);
    } else if (step === "tasks") {
      nextAfter("tasks", progress);
    } else if (step === "quiz") {
      if (result?.pass || (p.quiz_passed && !result)) { nextAfter("quiz", progress); return; }
      if (result && !result.pass) { setPicks({}); setResult(null); scrollTop(); return; }
      if (mod.quiz.some((q) => picks[q.id] == null)) { setErr(t.pick); return; }
      const r = await save({ quiz_answers: mod.quiz.map((q) => picks[q.id]) });
      if (r) setResult(r.result);
    }
  };

  const toggle = async (c) => { await save({ check: { id: c.id, value: !p.checks?.[c.id] } }); };
  const tasksDone = (mod?.checklist || []).every((c) => p.checks?.[c.id]);

  const primaryLabel = step === "lesson" ? (p.lesson_done ? t.cont : t.read)
    : step === "tasks" ? t.cont
    : result ? (result.pass ? (idx === modules.length - 1 && doneCount >= modules.length - 1 ? t.finish : t.next) : t.retry)
    : p.quiz_passed ? t.next : t.check;
  const primaryDisabled = busy || (step === "tasks" && !tasksDone);

  if (!modules.length) return <div className="px-5 py-20 text-center text-[14px] text-ink/55">No modules yet.</div>;

  return (
    <div className="min-h-[100dvh] bg-canvas text-ink" data-training-player={mode}>
      <div ref={topRef} />
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-hair bg-canvas/95 backdrop-blur">
        <div className="h-[3px] bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)]" aria-hidden="true" />
        <div className="mx-auto max-w-[680px] px-4 pb-3 pt-3">
          <div className="flex items-center gap-2">
            {onClose && <button type="button" onClick={onClose} className="-ml-2 flex h-10 w-10 items-center justify-center text-ink/55 hover:text-ink" aria-label={t.close}><X className="h-5 w-5" /></button>}
            <div className="min-w-0 flex-1">
              <p className="mono-label truncate text-[9.5px] text-ink/50">{data.business}{data.track.role_label ? ` · ${data.track.role_label}` : ""}</p>
              <p className="truncate text-[15px] font-semibold tracking-[-0.02em]">{data.track.title}</p>
            </div>
            {data.track.es_available && (
              <div className="flex shrink-0 border border-hair bg-card p-0.5" role="group" aria-label={t.lang}>
                {["en", "es"].map((l) => (
                  <button key={l} type="button" aria-pressed={lang === l} onClick={() => { setLang(l); if (!preview && l !== lang && data.assignment) onSave?.({ language: l }).catch(() => null); }} className={`h-8 w-9 text-[12px] font-semibold uppercase ${lang === l ? "bg-ink text-white" : "text-ink/55"}`}>{l}</button>
                ))}
              </div>
            )}
          </div>
          <div className="mt-2.5 flex items-center gap-3">
            <Bar pct={pct} className="h-2 flex-1" />
            <span className="font-mono text-[11px] tabular-nums text-ink/60">{pct}%</span>
          </div>
          <button type="button" onClick={() => setMenu(true)} className="mt-2 flex w-full items-center gap-2 text-left text-[12.5px] text-ink/60">
            <span className="mono-label text-[9.5px] text-[#ff3c00]">{t.module} {idx + 1} {t.of} {modules.length}</span>
            <span className="min-w-0 flex-1 truncate">{v.title}</span>
            <ChevronDown className="h-4 w-4 shrink-0" />
          </button>
        </div>
      </header>

      {preview && <p className="mx-auto max-w-[680px] px-4 pt-3 text-[11.5px] text-ink/50">{t.preview}</p>}

      <main className="mx-auto max-w-[680px] px-4 pb-36 pt-5">
        {finished ? (
          <Done t={t} data={data} signed={signed} allDone={allDone} onBack={() => setFinished(false)} />
        ) : (
          <>
            {/* Step rail */}
            <ol className="flex items-center gap-1.5" aria-label="Steps">
              {steps.map(([k, label, Icon], i) => {
                const doneStep = k === "lesson" ? p.lesson_done : k === "tasks" ? tasksDone : p.quiz_passed;
                const cur = step === k;
                return (
                  <li key={k} className="flex min-w-0 flex-1 items-center gap-1.5">
                    <button type="button" onClick={() => { setStep(k); setResult(null); setErr(""); }} aria-current={cur ? "step" : undefined} className={`flex h-9 min-w-0 flex-1 items-center justify-center gap-1.5 border px-2 text-[12px] font-medium ${cur ? "border-ink bg-ink text-white" : doneStep ? "border-[#ff3c00]/40 bg-[#ff3c00]/5 text-[#c83000]" : "border-hair bg-card text-ink/55"}`}>
                      {doneStep && !cur ? <Check className="h-3.5 w-3.5 shrink-0" /> : <Icon className="h-3.5 w-3.5 shrink-0" />}
                      <span className="truncate">{label}</span>
                    </button>
                    {i < steps.length - 1 && <span className="h-px w-2 shrink-0 bg-hair" aria-hidden="true" />}
                  </li>
                );
              })}
            </ol>

            <div className="mt-5">
              <h1 className="text-[26px] font-semibold leading-[1.08] tracking-[-0.035em]">{v.title}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-ink/50">
                <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{mod.est_minutes} {t.min}</span>
                <span>{mod.required ? t.required : t.optional}</span>
                {data.assignment?.module_due?.[mod.id] && <span>{t.due} {new Date(`${data.assignment.module_due[mod.id]}T12:00:00`).toLocaleDateString(lang === "es" ? "es-US" : "en-US", { month: "short", day: "numeric" })}</span>}
              </div>
            </div>

            {step === "lesson" && (
              <section className="mt-5">
                {v.summary && <p className="text-[16px] font-medium leading-snug text-ink/85">{v.summary}</p>}
                <div className="mt-4"><Lesson md={v.lesson_md} embeds={mod.embeds} /></div>
                {mod.sop_refs?.length > 0 && <p className="mt-6 text-[11.5px] text-ink/45">{t.sources}: {mod.sop_refs.map((r) => r.title).join(" · ")}</p>}
              </section>
            )}

            {step === "tasks" && (
              <section className="mt-5">
                <p className="text-[13.5px] text-ink/60">{t.tasksHint}</p>
                <ul className="mt-4 space-y-2.5">
                  {(v.checklist || []).map((c) => {
                    const on = !!p.checks?.[c.id];
                    return (
                      <li key={c.id}>
                        <button type="button" onClick={() => toggle(c)} disabled={busy} aria-pressed={on} className={`flex w-full items-start gap-3 border px-4 py-4 text-left transition-colors ${on ? "border-[#ff3c00]/50 bg-[#ff3c00]/[0.06]" : "border-hair bg-card active:bg-paper"}`}>
                          <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center border-2 ${on ? "border-[#ff3c00] bg-[#ff3c00] text-white" : "border-ink/25 bg-white"}`}>{on && <Check className="h-4 w-4" />}</span>
                          <span className={`text-[15px] leading-snug ${on ? "text-ink/60" : "text-ink"}`}>{c.text}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            )}

            {step === "quiz" && (
              <section className="mt-5 space-y-5">
                {p.quiz_passed && !result && <p className="inline-flex items-center gap-1.5 bg-green-700/10 px-2.5 py-1.5 text-[12.5px] font-medium text-green-800"><CheckCircle2 className="h-4 w-4" />{t.passed} · {t.score} {p.quiz_score}%</p>}
                {v.quiz.map((q, qi) => {
                  const r = result?.per?.[qi];
                  return (
                    <fieldset key={q.id} className="border border-hair bg-card px-4 py-4">
                      <legend className="sr-only">{q.question}</legend>
                      <p className="text-[15.5px] font-semibold leading-snug tracking-[-0.01em]"><span className="mr-1.5 font-mono text-[12px] text-[#ff3c00]">{qi + 1}.</span>{q.question}</p>
                      <div className="mt-3 space-y-2">
                        {q.options.map((o, oi) => {
                          const picked = picks[q.id] === oi;
                          const isRight = r && oi === r.answer_index;
                          const isWrongPick = r && picked && !r.correct;
                          return (
                            <button key={oi} type="button" disabled={!!result || busy} onClick={() => setPicks((s) => ({ ...s, [q.id]: oi }))} aria-pressed={picked}
                              className={`flex w-full items-center gap-3 border px-3.5 py-3 text-left text-[14.5px] transition-colors ${isRight ? "border-green-600 bg-green-50" : isWrongPick ? "border-red-400 bg-red-50" : picked ? "border-ink bg-ink text-white" : "border-hair bg-paper"}`}>
                              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${picked && !r ? "border-white" : isRight ? "border-green-600 bg-green-600 text-white" : "border-ink/25"}`}>{(picked && !r) && <span className="h-2 w-2 rounded-full bg-white" />}{isRight && <Check className="h-3 w-3" />}</span>
                              <span className="min-w-0 flex-1">{o}</span>
                            </button>
                          );
                        })}
                      </div>
                      {r && (
                        <p className={`mt-3 text-[13px] leading-relaxed ${r.correct ? "text-green-800" : "text-ink/75"}`}>
                          <span className="font-semibold">{r.correct ? t.correct : t.wrong}.</span> {r.explanation}
                        </p>
                      )}
                    </fieldset>
                  );
                })}
                {result && (
                  <div className={`flex items-center gap-3 border px-4 py-3 ${result.pass ? "border-green-200 bg-green-50 text-green-900" : "border-amber-300/70 bg-amber-50 text-amber-900"}`}>
                    {result.pass ? <Award className="h-5 w-5 shrink-0" /> : <RotateCcw className="h-5 w-5 shrink-0" />}
                    <p className="text-[13.5px]"><span className="font-semibold">{t.score} {result.score}%.</span> {result.pass ? t.passed : `${t.need} ${result.pass_score}% ${t.toPass}.`}</p>
                  </div>
                )}
              </section>
            )}
            {err && <p role="alert" className="mt-4 border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-800">{err}</p>}
          </>
        )}
      </main>

      {/* Bottom action bar (thumb reach) */}
      {!finished && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-hair bg-canvas/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <div className="mx-auto flex max-w-[680px] items-center gap-2 px-4 py-3">
            <button type="button" onClick={() => (idx > 0 ? go(idx - 1, "lesson") : null)} disabled={idx === 0} className="flex h-12 w-12 shrink-0 items-center justify-center border border-hair bg-card text-ink/60 disabled:opacity-30" aria-label="Previous module"><ArrowLeft className="h-5 w-5" /></button>
            <button type="button" onClick={() => setAskOpen(true)} className="relative flex h-12 shrink-0 items-center gap-1.5 border border-hair bg-card px-3 text-[13px] font-medium text-ink/75" aria-label={t.ask}>
              <MessageCircleQuestion className="h-[18px] w-[18px]" /><span className="hidden min-[400px]:inline">{t.ask}</span>
              {questions.some((q) => q.answer && q.module_id === mod?.id) && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#ff3c00]" />}
            </button>
            <button type="button" onClick={onPrimary} disabled={primaryDisabled} className="flame-bg flex h-12 min-w-0 flex-1 items-center justify-center gap-2 px-4 text-[14.5px] font-semibold text-white shadow-[0_10px_24px_-12px_rgba(255,60,0,.9)] disabled:opacity-45">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span className="truncate">{primaryLabel}</span>
              {!busy && <ArrowRight className="h-4 w-4 shrink-0" />}
            </button>
          </div>
        </div>
      )}

      <ModuleMenu open={menu} onClose={() => setMenu(false)} modules={modules} view={view} progress={progress} idx={idx} go={go} t={t} />
      <AskSheet open={askOpen} onClose={() => setAskOpen(false)} t={t} mod={mod} v={v} questions={questions} preview={preview}
        onSend={async (text) => {
          if (preview) { setQuestions((s) => [...s, { id: `p${Date.now()}`, module_id: mod.id, text, asked_at: new Date().toISOString(), answer: "" }]); return true; }
          const d = await onAsk(mod.id, text);
          setQuestions(d.assignment?.questions || []);
          return true;
        }} />
    </div>
  );
}

function Done({ t, data, signed, allDone, onBack }) {
  const waiting = data.track.requires_signoff && !signed;
  return (
    <div className="py-6 text-center">
      <span className="flame-bg mx-auto flex h-20 w-20 items-center justify-center text-white shadow-[0_18px_40px_-16px_rgba(255,60,0,.9)]"><Award className="h-10 w-10" /></span>
      <h1 className="mt-6 text-[30px] font-semibold leading-tight tracking-[-0.04em]">{t.doneTitle}</h1>
      <p className="mx-auto mt-2 max-w-sm text-[15px] text-ink/65">{allDone ? (waiting ? `${t.doneBody} ${t.doneSign}` : t.doneBody) : t.resume}</p>
      {data.assignment?.badge?.code && !waiting && <p className="mt-4 inline-flex items-center gap-2 border border-hair bg-card px-3 py-2 font-mono text-[12px]">{t.badge} · {data.assignment.badge.code}</p>}
      <div className="mt-6"><button type="button" onClick={onBack} className="h-11 border border-hair bg-card px-5 text-[13.5px] font-medium">{t.allModules}</button></div>
    </div>
  );
}

function Sheet({ open, onClose, title, children }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative flex max-h-[85dvh] w-full max-w-[560px] flex-col border border-hair bg-canvas shadow-2xl" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
        <div className="h-[3px] bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)]" />
        <div className="flex items-center justify-between border-b border-hair px-4 py-3">
          <p className="text-[16px] font-semibold tracking-[-0.02em]">{title}</p>
          <button type="button" onClick={onClose} className="-mr-2 flex h-10 w-10 items-center justify-center text-ink/55" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

function ModuleMenu({ open, onClose, modules, view, progress, idx, go, t }) {
  return (
    <Sheet open={open} onClose={onClose} title={t.allModules}>
      <ol className="divide-y divide-hair">
        {modules.map((m, i) => {
          const d = isDone(m, progress[m.id]);
          return (
            <li key={m.id}>
              <button type="button" onClick={() => go(i)} className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${i === idx ? "bg-white" : ""}`}>
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center text-[12px] font-semibold ${d ? "flame-bg text-white" : i === idx ? "bg-ink text-white" : "bg-ink/[0.07] text-ink/60"}`}>{d ? <Check className="h-4 w-4" /> : i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium">{view(m).title}</span>
                  <span className="block text-[11.5px] text-ink/50">{m.est_minutes} {t.min}{m.required ? "" : ` · ${t.optional}`}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </Sheet>
  );
}

function AskSheet({ open, onClose, t, mod, v, questions, onSend, preview }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { if (open) { setMsg(""); } }, [open]);
  const mine = questions.filter((q) => !mod || q.module_id === mod.id || !q.module_id);
  const send = async () => {
    if (text.trim().length < 3 || busy) return;
    setBusy(true); setMsg("");
    try { await onSend(text.trim()); setText(""); setMsg(t.sent); } catch (e) { setMsg(e?.message || "Couldn't send. Try again."); } finally { setBusy(false); }
  };
  return (
    <Sheet open={open} onClose={onClose} title={t.askTitle}>
      <div className="px-4 py-4">
        <p className="text-[13px] text-ink/60">{t.askHint}</p>
        {v && <p className="mono-label mt-3 text-[9.5px] text-[#ff3c00]">{v.title}</p>}
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} maxLength={1500} className="mt-2 w-full resize-none border border-hair bg-card px-3 py-2.5 text-[15px] outline-none focus:border-[#ff3c00]" aria-label={t.ask} />
        <button type="button" onClick={send} disabled={busy || text.trim().length < 3} className="flame-bg mt-2 flex h-11 w-full items-center justify-center gap-2 text-[14px] font-semibold text-white disabled:opacity-45">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}{t.send}
        </button>
        {msg && <p className="mt-2 text-[12.5px] text-ink/65">{msg}{preview ? " (preview)" : ""}</p>}
        {mine.length > 0 && (
          <div className="mt-5">
            <p className="mono-label text-[9.5px] text-ink/50">{t.yourQs}</p>
            <ul className="mt-2 space-y-2">
              {mine.slice().reverse().map((q) => (
                <li key={q.id} className="border border-hair bg-card px-3 py-2.5">
                  <p className="text-[13.5px] font-medium">{q.text}</p>
                  {q.answer ? <p className="mt-1.5 border-l-2 border-[#ff3c00] pl-2 text-[13px] text-ink/75">{q.answer}</p> : <p className="mt-1 text-[11.5px] text-ink/45">{t.waiting}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Sheet>
  );
}
