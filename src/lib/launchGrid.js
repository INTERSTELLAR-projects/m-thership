// Launch grid (Build Engine, Nov 19 2026). Identical copy in base44/shared/launchGrid.js.
// The per-niche directory list a client should be live on, the tile states, and the read-only NAP check.
// Citation SUBMISSIONS stay OFF: the grid only tracks, checks and prepares a copy-ready checklist. Which paid
// submission service to use (BrightLocal / Whitespark / Yext / manual) is unset on purpose: Justin decides after pricing.

export const STATES = {
  live: { label: "Live, NAP correct", tone: "lit" },
  pending: { label: "Pending", tone: "amber" },
  missing: { label: "Missing", tone: "dim" },
};

const D = (key, name, group, home, opts = {}) => ({ key, name, group, home, check: opts.check || "nap", note: opts.note || "" });

// Every local business.
export const LOCAL_CORE = [
  D("gbp", "Google Business Profile", "maps", "https://business.google.com", { note: "Needs owner verification (postcard, call or video)" }),
  D("apple", "Apple Business Connect", "maps", "https://businessconnect.apple.com"),
  D("bing", "Bing Places", "maps", "https://www.bingplaces.com"),
  D("yelp", "Yelp", "reviews", "https://biz.yelp.com"),
  D("angi", "Angi", "reviews", "https://www.angi.com"),
  D("nextdoor", "Nextdoor", "social", "https://business.nextdoor.com"),
  D("facebook", "Facebook Page", "social", "https://www.facebook.com"),
  D("bbb", "BBB", "reviews", "https://www.bbb.org"),
  D("thumbtack", "Thumbtack", "leads", "https://www.thumbtack.com/pro"),
  D("houzz", "Houzz", "leads", "https://www.houzz.com/pro"),
];

// Niche-specific extras.
export const NICHE_EXTRAS = {
  home_service: [
    D("porch", "Porch", "leads", "https://pro.porch.com"),
    D("homeadvisor", "HomeAdvisor", "leads", "https://pro.homeadvisor.com"),
    D("nextdoor_faves", "Nextdoor Neighborhood Faves", "reviews", "https://business.nextdoor.com", { check: "url" }),
  ],
  fitness_coach: [
    D("mindbody", "Mindbody", "booking", "https://www.mindbodyonline.com"),
    D("classpass", "ClassPass", "booking", "https://classpass.com/partners"),
    D("instagram", "Instagram", "social", "https://www.instagram.com", { check: "url" }),
  ],
  retail_streetwear: [
    D("instagram", "Instagram", "social", "https://www.instagram.com", { check: "url" }),
    D("tiktok", "TikTok", "social", "https://www.tiktok.com", { check: "url" }),
    D("google_merchant", "Google Merchant Center", "shopping", "https://merchants.google.com", { check: "url" }),
  ],
  food_bev: [
    D("tripadvisor", "Tripadvisor", "reviews", "https://www.tripadvisor.com/Owners"),
    D("doordash", "DoorDash", "ordering", "https://merchants.doordash.com"),
    D("ubereats", "Uber Eats", "ordering", "https://merchants.ubereats.com"),
    D("instagram", "Instagram", "social", "https://www.instagram.com", { check: "url" }),
  ],
  other: [],
};

// National / global clients: shopping feeds, review sites, press and topic coverage instead of local maps.
export const NATIONAL = [
  D("google_merchant", "Google Merchant Center (Shopping feed)", "shopping", "https://merchants.google.com", { check: "url" }),
  D("bing_merchant", "Microsoft Merchant Center", "shopping", "https://ads.microsoft.com", { check: "url" }),
  D("meta_shop", "Meta Commerce (Facebook/Instagram Shop)", "shopping", "https://www.facebook.com/commerce_manager", { check: "url" }),
  D("trustpilot", "Trustpilot", "reviews", "https://business.trustpilot.com", { check: "name" }),
  D("sitejabber", "Sitejabber", "reviews", "https://www.sitejabber.com", { check: "name" }),
  D("bbb", "BBB", "reviews", "https://www.bbb.org"),
  D("linkedin", "LinkedIn Company Page", "social", "https://www.linkedin.com/company", { check: "name" }),
  D("crunchbase", "Crunchbase", "press", "https://www.crunchbase.com", { check: "name" }),
  D("press_kit", "Press page / media kit on the site", "press", "", { check: "url" }),
  D("topic_coverage", "Topic coverage: 3+ third-party articles mentioning the brand", "topics", "", { check: "url" }),
];

export function directoriesFor(niche, national) {
  const base = national ? NATIONAL : LOCAL_CORE;
  const extra = NICHE_EXTRAS[niche] || [];
  const seen = new Set();
  return [...base, ...extra].filter((d) => (seen.has(d.key) ? false : seen.add(d.key)));
}

export const digits = (s) => String(s || "").replace(/\D+/g, "");
const words = (s) => String(s || "").toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2 && !["the", "and", "llc", "inc", "co"].includes(w));

// Read-only check of a listing page: does it show the client's name and phone (and street number when we have one)?
export function napMatch(html, nap, check = "nap") {
  const text = String(html || "").toLowerCase().replace(/<[^>]+>/g, " ");
  const textDigits = digits(text);
  const nameWords = words(nap && nap.name);
  const nameOk = nameWords.length ? nameWords.filter((w) => text.includes(w)).length >= Math.ceil(nameWords.length * 0.6) : false;
  const phone = digits(nap && nap.phone).slice(-10);
  const phoneOk = phone.length === 10 ? textDigits.includes(phone) : false;
  const street = (String((nap && nap.address) || "").match(/^\s*(\d{2,6})\b/) || [])[1] || "";
  const streetOk = street ? text.includes(street) : true;
  if (check === "url") return { ok: true, name: nameOk, phone: phoneOk, street: streetOk };
  if (check === "name") return { ok: nameOk, name: nameOk, phone: phoneOk, street: streetOk };
  return { ok: nameOk && phoneOk && streetOk, name: nameOk, phone: phoneOk, street: streetOk };
}

// One checklist for every missing tile, with the NAP ready to copy (no submissions are made).
export function napChecklist(client, nap, missing) {
  const lines = [
    `Launch grid checklist for ${client.business || "the client"}`,
    "",
    "Copy these exactly, the same on every listing:",
    `Name: ${nap.name || "[OWNER: business name]"}`,
    `Address: ${nap.address || "[OWNER: address, or service-area business]"}`,
    `Phone: ${nap.phone || "[OWNER: phone]"}`,
    `Website: ${nap.website || "[OWNER: website]"}`,
    nap.hours ? `Hours: ${nap.hours}` : "Hours: [OWNER: hours]",
    nap.description ? `Description: ${nap.description}` : "",
    "",
    "Missing listings:",
    ...missing.map((d, i) => `${i + 1}. ${d.name}${d.home ? ` (${d.home})` : ""}${d.note ? ` — ${d.note}` : ""}`),
    "",
    "Verification codes (postcard, phone or email) go to the client: ask for them through the portal request.",
  ];
  return lines.filter((l, i, a) => !(l === "" && a[i - 1] === "")).join("\n");
}

export function tileCounts(rows) {
  const out = { live: 0, pending: 0, missing: 0, total: (rows || []).length };
  (rows || []).forEach((r) => { out[r.status in out ? r.status : "missing"]++; });
  return out;
}

export const SUBMISSION_SERVICES = ["brightlocal", "whitespark", "yext", "manual"];
export const SUBMISSION_NOTE = "Unset on purpose: Justin decides after pricing. Citation submissions stay off until then.";
