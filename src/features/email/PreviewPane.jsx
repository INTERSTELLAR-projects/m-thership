import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Monitor, Smartphone } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { renderEmail, renderSubject, missingMerge } from "./emailBlocks";
import { Btn, Pill } from "./ui";

// Live preview: the exact HTML the send function renders (same engine), per recipient, desktop or mobile.
export const PREVIEW_UNSUB = "https://interstellar-mothership.com/functions/email-unsubscribe?t=preview";

export default function PreviewPane({ doc, recipients, kind, portalUrl, previewKey, onPreviewKey }) {
  const [device, setDevice] = useState("desktop");
  const [copied, setCopied] = useState(false);
  const frame = useRef(null);
  const [height, setHeight] = useState(900);
  const live = recipients.filter((r) => r.email && !r.excluded);
  const current = live.find((r) => r.key === previewKey) || null;
  const vars = current ? current.vars : previewKey === "sample" ? { first_name: "Justin", contact_name: "Justin Cowell", business: "Interstellar Strategies", email: "justin@interstellar-strategies.com", website: "https://interstellar-strategies.com", portal_url: portalUrl } : null;
  const html = useMemo(() => renderEmail(doc, { vars, unsubscribeUrl: kind === "mass" ? PREVIEW_UNSUB : "" }), [doc, vars, kind]);
  const subject = renderSubject(doc, vars);
  const missing = current ? missingMerge(doc, current.vars) : [];

  const fit = () => {
    const d = frame.current && frame.current.contentDocument;
    if (d && d.body) setHeight(Math.max(400, d.documentElement.scrollHeight + 4));
  };
  useEffect(() => { const t = setTimeout(fit, 60); return () => clearTimeout(t); }, [html, device]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(html);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
      toast({ title: "HTML copied", description: current ? `Rendered for ${current.email}.` : vars ? "Rendered with sample data." : "Merge fields left as {{tokens}}." });
    } catch {
      toast({ title: "Copy failed", description: "The browser blocked the clipboard.", variant: "destructive" });
    }
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-hair px-3 py-2">
        <select value={previewKey} onChange={(e) => onPreviewKey(e.target.value)} className="h-8 max-w-[260px] border border-hair bg-paper px-2 text-[12px] outline-none focus:border-[#ff3c00]">
          <option value="template">Merge fields as {"{{tokens}}"}</option>
          <option value="sample">Sample data</option>
          {live.length > 0 && <optgroup label={`Recipients (${live.length})`}>{live.slice(0, 300).map((r) => <option key={r.key} value={r.key}>{r.name && r.name !== r.email ? `${r.name} · ${r.email}` : r.email}</option>)}</optgroup>}
        </select>
        <div className="ml-auto flex items-center gap-1">
          <button type="button" title="Desktop" onClick={() => setDevice("desktop")} className={`grid h-8 w-8 place-items-center border ${device === "desktop" ? "border-ink bg-ink text-white" : "border-hair text-ink/50 hover:text-ink"}`}><Monitor className="h-4 w-4" /></button>
          <button type="button" title="Mobile" onClick={() => setDevice("mobile")} className={`grid h-8 w-8 place-items-center border ${device === "mobile" ? "border-ink bg-ink text-white" : "border-hair text-ink/50 hover:text-ink"}`}><Smartphone className="h-4 w-4" /></button>
          <Btn className="h-8" onClick={copy}>{copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copy HTML</Btn>
        </div>
      </div>
      <div className="border-b border-hair bg-paper/60 px-3 py-2 text-[12.5px]">
        <span className="mono-label mr-2 text-[8.5px] text-ink/40">Subject</span>
        <span className="font-medium">{subject || <span className="text-ink/30">No subject yet</span>}</span>
        <span className="ml-2 text-ink/40">· from Justin | Interstellar Strategies</span>
        {kind === "mass" && <span className="ml-2"><Pill tone="flame">Unsubscribe link added</Pill></span>}
        {missing.length > 0 && <span className="ml-2"><Pill tone="warn">Missing: {missing.join(", ")}</Pill></span>}
      </div>
      <div className="flex-1 overflow-auto bg-[#ebe8e4] p-3">
        <div className="mx-auto transition-all" style={{ width: device === "mobile" ? 390 : "100%", maxWidth: device === "mobile" ? 390 : 720 }}>
          <iframe
            ref={frame}
            title="Email preview"
            srcDoc={html}
            onLoad={fit}
            sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            className={`block w-full border-0 bg-[#ebe8e4] ${device === "mobile" ? "shadow-[0_0_0_1px_rgba(0,0,0,0.08)]" : ""}`}
            style={{ height }}
          />
        </div>
      </div>
    </div>
  );
}
