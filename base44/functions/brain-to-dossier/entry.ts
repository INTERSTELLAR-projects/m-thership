// Brain → dossier sync (Møthership > Constellations). Keeps each client's Constellations web fed from what the agency
// actually knows, and gives every agent one shared client context block.
//   sync    { client_id | "agency", extract?: true, force?: false, dry_run?: false }   admin. One client (or Interstellar).
//   all     { extract?: true, force?: false, max_extract?: 20 }                         admin. Starts a fresh pass (chunked).
//   score   { client_id? }                                                              admin. Re-score only (no LLM).
//   nightly {}   workflow "Agents — nightly brain refresh" steps 2-15 (no user). One pass per Pacific day, in chunks
//                (a function call has a hard time limit): mirrors work + brand kits, re-scores and rebuilds the context
//                block for every client; re-maps a Brain into the dossier (LLM) only when a Brain section changed since
//                the last sync (max 4 a night).
//   queued  {}   workflow "Brain → dossier — queued run" (inactive, Run now): the clients an admin queued in AppSettings
//                brain_to_dossier_queue, a chunk per run.
// What one sync does for a client:
//   1. Maps Business Brain facts into ClientDossier fields (dream outcome, offers incl. guarantee/bonuses/kind, USP,
//      differentiators, brand identity + voice, tagline, pitch, story, services, service area + cities, keywords,
//      lead sources, KPIs, competitors, tools) and evidence-backed pillar checks. Facts only: every pillar check needs a
//      verbatim quote from the Brain or it is dropped. A Brain value fills a field only when the field is empty, or when
//      the sync itself wrote it earlier (ClientDossier.brain_sync.fields) and the Brain is newer. Values Justin or
//      another agent set are never overwritten; pillar checks set by Justin are never touched.
//   2. Mirrors done WorkEntry rows into WorkLog with the matching kind (dedupe_key we:<id>, hidden from the portal,
//      skipped by the work-ledger sync so nothing counts twice), and links approved BrandKits (and brand-kit work)
//      as ClientFile category brand_kit (dedupe_key bk:<id> / we:<id>).
//   3. Re-scores with the same code as the web (shared/constellations.js = src/features/constellations/pillars.js)
//      and saves health_score / pillar_scores / scored_at, like persistScore.
//   4. Writes the shared client context block (shared/clientContext.ts) to BusinessBrain.context_md.
// Records only: never sends, publishes, schedules or switches anything on. Never stores credentials.
// deno-lint-ignore-file no-explicit-any
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { callClaude, AnthropicError, HOUSE_RULES } from "../../shared/anthropic.ts";
import { getSecret } from "../../shared/portalClient.ts";
import { estimateAiCost } from "../../shared/usagePlans.ts";
import { weightFor } from "../../shared/fuel.ts";
import { PILLARS, scoreAll } from "../../shared/constellations.js";
import { buildContextBlock, loadContextSources } from "../../shared/clientContext.ts";

const nowIso = () => new Date().toISOString();
const arr = (v: any) => (Array.isArray(v) ? v : (v && v.items) || []);
const s = (v: any) => (v == null ? "" : String(v).trim());
const has = (v: any) => (Array.isArray(v) ? v.length > 0 : !!(v && typeof v === "object" ? Object.keys(v).length : s(v)));
const cut = (v: any, n: number) => { const t = s(v).replace(/\s+/g, " "); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const pacificDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(d);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const SECRET_RE = /(password|passcode|pwd|api[_ -]?key|secret|token)\s*[:=]\s*\S+/gi;
const JUNK = /^\s*(unknown|not specified|not stated|n\/a|none|tbd|null|-)\.?\s*$/i;
// Credentials out, ™ not ®, placeholder words ("unknown", "not specified") become empty.
const scrub = (v: any) => (typeof v === "string" ? (JUNK.test(v) ? "" : v.replace(SECRET_RE, "[removed]").replace(/®/g, "™")) : v);
const norm = (t: any) => s(t).toLowerCase().replace(/[“”"'’‘`*_]/g, "").replace(/[^a-z0-9$#.%/+@ -]+/g, " ").replace(/\s+/g, " ").trim();
const tokens = (t: any) => new Set(norm(t).split(" ").filter((w) => w.length > 2));
// Same thing, named differently? Exact normalized match, or nearly all distinctive words shared (generic words like
// "tree service" or "coaching" alone never make a match).
const GENERIC = new Set(["the", "and", "llc", "inc", "co", "company", "service", "services", "tree", "trees", "coaching", "studio", "studios", "group", "of", "for", "with", "your"]);
function similar(a: any, b: any) {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const A = new Set([...tokens(a)].filter((w) => !GENERIC.has(w))), B = new Set([...tokens(b)].filter((w) => !GENERIC.has(w)));
  if (!A.size || !B.size) return false;
  const inter = [...A].filter((w) => B.has(w)).length;
  return inter / (A.size + B.size - inter) >= 0.8;
}
// A rate-limited read must never pass for "no rows": that made the nightly pass lose its cursor and its client list
// (Nov 6-9, 2026: every step started a fresh one-client pass and re-synced only Interstellar) and could score a
// client on empty data. Other read errors (e.g. an entity that does not exist) still read as empty.
const RL_RE = /rate limit exceeded[\s\S]*?retry after (\d+)\s*s/i;
async function list(ent: any, q: any = {}, sort = "-created_date", limit = 500) {
  try { return arr(await ent.filter(q, sort, limit)); } catch (e) { if (RL_RE.test(String((e as Error)?.message || e))) throw e; return []; }
}

// Reads share one budget with every other backend function (entity_list: 350 per 60s per service token). Space this
// function's reads out (at most ~240 a minute, leaving room for everything else) and wait out a rate limit instead of
// failing. Writes are not paced (they are not on that budget).
const READ_GAP_MS = 250;
let nextReadAt = 0;
const readStats = { reads: 0, waited_ms: 0, rate_limited: 0 };
async function readSlot() {
  readStats.reads++;
  const now = Date.now();
  const at = Math.max(now, nextReadAt);
  nextReadAt = at + READ_GAP_MS;
  if (at > now) { readStats.waited_ms += at - now; await sleep(at - now); }
}
async function pacedRead(fn: () => Promise<any>) {
  for (let attempt = 0; ; attempt++) {
    await readSlot();
    try { return await fn(); } catch (e) {
      const m = RL_RE.exec(String((e as Error)?.message || e));
      const wait = m ? (Number(m[1]) + 1) * 1000 : 0;
      if (!m || attempt >= 2 || wait > 20000) throw e;
      readStats.rate_limited++;
      await sleep(wait);
    }
  }
}
function paced(db: any) {
  return new Proxy(db, {
    get(t: any, name: any) {
      const ent = t[name];
      if (!ent || typeof ent !== "object") return ent;
      return new Proxy(ent, {
        get(e: any, m: any) {
          const f = e[m];
          if (typeof f !== "function") return f;
          if (m === "filter" || m === "list" || m === "get") return (...a: any[]) => pacedRead(() => f.apply(e, a));
          return f.bind(e);
        },
      });
    },
  });
}

// ---------- LLM ----------
async function llm(base44: any, opts: { system: string; prompt: string; schema: any; feature: string; client?: any }) {
  const key = getSecret("ANTHROPIC_API_KEY");
  const db = base44.asServiceRole.entities;
  if (key) {
    try {
      const out = await callClaude({ key, tier: "long", system: opts.system, prompt: opts.prompt, schema: opts.schema, max_tokens: 12000 });
      await db.UsageLedger.create({ client_id: "agency", client_name: "Interstellar (admin)", month: pacificDay().slice(0, 7), kind: "ai_action", units: weightFor(out.model, out.input_tokens, opts.feature), calls: 1, model: out.model, est_cost_usd: estimateAiCost(out.model, out.input_tokens, out.output_tokens), feature: opts.feature, by_admin: true, input_tokens: out.input_tokens, output_tokens: out.output_tokens, created_at: nowIso() }).catch(() => null);
      return out.json;
    } catch (e) {
      if (!(e instanceof AnthropicError)) throw e;
      console.error("brain-to-dossier anthropic", e.status, e.type);
    }
  }
  const out = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt: `${HOUSE_RULES}\n\n${opts.system}\n\n${opts.prompt}`, response_json_schema: opts.schema });
  return typeof out === "string" ? JSON.parse(out) : out;
}

const STR = { type: "string" };
const STRS = { type: "array", items: STR };
const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    dream_outcome: STR, usp: STR, tagline: STR, elevator_pitch: STR, story: STR, founded: STR, team_size: STR,
    differentiators: STRS, lead_sources: STRS, tools: STRS,
    offers: { type: "array", items: { type: "object", properties: { name: STR, kind: { type: "string", enum: ["attraction", "core", "upsell", "downsell", "continuity", ""] }, price: STR, promise: STR, guarantee: STR, bonuses: STR }, required: ["name", "kind", "price", "promise", "guarantee", "bonuses"] } },
    services: { type: "array", items: { type: "object", properties: { name: STR, description: STR }, required: ["name", "description"] } },
    service_area: { type: "object", properties: { model: { type: "string", enum: ["storefront", "service_area", "hybrid", "national", "online", ""] }, primary_city: STR, radius: STR, cities: { type: "array", items: { type: "object", properties: { city: STR, state: STR }, required: ["city", "state"] } } }, required: ["model", "primary_city", "radius", "cities"] },
    brand_identity: { type: "object", properties: { colors: STRS, fonts: STR, style: STR, photo_style: STR }, required: ["colors", "fonts", "style", "photo_style"] },
    brand_voice: { type: "object", properties: { tone: STRS, personality: STR, say: STRS, never_say: STRS, sample: STR }, required: ["tone", "personality", "say", "never_say", "sample"] },
    audience: { type: "object", properties: { ideal_customer: STR, demographics: STR, pains: STRS, desires: STRS, objections: STRS, where_they_hang_out: STRS }, required: ["ideal_customer", "demographics", "pains", "desires", "objections", "where_they_hang_out"] },
    competitors: { type: "array", items: { type: "object", properties: { name: STR, url: STR, strength: STR, weakness: STR }, required: ["name", "url", "strength", "weakness"] } },
    keywords: { type: "array", items: { type: "object", properties: { term: STR, city: STR, intent: STR }, required: ["term", "city", "intent"] } },
    kpis: { type: "array", items: { type: "object", properties: { key: STR, value: STR, source: STR }, required: ["key", "value", "source"] } },
    checks: { type: "array", items: { type: "object", properties: { pillar: STR, item: STR, status: { type: "string", enum: ["done", "partial", "missing", "na"] }, evidence: STR, section: STR }, required: ["pillar", "item", "status", "evidence", "section"] } },
  },
  required: ["dream_outcome", "usp", "tagline", "elevator_pitch", "story", "founded", "team_size", "differentiators", "lead_sources", "tools", "offers", "services", "service_area", "brand_identity", "brand_voice", "audience", "competitors", "keywords", "kpis", "checks"],
};

const SKIP_SECTIONS = new Set(["website_logins", "billing"]); // not business facts for the web, and never credentials
function brainText(brain: any) {
  const secs = brain?.sections || {};
  const parts: string[] = [];
  for (const [k, v] of Object.entries(secs) as any) {
    if (SKIP_SECTIONS.has(k) || !v) continue;
    const t = s(v.text);
    if (t && !/^unknown\.?$/i.test(t)) parts.push(`## ${k} [by ${v.updated_by || "?"} · ${String(v.updated_at || "").slice(0, 10) || "?"} · confidence ${v.confidence || "?"}]\n${t.slice(0, 7000)}`);
    if (k === "brand" && v.design_md) parts.push(`## brand.design_md\n${s(typeof v.design_md === "object" ? v.design_md.text : v.design_md).slice(0, 3000)}`);
  }
  return scrub(parts.join("\n\n"));
}

const EXTRACT_SYSTEM = [
  "You map a client's Business Brain (Interstellar Strategies' knowledge base for that business) into structured dossier fields for the Constellations health web.",
  "RULES:",
  "- WHOSE FACTS: the dossier describes the CLIENT'S OWN business and ITS customers. Interstellar Strategies is the agency that serves the client: never map Interstellar's services, packages, plans or prices (websites, apps, Command System, Mission ALPHA/BRAVO, HyperCare+, GravïtyCare, Ørbit SEO, retainers) as the client's offers, services, dream outcome, USP, KPIs or goals. offers/services = what the client sells to its customers. dream_outcome = what the client's CUSTOMERS want from the client.",
  "- Use ONLY facts written in the BRAIN text. Never invent, infer, estimate or improve. If a fact is not stated, return an empty string or empty array for it.",
  "- Copy wording closely; light trimming is fine. Prices only exactly as written (or empty). Never write a price the Brain does not state.",
  "- guarantee / bonuses: only when the Brain states a guarantee, warranty, risk reversal, or bonus/value-stack item for that offer. Otherwise empty.",
  "- offers[].kind: attraction (free/low-cost entry offer), core, upsell, downsell, continuity (recurring / membership / maintenance plan). Empty if unclear.",
  "- kpis: only real, measured numbers the Brain states about the client's business as it is today (leads/month, close rate, average ticket, actual revenue, review count, rating, daily volume...), each with its source as written. Never targets, needs, budgets, costs, goals, phone numbers or IDs.",
  "- keywords: only search terms the Brain explicitly names as keywords or searches to rank for.",
  "- brand_voice.sample: a verbatim passage from the Brain that is written in the client's own voice (e.g. quoted site copy). Empty if none. Never write a new one.",
  "- Never output passwords, API keys, tokens or login details.",
  "- checks: for each PILLAR CHECK listed in the request, return a status ONLY when the Brain clearly shows it: done, partial, missing, or na (does not apply to this business, e.g. map pack for an online-only brand). evidence MUST be a short verbatim quote (8-25 words) copied exactly from the Brain text; section = the Brain section key it came from. If the Brain does not clearly show it, leave that check out. Do not guess.",
].join("\n");

// ---------- pillar helpers ----------
function autoStatus(item: any, ctx: any) { try { return item.a ? item.a(ctx) : null; } catch { return null; } }
function assessable(dossier: any, ctx: any) {
  const out: any[] = [];
  for (const p of PILLARS) for (const it of p.items) {
    const saved = dossier?.pillars?.[p.id]?.items?.[it.id];
    if (saved?.status && !["claude", "brain"].includes(String(saved.by || ""))) continue; // Justin's (or manual) checks are final
    if (autoStatus(it, ctx)) continue; // real data already decides it
    out.push({ pillar: p.id, item: it.id, label: it.label, saved: saved?.status ? `${saved.status} by ${saved.by} ${String(saved.updated_at || "").slice(0, 10)}${saved.note ? ` (${cut(saved.note, 100)})` : ""}` : "" });
  }
  return out;
}

// Interstellar's own products are never the client's offers or services, whatever the model returns.
const AGENCY_PRODUCT = /hyper\s*care|gravit[yï]\s*care|[øo]rbit\s*seo|mission\s*(alpha|bravo)|command\s*system|interstellar|manage\+|starship\s*care|brand\s*arsenal/i;
const KIND_OK = new Set(["attraction", "core", "upsell", "downsell", "continuity"]);
const MODEL_OK = new Set(["storefront", "service_area", "hybrid", "national", "online"]);
// Our build platform's name never goes into client-facing data (brand rule).
const cleanStrs = (v: any, n = 200) => Array.from(new Set(arr(v).map((x: any) => cut(scrub(x), n)).filter((x: string) => x && !/^base44\b/i.test(x))));

// ---------- merge Brain extraction into the dossier ----------
function mergeExtraction(d: any, x: any, brain: any, brainAt: string, brainNorm: string, force = false, agency = false) {
  // For Interstellar itself its own products ARE its offers; for a client they never are.
  const notAgencyProduct = (t: string) => agency || !AGENCY_PRODUCT.test(t);
  const at = nowIso();
  const bs = { ...(d.brain_sync || {}), fields: { ...((d.brain_sync || {}).fields || {}) } };
  const owned = (f: string) => !!bs.fields[f];
  const newer = (f: string) => force || !bs.fields[f]?.brain_at || String(brainAt) > String(bs.fields[f].brain_at);
  const patch: any = {};
  const filled: string[] = [];
  const mark = (f: string, section = "") => { bs.fields[f] = { at, brain_at: brainAt, section }; filled.push(f); };
  // A forced re-map that no longer finds a value clears what the sync itself wrote earlier (never anyone else's value).
  const unmap = (f: string, empty: any) => { if (force && owned(f)) { patch[f] = empty; delete bs.fields[f]; filled.push(`${f} (cleared)`); } };

  for (const f of ["dream_outcome", "usp", "tagline", "elevator_pitch", "story", "founded", "team_size"]) {
    let v = cut(scrub(x?.[f]), f === "story" ? 1500 : 600);
    // A record timestamp is not a founding date.
    if (f === "founded" && /^\d{4}-\d{2}-\d{2}/.test(v)) v = "";
    // The dream outcome is the customer's, and models confuse it with the owner's goals: only take it when the Brain
    // names one explicitly.
    if (f === "dream_outcome" && !/dream outcome/.test(brainNorm)) v = "";
    if (!v) { unmap(f, ""); continue; }
    if (!has(d[f]) || (owned(f) && newer(f) && v !== d[f])) { patch[f] = v; mark(f); }
  }
  for (const f of ["differentiators", "lead_sources", "tools"]) {
    const v = cleanStrs(x?.[f]);
    if (!v.length) { unmap(f, []); continue; }
    if (!has(d[f]) || (owned(f) && newer(f) && JSON.stringify(v) !== JSON.stringify(d[f]))) { patch[f] = v; mark(f); }
  }
  // offers
  const xo = arr(x?.offers).filter((o: any) => s(o?.name) && notAgencyProduct(`${o.name} ${o.promise || ""}`)).map((o: any) => ({ name: cut(scrub(o.name), 160), kind: KIND_OK.has(o.kind) ? o.kind : "", price: cut(scrub(o.price), 120), promise: cut(scrub(o.promise), 300), guarantee: cut(scrub(o.guarantee), 300), bonuses: cut(scrub(o.bonuses), 300) }));
  if (!xo.length) unmap("offers", []);
  if (xo.length) {
    if (!has(d.offers) || (owned("offers") && newer("offers"))) { patch.offers = xo; mark("offers", "offer_pricing"); }
    else {
      let changed = false;
      const next = arr(d.offers).map((o: any) => {
        const m = xo.find((y: any) => similar(y.name, o.name));
        if (!m) return o;
        const out = { ...o };
        for (const k of ["guarantee", "bonuses", "kind", "promise", "price"]) if (!has(o[k]) && has(m[k])) { out[k] = m[k]; changed = true; }
        return out;
      });
      if (changed) { patch.offers = next; filled.push("offers (empty sub-fields)"); bs.fields["offers.subfields"] = { at, brain_at: brainAt, section: "offer_pricing" }; }
    }
  }
  // services
  // Service names only: a description is kept only when it is verbatim Brain text.
  const xs = arr(x?.services).filter((v: any) => s(v?.name) && notAgencyProduct(v.name)).map((v: any) => ({ name: cut(scrub(v.name), 120), description: s(v.description) && brainNorm.includes(norm(v.description)) ? cut(scrub(v.description), 300) : "" }));
  if (xs.length) {
    if (!has(d.services) || (owned("services") && newer("services"))) {
      // keep any page_url / priority already known for the same service
      patch.services = xs.map((v: any) => { const old = arr(d.services).find((o: any) => similar(o?.name, v.name)); return { ...v, page_url: old?.page_url || "", priority: old?.priority || "" }; });
      mark("services", "offer_pricing");
    } else {
      let changed = false;
      const next = arr(d.services).map((o: any) => { const m = xs.find((y: any) => similar(y.name, o?.name)); if (m && !has(o?.description) && has(m.description)) { changed = true; return { ...o, description: m.description }; } return o; });
      if (changed) { patch.services = next; filled.push("services (descriptions)"); }
    }
  }
  // service area
  const xa = x?.service_area || {};
  const sa = { ...(d.service_area || {}) };
  let saChanged = false;
  if (MODEL_OK.has(xa.model) && !has(sa.model)) { sa.model = xa.model; saChanged = true; }
  for (const k of ["primary_city", "radius"]) if (has(xa[k]) && !/^0+$/.test(s(xa[k])) && !has(sa[k])) { sa[k] = cut(scrub(xa[k]), 200); saChanged = true; }
  const xc = arr(xa.cities).filter((c: any) => s(c?.city)).map((c: any) => ({ city: cut(c.city, 80), state: cut(c.state, 30) }));
  if (xc.length && (!has(sa.cities) || (owned("service_area.cities") && newer("service_area.cities")))) {
    sa.cities = xc.map((c: any) => { const old = arr(d.service_area?.cities).find((o: any) => norm(o?.city) === norm(c.city)); return old || { ...c, status: "targeting", page_url: "", priority: "", notes: "From the Business Brain" }; });
    saChanged = true; bs.fields["service_area.cities"] = { at, brain_at: brainAt, section: "overview" }; filled.push("service_area.cities");
  }
  if (saChanged) { patch.service_area = sa; if (!filled.includes("service_area.cities")) filled.push("service_area"); }
  // brand identity / voice / audience: per sub-field, fill only when empty
  const sub = (field: string, keys: string[], listKeys: string[]) => {
    const cur = { ...(d[field] || {}) };
    const src = x?.[field] || {};
    let changed = false;
    for (const k of keys) { const v = cut(scrub(src[k]), k === "sample" ? 1200 : 500); if (v && (!has(cur[k]) || (owned(`${field}.${k}`) && newer(`${field}.${k}`) && v !== cur[k]))) { cur[k] = v; changed = true; bs.fields[`${field}.${k}`] = { at, brain_at: brainAt }; } }
    for (const k of listKeys) { const v = cleanStrs(src[k], 160); if (v.length && (!has(cur[k]) || (owned(`${field}.${k}`) && newer(`${field}.${k}`)))) { cur[k] = v; changed = true; bs.fields[`${field}.${k}`] = { at, brain_at: brainAt }; } }
    if (changed) { patch[field] = cur; filled.push(field); }
  };
  // a voice sample must be verbatim Brain text
  if (x?.brand_voice?.sample && !brainNorm.includes(norm(x.brand_voice.sample).slice(0, 60))) x.brand_voice.sample = "";
  sub("brand_identity", ["fonts", "style", "photo_style"], ["colors"]);
  sub("brand_voice", ["personality", "sample"], ["tone", "say", "never_say"]);
  sub("audience", ["ideal_customer", "demographics"], ["pains", "desires", "objections", "where_they_hang_out"]);
  // competitors
  const urlInBrain = (u: any) => { const t = norm(String(u || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "")); return t.length > 4 && t.includes(".") && brainNorm.includes(t) ? cut(u, 300) : ""; };
  const xcomp = arr(x?.competitors).filter((c: any) => s(c?.name)).map((c: any) => ({ name: cut(scrub(c.name), 120), url: urlInBrain(c.url), strength: cut(scrub(c.strength), 300), weakness: cut(scrub(c.weakness), 300) }));
  if (xcomp.length) {
    if (!has(d.competitors) || (owned("competitors") && newer("competitors"))) { patch.competitors = xcomp; mark("competitors", "competitors"); }
    else {
      let changed = false;
      const next = arr(d.competitors).map((o: any) => { const m = xcomp.find((y: any) => similar(y.name, o?.name)); if (!m) return o; const out = { ...o }; for (const k of ["url", "strength", "weakness"]) if (!has(o[k]) && has(m[k])) { out[k] = m[k]; changed = true; } return out; });
      if (changed) { patch.competitors = next; filled.push("competitors (empty sub-fields)"); }
    }
  }
  // keywords: the Keyword steward owns them; the Brain only seeds an empty list
  const xk = arr(x?.keywords).filter((k: any) => s(k?.term));
  if (xk.length && !has(d.keywords)) {
    patch.keywords = xk.slice(0, 40).map((k: any) => ({ term: cut(k.term, 120), city: cut(k.city, 60), intent: cut(k.intent, 30), priority: "secondary", status: "target", page_url: "", rank: null, added_at: pacificDay(), notes: "Seeded from the Business Brain; the Keyword steward maps pages and priorities" }));
    patch.keywords_updated_at = at; mark("keywords", "content");
  }
  // KPIs: add keys that aren't there yet
  const kp = { ...(d.kpis || {}) };
  let kpChanged = false;
  if (force) for (const k of Object.keys(bs.fields)) if (k.startsWith("kpis.")) { delete kp[k.slice(5)]; delete bs.fields[k]; kpChanged = true; }
  for (const k of arr(x?.kpis)) {
    const key = norm(k?.key).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
    if (!key || /phone|password|token|secret|login|id$|required|target|goal|need|budget|cost|workflow|sync|plan/.test(key) || has(kp[key]) || !s(k?.value)) continue;
    const nv = norm(k.value);
    if (Object.values(kp).some((v: any) => norm(v).includes(nv))) continue; // same number already on file under another name
    kp[key] = cut(`${scrub(k.value)}${k.source ? ` (source: ${scrub(k.source)})` : " (source: Business Brain)"}`, 300); kpChanged = true;
    bs.fields[`kpis.${key}`] = { at, brain_at: brainAt };
  }
  if (kpChanged) { patch.kpis = kp; filled.push("kpis"); }
  patch.brain_sync = { ...bs, at, brain_at: brainAt };
  return { patch, filled };
}

// The evidence (or at least an unbroken run of 7 of its words) must appear word for word in the Brain.
function quoted(ev: string, brainNorm: string) {
  const w = ev.split(" ").filter(Boolean);
  if (w.length <= 7) return brainNorm.includes(w.join(" "));
  for (let i = 0; i + 7 <= w.length; i++) if (brainNorm.includes(w.slice(i, i + 7).join(" "))) return true;
  return false;
}

function mergeChecks(d: any, checks: any[], allowed: any[], brain: any, brainNorm: string) {
  const pillars = structuredClone(d.pillars || {});
  const set: string[] = [];
  const dropped: string[] = [];
  const ok = new Set(allowed.map((a) => `${a.pillar}.${a.item}`));
  for (const c of arr(checks)) {
    c.item = String(c.item || "").split(".").pop(); // models sometimes answer "pillar.item" in the item field
    const k = `${c.pillar}.${c.item}`;
    if (!ok.has(k) || !["done", "partial", "missing", "na"].includes(c.status)) { dropped.push(`${k}: not assessable`); continue; }
    const ev = norm(c.evidence);
    if (ev.length < 12 || !quoted(ev, brainNorm)) { dropped.push(`${k}: evidence not verbatim ("${cut(c.evidence, 90)}")`); continue; } // evidence must be real Brain text
    const secAt = String(brain?.sections?.[c.section]?.updated_at || "");
    const cur = pillars?.[c.pillar]?.items?.[c.item];
    // A check Claude saved by hand wins unless the Brain section behind this evidence is newer (by day).
    if (cur?.status && cur.by === "claude" && (!secAt || String(cur.updated_at || "").slice(0, 10) >= secAt.slice(0, 10))) { dropped.push(`${k}: Claude's check is as new`); continue; }
    if (cur?.status === c.status && cur?.by === "brain") continue;
    if (cur?.status === c.status && cur?.by === "claude") { dropped.push(`${k}: same as Claude's`); continue; }
    pillars[c.pillar] = pillars[c.pillar] || { items: {} };
    pillars[c.pillar].items = pillars[c.pillar].items || {};
    pillars[c.pillar].items[c.item] = { status: c.status, evidence: cut(c.evidence, 300), note: `From the Business Brain (${c.section || "brain"})${cur?.status ? `; was ${cur.status} by ${cur.by}` : ""}`, by: "brain", updated_at: nowIso() };
    set.push(`${k}=${c.status}`);
  }
  return { pillars, set, dropped };
}

// ---------- work + files ----------
const PAC = (iso: any) => (iso ? pacificDay(new Date(iso)) : null);
function kindFor(e: any): string | null {
  const t = String(e.task_type || ""), title = `${e.title || ""} ${e.notes || ""}`.toLowerCase();
  if (t === "blog_post") return "blog";
  if (t === "gbp_post") return "gbp_post";
  if (t === "citation") return "citation";
  if (t === "report") return "report";
  if (t === "automation_setup") return "automation_setup";
  if (t === "seo_setup") return /schema|json-?ld|structured data/.test(title) ? "schema" : /search console|\bgsc\b/.test(title) ? "search_console" : /\bbing\b/.test(title) ? "bing" : /analytics|ga4/.test(title) ? "analytics" : null;
  if (t === "site_page") return /project/.test(title) ? "project_page" : "new_page";
  if (["site_fix", "site_feature", "copy_edit"].includes(t)) return /schema|json-?ld|structured data/.test(title) ? "schema" : "site_edit";
  if (t === "brand_asset") return /deck|slides|presentation/.test(title) ? "presentation" : "design";
  return null;
}

async function mirrorWork(db: any, clientId: string, clientName: string, dry: boolean) {
  const [entries, logs] = await Promise.all([
    list(db.WorkEntry, { client_id: clientId, status: "done" }, "-completed_at", 500),
    list(db.WorkLog, { client_id: clientId }, "-date", 1000),
  ]);
  const keys = new Set(logs.map((w: any) => w.dedupe_key).filter(Boolean));
  const creates: any[] = [];
  for (const e of entries) {
    if (e.source_type === "work_log") continue; // came from WorkLog already
    const kind = kindFor(e);
    if (!kind) continue;
    const key = `we:${e.id}`;
    if (keys.has(key)) continue;
    if (logs.some((w: any) => w.kind === kind && norm(w.title) === norm(e.title))) continue; // already logged by hand
    const isBlog = ["blog", "gbp_post", "project_page", "new_page"].includes(kind);
    creates.push({
      client_id: clientId, client_name: clientName, kind, title: cut(e.title, 300), description: cut(`${e.notes ? `${e.notes} · ` : ""}Mirrored from the work ledger (WorkEntry ${e.id}).`, 1500),
      url: s(e.link), date: PAC(e.completed_at || e.created_date), status: isBlog && !s(e.link) ? "generated" : "live",
      source: e.done_by === "claude_session" ? "claude" : ["scheduled_task", "agent"].includes(e.done_by) ? "automation" : "manual",
      verified_live: false, portal_visible: false, dedupe_key: key,
    });
  }
  if (!dry && creates.length) await db.WorkLog.bulkCreate(creates);
  return creates.map((c) => `${c.kind}: ${cut(c.title, 80)}`);
}

// Link to the kit itself (deck / doc / page), never to a single logo image inside it.
const firstUrl = (o: any): string => { const m = JSON.stringify(o || {}).match(/https:\/\/[^"\s\\]+/g) || []; return m.find((u) => !/base44/i.test(u) && !/\.(png|jpe?g|svg|webp|gif)(\?|$)/i.test(u)) || ""; };
async function linkBrandKits(db: any, clientId: string, dry: boolean) {
  const [kits, files, entries] = await Promise.all([
    list(db.BrandKit, { client_id: clientId, status: "approved" }, "-version", 20),
    list(db.ClientFile, { client_id: clientId }, "-created_date", 500),
    list(db.WorkEntry, { client_id: clientId, task_type: "brand_kit", status: "done" }, "-completed_at", 50),
  ]);
  const keys = new Set(files.map((f: any) => f.dedupe_key).filter(Boolean));
  const creates: any[] = [];
  for (const k of kits) {
    const key = `bk:${k.id}`;
    if (keys.has(key)) continue;
    creates.push({ client_id: clientId, title: `Brand kit v${k.version || 1} (approved)`, category: "brand_kit", description: cut(k.summary, 1000), link_url: firstUrl(k.kit), delivered_on: PAC(k.approved_at || k.created_date), portal_visible: k.portal_visible === true, dedupe_key: key });
  }
  if (!kits.length) for (const e of entries) {
    const key = `we:${e.id}`;
    if (keys.has(key)) continue;
    creates.push({ client_id: clientId, title: cut(e.client_title || e.title, 200), category: "brand_kit", description: cut(`${e.client_summary || e.notes || ""} (from the work ledger)`, 1000), link_url: s(e.link), delivered_on: PAC(e.completed_at), portal_visible: false, dedupe_key: key });
  }
  if (!dry && creates.length) await db.ClientFile.bulkCreate(creates);
  return creates.map((c) => c.title);
}

// ---------- scoring (same code as the web page) ----------
async function scoreCtx(db: any, client: any, d: any, clientId: string) {
  const [gaps, work, files, goals, autos, forms, reviews] = await Promise.all([
    list(db.ClientGap, { client_id: clientId }, "-created_date", 500),
    list(db.WorkLog, { client_id: clientId }, "-date", 500),
    list(db.ClientFile, { client_id: clientId }, "-created_date", 500),
    list(db.ClientGoal, { client_id: clientId }, "-created_date", 500),
    list(db.Automation, { client_id: clientId }, "-created_date", 500),
    list(db.RequestForm, { client_id: clientId }, "-created_date", 500),
    clientId === "agency" ? Promise.resolve([]) : list(db.ReviewClient, { crm_client_id: clientId }, "-updated_date", 1),
  ]);
  const cache = reviews[0]?.cache;
  return { client: client || {}, d: d || { client_id: clientId }, gaps, work, files, goals: goals.filter((g: any) => !g.year || g.year >= 2027), autos, forms, reviews: cache ? { rating: cache.rating ?? null, count: cache.total ?? 0 } : null };
}
// Why a dot is still unchecked (for Justin's report).
const OFF_BY_DESIGN: Record<string, string> = {
  gbp_posts: "GBP posting is off until the Google Business Profile API is approved",
  blog: "blog engine on the global engines hold", email_marketing: "email engine on the engines hold", social: "social engine on the engines hold",
  reactivation: "reactivation runs through engines (on hold)", monthly_report: "monthly report task waits for the engines hold to lift",
};
const NEEDS_CLIENT: Set<string> = new Set(["goals_2027", "kpis", "meeting_cadence", "value_pricing", "urgency", "guarantee", "bonuses", "dream_outcome", "core_offer", "usp", "story", "photos", "email_domain", "gbp", "categories", "gbp_photos", "speed", "esign", "payments", "email_list", "referrals", "responses", "money_model", "sources", "core_four", "tagline", "voice", "software_costs", "client_portal", "booking", "cta"]);
function scoreReport(ctx: any) {
  const r = scoreAll(ctx);
  const pillar_scores = Object.fromEntries(Object.entries(r.by).map(([k, v]: any) => [k, v.score]));
  const unchecked: any[] = [];
  for (const p of PILLARS) for (const it of r.by[p.id].items) if (it.source === "unset") unchecked.push({ pillar: p.id, item: it.id, label: it.label, why: OFF_BY_DESIGN[it.id] ? "off_by_design" : NEEDS_CLIENT.has(it.id) ? "needs_client" : "missing_work", note: OFF_BY_DESIGN[it.id] || "" });
  return { health: r.health, pillar_scores, constraint: r.constraint?.id || null, unchecked };
}

const LIVE_WINS = new Set(["review_count", "rating"]);
const BUDGET_MS = 6000; // stop starting new clients after this; one client takes ~3s (no Brain change) to ~30s (Brain re-map)

// ---------- one client ----------
async function syncOne(base44: any, db: any, clientId: string, opts: { extract: boolean; force: boolean; dry: boolean }) {
  const agency = clientId === "agency";
  const client = agency ? { id: "agency", business: "Interstellar Strategies", domain: "interstellar-strategies.com", emails: ["justin@interstellar-strategies.com"] } : await db.CRMClient.get(clientId).catch(() => null);
  if (!client) return { client_id: clientId, error: "client not found" };
  const brain = agency ? (await list(db.BusinessBrain, { scope: "interstellar" }, "-updated_date", 1))[0] : (await list(db.BusinessBrain, { client_id: clientId }, "-updated_date", 1))[0];
  let dossierRec = agency ? null : (await list(db.ClientDossier, { client_id: clientId }, "-updated_date", 1))[0] || null;
  let d: any = agency ? { ...(brain?.dossier || {}), client_id: "agency" } : dossierRec ? { ...dossierRec } : { client_id: clientId, client_name: client.business };
  const t0 = Date.now(), r0 = { ...readStats };
  const out: any = { client_id: clientId, client: client.business, stored_before: agency ? brain?.constellation?.health_score ?? null : dossierRec?.health_score ?? null };

  const ctx0 = await scoreCtx(db, client, d, clientId);
  const before = scoreReport(ctx0);
  out.before = before.health;

  // 1. Brain → dossier
  const brainAt = brain ? Object.values(brain.sections || {}).map((v: any) => String(v?.updated_at || "")).sort().pop() || "" : "";
  out.brain_at = brainAt;
  const patch: any = {};
  if (brain && opts.extract && (opts.force || !brain.dossier_synced_at || brainAt > String(brain.dossier_synced_at))) {
    const text = brainText(brain);
    const bn = norm(text);
    // Interstellar's Brain describes the playbooks it makes for clients, not its own: that dot needs its own file.
    const allowed = assessable(d, ctx0).filter((a) => !(agency && a.item === "playbook"));
    const prompt = [
      `CLIENT: ${client.business}${agency ? " (this is Interstellar Strategies itself, the agency: here its own packages and plans ARE its offers, and its clients are its customers)" : ""}`,
      "", "PILLAR CHECKS you may answer (pillar.item: label [current saved status, if any]):",
      ...allowed.map((a) => `- ${a.pillar}.${a.item}: ${a.label}${a.saved ? ` [${a.saved}]` : ""}`),
      "", "BRAIN", text,
    ].join("\n");
    const x: any = await llm(base44, { system: EXTRACT_SYSTEM, prompt, schema: EXTRACT_SCHEMA, feature: "agents.brain_to_dossier" });
    const m = mergeExtraction(d, x || {}, brain, brainAt, bn, opts.force, agency);
    // Only dots the merged dossier still can't decide by itself (e.g. dream_outcome is auto-checked once it is filled).
    const ctxMerged = { ...ctx0, d: { ...d, ...m.patch } };
    const stillOpen = allowed.filter((a) => { const it = PILLARS.find((p) => p.id === a.pillar)?.items.find((i: any) => i.id === a.item); return it && !autoStatus(it, ctxMerged); });
    const c = mergeChecks({ ...d, ...m.patch }, x?.checks || [], stillOpen, brain, bn);
    Object.assign(patch, m.patch);
    if (c.set.length) patch.pillars = c.pillars;
    out.filled = m.filled;
    out.checks_set = c.set;
    out.checks_dropped = c.dropped;
    out.checks_asked = allowed.length;
    d = { ...d, ...patch };
  } else out.extract = brain ? "skipped (Brain unchanged since last sync)" : "no brain";

  // 1b. Review dots Claude (or this sync) saved by hand from old site claims: the live Google reviews feed is measured
  //     data, so it wins when it disagrees. Justin's own checks are never touched.
  {
    const ctxNow = { ...ctx0, d }; // same rows as ctx0; only the dossier changed
    const pillars = structuredClone(d.pillars || {});
    const cleared: string[] = [];
    for (const p of PILLARS) for (const it of p.items) {
      const sv = pillars?.[p.id]?.items?.[it.id];
      if (!sv?.status || !["claude", "brain"].includes(String(sv.by || ""))) continue;
      // This sync's own checks always yield to real data; Claude's only on the measured review dots.
      if (sv.by === "claude" && !LIVE_WINS.has(it.id)) continue;
      const live = autoStatus(it, ctxNow);
      if (live && (sv.by === "brain" || live !== sv.status)) { delete pillars[p.id].items[it.id]; cleared.push(`${p.id}.${it.id}: ${sv.status} (${sv.by}) → live ${live}`); }
    }
    if (cleared.length) { patch.pillars = pillars; d = { ...d, pillars }; out.live_wins = cleared; }
  }

  // 2. work + brand kits (clients only; Interstellar's web reads the agency rows already logged)
  if (!agency) {
    out.worklog_added = await mirrorWork(db, clientId, client.business, opts.dry);
    out.files_added = await linkBrandKits(db, clientId, opts.dry);
  }

  // 3. score
  // Re-read only when steps 2 added rows; otherwise ctx0's rows are still current (saves ~7 reads a client).
  const ctx1 = (out.worklog_added?.length || out.files_added?.length) ? await scoreCtx(db, client, d, clientId) : { ...ctx0, d };
  const after = scoreReport(ctx1);
  out.after = after.health;
  out.pillar_scores = after.pillar_scores;
  out.constraint = after.constraint;
  out.unchecked = after.unchecked;
  const scored = { health_score: after.health, pillar_scores: after.pillar_scores, scored_at: nowIso() };

  // 4. context block
  const src = await loadContextSources(db, clientId);
  const block = buildContextBlock({ ...src, dossier: d });
  out.context_chars = block.length;
  out.timing = { ms: Date.now() - t0, reads: readStats.reads - r0.reads, read_wait_ms: readStats.waited_ms - r0.waited_ms, rate_limited: readStats.rate_limited - r0.rate_limited };
  if (opts.dry) { out.dry_run = true; out.patch_fields = Object.keys(patch); return out; }

  if (agency) {
    if (brain) await db.BusinessBrain.update(brain.id, { dossier: { ...d, ...scored }, constellation: { ...scored, constraint: after.constraint, unchecked: after.unchecked }, context_md: block, context_at: nowIso(), ...(patch.brain_sync ? { dossier_synced_at: brainAt } : {}) });
  } else {
    const full = { ...patch, ...scored };
    if (dossierRec) await db.ClientDossier.update(dossierRec.id, full);
    else dossierRec = await db.ClientDossier.create({ client_id: clientId, client_name: client.business, ...full });
    if (brain) await db.BusinessBrain.update(brain.id, { context_md: block, context_at: nowIso(), ...(patch.brain_sync ? { dossier_synced_at: brainAt } : {}) });
  }
  return out;
}

async function targets(db: any) {
  const clients = arr(await db.CRMClient.filter({ status: "Active" }, "business", 200)); // strict: a failed read throws
  return clients.filter((c: any) => c.plan_status !== "inactive").map((c: any) => c.id);
}

// Would this client's sync re-map its Brain (an LLM call of up to ~30s)?
async function needsRemap(db: any, id: string) {
  const b = (await list(db.BusinessBrain, id === "agency" ? { scope: "interstellar" } : { client_id: id }, "-updated_date", 1))[0];
  if (!b) return false;
  const at = Object.values(b.sections || {}).map((v: any) => String(v?.updated_at || "")).sort().pop() || "";
  return !b.dossier_synced_at || at > String(b.dossier_synced_at);
}
const CHUNK_BUDGET_MS = 20000; // nightly: start clients for up to 20s a call (paced reads make one client ~6-8s)

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "sync");
    const db = paced(base44.asServiceRole.entities);
    if (!user) { if (action !== "nightly" && action !== "queued") return Response.json({ error: "Unauthorized" }, { status: 401 }); }
    else if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });
    const dry = body?.dry_run === true;

    if (action === "sync") {
      const id = String(body?.client_id || "");
      if (!id) return Response.json({ error: "client_id required (a CRMClient id or \"agency\")" }, { status: 400 });
      return Response.json(await syncOne(base44, db, id, { extract: body?.extract !== false, force: body?.force === true, dry }));
    }
    // A function call has a hard time limit, so batch work runs in chunks: each call starts clients only while it is
    // inside BUDGET_MS and leaves the rest for the next call (the nightly workflow calls this step several times).
    const t0 = Date.now();
    const inBudget = () => Date.now() - t0 < BUDGET_MS;

    // Workflow "Brain → dossier — queued run" (no user, kept inactive; Run now): runs only what an admin queued in
    // AppSettings brain_to_dossier_queue { client_ids[], extract?, force?, requested_at, status: "queued" } within the
    // last hour. Unfinished clients stay queued for the next run.
    if (action === "queued") {
      const row = (await list(db.AppSettings, { key: "brain_to_dossier_queue" }, "-updated_date", 1))[0];
      const q = row?.pageSettings || {};
      const fresh = q.requested_at && Date.now() - new Date(q.requested_at).getTime() < 3600 * 1000;
      if (!row || !["queued", "running"].includes(q.status) || !fresh) return Response.json({ skipped: true, reason: "nothing queued" });
      if (q.status === "running" && q.started_at && Date.now() - new Date(q.started_at).getTime() < 90 * 1000) return Response.json({ skipped: true, reason: "a run is in progress" });
      const todo = arr(q.client_ids).map(String);
      await db.AppSettings.update(row.id, { pageSettings: { ...q, status: "running", started_at: nowIso() } });
      const res: any[] = [...arr(q.results)];
      while (todo.length && inBudget()) {
        const id = todo.shift() as string;
        res.push(await syncOne(base44, db, id, { extract: q.extract !== false, force: q.force === true, dry: q.dry_run === true }).catch((e) => ({ client_id: id, error: String(e?.message || e) })));
        await db.AppSettings.update(row.id, { pageSettings: { ...q, client_ids: todo, status: todo.length ? "running" : "done", started_at: nowIso(), results: res } });
        await sleep(300);
      }
      await db.AppSettings.update(row.id, { pageSettings: { ...q, client_ids: todo, status: todo.length ? "queued" : "done", finished_at: nowIso(), results: res } });
      return Response.json({ done: res.length, remaining: todo.length });
    }
    if (action === "score") {
      const ids = body?.client_id ? [String(body.client_id)] : [...(await targets(db)), "agency"];
      const res: any[] = [];
      for (const id of ids) { if (!inBudget()) { res.push({ client_id: id, skipped: "time budget" }); continue; } res.push(await syncOne(base44, db, id, { extract: false, force: false, dry }).catch((e) => ({ client_id: id, error: String(e?.message || e) }))); }
      return Response.json({ results: res });
    }
    // nightly: one pass over every active client + Interstellar per Pacific day, in chunks (cursor in AppSettings
    // brain_to_dossier_nightly). The nightly workflow calls this step several times; a call after the pass is complete
    // does nothing. "all" (admin) starts a fresh pass now.
    if (action === "all" || action === "nightly") {
      // Strict read: if the cursor can't be read, stop (never start a new pass on a failed read).
      const flags = arr(await db.AppSettings.filter({ key: "brain_to_dossier_nightly" }, "-updated_date", 25));
      let flag = flags[0];
      // Tidy the duplicate cursor rows the old bug created (one per step per night); the newest row is the cursor.
      if (flags.length > 1 && !dry) for (const r of flags.slice(1)) await db.AppSettings.delete(r.id).catch(() => null);
      let st: any = flag?.pageSettings || {};
      const night = pacificDay();
      if (action === "all" || st.night !== night) {
        if (action === "nightly" && st.night === night) return Response.json({ skipped: true });
        const ids = [...(await targets(db)), "agency"];
        if (ids.length < 2) return Response.json({ error: "No active clients read; not starting a pass" }, { status: 503 });
        st = { night, ids, idx: 0, extracted: 0, summary: [], started_at: nowIso() };
      } else if (st.idx >= arr(st.ids).length) return Response.json({ skipped: true, reason: "tonight's pass is complete", ...st, summary: undefined });
      else if (st.chunk_at && Date.now() - new Date(st.chunk_at).getTime() < 90 * 1000) return Response.json({ skipped: true, reason: "a chunk is running" });
      st.chunk_at = nowIso();
      if (flag) await db.AppSettings.update(flag.id, { pageSettings: st }); else flag = await db.AppSettings.create({ key: "brain_to_dossier_nightly", pageSettings: st });
      const maxExtract = Number(body?.max_extract) || (action === "nightly" ? 4 : 20);
      while (st.idx < st.ids.length && Date.now() - t0 < CHUNK_BUDGET_MS) {
        const id = st.ids[st.idx];
        const mayExtract = body?.extract !== false && st.extracted < maxExtract;
        // A Brain re-map only starts early in a call (inBudget); a client that needs one waits to open the next chunk.
        if (!inBudget() && mayExtract && (body?.force === true || await needsRemap(db, id).catch(() => true))) break;
        st.idx++; // advance first: a client that ever hits the time limit is not retried forever
        await db.AppSettings.update(flag.id, { pageSettings: st }).catch(() => null);
        const r: any = await syncOne(base44, db, id, { extract: mayExtract && inBudget(), force: body?.force === true, dry }).catch((e) => ({ client_id: id, error: String(e?.message || e) }));
        if (r?.filled || r?.checks_set) st.extracted++;
        st.summary.push({ client: r.client || id, before: r.before ?? null, after: r.after ?? null, error: r.error || undefined, remapped: !!(r.filled || r.checks_set) });
        await db.AppSettings.update(flag.id, { pageSettings: st }).catch(() => null);
        await sleep(300);
      }
      const finished = st.idx >= st.ids.length;
      st.chunk_at = null; // this chunk is over: the next call may continue right away
      await db.AppSettings.update(flag.id, { pageSettings: st }).catch(() => null);
      if (finished && !dry) {
        const failed = st.summary.filter((x: any) => x.error).length;
        const msg = `${st.summary.length} synced (${st.extracted} re-mapped from the Brain), ${failed} failed · ${st.summary.map((x: any) => `${x.client}: ${x.before ?? "–"}→${x.after ?? "–"}`).join(", ")}`;
        await db.AutomationRun.create({ automation_name: "Brain → dossier sync", kind: "other", status: failed ? "failed" : "success", message: cut(msg, 1800), started_at: st.started_at, finished_at: nowIso(), processed: true }).catch(() => null);
        st.done_at = nowIso();
        await db.AppSettings.update(flag.id, { pageSettings: st }).catch(() => null);
      }
      return Response.json({ night: st.night, done: st.idx, of: st.ids.length, finished });
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("brain-to-dossier", (e as Error)?.message);
    return Response.json({ error: (e as Error)?.message || "Brain to dossier sync failed" }, { status: 500 });
  }
});
