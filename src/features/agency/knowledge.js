// Agency knowledge: Interstellar's own facts (offers + prices, rules, voice, operations) in ONE place,
// the AgencyKnowledge entity. Generators embed a short excerpt; Settings > Agency knowledge edits it;
// Claude tasks read the compiled markdown from the `agency-knowledge` backend function.
// Prices: every price in the app should come from offerPrice(key, fallback). The cache is filled by
// loadAgencyKnowledge() (called on first import and by every generator), so sync callers fall back to
// the hardcoded value only until the first load finishes.
import { base44 } from "@/api/base44Client";

export const KNOWLEDGE_META_KEY = "agency_knowledge";

let cache = { sections: null, at: 0, promise: null };

const arr = (r) => (Array.isArray(r) ? r : (r && r.items) || []);
export const sortSections = (rows) => [...rows].sort((a, b) => (Number(a.sort) || 100) - (Number(b.sort) || 100) || String(a.title || "").localeCompare(String(b.title || "")));

export async function loadAgencyKnowledge({ force = false } = {}) {
  if (!force && cache.sections && Date.now() - cache.at < 60_000) return cache.sections;
  if (!force && cache.promise) return cache.promise;
  cache.promise = base44.entities.AgencyKnowledge.list("sort", 100)
    .then((r) => {
      cache = { sections: sortSections(arr(r)), at: Date.now(), promise: null };
      return cache.sections;
    })
    .catch(() => {
      cache.promise = null;
      return cache.sections || [];
    });
  return cache.promise;
}

export const cachedSections = () => cache.sections || [];
export function setCachedSections(rows) {
  cache = { sections: sortSections(rows || []), at: Date.now(), promise: null };
}

// Prime the cache once (admin pages only; a portal user simply gets [] and the fallbacks).
loadAgencyKnowledge().catch(() => null);

/* ---------------- offers / prices ---------------- */

export function offersOf(sections = cachedSections()) {
  const s = (sections || []).find((x) => x.key === "offers");
  const list = s && s.data && Array.isArray(s.data.offers) ? s.data.offers : [];
  return list.filter((o) => o && o.key);
}

export const offerByKey = (key, sections) => offersOf(sections).find((o) => o.key === key) || null;

// The one price lookup: AgencyKnowledge first, else the caller's existing value.
export function offerPrice(key, fallback = 0, sections) {
  const o = offerByKey(key, sections);
  const n = o ? Number(o.price) : NaN;
  return Number.isFinite(n) && o.price !== "" && o.price !== null ? n : fallback;
}

export const fmtMoney = (n) => `$${Number(n || 0).toLocaleString("en-US")}`;
export const offerPriceLabel = (o) => (!o ? "" : o.billing === "included" ? "free with every build" : `${fmtMoney(o.price)}${o.billing === "monthly" ? "/mo" : ""}`);

/* ---------------- markdown ---------------- */

export function sectionMarkdown(s) {
  return [`## ${s.title || s.key}`, "", String(s.body || "").trim()].join("\n");
}

export function compileMarkdown(sections = cachedSections(), { stamp = true } = {}) {
  const rows = sortSections(sections || []);
  const latest = rows.reduce((m, s) => (String(s.updated_at || s.updated_date || "") > m ? String(s.updated_at || s.updated_date || "") : m), "");
  return [
    "# Interstellar Strategies — Agency knowledge",
    stamp ? `_Exported from Møthership (Settings > Agency knowledge). ${rows.length} sections${latest ? `, last edited ${latest.slice(0, 10)}` : ""}. The in-app version is the source of truth._` : "",
    "",
    ...rows.map(sectionMarkdown).flatMap((m) => [m, ""]),
  ].filter((l, i) => l !== "" || i > 1).join("\n").trim();
}

// Short excerpt for a generator brief. topics: offers | rules | voice | about | bonuses | operations
const TOPIC_KEYS = {
  about: ["about"],
  offers: ["offers"],
  rules: ["pricing_rules", "delivery_rules"],
  delivery: ["delivery_rules"],
  pricing: ["pricing_rules"],
  voice: ["voice"],
  bonuses: ["bonuses"],
  operations: ["operations"],
};

export function agencyExcerpt(sections, topics = ["offers", "rules"], { maxChars = 3500 } = {}) {
  const rows = sections || cachedSections();
  if (!rows.length) return "";
  const keys = [...new Set(topics.flatMap((t) => TOPIC_KEYS[t] || [t]))];
  const out = keys.map((k) => rows.find((s) => s.key === k)).filter(Boolean).map((s) => {
    if (s.key === "offers" && offersOf(rows).length) {
      return `### ${s.title}\n${offersOf(rows).map((o) => `- ${o.name}: ${offerPriceLabel(o)}${o.architecture ? ` (${o.architecture})` : ""}${o.terms ? ` — ${o.terms}` : ""}`).join("\n")}`;
    }
    return `### ${s.title}\n${String(s.body || "").trim()}`;
  }).join("\n\n");
  return out.length > maxChars ? `${out.slice(0, maxChars - 1)}…` : out;
}

// The block a generator appends: heading + excerpt, or nothing when no knowledge is on file.
export function agencyBlock(sections, topics, opts) {
  const ex = agencyExcerpt(sections, topics, opts);
  return ex ? `\n## Interstellar agency knowledge (from Settings > Agency knowledge — the one source for our offers, prices and rules)\n${ex}\n` : "";
}

/* ---------------- sync meta (AppSettings key agency_knowledge) ---------------- */

export async function readKnowledgeMeta() {
  const rows = arr(await base44.entities.AppSettings.filter({ key: KNOWLEDGE_META_KEY }, "-updated_date", 1).catch(() => []));
  const row = rows[0] || null;
  return { id: row ? row.id : null, data: (row && row.pageSettings) || {} };
}

export async function writeKnowledgeMeta(patch) {
  const cur = await readKnowledgeMeta();
  const pageSettings = { ...(cur.data || {}), ...patch };
  if (cur.id) await base44.entities.AppSettings.update(cur.id, { pageSettings });
  else await base44.entities.AppSettings.create({ key: KNOWLEDGE_META_KEY, pageSettings });
  return pageSettings;
}
