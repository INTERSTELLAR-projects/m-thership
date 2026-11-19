// "Where is everything?": one searchable map of every page, tab and sub-tab, one line each. Built from the
// sidebar hubs (src/lib/nav.js) plus the tabs that live inside pages (?tab=…) and the client profile sections.
import { HUBS, MORE_HUBS, MORE_HUB, SETTINGS_ITEM } from "@/lib/nav";

// Tabs inside pages. path opens that tab directly; parent is the page it lives on.
export const SUB_TABS = [
  ...[["general", "General"], ["knowledge", "Agency knowledge"], ["team", "Team & access"], ["portal", "Portal"], ["security", "Security"], ["integrations", "Integrations"], ["lists", "Lists & fields"], ["automations", "Automations"], ["estimates", "Time-saved estimates"]]
    .map(([k, l]) => ({ label: l, path: `/settings?tab=${k}`, parent: "Settings", hint: `Settings: ${l.toLowerCase()}` })),
  ...[["dashboard", "Dashboard", "Money at a glance"], ["goal", "Goal", "Revenue goal and pace"], ["advisor", "Advisor", "What to invest in next"], ["overview", "Expenses", "Every expense, categorized"], ["accounting", "Accounting & Taxes", "Bookkeeping and tax set-asides"], ["stripe", "Stripe", "Stripe revenue and subscriptions"], ["projections", "Projections", "Where revenue is heading"], ["investments", "Investments", "Planned purchases and hires"]]
    .map(([k, l, h]) => ({ label: l, path: `/financial?tab=${k}`, parent: "Financial", hint: h })),
  ...[["compose", "Compose", "Write and send an email"], ["history", "Drafts & Sent", "Every draft and sent email"], ["templates", "Templates", "Saved email designs"], ["subscribers", "Subscribers", "People on your lists"], ["lists", "Lists", "Email lists and segments"]]
    .map(([k, l, h]) => ({ label: `Email ${l}`, path: `/email?tab=${k}`, parent: "Email Studio", hint: h })),
  ...[["engine", "One idea → 13 platforms", "Turn one idea into posts everywhere"], ["posts", "Instagram & Facebook", "Posts for IG and Facebook"], ["channels", "Channel plan", "Which channels, how often"], ["linkedin", "LinkedIn", "LinkedIn posts"], ["youtube", "YouTube", "YouTube uploads"], ["conversations", "Conversations", "Comments and DMs"]]
    .map(([k, l, h]) => ({ label: l, path: `/social?tab=${k}`, parent: "Social Studio", hint: h })),
  ...[["overview", "Overview", "Ad spend and results"], ["inbox", "Approvals", "Changes waiting for your OK"], ["campaigns", "Campaigns", "Every campaign"], ["hooklab", "Hook Lab", "Test ad hooks"], ["creatives", "Creatives", "Ad images and videos"], ["policy", "Policy guard", "Ad policy checks"], ["connections", "Connections", "Linked ad accounts"], ["learnings", "Learnings & log", "What the ads agent learned"], ["goals", "Goals & safety", "Spend limits and goals"]]
    .map(([k, l, h]) => ({ label: `Ads ${l}`, path: `/ads?tab=${k}`, parent: "Ads Studio", hint: h })),
  { label: "Brain prompts", path: "/playbooks?tab=brain", parent: "Playbooks", hint: "Foundation prompts per service" },
  { label: "Standards", path: "/playbooks?tab=standards", parent: "Playbooks", hint: "What every client site and app gets" },
  { label: "Interstellar Codes app", path: "/qr?tab=codes-app", parent: "QR codes", hint: "interstellarcodes.com: users, codes, scans, SEO" },
  { label: "Constellation classic view", path: "/agents?v=classic", parent: "Agents", hint: "The older agent map with filters" },
  { label: "Universe", path: "/universe", parent: "Agents", hint: "Claude, Møthership, brands, clients, departments and agents in one tree" },
  { label: "Usage & cost", path: "/usage-cost", parent: "Money", hint: "Claude plan, Base44 credits, email and text costs, scale calculator" },
];

// Sections inside every client profile (open a client first).
export const CLIENT_TABS = [
  ["build", "Build", "Pillars, lead card, build checklist, Brain and unlocks, launch grid, growth feed, requests"], ["agents", "Agents", "The client's agents, live"], ["overview", "Overview", "Work, requests and tasks at a glance"], ["tasks", "Tasks", "The client's to-dos (tick to complete)"],
  ["requests", "Requests", "What they asked for"], ["work", "Work log", "Everything delivered"], ["calls", "Calls", "Call recordings and notes"], ["messages", "Messages", "Chat with the client"],
  ["performance", "Performance", "Search, GA4, GBP numbers"], ["goals", "Goals", "Their goals and plan"], ["profile", "Profile", "What's filled in and what's missing"], ["dossier", "Brain", "The client's Business Brain"],
  ["brand", "Brand kit", "Colors, fonts, voice"], ["audit", "Audit", "Site and listing audits"], ["files", "Files", "Delivered files"], ["billing", "Billing", "Services, notes, documents"], ["systems", "Systems", "Their apps and connections"],
].map(([k, l, h]) => ({ label: `Client · ${l}`, path: "/crm", parent: "Client profile", hint: `${h}. Open a client, then ${l}.`, clientTab: k }));

export function guideEntries() {
  const out = [];
  [...HUBS, ...MORE_HUBS, MORE_HUB].forEach((h) => h.tabs.forEach((t) => out.push({ label: t.label, path: t.path, parent: h.label, hint: t.hint || "" })));
  out.push({ label: SETTINGS_ITEM.label, path: SETTINGS_ITEM.path, parent: "System", hint: SETTINGS_ITEM.hint || "Settings" });
  SUB_TABS.forEach((t) => { if (!out.some((o) => o.path === t.path)) out.push(t); });
  CLIENT_TABS.forEach((t) => out.push(t));
  return out;
}

export function searchGuide(entries, q) {
  const t = String(q || "").trim().toLowerCase();
  if (!t) return entries;
  const words = t.split(/\s+/);
  return entries.filter((e) => { const hay = `${e.label} ${e.parent} ${e.hint}`.toLowerCase(); return words.every((w) => hay.includes(w)); });
}

export const openNavGuide = () => window.dispatchEvent(new Event("navguide:open"));
