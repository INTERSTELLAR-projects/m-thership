// Sign-up forms: drop on any website (iframe or plain HTML form), straight into a list with tags, optional double
// opt-in. Public submissions go to the email-signup function (rate limited, honeypot, consent checkbox).
import { useState } from "react";
import { ArrowLeft, ClipboardList, ExternalLink, Plus } from "lucide-react";
import { Badge, Btn, Card, CopyField, Empty, Label, Notice, Toggle, inputCls } from "./ui";
import { errMsg, num } from "./api";

const EXTRA = [["first_name", "First name"], ["last_name", "Last name"], ["phone", "Phone"], ["birthday", "Birthday"], ["zip", "ZIP code"]];

function embedHtml(f, business) {
  const fields = (f.fields || []).map((k) => `  <input name="${k}" placeholder="${EXTRA.find((e) => e[0] === k)?.[1] || k}">`).join("\n");
  return `<form action="${f.url}" method="POST">
  <input type="email" name="email" placeholder="Email" required>
${fields ? `${fields}\n` : ""}  <label><input type="checkbox" name="consent" value="yes" required> Yes, email me news and offers from ${business}.</label>
  <input type="text" name="website_hp" tabindex="-1" autocomplete="off" style="position:absolute;left:-5000px" aria-hidden="true">
  <button type="submit">${f.button_label || "Sign up"}</button>
</form>`;
}

function FormEditor({ form, data, call, onBack, onSaved }) {
  const [f, setF] = useState(() => ({ name: "Website sign-up", list_id: data.lists?.[0]?.id || "", tags: [], double_opt_in: true, fields: ["first_name"], heading: "", intro: "", button_label: "", consent_text: "", success_message: "", redirect_url: "", status: "active", ...form }));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [saved, setSaved] = useState(form?.id ? form : null);
  const [frameKey, setFrameKey] = useState(0);
  const set = (p) => setF({ ...f, ...p });
  const save = async () => {
    setBusy(true); setMsg(null);
    try {
      const r = await call("form_save", { id: saved?.id, form: f });
      const url = `${data.endpoints.signup}?f=${r.form.form_key}`;
      setSaved({ ...r.form, url }); setFrameKey((k) => k + 1); setMsg({ tone: "ok", text: "Saved. It's live: anyone with the link or embed can sign up." }); onSaved();
    } catch (e) { setMsg({ tone: "error", text: errMsg(e) }); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[13px] text-ink/60 hover:text-ink"><ArrowLeft className="h-4 w-4" /> Forms</button>
        <input value={f.name} onChange={(e) => set({ name: e.target.value })} className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-2 py-1 text-[20px] font-semibold tracking-[-0.03em] outline-none hover:border-hair focus:border-[#ff3c00] focus:bg-white" />
        <Btn kind="flame" busy={busy} onClick={save}>{saved ? "Save changes" : "Create form"}</Btn>
      </div>
      {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] [&>*]:min-w-0">
        <Card className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Sign-ups go to</Label><select className={inputCls} value={f.list_id} onChange={(e) => set({ list_id: e.target.value })}>{(data.lists || []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
            <div><Label hint="comma separated">Tag them</Label><input className={inputCls} value={(f.tags || []).join(", ")} onChange={(e) => set({ tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} placeholder="website" /></div>
          </div>
          <div><Label>Ask for</Label><div className="flex flex-wrap gap-2"><span className="rounded-full bg-ink px-3 py-1 text-[12.5px] font-medium text-white">Email (always)</span>{EXTRA.map(([k, l]) => { const on = f.fields.includes(k); return <button key={k} type="button" onClick={() => set({ fields: on ? f.fields.filter((x) => x !== k) : [...f.fields, k] })} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${on ? "border-[#ff3c00] bg-[#ff3c00]/10 text-[#c22d00]" : "border-hair text-ink/60"}`}>{l}</button>; })}</div></div>
          <div><Label>Heading</Label><input className={inputCls} value={f.heading} onChange={(e) => set({ heading: e.target.value })} placeholder={`Join the ${data.client?.business || ""} list`} /></div>
          <div><Label>Short intro</Label><input className={inputCls} value={f.intro} onChange={(e) => set({ intro: e.target.value })} placeholder="Seasonal tips and first dibs on openings. No spam." /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Button</Label><input className={inputCls} value={f.button_label} onChange={(e) => set({ button_label: e.target.value })} placeholder="Sign up" /></div>
            <div><Label>Thank-you message</Label><input className={inputCls} value={f.success_message} onChange={(e) => set({ success_message: e.target.value })} placeholder="You're on the list." /></div>
          </div>
          <div><Label>Consent checkbox text</Label><input className={inputCls} value={f.consent_text} onChange={(e) => set({ consent_text: e.target.value })} placeholder={`Yes, email me news and offers from ${data.client?.business || "us"}. I can unsubscribe at any time.`} /></div>
          <Toggle on={f.double_opt_in} onChange={(v) => set({ double_opt_in: v })} label="Double opt-in (recommended)" hint="New sign-ups get a confirm link first. Keeps fake and mistyped addresses off your list." />
          <Toggle on={f.status === "active"} onChange={(v) => set({ status: v ? "active" : "paused" })} label="Form is accepting sign-ups" />
          <p className="text-[11.5px] text-ink/45">Protected against bots: rate limits, a hidden honeypot field and a required consent checkbox.</p>
        </Card>
        <div className="space-y-4">
          {saved?.url ? (
            <>
              <Card pad={false} className="overflow-hidden"><div className="flex items-center justify-between border-b border-hair px-4 py-2.5"><p className="text-[12.5px] font-semibold text-ink/60">Live form</p><a href={saved.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[#ff3c00]">Open <ExternalLink className="h-3.5 w-3.5" /></a></div><iframe key={frameKey} title="Sign-up form" src={saved.url} className="h-[460px] w-full bg-[#f4f4f2]" /></Card>
              <Card className="space-y-4">
                <CopyField label="Link (share anywhere, or a QR code)" value={saved.url} />
                <CopyField label="Embed on your website (iframe)" multiline value={`<iframe src="${saved.url}" title="Sign up" style="width:100%;max-width:480px;height:460px;border:0"></iframe>`} />
                <CopyField label="Or a plain HTML form (styled by your site)" multiline value={embedHtml(saved, data.client?.business || "us")} />
              </Card>
            </>
          ) : <Empty icon={ClipboardList} title="Create the form to get its link and embed code" />}
        </div>
      </div>
    </div>
  );
}

export default function FormsTab({ data, call, refresh }) {
  const [edit, setEdit] = useState(null);
  if (!data.lists?.length) return <Empty icon={ClipboardList} title="Create a list first">Sign-up forms drop people straight into one of your lists. Add a list on the Contacts tab.</Empty>;
  if (edit) return <FormEditor form={edit === "new" ? null : edit} data={data} call={call} onBack={() => { setEdit(null); refresh(); }} onSaved={refresh} />;
  const forms = (data.forms || []).filter((f) => f.status !== "paused" || f.submissions);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-[18px] font-semibold tracking-[-0.03em]">Sign-up forms</h2><p className="text-[13px] text-ink/55">Grow your list from your website, Google profile, receipts or a QR code at the counter.</p></div>
        <Btn kind="flame" icon={Plus} onClick={() => setEdit("new")}>New form</Btn>
      </div>
      {forms.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {forms.map((f) => (
            <Card key={f.id}>
              <div className="flex items-start gap-3"><div className="min-w-0 flex-1"><p className="truncate text-[15px] font-semibold">{f.name}</p><p className="text-[12.5px] text-ink/55">Into {(data.lists || []).find((l) => l.id === f.list_id)?.name || "a list"}{f.double_opt_in ? " · double opt-in" : ""}</p></div><Badge tone={f.status === "active" ? "active" : "paused"}>{f.status === "active" ? "Live" : "Paused"}</Badge></div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center"><div className="rounded-lg bg-ink/[0.03] py-2"><p className="text-[20px] font-semibold tabular-nums">{num(f.submissions)}</p><p className="text-[11.5px] text-ink/50">sign-ups</p></div><div className="rounded-lg bg-ink/[0.03] py-2"><p className="text-[20px] font-semibold tabular-nums">{f.double_opt_in ? num(f.confirmations) : "–"}</p><p className="text-[11.5px] text-ink/50">confirmed</p></div></div>
              <div className="mt-4 flex gap-2"><Btn size="sm" kind="ghost" onClick={() => setEdit(f)}>Edit & embed</Btn><a href={f.url} target="_blank" rel="noreferrer" className="inline-flex h-8 items-center gap-1 rounded-md px-3 text-[12.5px] font-semibold text-[#ff3c00] hover:bg-[#ff3c00]/5">Open <ExternalLink className="h-3.5 w-3.5" /></a></div>
            </Card>
          ))}
        </div>
      ) : <Empty icon={ClipboardList} title="No forms yet" action={<Btn kind="flame" icon={Plus} onClick={() => setEdit("new")}>New form</Btn>}>Make one in under a minute and paste it into your website.</Empty>}
    </div>
  );
}
