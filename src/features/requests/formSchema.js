// Request kinds + per-industry starter forms. The RequestForm entity holds the live, editable copy per client.

export const KIND_LABELS = {
  site_edit: "Website edit",
  project_submission: "New project",
  job: "Job completed",
  new_page: "New page",
  question: "Question",
  app_edit: "Ørigin 1.0 edit",
  other: "Other",
};
export const KIND_ORDER = ["project_submission", "job", "site_edit", "new_page", "app_edit", "question", "other"];

export const FIELD_TYPES = [
  ["short_text", "Short text"], ["long_text", "Long text"], ["select", "Dropdown"], ["multi_select", "Multi-select"],
  ["date", "Date"], ["number", "Number"], ["email", "Email"], ["phone", "Phone"], ["url", "Link"], ["checkbox", "Checkbox"],
  ["photos", "Photos"], ["files", "Files"],
];

const f = (id, label, type = "short_text", extra = {}) => ({ id, label, type, ...extra });

// Shared forms every client gets
export const BASE_FORMS = [
  {
    kind: "site_edit", title: "Website edit", intro: "Tell us what to change and where. Small edits are usually live within 3 business days.",
    fields: [
      f("page", "Which page?", "short_text", { required: true, placeholder: "Contact page" }),
      f("change", "What should change?", "long_text", { required: true, placeholder: "New text, new hours, swap a photo…" }),
      f("screens", "Screenshots or files", "files"),
      f("urgent", "This is urgent", "checkbox"),
    ],
    claude_instructions: "Apply the change on the client's Base44 website. Keep brand voice and existing layout. Log the edit as WorkLog kind site_edit and mark the request complete with the page URL.",
  },
  {
    kind: "new_page", title: "New page", intro: "A new service, location or landing page.",
    fields: [
      f("page_name", "Page name", "short_text", { required: true }),
      f("purpose", "What is it for?", "select", { required: true, options: ["New service", "New location / area", "Landing page for ads", "Other"] }),
      f("content", "Everything the page should say", "long_text", { required: true }),
      f("photos", "Photos for the page", "photos"),
      f("cta", "What should visitors do?", "select", { options: ["Call", "Book online", "Request a quote", "Buy"] }),
    ],
    claude_instructions: "Build the page on the client's site with answer-first copy, matching the site's design, SEO title/meta, schema and internal links from related pages. Request indexing after publish.",
  },
  {
    kind: "app_edit", title: "Ørigin 1.0 edit", intro: "Changes to your Command System: a field, a screen, an automation, a report.",
    fields: [
      f("area", "Which part of the system?", "select", { required: true, options: ["Leads / CRM", "Quotes", "Jobs / scheduling", "Invoices / payments", "Customer portal", "Rewards", "Automations / notifications", "Reports", "Users / permissions", "Other"] }),
      f("change", "What should it do differently?", "long_text", { required: true }),
      f("why", "What problem does this solve?", "long_text"),
      f("screens", "Screenshots", "files"),
    ],
    claude_instructions: "Scope the change against the client's Ørigin 1.0 system (ops_app_id on the CRMClient). Small changes under GravïtyCare hours: implement, checkpoint, log Work. Larger: reply with a scoped quote via client_note and set needs_info.",
  },
  {
    kind: "question", title: "Question", intro: "Anything at all. We reply within 1 business day.",
    fields: [f("question", "Your question", "long_text", { required: true })],
    claude_instructions: "Do not act. Leave for Justin to answer via client_note.",
  },
];

// Industry-specific project / job forms. Every client gets one of these as their "New project" form.
const PROJECT_COMMON_TAIL = [
  f("photos", "Photos (before and after if you have them)", "photos", { required: true, help: "Phone photos are fine. Landscape works best." }),
  f("customer_quote", "Anything the customer said?", "long_text", { placeholder: "A line we can quote on the page" }),
  f("ok_to_publish", "OK to publish this on the website", "checkbox", { required: true }),
];
export const INDUSTRY_PROJECT_FORMS = {
  hardscape: {
    title: "New project", intro: "Every project you send becomes a page on your site. Takes 2 minutes.",
    fields: [
      f("project_title", "Project name", "short_text", { required: true, placeholder: "Paver patio + fire pit" }),
      f("project_type", "Type of work", "multi_select", { required: true, options: ["Paver patio", "Retaining wall", "Walkway / driveway", "Fire pit / fireplace", "Outdoor kitchen", "Pool deck", "Drainage", "Landscape", "Lighting"] }),
      f("location", "City / neighborhood", "short_text", { required: true }),
      f("size", "Approximate size", "short_text", { placeholder: "650 sq ft" }),
      f("materials", "Materials used", "short_text", { placeholder: "Belgard Mega-Arbel, travertine coping" }),
      f("completed_on", "Date completed", "date"),
      f("duration", "How long did it take?", "short_text", { placeholder: "4 days" }),
      f("story", "Tell us about it: what the customer wanted, challenges, result", "long_text", { required: true }),
      ...PROJECT_COMMON_TAIL,
    ],
  },
  tree: {
    title: "Job completed", intro: "Send us the job and we'll add it to your work gallery.",
    fields: [
      f("project_title", "Job", "short_text", { required: true, placeholder: "Hazard oak removal" }),
      f("project_type", "Type of work", "multi_select", { required: true, options: ["Tree removal", "Storm damage", "Trimming / pruning", "Stump grinding", "Land clearing", "Crane removal", "Emergency"] }),
      f("location", "City / area", "short_text", { required: true }),
      f("tree", "Species and size", "short_text", { placeholder: "90 ft Douglas fir, 36 in trunk" }),
      f("equipment", "Equipment used", "multi_select", { options: ["Bucket truck", "Crane", "Climber", "Chipper", "Stump grinder", "Skid steer"] }),
      f("completed_on", "Date completed", "date"),
      f("story", "What happened: the problem, how you handled it, the result", "long_text", { required: true }),
      ...PROJECT_COMMON_TAIL,
    ],
  },
  lawn: {
    title: "New project", intro: "Projects and transformations for your website gallery.",
    fields: [
      f("project_title", "Project name", "short_text", { required: true, placeholder: "Backyard sod + irrigation" }),
      f("project_type", "Type of work", "multi_select", { required: true, options: ["Lawn install / sod", "Irrigation", "Landscape design", "Mulch / beds", "Tree & shrub", "Hardscape", "Cleanup", "Maintenance"] }),
      f("location", "City / neighborhood", "short_text", { required: true }),
      f("size", "Lot / area size", "short_text"),
      f("completed_on", "Date completed", "date"),
      f("story", "Tell us about it", "long_text", { required: true }),
      ...PROJECT_COMMON_TAIL,
    ],
  },
  doors: {
    title: "Installation completed", intro: "Each install becomes a project page and a listing photo set.",
    fields: [
      f("project_title", "Install", "short_text", { required: true, placeholder: "40×14 hydraulic hangar door" }),
      f("project_type", "Door type", "select", { required: true, options: ["Hydraulic door", "Bifold door", "Custom / oversize", "Replacement", "Service call"] }),
      f("dimensions", "Door size", "short_text", { placeholder: "40 ft × 14 ft" }),
      f("building", "Building / use", "select", { options: ["Hangar", "Shop / barn", "Agricultural", "Commercial", "Residential"] }),
      f("location", "City / state", "short_text", { required: true }),
      f("completed_on", "Date completed", "date"),
      f("story", "About the project", "long_text", { required: true }),
      ...PROJECT_COMMON_TAIL,
    ],
  },
  tattoo: {
    title: "New piece", intro: "Finished work for your portfolio pages.",
    fields: [
      f("project_title", "Piece", "short_text", { required: true, placeholder: "Full sleeve, black & grey realism" }),
      f("artist", "Artist", "select", { required: true, options: ["Brandon", "Luis", "Guest artist"] }),
      f("style", "Style", "multi_select", { options: ["Black & grey", "Color", "Realism", "Traditional", "Fine line", "Script", "Cover-up", "Piercing"] }),
      f("placement", "Placement", "short_text", { placeholder: "Forearm" }),
      f("sessions", "Sessions / hours", "short_text" ),
      f("story", "About the piece (idea, meaning, process)", "long_text"),
      ...PROJECT_COMMON_TAIL,
    ],
  },
  barber: {
    title: "New cut", intro: "Fresh cuts for your gallery and Google profile.",
    fields: [
      f("project_title", "Cut / style", "short_text", { required: true, placeholder: "Mid skin fade with textured top" }),
      f("barber", "Barber", "short_text", { required: true }),
      f("location", "Shop", "select", { options: ["Molalla", "Oregon City"] }),
      f("style", "Style tags", "multi_select", { options: ["Fade", "Taper", "Beard", "Kids", "Design", "Classic", "Long hair"] }),
      ...PROJECT_COMMON_TAIL,
    ],
  },
  food: {
    title: "New item or event", intro: "Menu drops, specials and events for your site and socials.",
    fields: [
      f("project_title", "What is it?", "short_text", { required: true, placeholder: "Mango Chamoy slush" }),
      f("project_type", "Type", "select", { required: true, options: ["New menu item", "Seasonal special", "Event", "Catering", "Promotion"] }),
      f("price", "Price", "short_text"),
      f("dates", "Dates (if seasonal or an event)", "short_text"),
      f("story", "Describe it", "long_text", { required: true }),
      ...PROJECT_COMMON_TAIL,
    ],
  },
  retail: {
    title: "New arrival or event", intro: "Product drops and events for your site.",
    fields: [
      f("project_title", "What is it?", "short_text", { required: true, placeholder: "Prismatic Evolutions ETB restock" }),
      f("project_type", "Type", "select", { required: true, options: ["New product / restock", "Event / tournament", "Sale", "Announcement"] }),
      f("price", "Price", "short_text"),
      f("dates", "Date / time", "short_text"),
      f("story", "Details", "long_text", { required: true }),
      ...PROJECT_COMMON_TAIL,
    ],
  },
  coaching: {
    title: "Client win", intro: "Transformations and testimonials for your site (with permission).",
    fields: [
      f("project_title", "Headline", "short_text", { required: true, placeholder: "Marcus: −28 lb in 16 weeks" }),
      f("client_first_name", "Client first name", "short_text", { required: true }),
      f("program", "Program", "select", { options: ["Online coaching", "In-person", "Nutrition only", "Competition prep"] }),
      f("duration", "Timeframe", "short_text", { placeholder: "16 weeks" }),
      f("result", "The result (numbers if you have them)", "long_text", { required: true }),
      f("story", "Their story", "long_text" ),
      f("consent", "Client gave permission to share", "checkbox", { required: true }),
      ...PROJECT_COMMON_TAIL,
    ],
  },
  creative: {
    title: "New shoot", intro: "Shoots and edits for your portfolio.",
    fields: [
      f("project_title", "Shoot", "short_text", { required: true, placeholder: "Night shoot · Supra MK5" }),
      f("project_type", "Type", "multi_select", { options: ["Automotive", "Cinematic video", "Event", "Portrait", "Commercial"] }),
      f("location", "Location", "short_text"),
      f("gear", "Gear / technique", "short_text"),
      f("story", "About the shoot", "long_text"),
      f("video_url", "Video link (if any)", "url"),
      ...PROJECT_COMMON_TAIL,
    ],
  },
  saas: {
    title: "Feature or release", intro: "Releases, case studies and announcements for your site.",
    fields: [
      f("project_title", "Title", "short_text", { required: true }),
      f("project_type", "Type", "select", { required: true, options: ["New feature", "Case study", "Announcement", "Integration"] }),
      f("story", "Details", "long_text", { required: true }),
      f("link", "Link", "url"),
      ...PROJECT_COMMON_TAIL,
    ],
  },
  services: {
    title: "New project", intro: "Projects and results for your website.",
    fields: [
      f("project_title", "Project", "short_text", { required: true }),
      f("project_type", "Type of work", "short_text", { required: true }),
      f("location", "City / area", "short_text"),
      f("completed_on", "Date completed", "date"),
      f("story", "Tell us about it", "long_text", { required: true }),
      ...PROJECT_COMMON_TAIL,
    ],
  },
};
export const INDUSTRY_LABELS = { hardscape: "Hardscape / landscape construction", tree: "Tree service", lawn: "Lawn & landscape", doors: "Doors / installation", tattoo: "Tattoo studio", barber: "Barbershop", food: "Food & drink", retail: "Retail shop", coaching: "Coaching / fitness", creative: "Photo / video", saas: "Software / SaaS", services: "General services" };

export const DEFAULT_CLAUDE_PROJECT = "Create a project page on the client's Base44 website from this submission: a headline, 2–4 short paragraphs in the client's brand voice using the story and details, a photo gallery from the attachments (before/after first), the location and services as structured data (schema.org), and a CTA matching the site. Add it to the site's projects/work index and link it from the matching service page. Request indexing. Then set page_status=live and page_url on the request, log a WorkLog (kind project_page) and mark the request complete. Never invent facts not in the submission.";

export function buildDefaultForms(client, industryKey) {
  const proj = INDUSTRY_PROJECT_FORMS[industryKey] || INDUSTRY_PROJECT_FORMS.services;
  const site = (client.domain || client.websites?.[0] || "").replace(/^https?:\/\/(www\.)?/, "");
  const base = { client_id: client.id, client_name: client.business, industry: industryKey, active: true, submissions: 0 };
  return [
    { ...base, kind: "project_submission", title: proj.title, intro: proj.intro, fields: proj.fields, claude_instructions: DEFAULT_CLAUDE_PROJECT, publish_target: `Projects / work page on ${site || "the client site"}` },
    ...BASE_FORMS.map((b) => ({ ...base, ...b, publish_target: b.kind === "app_edit" ? "Client's Ørigin 1.0 system" : site || "the client site" })),
  ];
}

// Turn raw values into the readable answers array stored on the request (what Claude reads)
export function toAnswers(fields, vals) {
  return fields.map((fl) => ({ id: fl.id, label: fl.label, type: fl.type, value: vals[fl.id] ?? (fl.type === "checkbox" ? false : fl.type === "multi_select" || fl.type === "photos" || fl.type === "files" ? [] : "") }));
}
export function titleFor(form, vals) {
  const first = form.fields.find((x) => x.type === "short_text" && vals[x.id]);
  const t = first ? vals[first.id] : "";
  return t ? `${KIND_LABELS[form.kind] || form.title}: ${t}` : `${form.title} from ${form.client_name}`;
}
export function detailsFor(form, vals) {
  return form.fields.filter((x) => !["photos", "files"].includes(x.type) && vals[x.id] != null && vals[x.id] !== "" && vals[x.id] !== false)
    .map((x) => `${x.label}: ${Array.isArray(vals[x.id]) ? vals[x.id].join(", ") : vals[x.id] === true ? "Yes" : vals[x.id]}`).join("\n");
}
export function attachmentsFor(form, vals) {
  return form.fields.filter((x) => ["photos", "files"].includes(x.type)).flatMap((x) => (Array.isArray(vals[x.id]) ? vals[x.id] : []));
}
