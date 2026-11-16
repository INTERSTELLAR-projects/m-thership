// One shared "client context" block for every agent and AI engine (backend). Built from the client's Business Brain,
// ClientDossier, ClientGoal and SEO footprint (keywords, service area + city pages, service pages, GBP / reviews,
// citations, competitors, map pack status). Written to BusinessBrain.context_md by brain-to-dossier (nightly + on
// demand) so scheduled tasks and Claude queue jobs can read it, and read live by ai-gateway, the agents CEO chat and
// Nøva. The frontend twin is src/features/clients/clientContext.js (contextToBrief appends the stored block).
//
// Business-facing facts only, safe for a client's own Studio: no billing, prices Interstellar charges, logins,
// credentials, internal notes or open gaps. Nothing is invented: a missing fact shows as "not on file".
// The owner's own answers from a client app's Business Brain (client-brain ingest, docs/client-brain-sync.md) are
// included as their own section via shared/clientBrain.js getClientBrain.
// deno-lint-ignore-file no-explicit-any
import { getClientBrain, clientBrainLines } from "./clientBrain.js";

export const CONTEXT_MARKER = "<!-- client-context v1 -->";
const arr = (v: any) => (Array.isArray(v) ? v : []);
const s = (v: any) => (v == null ? "" : String(v).replace(/\s+/g, " ").trim());
const cut = (v: any, n: number) => { const t = s(v); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const SECRET_RE = /(password|passcode|pwd|api[_ -]?key|secret|token)\s*[:=]\s*\S+/gi;
// Credentials out, ™ not ®, and the build platform's name never reaches a client-facing prompt.
const clean = (t: string) => String(t || "").replace(SECRET_RE, "[removed]").replace(/®/g, "™").replace(/\bBase44 (website|site|app)/gi, "new $1").replace(/\bBase44\b/gi, "custom platform");
const yes = (v: any) => (Array.isArray(v) ? v.length > 0 : !!s(v));
async function list(ent: any, q: any, sort = "-created_date", limit = 200) {
  try { const r = await ent.filter(q, sort, limit); return Array.isArray(r) ? r : (r && r.items) || []; } catch { return []; }
}
const secText = (brain: any, key: string, n: number) => {
  const t = s(brain?.sections?.[key]?.text);
  return !t || /^unknown\.?$/i.test(t) ? "" : cut(t, n);
};

// Loads what the block needs. clientId "agency" (or scope interstellar) = Interstellar itself.
export async function loadContextSources(db: any, clientId: string) {
  const agency = !clientId || clientId === "agency";
  const brain = agency
    ? (await list(db.BusinessBrain, { scope: "interstellar" }, "-updated_date", 1))[0] || null
    : (await list(db.BusinessBrain, { client_id: clientId }, "-updated_date", 1))[0] || null;
  if (agency) {
    const [goals, work] = await Promise.all([
      list(db.ClientGoal, { client_id: "agency" }, "sort", 30),
      list(db.WorkLog, { client_id: "agency" }, "-date", 300),
    ]);
    return { agency, client: { business: "Interstellar Strategies", domain: "interstellar-strategies.com", industry: "Full-stack digital agency" }, brain, dossier: brain?.dossier || {}, goals, work, reviews: [], mapPlan: null, kit: null };
  }
  const [client, dossier, goals, work, reviews, mapPlan, kit, clientBrain] = await Promise.all([
    db.CRMClient.get(clientId).catch(() => null),
    list(db.ClientDossier, { client_id: clientId }, "-updated_date", 1).then((r) => r[0] || {}),
    list(db.ClientGoal, { client_id: clientId }, "sort", 30),
    list(db.WorkLog, { client_id: clientId }, "-date", 300),
    list(db.ReviewClient, { crm_client_id: clientId }, "-updated_date", 5),
    list(db.MapPackPlan, { client_id: clientId }, "-updated_date", 1).then((r) => r[0] || null),
    list(db.BrandKit, { client_id: clientId, status: "approved" }, "-version", 1).then((r) => r[0] || null),
    getClientBrain(db, clientId, { limit: 120 }).catch(() => null),
  ]);
  return { agency, client: client || { id: clientId }, brain, dossier, goals, work, reviews, mapPlan, kit, clientBrain };
}

const itemStatus = (d: any, pillar: string, item: string) => {
  const it = d?.pillars?.[pillar]?.items?.[item];
  return it?.status ? `${it.status}${it.note ? ` (${cut(it.note, 140)})` : it.evidence ? ` (${cut(it.evidence, 140)})` : ""}` : "";
};

export function buildContextBlock(src: any, opts: { maxChars?: number } = {}) {
  const { client, brain, agency } = src;
  const d = src.dossier || {};
  const name = client?.business || brain?.client_name || "this client";
  const L: string[] = [CONTEXT_MARKER, `## Client context: ${name}`, "Facts on file for this business (Business Brain + dossier + goals + SEO footprint). Use them to make every output specific to this business. Anything marked \"not on file\" is unknown: never fill it in."];

  // 1. Business
  L.push("", "### The business");
  L.push(`- ${name}${client?.industry ? ` · ${client.industry}` : ""}${client?.location ? ` · ${client.location}` : ""}${client?.domain ? ` · ${client.domain}` : ""}`);
  if (yes(d.tagline)) L.push(`- Tagline: ${cut(d.tagline, 160)}`);
  if (yes(d.elevator_pitch)) L.push(`- Pitch: ${cut(d.elevator_pitch, 360)}`);
  if (yes(d.usp)) L.push(`- Why them (USP): ${cut(d.usp, 360)}`);
  if (arr(d.differentiators).length) L.push(`- Differentiators: ${arr(d.differentiators).slice(0, 10).map((x: any) => cut(x, 90)).join("; ")}`);
  if (yes(d.founded)) L.push(`- Founded: ${cut(d.founded, 120)}`);
  if (yes(d.story)) L.push(`- Story: ${cut(d.story, 420)}`);
  if (!yes(d.elevator_pitch) && !yes(d.usp)) { const o = secText(brain, "overview", 900); L.push(o ? `- Overview (Brain): ${o}` : "- Overview: not on file"); }

  // 2. Goals, criteria and targets
  L.push("", "### Goals, criteria and targets");
  const goals = arr(src.goals).filter((g: any) => !g.year || Number(g.year) >= 2026);
  if (goals.length) {
    for (const g of goals.slice(0, 10)) {
      const nums = [g.baseline_value != null ? `baseline ${g.baseline_value}` : "", g.current_value != null ? `now ${g.current_value}` : "", g.target_value != null ? `target ${g.target_value}${g.unit ? ` ${g.unit}` : ""}` : ""].filter(Boolean).join(", ");
      L.push(`- ${g.year || ""} ${cut(g.title, 160)}${g.metric ? ` [${cut(g.metric, 60)}]` : ""}${nums ? ` (${nums})` : ""} · ${g.status || "not_started"}`.replace(/^- +/, "- "));
    }
  } else {
    const t = secText(brain, "goals", 700);
    L.push(t ? `- From the Brain: ${t}` : "- Goals and targets: not on file (no goals call yet).");
  }
  const kpis = Object.entries(d.kpis || {}).filter(([k]) => !/phone|password|token|secret|login|cid|place_id|share_link/i.test(k)).slice(0, 8);
  if (kpis.length) L.push(`- Numbers on file: ${kpis.map(([k, v]) => `${k.replace(/_/g, " ")}: ${cut(typeof v === "object" ? JSON.stringify(v) : v, 90)}`).join(" · ")}`);
  if (yes(d.dream_outcome)) L.push(`- What their customer is really buying (dream outcome): ${cut(d.dream_outcome, 300)}`);

  // 3. Offers
  L.push("", "### Offers and services");
  const offers = arr(d.offers);
  if (offers.length) for (const o of offers.slice(0, 8)) L.push(`- ${o.kind ? `[${o.kind}] ` : ""}${cut(o.name, 120)}${o.price ? ` · ${cut(o.price, 60)}` : ""}${o.promise ? ` · promise: ${cut(o.promise, 140)}` : ""}${o.guarantee ? ` · guarantee: ${cut(o.guarantee, 120)}` : ""}${o.bonuses ? ` · bonuses: ${cut(o.bonuses, 120)}` : ""}`);
  else { const t = secText(brain, "offer_pricing", 700); L.push(t ? `- From the Brain: ${t}` : "- Offers: not on file"); }
  const services = arr(d.services).map((x: any) => (typeof x === "string" ? { name: x } : x)).filter((x: any) => x?.name);
  if (services.length) L.push(`- Services: ${services.slice(0, 20).map((x: any) => cut(x.name, 60)).join(", ")}`);

  // 4. Audience
  L.push("", "### Audience");
  const a = d.audience || {};
  if (yes(a.ideal_customer)) L.push(`- Ideal customer: ${cut(a.ideal_customer, 300)}`);
  if (arr(a.pains).length) L.push(`- Pains: ${arr(a.pains).slice(0, 6).map((x: any) => cut(x, 100)).join("; ")}`);
  if (arr(a.desires).length) L.push(`- Wants: ${arr(a.desires).slice(0, 6).map((x: any) => cut(x, 100)).join("; ")}`);
  if (arr(a.objections).length) L.push(`- Objections: ${arr(a.objections).slice(0, 6).map((x: any) => cut(x, 100)).join("; ")}`);
  if (arr(a.where_they_hang_out).length) L.push(`- Where they look: ${arr(a.where_they_hang_out).slice(0, 6).map((x: any) => cut(x, 60)).join(", ")}`);
  if (!yes(a.ideal_customer) && !arr(a.pains).length) { const t = secText(brain, "audience", 600); L.push(t ? `- From the Brain: ${t}` : "- Audience: not on file"); }
  if (arr(d.lead_sources).length) L.push(`- Lead sources: ${arr(d.lead_sources).slice(0, 10).map((x: any) => cut(x, 60)).join(", ")}`);

  // 5. Brand voice
  L.push("", "### Brand and voice");
  const v = d.brand_voice || {};
  if (arr(v.tone).length) L.push(`- Tone: ${arr(v.tone).join(", ")}`);
  if (yes(v.personality)) L.push(`- Personality: ${cut(v.personality, 260)}`);
  if (arr(v.say).length) L.push(`- Say: ${arr(v.say).slice(0, 10).map((x: any) => `"${cut(x, 60)}"`).join(", ")}`);
  if (arr(v.never_say).length) L.push(`- Never say: ${arr(v.never_say).slice(0, 10).map((x: any) => `"${cut(x, 80)}"`).join(", ")}`);
  const bi = d.brand_identity || {};
  if (arr(bi.colors).length || yes(bi.fonts)) L.push(`- Look: ${[arr(bi.colors).length ? `colors ${arr(bi.colors).join(" ")}` : "", yes(bi.fonts) ? `fonts ${cut(bi.fonts, 120)}` : "", yes(bi.style) ? cut(bi.style, 140) : ""].filter(Boolean).join(" · ")}`);
  if (src.kit?.summary) L.push(`- Approved brand kit v${src.kit.version || 1}: ${cut(src.kit.summary, 260)}`);
  if (!arr(v.tone).length && !yes(v.personality)) { const t = secText(brain, "brand", 500); L.push(t ? `- From the Brain: ${t}` : "- Voice: not on file"); }

  // 5b. The owner's own answers (client app Business Brain): how they price, word estimates, approve and talk.
  if (src.clientBrain) L.push(...clientBrainLines(src.clientBrain, 2500));

  // 6. SEO footprint
  L.push("", "### SEO footprint");
  const sa = d.service_area || {};
  if (yes(sa.model) || yes(sa.primary_city)) L.push(`- Market: ${[sa.model, sa.primary_city, sa.radius].filter(yes).map((x: any) => cut(x, 120)).join(" · ")}`);
  const cities = arr(sa.cities);
  if (cities.length) {
    const live = cities.filter((c: any) => yes(c.page_url));
    L.push(`- Target cities (${live.length}/${cities.length} with a live page): ${cities.slice(0, 30).map((c: any) => `${c.city}${c.priority ? ` (${c.priority})` : ""}${yes(c.page_url) ? " ✓page" : " no page"}`).join(", ")}`);
  } else L.push("- Target cities: not on file");
  if (services.length) { const withPage = services.filter((x: any) => yes(x.page_url)).length; L.push(`- Service pages: ${withPage}/${services.length} services have a page`); }
  const kws = arr(d.keywords).filter((k: any) => k?.term && k.status !== "retired");
  if (kws.length) {
    const rank = (k: any) => ({ primary: 0, secondary: 1, long_tail: 2 } as any)[k.priority] ?? 1;
    const top = [...kws].sort((x: any, y: any) => rank(x) - rank(y)).slice(0, 15);
    L.push(`- Target keywords (${kws.length}; ${kws.filter((k: any) => yes(k.page_url)).length} mapped to a page). Top: ${top.map((k: any) => `"${cut(k.term, 60)}"${k.city ? ` [${cut(k.city, 30)}]` : ""}${typeof k.rank === "number" ? ` rank ${k.rank}${k.rank_source ? ` (${cut(k.rank_source, 20)})` : ""}` : ""}${yes(k.page_url) ? "" : " (no page yet)"}`).join("; ")}`);
  } else L.push("- Target keywords: not on file");
  const rv = arr(src.reviews).filter((r: any) => r?.cache && typeof r.cache.rating === "number");
  if (rv.length) L.push(`- Google reviews: ${rv.map((r: any) => `${cut(r.name, 60)} ${r.cache.rating}★ from ${r.cache.total ?? "?"} (as of ${String(r.cached_at || "").slice(0, 10) || "?"})`).join("; ")}`);
  const gbpTxt = secText(brain, "gbp_listings", 350);
  if (gbpTxt) L.push(`- Listings (Brain): ${gbpTxt}`);
  const citations = arr(src.work).filter((w: any) => w.kind === "citation").length;
  const citeItem = itemStatus(d, "beacon", "citations");
  L.push(`- Citations logged: ${citations}${citeItem ? ` · status ${citeItem}` : ""}`);
  const mapItem = itemStatus(d, "beacon", "map_rank");
  const catItem = itemStatus(d, "beacon", "categories");
  L.push(`- Map pack: ${src.mapPlan ? `plan ${src.mapPlan.status || "draft"}` : "no map pack plan"}${mapItem ? ` · top-3 status ${mapItem}` : " · rank not measured"}${catItem ? ` · categories ${catItem}` : ""}`);
  const comps = arr(d.competitors).filter((c: any) => c?.name);
  if (comps.length) L.push(`- Competitors: ${comps.slice(0, 6).map((c: any) => `${cut(c.name, 50)}${c.weakness ? ` (gap: ${cut(c.weakness, 70)})` : ""}`).join("; ")}`);
  else { const t = secText(brain, "competitors", 500); L.push(t ? `- Competitors (Brain): ${t}` : "- Competitors: not on file"); }
  const blogs = arr(src.work).filter((w: any) => w.kind === "blog");
  if (blogs.length) L.push(`- Blog posts on record: ${blogs.length} (latest: ${blogs.slice(0, 3).map((w: any) => `"${cut(w.title, 70)}"${w.status && w.status !== "live" ? ` [${w.status}]` : ""}`).join("; ")})`);

  if (agency) L.push("", "_This is Interstellar Strategies itself (the agency), not a client._");
  const max = opts.maxChars || 10000;
  let out = clean(L.join("\n"));
  if (out.length > max) out = `${out.slice(0, max - 1)}…`;
  return out;
}

export async function buildClientContext(db: any, clientId: string, opts: { maxChars?: number } = {}) {
  return buildContextBlock(await loadContextSources(db, clientId), opts);
}

// Cheap read for engines: the stored block (refreshed nightly), or a live build when none is stored yet.
export async function getClientContext(db: any, clientId: string, opts: { live?: boolean; maxChars?: number } = {}) {
  if (!opts.live) {
    const agency = !clientId || clientId === "agency";
    const b = (await list(db.BusinessBrain, agency ? { scope: "interstellar" } : { client_id: clientId }, "-updated_date", 1))[0];
    if (b?.context_md) return String(b.context_md).slice(0, opts.maxChars || 10000);
  }
  return buildClientContext(db, clientId, opts).catch(() => "");
}
