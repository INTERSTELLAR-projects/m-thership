// Email Studio settings: CAN-SPAM mailing address, time zone, sender, review link, brand overrides (with a contrast
// check against white), sending status.
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Save } from "lucide-react";
import { contrast, isHex } from "./clientEmail";
import { Btn, Card, Label, Notice, inputCls } from "./ui";
import { errMsg, TIMEZONES } from "./api";

export default function SettingsTab({ data, call, refresh }) {
  const s0 = data.settings || {};
  const [s, setS] = useState(() => ({ physical_address: s0.physical_address || "", timezone: s0.timezone || "America/Los_Angeles", from_name: s0.from_name || "", reply_to: s0.reply_to || "", review_link: s0.review_link || "", footer_note: s0.footer_note || "", brand: { primary: "", accent: "", logo_url: "", ...(s0.brand || {}) } }));
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const set = (p) => setS({ ...s, ...p });
  const setB = (p) => setS({ ...s, brand: { ...s.brand, ...p } });
  const primary = isHex(s.brand.primary) ? s.brand.primary : data.theme?.primary || "#111111";
  const c = useMemo(() => contrast(primary, "#ffffff"), [primary]);
  const save = async () => {
    setBusy(true); setMsg(null);
    try { await call("settings_save", { settings: s }); setMsg({ tone: "ok", text: "Saved." }); refresh(); } catch (e) { setMsg({ tone: "error", text: errMsg(e) }); } finally { setBusy(false); }
  };
  const r = data.readiness || {};
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)] [&>*]:min-w-0">
      <div className="space-y-5">
        {msg && <Notice tone={msg.tone}>{msg.text}</Notice>}
        <Card className="space-y-4">
          <div>
            <Label hint="required by law (CAN-SPAM)">Business mailing address</Label>
            <input className={inputCls} value={s.physical_address} onChange={(e) => set({ physical_address: e.target.value })} placeholder="Street, city, state ZIP (a PO box is fine)" />
            <p className="mt-1 text-[11.5px] text-ink/45">Shown in the footer of every email, next to the unsubscribe link.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Sender name</Label><input className={inputCls} value={s.from_name} onChange={(e) => set({ from_name: e.target.value })} placeholder={data.client?.business} /></div>
            <div><Label>Replies go to</Label><input className={inputCls} value={s.reply_to} onChange={(e) => set({ reply_to: e.target.value })} placeholder="you@yourbusiness.com" /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Your time zone</Label><select className={inputCls} value={s.timezone} onChange={(e) => set({ timezone: e.target.value })}>{TIMEZONES.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}</select></div>
            <div><Label hint="{{review_link}}">Google review link</Label><input className={inputCls} value={s.review_link} onChange={(e) => set({ review_link: e.target.value })} placeholder="https://g.page/r/…/review" /></div>
          </div>
          <div><Label>Extra footer line (optional)</Label><input className={inputCls} value={s.footer_note} onChange={(e) => set({ footer_note: e.target.value })} placeholder="e.g. Licensed & insured · CCB #000000" /></div>
        </Card>
        <Card className="space-y-4">
          <p className="text-[14px] font-semibold">Brand</p>
          <p className="-mt-2 text-[12.5px] text-ink/55">Pulled from your brand kit. Override here if you want something different in emails.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[["primary", "Main color (buttons, top bar)"], ["accent", "Accent color"]].map(([k, l]) => (
              <div key={k}><Label>{l}</Label><div className="flex gap-2"><input type="color" aria-label={l} value={isHex(s.brand[k]) && s.brand[k].length === 7 ? s.brand[k] : (k === "primary" ? data.theme?.primary : data.theme?.accent) || "#111111"} onChange={(e) => setB({ [k]: e.target.value })} className="h-[42px] w-12 cursor-pointer rounded-md border border-hair bg-white p-1" /><input className={`${inputCls} font-mono`} value={s.brand[k]} onChange={(e) => setB({ [k]: e.target.value })} placeholder={(k === "primary" ? data.theme?.primary : data.theme?.accent) || "#"} /></div></div>
            ))}
          </div>
          <div><Label>Logo image link</Label><input className={inputCls} value={s.brand.logo_url} onChange={(e) => setB({ logo_url: e.target.value })} placeholder="https://… (PNG, about 400px wide)" /></div>
          <div className="flex items-center gap-3 rounded-lg border border-hair bg-[#faf9f7] p-3">
            <span className="flex h-10 items-center rounded-md px-4 text-[13.5px] font-bold" style={{ background: primary, color: contrast(primary, "#ffffff") >= contrast(primary, "#111111") ? "#fff" : "#111" }}>Book now</span>
            {c >= 3 ? <span className="flex items-center gap-1.5 text-[12.5px] text-green-800"><CheckCircle2 className="h-4 w-4" /> Readable on white</span> : <span className="flex items-center gap-1.5 text-[12.5px] text-amber-800"><AlertTriangle className="h-4 w-4" /> Light color: we&apos;ll use dark text on buttons and a darker shade for links.</span>}
          </div>
        </Card>
        <div className="flex justify-end"><Btn kind="flame" icon={Save} busy={busy} onClick={save}>Save settings</Btn></div>
      </div>
      <div className="space-y-4">
        <Card>
          <p className="text-[14px] font-semibold">Sending</p>
          <div className="mt-3">{r.ready ? <Notice tone={r.dry_run ? "test" : "ok"}>{r.dry_run ? r.reason : "Ready. Emails go out from your own domain."}</Notice> : <Notice tone="warn">{r.reason}</Notice>}</div>
          <ul className="mt-4 space-y-2 text-[12.5px] text-ink/60">
            <li>• Every email: your mailing address + one-click unsubscribe.</li>
            <li>• Unsubscribes, bounces and spam reports are blocked from future sends automatically.</li>
            <li>• Monthly sends are included in your plan (fuel).</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
