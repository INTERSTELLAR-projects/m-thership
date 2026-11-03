// Request types: ONE config (REQUEST_TYPES) drives the portal request picker, the admin queue filters,
// labels everywhere and the default per-client forms. To add a request type, add an entry here — the
// backend accepts any slug kind, so nothing else needs to change.
// The RequestForm entity holds optional per-client custom copies; a custom form replaces the standard
// one of the same kind in that client's portal.

export const FIELD_TYPES = [
  ["short_text", "Short text"], ["long_text", "Long text"], ["select", "Dropdown"], ["multi_select", "Multi-select"],
  ["date", "Date"], ["number", "Number"], ["email", "Email"], ["phone", "Phone"], ["url", "Link"], ["checkbox", "Checkbox"],
  ["photos", "Photos"], ["files", "Files"],
];

const f = (id, label, type = "short_text", extra = {}) => ({ id, label, type, ...extra });

// Fields every portal request gets (unless the form already has an equivalent).
export const PRIORITY_OPTIONS = ["Normal", "High", "Urgent"];
export const COMMON_FIELDS = {
  priority: f("priority", "Priority", "select", { options: PRIORITY_OPTIONS, placeholder: "Normal", help: "Urgent = something is broken or time-sensitive." }),
  due_date: f("due_date", "Needed by (optional)", "date"),
  attachments: f("attachments", "Attachments (optional)", "files", { help: "Screenshots, photos, PDFs, logos — anything that helps." }),
};

/*
 * kind        stored on ClientRequest.kind / RequestForm.kind (slug)
 * label       short label (chips, admin queue)
 * title/intro shown on the portal card and form
 * fields      type-specific questions (common fields are appended automatically)
 * portal      false = not offered as a standard portal form (only via a client's custom RequestForm)
 * base        true  = included in "Set up default forms" copies for a client (public form links)
 * noDue       true  = no "needed by" date
 */
export const REQUEST_TYPES = [
  {
    kind: "site_edit", label: "Website edit", title: "Website edit", base: true,
    intro: "Tell us what to change and where. Small edits are usually live within 3 business days.",
    fields: [
      f("page", "Which page? (name or URL)", "short_text", { required: true, placeholder: "Contact page or https://…/contact" }),
      f("change", "What should change?", "long_text", { required: true, placeholder: "New text, new hours, swap a photo…" }),
      f("current", "What it says now (if replacing text)", "long_text"),
    ],
    claude_instructions: "Apply the change on the client's Base44 website. Keep brand voice and existing layout. Log the edit as WorkLog kind site_edit and mark the request complete with the page URL.",
  },
  {
    kind: "new_page", label: "New page", title: "New page", base: true,
    intro: "A new service, location or landing page.",
    fields: [
      f("page_name", "Page name", "short_text", { required: true }),
      f("purpose", "What is it for?", "select", { required: true, options: ["New service", "New location / area", "Landing page for ads", "Other"] }),
      f("content", "Everything the page should say", "long_text", { required: true }),
      f("cta", "What should visitors do?", "select", { options: ["Call", "Book online", "Request a quote", "Buy"] }),
      f("example", "A page you like the look of (optional)", "url"),
      f("photos", "Photos for the page", "photos"),
    ],
    claude_instructions: "Build the page on the client's site with answer-first copy, matching the site's design, SEO title/meta, schema and internal links from related pages. Request indexing after publish.",
  },
  {
    kind: "blog_post", label: "Blog / content", title: "Blog or content",
    intro: "A blog post, article, FAQ or page copy you want written.",
    fields: [
      f("topic", "Topic or title idea", "short_text", { required: true, placeholder: "Best time of year to install a paver patio" }),
      f("content_type", "Type", "select", { required: true, options: ["Blog post", "Service page copy", "Case study", "FAQ", "Newsletter", "Other"] }),
      f("points", "Key points, offers or facts to include", "long_text"),
      f("keywords", "Words people search for (if you know)", "short_text"),
      f("audience", "Who is it for?", "short_text"),
      f("photos", "Photos to use", "photos"),
    ],
  },
  {
    kind: "gbp_post", label: "Google post", title: "Google Business post",
    intro: "An update, offer or event for your Google Business Profile.",
    fields: [
      f("topic", "What's the post about?", "short_text", { required: true, placeholder: "Fall cleanup special" }),
      f("post_type", "Post type", "select", { required: true, options: ["Update", "Offer", "Event", "New product / service"] }),
      f("details", "Details", "long_text", { required: true, help: "No need for your phone, address or links — Google rejects those in posts, and your profile already shows them." }),
      f("offer_dates", "Offer or event dates", "short_text"),
      f("button", "Button", "select", { options: ["Learn more", "Book", "Order online", "Call", "Sign up"] }),
      f("photos", "Photo for the post", "photos"),
    ],
  },
  {
    kind: "social_post", label: "Social post", title: "Social post",
    intro: "A post for Facebook, Instagram or your other channels.",
    fields: [
      f("platforms", "Where?", "multi_select", { required: true, options: ["Facebook", "Instagram", "TikTok", "LinkedIn", "X", "YouTube", "Nextdoor"] }),
      f("topic", "What's it about?", "short_text", { required: true }),
      f("caption", "Caption ideas or must-say details", "long_text"),
      f("photos", "Photos or video", "files"),
    ],
  },
  {
    kind: "design_asset", label: "Design asset", title: "Design asset",
    intro: "Logos, graphics, flyers, cards, signs and menus.",
    fields: [
      f("asset_type", "What do you need?", "select", { required: true, options: ["Logo", "Graphic", "Flyer", "Social graphic", "Business card", "Banner / sign", "Menu", "Other"] }),
      f("purpose", "What's it for and what should it say?", "long_text", { required: true }),
      f("size", "Size or format", "short_text", { placeholder: "8.5×11 print, 1080×1080, 3×6 ft banner" }),
      f("style", "Style notes or examples you like", "long_text"),
      f("references", "Reference images or files", "files"),
    ],
  },
  {
    kind: "email_signature", label: "Email signature", title: "Email signature",
    intro: "New or updated email signatures. You can also build your own under Signatures.",
    fields: [
      f("people", "Who needs one? Name, title, phone and email for each", "long_text", { required: true }),
      f("changes", "Anything to add or change (banner, social links, promo)", "long_text"),
      f("headshots", "Headshots (optional)", "photos"),
    ],
  },
  {
    kind: "seo_question", label: "SEO question", title: "SEO question", noDue: true,
    intro: "Rankings, Google, reviews, AI search — ask anything.",
    fields: [
      f("topic", "About", "select", { required: true, options: ["Rankings", "Google Business Profile", "Reviews", "Traffic / analytics", "AI search (ChatGPT, Google AI)", "Competitors", "Other"] }),
      f("question", "Your question", "long_text", { required: true }),
      f("keyword_or_url", "Keyword or page it's about (optional)", "short_text"),
    ],
  },
  {
    kind: "bug", label: "Something's broken", title: "Something's broken",
    intro: "A broken page, form, link or app screen. Mark it Urgent if customers can't reach you.",
    fields: [
      f("where", "Where is it? (page, URL or app screen)", "short_text", { required: true }),
      f("what", "What happened?", "long_text", { required: true }),
      f("expected", "What should happen instead?", "long_text"),
      f("device", "Device", "select", { options: ["Phone", "Tablet", "Computer", "All of them", "Not sure"] }),
      f("browser", "Browser", "select", { options: ["Chrome", "Safari", "Edge", "Firefox", "Other / not sure"] }),
      f("since", "When did it start?", "short_text"),
    ],
  },
  {
    kind: "app_edit", label: "App / automation", title: "App or automation change", base: true,
    intro: "Changes to your app, system or automations: a field, a screen, a workflow, a report.",
    fields: [
      f("area", "Which part?", "select", { required: true, options: ["Leads / CRM", "Quotes", "Jobs / scheduling", "Invoices / payments", "Customer portal", "Rewards", "Automations / notifications", "Website forms", "Integrations", "Reports", "Users / permissions", "Other"] }),
      f("change", "What should it do differently?", "long_text", { required: true }),
      f("why", "What problem does this solve?", "long_text"),
    ],
    claude_instructions: "Scope the change against the client's Ørigin 1.0 system (ops_app_id on the CRMClient). Small changes under GravïtyCare hours: implement, checkpoint, log Work. Larger: reply with a scoped quote via client_note and set needs_info.",
  },
  {
    kind: "billing", label: "Billing", title: "Billing question", noDue: true,
    intro: "Invoices, payments, plan changes and receipts.",
    fields: [
      f("topic", "About", "select", { required: true, options: ["An invoice", "Payment method", "Plan / services change", "Refund or credit", "Receipt", "Other"] }),
      f("invoice", "Invoice number (if any)", "short_text"),
      f("question", "Your question", "long_text", { required: true }),
    ],
  },
  {
    kind: "question", label: "Question", title: "General question", base: true, noDue: true,
    intro: "Anything at all. We reply within 1 business day.",
    fields: [f("question", "Your question", "long_text", { required: true })],
    claude_instructions: "Do not act. Leave for Justin to answer via client_note.",
  },
  {
    kind: "other", label: "Other", title: "Something else",
    intro: "Doesn't fit the others? Tell us here.",
    fields: [
      f("summary", "What do you need?", "short_text", { required: true }),
      f("details", "Details", "long_text", { required: true }),
    ],
  },
  // Not offered as standard portal forms; they come from a client's custom (industry) RequestForm.
  { kind: "project_submission", label: "New project", title: "New project", portal: false, fields: [] },
  { kind: "job", label: "Job completed", title: "Job completed", portal: false, fields: [] },
  // Created only by "Use my credits" on the portal Referrals tab (validated by the portal function's
  // prestige_redeem action). Justin approves it on the Prestige page; nothing is deducted automatically.
  { kind: "credit_redemption", label: "Credit redemption", title: "Credit redemption", portal: false, noDue: true, fields: [] },
];

export const KIND_LABELS = Object.fromEntries(REQUEST_TYPES.map((t) => [t.kind, t.label]));
export const KIND_ORDER = [
  ...REQUEST_TYPES.filter((t) => t.portal === false).map((t) => t.kind),
  ...REQUEST_TYPES.filter((t) => t.portal !== false).map((t) => t.kind),
];
// Live overrides from Settings > Lists & fields > Request types ([{ value: kind, label, archived }]).
// Set by useOptionLists (admin) and passed explicitly by the portal (from the portal function).
let TYPE_OVERRIDES = null;
export function setRequestTypeOverrides(items) { TYPE_OVERRIDES = Array.isArray(items) && items.length ? items : null; }
const overrideFor = (k, list = TYPE_OVERRIDES) => (list || []).find((t) => t && t.value === k) || null;
export const kindLabel = (k) => (overrideFor(k)?.label) || KIND_LABELS[k] || String(k || "other").replace(/_/g, " ");

// Append the common fields a form doesn't already cover.
export function withCommonFields(form) {
  const fields = form.fields || [];
  const type = REQUEST_TYPES.find((t) => t.kind === form.kind);
  const ids = new Set(fields.map((x) => x.id));
  const hasFiles = fields.some((x) => x.type === "files" || x.type === "photos");
  const extra = [];
  if (!ids.has("priority") && !ids.has("urgent")) extra.push(COMMON_FIELDS.priority);
  if (!ids.has("due_date") && !type?.noDue) extra.push(COMMON_FIELDS.due_date);
  if (!hasFiles) extra.push(COMMON_FIELDS.attachments);
  return extra.length ? { ...form, fields: [...fields, ...extra] } : form;
}

// Standard portal forms for every client (id "std:<kind>" — not a RequestForm record).
export const STANDARD_FORMS = REQUEST_TYPES.filter((t) => t.portal !== false).map((t) => ({
  id: `std:${t.kind}`, kind: t.kind, title: t.title, intro: t.intro, fields: t.fields, standard: true,
}));

// What a client sees in their portal: custom forms replace the standard form of the same kind.
// overrides: request-type list from Settings (archived = standard form hidden, label = renamed, order = list order).
export function portalForms(customForms = [], overrides = TYPE_OVERRIDES) {
  const list = Array.isArray(overrides) && overrides.length ? overrides : null;
  const custom = (customForms || []).filter((x) => x.active !== false);
  const kinds = new Set(custom.map((x) => x.kind));
  const standard = STANDARD_FORMS.filter((s) => !kinds.has(s.kind)).filter((s) => !(overrideFor(s.kind, list)?.archived))
    .map((s) => {
      const o = overrideFor(s.kind, list);
      return o?.label && o.label !== KIND_LABELS[s.kind] ? { ...s, title: o.label } : s;
    });
  const all = [...custom, ...standard];
  const order = list ? [...list.map((t) => t.value), ...KIND_ORDER.filter((k) => !list.some((t) => t.value === k))] : KIND_ORDER;
  return order.flatMap((k) => all.filter((x) => x.kind === k))
    .concat(all.filter((x) => !order.includes(x.kind)))
    .map(withCommonFields);
}

// Map the form's priority answer (or a legacy "urgent" checkbox) to ClientRequest.priority.
export function priorityFor(vals) {
  if (vals?.urgent === true) return "urgent";
  const p = String(vals?.priority || "").toLowerCase();
  return ["low", "high", "urgent"].includes(p) ? p : "normal";
}

// Shared forms copied into a client's RequestForm records by "Set up default forms" (each gets a public link).
export const BASE_FORMS = REQUEST_TYPES.filter((t) => t.base).map(({ kind, title, intro, fields, claude_instructions }) => ({ kind, title, intro, fields, claude_instructions }));

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
  const pickBy = (type) => form.fields.find((x) => x.type === type && x.id !== "priority" && vals[x.id]);
  const first = pickBy("short_text") || pickBy("select") || pickBy("long_text");
  const raw = first ? String(vals[first.id]).replace(/\s+/g, " ").trim() : "";
  const t = raw.length > 90 ? `${raw.slice(0, 87)}…` : raw;
  return t ? `${KIND_LABELS[form.kind] || form.title}: ${t}` : `${form.title} from ${form.client_name}`;
}
export function detailsFor(form, vals) {
  return form.fields.filter((x) => !["photos", "files"].includes(x.type) && vals[x.id] != null && vals[x.id] !== "" && vals[x.id] !== false)
    .map((x) => `${x.label}: ${Array.isArray(vals[x.id]) ? vals[x.id].join(", ") : vals[x.id] === true ? "Yes" : vals[x.id]}`).join("\n");
}
export function attachmentsFor(form, vals) {
  return form.fields.filter((x) => ["photos", "files"].includes(x.type)).flatMap((x) => (Array.isArray(vals[x.id]) ? vals[x.id] : []));
}
