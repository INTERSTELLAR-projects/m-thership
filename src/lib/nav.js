import {
  LayoutDashboard, KeyRound, FileText, DollarSign, Scale, Users, Lightbulb, ListTodo,
  MessageSquare, Globe, TrendingUp, ClipboardList, Crown, Activity, Settings,
} from "lucide-react";

export const LOGO_URL =
  "https://media.base44.com/images/public/6ae18dc255e0da91f0ee6f1b/536102fbf_interstellar-mark-v2.webp";

// One source of truth for the sidebar and the ⌘K palette.
export const NAV_GROUPS = [
  {
    label: "Command",
    items: [
      { label: "Mission Control", icon: LayoutDashboard, path: "/" },
      { label: "Clients", icon: Users, path: "/crm" },
      { label: "Tasks", icon: ListTodo, path: "/todo" },
      { label: "Requests", icon: ClipboardList, path: "/requests" },
      { label: "Ørbit SEO", icon: Globe, path: "/orbit-seo" },
      { label: "Performance", icon: TrendingUp, path: "/performance" },
      { label: "Comms", icon: MessageSquare, path: "/comms" },
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
      { label: "Logins", icon: KeyRound, path: "/logins" },
    ],
  },
];

export const SETTINGS_ITEM = { label: "Settings", icon: Settings, path: "/settings" };

export const ALL_NAV = [...NAV_GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label }))), { ...SETTINGS_ITEM, group: "System" }];
