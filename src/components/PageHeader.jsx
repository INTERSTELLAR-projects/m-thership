// Site-style page header: (Section) label on the left, big title, mono subtitle, flame scrub line.
export default function PageHeader({ breadcrumb = "", rightText, title, children }) {
  const parts = String(breadcrumb).split("/").map((s) => s.trim()).filter(Boolean);
  const section = parts.length > 1 ? parts.slice(0, -1).join(" / ") : "Møthership";
  const name = title || parts[parts.length - 1] || "";
  const words = name.split(" ");
  const last = words.length > 1 ? words.pop() : null;

  return (
    <div className="relative border-b border-hair px-5 pb-6 pt-7 md:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="label-cross text-ink/60">({section.replace(/^Command Center$/, "Command").replace(/^Portal$/, "Command")})</p>
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
