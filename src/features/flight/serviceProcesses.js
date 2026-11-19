// One process per thing we sell (Clients › Service Process). Each step: owner, auto/manual, where it happens.
const S = (title, owner, mode, where, to) => ({ title, owner, mode, where, to });
export const PROCESSES = [
  { key: "mission_alpha", label: "Mission ALPHA", sales: ["mission_alpha"], steps: [
    S("Lead added + scraped", "Claude", "auto", "Command › Add lead", "/"),
    S("Brief + new-client prep", "Claude", "auto", "Client › Build", "/crm"),
    S("Call + custom quote", "Justin", "manual", "Calls", "/calls"),
    S("Invoice + deal value", "Justin (money gate)", "manual", "Pipeline › lead card", "/pipeline"),
    S("Flight plan: contacts, brand, access, goals", "Claude + client", "auto", "Service Process › flight", "/flight-plan"),
    S("Website + Command System build", "Claude", "auto", "Claude", "/claude"),
    S("Taste review", "Justin (taste)", "manual", "Command › Needs you", "/"),
    S("Launch grid: listings, citations, GBP", "Claude", "auto", "Client › Build › Launch grid", "/crm"),
    S("Publish + DNS", "Justin (hard gate)", "manual", "Road to Dec 31", "/launch"),
    S("HyperCare+ engine starts", "Claude", "auto", "Packages › HyperCare+", "/packages/orbit-seo"),
  ] },
  { key: "website", label: "Website", sales: ["custom_website", "mission_bravo"], steps: [
    S("Lead + scrape", "Claude", "auto", "Command › Add lead", "/"),
    S("Brief from the Brain", "Claude", "auto", "Client › Brain", "/crm"),
    S("Design pass", "Justin (taste)", "manual", "Client › Build", "/crm"),
    S("Content, SEO structure, schema, speed", "Claude", "auto", "Claude", "/claude"),
    S("Forms, booking, tracking", "Claude", "auto", "Client › Systems", "/crm"),
    S("Publish + DNS", "Justin (hard gate)", "manual", "Road to Dec 31", "/launch"),
    S("Search Console + sitemap", "Claude", "auto", "Marketing › Search", "/performance"),
  ] },
  { key: "command_system", label: "Command System", sales: ["command_system", "ops_command", "mission_bravo"], steps: [
    S("Process call", "Justin + client", "manual", "Calls", "/calls"),
    S("Process map + data model", "Claude", "auto", "Client › Brain", "/crm"),
    S("Core screens + automations", "Claude", "auto", "Claude", "/claude"),
    S("Look and feel", "Justin (taste)", "manual", "Command › Needs you", "/"),
    S("Test with sample data", "Claude", "auto", "Client › Systems", "/crm"),
    S("Publish + crew invites", "Justin (hard gate)", "manual", "Road to Dec 31", "/launch"),
    S("Training + hand-off", "Claude + Justin", "manual", "Training", "/training"),
  ] },
  { key: "hypercare", label: "HyperCare+", sales: ["orbit_local", "orbit_national", "orbit_global", "orbit_multi"], steps: [
    S("Stripe subscription live", "Justin (money gate)", "manual", "Money › Financial › Stripe", "/financial?tab=stripe"),
    S("Engine start: four lights green", "Claude", "auto", "Packages › HyperCare+", "/packages/orbit-seo"),
    S("Monthly Topic Calendar", "Claude", "auto", "Claude", "/claude"),
    S("Blogs + GBP posts", "Claude", "auto", "Client › Build › Growth feed", "/crm"),
    S("Citations + map pack", "Claude", "auto", "Marketing › Backlinks", "/backlinks"),
    S("Monthly report to portal", "Claude", "auto", "Client › Work log", "/crm"),
  ] },
  { key: "gravitycare", label: "GravïtyCare", sales: ["starship_care"], steps: [
    S("Stripe subscription live", "Justin (money gate)", "manual", "Money › Financial › Stripe", "/financial?tab=stripe"),
    S("Site care: uptime, security, backups", "Claude", "auto", "Marketing › Site security", "/security"),
    S("Edits from requests", "Claude", "auto", "Clients › Requests", "/requests"),
    S("Monthly care note to portal", "Claude", "auto", "Client › Work log", "/crm"),
  ] },
  { key: "addons", label: "Add-ons", sales: ["brand_arsenal", "launch_grid", "transmission"], steps: [
    S("Bought in the Upgrade Store or quoted", "Client / Justin", "manual", "Sales › Upgrade Store", "/upgrades"),
    S("Activated + queued", "Claude", "auto", "Claude", "/claude"),
    S("Delivered + logged", "Claude", "auto", "Client › Files", "/crm"),
  ] },
];

