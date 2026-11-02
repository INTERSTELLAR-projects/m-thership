import { useEffect, useState } from "react";
import { ChevronDown, ExternalLink, Trash2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Tag } from "@/features/clients/ui";
import { timeAgo } from "@/lib/useData";
import { KINDS, KIND_LABEL, METHODS, METHOD_LABEL, TARGET_STATUSES, inputCls, nowIso, domainOf } from "./lib";

const EDIT_FIELDS = [
  ["name", "Name"], ["url", "URL"], ["submission_url", "Submission URL"], ["contact_name", "Contact name"],
  ["contact_email", "Public contact email"], ["contact_form_url", "Contact form URL"], ["cost_amount", "Cost (as stated)"],
  ["live_url", "Live link (when won)"],
];

const short = (u) => String(u || "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");

// One target: compact row/card that expands inline into an editor.
export default function TargetCard({ t, onPatch, showClient = true, compact = false }) {
  const [open, setOpen] = useState(false);
  const [v, setV] = useState(t);
  const [busy, setBusy] = useState(false);
  const [armDelete, setArmDelete] = useState(false);
  useEffect(() => { if (!open) setV(t); }, [t, open]);

  const setStatus = async (status) => {
    const fields = { status, last_action_at: nowIso() };
    onPatch("OutreachTarget", t.id, fields);
    await base44.entities.OutreachTarget.update(t.id, fields);
  };
  const save = async () => {
    setBusy(true);
    const { id: _i, created_date: _c, updated_date: _u, created_by: _b, created_by_id: _bi, is_sample: _s, ...fields } = v; // eslint-disable-line no-unused-vars
    fields.domain = domainOf(fields.url) || fields.domain || "";
    fields.last_action_at = nowIso();
    if (fields.live_url && t.status !== "won" && fields.status !== "won") fields.status = "won";
    try {
      await base44.entities.OutreachTarget.update(t.id, fields);
      onPatch("OutreachTarget", t.id, fields);
      setOpen(false);
    } finally { setBusy(false); }
  };
  const remove = async () => {
    await base44.entities.OutreachTarget.delete(t.id);
  };
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.value }));

  return (
    <div className="border border-hair bg-paper">
      <div className="px-3 py-2.5">
        <div className="flex items-start justify-between gap-2">
          <button onClick={() => setOpen((o) => !o)} className="min-w-0 text-left">
            <p className="truncate text-[13px] font-semibold tracking-[-0.01em]">{t.name}</p>
            <p className="truncate text-[11px] text-ink/45">{showClient ? `${t.client_name || "—"} · ` : ""}{KIND_LABEL[t.kind] || t.kind}</p>
          </button>
          <ChevronDown onClick={() => setOpen((o) => !o)} className={`mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer text-ink/40 transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
        {!compact && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1">
            {t.submission_method && t.submission_method !== "unknown" && <Tag>{METHOD_LABEL[t.submission_method]}</Tag>}
            {t.cost === "free" && <Tag tone="green">free</Tag>}
            {t.cost === "paid" && <Tag tone="amber">paid{t.cost_amount ? ` ${t.cost_amount}` : ""}</Tag>}
            {t.found_by === "claude" && <Tag tone="ink">claude</Tag>}
            {t.status === "won" && t.live_ok === false && <Tag tone="red">link missing</Tag>}
          </div>
        )}
        {t.status === "won" && t.live_url && (
          <a href={t.live_url} target="_blank" rel="noreferrer" className="mt-1.5 inline-flex max-w-full items-center gap-1 truncate text-[11px] text-[#ff3c00] hover:underline">{short(t.live_url).slice(0, 40)} <ExternalLink className="h-3 w-3 shrink-0" /></a>
        )}
        <select value={t.status} onChange={(e) => setStatus(e.target.value)} className="mt-2 h-7 w-full border border-hair bg-card px-1.5 text-[11.5px] text-ink/75 outline-none focus:border-[#ff3c00]">
          {TARGET_STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      {open && (
        <div className="space-y-2 border-t border-hair bg-card px-3 py-3">
          {t.url && <a href={t.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[11.5px] text-ink/60 hover:text-[#ff3c00]">{short(t.url)} <ExternalLink className="h-3 w-3" /></a>}
          {t.relevance && <p className="text-[11.5px] leading-relaxed text-ink/60">{t.relevance}</p>}
          {t.source_url && <p className="text-[10.5px] text-ink/40">Found via <a className="underline" href={t.source_url} target="_blank" rel="noreferrer">{short(t.source_url).slice(0, 50)}</a> {t.found_at ? timeAgo(t.found_at) : ""}</p>}
          <div className="grid grid-cols-2 gap-2">
            <select className={inputCls} value={v.kind || "other"} onChange={set("kind")}>{KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
            <select className={inputCls} value={v.submission_method || "unknown"} onChange={set("submission_method")}>{METHODS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </div>
          {EDIT_FIELDS.map(([k, l]) => (
            <input key={k} className={inputCls} placeholder={l} value={v[k] || ""} onChange={set(k)} />
          ))}
          <select className={inputCls} value={v.cost || "unknown"} onChange={set("cost")}>{["free", "paid", "freemium", "unknown"].map((c) => <option key={c} value={c}>Cost: {c}</option>)}</select>
          <textarea rows={2} className={inputCls} placeholder="Why it fits this client" value={v.relevance || ""} onChange={set("relevance")} />
          <textarea rows={2} className={inputCls} placeholder="Requirements" value={v.requirements || ""} onChange={set("requirements")} />
          <textarea rows={2} className={inputCls} placeholder="Notes" value={v.notes || ""} onChange={set("notes")} />
          <div className="flex items-center gap-2">
            <button onClick={save} disabled={busy} className="h-8 bg-[#ff3c00] px-3 text-[12px] font-medium text-white hover:bg-ink disabled:opacity-50">{busy ? "Saving…" : "Save"}</button>
            <button onClick={() => setOpen(false)} className="h-8 px-2 text-[12px] text-ink/55">Close</button>
            <span className="ml-auto">
              {armDelete ? (
                <span className="flex items-center gap-1.5 text-[11.5px]">
                  <button onClick={remove} className="text-red-700 underline">Delete for good</button>
                  <button onClick={() => setArmDelete(false)} className="text-ink/50">Keep</button>
                </span>
              ) : (
                <button onClick={() => setArmDelete(true)} title="Delete target" className="text-ink/40 hover:text-red-700"><Trash2 className="h-3.5 w-3.5" /></button>
              )}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
