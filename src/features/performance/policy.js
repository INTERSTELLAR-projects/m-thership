// Shared rules for site performance: who may be audited automatically, how scores are banded,
// and what a client is allowed to see. Scores only ever come from a real SiteAudit record.

// Sites still on Framer get no automatic audits (PowerLift until it moves to Base44).
export const AUTO_AUDIT_BLOCKED = [/power\s*lift/i];
export const isAutoAuditBlocked = (client) => AUTO_AUDIT_BLOCKED.some((re) => re.test(String(client?.business || "")));

// Clients never see a number below this; they see progress and fixes instead.
export const CLIENT_SCORE_FLOOR = 70;

export const CATEGORY_LABELS = { seo: "SEO", performance: "Performance", accessibility: "Accessibility", best_practices: "Best practices" };
export const CATEGORY_ORDER = ["seo", "performance", "accessibility", "best_practices"];

export function band(score) {
  if (score == null) return { label: "No data", tone: "muted", color: "rgba(255,255,255,0.25)" };
  if (score >= 90) return { label: "Excellent", tone: "good", color: "#34d399" };
  if (score >= 75) return { label: "Good", tone: "good", color: "#ffaa00" };
  if (score >= 50) return { label: "Needs work", tone: "warn", color: "#ff6a00" };
  return { label: "Poor", tone: "bad", color: "#ff3c00" };
}

export const SEVERITY = {
  critical: { label: "Critical", rank: 0, dot: "bg-[#ff3c00]", chip: "bg-[#ff3c00]/15 text-[#ff7a4d] border-[#ff3c00]/40" },
  high: { label: "High", rank: 1, dot: "bg-[#ff6a00]", chip: "bg-[#ff6a00]/15 text-[#ff9a55] border-[#ff6a00]/40" },
  medium: { label: "Medium", rank: 2, dot: "bg-[#ffaa00]", chip: "bg-[#ffaa00]/12 text-[#ffc566] border-[#ffaa00]/35" },
  low: { label: "Low", rank: 3, dot: "bg-white/40", chip: "bg-white/[0.06] text-white/60 border-white/15" },
};

export function siteUrl(client) {
  const raw = String(client?.domain || (client?.websites || [])[0] || "").trim();
  if (!raw) return "";
  return /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
}

// Core Web Vitals thresholds (Google): good / needs improvement / poor.
export const VITALS = [
  { key: "lcp_ms", field: "field_lcp_ms", label: "LCP", name: "Largest Contentful Paint", unit: "s", good: 2500, poor: 4000, fmt: (v) => (v / 1000).toFixed(1) },
  { key: "cls", field: "field_cls", label: "CLS", name: "Cumulative Layout Shift", unit: "", good: 0.1, poor: 0.25, fmt: (v) => Number(v).toFixed(2) },
  { key: "tbt_ms", field: "field_inp_ms", fieldLabel: "INP", label: "TBT", name: "Total Blocking Time (lab stand-in for INP)", unit: "ms", good: 200, poor: 600, fieldGood: 200, fieldPoor: 500, fmt: (v) => Math.round(v).toLocaleString() },
  { key: "fcp_ms", label: "FCP", name: "First Contentful Paint", unit: "s", good: 1800, poor: 3000, fmt: (v) => (v / 1000).toFixed(1) },
  { key: "si_ms", label: "SI", name: "Speed Index", unit: "s", good: 3400, poor: 5800, fmt: (v) => (v / 1000).toFixed(1) },
  { key: "ttfb_ms", label: "TTFB", name: "Server response time", unit: "ms", good: 800, poor: 1800, fmt: (v) => Math.round(v).toLocaleString() },
];

export function vitalTone(v, good, poor) {
  if (v == null) return "muted";
  if (v <= good) return "good";
  if (v <= poor) return "warn";
  return "bad";
}

// Fixes we count as "edits made" for a client: applied SeoFix records + logged site work.
export const EDIT_WORK_KINDS = ["site_edit", "schema", "new_page", "project_page", "search_console", "bing"];

// What a client may see. Pure function, so the portal backend can mirror it exactly.
export function clientHealthSummary({ audits = [], fixes = [], work = [] }) {
  const done = audits.filter((a) => typeof a.health_score === "number" && a.strategy !== "desktop")
    .sort((a, b) => String(a.run_at).localeCompare(String(b.run_at)));
  const latest = done[done.length - 1] || null;
  const score = latest?.health_score ?? null;
  const show = score != null && score >= CLIENT_SCORE_FLOOR;
  const fixesApplied = fixes.filter((f) => f.status === "applied" && f.portal_visible !== false).length;
  const edits = work.filter((w) => EDIT_WORK_KINDS.includes(w.kind) && w.status !== "failed" && w.portal_visible !== false).length;
  return {
    score: show ? score : null,
    band: show ? band(score).label : score != null ? "Improving" : null,
    // Only points at or above the floor, so a low early score is never revealed.
    trend: show ? done.filter((a) => a.health_score >= CLIENT_SCORE_FLOOR).slice(-12).map((a) => ({ date: String(a.run_at).slice(0, 10), score: a.health_score })) : [],
    fixes_applied: fixesApplied,
    edits_made: edits,
    last_checked: latest?.run_at || null,
  };
}
