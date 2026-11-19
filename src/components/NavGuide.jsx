// "Where is everything?": a searchable map of every page and tab, one line each. Opens from the "?" button in the
// top bar and from ⌘K (event "navguide:open").
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { HelpCircle, Search, X, ArrowUpRight } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { guideEntries, searchGuide, openNavGuide } from "@/lib/navGuide";

export function NavGuideButton({ className = "" }) {
  return (
    <button type="button" onClick={openNavGuide} className={`flex items-center p-2 text-ink/60 hover:text-ink ${className}`} aria-label="Where is everything? Page guide" title="Where is everything?" data-testid="nav-guide-button">
      <HelpCircle className="h-4 w-4" />
    </button>
  );
}

export default function NavGuide() {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  useEffect(() => {
    const on = () => { setQ(""); setOpen(true); };
    window.addEventListener("navguide:open", on);
    return () => window.removeEventListener("navguide:open", on);
  }, []);
  const all = useMemo(() => guideEntries(), []);
  const list = useMemo(() => searchGuide(all, q), [all, q]);
  const groups = useMemo(() => {
    const m = new Map();
    list.forEach((e) => { if (!m.has(e.parent)) m.set(e.parent, []); m.get(e.parent).push(e); });
    return [...m];
  }, [list]);
  const go = (e) => { setOpen(false); navigate(e.path); };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[86vh] overflow-hidden border border-hair bg-canvas p-0 text-ink sm:max-w-2xl" data-testid="nav-guide">
        <div className="border-b border-hair px-5 pb-3 pt-5">
          <p className="ms-kicker">Navigation guide</p>
          <DialogTitle className="mt-1 text-[22px] font-semibold tracking-[-0.03em]">Where is <span className="text-[#ff3c00]">everything?</span></DialogTitle>
          <DialogDescription className="mt-1 text-[12.5px] text-ink/55">Every page, tab and sub-tab, one line each. Type what you're looking for.</DialogDescription>
          <label className="relative mt-3 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. invoices, portal, QR, email templates" aria-label="Search pages and tabs"
              className="h-10 w-full rounded-sm border border-hair bg-card pl-9 pr-9 text-[13.5px] outline-none focus:border-[#ff3c00]" />
            {q ? <button type="button" onClick={() => setQ("")} aria-label="Clear" className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink/40 hover:text-ink"><X className="h-3.5 w-3.5" /></button> : null}
          </label>
        </div>
        <div className="max-h-[60vh] overflow-y-auto px-5 py-3">
          {groups.length ? groups.map(([parent, items]) => (
            <section key={parent} className="mb-4">
              <p className="mono-label mb-1.5 text-[9.5px] text-ink/45">{parent}</p>
              <ul className="divide-y divide-hair rounded-sm border border-hair bg-card">
                {items.map((e) => (
                  <li key={`${e.path}-${e.label}`}>
                    <button type="button" onClick={() => go(e)} className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-[#ff3c00]/[0.05]">
                      <span className="w-44 shrink-0 text-[13px] font-medium text-ink">{e.label}</span>
                      <span className="min-w-0 flex-1 text-[12px] leading-snug text-ink/55">{e.hint}</span>
                      <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink/30" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )) : <p className="py-8 text-center text-[13px] text-ink/50">Nothing matches “{q}”. Try a simpler word.</p>}
        </div>
      </DialogContent>
    </Dialog>
  );
}
