// "Build page manually" (Justin's fallback, Nov 17): everything needed to build a client post by hand, for ANY
// submission and ANY client, even when the site's endpoint or key isn't working or auto-publish is off.
// Every field with a copy button, the AI draft (title / summary / SEO), the photo grid with a one-click
// download-all (.zip), and "Mark as posted manually" with the live URL.
import { useState } from "react";
import JSZip from "jszip";
import { Copy, Check, Download, ExternalLink } from "lucide-react";
import { Panel, SmallBtn } from "@/features/clients/ui";

const label = (k) => String(k || "").replace(/_/g, " ");
const HIDE_DRAFT = new Set(["images", "is_test", "unlisted", "catalog_from", "verify_title", "cover_image", "cover_w", "cover_h"]);
const HIDE_RAW = new Set(["photos", "cover_photo", "is_demo", "is_sample", "id", "created_by", "created_by_id", "updated_date", "created_date", "website_status", "website_detail", "website_url", "website_synced_at", "mothership_submission_id"]);

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(ta);
      return ok;
    } catch {
      return false;
    }
  }
}

function CopyBtn({ text }) {
  const [state, setState] = useState("");
  return (
    <button
      type="button"
      onClick={async () => { setState((await copyText(String(text ?? ""))) ? "ok" : "fail"); setTimeout(() => setState(""), 1600); }}
      className="inline-flex h-6 shrink-0 items-center gap-1 border border-hair bg-paper px-2 text-[11px] text-ink/65 hover:border-ink/40 hover:text-ink"
      aria-label="Copy"
    >
      {state === "ok" ? <Check className="h-3 w-3 text-green-700" /> : <Copy className="h-3 w-3" />}
      {state === "ok" ? "Copied" : state === "fail" ? "Select and copy" : "Copy"}
    </button>
  );
}

// Plain text for any value: arrays of door specs / sections / strings become readable lines.
function asText(v) {
  if (v == null) return "";
  if (Array.isArray(v)) {
    return v.map((x) => {
      if (x && typeof x === "object") {
        if (Array.isArray(x.p)) return [x.h, ...x.p].filter(Boolean).join("\n\n");
        if (x.size) return [x.size, x.quantity > 1 ? `×${x.quantity}` : "", x.hydraulic_type, x.cladding].filter(Boolean).join(" · ");
        return Object.entries(x).filter(([, y]) => y != null && y !== "").map(([k, y]) => `${label(k)}: ${y}`).join(", ");
      }
      return String(x);
    }).join(Array.isArray(v) && v[0] && typeof v[0] === "object" && Array.isArray(v[0].p) ? "\n\n" : "\n");
  }
  if (typeof v === "object") return Object.entries(v).filter(([, y]) => y != null && y !== "").map(([k, y]) => `${label(k)}: ${typeof y === "object" ? JSON.stringify(y) : y}`).join("\n");
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function FieldRows({ entries }) {
  if (!entries.length) return <p className="text-ink/55">Nothing here.</p>;
  return (
    <dl className="divide-y divide-hair">
      {entries.map(([k, v]) => {
        const text = asText(v);
        return (
          <div key={k} className="grid grid-cols-[130px_1fr_auto] items-start gap-3 py-2">
            <dt className="text-ink/50">{label(k)}</dt>
            <dd className="whitespace-pre-wrap break-words">{text}</dd>
            <CopyBtn text={text} />
          </div>
        );
      })}
    </dl>
  );
}

const extOf = (url, name) => (String(name || url).match(/\.(jpe?g|png|webp|heic)(?:$|\?)/i)?.[1] || "jpg").toLowerCase();
const safeName = (t) => String(t || "photos").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "photos";

function Photos({ photos, title }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const downloadAll = async () => {
    setBusy(true); setMsg("");
    const zip = new JSZip();
    const failed = [];
    let n = 0;
    for (const [i, p] of photos.entries()) {
      try {
        const res = await fetch(p.url);
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        const base = `${String(i + 1).padStart(2, "0")}-${p.role === "cover" ? "cover" : "photo"}`;
        zip.file(`${base}.${extOf(p.url, p.name)}`, blob);
        n++;
        setMsg(`Adding photos (${n} of ${photos.length})`);
      } catch {
        failed.push(i + 1);
      }
    }
    if (!n) { setBusy(false); setMsg("Could not fetch the photos here. Use the single links below."); return; }
    const out = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(out);
    a.download = `${safeName(title)}-photos.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 30000);
    setBusy(false);
    setMsg(failed.length ? `Downloaded ${n}. Could not fetch photo ${failed.join(", ")}: use its link.` : `Downloaded ${n} photos.`);
  };
  return (
    <Panel
      label="Photos"
      title={`${photos.length} photo${photos.length === 1 ? "" : "s"}${photos[0]?.prepared ? " (prepared copies, location data removed)" : " (as sent)"}`}
      action={photos.length ? (
        <div className="flex gap-2">
          <CopyBtn text={photos.map((p) => p.url).join("\n")} />
          <SmallBtn onClick={busy ? undefined : downloadAll}><Download className="h-3 w-3" />{busy ? "Zipping…" : "Download all (.zip)"}</SmallBtn>
        </div>
      ) : null}
    >
      {msg && <p className="mb-2 text-[12px] text-ink/60" aria-live="polite">{msg}</p>}
      {!photos.length ? <p className="text-ink/55">No photos were sent.</p> : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {photos.map((p, i) => (
            <figure key={p.url} className="border border-hair bg-paper">
              <img src={p.url} alt={`Photo ${i + 1}`} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              <figcaption className="flex items-center justify-between gap-1 px-1.5 py-1 text-[10.5px] text-ink/55">
                <span>{i + 1}{p.role === "cover" ? " · cover" : ""}{p.w ? ` · ${p.w}×${p.h}` : ""}</span>
                <a href={p.url} target="_blank" rel="noreferrer" download className="text-[#ff3c00] hover:underline">open</a>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </Panel>
  );
}

export default function ManualKit({ data, onMark }) {
  const item = data?.item;
  const [url, setUrl] = useState(item?.posted_manually ? item.published_url || "" : "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  if (!item) return null;
  const draft = item.writer_output || null;
  const raw = item.raw || {};
  const draftEntries = draft ? Object.entries(draft).filter(([k, v]) => !HIDE_DRAFT.has(k) && v != null && v !== "" && !(Array.isArray(v) && !v.length)) : [];
  const rawEntries = Object.entries(raw).filter(([k, v]) => !HIDE_RAW.has(k) && v != null && v !== "" && !(Array.isArray(v) && !v.length));
  const title = draft?.title || raw.shoot_title || raw.title || raw.customer_name || raw.name || "client-post";
  const altText = draft?.images?.length ? draft.images.map((im, i) => `${i + 1}. ${im.alt}`).join("\n") : "";
  const mark = async () => {
    setBusy(true); setMsg("");
    const r = await onMark(url.trim());
    setBusy(false);
    setMsg(r?.ok ? "Recorded as posted. The client's feed and status now show it as live." : r?.error || "Could not save");
  };
  const canMark = !item.is_test && !(item.status === "live" && !item.posted_manually);
  return (
    <div className="space-y-4">
      <div className="border border-[#ff6a00]/40 bg-[#ff6a00]/[0.05] p-3 text-[13px]">
        <p className="font-medium">Build this page by hand</p>
        <p className="mt-1 text-ink/65">
          {data.site ? `Website: ${data.site.name} (${data.site.origin}).` : "This client's website isn't set up for automatic posting."}
          {item.manual_reason ? ` Why it's here: ${item.manual_reason}` : ""}
          {" "}Copy the fields below into the site, add the photos, then paste the live link at the bottom.
        </p>
      </div>
      <Panel label="AI draft" title={draft ? "Written and fact-checked (use these words)" : "No draft yet (checks or writer didn't run): use the submitted fields"}>
        <FieldRows entries={draftEntries} />
        {altText && <div className="mt-3 grid grid-cols-[130px_1fr_auto] items-start gap-3 border-t border-hair pt-2"><span className="text-ink/50">photo alt text</span><span className="whitespace-pre-wrap break-words">{altText}</span><CopyBtn text={altText} /></div>}
      </Panel>
      <Panel label="Submitted" title="Exactly what the client sent">
        <FieldRows entries={rawEntries} />
      </Panel>
      <Photos photos={data.kit_photos || []} title={title} />
      <Panel label="Finish" title={item.posted_manually ? "Posted manually" : "Mark as posted manually"}>
        {item.is_test ? <p className="text-ink/55">This is a test submission: it is never recorded as posted.</p> : !canMark ? <p className="text-ink/55">This post is live through the automatic publish already.</p> : (
          <div className="space-y-2">
            <label className="block text-[12px] text-ink/60" htmlFor={`live-url-${item.id}`}>Live page link</label>
            <div className="flex flex-wrap gap-2">
              <input id={`live-url-${item.id}`} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" inputMode="url" className="min-w-[240px] flex-1 border border-hair bg-canvas p-2 text-[13px]" />
              <SmallBtn onClick={busy || !url.trim() ? undefined : mark} className="h-[38px]">{busy ? "Saving…" : item.posted_manually ? "Update link" : "Mark as posted manually"}</SmallBtn>
            </div>
            <p className="text-[12px] text-ink/55">Records it like an automatic post: status live with this link, a work entry for the client's feed and the client notice (test address only for now).</p>
            {msg && <p className="text-[12px] text-ink/70" aria-live="polite">{msg}</p>}
            {item.posted_manually && item.published_url && <p><a href={item.published_url} target="_blank" rel="noreferrer" className="text-[#ff3c00] hover:underline">{item.published_url}<ExternalLink className="ml-1 inline h-3 w-3" /></a></p>}
          </div>
        )}
      </Panel>
    </div>
  );
}
