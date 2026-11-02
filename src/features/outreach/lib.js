import { base44 } from "@/api/base44Client";

// Backlinks & Citations: shared constants and helpers.
// The browser never sends email. It only edits records; Claude scheduled tasks
// (see docs/outreach-agent.md) do research, sending and reply checks.

export const RULES_KEY = "outreach_rules";

export const DEFAULT_RULES = {
  sender_email: "justin@interstellar-strategies.com",
  sender_name: "Justin Cowell",
  daily_cap: 20,
  follow_up_days: 7,
  max_follow_ups: 1,
  same_domain_days: 14,
  research_per_run: 15,
  sending_paused: false,
  signature:
    "Justin Cowell\nFounder, Interstellar Strategies\njustin@interstellar-strategies.com",
  opt_out_line: "If you'd rather not hear from me again, just reply \"no thanks\" and I won't follow up.",
  blocked_domains: [],
};

export const TARGET_STATUSES = [
  ["discovered", "Discovered"],
  ["qualified", "Qualified"],
  ["drafted", "Drafted"],
  ["approved", "Approved"],
  ["sent", "Sent"],
  ["replied", "Replied"],
  ["won", "Won (live)"],
  ["lost", "Lost"],
  ["declined", "Declined"],
  ["skip", "Skip"],
];
export const STATUS_LABEL = Object.fromEntries(TARGET_STATUSES);
export const CLOSED = ["lost", "declined", "skip"];

export const BOARD_COLUMNS = [
  { key: "discovered", label: "Discovered", statuses: ["discovered"] },
  { key: "qualified", label: "Qualified", statuses: ["qualified"] },
  { key: "drafted", label: "Drafted", statuses: ["drafted"] },
  { key: "approved", label: "Approved", statuses: ["approved"] },
  { key: "sent", label: "Sent", statuses: ["sent"] },
  { key: "replied", label: "Replied", statuses: ["replied"] },
  { key: "won", label: "Won", statuses: ["won"] },
  { key: "closed", label: "Lost / skip", statuses: CLOSED },
];

export const KINDS = [
  ["citation_directory", "Citation directory"],
  ["data_aggregator", "Data aggregator"],
  ["industry_directory", "Industry directory"],
  ["local_news", "Local news"],
  ["national_news", "National news"],
  ["trade_publication", "Trade publication"],
  ["blog_guest_post", "Blog / guest post"],
  ["podcast", "Podcast"],
  ["association_chamber", "Association / chamber"],
  ["awards_lists", "Awards / lists"],
  ["journalist_request", "Journalist request"],
  ["resource_page", "Resource page"],
  ["review_site", "Review site"],
  ["community_calendar", "Community calendar"],
  ["other", "Other"],
];
export const KIND_LABEL = Object.fromEntries(KINDS);

export const METHODS = [
  ["email", "Email pitch"],
  ["web_form", "Web form"],
  ["account_signup", "Account / listing signup"],
  ["phone", "Phone"],
  ["mail", "Mail"],
  ["unknown", "Unknown"],
];
export const METHOD_LABEL = Object.fromEntries(METHODS);
export const HUMAN_METHODS = ["web_form", "account_signup", "phone", "mail"];

export const MSG_STATUS_LABEL = {
  draft: "Draft",
  needs_approval: "Needs approval",
  approved: "Approved",
  sent: "Sent",
  replied: "Replied",
  bounced: "Bounced",
  rejected: "Rejected",
  rewrite_requested: "Rewrite requested",
  failed: "Failed",
};

export const inputCls =
  "w-full border border-hair bg-paper px-3 py-2 text-[13px] text-ink outline-none transition-colors placeholder:text-ink/35 focus:border-[#ff3c00]";

export const nowIso = () => new Date().toISOString();

export function domainOf(u) {
  if (!u) return "";
  const s = String(u).trim();
  if (s.includes("@") && !s.includes("/")) return s.split("@").pop().toLowerCase().replace(/^www\./, "");
  try {
    return new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || "").trim());

export function isBlocked(rules, ...urls) {
  const list = (rules?.blocked_domains || []).map((d) => domainOf(d) || String(d).toLowerCase()).filter(Boolean);
  return urls.some((u) => {
    const d = domainOf(u);
    return d && list.some((b) => d === b || d.endsWith(`.${b}`));
  });
}

// ---------- Client criteria (what research needs before it can run) ----------

const first = (...vals) => {
  for (const v of vals) {
    if (Array.isArray(v) ? v.length : v != null && String(v).trim() !== "") return v;
  }
  return "";
};

export function mergedCriteria(client = {}, dossier = {}, profile = {}) {
  const sa = dossier?.service_area || {};
  const cities = (sa.cities || []).map((c) => [c.city, c.state].filter(Boolean).join(", ")).filter(Boolean);
  const dossierServices = (dossier?.services || []).map((s) => s?.name).filter(Boolean);
  return {
    name: first(profile.nap_name, client.business),
    address: first(profile.nap_address),
    phone: first(profile.nap_phone, (client.phones || [])[0]),
    website: first(profile.website, client.domain, (client.websites || [])[0]),
    industry: first(profile.industry, client.industry),
    services: first(profile.services, dossierServices),
    city: first(profile.city, sa.primary_city, client.location),
    service_area: first(profile.service_area, cities.join("; "), [sa.model, sa.radius].filter(Boolean).join(" · ")),
    description: first(profile.description, dossier?.elevator_pitch, dossier?.tagline),
  };
}

export const CRITERIA = [
  { key: "industry", label: "Industry", required: true, field: "industry" },
  { key: "services", label: "Services", required: true, field: "services", list: true },
  { key: "city", label: "City", required: true, field: "city" },
  { key: "service_area", label: "Service area", required: false, field: "service_area" },
  { key: "name", label: "NAP · Name", required: true, field: "nap_name" },
  { key: "address", label: "NAP · Address", required: true, field: "nap_address" },
  { key: "phone", label: "NAP · Phone", required: true, field: "nap_phone" },
  { key: "website", label: "Website", required: true, field: "website" },
  { key: "description", label: "Description", required: true, field: "description", long: true },
];

export function criteriaCheck(merged) {
  const has = (v) => (Array.isArray(v) ? v.length > 0 : !!String(v || "").trim());
  const missing = CRITERIA.filter((c) => c.required && !has(merged[c.key])).map((c) => c.label);
  const soft = CRITERIA.filter((c) => !c.required && !has(merged[c.key])).map((c) => c.label);
  return { ready: missing.length === 0, missing, soft };
}

export function napBlock(m) {
  return [
    m.name,
    m.address,
    m.phone,
    m.website,
    m.industry && `Category: ${m.industry}`,
    Array.isArray(m.services) && m.services.length ? `Services: ${m.services.join(", ")}` : "",
    m.description,
  ].filter(Boolean).join("\n");
}

// ---------- Rules (AppSettings key = outreach_rules, stored in automationSettings) ----------

export async function loadRules() {
  const rows = await base44.entities.AppSettings.filter({ key: RULES_KEY }, "-created_date", 1).catch(() => []);
  const rec = Array.isArray(rows) ? rows[0] : null;
  return { id: rec?.id || null, rules: { ...DEFAULT_RULES, ...(rec?.automationSettings || {}) } };
}

export async function saveRules(id, rules) {
  const clean = {
    ...rules,
    daily_cap: Math.max(0, Number(rules.daily_cap) || 0),
    follow_up_days: Math.max(1, Number(rules.follow_up_days) || 7),
    max_follow_ups: Math.max(0, Number(rules.max_follow_ups) || 0),
    same_domain_days: Math.max(0, Number(rules.same_domain_days) || 0),
    research_per_run: Math.max(1, Number(rules.research_per_run) || 15),
    blocked_domains: (rules.blocked_domains || []).map((d) => domainOf(d) || String(d).trim().toLowerCase()).filter(Boolean),
  };
  if (id) {
    await base44.entities.AppSettings.update(id, { automationSettings: clean });
    return id;
  }
  const created = await base44.entities.AppSettings.create({ key: RULES_KEY, automationSettings: clean });
  return created?.id || null;
}

// ---------- CSV paste import ----------

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = "";
  let q = false;
  const s = String(text || "").replace(/\r\n?/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (q) {
      if (ch === '"' && s[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') q = false;
      else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === "," || ch === "\t") { row.push(cur); cur = ""; }
    else if (ch === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
    else cur += ch;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some(Boolean));
}

const CSV_ALIASES = {
  name: ["name", "outlet", "site", "directory", "title"],
  url: ["url", "website", "homepage", "link"],
  submission_url: ["submission_url", "submit", "submit_url", "submission", "add_listing"],
  kind: ["kind", "type", "category"],
  contact_name: ["contact_name", "contact"],
  contact_email: ["contact_email", "email"],
  contact_form_url: ["contact_form_url", "form", "contact_form"],
  submission_method: ["submission_method", "method"],
  cost: ["cost", "price"],
  relevance: ["relevance", "why"],
  requirements: ["requirements"],
  notes: ["notes", "note"],
  client_name: ["client", "client_name"],
};

export function csvToTargets(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.toLowerCase().replace(/\s+/g, "_"));
  const known = Object.values(CSV_ALIASES).flat();
  const hasHeader = head.some((h) => known.includes(h));
  const idx = {};
  if (hasHeader) {
    for (const [field, aliases] of Object.entries(CSV_ALIASES)) {
      const i = head.findIndex((h) => aliases.includes(h));
      if (i >= 0) idx[field] = i;
    }
  } else {
    Object.assign(idx, { name: 0, url: 1, submission_url: 2, kind: 3, contact_email: 4 });
  }
  const kindKeys = KINDS.map(([k]) => k);
  return (hasHeader ? rows.slice(1) : rows).map((r) => {
    const t = {};
    for (const [f, i] of Object.entries(idx)) if (r[i]) t[f] = r[i];
    if (t.kind) {
      const k = t.kind.toLowerCase().replace(/[\s/]+/g, "_");
      t.kind = kindKeys.includes(k) ? k : KINDS.find(([, l]) => l.toLowerCase() === t.kind.toLowerCase())?.[0] || "other";
    }
    if (t.cost) {
      const c = t.cost.toLowerCase();
      t.cost_amount = /\d/.test(c) ? t.cost : undefined;
      t.cost = c.includes("free") ? "free" : /\d|paid/.test(c) ? "paid" : "unknown";
    }
    if (t.submission_method && !METHODS.some(([m]) => m === t.submission_method)) t.submission_method = "unknown";
    if (!t.name && t.url) t.name = domainOf(t.url);
    return t;
  }).filter((t) => t.name);
}
