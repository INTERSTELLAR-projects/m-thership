// Task engine enums, ported from Interstellar To-Do and recolored for the light Møthership theme.
// Single accent (#ff3c00); status/priority use green/amber/red tones that read on #ebe8e4.

export const FLAME = "#ff3c00";
export const INK = "#1a1a1a";

export const PRIORITIES = [
  { value: 1, label: "P0", name: "Critical", color: "#b91c1c" },
  { value: 2, label: "P1", name: "High", color: "#c2410c" },
  { value: 3, label: "P2", name: "Normal", color: "#57534e" },
  { value: 4, label: "P3", name: "Low", color: "#8a8580" }
];
export const priorityMeta = (v) => PRIORITIES.find((p) => p.value === Number(v)) || PRIORITIES[2];

export const TASK_STATUSES = [
  { value: "inbox", label: "Inbox", color: "#8a8580" },
  { value: "next", label: "Next Up", color: "#ff3c00" },
  { value: "doing", label: "In Flight", color: "#b45309" },
  { value: "blocked", label: "Blocked", color: "#b91c1c" },
  { value: "done", label: "Complete", color: "#15803d" }
];
export const statusMeta = (v) => TASK_STATUSES.find((s) => s.value === v) || TASK_STATUSES[0];
export const OPEN_STATUSES = ["inbox", "next", "doing", "blocked"];

export const CATEGORIES = [
  { value: "design", label: "Design", color: "#ff6a00" },
  { value: "development", label: "Development", color: "#1a1a1a" },
  { value: "strategy", label: "Strategy", color: "#57534e" },
  { value: "content", label: "Content", color: "#ffaa00" },
  { value: "marketing", label: "Marketing", color: "#ff3c00" },
  { value: "sales", label: "Sales", color: "#15803d" },
  { value: "admin", label: "Admin", color: "#8a8580" },
  { value: "finance", label: "Finance", color: "#b45309" },
  { value: "ops", label: "Operations", color: "#8a2e00" }
];
export const categoryMeta = (v) =>
  CATEGORIES.find((c) => c.value === v) || { value: v, label: v || "Operations", color: "#8a8580" };

export const TASK_TYPES = [
  { value: "billable", label: "Billable", color: "#ff3c00" },
  { value: "internal", label: "Internal", color: "#57534e" },
  { value: "unpaid", label: "Unpaid client", color: "#b45309" },
  { value: "personal", label: "Personal", color: "#8a8580" }
];

export const SOURCES = [
  { value: "manual", label: "Manual" },
  { value: "voice", label: "Voice" },
  { value: "ai", label: "AI" },
  { value: "sop", label: "SOP" },
  { value: "request", label: "Request" },
  { value: "automation", label: "Automation" }
];

export const PROJECT_TYPES = [
  { value: "website", label: "Website", color: "#ff3c00" },
  { value: "app", label: "App", color: "#1a1a1a" },
  { value: "branding", label: "Branding", color: "#ff6a00" },
  { value: "marketing", label: "Marketing", color: "#ffaa00" },
  { value: "seo", label: "SEO", color: "#c2410c" },
  { value: "automation", label: "Automation", color: "#57534e" },
  { value: "consulting", label: "Consulting", color: "#15803d" },
  { value: "internal", label: "Internal", color: "#8a8580" },
  { value: "other", label: "Other", color: "#8a2e00" }
];
export const projectTypeMeta = (v) => PROJECT_TYPES.find((t) => t.value === v) || PROJECT_TYPES[0];

export const PROJECT_STATUSES = [
  { value: "proposed", label: "Proposed", color: "#8a8580" },
  { value: "backlog", label: "Backlog", color: "#8a8580" },
  { value: "planning", label: "Planning", color: "#57534e" },
  { value: "in_progress", label: "In Flight", color: "#ff3c00" },
  { value: "review", label: "In Review", color: "#b45309" },
  { value: "launched", label: "Launched", color: "#15803d" },
  { value: "on_hold", label: "On Hold", color: "#b91c1c" },
  { value: "done", label: "Closed", color: "#15803d" }
];
export const projectStatusMeta = (v) => PROJECT_STATUSES.find((s) => s.value === v) || PROJECT_STATUSES[0];

export const BILLING = [
  { value: "one_time", label: "One time" },
  { value: "retainer", label: "Retainer" },
  { value: "hourly", label: "Hourly" },
  { value: "unpaid", label: "Unpaid" }
];

// Done -> stamp completed_at; reopened -> clear it.
export const statusPatch = (status) => ({
  status,
  completed_at: status === "done" ? new Date().toISOString() : null
});
