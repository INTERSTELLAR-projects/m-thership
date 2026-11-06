// Agent Constellation backend (Møthership > Agents). Admin only, except the nightly run below.
//   ceo_chat     { messages: [{role, content}], scope?: "interstellar"|"client", client_id? }
//                Commander (or a Client CEO) answers ONLY from registry + runs + learnings + research + tasks
//                (+ that client's brain). Never invents; says so when the records don't hold the answer.
//   ceo_brief    { client_id? }        today's CeoBrief (generated_by in_app), facts first, LLM wording second.
//   brain_seed   { client_id? | all?: true }  deterministic seed from records; only fills empty seed sections,
//                never overwrites Justin / agent / research text.
//   brain_edit   { brain_id, section, text, confidence? }  Justin's edit: history + changelog, confidence high.
//   brain_add_update { brain_id, section, text, source?, by?, agent_key? }  queue a proposed update.
//   brain_resolve { brain_id, conflict_id, resolution: "keep"|"incoming"|"dismiss" }
//   brain_refine { brain_id }          merge pending updates (dedupe, newest + sourced wins, conflicts flagged
//                for Justin, never silently overwritten), regenerate the at-a-glance summary.
//   sync_clients {}                    (re)build every active client's template instances from real data.
//   nightly      {}                    workflow "Agents — nightly brain refresh": seed missing brains, sync client
//                instances, refine up to 5 brains. Callable without a user at most once per 8 hours.
// Never sends anything to a client, never changes a client site, package or price. No secrets are read or stored.
// deno-lint-ignore-file no-explicit-any
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { callClaude, AnthropicError, HOUSE_RULES } from "../../shared/anthropic.ts";
import { getSecret } from "../../shared/portalClient.ts";
import { estimateAiCost } from "../../shared/usagePlans.ts";
import { weightFor } from "../../shared/fuel.ts";
import { CLIENT_TEMPLATES, BRAIN_SECTIONS, BRAIN_SECTION_KEYS, brainCompleteness, sectionScore } from "../../shared/agentDefs.js";
import { getClientContext } from "../../shared/clientContext.ts";

const nowIso = () => new Date().toISOString();
const DAY = 86400000;
const arr = (v: any) => (Array.isArray(v) ? v : (v && v.items) || []);
const cut = (s: unknown, n: number) => { const t = String(s ?? "").replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };
const uid = () => Math.random().toString(36).slice(2, 10);
const pacificDay = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(d);
const SECRET_RE = /(password|passcode|pwd|api[_ -]?key|secret|token)\s*[:=]\s*\S+/gi;
// Strips anything that looks like a credential, and applies the brand mark rule (™, never ®).
const scrub = (s: string) => String(s || "").replace(SECRET_RE, "[removed: credentials are never stored]").replace(/®/g, "™");

// Brand hygiene for existing brains: rewrite any section text that still carries ® (e.g. Stripe product names).
async function brandHygiene(db: any) {
  const brains = await list(db.BusinessBrain, {}, "-updated_date", 300);
  let fixed = 0;
  for (const b of brains) {
    const secs = b.sections || {};
    if (!JSON.stringify(secs).includes("®") && !String(b.glance || "").includes("®")) continue;
    const next: any = {};
    for (const [k, v] of Object.entries(secs)) next[k] = v && typeof v === "object" ? { ...(v as any), text: String((v as any).text || "").replace(/®/g, "™") } : v;
    await db.BusinessBrain.update(b.id, { sections: next, glance: String(b.glance || "").replace(/®/g, "™") || b.glance });
    fixed++;
  }
  return fixed;
}

async function list(ent: any, q: any = {}, sort = "-created_date", limit = 200) {
  try { return arr(await ent.filter(q, sort, limit)); } catch { return []; }
}

// ---------- LLM ----------
async function llm(base44: any, opts: { system: string; prompt: string; schema?: any; tier?: "routine" | "long"; feature: string; asService?: boolean }) {
  const key = getSecret("ANTHROPIC_API_KEY");
  const db = base44.asServiceRole.entities;
  if (key) {
    try {
      const out = await callClaude({ key, tier: opts.tier || "long", system: opts.system, prompt: opts.prompt, schema: opts.schema || null, max_tokens: 6000 });
      await db.UsageLedger.create({ client_id: "agency", client_name: "Interstellar (admin)", month: pacificDay().slice(0, 7), kind: "ai_action", units: weightFor(out.model, out.input_tokens, opts.feature), calls: 1, model: out.model, est_cost_usd: estimateAiCost(out.model, out.input_tokens, out.output_tokens), feature: opts.feature, by_admin: true, input_tokens: out.input_tokens, output_tokens: out.output_tokens, created_at: nowIso() }).catch(() => null);
      return opts.schema ? out.json : out.text;
    } catch (e) {
      if (!(e instanceof AnthropicError)) throw e;
      console.error("agents llm anthropic", e.status, e.type);
    }
  }
  const core = opts.asService ? base44.asServiceRole.integrations.Core : base44.integrations.Core;
  // Fallback keeps the same house rules the Anthropic path prepends (PROMPTING-STANDARD.md).
  const out = await core.InvokeLLM({ prompt: `${HOUSE_RULES}\n\n${opts.system}\n\n${opts.prompt}`, ...(opts.schema ? { response_json_schema: opts.schema } : {}) });
  if (opts.schema) return typeof out === "string" ? JSON.parse(out) : out;
  return typeof out === "string" ? out : JSON.stringify(out);
}

// ---------- text helpers for the seed ----------
function flat(v: any, depth = 0): string {
  if (v == null || v === "") return "";
  if (Array.isArray(v)) return v.map((x) => (typeof x === "object" ? flat(x, depth + 1) : String(x))).filter(Boolean).join(depth ? "; " : "\n- ");
  if (typeof v === "object") {
    return Object.entries(v)
      .filter(([k, x]) => x != null && x !== "" && !(Array.isArray(x) && !x.length) && !/secret|password|token/i.test(k))
      .map(([k, x]) => `${k.replace(/_/g, " ")}: ${typeof x === "object" ? flat(x, depth + 1) : x}`)
      .join(depth ? ", " : "\n- ");
  }
  return String(v);
}
const bullets = (lines: (string | false | null | undefined)[]) => lines.filter(Boolean).map((l) => `- ${l}`).join("\n");
const block = (label: string, v: any) => { const t = flat(v); return t ? `${label}:\n- ${t}` : ""; };

// DESIGN.md lives inside the brand section (sections.brand.design_md, AgencyKnowledge build_standard section 7).
// Seed, refine and section edits rewrite a section's text; they keep design_md. Only an explicit design_md write changes it.
const keepDesign = (old: any, next: any) => (old && old.design_md ? { ...next, design_md: old.design_md } : next);

function sec(text: string, sources: string[], confidence = "medium") {
  const t = scrub(String(text || "").trim());
  return { text: t || "unknown", sources: t ? sources : [], updated_at: nowIso(), updated_by: "seed", confidence: t ? confidence : "unknown" };
}

// ---------- seed: client ----------
async function seedClientSections(db: any, c: any, ctx: any) {
  const d = (await list(db.ClientDossier, { client_id: c.id }, "-updated_date", 1))[0] || {};
  const gaps = await list(db.ClientGap, { client_id: c.id, status: { $in: ["open", "planned", "in_progress"] } }, "-created_date", 30);
  const goals = await list(db.ClientGoal, { client_id: c.id }, "sort", 20);
  const kit = (await list(db.BrandKit, { client_id: c.id, status: "approved" }, "-version", 1))[0];
  const blogs = await list(db.WorkLog, { client_id: c.id, kind: { $in: ["blog", "gbp_post", "project_page", "new_page"] } }, "-date", 6);
  const review = ctx.reviews.filter((r: any) => r.crm_client_id === c.id);
  const mapPlan = ctx.mapPlans.find((m: any) => m.client_id === c.id);
  const regRows = ctx.registry.filter((r: any) => r.client_id === c.id && r.scope === "interstellar");
  const services = arr(c.services).filter((s: any) => !s.discontinued);
  const src = (n: string) => [n];

  const s: Record<string, any> = {};
  s.overview = sec([
    `${c.business}${c.industry ? ` (${c.industry})` : ""}.`,
    c.location && `Location: ${c.location}.`,
    c.contact && `Owner / main contact: ${c.contact}.`,
    d.tagline && `Tagline: ${d.tagline}`,
    d.elevator_pitch && `Pitch: ${d.elevator_pitch}`,
    d.founded && `Founded: ${d.founded}`,
    d.story && `Story: ${d.story}`,
    d.usp && `Why them: ${d.usp}`,
  ].filter(Boolean).join("\n"), src("CRMClient + ClientDossier"), d.elevator_pitch || d.usp ? "medium" : "low");

  const offerLines = arr(d.offers).map((o: any) => `${o.name || "Offer"}${o.price ? ` — ${o.price}` : " — price unknown"}${o.promise ? ` (${o.promise})` : ""}`);
  const svc = arr(d.services).map((x: any) => (typeof x === "string" ? x : x?.name)).filter(Boolean);
  s.offer_pricing = sec([
    svc.length && `Services:\n${bullets(svc.slice(0, 25))}`,
    offerLines.length ? `Offers:\n${bullets(offerLines)}` : (svc.length ? "Prices: unknown (none recorded)." : ""),
    d.dream_outcome && `Dream outcome: ${d.dream_outcome}`,
  ].filter(Boolean).join("\n\n"), src("ClientDossier"), offerLines.length ? "medium" : "low");

  s.audience = sec([block("Audience", d.audience), arr(d.lead_sources).length && `Lead sources: ${arr(d.lead_sources).join(", ")}`].filter(Boolean).join("\n\n"), src("ClientDossier"));

  s.brand = sec([
    c.accent && `Accent color on file: ${c.accent}`,
    block("Identity", d.brand_identity),
    block("Voice", d.brand_voice),
    kit?.summary && `Approved brand kit v${kit.version}: ${kit.summary}`,
  ].filter(Boolean).join("\n\n"), src(kit ? "ClientDossier + BrandKit" : "ClientDossier"));

  s.contacts_channels = sec(bullets([
    c.contact && `Contact: ${c.contact}`,
    arr(c.emails).length && `Email: ${arr(c.emails).join(", ")}`,
    arr(c.phones).length && `Phone: ${arr(c.phones).join(", ")}`,
    arr(c.websites).length && `Websites: ${arr(c.websites).join(", ")}`,
    "Social profiles: unknown unless listed in the dossier.",
  ]), src("CRMClient"));

  s.website_logins = sec(bullets([
    c.domain && `Domain: ${c.domain}`,
    c.site_app_id && `Website: Base44 app ${c.site_app_id} (Justin's account)`,
    c.ops_app_id && `Operations system: Base44 app ${c.ops_app_id}`,
    "Where each login lives: unknown (record locations only, never passwords).",
  ]), src("CRMClient"), "low");

  s.gbp_listings = sec(bullets([
    ...review.map((r: any) => `Google reviews feed (Stärboard): ${r.name}${r.cache && typeof r.cache.rating === "number" ? ` · ${r.cache.rating}★ from ${r.cache.total ?? "?"} reviews (cached ${String(r.cached_at || "").slice(0, 10) || "date unknown"})` : ""}`),
    mapPlan && `Map pack plan: ${mapPlan.status || "draft"}${mapPlan.primary_location ? ` · primary ${flat(mapPlan.primary_location)}` : ""}`,
    "Bing Places / Apple Business Connect / citations status: unknown.",
  ]), src("ReviewClient + MapPackPlan"), review.length ? "medium" : "low");

  s.content = sec([
    arr(c.blogSchedule).length && `Contracted cadence:\n${bullets(arr(c.blogSchedule).map((b: any) => `${b.type}: ${b.count} ${b.frequency}`))}`,
    regRows.length && `Agents:\n${bullets(regRows.map((r: any) => `${r.name} · ${r.status}${r.schedule ? ` · ${r.schedule}` : ""}${r.last_run_at ? ` · last run ${String(r.last_run_at).slice(0, 10)}` : ""}`))}`,
    blogs.length && `Recent logged work:\n${bullets(blogs.map((w: any) => `${String(w.date || w.created_date || "").slice(0, 10)} ${w.kind}: ${w.title} (${w.status || "logged"})`))}`,
  ].filter(Boolean).join("\n\n"), src("CRMClient + AgentRegistry + WorkLog"));

  s.apps_systems = sec(bullets([
    arr(c.services_managed).length && `We manage: ${arr(c.services_managed).join(", ")}`,
    c.site_app_id && `Website app ${c.site_app_id}`,
    c.ops_app_id && `Ops app ${c.ops_app_id}`,
    arr(d.tools).length && `Their tools: ${flat(d.tools).replace(/\n- /g, ", ")}`,
  ]), src("CRMClient + ClientDossier"));

  s.billing = sec(bullets([
    c.plan && `Plan: ${c.plan}`,
    ...services.map((x: any) => `${x.name}${x.price ? ` $${x.price}/${x.interval || "mo"}` : ""}${x.status ? ` (${x.status})` : ""}${x.included ? " (included)" : ""}`),
    c.bundle && `Billed together as: ${c.bundle}`,
  ]), src("CRMClient (Stripe sync)"), "high");

  s.goals = sec([
    goals.length && bullets(goals.map((g: any) => `${g.year || ""} ${g.title}${g.target_value != null ? ` → ${g.target_value}${g.unit ? ` ${g.unit}` : ""}` : ""} (${g.status || "not started"})`)),
    d.kpis && Object.keys(d.kpis).length ? block("Recorded KPIs", d.kpis) : "",
  ].filter(Boolean).join("\n\n"), src("ClientGoal + ClientDossier"));

  s.problems = sec(gaps.length ? bullets(gaps.slice(0, 12).map((g: any) => `[${g.severity || "?"}] ${g.title}${g.status ? ` (${g.status})` : ""}`)) : "", src("ClientGap"));
  s.competitors = sec(arr(d.competitors).length ? bullets(arr(d.competitors).map((x: any) => `${x.name}${x.strength ? ` — strength: ${x.strength}` : ""}${x.weakness ? ` — weakness: ${x.weakness}` : ""}`)) : "", src("ClientDossier"));
  const notes = arr(c.notes).map((n: any) => (typeof n === "string" ? n : `${n.date ? n.date + ": " : ""}${n.text || ""}`)).filter(Boolean);
  s.decisions = sec([notes.length && bullets(notes), d.notes && `Dossier notes: ${d.notes}`].filter(Boolean).join("\n\n"), src("CRMClient notes + ClientDossier"));
  return s;
}

// ---------- seed: Interstellar ----------
async function seedInterstellarSections(db: any) {
  const kb = await list(db.AgencyKnowledge, {}, "sort", 50);
  const by = (k: string) => kb.find((x: any) => x.key === k);
  const pick = (keys: string[]) => keys.map((k) => by(k)).filter(Boolean);
  const join = (rows: any[]) => rows.map((r: any) => `### ${r.title}\n${r.body || ""}`).join("\n\n");
  const s: Record<string, any> = {};
  const mk = (rows: any[], conf = "high") => (rows.length ? { text: scrub(join(rows)), sources: rows.map((r: any) => `AgencyKnowledge:${r.key}`), updated_at: nowIso(), updated_by: "seed", confidence: conf } : sec("", []));
  s.overview = mk(pick(["about"]));
  s.offer_pricing = mk(pick(["offers", "pricing_rules"]));
  s.audience = sec("Main market: home service businesses; positioning global rather than local (AgencyKnowledge: about). Detailed avatar: unknown.", ["AgencyKnowledge:about"], "low");
  s.brand = mk(pick(["voice"]));
  s.contacts_channels = sec("Justin Cowell, founder · justin@interstellar-strategies.com · Molalla, OR. Phone and social handles: unknown.", ["Scheduled task prompts (owner email)"], "low");
  s.website_logins = sec("Møthership (Base44 app 69d80bb06c5ad07a795df54e) is the agency OS. Website: interstellar-strategies.com. Where each login lives: unknown.", ["App config"], "low");
  s.gbp_listings = sec("", []);
  s.content = mk(pick(["social_search"]), "medium");
  s.apps_systems = mk(pick(["operations"]));
  s.billing = sec("Subscriptions and invoices run through Stripe (synced into CRMClient services). Only HyperCare+ and GravïtyCare are subscriptions; everything else is paid up front (AgencyKnowledge: offers).", ["AgencyKnowledge:offers", "CRMClient"], "medium");
  s.goals = sec("2027 goal: $1,000,000 revenue, with offers built on Alex Hormozi's frameworks (AgencyKnowledge: about).", ["AgencyKnowledge:about"], "medium");
  s.problems = sec("", []);
  s.competitors = sec("", []);
  s.decisions = mk(pick(["delivery_rules", "bonuses"]));
  return s;
}

function openQuestionsFor(sections: any, name: string, existing: any[] = []) {
  const have = new Set(existing.map((q: any) => q.section));
  return BRAIN_SECTIONS.filter((x) => sectionScore(sections[x.key]) === 0 && !have.has(x.key))
    .map((x) => ({ q: `${x.label} for ${name}: ${x.hint}`, section: x.key, added_at: nowIso(), status: "open" }));
}

async function seedBrains(db: any, clientId?: string) {
  const out: any[] = [];
  const [clients, brains, reviews, mapPlans, registry] = await Promise.all([
    list(db.CRMClient, clientId ? { id: clientId } : { status: "Active" }, "business", 200),
    list(db.BusinessBrain, {}, "-updated_date", 300),
    list(db.ReviewClient, {}, "name", 200),
    list(db.MapPackPlan, {}, "-updated_date", 200),
    list(db.AgentRegistry, { scope: "interstellar" }, "sort", 500),
  ]);
  const ctx = { reviews, mapPlans, registry };
  const fill = async (existing: any, sections: any, base: any) => {
    if (!existing) {
      const rec = { ...base, sections, completeness: brainCompleteness(sections), open_questions: openQuestionsFor(sections, base.client_name || "Interstellar"), pending_updates: [], conflicts: [], history: [], changelog: [{ at: nowIso(), by: "seed", section: "*", change: "Brain created from Møthership records" }], seeded_at: nowIso() };
      const created = await db.BusinessBrain.create(rec);
      out.push({ client: base.client_name || "Interstellar", created: true, completeness: rec.completeness, id: created?.id });
      return;
    }
    const cur = { ...(existing.sections || {}) };
    const filled: string[] = [];
    for (const k of BRAIN_SECTION_KEYS) {
      const old = cur[k];
      const fresh = sections[k];
      const oldIsSeedOrEmpty = !old || old.updated_by === "seed" || sectionScore(old) === 0;
      if (oldIsSeedOrEmpty && fresh && sectionScore(fresh) > sectionScore(old || {})) { cur[k] = keepDesign(old, fresh); filled.push(k); }
    }
    if (filled.length) {
      await db.BusinessBrain.update(existing.id, { sections: cur, completeness: brainCompleteness(cur), open_questions: [...arr(existing.open_questions).filter((q: any) => !filled.includes(q.section)), ...openQuestionsFor(cur, base.client_name || "Interstellar", arr(existing.open_questions))], changelog: [{ at: nowIso(), by: "seed", section: filled.join(","), change: `Filled from records: ${filled.join(", ")}` }, ...arr(existing.changelog)].slice(0, 200) });
    }
    out.push({ client: base.client_name || "Interstellar", created: false, filled, completeness: brainCompleteness(cur) });
  };
  if (!clientId) {
    const ib = brains.find((b: any) => b.scope === "interstellar");
    await fill(ib, await seedInterstellarSections(db), { scope: "interstellar", client_name: "Interstellar Strategies" });
  }
  for (const c of clients) {
    const b = brains.find((x: any) => x.scope === "client" && x.client_id === c.id);
    await fill(b, await seedClientSections(db, c, ctx), { scope: "client", client_id: c.id, client_name: c.business });
  }
  return out;
}

// ---------- client template instances ----------
function rollup(rows: any[]) {
  if (!rows.length) return null;
  const status = rows.some((r) => r.status === "broken") ? "broken" : rows.some((r) => r.status === "live") ? "live" : rows.some((r) => r.status === "paused") ? "paused" : "planned";
  const last = rows.map((r) => r.last_run_at).filter(Boolean).sort().pop() || null;
  const lastRow = rows.find((r) => r.last_run_at === last);
  return { status, last_run_at: last, last_status: lastRow?.last_status || (last ? "unknown" : "never"), schedule: rows.map((r) => r.schedule).filter(Boolean).join(" + "), external_id: rows.map((r) => r.external_id).filter(Boolean).join(","), notes: rows.map((r) => `${r.name}: ${r.status}`).join(" · ") };
}

async function syncClients(db: any, by = "in_app") {
  const since = new Date(Date.now() - 30 * DAY).toISOString();
  const [clients, registry, reviews, jobs, plans, adAccts, socials, audits, mapPlans, brains, notes, runs] = await Promise.all([
    list(db.CRMClient, { status: "Active" }, "business", 200),
    list(db.AgentRegistry, {}, "sort", 2000),
    list(db.ReviewClient, {}, "name", 200),
    list(db.ClaudeJob, { kind: { $in: ["social_plan", "audit", "map_pack_plan"] } }, "-created_date", 300),
    list(db.SocialPlan, {}, "-created_date", 200),
    list(db.AdAccount, {}, "-created_date", 100),
    list(db.SocialAccount, {}, "-created_date", 200),
    list(db.SiteAudit, { run_at: { $gte: since } }, "-run_at", 500),
    list(db.MapPackPlan, {}, "-updated_date", 200),
    list(db.BusinessBrain, { scope: "client" }, "-updated_date", 300),
    list(db.ResearchNote, {}, "-created_at", 300),
    list(db.AutomationRun, { started_at: { $gte: since } }, "-started_at", 1000),
  ]);
  const existing = new Map(registry.filter((r: any) => r.scope === "client" && r.template_key).map((r: any) => [r.key, r]));
  const creates: any[] = [];
  let updated = 0;
  const now = nowIso();
  for (const c of clients) {
    const mine = registry.filter((r: any) => r.scope === "interstellar" && r.client_id === c.id);
    const studios = c.studios || {};
    const jobsFor = (k: string) => jobs.filter((j: any) => j.kind === k && (j.client_id === c.id || j.client_name === c.business));
    for (const t of CLIENT_TEMPLATES) {
      let st: any = { status: "planned", last_status: "never", last_run_at: null, schedule: "", external_id: "", notes: "" };
      const roll = rollup(mine.filter((r: any) => r.template_key === t.key));
      if (roll) st = roll;
      if (t.key === "client_ceo") st = { status: "live", last_status: "unknown", schedule: "On demand (Agents page)", notes: "Chat grounded only in this client's brain and agent runs." };
      if (t.key === "brain_keeper") { const b = brains.find((x: any) => x.client_id === c.id); st = { status: b ? "live" : "planned", last_run_at: b?.last_refined_at || null, last_status: b?.last_refined_at ? "success" : "never", schedule: "Nightly 10:13 PM PT (workflow) + Refine now", notes: b ? `Brain completeness ${b.completeness ?? 0}%` : "No brain yet" }; }
      if (t.key === "client_research") { const n = notes.filter((x: any) => x.client_id === c.id); st = { status: "live", last_run_at: n[0]?.created_at || null, last_status: n.length ? "success" : "never", schedule: "Research department rotation (Mon/Wed/Fri)", notes: `${n.length} sourced research notes on file` }; }
      if (t.key === "keyword_steward") { const r = runs.filter((x: any) => x.automation_name === "Keyword steward" && x.client_id === c.id); const kw = registry.find((x: any) => x.key === "claude:trig_01EwtNWe3E7BBEewuFG2Qi8u"); st = { status: kw?.status || "live", last_run_at: r[0]?.finished_at || r[0]?.started_at || kw?.last_run_at || null, last_status: r[0]?.status || kw?.last_status || "unknown", schedule: "Monthly · 2nd at 1:23 PM PT", external_id: "trig_01EwtNWe3E7BBEewuFG2Qi8u", notes: "Runs for every Active client" }; }
      if (t.key === "map_pack") { const m = mapPlans.find((x: any) => x.client_id === c.id); const j = jobsFor("map_pack_plan")[0]; if (m || j) st = { status: "live", last_run_at: m?.updated_at || j?.finished_at || null, last_status: m?.status === "approved" ? "success" : "needs_approval", notes: m ? `Plan status: ${m.status || "draft"}` : `Job: ${j.status}` }; }
      if (t.key === "social_plan") { const p = plans.find((x: any) => x.client_id === c.id); const j = jobsFor("social_plan")[0]; if (p || j) st = { status: "live", last_run_at: p?.approved_at || j?.finished_at || null, last_status: p ? "success" : j?.status === "needs_approval" ? "needs_approval" : "unknown", notes: p ? `Approved plan v${p.version || 1}` : `Draft: ${cut(j.title, 80)} (${j.status})` }; }
      if (t.key === "social_insights") { const a = socials.find((x: any) => x.client_id === c.id && (x.ig_user_id || x.platform === "instagram")); if (a) st = { status: a.sync_error ? "broken" : "live", last_run_at: a.synced_at || null, last_status: a.sync_error ? "failed" : a.synced_at ? "success" : "never", schedule: "Daily 5:53 AM PT", notes: a.sync_error ? cut(a.sync_error, 120) : `@${a.handle || a.display_name || "linked"}` }; }
      if (t.key === "ads_optimizer") { const a = adAccts.find((x: any) => x.client_id === c.id); if (a) st = { status: a.connected ? (a.last_sync_error ? "broken" : "live") : "paused", last_run_at: a.last_synced_at || null, last_status: a.last_sync_error ? "failed" : a.last_synced_at ? "success" : "never", schedule: "Daily 5:23 / 6:07 AM PT", notes: a.last_sync_error ? cut(a.last_sync_error, 120) : a.name || "" }; }
      if (t.key === "email_marketing" || t.key === "social_posts") {
        const k = t.key === "email_marketing" ? "email" : "social";
        const v = studios[k];
        if (v === "on") st = { status: "live", last_status: "unknown", notes: `${k} Studio switched on for the client` };
        else st = { ...st, notes: `${k} Studio ${v || "preview"} (not switched on)` };
      }
      if (t.key === "reviews_feed") { const r = reviews.filter((x: any) => x.crm_client_id === c.id); if (r.length) st = { status: r.some((x: any) => x.last_error) ? "broken" : r.some((x: any) => x.active) ? "live" : "paused", last_run_at: r.map((x: any) => x.cached_at).filter(Boolean).sort().pop() || null, last_status: r.some((x: any) => x.last_error) ? "failed" : "success", schedule: "On site visit (Google refresh max 1/day)", notes: r.map((x: any) => x.name).join(" · ") }; }
      if (t.key === "site_audit") { const a = audits.filter((x: any) => x.client_id === c.id); if (a.length) st = { status: a[0].status === "failed" ? "broken" : "live", last_run_at: a[0].run_at, last_status: a[0].status === "failed" ? "failed" : "success", schedule: "Manual / auto from Performance", notes: `${a.length} audits in 30 days · health ${a[0].health_score ?? "?"}` }; }
      if (t.key === "intel_audit") { const j = jobsFor("audit")[0]; if (j) st = { status: j.status === "cancelled" ? "paused" : "live", last_run_at: j.finished_at || null, last_status: j.status === "needs_approval" ? "needs_approval" : j.status === "approved" ? "success" : j.status === "failed" ? "failed" : "unknown", notes: `${j.title} (${j.status})` }; }
      if (t.key === "nova") st = { status: c.portal_enabled ? "live" : "paused", last_status: "unknown", schedule: "On portal visit", notes: c.portal_enabled ? "Portal enabled" : "Client portal not enabled for this client yet" };

      const tmplLive = st.status === "live";
      const rec = {
        key: `${t.key}:${c.id}`, name: t.name, scope: "client", client_id: c.id, client_name: c.business, template_key: t.key,
        department: t.department, role: t.role, kind: t.kind, status: st.status, schedule: st.schedule || "", external_id: st.external_id || "",
        owner_app: "Møthership", autonomy: tmplLive ? (t.autonomy_target === "autonomous" && t.kind !== "manual_skill" ? "autonomous" : "assisted") : "manual",
        autonomy_target: t.autonomy_target, approval_required: t.autonomy_target !== "autonomous", reports_to: `client_ceo:${c.id}`,
        reads_knowledge: t.reads, writes_knowledge: t.writes, replaces: t.replaces, kpis: t.kpis,
        last_run_at: st.last_run_at || null, last_status: st.last_status || "never", notes: st.notes || "",
        open_url: `/agents?view=clients&client=${c.id}`, synced_at: now, synced_by: by, sort: CLIENT_TEMPLATES.indexOf(t),
      };
      const old: any = existing.get(rec.key);
      if (!old) creates.push(rec);
      else {
        const keys = ["status", "last_run_at", "last_status", "schedule", "notes", "external_id", "autonomy", "client_name", "role", "department", "name"];
        // Never lose a status Justin or the registry sync set by hand on a live agent (broken flag wins until fixed).
        const changed = keys.some((k) => String(old[k] ?? "") !== String((rec as any)[k] ?? ""));
        if (changed) { await db.AgentRegistry.update(old.id, Object.fromEntries(keys.map((k) => [k, (rec as any)[k]]).concat([["synced_at", now], ["synced_by", by]]))); updated++; }
      }
    }
  }
  // The template definitions themselves (scope template), so scheduled tasks can read the standard set from the DB.
  for (const t of CLIENT_TEMPLATES) {
    const key = `template:${t.key}`;
    const liveN = creates.filter((r: any) => r.template_key === t.key && r.status === "live").length + registry.filter((r: any) => r.scope === "client" && r.template_key === t.key && r.status === "live" && !creates.some((c: any) => c.key === r.key)).length;
    const notes = `${liveN} live of ${clients.length} clients`;
    const old: any = registry.find((r: any) => r.key === key);
    const rec = { key, name: t.name, scope: "template", template_key: t.key, department: t.department, role: t.role, kind: t.kind, status: liveN ? "live" : "planned", autonomy_target: t.autonomy_target, approval_required: t.autonomy_target !== "autonomous", reads_knowledge: t.reads, writes_knowledge: t.writes, replaces: t.replaces, kpis: t.kpis, notes, synced_at: now, synced_by: by, sort: CLIENT_TEMPLATES.indexOf(t) };
    if (!old) creates.push(rec);
    else if (old.notes !== notes || old.status !== rec.status || old.role !== rec.role) { await db.AgentRegistry.update(old.id, { notes, status: rec.status, role: rec.role, synced_at: now, synced_by: by }); updated++; }
  }
  for (let i = 0; i < creates.length; i += 100) await db.AgentRegistry.bulkCreate(creates.slice(i, i + 100));
  return { clients: clients.length, created: creates.length, updated };
}

// ---------- brain refine ----------
const REFINE_SCHEMA = {
  type: "object",
  properties: {
    sections: { type: "array", items: { type: "object", properties: { key: { type: "string" }, text: { type: "string" }, confidence: { type: "string", enum: ["high", "medium", "low", "unknown"] }, sources: { type: "array", items: { type: "string" } }, change_note: { type: "string" } }, required: ["key", "text", "confidence", "change_note"] } },
    conflicts: { type: "array", items: { type: "object", properties: { section: { type: "string" }, current: { type: "string" }, incoming: { type: "string" }, update_id: { type: "string" }, why: { type: "string" } }, required: ["section", "current", "incoming", "why"] } },
    merged_ids: { type: "array", items: { type: "string" } },
    duplicate_ids: { type: "array", items: { type: "string" } },
    open_questions: { type: "array", items: { type: "object", properties: { q: { type: "string" }, section: { type: "string" } }, required: ["q", "section"] } },
    glance: { type: "string" },
  },
  required: ["sections", "conflicts", "merged_ids", "duplicate_ids", "open_questions", "glance"],
};

async function refineBrain(base44: any, db: any, brain: any, by = "justin", asService = false) {
  const sections = { ...(brain.sections || {}) };
  const pending = arr(brain.pending_updates).filter((u: any) => (u.status || "pending") === "pending");
  const name = brain.scope === "interstellar" ? "Interstellar Strategies (the agency itself)" : brain.client_name;
  const secText = BRAIN_SECTIONS.map((s) => { const x = sections[s.key] || {}; return `## ${s.key} (${s.label}) [by ${x.updated_by || "none"} · ${String(x.updated_at || "").slice(0, 10) || "never"} · confidence ${x.confidence || "unknown"}]\n${x.text || "unknown"}`; }).join("\n\n");
  const updText = pending.length ? pending.map((u: any) => `- id ${u.id} → section ${u.section} · by ${u.by || "agent"}${u.agent_key ? ` (${u.agent_key})` : ""} · ${String(u.added_at || "").slice(0, 10)} · source: ${u.source || "none given"}\n  ${u.text}`).join("\n") : "(none)";
  const system = [
    `You maintain the Business Brain for ${name}: the single knowledge base every agent reads. Interstellar Strategies (Justin Cowell) is the agency.`,
    "RULES: Use ONLY facts already in the brain or in the pending updates. Never invent names, numbers, prices, dates, reviews or results.",
    "Merge each pending update into its section (or a better-fitting section). Remove exact or near duplicates (list their ids in duplicate_ids).",
    "Contradictions: if an update contradicts a fact last set by justin, or a high-confidence fact, DO NOT overwrite: add a conflict (section, current, incoming, update_id, why) for Justin. Otherwise the newest SOURCED fact wins; unsourced updates never replace sourced facts (flag a conflict instead).",
    "Never store passwords, API keys or login secrets. Logins: only WHERE they live. Leave unknowns as the word unknown and add an open question.",
    "Return in `sections` ONLY sections you changed, with the FULL new text (markdown bullets are fine, keep every existing fact you did not deliberately replace), a confidence, sources (short labels) and a one-line change_note.",
    "Write `glance`: a one-screen 'Business at a glance' in markdown for Justin (max 170 words): what they are, what they sell, who buys, where things stand, top 3 problems, what's next. Facts only.",
  ].join("\n");
  const prompt = `CURRENT BRAIN\n${secText}\n\nPENDING UPDATES\n${updText}\n\nOPEN CONFLICTS ALREADY FLAGGED: ${arr(brain.conflicts).filter((c: any) => c.status === "open").length}`;
  const res: any = await llm(base44, { system, prompt, schema: REFINE_SCHEMA, tier: "long", feature: "agents.brain_refine", asService });
  const at = nowIso();
  const history = arr(brain.history);
  const changelog = arr(brain.changelog);
  const applied: string[] = [];
  for (const s of arr(res?.sections)) {
    if (!BRAIN_SECTION_KEYS.includes(s.key)) continue;
    const old = sections[s.key] || {};
    const text = scrub(String(s.text || "").trim());
    if (!text) continue;
    // Guard: a refine may never shrink Justin's own text by more than half.
    if (old.updated_by === "justin" && String(old.text || "").length > 0 && text.length < String(old.text).length * 0.5) continue;
    if (text === old.text) continue;
    history.unshift({ at, by: old.updated_by || "seed", section: s.key, text: old.text || "" });
    sections[s.key] = keepDesign(old, { text, sources: Array.from(new Set([...(old.sources || []), ...arr(s.sources)])).slice(0, 20), updated_at: at, updated_by: "refine", confidence: s.confidence || old.confidence || "medium" });
    changelog.unshift({ at, by: `refine (${by})`, section: s.key, change: cut(s.change_note || "Merged updates", 240) });
    applied.push(s.key);
  }
  const merged = new Set(arr(res?.merged_ids));
  const dup = new Set(arr(res?.duplicate_ids));
  const conflictIds = new Set(arr(res?.conflicts).map((c: any) => c.update_id).filter(Boolean));
  const pend = arr(brain.pending_updates).map((u: any) => ((u.status || "pending") !== "pending" ? u : conflictIds.has(u.id) ? { ...u, status: "conflict" } : dup.has(u.id) ? { ...u, status: "dismissed", note: "duplicate" } : merged.has(u.id) || applied.includes(u.section) ? { ...u, status: "merged", merged_at: at } : u));
  const conflicts = [...arr(res?.conflicts).map((c: any) => ({ id: uid(), ...c, flagged_at: at, status: "open" })), ...arr(brain.conflicts)].slice(0, 100);
  const oq = arr(brain.open_questions);
  const seen = new Set(oq.map((q: any) => `${q.section}|${String(q.q).toLowerCase()}`));
  for (const q of arr(res?.open_questions)) { const k = `${q.section}|${String(q.q).toLowerCase()}`; if (!seen.has(k)) { oq.push({ q: q.q, section: q.section, added_at: at, status: "open" }); seen.add(k); } }
  const patch = {
    sections, glance: scrub(String(res?.glance || brain.glance || "")), glance_at: at, completeness: brainCompleteness(sections),
    pending_updates: pend.slice(-200), conflicts, open_questions: oq.slice(-120), history: history.slice(0, 300),
    changelog: [{ at, by: `refine (${by})`, section: "*", change: `Refined: ${applied.length} section(s) updated, ${merged.size} merged, ${dup.size} duplicates, ${arr(res?.conflicts).length} conflicts flagged` }, ...changelog].slice(0, 300),
    last_refined_at: at, refined_by: by,
  };
  await db.BusinessBrain.update(brain.id, patch);
  return { brain_id: brain.id, client: brain.client_name || "Interstellar", updated_sections: applied, merged: merged.size, duplicates: dup.size, conflicts: arr(res?.conflicts).length, completeness: patch.completeness };
}

// ---------- CEO context ----------
const regLine = (r: any) => [r.key, r.name, r.department, r.client_name || "", r.status, r.kind, r.schedule || "", r.last_run_at ? String(r.last_run_at).slice(0, 16) : "never", r.last_status || "", r.autonomy || "", r.approval_required ? "approval" : "", cut(r.notes, 90)].join(" | ");

async function ceoContext(db: any, scope: string, clientId?: string) {
  const since14 = new Date(Date.now() - 14 * DAY).toISOString();
  const [registry, runs, learnings, notes, briefs, jobs, tasks, brains, gaps, adRecs, intel] = await Promise.all([
    list(db.AgentRegistry, clientId ? { client_id: clientId } : {}, "sort", 2000),
    list(db.AutomationRun, clientId ? { client_id: clientId, started_at: { $gte: since14 } } : { started_at: { $gte: since14 } }, "-started_at", 80),
    list(db.AgentLearning, clientId ? { client_id: clientId } : {}, "-created_date", 40),
    list(db.ResearchNote, clientId ? { client_id: clientId } : {}, "-created_date", 30),
    list(db.CeoBrief, clientId ? { client_id: clientId } : { scope: "interstellar" }, "-generated_at", 3),
    list(db.ClaudeJob, { status: { $in: ["needs_approval", "failed", "queued", "running", "changes_requested"] } }, "-created_date", 80),
    list(db.Task, { status: { $in: ["inbox", "next", "doing", "blocked"] } }, "due_date", 300),
    list(db.BusinessBrain, clientId ? { client_id: clientId } : {}, "-updated_date", 300),
    list(db.ClientGap, clientId ? { client_id: clientId, status: "open" } : { status: "open" }, "-created_date", 300),
    list(db.AdRecommendation, { status: "proposed" }, "-created_date", 50),
    list(db.SeoIntel, { kind: "action", status: "proposed" }, "-brief_date", 30),
  ]);
  const myJobs = clientId ? jobs.filter((j: any) => j.client_id === clientId) : jobs;
  const agentTasks = tasks.filter((t: any) => (clientId ? t.client_id === clientId : true) && (t.source === "automation" || t.source === "ai" || arr(t.labels).some((l: string) => /agent|approval|research/i.test(l))));
  const parts: string[] = [];
  parts.push(`TODAY (Pacific): ${pacificDay()}`);
  if (clientId) {
    const b = brains[0];
    parts.push(`CLIENT BRAIN for ${b?.client_name || clientId} (completeness ${b?.completeness ?? 0}%):\n${b ? BRAIN_SECTIONS.map((s) => `## ${s.label}\n${cut(b.sections?.[s.key]?.text || "unknown", 1500)}`).join("\n") : "(no brain yet)"}`);
    // Shared client context (goals + targets, offers, audience, voice, SEO footprint), the same block every engine reads.
    const cc = await getClientContext(db, clientId).catch(() => "");
    if (cc) parts.push(`CLIENT CONTEXT (goals, criteria, offers, audience, SEO footprint, Constellations dots):\n${cc}`);
    if (b) parts.push(`BRAIN open questions: ${arr(b.open_questions).filter((q: any) => q.status !== "answered").map((q: any) => q.q).slice(0, 12).join(" / ") || "none"}\nBRAIN open conflicts: ${arr(b.conflicts).filter((c: any) => c.status === "open").map((c: any) => `${c.section}: ${cut(c.why, 120)}`).join(" / ") || "none"}`);
  } else {
    const ib = brains.find((x: any) => x.scope === "interstellar");
    if (ib?.glance) parts.push(`INTERSTELLAR AT A GLANCE:\n${ib.glance}`);
    const icc = await getClientContext(db, "agency").catch(() => "");
    if (icc) parts.push(`INTERSTELLAR CONTEXT (the agency's own goals, offers, audience, SEO footprint):\n${icc}`);
    if (ib?.constellation?.health_score != null) parts.push(`INTERSTELLAR CONSTELLATIONS: health ${ib.constellation.health_score} · weakest pillar ${ib.constellation.constraint || "?"} · pillars ${JSON.stringify(ib.constellation.pillar_scores || {})}`);
    const byClient: Record<string, any> = {};
    for (const r of registry.filter((x: any) => x.scope === "client")) {
      const k = r.client_name || r.client_id;
      byClient[k] = byClient[k] || { live: 0, paused: 0, planned: 0, broken: 0, id: r.client_id };
      byClient[k][r.status] = (byClient[k][r.status] || 0) + 1;
    }
    parts.push(`CLIENTS (agent instances live/paused/planned/broken · brain % · open gaps · jobs waiting on Justin):\n${Object.entries(byClient).map(([n, v]: any) => {
      const b = brains.find((x: any) => x.client_id === v.id);
      return `- ${n}: ${v.live}/${v.paused}/${v.planned}/${v.broken} · brain ${b?.completeness ?? 0}% (${arr(b?.conflicts).filter((c: any) => c.status === "open").length} conflicts, ${arr(b?.pending_updates).filter((u: any) => (u.status || "pending") === "pending").length} pending) · gaps ${gaps.filter((g: any) => g.client_id === v.id).length} · waiting ${jobs.filter((j: any) => j.client_id === v.id && j.status === "needs_approval").length}`;
    }).join("\n")}`);
  }
  const regRows = clientId ? registry : registry.filter((r: any) => r.scope === "interstellar");
  parts.push(`AGENT REGISTRY (key | name | dept | client | status | kind | schedule | last run UTC | last status | autonomy | approval | notes):\n${regRows.map(regLine).join("\n")}`);
  parts.push(`RUNS LOGGED, LAST 14 DAYS (AutomationRun):\n${runs.map((r: any) => `- ${String(r.started_at || r.created_date).slice(0, 16)} ${r.automation_name || r.kind || ""} · ${r.client_name || ""} · ${r.status}${r.title ? ` · ${cut(r.title, 80)}` : ""}${r.message ? ` · ${cut(r.message, 100)}` : ""}`).join("\n") || "none"}`);
  parts.push(`CLAUDE QUEUE JOBS NOT FINISHED (needs_approval = waiting on Justin):\n${myJobs.map((j: any) => `- [${j.status}] ${cut(j.title, 100)}${j.client_name ? ` · ${j.client_name}` : ""}${j.needs_from_justin ? ` · needs: ${cut(j.needs_from_justin, 100)}` : ""}`).join("\n") || "none"}`);
  parts.push(`OPEN AGENT / APPROVAL TASKS (Command Briefing):\n${agentTasks.slice(0, 30).map((t: any) => `- ${t.title}${t.due_date ? ` (due ${String(t.due_date).slice(0, 10)})` : ""}${t.client_name ? ` · ${t.client_name}` : ""}`).join("\n") || "none"}`);
  if (!clientId) parts.push(`OTHER APPROVALS: ${adRecs.length} ad recommendations proposed; ${intel.length} Search Intel actions proposed (${intel.slice(0, 5).map((i: any) => `${i.action_id}: ${cut(i.title, 60)}`).join("; ")}).`);
  parts.push(`AGENT LEARNINGS (newest first):\n${learnings.map((l: any) => `- ${l.date || String(l.created_date).slice(0, 10)} [${l.status || "proposed"}] ${l.agent_key || ""}${l.client_name ? ` · ${l.client_name}` : ""}: ${cut(l.learning, 200)}${l.proposed_change ? ` → proposes: ${cut(l.proposed_change, 140)}` : ""}`).join("\n") || "none yet"}`);
  parts.push(`RESEARCH NOTES (newest first):\n${notes.map((n: any) => `- ${String(n.created_at || n.created_date).slice(0, 10)} [${n.relevance || "?"}] ${n.department || ""}${n.client_name ? ` · ${n.client_name}` : ""}: ${n.topic} — ${cut(n.summary, 220)} (for: ${arr(n.for_agents).join(", ")}; sources: ${arr(n.sources).map((s: any) => s.url).slice(0, 2).join(" ")})`).join("\n") || "none yet"}`);
  if (!clientId) {
    // Road to Dec 31 (/launch): launch progress from LaunchItem, so the daily brief reports it.
    const launch = await list(db.LaunchItem, {}, "priority", 1000);
    if (launch.length) {
      const gaps = launch.filter((i: any) => (i.lane || "launch") === "launch" && (i.kind || "gap") === "gap" && i.status !== "deferred");
      const w = (i: any) => Math.max(0.5, Number(i.effort_hours) || 1);
      const tot = gaps.reduce((n: number, i: any) => n + w(i), 0) || 1;
      const open = gaps.filter((i: any) => i.status !== "done");
      const days = Math.max(0, Math.ceil((new Date("2026-12-31T23:59:59-08:00").getTime() - Date.now()) / DAY));
      const moves = open.filter((i: any) => i.owner === "justin").sort((a: any, b: any) => (Number(b.unblocks) || 0) - (Number(a.unblocks) || 0)).slice(0, 5);
      const doneRecent = gaps.filter((i: any) => i.status === "done" && i.done_at && Date.now() - new Date(i.done_at).getTime() < 2 * DAY);
      parts.push(`ROAD TO DEC 31 (LaunchItem, /launch): ${days} days left · ${Math.round((gaps.filter((i: any) => i.status === "done").reduce((n: number, i: any) => n + w(i), 0) / tot) * 100)}% done · ${open.length} open (${open.filter((i: any) => i.blocking_launch).length} blocking; Justin ${moves.length ? open.filter((i: any) => i.owner === "justin").length : 0}, Claude ${open.filter((i: any) => i.owner === "claude").length}, client ${open.filter((i: any) => i.owner === "client").length}) · questions unanswered ${launch.filter((i: any) => i.kind === "question" && !i.answer).length}\nDone in the last 2 days: ${doneRecent.map((i: any) => i.title).slice(0, 8).join("; ") || "none"}\nJustin's top moves: ${moves.map((i: any) => `${i.title} (unblocks ${i.unblocks || 0})`).join("; ") || "none"}`);
    }
    // Future Oracle (research agent on /intelligence): its latest brief's top changes and opportunities, if the entity exists.
    const oracle = await list(db.OracleBrief, {}, "-created_date", 1);
    if (oracle[0]) {
      const o: any = { ...oracle[0] };
      ["id", "created_by", "created_by_id", "updated_date", "is_sample"].forEach((k) => delete o[k]);
      parts.push(`FUTURE ORACLE — LATEST BRIEF (research agent, see /intelligence; include its top changes and opportunities when briefing):\n${cut(flat(o), 2500)}`);
    }
  }
  parts.push(`RECENT CEO BRIEFS:\n${briefs.map((b: any) => `- ${b.date} ${b.headline || ""}: ${cut(b.summary, 300)}`).join("\n") || "none yet"}`);
  return parts.join("\n\n");
}

const CEO_SYSTEM = (who: string) => [
  `You are ${who}, the CEO agent of Justin Cowell's agent constellation at Interstellar Strategies. You report to Justin about what the other agents are doing: status, wins, failures, what needs his approval, and what to build next.`,
  "Answer ONLY from the CONTEXT records. If the records don't show something, say you don't have it on record. Never invent runs, numbers, clients or results. A generated blog package is not a published post.",
  "Be brief and direct, like an operator: short sections, bullets, no filler, no emoji. Name agents exactly as in the registry. When something needs Justin, say where to act (Claude Queue at /claude, Tasks at /tasks, Ads Studio at /ads, Agents at /agents).",
  "Approvals: nothing client-facing is ever sent by an agent; you can only recommend. For 'what should we build next', use planned agents' build_order and priority plus what is broken or failing.",
].join("\n");

// ---------- CEO brief (in-app) ----------
const BRIEF_SCHEMA = { type: "object", properties: { headline: { type: "string" }, summary: { type: "string" }, wins: { type: "array", items: { type: "string" } }, failures: { type: "array", items: { type: "string" } }, needs_approval: { type: "array", items: { type: "string" } }, recommendations: { type: "array", items: { type: "string" } }, clients_attention: { type: "array", items: { type: "string" } } }, required: ["headline", "summary", "wins", "failures", "needs_approval", "recommendations", "clients_attention"] };

async function makeBrief(base44: any, db: any, clientId?: string, asService = false) {
  const ctx = await ceoContext(db, clientId ? "client" : "interstellar", clientId);
  const reg = await list(db.AgentRegistry, clientId ? { client_id: clientId } : {}, "sort", 2000);
  const count = (s: string, scope?: string) => reg.filter((r: any) => r.status === s && (!scope || r.scope === scope)).length;
  const stats = { live: count("live", clientId ? undefined : "interstellar"), paused: count("paused", clientId ? undefined : "interstellar"), planned: count("planned", clientId ? undefined : "interstellar"), broken: count("broken", clientId ? undefined : "interstellar"), client_instances: clientId ? undefined : reg.filter((r: any) => r.scope === "client").length };
  const res: any = await llm(base44, { system: CEO_SYSTEM("Commander") + "\nWrite today's CEO brief. Each list item one line. clients_attention: clients needing Justin and why (Interstellar brief only). If a FUTURE ORACLE brief is in the context, put its top change in `summary` and its best opportunity in `recommendations` (say it came from the Future Oracle). If ROAD TO DEC 31 is in the context, start `summary` with the launch line (days left, % done, blocking count) and put Justin's single top launch move first in `needs_approval` (act at /launch).", prompt: ctx, schema: BRIEF_SCHEMA, tier: "long", feature: "agents.ceo_brief", asService });
  const day = pacificDay();
  const client = clientId ? (await list(db.CRMClient, { id: clientId }, "business", 1))[0] : null;
  const rec = { date: day, scope: clientId ? "client" : "interstellar", client_id: clientId || "", client_name: client?.business || "", headline: cut(res?.headline, 160), summary: String(res?.summary || ""), wins: arr(res?.wins), failures: arr(res?.failures), needs_approval: arr(res?.needs_approval), recommendations: arr(res?.recommendations), clients_attention: arr(res?.clients_attention), stats, generated_by: "in_app", generated_at: nowIso() };
  const existing = (await list(db.CeoBrief, clientId ? { date: day, client_id: clientId, generated_by: "in_app" } : { date: day, scope: "interstellar", generated_by: "in_app" }, "-generated_at", 1))[0];
  if (existing) { await db.CeoBrief.update(existing.id, rec); return { ...existing, ...rec }; }
  return await db.CeoBrief.create(rec);
}

// ---------- handler ----------
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const db = base44.asServiceRole.entities;

    if (!user) {
      if (action !== "nightly") return Response.json({ error: "Unauthorized" }, { status: 401 });
    } else if (user.role !== "admin") {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }
    const who = user ? "justin" : "nightly";

    if (action === "nightly") {
      // Throttle the unauthenticated path: one completed run per 8 hours, and never two at once
      // (a run that crashed can be retried after 10 minutes).
      let flag = (await list(db.AppSettings, { key: "agents_nightly" }, "-updated_date", 1))[0];
      const ps = flag?.pageSettings || {};
      const doneAgo = ps.done_at ? Date.now() - new Date(ps.done_at).getTime() : Infinity;
      const startAgo = ps.started_at ? Date.now() - new Date(ps.started_at).getTime() : Infinity;
      if (!user && (doneAgo < 8 * 3600 * 1000 || startAgo < 10 * 60 * 1000)) return Response.json({ skipped: true, reason: "ran recently", ...ps });
      const mark = { key: "agents_nightly", pageSettings: { ...ps, started_at: nowIso() } };
      if (flag) await db.AppSettings.update(flag.id, mark); else flag = await db.AppSettings.create(mark);
      const seeded = await seedBrains(db);
      await brandHygiene(db).catch(() => 0);
      const sync = await syncClients(db, who === "justin" ? "in_app" : "nightly");
      const brains = await list(db.BusinessBrain, {}, "last_refined_at", 300);
      const due = brains
        .filter((b: any) => arr(b.pending_updates).some((u: any) => (u.status || "pending") === "pending") || !b.last_refined_at || Date.now() - new Date(b.last_refined_at).getTime() > 7 * DAY)
        .sort((a: any, b: any) => arr(b.pending_updates).filter((u: any) => (u.status || "pending") === "pending").length - arr(a.pending_updates).filter((u: any) => (u.status || "pending") === "pending").length)
        .slice(0, Number(body?.max_refine) || 5);
      const refined = await Promise.all(due.map((b: any) => refineBrain(base44, db, b, who, !user).catch((e) => ({ brain_id: b.id, error: String(e?.message || e) }))));
      // Backup CEO brief so Commander always has today's facts even if the Claude registry sync didn't run.
      let brief: any = null;
      if (body?.brief !== false) brief = await makeBrief(base44, db, undefined, !user).then((b: any) => ({ id: b?.id, headline: b?.headline })).catch((e) => ({ error: String(e?.message || e) }));
      await db.AutomationRun.create({ automation_name: "Agents — nightly brain refresh", kind: "other", status: refined.some((r: any) => r.error) || brief?.error ? "failed" : "success", message: `Brains seeded/checked ${seeded.length}, instances +${sync.created}/~${sync.updated}, refined ${refined.length}${brief?.error ? `, brief failed: ${cut(brief.error, 120)}` : ", brief written"}`, started_at: nowIso(), finished_at: nowIso(), processed: true }).catch(() => null);
      if (flag?.id) await db.AppSettings.update(flag.id, { pageSettings: { ...mark.pageSettings, done_at: nowIso(), last: { seeded: seeded.length, created: sync.created, updated: sync.updated, refined: refined.length } } }).catch(() => null);
      return Response.json({ seeded, sync, refined, brief });
    }

    if (action === "ceo_chat") {
      const clientId = body?.scope === "client" ? String(body?.client_id || "") : "";
      const msgs = arr(body?.messages).slice(-16).map((m: any) => ({ role: m?.role === "assistant" ? "assistant" : "user", content: cut(m?.content, 4000) })).filter((m: any) => m.content);
      if (!msgs.length) return Response.json({ error: "Ask something first" }, { status: 400 });
      const ctx = await ceoContext(db, clientId ? "client" : "interstellar", clientId || undefined);
      const whoName = clientId ? `the Client CEO for ${String(body?.client_name || "this client")}` : String(body?.ceo_name || "Commander");
      const convo = msgs.map((m: any) => `${m.role === "assistant" ? "YOU" : "JUSTIN"}: ${m.content}`).join("\n\n");
      const text = await llm(base44, { system: CEO_SYSTEM(whoName) + (clientId ? "\nYou only know this one client. Never mention or use another client's data." : ""), prompt: `CONTEXT\n${ctx}\n\nCONVERSATION\n${convo}\n\nReply to Justin's last message.`, tier: "long", feature: clientId ? "agents.client_ceo" : "agents.ceo_chat" });
      // Keep the conversation server-side so it follows Justin across devices (last 40 messages per CEO).
      const chatKey = `agents_chat:${clientId || "hq"}`;
      const row = (await list(db.AppSettings, { key: chatKey }, "-updated_date", 1))[0];
      const saved = { key: chatKey, pageSettings: { messages: [...msgs, { role: "assistant", content: text, at: nowIso() }].slice(-40), updated_at: nowIso() } };
      if (row) await db.AppSettings.update(row.id, saved).catch(() => null); else await db.AppSettings.create(saved).catch(() => null);
      return Response.json({ text });
    }

    if (action === "ceo_brief") return Response.json({ brief: await makeBrief(base44, db, body?.client_id || undefined) });
    if (action === "brain_seed") return Response.json({ seeded: await seedBrains(db, body?.client_id || undefined) });
    if (action === "sync_clients") return Response.json(await syncClients(db, "in_app"));

    if (action.startsWith("brain_")) {
      const brain = (await list(db.BusinessBrain, { id: String(body?.brain_id || "") }, "-updated_date", 1))[0];
      if (!brain) return Response.json({ error: "Brain not found" }, { status: 404 });
      const at = nowIso();
      if (action === "brain_refine") return Response.json(await refineBrain(base44, db, brain, who));
      if (action === "brain_edit") {
        const key = String(body?.section || "");
        if (!BRAIN_SECTION_KEYS.includes(key)) return Response.json({ error: "Unknown section" }, { status: 400 });
        const text = scrub(String(body?.text || "").trim()).slice(0, 20000);
        const old = (brain.sections || {})[key] || {};
        const sections = { ...(brain.sections || {}), [key]: keepDesign(old, { text: text || "unknown", sources: Array.from(new Set([...(old.sources || []), "Justin"])), updated_at: at, updated_by: "justin", confidence: text ? (body?.confidence || "high") : "unknown" }) };
        const oq = arr(brain.open_questions).map((q: any) => (q.section === key && text && q.status === "open" ? { ...q, status: "answered", answered_at: at } : q));
        await db.BusinessBrain.update(brain.id, { sections, completeness: brainCompleteness(sections), open_questions: oq, history: [{ at, by: old.updated_by || "seed", section: key, text: old.text || "" }, ...arr(brain.history)].slice(0, 300), changelog: [{ at, by: "justin", section: key, change: "Edited by Justin" }, ...arr(brain.changelog)].slice(0, 300) });
        return Response.json({ ok: true, completeness: brainCompleteness(sections) });
      }
      if (action === "brain_add_update") {
        const key = String(body?.section || "");
        if (!BRAIN_SECTION_KEYS.includes(key) || !String(body?.text || "").trim()) return Response.json({ error: "Section and text required" }, { status: 400 });
        const u = { id: uid(), section: key, text: scrub(cut(body.text, 4000)), source: cut(body?.source || "", 300), by: ["agent", "research", "justin"].includes(body?.by) ? body.by : "justin", agent_key: cut(body?.agent_key || "", 120), added_at: at, status: "pending" };
        await db.BusinessBrain.update(brain.id, { pending_updates: [...arr(brain.pending_updates), u].slice(-200), changelog: [{ at, by: u.by, section: key, change: `Proposed update queued: ${cut(u.text, 120)}` }, ...arr(brain.changelog)].slice(0, 300) });
        return Response.json({ ok: true, update: u });
      }
      if (action === "brain_resolve") {
        const c = arr(brain.conflicts).find((x: any) => x.id === body?.conflict_id);
        if (!c) return Response.json({ error: "Conflict not found" }, { status: 404 });
        const resolution = String(body?.resolution || "keep");
        const conflicts = arr(brain.conflicts).map((x: any) => (x.id === c.id ? { ...x, status: "resolved", resolution, resolved_at: at } : x));
        const patch: any = { conflicts, changelog: [{ at, by: "justin", section: c.section, change: `Conflict resolved: ${resolution}` }, ...arr(brain.changelog)].slice(0, 300) };
        if (resolution === "incoming" && c.update_id) {
          patch.pending_updates = arr(brain.pending_updates).map((u: any) => (u.id === c.update_id ? { ...u, status: "pending", source: `${u.source || ""} (approved by Justin over conflict)`, by: "justin" } : u));
        }
        await db.BusinessBrain.update(brain.id, patch);
        return Response.json({ ok: true });
      }
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("agents", (e as Error)?.message);
    return Response.json({ error: (e as Error)?.message || "Agents request failed" }, { status: 500 });
  }
});
