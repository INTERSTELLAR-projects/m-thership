// CSV import: 1 file -> 2 match columns -> 3 check + consent -> 4 import (500 rows per call) -> summary.
// Consent is required (how these people agreed to hear from you) and recorded on every contact with the source.
import { useMemo, useRef, useState } from "react";
import { Check, FileUp, Loader2, ShieldCheck, Upload } from "lucide-react";
import { parseCsvRows } from "./merge";
import { Btn, Drawer, Label, Notice, Toggle, inputCls } from "./ui";
import { errMsg, num } from "./api";

const TARGETS = [["", "Skip this column"], ["email", "Email"], ["first_name", "First name"], ["last_name", "Last name"], ["name", "Full name"], ["phone", "Phone"], ["tags", "Tags"], ["city", "City"], ["state", "State"], ["zip", "ZIP"], ["country", "Country"], ["timezone", "Time zone"], ["birthday", "Birthday"], ["anniversary", "Anniversary / customer since"], ["custom", "Custom field"]];
const GUESS = { email: ["email", "email_address", "e_mail", "mail"], first_name: ["first_name", "first", "firstname", "given_name"], last_name: ["last_name", "last", "lastname", "surname"], name: ["name", "full_name", "fullname", "customer", "customer_name"], phone: ["phone", "phone_number", "mobile", "cell"], tags: ["tags", "tag", "labels"], city: ["city", "town"], state: ["state", "province", "region"], zip: ["zip", "zipcode", "zip_code", "postal_code", "postcode"], country: ["country"], timezone: ["timezone", "time_zone", "tz"], birthday: ["birthday", "birth_date", "dob", "date_of_birth"], anniversary: ["anniversary", "customer_since", "first_job_date"] };
const slug = (h) => String(h).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const isEmail = (e) => /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i.test(String(e || "").trim());

export default function ImportWizard({ open, onClose, data, call, onDone }) {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState(null);
  const [csv, setCsv] = useState({ headers: [], rows: [] });
  const [map, setMap] = useState([]); // per column: target key
  const [check, setCheck] = useState(null);
  const [listId, setListId] = useState(data.lists?.[0]?.id || "");
  const [newList, setNewList] = useState("");
  const [tags, setTags] = useState("");
  const [update, setUpdate] = useState(false);
  const [auto, setAuto] = useState(false);
  const [basis, setBasis] = useState("");
  const [source, setSource] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");
  const input = useRef(null);

  const reset = () => { setStep(1); setFile(null); setCsv({ headers: [], rows: [] }); setMap([]); setCheck(null); setResult(null); setProgress(null); setErr(""); setConfirm(false); };
  const load = async (f) => {
    setErr("");
    if (!f) return;
    if (f.size > 15 * 1024 * 1024) { setErr("That file is over 15 MB. Split it into smaller files."); return; }
    const text = await f.text();
    const parsed = parseCsvRows(text);
    if (!parsed.headers.length || !parsed.rows.length) { setErr("We couldn't find any rows. Export your contacts as a CSV with a header row."); return; }
    setFile(f); setCsv(parsed);
    const used = new Set();
    setMap(parsed.headers.map((h) => { const s = slug(h); const k = Object.keys(GUESS).find((t) => !used.has(t) && GUESS[t].includes(s)); if (k) { used.add(k); return k; } return ""; }));
    setStep(2);
  };
  const emailCol = map.indexOf("email");
  const stats = useMemo(() => {
    if (emailCol < 0) return null;
    const seen = new Set(); let valid = 0, invalid = 0, dupes = 0;
    for (const r of csv.rows) { const e = String(r[emailCol] || "").trim().toLowerCase(); if (!isEmail(e)) { invalid++; continue; } if (seen.has(e)) { dupes++; continue; } seen.add(e); valid++; }
    return { valid, invalid, dupes, emails: [...seen] };
  }, [csv, emailCol]);

  const toCheck = async () => {
    setErr("");
    try { setCheck(await call("import_check", { emails: stats.emails })); setStep(3); } catch (e) { setErr(errMsg(e)); }
  };
  const run = async () => {
    setErr("");
    try {
      let target = listId;
      if (listId === "__new") { if (!newList.trim()) { setErr("Name the new list."); return; } target = (await call("list_save", { name: newList.trim() })).list.id; }
      const mapping = {}; const custom = {};
      map.forEach((t, i) => { if (t === "custom") custom[slug(csv.headers[i]) || `field_${i}`] = i; else if (t) mapping[t] = i; });
      const total = { created: 0, updated: 0, unchanged: 0, invalid: 0, duplicates: 0, suppressed: 0, kept_unsubscribed: 0, enrolled: 0 };
      let seen = [];
      for (let i = 0; i < csv.rows.length; i += 500) {
        setProgress({ done: i, of: csv.rows.length });
        const r = await call("import", { rows: csv.rows.slice(i, i + 500), mapping, custom, list_id: target, tags: tags.split(",").map((x) => x.trim()).filter(Boolean), update_existing: update, start_automations: auto, consent: { basis, source, confirm }, file_name: file?.name, seen });
        seen = r.seen || seen;
        for (const k of Object.keys(total)) total[k] += Number(r[k]) || 0;
      }
      setProgress({ done: csv.rows.length, of: csv.rows.length });
      setResult(total); setStep(4); onDone?.();
    } catch (e) { setErr(errMsg(e)); setProgress(null); }
  };

  return (
    <Drawer open={open} onClose={() => { reset(); onClose(); }} title="Import contacts" wide footer={
      step === 2 ? <div className="flex justify-between gap-2"><Btn kind="ghost" onClick={() => setStep(1)}>Back</Btn><Btn kind="ink" disabled={emailCol < 0 || !stats?.valid} onClick={toCheck}>Next: check & consent</Btn></div>
        : step === 3 ? <div className="flex justify-between gap-2"><Btn kind="ghost" onClick={() => setStep(2)}>Back</Btn><Btn kind="flame" icon={Upload} busy={!!progress} disabled={!basis || !source.trim() || !confirm} onClick={run}>Import {num(stats?.valid)} contacts</Btn></div>
          : step === 4 ? <div className="flex justify-end"><Btn kind="ink" onClick={() => { reset(); onClose(); }}>Done</Btn></div> : null
    }>
      <ol className="mb-5 flex items-center gap-2 text-[12px] font-semibold text-ink/45">
        {["Upload", "Match columns", "Check & consent", "Done"].map((l, i) => <li key={l} className={`flex items-center gap-1.5 ${step === i + 1 ? "text-ink" : step > i + 1 ? "text-green-700" : ""}`}><span className={`flex h-5 w-5 items-center justify-center rounded-full text-[10.5px] ${step === i + 1 ? "bg-[#ff3c00] text-white" : step > i + 1 ? "bg-green-600 text-white" : "bg-ink/10"}`}>{step > i + 1 ? <Check className="h-3 w-3" /> : i + 1}</span><span className="hidden sm:inline">{l}</span>{i < 3 && <span className="mx-1 h-px w-4 bg-hair sm:w-8" />}</li>)}
      </ol>
      {err && <div className="mb-4"><Notice tone="error">{err}</Notice></div>}

      {step === 1 && (
        <div>
          <button type="button" onClick={() => input.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); load(e.dataTransfer.files?.[0]); }} className="flex w-full flex-col items-center rounded-xl border-2 border-dashed border-hair bg-white px-6 py-14 text-center hover:border-[#ff3c00]">
            <FileUp className="h-8 w-8 text-[#ff3c00]" />
            <span className="mt-3 text-[15px] font-semibold">Drop a CSV file here, or tap to choose</span>
            <span className="mt-1 text-[12.5px] text-ink/50">Export from your POS, CRM, Mailchimp, Square, QuickBooks or a spreadsheet. Needs an email column.</span>
          </button>
          <input ref={input} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => load(e.target.files?.[0])} />
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <p className="text-[13.5px] text-ink/60"><span className="font-semibold text-ink">{file?.name}</span> · {num(csv.rows.length)} rows. Tell us what each column is.</p>
          <div className="overflow-hidden rounded-xl border border-hair bg-white">
            {csv.headers.map((h, i) => (
              <div key={i} className="grid grid-cols-1 items-center gap-2 border-b border-hair/70 px-4 py-3 last:border-0 sm:grid-cols-[1fr_1fr]">
                <div className="min-w-0"><p className="truncate text-[13.5px] font-semibold">{h || `Column ${i + 1}`}</p><p className="truncate text-[12px] text-ink/45">{csv.rows.slice(0, 3).map((r) => r[i]).filter(Boolean).join(" · ") || "(empty)"}</p></div>
                <select className={inputCls} value={map[i] || ""} onChange={(e) => setMap(map.map((m, j) => (j === i ? e.target.value : e.target.value !== "custom" && e.target.value && m === e.target.value ? "" : m)))}>
                  {TARGETS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
              </div>
            ))}
          </div>
          {emailCol < 0 && <Notice tone="warn">Pick which column holds the email address.</Notice>}
          {stats && <p className="text-[12.5px] text-ink/55">{num(stats.valid)} valid emails · {num(stats.invalid)} invalid · {num(stats.dupes)} duplicates in the file</p>}
        </div>
      )}

      {step === 3 && stats && check && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[["New", stats.valid - check.existing - check.suppressed - check.unsubscribed, "text-green-700"], ["Already on file", check.existing, ""], ["Unsubscribed / blocked", check.suppressed + check.unsubscribed, "text-amber-700"], ["Skipped (invalid or dup)", stats.invalid + stats.dupes, "text-ink/50"]].map(([l, v, c]) => (
              <div key={l} className="rounded-lg border border-hair bg-white px-3 py-2.5"><p className={`text-[22px] font-semibold tabular-nums ${c}`}>{num(Math.max(0, v))}</p><p className="text-[11.5px] text-ink/50">{l}</p></div>
            ))}
          </div>
          {(check.suppressed + check.unsubscribed) > 0 && <p className="text-[12.5px] text-ink/55">People who unsubscribed or bounced stay off your sends. Importing them again never re-subscribes them.</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Add to list</Label>
              <select className={inputCls} value={listId} onChange={(e) => setListId(e.target.value)}>
                {(data.lists || []).map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                <option value="__new">+ New list…</option>
              </select>
              {listId === "__new" && <input className={`${inputCls} mt-2`} value={newList} onChange={(e) => setNewList(e.target.value)} placeholder="New list name" />}
            </div>
            <div><Label hint="comma separated">Tag them</Label><input className={inputCls} value={tags} onChange={(e) => setTags(e.target.value)} placeholder="e.g. 2025-customers, spring" /></div>
          </div>
          <div className="space-y-3">
            <Toggle on={update} onChange={setUpdate} label="Update details of people already on file" hint="Off: only add them to the list and tags." />
            <Toggle on={auto} onChange={setAuto} label="Start welcome automations for new people" hint="Off by default: imported contacts don't get the welcome series." />
          </div>
          <div className="rounded-xl border-2 border-ink/80 bg-white p-4">
            <p className="flex items-center gap-2 text-[14px] font-semibold"><ShieldCheck className="h-4 w-4 text-[#ff3c00]" /> How did these people agree to hear from you? <span className="text-red-600">*</span></p>
            <div className="mt-3 space-y-2">
              {[["express", "They signed up or asked to get emails from us"], ["existing_customer", "They're customers who bought from us (they can unsubscribe anytime)"]].map(([k, l]) => (
                <label key={k} className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${basis === k ? "border-[#ff3c00] bg-[#ff3c00]/[0.04]" : "border-hair"}`}><input type="radio" name="basis" checked={basis === k} onChange={() => setBasis(k)} className="mt-0.5 accent-[#ff3c00]" /><span className="text-[13.5px]">{l}</span></label>
              ))}
            </div>
            <div className="mt-3"><Label>Where the list came from</Label><input className={inputCls} value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Square customers 2024–2025, website newsletter form" /></div>
            <label className="mt-3 flex cursor-pointer items-start gap-3 text-[13px] leading-snug"><input type="checkbox" checked={confirm} onChange={(e) => setConfirm(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[#ff3c00]" /><span>I confirm these people agreed to receive emails from {data.client?.business || "us"}. No purchased or scraped lists.</span></label>
            <p className="mt-2 text-[11.5px] text-ink/45">We record this with each contact. Every email includes your mailing address and a one-click unsubscribe.</p>
          </div>
          {progress && <div><div className="h-2 overflow-hidden rounded-full bg-ink/10"><div className="h-full bg-gradient-to-r from-[#ff3c00] to-[#ffaa00] transition-all" style={{ width: `${(progress.done / Math.max(1, progress.of)) * 100}%` }} /></div><p className="mt-1.5 flex items-center gap-2 text-[12px] text-ink/55"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Importing {num(progress.done)} of {num(progress.of)}…</p></div>}
        </div>
      )}

      {step === 4 && result && (
        <div className="space-y-4 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-green-600 text-white"><Check className="h-7 w-7" /></span>
          <p className="text-[22px] font-semibold tracking-[-0.03em]">{num(result.created)} added{result.updated ? `, ${num(result.updated)} updated` : ""}</p>
          <p className="text-[13.5px] text-ink/55">{[result.invalid && `${num(result.invalid)} invalid`, result.duplicates && `${num(result.duplicates)} duplicates`, result.suppressed && `${num(result.suppressed)} kept off (unsubscribed or bounced before)`, result.enrolled && `${num(result.enrolled)} started an automation`].filter(Boolean).join(" · ") || "Clean import."}</p>
        </div>
      )}
    </Drawer>
  );
}
