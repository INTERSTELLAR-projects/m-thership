// Turns raw entities into orb rails. Pure functions — the hook feeds them, the pages draw them.
import { ORBIT_STAGES, PACKAGES } from "@/features/packages/registry";

const DAY = 86400000;
const today = () => new Date().toISOString().slice(0, 10);
const ageDays = (d) => (d ? (Date.now() - new Date(String(d).length === 10 ? d + "T12:00:00" : d).getTime()) / DAY : Infinity);
const uniq = (arr) => [...new Set(arr.filter(Boolean))];

const TYPE_TO_PKG = { website: "custom-website", app: "command-system", branding: "brand-arsenal", automation: "ops-command", marketing: "transmission", consulting: "intel-briefing", seo: "orbit-seo" };

export function templatesOf(pkg, templates) {
  return templates.filter((t) => pkg.service_keys.includes(t.service_key)).sort((a, b) => (a.sort_order || 100) - (b.sort_order || 100));
}

export function projectsOf(pkg, { projects, templates, tasks }) {
  const tpls = templatesOf(pkg, templates);
  const tplIds = new Set(tpls.map((t) => t.id));
  const tplNames = new Set(tpls.map((t) => t.name));
  const byTasks = new Set(tasks.filter((t) => t.project_id && (tplNames.has(t.sop_name) || (t.labels || []).some((l) => tplNames.has(l)))).map((t) => t.project_id));
  return projects.filter((p) => {
    if (p.service_key && pkg.service_keys.includes(p.service_key)) return true;
    if (p.sop_id && tplIds.has(p.sop_id)) return true;
    if (byTasks.has(p.id)) return true;
    // fallback: untyped-by-service projects go by project type
    return !p.service_key && !p.sop_id && TYPE_TO_PKG[p.type] === pkg.key && !byTasks.size;
  });
}

export function clientsOf(pkg, data) {
  const { clients, orbit } = data;
  const projs = projectsOf(pkg, data);
  const projClientIds = new Set(projs.map((p) => p.client_id).filter(Boolean));
  const orbitIds = new Set((orbit || []).map((o) => o.clientId).filter(Boolean));
  return clients
    .filter((c) => c.status !== "Inactive")
    .filter((c) => {
      if (projClientIds.has(c.id)) return true;
      if ((c.services_managed || []).some((s) => pkg.crm_services.includes(s))) return true;
      if ((c.services || []).some((s) => pkg.price_match.test(String(s.name || "")))) return true;
      if (pkg.key === "orbit-seo" && orbitIds.has(c.id)) return true;
      return false;
    })
    .sort((a, b) => (a.business || "").localeCompare(b.business || ""));
}

/* ---------- delivery packages: orbs are the SOP phases ---------- */
export function phasesOf(pkg, templates) {
  const phases = [];
  const titleToPhase = new Map();
  templatesOf(pkg, templates).forEach((t) =>
    (t.items || []).forEach((i) => {
      const ph = i.phase || "Steps";
      if (!phases.includes(ph)) phases.push(ph);
      titleToPhase.set(i.title, ph);
    })
  );
  return { phases, titleToPhase };
}

const shortPhase = (ph) => {
  // "Stage 4 · Refine" → "Refine" ; "Week 2–4 · Build" → "Build" ; "Month 0 · Google Business" → "Google Business"
  const parts = String(ph).split("·").map((s) => s.trim());
  return parts[parts.length - 1];
};

export function deliveryRail(pkg, client, data) {
  const { tasks, templates } = data;
  const { phases, titleToPhase } = phasesOf(pkg, templates);
  const tplNames = new Set(templatesOf(pkg, templates).map((t) => t.name));
  const projs = projectsOf(pkg, data).filter((p) => p.client_id === client.id);
  const projIds = new Set(projs.map((p) => p.id));
  const mine = tasks.filter((t) => t.client_id === client.id && (projIds.has(t.project_id) || tplNames.has(t.sop_name) || (t.labels || []).some((l) => tplNames.has(l))));
  const phaseOf = (t) => titleToPhase.get(t.sop_step || t.title) || (t.notes ? String(t.notes).split("·")[0].trim() : null);
  const launched = projs.length && projs.every((p) => ["launched", "done"].includes(p.status));
  const orbs = phases.map((ph) => {
    const rows = mine.filter((t) => phaseOf(t) === ph);
    const done = rows.filter((t) => t.status === "done");
    let state = "off";
    if (launched) state = "done";
    else if (!rows.length) state = mine.length ? "pending" : "off";
    else if (done.length === rows.length) state = "done";
    else if (rows.some((t) => t.status === "blocked" || (t.due_date && t.status !== "done" && t.due_date < today()))) state = "attention";
    else if (rows.some((t) => t.status === "doing" || t.timer_started_at) || done.length) state = "working";
    else state = "pending";
    const next = rows.filter((t) => t.status !== "done").sort((a, b) => (a.due_date || "9999").localeCompare(b.due_date || "9999"))[0];
    return { key: ph, label: shortPhase(ph), full: ph, state, done: done.length, total: rows.length, detail: next ? "Next: " + next.title + (next.due_date ? " · due " + next.due_date : "") : rows.length ? "All " + rows.length + " steps done" : "No steps yet" };
  });
  const total = mine.length, done = mine.filter((t) => t.status === "done").length;
  const overall = launched || (total && done === total) ? "done" : orbs.some((o) => o.state === "attention") ? "attention" : total ? "working" : "off";
  return { orbs, total, done, progress: total ? Math.round((done / total) * 100) : 0, overall, projects: projs, tasks: mine };
}

/* ---------- Ørbit: orbs are the autonomous pipeline ---------- */
export function orbitRail(client, data) {
  const { worklog, automations, intel, orbit, tasks } = data;
  const wl = worklog.filter((w) => w.client_id === client.id);
  const autos = automations.filter((a) => a.client_id === client.id);
  const auto = (kind) => autos.find((a) => a.kind === kind);
  const profile = (orbit || []).find((o) => o.clientId === client.id);
  const runningNow = (a) => a && a.last_run_at && ageDays(a.last_run_at) * 24 * 60 < 15 && !a.last_result;
  const stateFor = (a, doneWhen, { offWhenMissing = true } = {}) => {
    if (a && (a.status === "error" || a.last_result === "failed")) return "attention";
    if (runningNow(a)) return "working";
    if (doneWhen) return "done";
    if (a && a.status === "active") return "pending";
    if (a && a.status === "paused") return "attention";
    return offWhenMissing && !a ? "off" : "pending";
  };
  const latest = (kind, within, extra = () => true) => wl.filter((w) => w.kind === kind && ageDays(w.date || w.created_date) <= within && extra(w)).sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")))[0];

  const blogDraft = latest("blog", 7);
  const blogLive = latest("blog", 7, (w) => w.status === "live");
  const gbp = latest("gbp_post", 7);
  const gsc = latest("search_console", 14);
  const blogAuto = auto("blog"), gbpAuto = auto("gbp_post"), gscAuto = auto("search_console"), gaAuto = auto("analytics");

  const strategy = profile && profile.seoStrategy && Object.keys(profile.seoStrategy).length;
  const criteriaState = !profile ? "off" : strategy && profile.serviceType && profile.primaryLocation ? "done" : "attention";

  const freshIntel = intel.filter((i) => ageDays(i.brief_date) <= 1.5);
  const openActions = intel.filter((i) => i.status === "approved");
  const intelState = openActions.length ? "attention" : freshIntel.length ? "done" : intel.length ? "pending" : "off";

  const orbs = [
    { key: "criteria", state: criteriaState, detail: !profile ? "No Ørbit profile yet" : [profile.serviceType, profile.primaryLocation, strategy ? "strategy set" : "strategy missing"].filter(Boolean).join(" · ") },
    { key: "blog_draft", state: stateFor(blogAuto, Boolean(blogDraft)), detail: blogDraft ? blogDraft.title + " · " + blogDraft.date : blogAuto ? "Runs " + (blogAuto.schedule || "on schedule") : "No blog automation registered" },
    { key: "blog_live", state: blogLive ? (blogLive.verified_live ? "done" : "working") : blogDraft ? "pending" : stateFor(blogAuto, false), detail: blogLive ? (blogLive.verified_live ? "Verified live" : "Published, not yet verified") + " · " + blogLive.date : "Nothing published this cycle" },
    { key: "gbp", state: stateFor(gbpAuto, Boolean(gbp)), detail: gbp ? gbp.title + " · " + gbp.date : gbpAuto ? "Runs " + (gbpAuto.schedule || "on schedule") : "No GBP automation registered" },
    { key: "intel", state: intelState, detail: openActions.length ? openActions.length + " approved action(s) waiting to be implemented" : freshIntel.length ? freshIntel.length + " change(s) read in the last 24h" : "No fresh brief" },
    { key: "gsc", state: stateFor(gscAuto, Boolean(gsc)), detail: gsc ? gsc.title + " · " + gsc.date : gscAuto ? "Monitoring " + (gscAuto.schedule || "") : "Search Console not connected" },
    { key: "analytics", state: stateFor(gaAuto, gaAuto && gaAuto.status === "active"), detail: gaAuto ? "GA4 connected" : "Google Analytics not connected" }
  ].map((o) => ({ ...o, ...ORBIT_STAGES.find((s) => s.key === o.key), label: ORBIT_STAGES.find((s) => s.key === o.key).short, full: ORBIT_STAGES.find((s) => s.key === o.key).label }));

  const month = new Date(); month.setDate(1);
  const monthStart = month.toISOString().slice(0, 10);
  const thisMonth = wl.filter((w) => (w.date || "") >= monthStart);
  const overall = orbs.some((o) => o.state === "attention") ? "attention" : orbs.filter((o) => o.state === "done").length >= 5 ? "done" : orbs.some((o) => o.state !== "off") ? "working" : "off";
  return {
    orbs,
    overall,
    profile,
    automations: autos,
    worklog: wl,
    openTasks: tasks.filter((t) => t.client_id === client.id && t.status !== "done" && /ørbit|orbit/i.test(t.sop_name || (t.labels || []).join(" "))),
    counts: { blogs: thisMonth.filter((w) => w.kind === "blog").length, gbp: thisMonth.filter((w) => w.kind === "gbp_post").length, fixes: thisMonth.filter((w) => ["search_console", "schema", "site_edit", "citation"].includes(w.kind)).length }
  };
}

export function railFor(pkg, client, data) {
  return pkg.key === "orbit-seo" ? orbitRail(client, data) : deliveryRail(pkg, client, data);
}

// Summary for the Mission Control strip: per package, how many clients are fulfilled / in flight / need you.
export function packageSummary(pkg, data) {
  const clients = clientsOf(pkg, data);
  const rails = clients.map((c) => ({ client: c, rail: railFor(pkg, c, data) }));
  return {
    pkg,
    clients: clients.length,
    done: rails.filter((r) => r.rail.overall === "done").length,
    working: rails.filter((r) => r.rail.overall === "working").length,
    attention: rails.filter((r) => r.rail.overall === "attention").length,
    off: rails.filter((r) => r.rail.overall === "off").length,
    rails
  };
}

export const allSummaries = (data) => PACKAGES.map((p) => packageSummary(p, data));
export { uniq };
