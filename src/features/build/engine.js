// Build Engine (Nov 2026): every client, from any source and any brand, runs the same flow:
//   add lead → scrape → brief → build (Claude, step 3) → build checklist → launch → grow.
// Pure helpers and the few writes the screens share. The scrape itself is the lead-scrape backend function.
import { base44 } from "@/api/base44Client";
import { logAction } from "@/lib/usageLog";

export const FLOW = ["Add lead", "Scrape", "Brief", "Build", "Checklist", "Launch", "Grow"];

export const SOURCES = [
  { value: "referral", label: "Referral" },
  { value: "in_person", label: "In person" },
  { value: "inbound", label: "Inbound" },
  { value: "cold", label: "Cold" },
];

export const NICHES = {
  home_service: "Home service",
  fitness_coach: "Fitness coach",
  retail_streetwear: "Retail / streetwear",
  food_bev: "Food & beverage",
  other: "Other",
};

// Brain % → what it unlocks. Shown on the client page as the Brain meter.
export const UNLOCKS = [
  { at: 25, label: "Brief", hint: "Enough to write the build brief" },
  { at: 50, label: "Build", hint: "Claude can start the website and Command System" },
  { at: 75, label: "Launch grid", hint: "Listings, citations and profiles can go out" },
  { at: 90, label: "Growth engine", hint: "Blogs, GBP posts and social run on their own" },
];
export const unlockState = (pct) => UNLOCKS.map((u) => ({ ...u, on: (Number(pct) || 0) >= u.at }));

// Build checklist: two tracks. Placeholders until step 3 wires real items.
export const TRACKS = [
  { key: "website", label: "Website", items: ["Brand cues and references", "Sitemap and page plan", "Design pass (your taste call)", "Content and SEO structure", "Schema, speed and accessibility", "Forms, booking and tracking", "Preview and your look-over", "Publish and DNS (your tap)"] },
  { key: "command", label: "Command System", items: ["Process map from the Brain", "Data model", "Core screens", "Automations and notifications", "Client portal hooks", "Test run with sample data", "Hand-off and training", "Publish (your tap)"] },
];

// Launch grid placeholder: where the client needs to be live.
export const LAUNCH_GRID = ["Website", "Google Business", "Bing Places", "Apple Maps", "Facebook", "Instagram", "Yelp", "Citations", "Search Console", "Analytics"];

export function normUrl(u) {
  const v = String(u || "").trim();
  if (!v) return "";
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}
export const domainOf = (u) => { try { return new URL(normUrl(u)).hostname.replace(/^www\./, ""); } catch { return ""; } };

// Quick-add: a lead is a CRMClient with status Lead. References keep links and uploaded files of the look.
export async function createLead(f) {
  const site = normUrl(f.website);
  const rec = await base44.entities.CRMClient.create({
    business: String(f.business || "").trim(),
    status: "Lead",
    pipeline_stage: "new",
    websites: site ? [site] : [],
    domain: domainOf(site),
    gbp_url: normUrl(f.gbp_url),
    one_liner: String(f.one_liner || "").trim().slice(0, 200),
    brand_id: f.brand_id || "",
    lead_source: f.source || "",
    lead_references: f.references || [],
    scrape_status: "none",
    stage_changed_at: new Date().toISOString(),
  });
  logAction("quick_add_lead");
  return rec;
}

export async function scrapeLead(clientId) {
  logAction("scrape_lead");
  const r = await base44.functions.invoke("lead-scrape", { action: "scrape", client_id: clientId });
  return r.data || {};
}

// Jobs the build agent (step 3) will run. Held until it exists, so nothing picks them up early.
export const HOLD = { held_for: "build_engine_step3" };

export function leadBrief(c, brain) {
  const s = c.scrape_summary || {};
  const lines = [
    `# Build: ${c.business}`,
    "",
    `What they do: ${c.one_liner || s.one_liner || "(not given)"}`,
    `Website: ${(c.websites || [])[0] || "(none)"} · GBP: ${c.gbp_url || "(none)"}`,
    `Brand: ${c.brand_id || "interstellar"} · Source: ${c.lead_source || "(not set)"} · Niche: ${c.niche_key || "other"}`,
    `Brain: ${brain?.completeness ?? 0}%`,
    "",
    "## Scrape summary",
    `Industry: ${s.industry || "not found"} · Model: ${s.business_model || "not found"} · Market: ${s.market || "not found"}`,
    `Services: ${(s.services || []).join("; ") || "not found"}`,
    `Colors: ${(s.colors || []).join(", ") || "not found"} · Logo: ${s.logo_url || "not found"} · Tone: ${s.tone || "not found"}`,
    `Competitors: ${(s.competitors || []).map((x) => x.name).join(", ") || "not found"}`,
    `Not found: ${(s.not_found || []).join(", ") || "nothing"}`,
    "",
    "## References",
    ...((c.lead_references || []).map((r) => `- ${r.name || r.kind}: ${r.url}`)),
    "",
    "Build the website and Command System from the niche template and this Brain. Justin approves taste only (look, feel, brand tone). Publishing, DNS, money and client sends wait for his tap.",
  ];
  return lines.join("\n");
}

export async function sendToBuild(c, brain) {
  const now = new Date().toISOString();
  const job = await base44.entities.ClaudeJob.create({
    title: `Build: ${c.business}`,
    kind: "lead_build",
    status: "queued",
    client_id: c.id,
    client_name: c.business,
    brand: c.brand_id || "interstellar",
    instruction: `Build ${c.business} from the lead card`,
    instructions: leadBrief(c, brain),
    references: c.lead_references || [],
    priority: 2,
    requested_at: now,
    complete_task_on_approve: false,
    not_before: "2099-12-31",
    context: { ...HOLD, niche_key: c.niche_key || "other", scrape_summary: c.scrape_summary || null, one_liner: c.one_liner || "", source: c.lead_source || "", brain_pct: brain?.completeness ?? 0 },
  });
  logAction("send_to_build");
  return job;
}

export async function sendCommand({ client, instruction, kind = "command", references = [] }) {
  const now = new Date().toISOString();
  const job = await base44.entities.ClaudeJob.create({
    title: `${client ? client.business + ": " : ""}${String(instruction).trim().slice(0, 90)}`,
    kind,
    status: "queued",
    client_id: client?.id || "",
    client_name: client?.business || "",
    brand: client?.brand_id || "interstellar",
    instruction: String(instruction).trim(),
    instructions: String(instruction).trim(),
    references,
    priority: 3,
    requested_at: now,
    complete_task_on_approve: false,
    not_before: "2099-12-31",
    context: { ...HOLD },
  });
  logAction("claude_command");
  return job;
}

export const isHeld = (j) => j?.context?.held_for === "build_engine_step3" && j?.status === "queued";
