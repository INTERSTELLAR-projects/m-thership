import React, { useEffect, useRef, useState } from "react";
import { Check, Flag, Loader2, Paperclip, Undo2, X } from "lucide-react";
import { inputClass, textareaClass } from "@/features/tasks/lib/ui";
import { ACCESS_STATUSES } from "./catalog";
import { uploadFiles } from "./store";
import { cn } from "@/lib/utils";

const SOURCE_LABEL = { justin: "you", client_intake: "client intake", crm: "CRM", records: "on file" };

const asText = (v) => (Array.isArray(v) ? v.join("\n") : v === undefined || v === null ? "" : String(v));

function UploadField({ value, multiple, onSave }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [link, setLink] = useState("");
  const ref = useRef(null);
  const list = Array.isArray(value) ? value : value ? [value] : [];
  const add = async (files) => {
    if (!files || !files.length) return;
    setBusy(true);
    setErr("");
    try {
      const urls = await uploadFiles(Array.from(files));
      onSave(multiple ? [...list, ...urls] : urls[0]);
    } catch (e) {
      setErr(e.message || "Upload failed");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-2">
      {list.length ? (
        <div className="flex flex-wrap gap-1.5">
          {list.map((u, i) => (
            <span key={u + i} className="inline-flex max-w-full items-center gap-1.5 rounded-sm border border-hair bg-canvas px-2 py-1 text-[11px]">
              {/\.(png|jpe?g|webp|gif|svg)(\?|$)/i.test(u) ? <img src={u} alt="" className="h-5 w-5 object-contain" /> : <Paperclip className="h-3 w-3 text-ink/40" />}
              <a href={u} target="_blank" rel="noreferrer" className="max-w-[200px] truncate hover:text-[#ff3c00]">{u.split("/").pop()}</a>
              <button type="button" aria-label="Remove" onClick={() => onSave(multiple ? list.filter((_, j) => j !== i) : "")} className="text-ink/35 hover:text-[#ff3c00]">
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => ref.current && ref.current.click()} disabled={busy} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-hair bg-card px-2.5 text-[11.5px] text-ink/70 hover:border-ink/40 disabled:opacity-50">
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />} Upload
        </button>
        <input ref={ref} type="file" multiple={multiple} className="hidden" onChange={(e) => add(e.target.files)} />
        <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="or paste a link (Drive folder, URL)" className={cn(inputClass, "h-8 min-w-[180px] flex-1")} />
        {link.trim() ? (
          <button type="button" onClick={() => { onSave(multiple ? [...list, link.trim()] : link.trim()); setLink(""); }} className="h-8 rounded-md bg-ink px-2.5 text-[11.5px] text-white">
            Add
          </button>
        ) : null}
      </div>
      {err ? <p className="text-[11px] text-red-700">{err}</p> : null}
    </div>
  );
}

function AccessField({ value, onSave }) {
  const v = value && typeof value === "object" ? value : {};
  const [by, setBy] = useState(v.by || "");
  const [note, setNote] = useState(v.note || "");
  useEffect(() => { setBy(v.by || ""); setNote(v.note || ""); }, [v.by, v.note]);
  const save = (patch) => onSave({ status: v.status || "not_requested", by: by, on: v.on || "", note: note, ...patch });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1">
        {ACCESS_STATUSES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => save({ status: s.key, on: s.key === "granted" || s.key === "requested" ? new Date().toLocaleDateString("en-CA") : v.on || "" })}
            className={cn("rounded-sm border px-2 py-1 text-[11px] transition-colors", (v.status || "not_requested") === s.key ? (s.key === "granted" ? "border-ink bg-ink text-white" : "border-[#ff3c00] bg-[#ff3c00]/[0.07] text-ink") : "border-hair bg-card text-ink/60 hover:border-ink/40")}
          >
            {s.label}
          </button>
        ))}
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_1.4fr]">
        <input value={by} onChange={(e) => setBy(e.target.value)} onBlur={() => by !== (v.by || "") && save({})} placeholder="Granted by (name)" className={cn(inputClass, "h-8")} />
        <input value={note} onChange={(e) => setNote(e.target.value)} onBlur={() => note !== (v.note || "") && save({})} placeholder="Note (role given, account, where). No passwords." className={cn(inputClass, "h-8")} />
      </div>
      {v.on ? <p className="font-mono text-[10px] text-ink/45">{v.status === "granted" ? "Granted" : "Updated"} {v.on}</p> : null}
    </div>
  );
}

// One row: label, level, where the value came from, the control, and skip-with-flag.
export default function FieldControl({ item, onSave, onSkip, onUnskip, readOnly = false }) {
  const f = item.field;
  const [draft, setDraft] = useState(asText(item.value));
  const [skipOpen, setSkipOpen] = useState(false);
  const [reason, setReason] = useState("");
  useEffect(() => { setDraft(asText(item.value)); }, [item.value]);

  const commit = () => {
    if (draft === asText(item.value)) return;
    onSave(draft);
  };

  let control = null;
  if (f.type === "access") control = <AccessField value={item.value} onSave={onSave} />;
  else if (f.type === "upload") control = <UploadField value={item.value} multiple={f.multiple} onSave={onSave} />;
  else if (f.type === "select")
    control = (
      <select value={asText(item.value)} onChange={(e) => onSave(e.target.value)} className={inputClass} disabled={readOnly}>
        <option value="">Choose…</option>
        {(f.options || []).map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    );
  else if (f.type === "textarea") control = <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} rows={3} className={textareaClass} disabled={readOnly} />;
  else control = <input type={f.type === "date" ? "date" : f.type === "email" ? "email" : f.type === "phone" ? "tel" : "text"} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} className={inputClass} disabled={readOnly} />;

  return (
    <div className={cn("rounded-md border px-3.5 py-3", item.done ? "border-hair bg-card" : item.skipped ? "border-dashed border-[#ff3c00]/50 bg-[#ff3c00]/[0.03]" : item.level === "blocking" ? "border-[#ff3c00]/40 bg-card" : "border-hair bg-card")}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className={cn("grid h-4 w-4 shrink-0 place-items-center rounded-full", item.done ? "bg-ink text-white" : item.skipped ? "border border-dashed border-[#ff3c00]" : item.level === "blocking" ? "border-2 border-[#ff3c00]" : "border border-ink/25")}>
          {item.done ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
        </span>
        <p className="min-w-0 flex-1 text-[12.5px] font-medium text-ink">{f.label}</p>
        <span className={cn("mono-label text-[8.5px]", item.level === "blocking" ? "text-[#ff3c00]" : "text-ink/40")}>{item.level === "blocking" ? "Blocking" : "Optional"}</span>
        {item.from && item.done ? <span className="mono-label rounded-sm bg-ink/[0.05] px-1.5 py-0.5 text-[8.5px] text-ink/55">from {SOURCE_LABEL[item.from] || item.from}</span> : null}
        {f.ask ? <span className="mono-label text-[8.5px] text-ink/35" title="Included in the client intake request when missing">client can answer</span> : null}
      </div>
      {f.help ? <p className="-mt-1 mb-2 text-[11px] leading-snug text-ink/50">{f.help}</p> : null}
      {control}
      {item.level === "blocking" && !item.done ? (
        item.skipped ? (
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[#c24100]">
            <span className="inline-flex items-center gap-1.5"><Flag className="h-3 w-3" /> Skipped with a flag{item.skipped.reason ? ": " + item.skipped.reason : ""}. It becomes a follow-up task at kickoff.</span>
            <button type="button" onClick={onUnskip} className="inline-flex items-center gap-1 text-ink/50 hover:text-ink"><Undo2 className="h-3 w-3" /> Unflag</button>
          </div>
        ) : skipOpen ? (
          <div className="mt-2 flex items-center gap-2">
            <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why skip? (e.g. client sends Friday)" className={cn(inputClass, "h-8 flex-1")} onKeyDown={(e) => { if (e.key === "Enter") { onSkip(reason.trim()); setSkipOpen(false); } }} />
            <button type="button" onClick={() => { onSkip(reason.trim()); setSkipOpen(false); }} className="h-8 rounded-md bg-ink px-2.5 text-[11.5px] text-white">Skip</button>
            <button type="button" onClick={() => setSkipOpen(false)} className="h-8 px-2 text-[11.5px] text-ink/50">Cancel</button>
          </div>
        ) : (
          <button type="button" onClick={() => setSkipOpen(true)} className="mt-2 inline-flex items-center gap-1.5 text-[11px] text-ink/45 hover:text-[#ff3c00]">
            <Flag className="h-3 w-3" /> Skip with a flag
          </button>
        )
      ) : null}
    </div>
  );
}
