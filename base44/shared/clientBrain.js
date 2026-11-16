// Client-app Business Brain → Møthership (docs/client-brain-sync.md).
// A client's own app (Palm Shore Ops first; any app that sends the same payload later) asks the owner questions and
// stores his answers as BrainFacts in that app. Each change is pushed to Møthership's client-brain function
// (action "ingest"), which keeps them here as client-tagged BrainFacts (source "client_app") and records the app's
// answered/total counts on ClientDossier.client_brain, which counts toward the client's health score
// (src/features/constellations/pillars.js blendHealth).
//
// Pure logic only (no Deno, no SDK): used by base44/functions/client-brain, base44/shared/clientContext.ts and the
// unit tests (tests/unit/clientBrain.test.js). Never stores credentials: answers are scrubbed before they are kept.

export const SOURCE = "client_app";

// Client-app business area → Møthership Brain pillar (BrainFact.pillar enum).
export const AREA_PILLAR = {
  materials: "delivery", // suppliers, product lines, waste, delivery
  labor: "delivery", // crew rates, production rates
  scheduling: "delivery", // crews, weather
  pricing: "finance", // unit prices
  terms: "finance", // deposits, margin, warranty, payment
  wording: "sales", // how estimates read
  leads: "sales", // lead sources, response time, site visits
  builders: "clients", // builder / trade partner workflow
  comms: "marketing", // tone, review timing
  approvals: "systems", // what the app may do on its own
  other: "clients",
};
export const pillarFor = (area) => AREA_PILLAR[String(area || "").toLowerCase()] || "clients";

const s = (v) => (v == null ? "" : String(v));
const cut = (v, n) => { const t = s(v).trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const SECRET_RE = /(password|passcode|pwd|api[_ -]?key|secret|token)\s*[:=]\s*\S+/gi;
export const scrub = (v) => s(v).replace(SECRET_RE, "[removed]").replace(/®/g, "™");
const isoOrEmpty = (v) => { if (!v) return ""; const d = new Date(v); return Number.isNaN(d.getTime()) ? "" : d.toISOString(); };

// Namespaced so client-app keys never collide with Møthership's own Teach-the-Brain question keys.
export const nsKey = (appId, f) => `client:${s(appId)}:${s(f.question_key) || `fact.${s(f.source_fact_id)}`}`;

// Validate one incoming fact (payload contract in docs/client-brain-sync.md). Returns an error string or "".
export function factError(f) {
  if (!f || typeof f !== "object") return "fact is not an object";
  if (!s(f.source_fact_id).trim()) return "source_fact_id is required";
  if (!s(f.answer).trim()) return "answer is required";
  if (f.status && !["active", "superseded"].includes(f.status)) return `status must be active or superseded (got ${f.status})`;
  return "";
}

// Payload fact → Møthership BrainFact fields.
export function mapFact(f, ctx) {
  const answer = scrub(f.answer).trim();
  const answeredAt = isoOrEmpty(f.answered_at) || ctx.now;
  return {
    pillar: pillarFor(f.area),
    statement: cut(answer, 1000),
    raw_text: cut(answer, 4000), // also keeps Command "reclean" from rewriting the owner's words
    question: cut(scrub(f.question), 400),
    question_key: nsKey(ctx.app_id, f),
    source: SOURCE,
    confidence: "high",
    date: answeredAt.slice(0, 10),
    status: f.status === "superseded" ? "superseded" : "active",
    client_id: s(ctx.client_id),
    client_name: cut(ctx.client_name, 120),
    source_app_id: s(ctx.app_id),
    source_app_name: cut(ctx.app_name, 120),
    source_fact_id: s(f.source_fact_id),
    source_question_key: cut(f.question_key, 120),
    area: cut(s(f.area || "other").toLowerCase(), 40),
    capture_source: cut(scrub(f.source), 200),
    captured_by_name: cut(f.captured_by_name, 120),
    answered_at: answeredAt,
    data: { question_id: s(f.question_id), ...(f.test ? { test: true } : {}) },
  };
}

// Fields compared to decide whether an existing row needs an update (synced_at is bookkeeping, not content).
const CONTENT = ["pillar", "statement", "raw_text", "question", "question_key", "status", "client_id", "client_name", "source_app_name", "source_question_key", "area", "capture_source", "captured_by_name", "answered_at"];
const changed = (row, rec) => CONTENT.some((k) => s(row[k]) !== s(rec[k])) || JSON.stringify(row.data || {}) !== JSON.stringify(rec.data || {});

// Idempotent upsert plan.
//   existing: Møthership BrainFacts already stored for this client app (source_app_id = app_id).
//   incoming: payload facts (already validated).
//   mode "full": the payload is the app's complete fact list, so active rows it no longer contains are superseded
//                (soft: nothing is ever deleted).
// Rules: one row per (app_id, source_fact_id), updated in place when its content changes; at most one active row per
// (app_id, question key), the newest answer wins and older ones become superseded (history is kept).
export function planUpsert(existing, incoming, ctx, mode = "delta") {
  const rows = Array.isArray(existing) ? existing : [];
  const byFact = new Map(rows.map((r) => [s(r.source_fact_id), r]));
  const recs = new Map();
  for (const f of incoming || []) recs.set(s(f.source_fact_id), mapFact(f, ctx)); // last one wins for a repeated id

  // Newest active answer per question key wins (free-form facts have their own key per fact). Candidates: the
  // incoming active facts and, on a delta push, stored active rows the payload doesn't mention.
  const winner = new Map(); // question_key -> { id, at }
  const consider = (key, id, at) => { const w = winner.get(key); if (!w || at > w.at) winner.set(key, { id, at }); };
  for (const [id, r] of recs) if (r.status === "active") consider(r.question_key, id, r.answered_at);
  if (mode !== "full") for (const r of rows) if (r.status === "active" && !recs.has(s(r.source_fact_id))) consider(s(r.question_key), `row:${s(r.source_fact_id)}`, s(r.answered_at));
  for (const [id, r] of recs) if (r.status === "active" && winner.get(r.question_key).id !== id) r.status = "superseded";

  const creates = [];
  const updates = [];
  let unchanged = 0;
  for (const [id, rec] of recs) {
    const row = byFact.get(id);
    if (!row) creates.push({ ...rec, synced_at: ctx.now });
    else if (changed(row, rec)) updates.push({ id: row.id, patch: { ...rec, synced_at: ctx.now } });
    else unchanged++;
  }
  // Stored active rows that lost to a newer answer, or (full sync) that the app no longer has.
  for (const r of rows) {
    if (r.status !== "active" || recs.has(s(r.source_fact_id))) continue;
    const key = s(r.question_key);
    const lost = winner.has(key) && winner.get(key).id !== `row:${s(r.source_fact_id)}`;
    if (lost || mode === "full") updates.push({ id: r.id, patch: { status: "superseded", synced_at: ctx.now } });
  }
  return { creates, updates, unchanged, superseded: updates.filter((u) => u.patch.status === "superseded").length + creates.filter((c) => c.status === "superseded").length };
}

// Normalize the app's question counts. Skipped questions are not part of the total.
export function normalizeStats(st) {
  const n = (v) => Math.max(0, Math.floor(Number(v) || 0));
  const answered = n(st && st.answered), open = n(st && st.open), skipped = n(st && st.skipped);
  let total = n(st && st.total);
  if (!total) total = answered + open;
  return { total: Math.max(total, answered), answered, open, skipped };
}

// Merge one app's counts into ClientDossier.client_brain (summed across the client's apps).
export function mergeClientBrain(prev, appId, appName, stats, extra = {}) {
  const apps = { ...((prev && prev.apps) || {}) };
  apps[appId] = { ...(apps[appId] || {}), app_name: appName || (apps[appId] && apps[appId].app_name) || "", ...normalizeStats(stats), ...extra };
  const sum = (k) => Object.values(apps).reduce((t, a) => t + (Number(a[k]) || 0), 0);
  return { total: sum("total"), answered: sum("answered"), open: sum("open"), skipped: sum("skipped"), facts_active: sum("facts_active"), synced_at: extra.synced_at || new Date().toISOString(), apps };
}

// ---------------------------------------------------------------- reading it back (agents, context block, UI)

// Everything Møthership holds from a client's own app Business Brain: counts plus the active facts, newest first.
// db = base44.asServiceRole.entities (backend) or base44.entities (admin frontend).
export async function getClientBrain(db, clientId, opts = {}) {
  if (!clientId || clientId === "agency") return { stats: null, facts: [] };
  const rows = (v) => (Array.isArray(v) ? v : (v && v.items) || []);
  const [facts, dossier] = await Promise.all([
    Promise.resolve(db.BrainFact.filter({ client_id: clientId, source: SOURCE, status: "active" }, "-answered_at", opts.limit || 200)).then(rows).catch(() => []),
    Promise.resolve(db.ClientDossier.filter({ client_id: clientId }, "-updated_date", 1)).then(rows).then((r) => r[0] || null).catch(() => null),
  ]);
  return { stats: (dossier && dossier.client_brain) || null, facts: facts.filter((f) => !(f.data && f.data.test)) };
}

// Markdown lines for the shared client context block (agents drafting estimates, posts and emails read it).
export function clientBrainLines(brain, maxChars = 3000) {
  const st = brain && brain.stats;
  const facts = (brain && brain.facts) || [];
  if (!st && !facts.length) return [];
  const L = ["", "### The owner's own answers (Business Brain in their app)"];
  if (st && st.total) L.push(`- ${st.answered}/${st.total} questions answered${st.synced_at ? ` (synced ${String(st.synced_at).slice(0, 10)})` : ""}. Follow these over anything generic.`);
  const byArea = {};
  for (const f of facts) (byArea[f.area || "other"] ||= []).push(f);
  let used = L.join("\n").length;
  for (const [area, list] of Object.entries(byArea)) {
    const head = `- ${area[0].toUpperCase()}${area.slice(1)}:`;
    if (used + head.length > maxChars) break;
    L.push(head); used += head.length + 1;
    for (const f of list) {
      const line = `  - ${f.question ? `${cut(f.question, 140)} → ` : ""}${cut(f.statement, 360)}`;
      if (used + line.length > maxChars) { L.push("  - …"); return L; }
      L.push(line); used += line.length + 1;
    }
  }
  return L;
}
