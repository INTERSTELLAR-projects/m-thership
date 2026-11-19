// Private usage log of Justin's own Møthership sessions (admin only, no third-party analytics). Page views and the
// main actions go to the UsageEvent entity in small batches, with the time since the previous step. Off in
// Presentation mode, QA/demo previews and the client portal. Read by More > How you use it (src/pages/UsageInsights.jsx).
import { base44 } from "@/api/base44Client";
import { IS_QA } from "@/lib/qa";
import { cleanPath } from "@/lib/usageSummary";
import { IS_PRESENTING } from "@/lib/presentation";

let enabled = false;
let queue = [];
let timer = null;
let last = { at: 0, path: "" };
const session = (() => { try { return sessionStorage.getItem("ms_usage_sid") || (sessionStorage.setItem("ms_usage_sid", Math.random().toString(36).slice(2, 10)), sessionStorage.getItem("ms_usage_sid")); } catch { return Math.random().toString(36).slice(2, 10); } })();

export function enableUsageLog(user) {
  enabled = !!(user && user.role === "admin") && !IS_QA && !IS_PRESENTING;
}

function flush() {
  timer = null;
  if (!queue.length) return;
  const rows = queue.splice(0, queue.length);
  const api = base44.entities.UsageEvent;
  if (!api) return;
  (api.bulkCreate ? api.bulkCreate(rows) : Promise.all(rows.map((r) => api.create(r)))).catch(() => { /* best effort */ });
}

function push(kind, path, label) {
  if (!enabled) return;
  const t = Date.now();
  queue.push({ kind, path, label: String(label || "").slice(0, 120), prev_path: last.path, ms_since_prev: last.at ? Math.min(t - last.at, 6 * 3600e3) : null, session_id: session, at: new Date(t).toISOString() });
  last = { at: t, path };
  if (!timer) timer = setTimeout(flush, 8000);
  if (queue.length >= 20) flush();
}

// Route path with only the tab query kept (?tab=… is a real page; other query values are not stored).
export { cleanPath };

export const logPageView = (location, label) => push("page_view", cleanPath(location), label);
export const logAction = (name) => push("action", typeof window !== "undefined" ? cleanPath(window.location) : "", name);

if (typeof window !== "undefined") window.addEventListener("beforeunload", flush);
