// Portal "Submit" intake (Justin's standard for every client, Nov 19 2026; identical copy in base44/shared/submitTypes.js).
// What a client can send us depends on their niche. Every type takes photos; the fields fit the type.
// Capture only for now: a submission is stored (ContentSubmission, channel "portal", status "received") and opens a
// request on Justin's Command screen. Nothing is published to the client's site until auto-posting is wired per client.

export const SUBMIT_TYPES = {
  project: {
    label: "Job / project", hint: "A finished job we can show off",
    fields: [
      { key: "title", label: "What was the job?", type: "text", required: true, placeholder: "Backyard paver patio" },
      { key: "location", label: "Town / location", type: "text", required: true, placeholder: "Which town was it in?", tag: true },
      { key: "service", label: "Service", type: "text" },
      { key: "details", label: "Anything worth telling people about it", type: "textarea" },
    ],
    consent: false,
  },
  transformation: {
    label: "Before & after", hint: "A transformation: before photos and after photos",
    fields: [
      { key: "title", label: "What changed?", type: "text", required: true },
      { key: "timeframe", label: "How long did it take?", type: "text" },
      { key: "details", label: "The story", type: "textarea" },
    ],
    photo_labels: true,
    consent: true,
  },
  drop: {
    label: "New drop / product", hint: "Something new you're selling",
    fields: [
      { key: "product_name", label: "Product name", type: "text", required: true },
      { key: "price", label: "Price", type: "text", placeholder: "$" },
      { key: "release_date", label: "Release date", type: "date" },
      { key: "details", label: "Details (sizes, colors, limited run…)", type: "textarea" },
    ],
    consent: false,
  },
  testimonial: {
    label: "Testimonial", hint: "Something kind a customer said",
    fields: [
      { key: "customer_name", label: "Customer name (or first name + initial)", type: "text", required: true },
      { key: "quote", label: "What they said", type: "textarea", required: true },
      { key: "location", label: "Town / location", type: "text", tag: true },
    ],
    consent: true,
  },
  event: {
    label: "Event / deal", hint: "An event, a sale or a limited-time offer",
    fields: [
      { key: "title", label: "Event or deal", type: "text", required: true },
      { key: "date", label: "Date", type: "date" },
      { key: "offer", label: "The offer or what's happening", type: "textarea" },
      { key: "location", label: "Where", type: "text", tag: true },
    ],
    consent: false,
  },
};

export const SUBMIT_BY_NICHE = {
  home_service: ["project", "transformation", "testimonial", "event"],
  fitness_coach: ["transformation", "testimonial", "event"],
  retail_streetwear: ["drop", "event", "testimonial"],
  food_bev: ["drop", "event", "testimonial"],
  other: ["project", "testimonial", "event", "drop"],
};

export const CONSENT_TEXT = "Everyone shown or named here agreed to be featured on our website and social media.";
export const RECEIVED_TEXT = "Received. We'll take it from here.";

export function submitTypesFor(niche) {
  const keys = SUBMIT_BY_NICHE[niche] || SUBMIT_BY_NICHE.other;
  return keys.map((k) => ({ key: k, ...SUBMIT_TYPES[k] }));
}

// Validates a portal submission. Returns { error } or { kind, fields, photos, consent, title }.
export function checkSubmission(niche, input) {
  const kind = String((input && input.kind) || "");
  if (!(SUBMIT_BY_NICHE[niche] || SUBMIT_BY_NICHE.other).includes(kind)) return { error: "Pick what you're sending us" };
  const t = SUBMIT_TYPES[kind];
  const raw = (input && input.fields) || {};
  const fields = {};
  for (const f of t.fields) {
    const v = String(raw[f.key] == null ? "" : raw[f.key]).trim().slice(0, f.type === "textarea" ? 4000 : 200);
    if (f.required && !v) return { error: `Add "${f.label}"` };
    if (v) fields[f.key] = v;
  }
  const photos = (Array.isArray(input && input.photos) ? input.photos : [])
    .map((p) => (typeof p === "string" ? { url: p } : { url: String((p && p.url) || ""), label: String((p && p.label) || "").slice(0, 20) }))
    .filter((p) => /^https:\/\/\S+$/i.test(p.url)).slice(0, 30);
  if (!photos.length) return { error: "Add at least one photo" };
  const consent = (input && input.consent) === true;
  if (t.consent && !consent) return { error: "Please confirm everyone shown agreed to be featured" };
  const title = fields.title || fields.product_name || (fields.customer_name ? `Testimonial from ${fields.customer_name}` : t.label);
  return { kind, fields, photos, consent, title };
}

export const statusLabel = (st) => ({ received: "Received", manual: "We're on it", queued: "We're on it", processing_images: "We're on it", writing: "We're on it", publishing: "Going live", live: "Live", needs_info: "We need a bit more", rejected: "Not used", unpublished: "Taken down", failed: "We're on it", test_passed: "Test" }[st] || "Received");
