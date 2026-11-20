// Automations, grouped by job and checked for health in plain words (Nov 2026 redesign).
// Pure helpers so they can be unit tested; the board component renders them.
import { expectedGapDays } from "@/lib/clientPillars";
import { isLiveSiteAutomation, startsWhenText } from "@/lib/buildTemplates";

const DAY = 86400000;
const t = (v) => String(v || "").toLowerCase();

export const JOB_GROUPS = [
  { id: "content", label: "Content", hint: "Blogs, Google posts, project and city pages" },
  { id: "website", label: "Website & reviews", hint: "Search checks, reviews, site audits, forms and leads" },
  { id: "billing", label: "Billing (Stripe)", hint: "Subscriptions, invoices and money" },
  { id: "plumbing", label: "System plumbing", hint: "Queues, syncs, digests and internal jobs", collapsed: true },
];

export function jobGroupOf(row) {
  const hay = t(`${row.name} ${row.kind} ${row.description} ${(row.channels || []).join(" ")}`);
  if (row.source === "stripe_webhook" || /stripe|billing|invoice|subscription|financ|mrr/.test(hay)) return "billing";
  if (/blog|gbp|google post|project page|city page|portfolio|case-study|content|social/.test(hay) || ["blog", "gbp_post", "project_page"].includes(row.kind)) return "content";
  if (/search console|review|pagespeed|site audit|schema|rich result|citation|bing|analytics|request form|lead intake|website/.test(hay) || ["search_console", "analytics", "bing", "schema_check", "rich_results", "citations"].includes(row.kind)) return "website";
  return "plumbing";
}

// Expected days between runs: from the cron if there is one (CRON_TZ prefix stripped), else the plain schedule.
export function gapOf(row) {
  const cron = String(row.cron || "").replace(/^CRON_TZ=\S+\s+/, "").trim();
  if (cron && cron.split(/\s+/).length === 5) {
    const [, hour, dom, , dow] = cron.split(/\s+/);
    if (dow !== "*") return 7 / Math.max(1, dow.split(",").length);
    if (dom !== "*") return 31 / Math.max(1, dom.split(",").length);
    if (/[-,/]/.test(hour) || hour === "*") return 1;
    return 1;
  }
  const sched = String(row.schedule || "");
  if (/^(on |when |manual|not scheduled|—)/i.test(sched.trim())) return null;
  return expectedGapDays(sched);
}

const schedWord = (gap) => (gap <= 1 ? "daily" : gap <= 4 ? "twice-weekly" : gap <= 7 ? "weekly" : gap <= 16 ? "twice-monthly" : "monthly");

/** → null | { kind: failed|off|overdue|never|unverified, reason, fix: rerun|claude|open } */
export function rowIssue(row, now = Date.now()) {
  if (row.status === "failing") return { kind: "failed", reason: `Last run failed${row.notes ? `: ${String(row.notes).slice(0, 90)}` : ""}`, fix: "claude" };
  if (row.status === "paused" && row.cron) return { kind: "off", reason: "Switched off, so it is not running on its schedule", fix: "open" };
  if (row.status === "paused" && row.origin === "registry") return { kind: "off", reason: "Paused for this client", fix: "open" };
  const gap = gapOf(row);
  const last = row.lastAt ? new Date(row.lastAt).getTime() : NaN;
  if (gap && row.enabled !== false && Number.isFinite(last) && now - last > Math.max(gap * 2, gap + 2) * DAY) {
    const days = Math.round((now - last) / DAY);
    const late = Math.max(0, Math.round(days - gap));
    return { kind: "overdue", reason: `${late}d late: last ran ${days}d ago on a ${schedWord(gap)} schedule`, fix: "rerun" };
  }
  if (gap && row.enabled !== false && !Number.isFinite(last) && row.status !== "setup") return { kind: "never", reason: "Scheduled but has never run", fix: "rerun" };
  const run = row.lastRun;
  if (run && jobGroupOf(row) === "content" && run.status !== "failed" && run.processed && run.verified_live === false && run.output_url) {
    return { kind: "unverified", reason: "Ran, but the page it made was not confirmed live", fix: "open" };
  }
  return null;
}

export function lastResultWords(row) {
  if (!row.lastAt) return row.lastStatus === "never" ? "Never ran" : "Not tracked";
  if (row.lastStatus === "failed") return "Failed";
  if (row.lastStatus === "skipped") return "Skipped";
  return "Worked";
}

export function scopeMatch(row, scope) {
  if (scope === "client") return row.scope === "client";
  if (scope === "every") return row.scope === "all_clients";
  if (scope === "agency") return row.scope === "agency" || row.scope === "personal";
  return true;
}

// Live-site automations of a client whose domain isn't connected yet: shown as "Starts when <domain> is connected",
// never flagged. awaiting = Set of client ids still waiting for their domain; clientsById for the domain name.
export function waitingForDomain(row, awaiting, clientsById) {
  if (!isLiveSiteAutomation({ kind: row.kind, name: row.name })) return "";
  const id = (row.clientIds || [])[0];
  if (!id || !awaiting || !awaiting.has(id)) return "";
  return startsWhenText(clientsById && clientsById.get(id));
}
export function awaitingDomainIds(clients, checklistClientIds) {
  const out = new Set();
  for (const c of clients || []) if (!c.website_live_at && (c.status === "Lead" || c.website_published_at || (checklistClientIds && checklistClientIds.has(c.id)))) out.add(c.id);
  return out;
}
