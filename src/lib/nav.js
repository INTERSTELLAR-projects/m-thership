import {
  LayoutDashboard, FileText, DollarSign, Scale, Users, Lightbulb, ListTodo,
  MessageSquare, TrendingUp, ClipboardList, Crown, Activity, Settings, FolderKanban, Star, PenLine, Presentation, Route, Sparkles, Target, QrCode,
} from "lucide-react";
import { Link2 as BacklinksIcon } from "lucide-react";
import { CalendarRange as ContentPlansIcon } from "lucide-react";
import { SUBSCRIPTIONS, DELIVERY_PACKAGES, packagePath } from "@/features/packages/registry";
import { Zap as AutomationsIcon } from "lucide-react";
import { Megaphone as SocialIcon } from "lucide-react";
import { BadgeDollarSign as AdsIcon } from "lucide-react";
import { Mail as EmailStudioIcon } from "lucide-react";
import { UserPlus as HiringIcon } from "lucide-react";
import { Gauge as UsageIcon } from "lucide-react";
import { Fuel as FuelIcon } from "lucide-react";
import { Store as UpgradeStoreIcon } from "lucide-react";
import { Orbit as AgentsIcon } from "lucide-react";
import { Rocket as LaunchIcon } from "lucide-react";
import { Radar as IntelligenceIcon } from "lucide-react";
import { Wand2 as SmplStudioIcon } from "lucide-react";
import { Chrome as ChromeWorkspaceIcon } from "lucide-react";
import { Inbox as ApprovalsIcon, Crown as CommanderIcon, BookOpenCheck as SopsIcon, Globe as PortalIcon } from "lucide-react";
import { GraduationCap as TrainingIcon } from "lucide-react";

export const LOGO_URL =
  "https://media.base44.com/images/public/6ae18dc255e0da91f0ee6f1b/536102fbf_interstellar-mark-v2.webp";

// One source of truth for the sidebar and the ⌘K palette.
// Sections follow Justin's day: run the business (Command) → win work (Sales) → look after clients (Clients) →
// deliver (Delivery, Care & growth) → make things (Studios) → steer the agents (Agents & Intelligence) →
// keep the machine running (Operations) → money (Finance). Every route keeps its URL; only the grouping changed.
// `badge` keys are filled live by the sidebar (src/components/navBadges.js). `key` is the stable id for pins.
const pkg = (p) => ({ key: `pkg:${p.key}`, label: p.label, icon: p.icon, path: packagePath(p.key), accent: p.color, arch: p.arch ? p.arch + " " + p.version : "" });

export const NAV_GROUPS = [
  {
    id: "command",
    label: "Command",
    items: [
      { label: "Mission Control", icon: LayoutDashboard, path: "/" },
      { label: "Road to Dec 31", icon: LaunchIcon, path: "/launch", badge: "justinMoves" },
      { label: "Commander brief", icon: CommanderIcon, path: "/agents?ceo=1" },
      { label: "Approvals", icon: ApprovalsIcon, path: "/launch?tab=approvals", badge: "approvals" },
      { label: "Output", icon: Activity, path: "/output-analytics" },
    ],
  },
  {
    id: "sales",
    label: "Sales",
    items: [
      { label: "Pipeline", icon: Target, path: "/pipeline" },
      { label: "Prestige referrals", icon: Crown, path: "/prestige" },
    ],
  },
  {
    id: "clients",
    label: "Clients",
    items: [
      { label: "Clients", icon: Users, path: "/crm" },
      { label: "Onboarding · Flight Plan", icon: Route, path: "/flight-plan" },
      { label: "Requests", icon: ClipboardList, path: "/requests" },
      { label: "Messages", icon: MessageSquare, path: "/comms" },
      { label: "Client portal", icon: PortalIcon, path: "/settings?tab=portal" },
      { label: "Client usage", icon: UsageIcon, path: "/client-usage" },
      { label: "Upgrade Store", icon: UpgradeStoreIcon, path: "/upgrades" },
    ],
  },
  {
    // Paid up front, delivered once: every client, every SOP phase, until fulfilled.
    id: "delivery",
    label: "Delivery",
    items: [
      { label: "Projects", icon: FolderKanban, path: "/projects" },
      { label: "Claude Queue", icon: Sparkles, path: "/claude" },
      ...DELIVERY_PACKAGES.map(pkg),
    ],
  },
  {
    // Recurring: the care plans and the search / content / reputation work they run every month.
    id: "care",
    label: "Care & growth",
    items: [
      ...SUBSCRIPTIONS.map(pkg),
      { label: "Search performance", icon: TrendingUp, path: "/performance" },
      { label: "Content Plans", icon: ContentPlansIcon, path: "/content-plans" },
      { label: "Backlinks & Citations", icon: BacklinksIcon, path: "/backlinks" },
      { label: "Stärboard reviews", icon: Star, path: "/reviews" },
    ],
  },
  {
    id: "studios",
    label: "Studios",
    items: [
      { label: "Social Studio", icon: SocialIcon, path: "/social" },
      { label: "Email Studio", icon: EmailStudioIcon, path: "/email" },
      { label: "Ads Studio", icon: AdsIcon, path: "/ads" },
      { label: "Presentations", icon: Presentation, path: "/presentations/projects" },
      { label: "Signatures", icon: PenLine, path: "/signatures" },
      { label: "QR Codes", icon: QrCode, path: "/qr" },
      { label: "SMPL. Studio", icon: SmplStudioIcon, path: "/studios/smpl", arch: "SOON" },
    ],
  },
  {
    id: "agents",
    label: "Agents & Intelligence",
    items: [
      { label: "Agent Constellation", icon: AgentsIcon, path: "/agents" },
      { label: "Intelligence", icon: IntelligenceIcon, path: "/intelligence" },
      { label: "Idea Vault", icon: Lightbulb, path: "/idea-vault" },
    ],
  },
  {
    id: "ops",
    label: "Operations",
    items: [
      { label: "Tasks", icon: ListTodo, path: "/tasks" },
      { label: "SOPs", icon: SopsIcon, path: "/tasks/sops" },
      { label: "Training", icon: TrainingIcon, path: "/training" },
      { label: "Automations", icon: AutomationsIcon, path: "/automations" },
      { label: "Documents", icon: FileText, path: "/documents" },
      { label: "Chrome Workspace", icon: ChromeWorkspaceIcon, path: "/tools/chrome-workspace" },
      { label: "Legal", icon: Scale, path: "/legal" },
    ],
  },
  {
    id: "finance",
    label: "Finance",
    items: [
      { label: "Financial", icon: DollarSign, path: "/financial" },
      { label: "Fuel economics", icon: FuelIcon, path: "/fuel-economics" },
      { label: "Hiring plan", icon: HiringIcon, path: "/growth/hiring" },
    ],
  },
].map((g) => ({ ...g, items: g.items.map((i) => ({ ...i, key: i.key || i.path })) }));

export const SETTINGS_ITEM = { key: "/settings", label: "Settings", icon: Settings, path: "/settings" };

export const ALL_NAV = [...NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label, groupId: g.id }))), { ...SETTINGS_ITEM, group: "System", groupId: "system" }];

// The short daily flow shown under "Start here" (and in ⌘K): what to open, in order.
export const START_HERE = [
  { label: "Read the Commander brief", path: "/agents?ceo=1", hint: "What the agents did and what matters today" },
  { label: "Clear approvals", path: "/launch?tab=approvals", badge: "approvals", hint: "Only items that truly need you" },
  { label: "Your launch moves", path: "/launch", badge: "justinMoves", hint: "Calls, payments, logins, final OKs" },
  { label: "Check Output", path: "/output-analytics", hint: "Work done and hours saved this week" },
];

// Which nav item a location belongs to: the longest matching path; items with a query (?tab=…) only when the query matches.
export function activeKey(location, items = ALL_NAV) {
  const params = new URLSearchParams(location.search || "");
  let best = null, bestScore = -1;
  for (const i of items) {
    const [p, q] = i.path.split("?");
    const pathOk = p === "/" ? location.pathname === "/" : location.pathname === p || location.pathname.startsWith(p + "/");
    if (!pathOk) continue;
    let score = p.length;
    if (q) {
      const want = new URLSearchParams(q);
      if (![...want.entries()].every(([k, v]) => params.get(k) === v)) continue;
      score += 1000;
    }
    if (score > bestScore) { best = i.key; bestScore = score; }
  }
  return best;
}
