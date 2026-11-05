import { base44 } from "@/api/base44Client";
import { studioState } from "@/features/usage/plans";
import { BRAND, SEARCH, VOICE } from "../brand";
import { PLATFORMS } from "./platforms";

// Data layer for the content engine: brands (Interstellar + clients), Voice Guides, ideas, variants, accounts,
// digests, engine settings. Everything here is admin-only by RLS.

export const INTERSTELLAR = "interstellar";
export const KEYS = {
  clients: ["engine", "clients"],
  guides: ["engine", "guides"],
  ideas: (b) => ["engine", "ideas", b],
  variants: (b) => ["engine", "variants", b],
  accounts: ["engine", "accounts"],
  digests: (b) => ["engine", "digests", b],
  settings: ["engine", "settings"],
  status: ["engine", "status"],
};

const arr = (x) => (Array.isArray(x) ? x : []);

export const INTERSTELLAR_COLORS = { primary: "#ff3c00", secondary: "#ff6a00", accent: "#ffaa00", ink: "#1a1a1a", paper: "#ebe8e4" };

/** Interstellar's default Voice Guide, from brand.js (the weekly generator's source). Saved only when edited. */
export function interstellarDefaults() {
  return {
    brand_key: INTERSTELLAR, name: BRAND.company,
    tone: VOICE.tone.join(" "),
    audience: BRAND.audience,
    words_use: ["Command System", "Møthership", "booked jobs", "one login", "show up in AI answers"],
    words_avoid: VOICE.banned_words,
    examples: ["Nine logins and a spreadsheet is not a system.", "Your website might look fine and still be losing calls."],
    registers: Object.fromEntries(PLATFORMS.map((p) => [p.key, p.register])),
    emoji_ok: false,
    hashtags: VOICE.hashtag_bank.slice(0, 8),
    cta_default: "Book a free strategy call",
    website: `https://${BRAND.website}`,
    handle_line: "@interstellarstrategies",
    keywords: SEARCH.keywords,
    colors: INTERSTELLAR_COLORS,
  };
}

export function clientDefaults(client) {
  return {
    brand_key: client.id, client_id: client.id, name: client.business,
    tone: "", audience: "", words_use: [], words_avoid: [], examples: [],
    registers: Object.fromEntries(PLATFORMS.map((p) => [p.key, p.register])),
    emoji_ok: false, hashtags: [], cta_default: "",
    website: client.domain ? `https://${String(client.domain).replace(/^https?:\/\//, "")}` : (client.websites || [])[0] || "",
    handle_line: "", keywords: [], colors: { primary: "#1a1a1a", secondary: "#4b4b4b", accent: "#9a9a9a", ink: "#1a1a1a", paper: "#f4f2ef" },
  };
}

export async function listClients() {
  const rows = arr(await base44.entities.CRMClient.list("-updated_date", 400).catch(() => []));
  return rows.filter((c) => c.status !== "Lead" || studioState(c, "social") === "on").sort((a, b) => String(a.business || "").localeCompare(String(b.business || "")));
}
export const listGuides = () => base44.entities.SocialBrand.list("-updated_date", 400).then(arr).catch(() => []);

/** Resolve a brand: name, guide (saved or default), colors, client, portal studio state. */
export function resolveBrand(key, clients, guides) {
  const saved = arr(guides).find((g) => g.brand_key === key);
  if (key === INTERSTELLAR || !key) {
    const d = interstellarDefaults();
    return { key: INTERSTELLAR, name: BRAND.company, isInterstellar: true, client: null, studio: "on", guide: { ...d, ...(saved || {}), colors: INTERSTELLAR_COLORS }, saved: !!saved };
  }
  const client = arr(clients).find((c) => c.id === key) || null;
  const d = client ? clientDefaults(client) : { ...clientDefaults({ id: key, business: key }) };
  const guide = { ...d, ...(saved || {}), colors: { ...d.colors, ...(saved?.colors || {}) }, registers: { ...d.registers, ...(saved?.registers || {}) } };
  return { key, name: client?.business || saved?.name || "Client", isInterstellar: false, client, studio: client ? studioState(client, "social") : "preview", guide, saved: !!saved };
}

const SYSTEM_FIELDS = ["id", "created_date", "updated_date", "created_by", "created_by_id", "is_sample"];
export async function saveGuide(brandKey, data, user) {
  const rows = arr(await base44.entities.SocialBrand.filter({ brand_key: brandKey }, "-updated_date", 1).catch(() => []));
  const payload = { ...data, brand_key: brandKey, client_id: brandKey === INTERSTELLAR ? "" : brandKey, updated_by: user?.email || "admin" };
  SYSTEM_FIELDS.forEach((k) => delete payload[k]);
  return rows[0] ? base44.entities.SocialBrand.update(rows[0].id, payload) : base44.entities.SocialBrand.create(payload);
}

/** Prefill a client's guide from the approved BrandKit and the Constellations dossier (never invented). */
export async function brandKitPrefill(clientId) {
  const kits = arr(await base44.entities.BrandKit.filter({ client_id: clientId, status: "approved" }, "-version", 1).catch(() => []));
  const dos = arr(await base44.entities.ClientDossier.filter({ client_id: clientId }, "-updated_date", 1).catch(() => []));
  const kit = kits[0]?.kit || {};
  const bi = dos[0]?.brand_identity || {};
  const hexes = [...arr(kit.palette).map((p) => p?.hex), ...arr(bi.colors)].map((h) => String(h || "").trim()).filter((h) => /^#[0-9a-f]{3,8}$/i.test(h));
  const voice = kit.voice || {};
  const out = {};
  if (hexes.length) out.colors = { primary: hexes[0], secondary: hexes[1] || hexes[0], accent: hexes[2] || hexes[1] || hexes[0], ink: "#1a1a1a", paper: "#f7f6f4" };
  const tone = [voice.summary, voice.tone, arr(voice.traits).join(", "), typeof bi.voice === "string" ? bi.voice : ""].filter(Boolean).join(" ");
  if (tone) out.tone = String(tone).slice(0, 800);
  const use = arr(voice.words_to_use || voice.use || voice.do_say);
  const avoid = arr(voice.words_to_avoid || voice.avoid || voice.dont_say);
  if (use.length) out.words_use = use.map(String).slice(0, 20);
  if (avoid.length) out.words_avoid = avoid.map(String).slice(0, 20);
  if (arr(kit.taglines).length) out.examples = arr(kit.taglines).map((t) => (typeof t === "string" ? t : t?.text || "")).filter(Boolean).slice(0, 6);
  return { patch: out, found: { kit: !!kits[0], dossier: !!dos[0], colors: hexes.length } };
}

/* ─── Ideas, variants, accounts, digests ─────────────────────────────── */
export const listIdeas = (b) => base44.entities.SocialIdea.filter({ brand_key: b }, "-created_date", 100).then(arr).catch(() => []);
export const listVariants = (b) => base44.entities.SocialVariant.filter({ brand_key: b }, "-created_date", 500).then(arr).catch(() => []);
export const listAccounts = () => base44.entities.SocialAccount.list("-updated_date", 400).then(arr).catch(() => []);
export const listDigests = (b) => base44.entities.SocialDigest.filter({ brand_key: b }, "-week_start", 12).then(arr).catch(() => []);
export const brandAccounts = (accounts, brandKey) => arr(accounts).filter((a) => (a.client_id || INTERSTELLAR) === brandKey && a.platform && a.enabled !== false);

/* ─── Engine settings (AppSettings social_studio.pageSettings.engine) ─── */
const SKEY = "social_studio";
export const DEFAULT_ENGINE = {
  windows: Object.fromEntries(PLATFORMS.map((p) => [p.key, p.windows])),
  limits: Object.fromEntries(PLATFORMS.map((p) => [p.key, p.limit])),
  spread_minutes: 20,
  weekends: false,
  timezone: "America/Los_Angeles",
};
export async function loadEngineSettings() {
  const rows = arr(await base44.entities.AppSettings.filter({ key: SKEY }, "-created_date", 1).catch(() => []));
  const e = rows[0]?.pageSettings?.engine || {};
  const tz = rows[0]?.pageSettings?.publish?.timezone;
  return { ...DEFAULT_ENGINE, ...e, windows: { ...DEFAULT_ENGINE.windows, ...(e.windows || {}) }, limits: { ...DEFAULT_ENGINE.limits, ...(e.limits || {}) }, timezone: tz || DEFAULT_ENGINE.timezone };
}
export async function saveEngineSettings(patch) {
  // Re-read right before writing so publish settings, folders and channel cadences in the same row are kept.
  const rows = arr(await base44.entities.AppSettings.filter({ key: SKEY }, "-created_date", 1).catch(() => []));
  const row = rows[0];
  const next = { ...(row?.pageSettings?.engine || {}), ...patch };
  if (row) await base44.entities.AppSettings.update(row.id, { pageSettings: { ...(row.pageSettings || {}), engine: next } });
  else await base44.entities.AppSettings.create({ key: SKEY, pageSettings: { engine: next } });
  return next;
}

/* ─── Backend ──────────────────────────────────────────────────────────── */
export async function channels(action, args = {}) {
  try {
    const res = await base44.functions.invoke("social-channels", { action, ...args });
    return res.data;
  } catch (e) {
    throw new Error(e?.response?.data?.error || e?.message || "Request failed");
  }
}

/** AgencyKnowledge "hooks" (Triple Hook Method) + "social_search" + "social_strategist" sections for the prompts. */
export async function loadHooksKnowledge() {
  const one = async (key) => arr(await base44.entities.AgencyKnowledge.filter({ key }, "-updated_date", 1).catch(() => []))[0] || null;
  const [hooks, social_search, social_strategist] = await Promise.all([one("hooks"), one("social_search"), one("social_strategist")]);
  return { hooks, social_search, social_strategist };
}
