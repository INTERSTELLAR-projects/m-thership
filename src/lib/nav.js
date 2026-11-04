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
import { Orbit as AgentsIcon } from "lucide-react";
import { Radar as IntelligenceIcon } from "lucide-react";

export const LOGO_URL =
  "https://media.base44.com/images/public/6ae18dc255e0da91f0ee6f1b/536102fbf_interstellar-mark-v2.webp";

// One source of truth for the sidebar and the ⌘K palette.
export const NAV_GROUPS = [
  {
    label: "Command",
    items: [
      { label: "Mission Control", icon: LayoutDashboard, path: "/" },
      { label: "Agents", icon: AgentsIcon, path: "/agents" },
      { label: "Intelligence", icon: IntelligenceIcon, path: "/intelligence" },
      { label: "Clients", icon: Users, path: "/crm" },
      { label: "Pipeline", icon: Target, path: "/pipeline" },
      { label: "Tasks", icon: ListTodo, path: "/tasks" },
      { label: "Claude Queue", icon: Sparkles, path: "/claude" },
      { label: "Projects", icon: FolderKanban, path: "/projects" },
      { label: "Flight Plan", icon: Route, path: "/flight-plan" },
      { label: "Requests", icon: ClipboardList, path: "/requests" },
      { label: "Client usage", icon: UsageIcon, path: "/client-usage" },
    ],
  },
  {
    // Recurring: who is subscribed, and what the system is doing for them this cycle.
    label: "Subscriptions",
    items: SUBSCRIPTIONS.map((p) => ({ label: p.label, icon: p.icon, path: packagePath(p.key), accent: p.color, arch: p.arch ? p.arch + " " + p.version : "" })),
  },
  {
    // Paid up front, delivered once: every client, every SOP phase, until fulfilled.
    label: "Packages",
    items: DELIVERY_PACKAGES.map((p) => ({ label: p.label, icon: p.icon, path: packagePath(p.key), accent: p.color, arch: p.arch ? p.arch + " " + p.version : "" })),
  },
  {
    label: "Signals",
    items: [
      { label: "Stärboard", icon: Star, path: "/reviews" },
      { label: "Performance", icon: TrendingUp, path: "/performance" },
      { label: "Content Plans", icon: ContentPlansIcon, path: "/content-plans" },
      { label: "Comms", icon: MessageSquare, path: "/comms" },
      { label: "Backlinks & Citations", icon: BacklinksIcon, path: "/backlinks" },
    ],
  },
  {
    label: "Studio",
    items: [
      { label: "Presentations", icon: Presentation, path: "/presentations/projects" },
      { label: "Signatures", icon: PenLine, path: "/signatures" },
      { label: "QR Codes", icon: QrCode, path: "/qr" },
      { label: "Social Studio", icon: SocialIcon, path: "/social" },
      { label: "Ads Studio", icon: AdsIcon, path: "/ads" },
      { label: "Email Studio", icon: EmailStudioIcon, path: "/email" },
    ],
  },
  {
    label: "Agency",
    items: [
      { label: "Financial", icon: DollarSign, path: "/financial" },
      { label: "Hiring plan", icon: HiringIcon, path: "/growth/hiring" },
      { label: "Output", icon: Activity, path: "/output-analytics" },
      { label: "Prestige", icon: Crown, path: "/prestige" },
      { label: "Automations", icon: AutomationsIcon, path: "/automations" },
      { label: "Documents", icon: FileText, path: "/documents" },
      { label: "Idea Vault", icon: Lightbulb, path: "/idea-vault" },
      { label: "Legal", icon: Scale, path: "/legal" },
    ],
  },
];

export const SETTINGS_ITEM = { label: "Settings", icon: Settings, path: "/settings" };

export const ALL_NAV = [...NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))), { ...SETTINGS_ITEM, group: "System" }];
