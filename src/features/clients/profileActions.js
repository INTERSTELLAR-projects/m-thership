// Writes for the Client Criteria meter: inline edits, the "send intake for missing fields" request
// (same RequestForm → portal → ClientRequest mechanism as the flight-plan combined intake), and
// applying the client's answers. Every write goes to the entity/field criteria.js names. Existing
// values are never overwritten here except by an explicit inline save or an accepted enrichment.
import { base44 } from "@/api/base44Client";
import { fieldByKey, intakeFormFields } from "@/features/flight/onboarding/catalog";
import { CRITERIA, criterionByKey, has } from "./criteria";

export const PROFILE_FORM_TARGET = "Client profile (Møthership)";
const today = () => new Date().toLocaleDateString("en-CA");
const arr = (r) => (Array.isArray(r) ? r : (r && r.items) || []);

// Text → list items. One per line (or ';'); a single line is split on commas.
export function parseList(value) {
  if (Array.isArray(value)) return value.map((v) => (typeof v === "string" ? v.trim() : v)).filter((v) => has(v));
  const s = String(value || "").trim();
  if (!s) return [];
  const parts = /[\n;]/.test(s) ? s.split(/[\n;]+/) : s.split(",");
  return parts.map((x) => x.replace(/^\s*[-*•]\s*/, "").trim()).filter(Boolean);
}

function cityItem(s) {
  if (typeof s === "object") return s;
  const m = String(s).match(/^(.*?),\s*([A-Za-z]{2})$/);
  return m ? { city: m[1].trim(), state: m[2].toUpperCase() } : { city: String(s).trim() };
}

function setPath(obj, path, value) {
  const keys = path.split(".");
  const root = { ...(obj || {}) };
  let cur = root;
  keys.slice(0, -1).forEach((k) => {
    cur[k] = { ...(cur[k] && typeof cur[k] === "object" ? cur[k] : {}) };
    cur = cur[k];
  });
  cur[keys[keys.length - 1]] = value;
  return root;
}
const getPath = (obj, path) => path.split(".").reduce((o, k) => (o && typeof o === "object" ? o[k] : undefined), obj);

async function upsertIntakeAnswer(ctx, field, value) {
  const client = ctx.client;
  const rows = arr(await base44.entities.IntakeAudit.filter({ client_id: client.id }, "-created_date", 1).catch(() => []));
  const latest = rows[0];
  if (!latest) return base44.entities.IntakeAudit.create({ client_id: client.id, business_name: client.business, status: "in_progress", answers: { [field]: value } });
  return base44.entities.IntakeAudit.update(latest.id, { answers: { ...(latest.answers || {}), [field]: value } });
}

async function upsertDossier(ctx, path, value, listKind) {
  const client = ctx.client;
  const rows = arr(await base44.entities.ClientDossier.filter({ client_id: client.id }, "-updated_date", 1).catch(() => []));
  const d = rows[0] || null;
  let next = value;
  if (listKind) {
    const items = parseList(value);
    const existing = Array.isArray(getPath(d || {}, path)) ? getPath(d, path) : [];
    if (listKind === true) {
      next = [...new Set([...existing.map(String), ...items.map(String)])];
    } else {
      const mk = listKind === "city" ? cityItem : (x) => (typeof x === "object" ? x : { [listKind]: String(x) });
      const keyOf = (x) => String((x && (x[listKind] || x.name)) || "").toLowerCase();
      const seen = new Set(existing.map(keyOf));
      next = [...existing, ...items.map(mk).filter((x) => { const k = keyOf(x); if (!k || seen.has(k)) return false; seen.add(k); return true; })];
    }
  }
  if (!d) return base44.entities.ClientDossier.create(setPath({ client_id: client.id, client_name: client.business }, path, next));
  const top = path.split(".")[0];
  const merged = setPath({ [top]: d[top] }, path, next);
  return base44.entities.ClientDossier.update(d.id, { [top]: merged[top] });
}

async function upsertOutreach(ctx, field, value) {
  const client = ctx.client;
  const rows = arr(await base44.entities.OutreachProfile.filter({ client_id: client.id }, "-updated_date", 1).catch(() => []));
  const v = Array.isArray(value) ? value.join(", ") : String(value).trim();
  if (!rows[0]) return base44.entities.OutreachProfile.create({ client_id: client.id, client_name: client.business, enabled: false, [field]: v });
  return base44.entities.OutreachProfile.update(rows[0].id, { [field]: v });
}

async function writeAccess(ctx, key, record) {
  const flight = (ctx.flights || []).find((f) => f.status !== "archived") || null;
  if (flight) return base44.entities.OnboardingFlight.update(flight.id, { answers: { ...(flight.answers || {}), [key]: record }, sources: { ...(flight.sources || {}), [key]: record.source || "justin" } });
  return upsertIntakeAnswer(ctx, key, record);
}

// Save one criterion. value: string | string[] | access record. Returns true when something was written.
export async function writeCriterion(ctx, key, value, { by = "justin", note = "" } = {}) {
  const f = criterionByKey(key);
  if (!f || !f.write) throw new Error(`Unknown field ${key}`);
  const w = f.write;
  if (w.to === "tab") return false;
  if (f.access) {
    const status = typeof value === "object" && value && value.status ? value.status : value === "not_needed" ? "not_needed" : value === "requested" ? "requested" : "granted";
    await writeAccess(ctx, key, { status, by, on: today(), note: note || (typeof value === "object" && value ? value.note || "" : ""), source: by });
    return true;
  }
  if (!has(value)) return false;
  const text = Array.isArray(value) ? value.join(", ") : String(value).trim();
  if (w.to === "crm") {
    const patch = {};
    if (w.field === "phones") patch.phones = [...new Set([text, ...(ctx.client.phones || [])])];
    else patch[w.field] = w.field === "domain" ? text.replace(/^https?:\/\//i, "").replace(/\/$/, "") : text;
    await base44.entities.CRMClient.update(ctx.client.id, patch);
    return true;
  }
  if (w.to === "intake") { await upsertIntakeAnswer(ctx, w.field, text); return true; }
  if (w.to === "outreach") { await upsertOutreach(ctx, w.field, text); return true; }
  if (w.to === "dossier") { await upsertDossier(ctx, w.path, w.list ? value : text, w.list); return true; }
  return false;
}

/* ---------------- intake for missing fields ---------------- */

// The request item for one criterion, shaped like the flight-plan items intakeFormFields() reads.
function intakeItem(crit) {
  if (!crit.ask) return null;
  if (typeof crit.ask === "string") {
    const f = fieldByKey(crit.ask);
    return f && f.ask ? { field: f, level: "blocking", done: false, crit: crit.key } : null;
  }
  return { field: { key: crit.key, label: crit.ask.label, ask: crit.ask.type, help: crit.ask.help || "" }, level: "blocking", done: false, crit: crit.key };
}

export const askableMissing = (ev) => ev.missing.map((i) => ({ i, item: intakeItem(i) })).filter((x) => x.item);

export async function findProfileForm(clientId) {
  const rows = arr(await base44.entities.RequestForm.filter({ client_id: clientId, publish_target: PROFILE_FORM_TARGET }, "-updated_date", 1).catch(() => []));
  return rows[0] || null;
}

export async function sendProfileIntake(ctx, ev) {
  const me = await base44.auth.me().catch(() => null);
  const items = askableMissing(ev).map((x) => x.item);
  const fields = intakeFormFields(items, me && me.email).map((fd) => ({ ...fd, required: false }));
  if (!fields.length) throw new Error("Nothing missing that the client can answer.");
  const client = ctx.client;
  const body = {
    client_id: client.id,
    client_name: client.business,
    kind: "other",
    title: "A few details about your business",
    intro: "These help us tailor your website, Google profile, content and plans to your business. Answer what you can and skip what you don't know. Never send passwords: for access we only need the invite.",
    industry: client.industry || "",
    fields,
    active: true,
    publish_target: PROFILE_FORM_TARGET,
    claude_instructions: "Client profile intake (Client Criteria). Do not publish anything from it; Justin applies the answers to the client profile in Møthership.",
  };
  const existing = await findProfileForm(client.id);
  if (existing) {
    await base44.entities.RequestForm.update(existing.id, body);
    return { ...existing, ...body };
  }
  return base44.entities.RequestForm.create({ ...body, form_key: `profile-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`, submissions: 0 });
}

const critForFormId = (id) => CRITERIA.find((c) => c.key === id || c.ask === id) || null;

// Pending submissions of the profile form (not applied yet).
export async function pendingProfileAnswers(clientId) {
  const form = await findProfileForm(clientId);
  if (!form) return { form: null, requests: [] };
  const reqs = arr(await base44.entities.ClientRequest.filter({ form_id: form.id }, "-created_date", 20).catch(() => []));
  return { form, requests: reqs.filter((r) => !/Applied to client profile/.test(r.admin_notes || "")) };
}

// Apply answers to fields that are still empty; never overwrites a value already on file.
export async function applyProfileAnswers(ctx, ev, requests) {
  const missing = new Set(ev.missing.map((i) => i.key));
  let written = 0;
  for (const req of requests) {
    const vals = req.fields || {};
    for (const [id, v] of Object.entries(vals)) {
      const crit = critForFormId(id);
      if (!crit || !missing.has(crit.key) || !has(v)) continue;
      if (crit.access) {
        if (v === true || v === "true" || v === "yes") { await writeCriterion(ctx, crit.key, "requested", { by: req.submitted_by || "client", note: "Client says the invite was sent (profile intake). Verify, then mark Granted." }); written += 1; }
        continue;
      }
      const ok = await writeCriterion(ctx, crit.key, Array.isArray(v) ? v : String(v), { by: "client_intake" }).catch(() => false);
      if (ok) { written += 1; missing.delete(crit.key); }
    }
    await base44.entities.ClientRequest.update(req.id, { status: "complete", admin_notes: [req.admin_notes, `Applied to client profile ${today()}`].filter(Boolean).join("\n") }).catch(() => null);
  }
  return written;
}
