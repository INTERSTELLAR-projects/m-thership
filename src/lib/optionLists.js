// Editable dropdown lists (Settings > Lists & fields).
// Defaults live here (they are the values the app shipped with); Justin's edits are stored in ONE record,
// AppSettings { key: "option_lists", optionLists: { <listKey>: [{ value, label, archived }] } }.
// Rules: a value is never rewritten once records use it (only its label changes); "archive" hides it from
// pickers but keeps it readable; only unused custom values can be deleted. Read with useOptionList(key).
import { SOURCES, LOST_REASONS } from "@/features/pipeline/pipeline";
import { REQUEST_TYPES } from "@/features/requests/formSchema";

export const OPTION_LISTS_KEY = "option_lists";

const plain = (arr) => arr.map((v) => ({ value: v, label: v }));

// valueMode "key": value is a slug stored on records, label is display only.
// valueMode "text": value is the text stored on records (label edits are display only; new items store their label).
export const LIST_DEFS = [
  {
    key: "lead_sources", group: "Pipeline", label: "Lead sources", valueMode: "key",
    help: "Where a lead came from. Shown on the Pipeline filters, lead cards and the New lead form.",
    usage: { entity: "CRMClient", field: "lead_source" },
    defaults: SOURCES.map((s) => ({ value: s.key, label: s.label })),
  },
  {
    key: "lost_reasons", group: "Pipeline", label: "Lost reasons", valueMode: "text",
    help: "Picked when a lead is marked lost.",
    usage: { entity: "CRMClient", field: "lost_reason" },
    defaults: plain(LOST_REASONS),
  },
  {
    key: "client_industries", group: "Clients", label: "Client industries", valueMode: "text",
    help: "Suggestions for a client's Industry field. Records keep free text (\"Category · detail\"), so usage counts match on the start of the text.",
    usage: { entity: "CRMClient", field: "industry", match: "prefix" },
    defaults: plain(["Home services", "B2B", "Food & retail", "Coaching & fitness", "Beauty & body art", "Creative services"]),
  },
  {
    key: "request_types", group: "Requests", label: "Request types", valueMode: "key", noAdd: true,
    help: "Portal request picker and admin labels. Archive hides the standard form from client portals (a client's own custom form of that type still shows). New types need a form, so add them in Documents > Forms.",
    usage: { entity: "ClientRequest", field: "kind" },
    defaults: REQUEST_TYPES.filter((t) => t.portal !== false).map((t) => ({ value: t.kind, label: t.label })),
  },
  {
    key: "expense_categories", group: "Finance", label: "Expense categories", valueMode: "text",
    help: "Financial > Expenses groups. Renaming here only changes the label; the Expenses tab's own editor renames records too.",
    usage: { entity: "Expense", field: "category" },
    defaults: plain(["AI Tools", "Design", "Finance", "Hosting", "Marketing", "Operations", "SEO"]),
  },
  {
    key: "investment_categories", group: "Finance", label: "Investment categories", valueMode: "text",
    help: "Financial > Investments wishlist groups.",
    usage: { entity: "Investment", field: "category" },
    defaults: plain(["Software", "Hardware", "Marketing", "Education", "Team", "Other"]),
  },
  {
    key: "idea_categories", group: "Agency", label: "Idea categories", valueMode: "text",
    help: "Idea Vault categories.",
    usage: { entity: "Idea", field: "category" },
    defaults: plain(["Marketing", "Product", "Operations", "Tech", "Content", "Other"]),
  },
  {
    key: "document_categories", group: "Agency", label: "Document categories", valueMode: "text",
    help: "Documents library sections and the upload picker.",
    usage: { entity: "AppDocument", field: "category" },
    defaults: plain(["Internal Processes", "Service Documents", "Contracts & Agreements", "Presentations", "Legal Documents", "Financial Documents"]),
  },
];

export const LIST_BY_KEY = Object.fromEntries(LIST_DEFS.map((d) => [d.key, d]));

// Lists that look editable but are locked by an entity enum or by code that branches on the values.
export const LOCKED_LISTS = [
  { label: "Task categories", where: "Task.category", why: "Entity enum, and AI planning (planGen) validates against it." },
  { label: "Task status / type / source", where: "Task.status, task_type, source", why: "Entity enums that drive the board columns and time tracking." },
  { label: "Project types & statuses", where: "Project.type, Project.status", why: "Entity enums; packages and SOP playbooks branch on them." },
  { label: "Pipeline stages", where: "CRMClient.pipeline_stage", why: "Entity enum; the lead-intake function and win/loss maths depend on them." },
  { label: "Client status", where: "CRMClient.status", why: "Active / Inactive / Lead: portal access and MRR maths depend on them." },
  { label: "Request status & priority", where: "ClientRequest.status, priority", why: "Entity enums shared with the portal and the Claude queue." },
  { label: "Idea status", where: "Idea.status", why: "Entity enum." },
  { label: "Expense frequency", where: "Expense.frequency", why: "Entity enum used by the due-date maths." },
];

export const slugify = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 40);

// Stored order wins; defaults that are missing from the stored list (shipped later) are appended.
export function mergeList(key, stored) {
  const def = LIST_BY_KEY[key];
  const defaults = (def?.defaults || []).map((d) => ({ ...d, isDefault: true }));
  if (!Array.isArray(stored) || !stored.length) return defaults;
  const defVals = new Set(defaults.map((d) => d.value));
  const out = stored
    .filter((x) => x && x.value != null && String(x.value) !== "")
    .map((x) => ({ value: String(x.value), label: String(x.label || x.value), archived: x.archived === true, isDefault: defVals.has(String(x.value)) }));
  const have = new Set(out.map((x) => x.value));
  defaults.forEach((d) => { if (!have.has(d.value)) out.push(d); });
  return out;
}

// What gets saved (no derived flags).
export const toStored = (items) => items.map(({ value, label, archived }) => ({ value, label, ...(archived ? { archived: true } : {}) }));
