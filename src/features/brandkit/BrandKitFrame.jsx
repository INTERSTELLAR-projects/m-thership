// Shows an Interstellar v2 brand kit (template "interstellar-v2") in the client's own brand: the kit renders as its
// own document inside an iframe so their fonts and colors never mix with the Workspace or Møthership styles.
import { useEffect, useMemo, useRef, useState } from "react";
import { Maximize2 } from "lucide-react";
import { renderBrandKit, BRAND_KIT_TEMPLATE } from "./brandKitHtml";

export const isV2Kit = (kit) => !!kit && kit.template === BRAND_KIT_TEMPLATE;

export default function BrandKitFrame({ kit, title = "Brand kit" }) {
  const html = useMemo(() => renderBrandKit(kit), [kit]);
  const ref = useRef(null);
  const [h, setH] = useState(1200);

  // Grow the frame to its content so the page scrolls as one document.
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let obs = null;
    const fit = () => {
      try {
        const doc = el.contentDocument;
        if (!doc?.body) return;
        setH(Math.max(600, doc.documentElement.scrollHeight));
        if (!obs && "ResizeObserver" in window) { obs = new ResizeObserver(() => setH(Math.max(600, doc.documentElement.scrollHeight))); obs.observe(doc.body); }
      } catch { /* cross-origin: keep the default height */ }
    };
    el.addEventListener("load", fit);
    const t = setTimeout(fit, 1500);
    return () => { el.removeEventListener("load", fit); clearTimeout(t); obs?.disconnect(); };
  }, [html]);

  const openFull = () => {
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    window.open(url, "_blank", "noopener");
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <button type="button" onClick={openFull} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-hair bg-card px-3 text-[12.5px] font-medium hover:border-ink/30">
          <Maximize2 className="h-3.5 w-3.5" /> Open full screen
        </button>
      </div>
      <iframe ref={ref} title={title} srcDoc={html} className="block w-full rounded-md border border-hair" style={{ height: h }} />
    </div>
  );
}
