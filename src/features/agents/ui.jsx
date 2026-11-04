import ReactMarkdown from "react-markdown";

export const STATUS_META = {
  live: { label: "Live", color: "#ff6a00", text: "#ffb27a" },
  paused: { label: "Paused", color: "#8d8680", text: "#bdb6af" },
  planned: { label: "Planned", color: "rgba(255,255,255,.55)", text: "rgba(244,239,233,.7)" },
  broken: { label: "Broken", color: "#ff4433", text: "#ff8a7f" },
};
export const STATUS_ORDER = ["live", "paused", "planned", "broken"];

export const KIND_LABELS = {
  claude_scheduled_task: "Claude scheduled task",
  base44_workflow: "Workflow",
  in_app_ai: "In-app AI",
  backend_function: "Backend function",
  manual_skill: "Skill (on demand)",
  client_app_workflow: "Client app workflow",
};
export const KIND_SHORT = {
  claude_scheduled_task: "Claude task",
  base44_workflow: "Workflow",
  in_app_ai: "In-app AI",
  backend_function: "Function",
  manual_skill: "Skill",
  client_app_workflow: "Client app",
};
export const AUTONOMY = { manual: "Manual", assisted: "Assisted", autonomous: "Fully autonomous" };

export function relTime(iso) {
  if (!iso) return "never";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "unknown";
  const s = Math.round((Date.now() - t) / 1000);
  const abs = Math.abs(s);
  const fut = s < 0;
  const f = (n, u) => `${fut ? "in " : ""}${n}${u}${fut ? "" : " ago"}`;
  if (abs < 60) return fut ? "in a moment" : "just now";
  if (abs < 3600) return f(Math.round(abs / 60), "m");
  if (abs < 86400) return f(Math.round(abs / 3600), "h");
  if (abs < 86400 * 30) return f(Math.round(abs / 86400), "d");
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
export const fmtDateTime = (iso) => (iso ? new Date(iso).toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "—");

export function StatusDot({ status, size = 9 }) {
  const m = STATUS_META[status] || STATUS_META.planned;
  if (status === "planned") return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, border: `1.5px dashed ${m.color}` }} />;
  return <span className="inline-block shrink-0 rounded-full" style={{ width: size, height: size, background: m.color, boxShadow: status === "live" ? "0 0 10px 1px rgba(255,106,0,.7)" : status === "broken" ? "0 0 8px rgba(255,68,51,.7)" : "none" }} />;
}

export function StatusPill({ status }) {
  const m = STATUS_META[status] || STATUS_META.planned;
  return (
    <span className="mono inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[.14em]" style={{ color: m.text, border: `1px solid ${status === "planned" ? "rgba(255,255,255,.18)" : m.color + "66"}`, background: status === "live" ? "rgba(255,60,0,.1)" : status === "broken" ? "rgba(255,68,51,.1)" : "transparent" }}>
      <StatusDot status={status} size={6} />
      {m.label}
    </span>
  );
}

export function Section({ title, right, children, className = "" }) {
  return (
    <section className={`border-t border-[var(--hair-d)] px-5 py-4 ${className}`}>
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <p className="eyebrow">{title}</p>
        {right}
      </div>
      {children}
    </section>
  );
}

export function Stat({ label, value, hint, accent }) {
  return (
    <div className="min-w-0 rounded-lg border border-[var(--hair-d)] bg-white/[0.02] px-3 py-2.5">
      <p className="eyebrow !text-[9.5px]">{label}</p>
      <p className={`mt-1 truncate text-[13.5px] font-medium ${accent ? "flame-txt" : "text-[var(--ink-d)]"}`} title={typeof value === "string" ? value : undefined}>{value ?? "—"}</p>
      {hint ? <p className="mt-0.5 truncate text-[11px] text-[var(--ink-s)]">{hint}</p> : null}
    </div>
  );
}

export function Tags({ items, empty = "—" }) {
  const list = (items || []).filter(Boolean);
  if (!list.length) return <p className="text-[12.5px] text-[var(--ink-s)]">{empty}</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {list.map((t) => <span key={t} className="mono rounded-md border border-[var(--hair-d)] px-2 py-0.5 text-[11px] text-[var(--ink-m)]">{t}</span>)}
    </div>
  );
}

export function Md({ children }) {
  return <div className="md text-[13px] leading-relaxed text-[var(--ink-m)]"><ReactMarkdown>{String(children || "")}</ReactMarkdown></div>;
}

export function Title({ children, accent }) {
  return (
    <h2 className="text-[22px] font-semibold leading-tight tracking-[-0.03em] text-white">
      {children}{accent ? <> <span className="text-[#ff3c00]">/{accent}</span></> : null}
    </h2>
  );
}

export function Empty({ children }) {
  return <p className="rounded-lg border border-dashed border-[var(--hair-d2)] px-3 py-3 text-[12.5px] text-[var(--ink-s)]">{children}</p>;
}

export function Spinner({ size = 14 }) {
  return <span className="inline-block animate-spin rounded-full border-2 border-white/20 border-t-[#ff6a00]" style={{ width: size, height: size }} />;
}
