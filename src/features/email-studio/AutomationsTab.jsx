// Automations: welcome series, review request after a job, win-back, birthday / anniversary, or any event from the
// client's own Command System (signed webhook). Steps are emails and waits. Pause / resume, per-step stats.
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Cake, Clock, Gift, Hand, Mail, Pause, Play, Plus, Star, Trash2, Webhook, Zap, Eye, PlugZap } from "lucide-react";
import { BlocksEditor, EmailPreview, SubjectField, AiDraft } from "./EmailEditor";
import { blockId } from "./clientEmail";
import { Badge, Btn, Card, ConfirmBtn, CopyField, Drawer, Empty, Label, Notice, inputCls } from "./ui";
import { errMsg, num, pct } from "./api";

const txt = (text) => ({ id: blockId(), type: "text", text });
const btn = (label, url) => ({ id: blockId(), type: "button", label, url });
const head = (text) => ({ id: blockId(), type: "heading", text });
const email = (subject, blocks) => ({ id: `s${Math.random().toString(36).slice(2, 8)}`, type: "email", subject, blocks });
const wait = (v, u = "days") => ({ id: `s${Math.random().toString(36).slice(2, 8)}`, type: "wait", wait_value: v, wait_unit: u });

export const TEMPLATES = [
  { kind: "welcome", icon: Hand, title: "Welcome series", desc: "Say hi when someone joins a list, then follow up two days later.", trigger: { type: "list_join", list_id: "" },
    steps: () => [email("Welcome to {{business}}, {{first_name}}!", [head("Welcome aboard"), txt("Hi {{first_name}},\n\nThanks for joining us. [ADD WHAT THEY CAN EXPECT FROM YOUR EMAILS]"), btn("[ADD BUTTON TEXT]", "")]), wait(2), email("A little more about us", [txt("Hi {{first_name}},\n\n[ADD A SHORT STORY OR TIP]")])] },
  { kind: "review_request", icon: Star, title: "Review request after a job", desc: "When your Command System marks a job done, ask for a Google review.", trigger: { type: "event", event_name: "job.completed" },
    steps: () => [wait(3, "hours"), email("How did we do, {{first_name}}?", [txt("Hi {{first_name}},\n\nThanks for choosing {{business}}. If you have a minute, a quick Google review helps other neighbors find us."), btn("Leave a review", "{{review_link}}"), txt("Thank you!")]), wait(4), email("Quick reminder: share your experience?", [txt("Hi {{first_name}}, just a friendly nudge in case you missed it."), btn("Leave a review", "{{review_link}}")])] },
  { kind: "win_back", icon: Zap, title: "Win-back", desc: "Reach out to customers you haven't heard from in a while.", trigger: { type: "inactive", months: 6, send_hour: 10 },
    steps: () => [email("We miss you, {{first_name}}", [txt("Hi {{first_name}},\n\nIt's been a while. [ADD A REASON TO COME BACK]"), btn("[ADD BUTTON TEXT]", "")])] },
  { kind: "birthday", icon: Cake, title: "Birthday", desc: "A short note on their birthday (needs a birthday on the contact).", trigger: { type: "date_field", field: "birthday", send_hour: 9 },
    steps: () => [email("Happy birthday, {{first_name}}!", [head("Happy birthday!"), txt("Hi {{first_name}},\n\nEveryone at {{business}} hopes you have a great day. [ADD A GIFT OR OFFER, OR DELETE THIS LINE]")])] },
  { kind: "anniversary", icon: Gift, title: "Customer anniversary", desc: "Thank people on the anniversary of their first job with you.", trigger: { type: "date_field", field: "anniversary", send_hour: 9 },
    steps: () => [email("Thanks for another year, {{first_name}}", [txt("Hi {{first_name}},\n\nA year ago you trusted us with your first job. Thank you. [ADD A THANK-YOU OFFER, OR DELETE THIS LINE]")])] },
];
const TPL = Object.fromEntries(TEMPLATES.map((t) => [t.kind, t]));

function triggerText(t, lists) {
  if (!t) return "";
  if (t.type === "list_join") return `When someone joins ${t.list_id ? `“${lists.find((l) => l.id === t.list_id)?.name || "a list"}”` : "any list"}`;
  if (t.type === "event") return `When your Command System sends “${t.event_name}”`;
  if (t.type === "inactive") return `When a customer has been quiet for ${t.months} months`;
  const h = Number(t.send_hour ?? 9);
  return `On their ${t.field}, around ${((h + 11) % 12) + 1}:00 ${h < 12 ? "AM" : "PM"}`;
}

function TriggerEditor({ t, set, lists, data }) {
  return (
    <div className="space-y-3">
      <select className={inputCls} value={t.type} onChange={(e) => set({ type: e.target.value, ...(e.target.value === "event" ? { event_name: "job.completed" } : e.target.value === "inactive" ? { months: 6 } : e.target.value === "date_field" ? { field: "birthday" } : {}) })}>
        <option value="list_join">Someone joins a list</option><option value="event">An event from my Command System</option><option value="inactive">A customer goes quiet</option><option value="date_field">Birthday or anniversary</option>
      </select>
      {t.type === "list_join" && <select className={inputCls} value={t.list_id || ""} onChange={(e) => set({ list_id: e.target.value })}><option value="">Any list</option>{lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>}
      {t.type === "event" && (
        <>
          <input className={`${inputCls} font-mono`} value={t.event_name || ""} onChange={(e) => set({ event_name: e.target.value })} placeholder="job.completed" />
          <div className="rounded-lg border border-hair bg-[#faf9f7] p-3 text-[12.5px] leading-relaxed text-ink/65">
            <p className="flex items-center gap-1.5 font-semibold text-ink"><PlugZap className="h-4 w-4 text-[#ff3c00]" /> Connected to your Command System</p>
            <p className="mt-1">Your system sends a signed message to Email Studio when this happens (e.g. a job is marked complete). Interstellar sets up the connection.</p>
            <p className="mt-2">Status: {data.settings?.trigger_configured ? <span className="font-semibold text-green-700">key in place</span> : <span className="font-semibold text-amber-700">waiting on Interstellar to add the key</span>}</p>
          </div>
        </>
      )}
      {t.type === "inactive" && <div className="flex items-center gap-2 text-[13.5px]">No opens, clicks or jobs for <input type="number" min={1} max={36} className={`${inputCls} !w-20`} value={t.months || 6} onChange={(e) => set({ months: Number(e.target.value) })} /> months</div>}
      {t.type === "date_field" && <select className={inputCls} value={t.field || "birthday"} onChange={(e) => set({ field: e.target.value })}><option value="birthday">Birthday</option><option value="anniversary">Anniversary / customer since</option></select>}
      {["inactive", "date_field"].includes(t.type) && <div className="flex items-center gap-2 text-[13.5px]">Send around <select className={`${inputCls} !w-28`} value={t.send_hour ?? 9} onChange={(e) => set({ send_hour: Number(e.target.value) })}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{((h + 11) % 12) + 1}:00 {h < 12 ? "AM" : "PM"}</option>)}</select> your time</div>}
    </div>
  );
}

function AutomationEditor({ a, data, call, onBack, onSaved }) {
  const [x, setX] = useState(() => ({ name: a.name, kind: a.kind, trigger: a.trigger || { type: "list_join" }, steps: a.steps || [], reenroll_days: a.reenroll_days || 0 }));
  const [open, setOpen] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const stats = useQuery({ queryKey: ["email-auto", a.id], queryFn: () => call("automation_get", { id: a.id }), enabled: !!a.id });
  const [status, setStatus] = useState(a.status || "draft");
  const setStep = (i, p) => setX({ ...x, steps: x.steps.map((s, j) => (j === i ? { ...s, ...p } : s)) });
  const save = async () => {
    setBusy(true); setMsg(null);
    try { const r = await call("automation_save", { id: a.id, automation: x }); setMsg({ tone: "ok", text: "Saved." }); onSaved(r.automation); stats.refetch(); return r.automation; } catch (e) { setMsg({ tone: "error", text: errMsg(e) }); return null; } finally { setBusy(false); }
  };
  const flip = async (to) => {
    const saved = await save();
    if (!saved) return;
    try { const r = await call("automation_status", { id: saved.id, status: to }); setStatus(r.automation.status); setMsg({ tone: "ok", text: to === "active" ? "It's on. New people who match start right away (checked every 5 minutes)." : "Paused. Nobody moves forward until you turn it back on." }); onSaved(r.automation); } catch (e) { setMsg({ tone: "error", text: errMsg(e) }); }
  };
  const st = stats.data?.steps || {};
  const step = open != null ? x.steps[open] : null;
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] text-ink/60 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Automations</button>
        <input value={x.name} onChange={(e) => setX({ ...x, name: e.target.value })} className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-[20px] font-semibold tracking-[-0.03em] outline-none hover:border-hair focus:border-[#ff3c00] focus:bg-white" />
        <Badge tone={status === "active" ? "active" : status === "paused" ? "paused" : "draft"}>{status === "active" ? "On" : status}</Badge>
        <Btn kind="ghost" busy={busy} onClick={save}>Save</Btn>
        {status === "active" ? <Btn kind="ghost" icon={Pause} onClick={() => flip("paused")}>Pause</Btn> : <Btn kind="flame" icon={Play} onClick={() => flip("active")}>Turn on</Btn>}
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] [&>*]:min-w-0">
        <Card>
          <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[#ff3c00]">Trigger</p>
          <div className="mt-3"><TriggerEditor t={x.trigger} set={(p) => setX({ ...x, trigger: { ...x.trigger, ...p } })} lists={data.lists || []} data={data} /></div>
          {stats.data && (
            <div className="mt-5 grid grid-cols-3 gap-2 border-t border-hair pt-4 text-center">
              {[["In progress", stats.data.enrollments.active], ["Finished", stats.data.enrollments.done], ["Left early", stats.data.enrollments.exited]].map(([l, v]) => <div key={l}><p className="text-[22px] font-semibold tabular-nums">{num(v)}</p><p className="text-[11.5px] text-ink/50">{l}</p></div>)}
            </div>
          )}
        </Card>
        <div className="relative space-y-0">
          {x.steps.map((s, i) => (
            <div key={s.id} className="relative pl-9">
              <span className="absolute left-[13px] top-0 h-full w-px bg-hair" />
              <span className={`absolute left-0 top-3 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white ${s.type === "wait" ? "bg-ink/10 text-ink/60" : "bg-[#ff3c00] text-white"}`}>{s.type === "wait" ? <Clock className="h-3.5 w-3.5" /> : <Mail className="h-3.5 w-3.5" />}</span>
              {s.type === "wait" ? (
                <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-hair bg-white/70 px-4 py-3 text-[13.5px]">
                  Wait <input type="number" min={1} className={`${inputCls} !w-20`} value={s.wait_value} onChange={(e) => setStep(i, { wait_value: Number(e.target.value) })} />
                  <select className={`${inputCls} !w-28`} value={s.wait_unit} onChange={(e) => setStep(i, { wait_unit: e.target.value })}><option value="hours">hours</option><option value="days">days</option></select>
                  <button type="button" aria-label="Remove step" onClick={() => setX({ ...x, steps: x.steps.filter((_, j) => j !== i) })} className="ml-auto rounded p-1.5 text-ink/40 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                </div>
              ) : (
                <div className="mb-3 rounded-xl border border-hair bg-white p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1"><p className="truncate text-[14.5px] font-semibold">{s.subject || "Untitled email"}</p><p className="text-[12px] text-ink/50">{(s.blocks || []).length} blocks{JSON.stringify(s.blocks || []).includes("[ADD") ? " · has [PLACEHOLDERS] to fill in" : ""}</p></div>
                    <Btn size="sm" kind="ghost" onClick={() => setOpen(i)}>Edit</Btn>
                    <button type="button" aria-label="Remove step" onClick={() => setX({ ...x, steps: x.steps.filter((_, j) => j !== i) })} className="rounded p-1.5 text-ink/40 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
                  </div>
                  {st[s.id] && <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-hair pt-2.5 text-[12.5px] text-ink/60"><span><b className="text-ink">{num(st[s.id].sent)}</b> sent</span><span><b className="text-ink">{pct(st[s.id].open_rate)}</b> opened</span><span><b className="text-ink">{pct(st[s.id].click_rate)}</b> clicked</span><span>{num(st[s.id].unsubscribes)} unsubscribed</span></div>}
                </div>
              )}
            </div>
          ))}
          <div className="flex gap-2 pl-9">
            <Btn size="sm" kind="ghost" icon={Mail} onClick={() => setX({ ...x, steps: [...x.steps, email("", [txt("Hi {{first_name}},\n\n")])] })}>Add email</Btn>
            <Btn size="sm" kind="ghost" icon={Clock} onClick={() => setX({ ...x, steps: [...x.steps, wait(1)] })}>Add wait</Btn>
          </div>
        </div>
      </div>
      <Drawer open={!!step} onClose={() => setOpen(null)} title="Edit email" wide footer={<div className="flex justify-end"><Btn kind="ink" onClick={() => setOpen(null)}>Done</Btn></div>}>
        {step && (
          <div className="space-y-4">
            <SubjectField value={step.subject} onChange={(subject) => setStep(open, { subject })} />
            <AiDraft call={call} purpose={x.kind} onDraft={(r) => setStep(open, { subject: step.subject || r.subject, blocks: r.blocks })} />
            <BlocksEditor blocks={step.blocks || []} onChange={(blocks) => setStep(open, { blocks })} />
            <EmailPreview subject={step.subject} blocks={step.blocks || []} theme={data.theme} height={520} />
          </div>
        )}
      </Drawer>
    </div>
  );
}

export default function AutomationsTab({ data, call, refresh }) {
  const [edit, setEdit] = useState(null);
  const [err, setErr] = useState("");
  const autos = data.automations || [];
  const start = async (t) => {
    setErr("");
    try {
      const trigger = { ...t.trigger, ...(t.trigger.type === "list_join" ? { list_id: data.lists?.[0]?.id || "" } : {}) };
      const r = await call("automation_save", { automation: { name: t.title, kind: t.kind, trigger, steps: t.steps() } });
      refresh(); setEdit(r.automation);
    } catch (e) { setErr(errMsg(e)); }
  };
  if (edit) return <AutomationEditor key={edit.id} a={edit} data={data} call={call} onBack={() => { setEdit(null); refresh(); }} onSaved={() => refresh()} />;
  return (
    <div className="space-y-6">
      {err && <Notice tone="error">{err}</Notice>}
      {autos.length > 0 && (
        <div className="space-y-2.5">
          <h2 className="text-[18px] font-semibold tracking-[-0.03em]">Your automations</h2>
          {autos.map((a) => {
            const I = TPL[a.kind]?.icon || Webhook;
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-hair bg-white px-4 py-3.5">
                <span className={`flex h-10 w-10 items-center justify-center rounded-lg ${a.status === "active" ? "bg-[#ff3c00] text-white" : "bg-ink/[0.06] text-ink/50"}`}><I className="h-5 w-5" /></span>
                <div className="min-w-0 flex-1 basis-52"><p className="truncate text-[15px] font-semibold">{a.name}</p><p className="truncate text-[12.5px] text-ink/55">{triggerText(a.trigger, data.lists || [])} · {(a.steps || []).filter((s) => s.type === "email").length} emails</p></div>
                <span className="text-[12.5px] tabular-nums text-ink/55">{num(a.enrolled_count)} started · {num(a.completed_count)} finished</span>
                <Badge tone={a.status === "active" ? "active" : a.status === "paused" ? "paused" : "draft"}>{a.status === "active" ? "On" : a.status}</Badge>
                <Btn size="sm" kind="ghost" icon={Eye} onClick={() => setEdit(a)}>Open</Btn>
                {a.status === "draft" && !a.enrolled_count && <ConfirmBtn size="sm" kind="ghost" confirmLabel="Delete" onConfirm={async () => { await call("automation_delete", { id: a.id }); refresh(); }}>Delete</ConfirmBtn>}
              </div>
            );
          })}
        </div>
      )}
      <div>
        <h2 className="text-[18px] font-semibold tracking-[-0.03em]">{autos.length ? "Add another" : "Set it once. It runs every day."}</h2>
        <p className="mt-0.5 text-[13px] text-ink/55">Start from a template, then make it yours. Nothing sends until you turn it on.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((t) => (
            <button key={t.kind} type="button" onClick={() => start(t)} className="group flex flex-col items-start rounded-xl border border-hair bg-white p-4 text-left transition-all hover:-translate-y-0.5 hover:border-[#ff3c00] hover:shadow-[0_14px_30px_-20px_rgba(255,60,0,.6)]">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#ff3c00]/10 text-[#ff3c00] group-hover:bg-[#ff3c00] group-hover:text-white"><t.icon className="h-5 w-5" /></span>
              <span className="mt-3 text-[15px] font-semibold">{t.title}</span>
              <span className="mt-1 text-[12.5px] leading-snug text-ink/55">{t.desc}</span>
              <span className="mt-3 inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#ff3c00]"><Plus className="h-3.5 w-3.5" /> Use template</span>
            </button>
          ))}
        </div>
      </div>
      {!autos.length && <Empty icon={Webhook} title="Your Command System can trigger these too">When a job is completed, a quote is accepted or a customer is added in your own system, Email Studio can start the right emails automatically.</Empty>}
      {data.settings && (
        <Card className="bg-[#faf9f7]">
          <p className="flex items-center gap-2 text-[14px] font-semibold"><PlugZap className="h-4 w-4 text-[#ff3c00]" /> Command System connection</p>
          <p className="mt-1 text-[12.5px] text-ink/55">For Interstellar (and your developer): events are posted, signed, to this address.</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2"><CopyField label="Trigger address" value={data.endpoints?.hook || ""} /><div><Label>Signing key</Label><p className="rounded-md border border-hair bg-white px-3 py-2.5 font-mono text-[12px]">{data.settings.trigger_secret_name} · {data.settings.trigger_configured ? <span className="text-green-700">set</span> : <span className="text-amber-700">not set yet</span>}</p></div></div>
        </Card>
      )}
    </div>
  );
}
