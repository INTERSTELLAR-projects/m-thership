// Portal v2 ("new-age portal", Nov 2026): ONE map of every place a client can go.
// The home screen's "Everything" grid, the header's Everything sheet (desktop) and the hamburger (phone) all render
// this list, so nothing is ever more than one tap away and there are no nested menus.
// A tile only shows when its tab exists for this client (PortalApp decides: plan, Studio state, published kits).
import {
  Brain, Compass, BookOpen, UserPlus, GraduationCap, ClipboardList, MessageSquare, FolderOpen, Newspaper, Target,
  LineChart, MapPin, Megaphone, Mail, Presentation, PenLine, QrCode, Calculator, BadgeDollarSign, Sparkles,
  CreditCard, Crown, Store, UserRound,
} from "lucide-react";

// The header keeps only these (plus the Everything button, Schedule a call and Account). Short on purpose.
export const HEADER_TABS = [
  { k: "home", label: "Home" },
  { k: "requests", label: "Requests" },
  { k: "messages", label: "Messages" },
];

export const GROUPS = [
  {
    id: "system", label: "Your business system", hint: "The operating system we built for your business",
    items: [
      { k: "brain", label: "Your Brain", desc: "What we know, and the questions that teach it more", icon: Brain },
      { k: "playbook", label: "Your playbook", desc: "Your industry growth plan", icon: Compass },
      { k: "resources", label: "SOPs & guides", desc: "How your business runs, step by step", icon: BookOpen },
      { k: "studio_hiring", label: "Hiring", desc: "When to hire, and who", icon: UserPlus },
      { k: "studio_training", label: "Training", desc: "Train new people from your processes", icon: GraduationCap },
    ],
  },
  {
    id: "work", label: "Work with us", hint: "Ask, chat and see what we delivered",
    items: [
      { k: "requests", label: "Requests", desc: "Edits, content, designs and fixes", icon: ClipboardList },
      { k: "messages", label: "Messages", desc: "Chat with the Interstellar team", icon: MessageSquare },
      { k: "files", label: "Files & brand kit", desc: "Deliverables, logo rules, colors and fonts", icon: FolderOpen },
      { k: "mentions", label: "Mentions & PR", desc: "Listings, press and links we earned", icon: Newspaper },
      { k: "goals", label: "Goals & plan", desc: "Targets and what we're fixing next", icon: Target },
    ],
  },
  {
    id: "growth", label: "Search & reviews", hint: "How people find you",
    items: [
      { k: "results", label: "Search results", desc: "Traffic, calls and how people find you", icon: LineChart },
      { k: "gbp", label: "Google Business", desc: "Your profile, reviews and review link", icon: MapPin },
    ],
  },
  {
    id: "studios", label: "Studios", hint: "Do it yourself, or have us do it",
    items: [
      { k: "studio_social", label: "Social", desc: "Plan, design and publish posts", icon: Megaphone },
      { k: "studio_email", label: "Email", desc: "Campaigns and automations to your list", icon: Mail },
      { k: "studio_presentations", label: "Presentations", desc: "On-brand decks from one prompt", icon: Presentation },
      { k: "signatures", label: "Signatures", desc: "On-brand email signatures", icon: PenLine, bonus: true },
      { k: "qr", label: "QR codes", desc: "Branded codes you can re-point", icon: QrCode, bonus: true },
      { k: "studio_accounting", label: "Accounting & taxes", desc: "Books, receipts and quarterly taxes", icon: Calculator },
      { k: "studio_ads", label: "Ads", desc: "An ads agent that watches your spend", icon: BadgeDollarSign },
      { k: "studio_smpl", label: "SMPL. Studio", desc: "AI image, video and voice", icon: Sparkles, cobrand: true },
    ],
  },
  {
    id: "account", label: "Account", hint: "Plan, billing and rewards",
    items: [
      { k: "billing", label: "Billing", desc: "Your plan, payments and fuel", icon: CreditCard },
      { k: "referrals", label: "Prestige referrals", desc: "Refer a business, earn credit", icon: Crown },
      { k: "upgrades", label: "Upgrades", desc: "New features to try, then unlock", icon: Store },
      { k: "account", label: "Account & security", desc: "Login and 2-step verification", icon: UserRound },
    ],
  },
];

export const ALL_TILES = GROUPS.flatMap((g) => g.items.map((i) => ({ ...i, group: g.id })));
// Studio tabs get the "Do it yourself / Have us do it" strip.
export const STUDIO_KEYS = new Set(GROUPS.find((g) => g.id === "studios").items.map((i) => i.k));

// Labels for the header / mobile button ("where am I").
export function labelFor(tab) {
  if (tab === "home") return "Home";
  if (tab === "assistant") return "Nøva";
  if (tab === "brand") return "Brand kit";
  return ALL_TILES.find((t) => t.k === tab)?.label || "";
}

// The groups for this client: only tabs that exist; `locked` tabs keep a lock label ("HyperCare+" / "Soon").
export function groupsFor(tabKeys, locked = new Set(), lockText = "Soon") {
  const has = new Set(tabKeys);
  return GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => has.has(i.k)).map((i) => (locked.has(i.k) ? { ...i, locked: i.k === "studio_smpl" || i.k === "studio_ads" ? "Soon" : lockText } : i)),
  })).filter((g) => g.items.length > 0);
}

// Calendar periods in Pacific time (the same calendar the server's work_counts use).
export const pacificToday = () => {
  const p = {};
  for (const x of new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date())) p[x.type] = x.value;
  return `${p.year}-${p.month}-${p.day}`;
};
export function inPeriod(day, period, today = pacificToday()) {
  if (!day) return false;
  const d = String(day).slice(0, 10);
  if (period === "today") return d === today;
  if (period === "month") return d.slice(0, 7) === today.slice(0, 7);
  if (period === "year") return d.slice(0, 4) === today.slice(0, 4);
  const [y, m, dd] = today.split("-").map(Number);
  const t = Date.UTC(y, m - 1, dd);
  const start = new Date(t - ((new Date(t).getUTCDay() + 6) % 7) * 864e5).toISOString().slice(0, 10);
  const end = new Date(Date.parse(`${start}T00:00:00Z`) + 6 * 864e5).toISOString().slice(0, 10);
  return d >= start && d <= end;
}
