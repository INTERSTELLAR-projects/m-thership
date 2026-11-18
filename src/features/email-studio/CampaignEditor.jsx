// Campaign editor: 1 Write -> 2 Audience -> 3 Send (now / schedule / in each subscriber's time zone).
// Nothing sends without an explicit final click; a test always goes to the signed-in login only.
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, CalendarClock, Check, FlaskConical, Mail, Rocket, Save, Users } from "lucide-react";
import { BlocksEditor, EmailPreview, SubjectField, AiDraft } from "./EmailEditor";
import { Btn, Card, Label, Notice, Segmented, Toggle, inputCls } from "./ui";
import { errMsg, num, localInput, TIMEZONES, fmtWhen } from "./api";

const STEPS = [["write", "Write", Mail], ["audience", "Audience", Users], ["send", "Send", Rocket]];

export default function CampaignEditor({ campaign, data, call, onClose, onSaved, onSent }) {
  const [step, setStep] = useState("write");
  const [c, setC] = useState(() => ({ name: campaign.name || "", subject: campaign.subject || "", blocks: campaign.blocks || [], audience: { list_ids: [], segment_id: "", exclude_segment_id: "", ...(campaign.audience || {}) } }));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const [count, setCount] = useState(null);
  const [mode, setMode] = useState("now");
  const tz0 = data.settings?.timezone || "America/Los_Angeles";
  const [when, setWhen] = useState(() => localInput(24 * 60, tz0).slice(0, 11) + "09:00");
  const [tz, setTz] = useState(tz0);
  const [theirTz, setTheirTz] = useState(false);
  const [armed, setArmed] = useState(false);
  const [sending, setSending] = useState(false);
  const dirty = useRef(false);
  const upd = (patch) => { dirty.current = true; setC((x) => ({ ...x, ...patch })); };
  const setAud = (patch) => upd({ audience: { ...c.audience, ...patch } });

  const save = async (quiet) => {
    setSaving(true);
    try {
      const r = await call("campaign_save", { id: campaign.id, ...c });
      dirty.current = false;
      if (!quiet) setMsg({ tone: "ok", text: "Draft saved." });
      onSaved?.(r.campaign);
      return r.campaign;
    } catch (e) { setMsg({ tone: "error", text: errMsg(e) }); return null; } finally { setSaving(false); }
  };
  // Autosave drafts every 20 seconds while editing.
  useEffect(() => { const t = setInterval(() => { if (dirty.current) save(true); }, 20000); return () => clearInterval(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [c]);

  const audKey = JSON.stringify(c.audience);
  useEffect(() => {
    let live = true;
    setCount(null);
    const t = setTimeout(async () => {
      try { const r = await call("audience_count", { audience: c.audience }); if (live) setCount(r); } catch (e) { if (live) setCount({ error: errMsg(e) }); }
    }, 350);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audKey]);

  const test = async () => {
    const saved = await save(true);
    if (!saved) return;
    setMsg(null);
    try { const r = await call("campaign_send_test", { id: campaign.id }); setMsg({ tone: "ok", text: `Test sent to ${r.to} (subject starts with [TEST]).` }); }
    catch (e) { setMsg({ tone: "error", text: errMsg(e) }); }
  };
  const send = async () => {
    if (!armed) { setArmed(true); return; }
    const saved = await save(true);
    if (!saved) return;
    setSending(true); setMsg(null);
    try {
      const r = await call("campaign_schedule", { id: campaign.id, when: mode === "now" ? "now" : "schedule", send_local: when, send_tz: tz, tz_mode: theirTz ? "subscriber" : "fixed" });
      onSent?.(r);
    } catch (e) { setMsg({ tone: "error", text: errMsg(e) }); setArmed(false); } finally { setSending(false); }
  };

  const ready = data.readiness?.ready;
  const sendable = count?.counts?.sendable ?? 0;
  const canSend = ready && c.subject.trim() && c.blocks.length && sendable > 0;
  const lists = data.lists || [];
  const listName = useMemo(() => Object.fromEntries(lists.map((l) => [l.id, l.name])), [lists]);

  return (
    <div className="space-y-5" data-campaign-editor>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={async () => { if (dirty.current) await save(true); onClose(); }} className="inline-flex items-center gap-1.5 text-[13px] text-ink/60 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Campaigns</button>
        <input value={c.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Campaign name (only you see this)" className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-[20px] font-semibold tracking-[-0.03em] outline-none hover:border-hair focus:border-[#ff3c00] focus:bg-white" />
        <Btn kind="ghost" icon={Save} busy={saving} onClick={() => save(false)}>Save draft</Btn>
      </div>

      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-hair bg-white p-1" aria-label="Campaign steps">
        {STEPS.map(([k, l, I], i) => (
          <button key={k} type="button" onClick={() => setStep(k)} className={`flex flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-[13.5px] font-semibold transition-colors ${step === k ? "bg-ink text-white" : "text-ink/55 hover:bg-ink/[0.04] hover:text-ink"}`}>
            <span className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${step === k ? "bg-[#ff3c00] text-white" : "bg-ink/[0.07]"}`}>{i + 1}</span>
            <I className="hidden h-4 w-4 sm:block" /> {l}
          </button>
        ))}
      </nav>

      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}

      {step === "write" && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] [&>*]:min-w-0">
          <div className="space-y-4">
            <SubjectField value={c.subject} onChange={(subject) => upd({ subject })} />
            <AiDraft call={call} onDraft={(r) => upd({ subject: c.subject || r.subject, blocks: r.blocks })} />
            <BlocksEditor blocks={c.blocks} onChange={(blocks) => upd({ blocks })} />
            <div className="flex justify-end"><Btn kind="ink" onClick={() => setStep("audience")}>Next: audience</Btn></div>
          </div>
          <div className="lg:sticky lg:top-4 lg:self-start"><EmailPreview subject={c.subject} blocks={c.blocks} theme={data.theme} /></div>
        </div>
      )}

      {step === "audience" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)] [&>*]:min-w-0">
          <Card>
            <h3 className="text-[16px] font-semibold tracking-[-0.02em]">Who gets it?</h3>
            <p className="mt-1 text-[13px] text-ink/55">Pick one or more lists, a segment, or both (then only people in both get it).</p>
            <div className="mt-4 space-y-2">
              <Label>Lists</Label>
              {lists.length ? lists.map((l) => {
                const on = c.audience.list_ids.includes(l.id);
                return (
                  <label key={l.id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3 transition-colors ${on ? "border-[#ff3c00] bg-[#ff3c00]/[0.04]" : "border-hair hover:border-ink/30"}`}>
                    <input type="checkbox" checked={on} onChange={() => setAud({ list_ids: on ? c.audience.list_ids.filter((x) => x !== l.id) : [...c.audience.list_ids, l.id] })} className="h-4 w-4 accent-[#ff3c00]" />
                    <span className="flex-1 text-[14px] font-medium">{l.name}</span>
                    <span className="text-[12.5px] tabular-nums text-ink/50">{num(l.subscribed)} subscribed</span>
                  </label>
                );
              }) : <p className="text-[13px] text-ink/50">No lists yet. Add contacts first.</p>}
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Only people in segment</Label>
                <select className={inputCls} value={c.audience.segment_id} onChange={(e) => setAud({ segment_id: e.target.value })}>
                  <option value="">No segment filter</option>
                  {(data.segments || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <Label>Leave out segment</Label>
                <select className={inputCls} value={c.audience.exclude_segment_id} onChange={(e) => setAud({ exclude_segment_id: e.target.value })}>
                  <option value="">Nobody</option>
                  {(data.segments || []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            </div>
          </Card>
          <Card className="bg-ink text-white">
            <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/50">This email goes to</p>
            <p className="mt-2 text-[56px] font-semibold leading-none tracking-[-0.05em] tabular-nums">{count == null ? "…" : num(sendable)}</p>
            <p className="mt-1 text-[14px] text-white/70">{sendable === 1 ? "person" : "people"}</p>
            {count?.error ? <p className="mt-4 text-[13px] text-[#ffaa00]">{count.error}</p> : count?.counts && (
              <ul className="mt-5 space-y-1.5 text-[12.5px] text-white/60">
                <li>{num(count.counts.matched)} match this audience</li>
                {count.counts.unsubscribed > 0 && <li>{num(count.counts.unsubscribed)} unsubscribed: skipped</li>}
                {count.counts.pending > 0 && <li>{num(count.counts.pending)} haven&apos;t confirmed yet: skipped</li>}
                {count.counts.suppressed > 0 && <li>{num(count.counts.suppressed)} on your do-not-send list: skipped</li>}
              </ul>
            )}
            {c.audience.list_ids.length > 0 && <p className="mt-5 text-[12px] text-white/45">Lists: {c.audience.list_ids.map((id) => listName[id]).filter(Boolean).join(", ")}</p>}
            <Btn kind="flame" className="mt-6 w-full" onClick={() => setStep("send")} disabled={!sendable}>Next: send</Btn>
          </Card>
        </div>
      )}

      {step === "send" && (
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] [&>*]:min-w-0">
          <Card>
            <h3 className="text-[16px] font-semibold tracking-[-0.02em]">When should it go?</h3>
            <div className="mt-3"><Segmented value={mode} onChange={(v) => { setMode(v); setArmed(false); }} options={[["now", "Send now"], ["schedule", "Schedule"]]} /></div>
            {mode === "schedule" && (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div><Label htmlFor="sendwhen">Date and time</Label><input id="sendwhen" type="datetime-local" className={inputCls} value={when} onChange={(e) => { setWhen(e.target.value); setArmed(false); }} /></div>
                  <div><Label htmlFor="sendtz">Time zone</Label><select id="sendtz" className={inputCls} value={tz} onChange={(e) => setTz(e.target.value)}>{TIMEZONES.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}</select></div>
                </div>
                <Toggle on={theirTz} onChange={setTheirTz} label="Send at this time in each subscriber's time zone" hint="9:00 AM in New York goes out before 9:00 AM in Los Angeles. People without a known time zone get your time zone." />
              </div>
            )}
            <div className="mt-6 border-t border-hair pt-5">
              <p className="text-[13px] text-ink/60">Check it in your own inbox first:</p>
              <Btn kind="ghost" icon={FlaskConical} className="mt-2" onClick={test}>Send me a test</Btn>
            </div>
          </Card>
          <Card>
            <h3 className="text-[16px] font-semibold tracking-[-0.02em]">Final check</h3>
            <ul className="mt-3 space-y-2.5 text-[13.5px]">
              {[
                [!!c.subject.trim(), `Subject: ${c.subject || "missing"}`],
                [c.blocks.length > 0, `${c.blocks.length} content block${c.blocks.length === 1 ? "" : "s"}`],
                [sendable > 0, `${num(sendable)} recipients`],
                [!JSON.stringify(c.blocks).includes("[ADD") && !c.subject.includes("[ADD"), "No [PLACEHOLDERS] left to fill in"],
                [!!data.settings?.physical_address, "Mailing address + unsubscribe link in the footer"],
              ].map(([ok, t]) => (
                <li key={t} className="flex items-start gap-2.5"><span className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ${ok ? "bg-green-600 text-white" : "bg-amber-400 text-white"}`}><Check className="h-3 w-3" /></span><span className={ok ? "" : "text-amber-800"}>{t}</span></li>
              ))}
            </ul>
            {!ready && <Notice tone="warn"><span className="font-semibold">Not ready to send yet.</span> {data.readiness?.reason}</Notice>}
            <Btn kind={armed ? "flame" : "ink"} size="lg" className="mt-5 w-full" icon={mode === "now" ? Rocket : CalendarClock} busy={sending} disabled={!canSend} onClick={send}>
              {armed ? (mode === "now" ? `Yes, send to ${num(sendable)} now` : `Yes, schedule for ${num(sendable)}`) : mode === "now" ? "Send now" : `Schedule for ${fmtWhen(new Date(when).toISOString()) || "…"}`}
            </Btn>
            {armed && <p className="mt-2 text-center text-[12px] text-ink/50">Click once more to confirm. <button type="button" className="underline" onClick={() => setArmed(false)}>Not yet</button></p>}
            {mode === "schedule" && <p className="mt-3 text-[12px] text-ink/50">You can cancel or move it any time before it sends.</p>}
          </Card>
        </div>
      )}
    </div>
  );
}
