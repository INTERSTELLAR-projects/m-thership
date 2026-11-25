import {
  LayoutDashboard, FileText, DollarSign, Scale, Users, Lightbulb, ListTodo, MessageSquare, TrendingUp, ClipboardList,
  Crown, Activity, Settings, FolderKanban, Star, PenLine, Presentation, Route, Sparkles, Target, QrCode, Link2,
  CalendarRange, Zap, Megaphone, BadgeDollarSign, Mail, UserPlus, Gauge, Fuel, Store, Orbit, Rocket, Radar, Wand2,
  Chrome, Inbox, BookOpenCheck, Globe, GraduationCap, ShieldCheck, Package, Repeat, Sun, Briefcase, Wallet, LayoutGrid, Landmark,
  Brain, Images, PhoneCall, KeyRound, MapPinned, Layers, Trophy, Camera,
} from "lucide-react";
import { PACKAGES, packagePath } from "@/features/packages/registry";
import { IS_PRESENTING } from "@/lib/presentation";

export const LOGO_URL =
  "https://media.base44.com/images/public/6ae18dc255e0da91f0ee6f1b/536102fbf_interstellar-mark-v2.webp";

// One source of truth for the sidebar, the hub tab bar (src/components/HubTabs.jsx) and the ⌘K palette.
//
// Three screens first (Command, Clients, Claude), then More (Work, Marketing, Sales, Money, Agents and Tools) and
// Settings at the foot.
// Each hub is one page with tabs. A tab is still its own route, so every URL keeps working; the hub just
// gathers related pages under one tab bar with a one-line purpose ("hint") for the open tab.
//
// Tab fields:
//   key    stable id for pins (the path, as before, so existing pins survive)
//   path   where the tab opens; a "?tab=…" query only matches when the URL carries it
//   match  extra path prefixes that also belong to this tab (detail pages, sub-routes)
//   badge  live count key filled by src/components/navBadges.js
//   hint   the page's purpose line, shown under the tab bar
// Map of old page → new home: docs/cleanup-2026-11-12.md.
// Build Engine (Nov 2026): Justin's day runs from three screens. Command (home), Clients (one page per client) and
// Claude (send instructions, watch jobs). Everything else lives under More (MORE_HUBS), still one or two clicks away.
// Route map: docs/route-map.md.
export const HUBS = [
  {
    id: "command",
    label: "Command",
    icon: Sun,
    path: "/",
    hint: "Add a lead, clear what needs you today, watch every build",
    tabs: [
      { label: "Command", icon: Sun, path: "/", hint: "Quick-add a lead, what needs you today, and every build in progress" },
      { label: "Approvals", icon: Inbox, path: "/launch?tab=approvals", badge: "approvals", hint: "Only the items that truly need your yes" },
      { label: "Road to Dec 31", icon: Rocket, path: "/launch", badge: "justinMoves", hint: "Your launch moves: calls, payments, logins and final OKs" },
      { label: "Brain", icon: Brain, path: "/brain", hint: "Teach the Business Brain, one question at a time" },
      { label: "Pillars", icon: Orbit, path: "/pillars", hint: "The 8 business pillars, scored from live records, with why and what to do" },
      { label: "Commander brief", icon: Crown, path: "/agents?ceo=1", hint: "What the agents did overnight and what matters today" },
      { label: "Output", icon: Activity, path: "/output-analytics", hint: "Work done and hours saved this week" },
      { label: "Classic", icon: LayoutDashboard, path: "/classic", hint: "Mission Control: the original widget dashboard, with the quick-add bar on top" },
    ],
  },
  {
    id: "clients",
    label: "Clients",
    icon: Users,
    path: "/crm",
    hint: "Every lead and client, one page each: build, brain, launch, growth and requests",
    tabs: [
      { label: "Clients", icon: Users, path: "/crm", match: ["/clients"], hint: "Every client and lead; open one for its page: build checklist, Brain, launch grid, growth feed and requests" },
      { label: "Pipeline", icon: Target, path: "/pipeline", hint: "Leads from first contact to signed" },
      { label: "Requests", icon: ClipboardList, path: "/requests", hint: "What clients have asked for through their forms and portal" },
      { label: "Service Process", icon: Route, path: "/flight-plan", hint: "One process per thing we sell: steps, owner, auto/manual, where, and where each client is" },
      { label: "Brands", icon: Orbit, path: "/brands", hint: "House of Brands: Interstellar, DIALD and future brands, their clients and brains flowing up" },
      { label: "Messages", icon: MessageSquare, path: "/comms", hint: "Client chats in one inbox" },
      { label: "Client posts", icon: Globe, path: "/client-posts", hint: "Projects and testimonials clients sent that went live on their websites, with Unpublish and Edit" },
      { label: "Portal", icon: Globe, path: "/settings?tab=portal", hint: "Which clients have a portal and what it shows them" },
    ],
  },
  {
    // Lead Engine (Nov 2026): find businesses, build their preview from an industry template, call 100 a day.
    id: "leads",
    label: "Leads",
    icon: PhoneCall,
    path: "/leads/desk",
    hint: "Find businesses, build their preview, call and book the meeting",
    tabs: [
      { label: "Call sheet", icon: PhoneCall, path: "/leads/desk", match: ["/leads/lead"], hint: "Today's calls in priority order: follow-ups due first, one key per outcome, 100 dials a day" },
      { label: "Lead Finder", icon: MapPinned, path: "/leads/finder", hint: "Pick a state and an industry, find Google Business Profiles, approve them to build" },
      { label: "Sales HQ", icon: Trophy, path: "/leads/hq", hint: "Dials to deals per caller, the funnel, reps, pay, approvals and the 2027 goal" },
      { label: "Templates", icon: Layers, path: "/leads/templates", hint: "Industry templates every preview is built from; refine them with every call" },
      { label: "Portfolio", icon: Images, path: "/leads/portfolio", hint: "Every launched client site as a case study: publish to the public page, the lead portal and the call sheet" },
    ],
  },
  {
    id: "claude",
    label: "Claude",
    icon: Sparkles,
    path: "/claude",
    hint: "Tell Claude what to build or do for a client, and watch the jobs",
    tabs: [
      { label: "Claude", icon: Sparkles, path: "/claude", hint: "Pick a client, type an instruction, send. Every job and its status" },
      { label: "Field inbox", icon: Camera, path: "/field", hint: "WhatsApp from the glasses and site-visit videos: filed as tasks, ideas, notes or Claude jobs" },
      { label: "Playbooks", icon: BookOpenCheck, path: "/playbooks", hint: "The prompt agent: copy-paste foundation prompts per service, and the standards every client site and app gets" },
    ],
  },
].map((h) => ({ ...h, tabs: h.tabs.map((t) => ({ ...t, key: t.key || t.path })) }));

// Under More: the deeper pages, grouped as before. Each is still a hub with its own tab bar.
export const MORE_HUBS = [
  {
    id: "work",
    label: "Work",
    icon: Briefcase,
    path: "/tasks",
    hint: "Delivery: tasks, projects and the packages they belong to",
    tabs: [
      { label: "Tasks", icon: ListTodo, path: "/tasks", hint: "The task matrix: what is due, for whom, and what to do next" },
      { label: "Projects", icon: FolderKanban, path: "/projects", hint: "Every project in flight, with its tasks, time and value" },
      { label: "Packages", icon: Package, path: "/packages/rebuild", match: ["/packages", "/orbit-seo"], hint: "The 40-Day Rebuild checklist for every client, plus the monthly plans" },
      { label: "SOPs", icon: BookOpenCheck, path: "/tasks/sops", hint: "The procedures every task is built from" },
      { label: "Patterns", icon: Repeat, path: "/tasks/patterns", hint: "Recurring work the system creates on a schedule" },
      { label: "Share images", icon: Images, path: "/share-images", hint: "1200x630 social sharing images for every client site: one per page or page group, download as a ZIP" },
    ],
  },
  {
    id: "marketing",
    label: "Marketing",
    icon: Megaphone,
    path: "/performance",
    hint: "The monthly search, content and studio work for clients",
    tabs: [
      { label: "Search", icon: TrendingUp, path: "/performance", hint: "Each client's search performance and the fixes behind it" },
      { label: "Content plans", icon: CalendarRange, path: "/content-plans", hint: "What each client publishes and when" },
      { label: "Backlinks", icon: Link2, path: "/backlinks", hint: "Backlink and citation outreach" },
      { label: "Reviews", icon: Star, path: "/reviews", hint: "Stärboard: Google reviews on every client site" },
      { label: "Site security", icon: ShieldCheck, path: "/security", hint: "Security checks on client sites" },
      { label: "Social", icon: Megaphone, path: "/social", hint: "Social Studio: plan, approve and publish posts" },
      { label: "Email", icon: Mail, path: "/email", hint: "Email Studio: lists, templates and campaigns" },
      { label: "Ads", icon: BadgeDollarSign, path: "/ads", hint: "Ads Studio: the agent proposes, you approve, nothing spends on its own" },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    icon: Target,
    path: "/pipeline",
    hint: "Win new work and grow existing clients",
    tabs: [
      // Calls moved here from Clients (Nov 2026, portal v2 cleanup) so every hub stays at 8 tabs or fewer.
      { label: "Call Prep", icon: PhoneCall, path: "/calls", hint: "Prep any call by voice: a cheat sheet from the client brain with your questions and their answers, saved PDFs, then debrief into the brain" },
      // Marketing Command (Nov 23 2026): Interstellar's own season plan and volume per pillar (docs/marketing-command.md).
      { label: "Marketing Command", icon: Gauge, path: "/marketing-command", hint: "The whole marketing plan: volume per pillar (posts, content, outreach, calls, in person, ads) against the revenue line. Wall mode for the office TV" },
      { label: "Financing", icon: Landmark, path: "/financing", badge: "financingLate", hint: "Client payment plans, short and long term: who's paid, who's due, who's late" },
      { label: "Prestige", icon: Crown, path: "/prestige", hint: "Prestige referral program: members, referrals and rewards" },
      { label: "Upgrade Store", icon: Store, path: "/upgrades", hint: "Add-ons clients can buy on top of their plan" },
      { label: "Decks", icon: Presentation, path: "/presentations/projects", match: ["/presentations"], hint: "Pitch and client presentations" },
      { label: "SMPL. Studio", icon: Wand2, path: "/studios/smpl", arch: "SOON", hint: "SMPL. studio (coming soon)" },
    ],
  },
  {
    id: "money",
    label: "Money",
    icon: Wallet,
    path: "/financial",
    hint: "Cash, billing and what it costs to run",
    tabs: [
      { label: "Financial", icon: DollarSign, path: "/financial", hint: "Money in and out, the revenue goal, accounting and the advisor" },
      { label: "Client usage", icon: Gauge, path: "/client-usage", hint: "Metered usage per client against their plan" },
      { label: "Fuel economics", icon: Fuel, path: "/fuel-economics", hint: "What the AI work costs per studio and plan" },
      { label: "Hiring plan", icon: UserPlus, path: "/growth/hiring", hint: "When revenue supports the next hire" },
      { label: "Usage & cost", icon: Gauge, path: "/usage-cost", hint: "Claude plan, Base44 credits and email/text sending costs, with a scale calculator" },
    ],
  },
  {
    id: "agents",
    label: "Agents",
    icon: Orbit,
    path: "/agents",
    hint: "The agents, the intelligence they gather and the automations they run",
    tabs: [
      { label: "Universe", icon: Sparkles, path: "/universe", hint: "The whole operation as one zoomable tree: Claude, Møthership, every brand, client, department and agent, with what is broken" },
      { label: "Constellation", icon: Orbit, path: "/agents", hint: "Every agent, what it knows and what it is working on" },
      { label: "Systems", icon: KeyRound, path: "/systems", hint: "Systems brain: every key on every app, what it does, how the apps connect, and what is left over" },
      { label: "Intelligence", icon: Radar, path: "/intelligence", hint: "Market and search changes worth acting on" },
      { label: "Idea Vault", icon: Lightbulb, path: "/idea-vault", hint: "Ideas, scored" },
      { label: "Automations", icon: Zap, path: "/automations", hint: "Every automation and notification, internal and external" },
    ],
  },
].map((h) => ({ ...h, tabs: h.tabs.map((t) => ({ ...t, key: t.key || t.path })) }));


// Tools Justin opens now and then. They live under More so the main list stays short; nothing was removed.
export const MORE_HUB = {
  id: "more",
  label: "More",
  icon: LayoutGrid,
  path: "/more",
  hint: "Occasional tools and an index of every page",
  tabs: [
    { label: "All pages", icon: LayoutGrid, path: "/more", hint: "Every page in Møthership, grouped the way the sidebar is" },
    { label: "How you use it", icon: Activity, path: "/more/usage", hint: "How you use Møthership: most-used pages, repeated paths and slow steps (private, your sessions only)" },
    { label: "Documents", icon: FileText, path: "/documents", hint: "Agency documents and forms" },
    { label: "Legal", icon: Scale, path: "/legal", hint: "Legal items, filings and their dates" },
    { label: "Training", icon: GraduationCap, path: "/training", hint: "Training tracks and assignments for new hires" },
    { label: "Signatures", icon: PenLine, path: "/signatures", hint: "Email signatures for the team and clients" },
    { label: "QR codes", icon: QrCode, path: "/qr", hint: "Branded QR codes and their scans" },
    { label: "Chrome Workspace", icon: Chrome, path: "/tools/chrome-workspace", hint: "Browser workspace setup" },
  ].map((t) => ({ ...t, key: t.path })),
};

export const SETTINGS_ITEM = { key: "/settings", label: "Settings", icon: Settings, path: "/settings", hint: "Agency profile, team, integrations, lists and estimates" };

// Every package page, so ⌘K finds "HyperCare+" etc. and old package pins keep working. Not shown as tabs.
const PACKAGE_ITEMS = PACKAGES.map((p) => ({ key: `pkg:${p.key}`, label: p.label, icon: p.icon, path: packagePath(p.key), hidden: true }));

// Presentation mode: pages built around real client names (site security audit, SMPL. Studio) or Justin's own
// browser setup stay out of the demo. They leave the sidebar, tab bars and ⌘K; Layout shows a note if opened.
export const PRESENT_HIDDEN = ["/security", "/studios/smpl", "/studios/simple-social", "/tools/chrome-workspace"];
export const isPresentHidden = (pathname) => PRESENT_HIDDEN.some((p) => pathname === p || pathname.startsWith(p + "/"));
if (IS_PRESENTING) {
  for (const hub of [...HUBS, ...MORE_HUBS, MORE_HUB]) hub.tabs = hub.tabs.filter((t) => !isPresentHidden(t.path.split("?")[0]));
}

const flat = (hub) => hub.tabs.map((t) => ({ ...t, group: hub.label, groupId: hub.id }));

export const ALL_NAV = [
  ...HUBS.flatMap(flat),
  ...MORE_HUBS.flatMap(flat),
  ...PACKAGE_ITEMS.map((i) => ({ ...i, group: "Work · Packages", groupId: "work" })),
  ...flat(MORE_HUB),
  { ...SETTINGS_ITEM, group: "System", groupId: "system" },
];

const ALL_HUBS = [...HUBS, ...MORE_HUBS, MORE_HUB];

function score(location, item) {
  const params = new URLSearchParams(location.search || "");
  const [p, q] = item.path.split("?");
  const prefixes = [p, ...(item.match || [])];
  let best = -1;
  for (const pre of prefixes) {
    const ok = pre === "/" ? location.pathname === "/" : location.pathname === pre || location.pathname.startsWith(pre + "/");
    if (ok) best = Math.max(best, pre.length);
  }
  if (best < 0) return -1;
  if (q) {
    const want = new URLSearchParams(q);
    if (![...want.entries()].every(([k, v]) => params.get(k) === v)) return -1;
    best += 1000;
  }
  return best;
}

// Which nav item a location belongs to: the longest matching path; items with a query (?tab=…) only when the query matches.
export function activeKey(location, items = ALL_NAV) {
  let best = null, bestScore = -1;
  for (const i of items) {
    const s = score(location, i);
    if (s > bestScore) { best = i.key; bestScore = s; }
  }
  return best;
}

// The hub and tab a location belongs to, or null (Settings and unknown pages have no hub tab bar).
export function hubFor(location) {
  let hit = null, bestScore = -1;
  for (const hub of ALL_HUBS) {
    for (const tab of hub.tabs) {
      const s = score(location, tab);
      if (s > bestScore) { hit = { hub, tab }; bestScore = s; }
    }
  }
  // Settings (other than its Portal tab, which lives in Clients) has no hub: no tab matches it.
  return hit;
}

export { ALL_HUBS };
