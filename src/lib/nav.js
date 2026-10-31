import {
  LayoutDashboard, FileText, DollarSign, Scale, Users, Lightbulb, ListTodo,
  MessageSquare, TrendingUp, ClipboardList, Crown, Activity, Settings, FolderKanban, Star, PenLine, Presentation, Route,
} from "lucide-react";
import { SUBSCRIPTIONS, DELIVERY_PACKAGES, packagePath } from "@/features/packages/registry";

export const LOGO_URL =
  "https://media.base44.com/images/public/6ae18dc255e0da91f0ee6f1b/536102fbf_interstellar-mark-v2.webp";

// One source of truth for the sidebar and the ⌘K palette.
export const NAV_GROUPS = [
  {
    label: "Command",
    items: [
      { label: "Mission Control", icon: LayoutDashboard, path: "/" },
      { label: "Clients", icon: Users, path: "/crm" },
      { label: "Tasks", icon: ListTodo, path: "/tasks" },
      { label: "Projects", icon: FolderKanban, path: "/projects" },
      { label: "Flight Plan", icon: Route, path: "/flight-plan" },
      { label: "Requests", icon: ClipboardList, path: "/requests" },
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
      { label: "Comms", icon: MessageSquare, path: "/comms" },
    ],
  },
  {
    label: "Studio",
    items: [
      { label: "Presentations", icon: Presentation, path: "/presentations/projects" },
      { label: "Signatures", icon: PenLine, path: "/signatures" },
    ],
  },
  {
    label: "Agency",
    items: [
      { label: "Financial", icon: DollarSign, path: "/financial" },
      { label: "Output", icon: Activity, path: "/output-analytics" },
      { label: "Prestige", icon: Crown, path: "/prestige" },
      { label: "Documents", icon: FileText, path: "/documents" },
      { label: "Idea Vault", icon: Lightbulb, path: "/idea-vault" },
      { label: "Legal", icon: Scale, path: "/legal" },
    ],
  },
];

export const SETTINGS_ITEM = { label: "Settings", icon: Settings, path: "/settings" };

export const ALL_NAV = [...NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))), { ...SETTINGS_ITEM, group: "System" }];
