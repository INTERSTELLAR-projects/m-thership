// Workspace home: "Questions for our next call". Justin marks questions on a call prep with "Ask in Workspace";
// they show here so the client can answer ahead and the call starts where it matters. Hidden when there are none.
import { useState } from "react";
import { Check, Loader2, PhoneCall } from "lucide-react";

function fmtWhen(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles", timeZoneName: "short" }).format(new Date(iso));
  } catch { return ""; }
}

function Question({ q, prepId, call, preview }) {
  const [val, setVal] = useState(q.answer || "");
  const [saved, setSaved] = useState(q.answer || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const dirty = val.trim() !== saved.trim();
  const save = async () => {
    if (preview || !dirty) return;
    setBusy(true); setErr("");
    try { await call("call_answer", { prep_id: prepId, i: q.i, answer: val }); setSaved(val); }
    catch (e) { setErr(e?.message || "Couldn't save. Try again."); }
    finally { setBusy(false); }
  };
  return (
    <li className="rounded-md border border-hair bg-white p-4">
      <p className="text-[15px] font-medium leading-snug">{q.q}</p>
      <textarea rows={2} value={val} onChange={(e) => setVal(e.target.value)} onBlur={save} disabled={preview}
        placeholder={preview ? "The client answers here" : "Type a quick answer (optional)"}
        className="mt-2.5 w-full resize-y rounded-md border border-hair bg-canvas px-3 py-2 text-[14px] outline-none focus:border-ink/40" />
      <div className="mt-1.5 flex min-h-[18px] items-center gap-2 text-[12px] text-ink/50">
        {busy ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving</> : err ? <span className="text-[#c2410c]">{err}</span> : saved && !dirty ? <><Check className="h-3.5 w-3.5 text-[#ff3c00]" /> Saved for the call</> : dirty ? <button type="button" onClick={save} className="font-medium text-ink underline">Save</button> : null}
      </div>
    </li>
  );
}

export default function NextCallBand({ next, call, preview }) {
  if (!next || !Array.isArray(next.questions) || !next.questions.length) return null;
  const when = fmtWhen(next.scheduled_for);
  const done = next.questions.filter((q) => String(q.answer || "").trim()).length;
  return (
    <section aria-labelledby="next-call" className="rounded-md border border-hair bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="ms-kicker flex items-center gap-2"><PhoneCall className="h-3.5 w-3.5 text-[#ff3c00]" /> Our next call{when ? ` · ${when}` : ""}</p>
          <h2 id="next-call" className="mt-2 text-[24px] font-semibold tracking-[-0.035em] sm:text-[28px]">Questions for our next call</h2>
          <p className="mt-1 text-[13.5px] text-ink/55">Answer what you can ahead of time. It keeps the call short and focused on growth.</p>
        </div>
        <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-ink/45">{done} / {next.questions.length} answered</span>
      </div>
      <ol className="mt-4 grid gap-3 md:grid-cols-2">
        {next.questions.map((q) => <Question key={q.i} q={q} prepId={next.id} call={call} preview={preview} />)}
      </ol>
    </section>
  );
}
