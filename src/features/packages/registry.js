import { Globe, Radar, Layout, Cpu, Workflow, Palette, Grid3x3, Clapperboard, LifeBuoy } from "lucide-react";

// The nine packages (eight pillars + GravïtyCare). Each one is a page: all clients on it, one orb rail per client.
// service_keys  → TaskTemplate.service_key / Project.service_key that belong to this package
// crm_services  → CRMClient.services_managed values that mean "this client is on the package"
// price_match   → CRMClient.services[].name regex (the billing line items)
export const PACKAGES = [
  {
    key: "orbit-seo",
    label: "HyperCare+",
    arch: "Neptune",
    version: "5.5",
    tagline: "Your entire online presence. Managed. Every month.",
    icon: Globe,
    color: "#ff3c00",
    kind: "recurring",
    service_keys: ["orbit_setup", "orbit_local", "orbit_multi", "orbit_national", "orbit_global"],
    crm_services: ["orbit_seo"],
    price_match: /ørbit|orbit|hypercare/i
  },
  {
    key: "intel-briefing",
    label: "Intel Briefing",
    arch: "Inspector",
    version: "10.9",
    tagline: "Know exactly what to do, before the build begins.",
    icon: Radar,
    color: "#57534e",
    kind: "delivery",
    service_keys: ["intel_briefing"],
    crm_services: [],
    price_match: /intel/i
  },
  {
    key: "custom-website",
    label: "Custom Website",
    arch: "Architect",
    version: "2.1",
    tagline: "Built to convert. Limitless features. Unlimited revisions.",
    icon: Layout,
    color: "#1a1a1a",
    kind: "delivery",
    service_keys: ["website"],
    crm_services: ["website"],
    price_match: /website/i
  },
  {
    key: "command-system",
    label: "Command System",
    arch: "Ørigin",
    version: "1.0",
    tagline: "Runs your entire operation.",
    icon: Cpu,
    color: "#8a2e00",
    kind: "delivery",
    service_keys: ["system"],
    crm_services: ["system"],
    price_match: /command system|software|system/i
  },
  {
    key: "ops-command",
    label: "Ops Command",
    arch: "Protocol",
    version: "3.6",
    tagline: "Runs without you in the middle.",
    icon: Workflow,
    color: "#b45309",
    kind: "delivery",
    service_keys: ["ops_command"],
    crm_services: [],
    price_match: /ops/i
  },
  {
    key: "brand-arsenal",
    label: "Brand Arsenal",
    arch: "Tesseract",
    version: "2.3",
    tagline: "Recognisable everywhere you appear.",
    icon: Palette,
    color: "#ff6a00",
    kind: "delivery",
    service_keys: ["brand_arsenal"],
    crm_services: ["brand"],
    price_match: /brand/i
  },
  {
    key: "launch-grid",
    label: "Launch Grid",
    arch: "Networx",
    version: "8.6",
    tagline: "One business. Everywhere a customer looks.",
    icon: Grid3x3,
    color: "#15803d",
    kind: "delivery",
    service_keys: ["launch_grid"],
    crm_services: [],
    price_match: /launch grid|listings|gbp badge/i
  },
  {
    key: "transmission",
    label: "Transmission",
    arch: "FPS",
    version: "1.1",
    tagline: "Your business, explained in ninety seconds.",
    icon: Clapperboard,
    color: "#c2410c",
    kind: "delivery",
    service_keys: ["transmission"],
    crm_services: [],
    price_match: /transmission|video/i
  },
  {
    key: "gravitycare",
    label: "GravïtyCare",
    arch: "Neptune",
    version: "5.5",
    tagline: "Keeps you afloat. Hosting, uptime, fixes and small edits — the site stays live.",
    icon: LifeBuoy,
    color: "#0f766e",
    kind: "recurring",
    service_keys: ["starship"],
    crm_services: ["starship_care"],
    price_match: /gravity|gravïty|starsh/i
  }
];

// Subscriptions (recurring, billed monthly) vs packages (paid up front, delivered once).
export const SUBSCRIPTIONS = PACKAGES.filter((p) => p.kind === "recurring");
export const DELIVERY_PACKAGES = PACKAGES.filter((p) => p.kind === "delivery");

export const packageByKey = (key) => PACKAGES.find((p) => p.key === key) || null;
export const packagePath = (key) => "/packages/" + key;

// Orb states, shared by every package page.
// Ink + flame only, like the rest of the system. State is carried by fill and mark, not by hue.
export const ORB_STATES = {
  done: { label: "Done", color: "#1a1a1a" },
  working: { label: "In flight", color: "#ff3c00" },
  attention: { label: "Needs you", color: "#ff3c00" },
  pending: { label: "Queued", color: "#8a8580" },
  off: { label: "Not set up", color: "#b9b4ad" }
};

// The HyperCare+ pipeline — what the system does for a client, in order, every cycle.
export const ORBIT_STAGES = [
  { key: "criteria", label: "Criteria", short: "Profile", hint: "Footprint, locations, goals and strategy from the client profile" },
  { key: "blog_draft", label: "Blog drafted", short: "Draft", hint: "This cycle's blog written against the criteria" },
  { key: "blog_live", label: "Blog live", short: "Live", hint: "Published and verified on the site" },
  { key: "gbp", label: "GBP post", short: "GBP", hint: "Google Business Profile post referencing the blog" },
  { key: "intel", label: "Intel applied", short: "Intel", hint: "Last 24h of Google / AI-search changes acted on" },
  { key: "gsc", label: "Search Console", short: "GSC", hint: "Indexing requested, errors and enhancements fixed" },
  { key: "analytics", label: "Analytics", short: "GA", hint: "GA4 + Search Console behaviour visible here" }
];
