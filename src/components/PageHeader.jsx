import { useLocation } from "react-router-dom";
import { hubFor } from "@/lib/nav";

// Site-style page header: (Section) label on the left, big title, mono subtitle, flame scrub line.
// The section label is the hub the page lives in (Today, Clients, Work…), so every header names the same
// place the sidebar does. Pages outside a hub fall back to the first part of their breadcrumb.
export default function PageHeader({ breadcrumb = "", rightText, title, children }) {
  const location = useLocation();
  const here = hubFor(location);
  const parts = String(breadcrumb).split("/").map((s) => s.trim()).filter(Boolean);
  const fallback = parts.length > 1 ? parts.slice(0, -1).join(" / ") : "Møthership";
  const section = here ? here.hub.label : fallback;
  const name = title || parts[parts.length - 1] || "";
  const words = name.split(" ");
  const last = words.length > 1 ? words.pop() : null;

  return (
    <div className="relative border-b border-hair px-5 pb-6 pt-7 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="label-cross text-ink/60">({section})</p>
          <h1 className="mt-3 text-[34px] font-semibold leading-[0.95] tracking-[-0.045em] text-ink md:text-[46px]">
            {last ? (
              <>
                {words.join(" ")} <span className="text-[#ff3c00]">/{last}</span>
              </>
            ) : (
              name
            )}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {rightText && <span className="mono-label text-[10.5px] text-ink/50">{rightText}</span>}
          {children}
        </div>
      </div>
      <span className="pointer-events-none absolute bottom-[-1px] left-0 h-[2px] w-40 flame-bg" />
    </div>
  );
}
