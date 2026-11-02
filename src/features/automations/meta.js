// Shared vocabulary for the Automations hub (Settings > Automations, /automations, client cockpit card).

export const SOURCE_META = {
  claude_task: { label: "Claude scheduled task", short: "Claude task", color: "#ff3c00" },
  base44_workflow: { label: "Base44 workflow", short: "Workflow", color: "#1a1a1a" },
  base44_function: { label: "Base44 backend function", short: "Function", color: "#57534e" },
  stripe_webhook: { label: "Stripe webhook", short: "Stripe", color: "#635bff" },
  public_endpoint: { label: "Public endpoint", short: "Endpoint", color: "#0e7490" },
  client_registry: { label: "Client automation record", short: "Client record", color: "#ff6a00" },
};

export const CHANNEL_META = {
  email_justin: "Email to Justin",
  push: "Push notification",
  chat_package: "Copy-paste package",
  client_email_handoff: "Client email (you send)",
  website_change: "Client website change",
  website_feed: "Client website feed",
  mothership_records: "Møthership records",
  portal: "Client portal",
};

export const SCOPE_LABEL = { client: "Client", all_clients: "All clients", agency: "Agency", personal: "Personal" };

export const STATUS_META = {
  on: { label: "On", cls: "bg-[#ff3c00]/10 text-[#c23000]" },
  failing: { label: "Failing", cls: "bg-red-600/10 text-red-700" },
  paused: { label: "Paused", cls: "bg-ink/[0.07] text-ink/60" },
  setup: { label: "Setting up", cls: "bg-[#ff6a00]/12 text-[#a33a00]" },
};

// Registry (Automation entity) kind -> channel, so per-client records slot into the same filters.
export const KIND_CHANNEL = {
  blog: "website_change", gbp_post: "chat_package", project_page: "website_change", search_console: "mothership_records",
  analytics: "mothership_records", bing: "mothership_records", schema_check: "mothership_records", rich_results: "mothership_records",
  citations: "mothership_records", digest: "email_justin", email: "email_justin", other: "mothership_records",
};
export const RUNNER_LABEL = { claude_scheduled: "Claude scheduled task", base44_workflow: "Base44 workflow", base44_function: "Base44 function", manual: "Manual" };

// ---------- cron: next run (5 fields, optional CRON_TZ=Area/City prefix; whole-hour time zones) ----------
function parseField(f, min, max) {
  const out = new Set();
  for (const part of String(f).split(",")) {
    const [range, stepRaw] = part.split("/");
    const step = stepRaw ? Number(stepRaw) : 1;
    let a;
    let b;
    if (range === "*") { a = min; b = max; } else if (range.includes("-")) { [a, b] = range.split("-").map(Number); } else { a = Number(range); b = stepRaw ? max : a; }
    if (!Number.isFinite(a) || !Number.isFinite(b) || step < 1) return null;
    for (let i = a; i <= b; i += step) out.add(i);
  }
  return out;
}
const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function nextCronRun(expr, from = new Date()) {
  if (!expr) return null;
  let tz = "UTC";
  let s = String(expr).trim();
  const m = s.match(/^CRON_TZ=(\S+)\s+(.*)$/);
  if (m) { tz = m[1]; s = m[2]; }
  const parts = s.split(/\s+/);
  if (parts.length !== 5) return null;
  const [mi, ho, dom, mon, dow] = parts;
  const M = parseField(mi, 0, 59);
  const H = parseField(ho, 0, 23);
  const D = parseField(dom, 1, 31);
  const MO = parseField(mon, 1, 12);
  const W = parseField(dow, 0, 7);
  if (!M || !H || !D || !MO || !W) return null;
  if (W.has(7)) W.add(0);
  let fmt;
  try {
    fmt = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", weekday: "short" });
  } catch { return null; }
  const mins = [...M].sort((a, b) => a - b);
  const domStar = dom === "*";
  const dowStar = dow === "*";
  const now = from.getTime();
  let t = Math.floor(now / 3600000) * 3600000;
  for (let i = 0; i < 24 * 400; i += 1, t += 3600000) {
    const p = Object.fromEntries(fmt.formatToParts(new Date(t)).map((x) => [x.type, x.value]));
    const hr = Number(p.hour) % 24;
    if (!H.has(hr) || !MO.has(Number(p.month))) continue;
    const day = Number(p.day);
    const wd = WD[p.weekday];
    const dayOk = domStar && dowStar ? true : domStar ? W.has(wd) : dowStar ? D.has(day) : D.has(day) || W.has(wd);
    if (!dayOk) continue;
    const base = Number(p.minute) || 0;
    for (const mm of mins) {
      const cand = t + (mm - base) * 60000;
      if (cand > now) return new Date(cand);
    }
  }
  return null;
}

// ---------- formatting ----------
export function fmtWhen(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export function relTime(d) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  const diff = dt.getTime() - Date.now();
  const abs = Math.abs(diff);
  const unit = abs < 3600000 ? [Math.round(abs / 60000), "min"] : abs < 86400000 ? [Math.round(abs / 3600000), "h"] : [Math.round(abs / 86400000), "d"];
  const txt = `${unit[0]}${unit[1] === "min" ? " min" : unit[1]}`;
  return diff >= 0 ? `in ${txt}` : `${txt} ago`;
}

export const REFRESH_PROMPT = `Refresh the Møthership automation catalog (Base44 app 69d80bb06c5ad07a795df54e).
1. Call list_triggers with limit 100 and follow next_cursor until has_more is false. Read only: never create, update, fire or delete a scheduled task.
2. For each scheduled task build one AutomationCatalog entry: key "claude:<trigger id>", external_id, source "claude_task", name, a plain-English description and how_it_works (summarise the prompt, never paste it), schedule_human, cron, scope (client / all_clients / agency / personal), client_ids + client_names (match CRMClient by name in the prompt), channels (email_justin, push, chat_package, client_email_handoff, website_change, website_feed, mothership_records, portal), enabled, last_run_at + last_status (from last_run), next_run_at, run_match (AutomationRun automation_name values it logs).
3. Upsert them with the backend function automation-catalog: { action: "upsert", replace_source: "claude_task", entries: [...] } (or update_entities by key). Tasks no longer listed are marked paused, never deleted.
4. Also add any new Base44 workflows or backend functions that run on their own (source base44_workflow / base44_function / stripe_webhook / public_endpoint).
5. Report how many entries were created, updated and retired.`;
