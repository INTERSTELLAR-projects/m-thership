// Portal "Submit" intake (Justin's standard for every client): send us a job, a before & after, a new drop, a
// testimonial or an event, with photos. Types follow the client's niche. Capture only: it lands with Interstellar
// (a request on Justin's Command screen) and the client sees "Received. We'll take it from here." plus its status.
// Clients with their own Command System can keep submitting there; both land in the same place.
import { useEffect, useState } from "react";
import { Camera, Check, Loader2, Upload, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { CONSENT_TEXT, RECEIVED_TEXT } from "@/lib/submitTypes";

const inputCls = "mt-1 w-full rounded-md border border-hair bg-white px-3 py-2.5 text-[14px] outline-none focus:border-[#ff3c00]";

export default function PortalSubmit({ call, scopeId, preview }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["portal", scopeId, "submissions"], queryFn: () => call("submissions"), retry: false });
  const types = q.data?.types || [];
  const [kind, setKind] = useState("");
  const [vals, setVals] = useState({});
  const [photos, setPhotos] = useState([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);
  useEffect(() => { if (!kind && types[0]) setKind(types[0].key); }, [types, kind]);
  const t = types.find((x) => x.key === kind);
  if (q.data && q.data.enabled === false) return null;

  const upload = async (files) => {
    setBusy("upload"); setErr("");
    try {
      const out = [];
      for (const f of [...files].slice(0, 30 - photos.length)) {
        if (!/^image\//.test(f.type)) continue;
        const { file_url } = await base44.integrations.Core.UploadFile({ file: f });
        if (file_url) out.push({ url: file_url, label: t?.photo_labels ? "after" : "" });
      }
      setPhotos((p) => [...p, ...out]);
    } catch (e) { setErr(e?.message || "Upload failed. Try again."); }
    setBusy("");
  };
  const submit = async (e) => {
    e.preventDefault();
    if (preview) { setErr("Preview: submitting is turned off so nothing lands in your queue."); return; }
    setBusy("send"); setErr("");
    try {
      const r = await call("submit_content", { kind, fields: vals, photos, consent });
      if (r?.error) setErr(r.error);
      else { setDone(r.item); setVals({}); setPhotos([]); setConsent(false); qc.invalidateQueries({ queryKey: ["portal", scopeId, "submissions"] }); }
    } catch (e2) { setErr(e2?.response?.data?.error || e2?.message || "Couldn't send. Try again."); }
    setBusy("");
  };

  return (
    <section className="space-y-4" data-testid="portal-submit">
      <div>
        <p className="label-cross">(Submit)</p>
        <h2 className="mt-2 text-[26px] font-semibold tracking-[-0.04em]">Send us something <span className="text-[#ff3c00]">/to show off</span></h2>
        <p className="mt-1 text-[13px] text-ink/55">A finished job, a before & after, a new drop, a kind word from a customer or an event. Add photos and we take it from there.</p>
      </div>

      {done ? (
        <div className="flex items-start gap-3 rounded-md border border-[#ff3c00]/30 bg-[#ff3c00]/[0.05] p-4" role="status" data-testid="submit-received">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#ff3c00] text-white"><Check className="h-4 w-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[15px] font-semibold">{RECEIVED_TEXT}</p>
            <p className="text-[12.5px] text-ink/60">{done.label}: {done.title}. You can follow it below.</p>
          </div>
          <button type="button" onClick={() => setDone(null)} className="text-[12.5px] text-[#d83300] hover:underline">Send another</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4 rounded-md border border-hair bg-card p-4">
          {q.isLoading ? <div className="h-24 animate-pulse rounded bg-ink/[0.04]" /> : (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="What are you sending?">
              {types.map((x) => (
                <button key={x.key} type="button" role="radio" aria-checked={kind === x.key} onClick={() => { setKind(x.key); setVals({}); }} className={`rounded-full border px-3.5 py-2 text-left text-[13px] ${kind === x.key ? "border-[#ff3c00] bg-white font-medium" : "border-hair text-ink/65 hover:border-ink/30"}`}>
                  {x.label}
                </button>
              ))}
            </div>
          )}
          {t ? (
            <>
              <p className="text-[12.5px] text-ink/50">{t.hint}</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {t.fields.map((f) => (
                  <label key={f.key} className={`block text-[12.5px] font-medium text-ink/70 ${f.type === "textarea" ? "sm:col-span-2" : ""}`}>
                    {f.label}{f.required ? " *" : ""}{f.tag ? <span className="ml-1 text-[11px] font-normal text-ink/40">(location tag)</span> : null}
                    {f.type === "textarea"
                      ? <textarea rows={3} value={vals[f.key] || ""} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} className={inputCls} />
                      : <input type={f.type === "date" ? "date" : "text"} value={vals[f.key] || ""} placeholder={f.placeholder || ""} onChange={(e) => setVals((v) => ({ ...v, [f.key]: e.target.value }))} className={inputCls} />}
                  </label>
                ))}
              </div>
              <div>
                <p className="text-[12.5px] font-medium text-ink/70">Photos *{t.photo_labels ? <span className="ml-1 font-normal text-ink/45">(mark each one before or after)</span> : null}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {photos.map((p, i) => (
                    <div key={p.url} className="relative h-20 w-20 overflow-hidden rounded-md border border-hair">
                      <img src={p.url} alt="" className="h-full w-full object-cover" />
                      <button type="button" aria-label="Remove photo" onClick={() => setPhotos((ps) => ps.filter((_, k) => k !== i))} className="absolute right-0.5 top-0.5 grid h-5 w-5 place-items-center rounded-full bg-black/60 text-white"><X className="h-3 w-3" /></button>
                      {t.photo_labels ? (
                        <button type="button" onClick={() => setPhotos((ps) => ps.map((x, k) => (k === i ? { ...x, label: x.label === "before" ? "after" : "before" } : x)))} className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-[10px] uppercase tracking-wider text-white">{p.label || "after"}</button>
                      ) : null}
                    </div>
                  ))}
                  <label className="grid h-20 w-20 cursor-pointer place-items-center rounded-md border border-dashed border-ink/25 text-ink/45 hover:border-[#ff3c00] hover:text-[#ff3c00]">
                    {busy === "upload" ? <Loader2 className="h-5 w-5 animate-spin" /> : <span className="flex flex-col items-center gap-1 text-[10.5px]"><Camera className="h-5 w-5" />Add</span>}
                    <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => upload(e.target.files || [])} />
                  </label>
                </div>
              </div>
              <label className="flex items-start gap-2 text-[12.5px] text-ink/70">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5" />
                <span>{CONSENT_TEXT}{t.consent ? " *" : " (tick if anyone is shown or named)"}</span>
              </label>
              {err ? <p className="text-[12.5px] text-red-700" role="alert">{err}</p> : null}
              <button type="submit" disabled={!!busy} className="inline-flex h-10 items-center gap-1.5 rounded-md bg-[#ff3c00] px-4 text-[13.5px] font-medium text-white hover:bg-ink disabled:opacity-50">
                {busy === "send" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}Send it to us
              </button>
            </>
          ) : null}
        </form>
      )}

      {(q.data?.items || []).length ? (
        <div className="rounded-md border border-hair bg-card" data-testid="submit-history">
          <p className="border-b border-hair px-4 py-2.5 text-[13px] font-semibold">What you've sent</p>
          <ul className="divide-y divide-hair">
            {q.data.items.slice(0, 12).map((x) => (
              <li key={x.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                {x.photo ? <img src={x.photo} alt="" className="h-9 w-9 shrink-0 rounded object-cover" /> : <span className="h-9 w-9 shrink-0 rounded bg-ink/[0.06]" />}
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{x.title || x.label}</span><span className="block text-[11.5px] text-ink/50">{x.label} · {x.received_at ? new Date(x.received_at).toLocaleDateString() : ""}</span></span>
                {x.url ? <a href={x.url} target="_blank" rel="noreferrer" className="text-[12px] text-[#d83300] hover:underline">See it live</a> : null}
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] ${x.status === "live" ? "bg-green-100 text-green-800" : "bg-ink/[0.06] text-ink/65"}`}>{x.status_label}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
