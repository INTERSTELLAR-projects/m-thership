// Live preview grid: every share image drawn at a true 1200x630 on its own canvas, shown scaled.
// Click one to see it full size; each has its own JPG download, and "Download all" builds a ZIP.
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { renderImage, canvasToJpeg, makeCanvas } from "./render";

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function downloadOne(profile, page, assets) {
  const c = makeCanvas();
  renderImage(c, profile, page, assets);
  downloadBlob(await canvasToJpeg(c, 0.9), `${page.file_name}.jpg`);
}

export async function downloadZip(profile, assets, onProgress) {
  const { default: JSZip } = await import("jszip");
  const zip = new JSZip();
  const c = makeCanvas();
  const pages = profile.pages || [];
  for (let i = 0; i < pages.length; i++) {
    renderImage(c, profile, pages[i], assets);
    zip.file(`${pages[i].file_name}.jpg`, await canvasToJpeg(c, 0.9));
    onProgress?.(i + 1, pages.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  const blob = await zip.generateAsync({ type: "blob", compression: "STORE" });
  const base = String(profile.site_domain || profile.client_name || "client").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  downloadBlob(blob, `${base}-share-images.zip`);
}

const KIND_LABEL = { home: "home", page: "page", group: "group", default: "default" };

function Thumb({ profile, page, assets, index, onOpen, onOverflow }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!ref.current || !assets) return undefined;
    let cancelled = false;
    const id = setTimeout(() => {
      if (cancelled || !ref.current) return;
      const r = renderImage(ref.current, profile, page, assets);
      onOverflow(page.file_name, !!r?.overflow);
    }, 30 + index * 12);
    return () => { cancelled = true; clearTimeout(id); };
  }, [profile, page, assets, index, onOverflow]);
  return <canvas ref={ref} width={1200} height={630} onClick={onOpen} aria-label={`${page.file_name}.jpg preview`} />;
}

export default function Previews({ profile, assets, dupes }) {
  const [open, setOpen] = useState(-1);
  const [overflow, setOverflow] = useState({});
  const pages = profile?.pages || [];
  const markOverflow = useRef((file, v) => setOverflow((o) => (o[file] === v ? o : { ...o, [file]: v }))).current;

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
        {pages.map((p, i) => {
          const warn = overflow[p.file_name] || dupes.has(p.file_name) || ((p.kind === "page" || p.kind === "group") && !p.label);
          return (
            <div key={`${p.file_name}-${i}`} className={`thumb ${warn ? "warn" : ""}`} style={{ animationDelay: `${Math.min(i, 16) * 35}ms` }}>
              <Thumb profile={profile} page={p} assets={assets} index={i} onOpen={() => setOpen(i)} onOverflow={markOverflow} />
              <div className="meta">
                <span className="mono min-w-0 flex-1 truncate text-[11.5px] text-[var(--ink-d)]">{p.file_name}.jpg</span>
                <span className="mono rounded-full border border-[var(--hair-d2)] px-1.5 text-[9.5px] uppercase tracking-[.12em] text-[var(--ink-s)]">{KIND_LABEL[p.kind] || p.kind}</span>
                <button type="button" className="text-[var(--ink-m)] transition-colors hover:text-[#ff8a3d]" onClick={() => downloadOne(profile, p, assets)} aria-label={`Download ${p.file_name}.jpg`} title="Download JPG">
                  <Download className="h-3.5 w-3.5" />
                </button>
              </div>
              {warn ? (
                <p className="px-[11px] pb-2 text-[11px] text-[#ffb27a]">
                  {dupes.has(p.file_name) ? "Same file name as another image. " : ""}
                  {overflow[p.file_name] ? "Label is too long to fit two lines at the smallest size. Shorten it. " : ""}
                  {(p.kind === "page" || p.kind === "group") && !p.label ? "No label yet." : ""}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>
      {open >= 0 && pages[open] ? (
        <Lightbox profile={profile} assets={assets} pages={pages} index={open} setIndex={setOpen} />
      ) : null}
    </>
  );
}

function Lightbox({ profile, assets, pages, index, setIndex }) {
  const ref = useRef(null);
  const page = pages[index];
  useEffect(() => { if (ref.current) renderImage(ref.current, profile, page, assets); }, [profile, page, assets]);
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") setIndex(-1);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % pages.length);
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + pages.length) % pages.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pages.length, setIndex]);
  return (
    <div className="shi-lb agx" role="dialog" aria-label={`${page.file_name}.jpg`} onMouseDown={() => setIndex(-1)}>
      <div className="w-full max-w-[1200px]" onMouseDown={(e) => e.stopPropagation()}>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className="mono flex-1 truncate text-[12.5px] text-[var(--ink-d)]">{page.file_name}.jpg <span className="text-[var(--ink-s)]">· 1200 × 630 · {index + 1} of {pages.length}</span></span>
          <button type="button" className="btn-d" onClick={() => setIndex((index - 1 + pages.length) % pages.length)} aria-label="Previous"><ChevronLeft className="h-4 w-4" /></button>
          <button type="button" className="btn-d" onClick={() => setIndex((index + 1) % pages.length)} aria-label="Next"><ChevronRight className="h-4 w-4" /></button>
          <button type="button" className="btn-f" onClick={() => downloadOne(profile, page, assets)}><Download className="h-3.5 w-3.5" />Download JPG</button>
          <button type="button" className="btn-d" onClick={() => setIndex(-1)} aria-label="Close"><X className="h-4 w-4" /></button>
        </div>
        <canvas ref={ref} width={1200} height={630} />
        {page.paths_note ? <p className="mt-2 text-[12px] text-[var(--ink-m)]">Used on: {page.paths_note}</p> : null}
      </div>
    </div>
  );
}
