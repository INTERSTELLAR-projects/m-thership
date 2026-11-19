// Summary of private usage events for More › How you use it (pure, unit tested).
export function summarize(events) {
  const views = events.filter((e) => e.kind === "page_view");
  const byPage = new Map();
  views.forEach((e) => byPage.set(e.path, (byPage.get(e.path) || 0) + 1));
  const top = [...byPage].sort((a, b) => b[1] - a[1]).slice(0, 12);
  // Repeated paths: page → page transitions in the same session.
  const pairs = new Map();
  views.forEach((e) => { if (e.prev_path && e.prev_path !== e.path) { const k = `${e.prev_path} → ${e.path}`; pairs.set(k, (pairs.get(k) || 0) + 1); } });
  const paths = [...pairs].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]).slice(0, 10);
  // Slow steps: median time spent before moving on, per page (only real gaps under 30 min).
  const dwell = new Map();
  views.forEach((e) => { if (e.prev_path && e.ms_since_prev > 0 && e.ms_since_prev < 30 * 60000) { const l = dwell.get(e.prev_path) || []; l.push(e.ms_since_prev); dwell.set(e.prev_path, l); } });
  const slow = [...dwell].map(([p, l]) => { const s = [...l].sort((a, b) => a - b); return [p, s[Math.floor(s.length / 2)], l.length]; }).filter(([, , n]) => n >= 2).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const actions = new Map();
  events.filter((e) => e.kind === "action").forEach((e) => actions.set(e.label, (actions.get(e.label) || 0) + 1));
  return { views: views.length, sessions: new Set(events.map((e) => e.session_id)).size, top, paths, slow, actions: [...actions].sort((a, b) => b[1] - a[1]) };
}


// Record ids become ":id" so pages group together; only ?tab= is kept from the query.
export function cleanPath(location) {
  const tab = new URLSearchParams(location.search || "").get("tab");
  const p = String(location.pathname || "/").replace(/\/[0-9a-f]{16,}(?=\/|$)/gi, "/:id");
  return tab ? `${p}?tab=${tab}` : p;
}
