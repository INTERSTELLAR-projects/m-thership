import { base44 } from "@/api/base44Client";
import { normalizeBlocks } from "./emailBlocks";
import { SEED_TEMPLATES } from "./templates";

// Email Studio data: drafts / sent history, templates, subscribers, saved lists, and the send function.
const arr = (r) => (Array.isArray(r) ? r : (r && r.items) || []);
export const KEYS = { drafts: ["email", "drafts"], templates: ["email", "templates"], subs: ["email", "subscribers"], lists: ["email", "lists"], clients: ["email", "clients"], portal: ["email", "portal-url"] };
export const DEFAULT_PORTAL_URL = "https://interstellar-mothership.com";
export const normEmail = (e) => String(e || "").trim().toLowerCase();
export const isEmail = (e) => /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(String(e || "").trim());

/* drafts */
export const listDrafts = async () => arr(await base44.entities.EmailDraft.list("-updated_date", 200));
export const saveDraft = async (id, data) => (id ? base44.entities.EmailDraft.update(id, data) : base44.entities.EmailDraft.create({ status: "draft", ...data }));
export const deleteDraft = (id) => base44.entities.EmailDraft.delete(id);

/* templates (seeded once per seed_key) */
let seeding = null;
export async function listTemplates() {
  let rows = arr(await base44.entities.EmailTemplate.list("sort", 200));
  const have = new Set(rows.map((r) => r.seed_key).filter(Boolean));
  const missing = SEED_TEMPLATES.filter((t) => !have.has(t.seed_key));
  if (missing.length) {
    seeding = seeding || Promise.all(missing.map((t) => base44.entities.EmailTemplate.create({ ...t, blocks: normalizeBlocks(t.blocks) }))).finally(() => { seeding = null; });
    await seeding.catch(() => null);
    rows = arr(await base44.entities.EmailTemplate.list("sort", 200));
  }
  return rows.sort((a, b) => (Number(a.sort) || 100) - (Number(b.sort) || 100) || String(a.name).localeCompare(String(b.name)));
}
export const createTemplate = (data) => base44.entities.EmailTemplate.create({ sort: 50, category: "other", ...data });
export const deleteTemplate = (id) => base44.entities.EmailTemplate.delete(id);

/* subscribers */
export const listSubscribers = async () => arr(await base44.entities.EmailSubscriber.list("-created_date", 5000));
export const updateSubscriber = (id, data) => base44.entities.EmailSubscriber.update(id, data);
export const deleteSubscriber = (id) => base44.entities.EmailSubscriber.delete(id);

// Upsert by email. Existing rows keep their status unless the row says otherwise; new rows default to subscribed.
export async function upsertSubscribers(rows, existing, source = "import") {
  const byEmail = new Map((existing || []).map((s) => [normEmail(s.email), s]));
  const now = new Date().toISOString();
  const creates = [];
  let updated = 0;
  for (const r of rows) {
    const email = normEmail(r.email);
    if (!isEmail(email)) continue;
    const cur = byEmail.get(email);
    const tags = String(r.tags || "").split(/[;|,]/).map((t) => t.trim()).filter(Boolean);
    const status = r.status === "unsubscribed" ? "unsubscribed" : r.status === "subscribed" ? "subscribed" : null;
    if (cur) {
      const patch = {};
      if (r.name && !cur.name) patch.name = r.name;
      if (r.business && !cur.business) patch.business = r.business;
      if (tags.length) patch.tags = [...new Set([...(cur.tags || []), ...tags])];
      if (status && status !== cur.status) { patch.status = status; if (status === "unsubscribed") patch.unsubscribed_at = now; }
      if (Object.keys(patch).length) { await base44.entities.EmailSubscriber.update(cur.id, patch); updated++; }
    } else {
      byEmail.set(email, { email });
      creates.push({ email, name: r.name || "", business: r.business || "", tags, status: status || "subscribed", source, created_at: now, ...(status === "unsubscribed" ? { unsubscribed_at: now } : {}) });
    }
  }
  for (let i = 0; i < creates.length; i += 100) await base44.entities.EmailSubscriber.bulkCreate(creates.slice(i, i + 100));
  return { created: creates.length, updated };
}

/* lists */
export const listLists = async () => arr(await base44.entities.EmailList.list("name", 200));
export const saveList = (id, data) => (id ? base44.entities.EmailList.update(id, data) : base44.entities.EmailList.create(data));
export const deleteList = (id) => base44.entities.EmailList.delete(id);

/* clients + portal url */
export const listClients = async () => arr(await base44.entities.CRMClient.list("business", 1000)).filter((c) => c.business);
export async function loadPortalUrl() {
  const rows = arr(await base44.entities.AppSettings.filter({ key: "portal_invites" }, "-created_date", 1).catch(() => []));
  const url = String((rows[0] && rows[0].portalSettings && rows[0].portalSettings.portal_url) || "");
  return /^https:\/\/\S+$/.test(url) ? url.replace(/\/+$/, "") : DEFAULT_PORTAL_URL;
}

/* send (email-studio function) */
const fnError = (e) => (e && e.response && e.response.data && e.response.data.error) || (e && e.message) || "Request failed";
export async function sendTest({ subject, blocks, vars, kind }) {
  try { return (await base44.functions.invoke("email-studio", { action: "send_test", subject, blocks, vars, kind })).data; }
  catch (e) { throw new Error(fnError(e)); }
}
export async function sendEmail({ draftId, subject, blocks, kind, recipients, audience }) {
  try {
    return (await base44.functions.invoke("email-studio", {
      action: "send", draft_id: draftId || undefined, subject, blocks, kind, audience,
      recipients: recipients.map((r) => ({ email: r.email, name: r.name, client_id: r.client_id || "", subscriber_id: r.subscriber_id || "", vars: r.vars })),
    })).data;
  } catch (e) { throw new Error(fnError(e)); }
}
