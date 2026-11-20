// Client pillars: the same 8 pillars the Business Brain tags facts with (BrainFact.pillar): sales, marketing,
// delivery (operations), finance, clients (customer experience), team, systems (tech & SEO plumbing), owner
// (goals & strategy). KEEP IDENTICAL to src/lib/clientPillars.js (the portal computes the client-friendly version
// server-side with this file).
// Each pillar gets a 0-100 score ONLY from real data: Brain sections (BusinessBrain.sections, scored the way Brain
// completeness is) plus system signals (automation health and lateness, open cracks from audits, open requests and
// response times, content cadence). When there isn't enough, the pillar says "Not enough info" and what is needed.
// Never a guessed score.
export const CLIENT_PILLARS = [
  { id: "marketing", name: "Marketing", client: "Getting found", sections: ["content", "brand", "audience"] },
  { id: "sales", name: "Sales", client: "Winning customers", sections: ["offer_pricing", "audience", "contacts_channels"] },
  { id: "delivery", name: "Operations", client: "Running the work", sections: ["problems", "apps_systems"] },
  { id: "clients", name: "Customer experience", client: "Happy customers", sections: ["gbp_listings", "audience"] },
  { id: "systems", name: "Search & systems", client: "Website & search", sections: ["website_logins", "apps_systems", "gbp_listings"] },
  { id: "finance", name: "Finance", client: "Money", sections: ["billing", "offer_pricing"] },
  { id: "team", name: "Team", client: "Team", sections: ["contacts_channels"] },
  { id: "owner", name: "Goals & strategy", client: "Goals", sections: ["goals", "decisions", "competitors"] },
];

const DAY = 864e5;
const s = (v) => (v == null ? "" : String(v)).trim();
const UNKNOWN_RE = /^\s*(unknown|n\/a|none|tbd)\.?\s*$/i;
// 1 solid, 0.5 thin/low confidence, 0 empty (same as brainCompleteness).
function secScore(sec) {
  const t = s(sec && sec.text);
  if (!t || UNKNOWN_RE.test(t) || (sec && sec.confidence === "unknown")) return 0;
  if (t.length < 60 || (sec && sec.confidence === "low")) return 0.5;
  return 1;
}
const SEC_LABEL = { content: "content history & schedule", brand: "brand", audience: "audience", offer_pricing: "offer & pricing", contacts_channels: "contacts & team", problems: "problems & gaps", apps_systems: "apps & systems", gbp_listings: "Google profile & reviews", website_logins: "website platform", billing: "billing", goals: "goals", decisions: "decisions", competitors: "competitors" };

// Expected gap between runs, from a schedule string ("twice weekly", "daily", "weekly", "monthly", cron …).
export function expectedGapDays(schedule) {
  const t = s(schedule).toLowerCase();
  if (!t) return null;
  if (/hour/.test(t)) return 1;
  if (/daily|every day|nightly/.test(t)) return 1;
  if (/twice[- ]?(a )?week|2x ?week|tue.*thu|mon.*thu|2 ?times a week/.test(t)) return 3.5;
  if (/week/.test(t)) return 7;
  if (/twice[- ]?(a )?month|biweekly|fortnight/.test(t)) return 15;
  if (/month/.test(t)) return 31;
  const cron = t.split(/\s+/);
  if (cron.length === 5) {
    if (cron[4] !== "*") return 7 / Math.max(1, cron[4].split(",").length);
    if (cron[2] !== "*") return 31;
    return 1;
  }
  return null;
}

// Automation health: failed, off, overdue against its schedule, or no "went live" confirmation.
export function automationIssue(a, now = Date.now()) {
  const status = s(a.status).toLowerCase();
  if (status === "error" || s(a.last_result).toLowerCase() === "error" || s(a.last_result).toLowerCase() === "failed") return { kind: "failed", reason: `Last run failed${a.last_message ? `: ${s(a.last_message).slice(0, 80)}` : ""}` };
  if (status === "paused" || status === "off" || status === "disabled") return { kind: "off", reason: "Switched off" };
  // Live-site automations (Search Console, IndexNow, Bing) wait in "setup" until the client's domain is connected and
  // verified (Justin, Nov 19 2026). Waiting for the domain is the plan, not a problem.
  if (status === "setup" && (/^(search_console|bing|indexnow|rich_results|schema_check)$/.test(s(a.kind)) || /search console|indexnow|bing webmaster/i.test(s(a.name)))) return null;
  const gap = expectedGapDays(a.schedule);
  const last = a.last_run_at ? Date.parse(a.last_run_at) : NaN;
  if (gap && Number.isFinite(last) && now - last > Math.max(gap * 2, gap + 2) * DAY) return { kind: "overdue", reason: `Last ran ${Math.round((now - last) / DAY)}d ago on a ${s(a.schedule)} schedule` };
  if (gap && !Number.isFinite(last)) return { kind: "never", reason: "Has never run" };
  if (a.next_run_at && Date.parse(a.next_run_at) < now - 2 * DAY) return { kind: "overdue", reason: "Next run is in the past" };
  if (/blog|gbp|post/i.test(`${a.kind} ${a.name}`) && s(a.last_result).toLowerCase() === "success" && a.verified_live === false) return { kind: "unverified", reason: "Ran, but no went-live confirmation" };
  return null;
}

const tone = (score) => (score == null ? "none" : score >= 70 ? "green" : score >= 45 ? "amber" : "red");

/**
 * ctx = { brain, automations, gaps, requests, work, now }
 * → [{ id, name, client, score (0-100 or null), tone, verdict, fix, needs }]
 */
export function scorePillars(ctx) {
  const now = ctx.now || Date.now();
  const sections = (ctx.brain && ctx.brain.sections) || {};
  const autos = (ctx.automations || []).filter((a) => s(a.status) !== "archived");
  const issues = autos.map((a) => ({ a, i: automationIssue(a, now) })).filter((x) => x.i);
  const gapsOpen = (ctx.gaps || []).filter((g) => !["fixed"].includes(s(g.status)));
  const reqOpen = (ctx.requests || []).filter((r) => ["received", "in_progress", "needs_info"].includes(s(r.status)));
  const oldReq = reqOpen.filter((r) => now - Date.parse(r.created_date || r.submitted_at || now) > 5 * DAY);
  const work = ctx.work || [];
  const lastOf = (re) => { const d = work.filter((w) => re.test(`${w.kind} ${w.title}`)).map((w) => Date.parse(w.date || w.created_date)).filter(Number.isFinite).sort((a, b) => b - a)[0]; return d ? Math.round((now - d) / DAY) : null; };
  const blogAge = lastOf(/blog/i);
  const gbpAge = lastOf(/gbp|google post/i);
  const areaGaps = (re) => gapsOpen.filter((g) => re.test(`${g.area} ${g.title}`));
  const autoIssues = (re) => issues.filter((x) => re.test(`${x.a.kind} ${x.a.name}`));

  return CLIENT_PILLARS.map((p) => {
    const parts = p.sections.map((k) => secScore(sections[k]));
    const known = parts.filter((x) => x > 0).length;
    const missing = p.sections.filter((k) => secScore(sections[k]) === 0).map((k) => SEC_LABEL[k] || k);
    let base = known ? (parts.reduce((a, b) => a + b, 0) / parts.length) * 100 : null;
    const notes = [];
    let fix = "";
    let signals = 0;
    const penalize = (pts, note, f) => { base = (base == null ? 80 : base) - pts; notes.push(note); if (!fix && f) fix = f; signals++; };
    const credit = (note) => { if (base == null) base = 75; notes.push(note); signals++; };

    if (p.id === "marketing") {
      const bad = autoIssues(/blog|gbp|post|social|content/i);
      bad.forEach((x) => penalize(15, `${x.a.name}: ${x.i.reason.toLowerCase()}`, `Fix and re-run "${x.a.name}"`));
      if (blogAge != null) { if (blogAge > 21) penalize(15, `blogs ${blogAge}d late`, "Publish the next blog post and get the schedule back on track"); else credit(`last blog ${blogAge}d ago`); }
      if (gbpAge != null && gbpAge > 21) penalize(10, `GBP posts ${gbpAge}d late`, "Post to the Google Business Profile this week");
      areaGaps(/content|social|marketing|brand/i).forEach((g) => penalize(8, g.title, g.recommendation || g.title));
    } else if (p.id === "systems") {
      const bad = autoIssues(/endpoint|portal|sync|feed|form|audit|report|function|workflow/i);
      bad.forEach((x) => penalize(12, `${x.a.name}: ${x.i.reason.toLowerCase()}`, `Fix "${x.a.name}"`));
      areaGaps(/seo|search|schema|speed|site|technical|citation|listing/i).forEach((g) => penalize(8, g.title, g.recommendation || g.title));
      if (autos.length && !bad.length) credit(`${autos.length} automations healthy`);
    } else if (p.id === "clients") {
      if (oldReq.length) penalize(10 * Math.min(3, oldReq.length), `${oldReq.length} request${oldReq.length === 1 ? "" : "s"} open over 5 days`, "Answer the oldest open request");
      else if (reqOpen.length || (ctx.requests || []).length) credit("requests answered on time");
      areaGaps(/review|reputation|customer/i).forEach((g) => penalize(8, g.title, g.recommendation || g.title));
    } else if (p.id === "delivery") {
      areaGaps(/operation|process|delivery|crew|schedul/i).forEach((g) => penalize(8, g.title, g.recommendation || g.title));
    } else if (p.id === "sales") {
      areaGaps(/sales|lead|conversion|quote|booking/i).forEach((g) => penalize(8, g.title, g.recommendation || g.title));
    }

    if (base == null || (known === 0 && signals === 0)) {
      return { id: p.id, name: p.name, client: p.client, score: null, tone: "none", verdict: `${p.name}: not enough info`, fix: missing.length ? `Fill the Brain: ${missing.join(", ")}` : "", needs: missing };
    }
    const score = Math.max(0, Math.min(100, Math.round(base)));
    if (!fix && missing.length) fix = `Fill the Brain: ${missing.join(", ")}`;
    const verdict = notes.length ? `${p.name}: ${notes.slice(0, 2).join(", ")}` : missing.length ? `${p.name}: Brain is thin on ${missing.join(", ")}` : `${p.name}: in good shape`;
    return { id: p.id, name: p.name, client: p.client, score, tone: tone(score), verdict, fix, needs: missing };
  });
}

export const weakestPillar = (pillars) => (pillars || []).filter((p) => p.score != null).sort((a, b) => a.score - b.score)[0] || null;

// Client-friendly version for the portal: no internal fixes, gentle wording.
export function portalPillars(pillars) {
  return (pillars || []).map((p) => ({ id: p.id, label: p.client, score: p.score, tone: p.tone, line: p.score == null ? "We're still learning about this" : p.tone === "green" ? "Looking strong" : p.tone === "amber" ? "We're working on it" : "Top of our list" }));
}
