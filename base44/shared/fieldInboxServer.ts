// Field inbox writes (docs/field-inbox.md), shared by whatsapp-inbound (webhook) and field-inbox (admin page).
// Routing only creates internal records (Task, Idea, a client note, a queued ClaudeJob). It never publishes, deploys,
// emails or contacts anyone; the only outbound message is the short WhatsApp confirmation to Justin's own number.
// Secrets are read by NAME with Deno.env and never stored, returned or logged.
// deno-lint-ignore-file no-explicit-any
import {
  CLASSIFY_SCHEMA, GRAPH, SETTINGS_KEY, classifyPrompt, confirmationText, fieldJobBrief, matchClient, parseAllowed,
  routeDecision, ruleIntent, siteVisitBrief, titleFrom,
} from "./fieldInbox.js";

const s = (v: unknown) => (v == null ? "" : String(v));
const now = () => new Date().toISOString();
const itemsOf = (r: any) => (Array.isArray(r) ? r : (r && r.items) || []);
export const env = (name: string) => { try { return Deno.env.get(name) || ""; } catch { return ""; } };

export async function loadSettings(db: any) {
  const rows = itemsOf(await db.AppSettings.filter({ key: SETTINGS_KEY }, "-updated_date", 1).catch(() => []));
  return rows[0] || null;
}

// Justin's numbers: the JUSTIN_WHATSAPP_NUMBERS secret plus Settings > Field inbox (AppSettings field_inbox).
export async function allowedNumbers(db: any) {
  const row = await loadSettings(db);
  return parseAllowed(env("JUSTIN_WHATSAPP_NUMBERS"), (row && row.pageSettings && row.pageSettings.allowed_numbers) || []);
}

export async function loadClients(db: any) {
  const rows = itemsOf(await db.CRMClient.filter({ status: { $ne: "Inactive" } }, "business", 500).catch(() => []));
  return rows.map((c: any) => ({ id: c.id, business: s(c.business), contact: s(c.contact), domain: s(c.domain), websites: c.websites || [], bundle: s(c.bundle), status: s(c.status), niche_key: s(c.niche_key), city: s(c.city), location: s(c.location) }));
}

async function classify(base44: any, text: string, clients: any[]) {
  if (!text.trim()) return null;
  try {
    const r = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt: classifyPrompt(text, clients), response_json_schema: CLASSIFY_SCHEMA });
    const out = r && typeof r === "object" ? r : null;
    if (out && out.client_id && !clients.some((c) => c.id === out.client_id)) out.client_id = "";
    return out;
  } catch { return null; }
}

/* ---------------- media ---------------- */

const EXT: Record<string, string> = { "video/mp4": "mp4", "video/3gpp": "3gp", "video/quicktime": "mov", "audio/ogg": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/aac": "aac", "audio/amr": "amr", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

// WhatsApp Cloud API: GET /{media-id} gives a short-lived URL; GET that URL (same bearer token) gives the bytes.
export async function fetchWhatsAppMedia(token: string, mediaId: string) {
  const meta = await fetch(`${GRAPH}/${encodeURIComponent(mediaId)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!meta.ok) throw new Error(`media lookup ${meta.status}`);
  const m = await meta.json();
  const bin = await fetch(s(m.url), { headers: { Authorization: `Bearer ${token}` } });
  if (!bin.ok) throw new Error(`media download ${bin.status}`);
  return { bytes: new Uint8Array(await bin.arrayBuffer()), mime: s(m.mime_type).split(";")[0], size: Number(m.file_size) || 0 };
}

export async function storeBytes(base44: any, bytes: Uint8Array, mime: string, base: string) {
  const ext = EXT[mime] || "bin";
  const up = await base44.asServiceRole.integrations.Core.UploadFile({ file: new File([bytes], `${base}.${ext}`, { type: mime || "application/octet-stream" }) });
  return s(up && (up.file_url || up.url));
}

// Voice notes: transcribed by the OpenAI key the Voice Core already uses (OPENAI_API_KEY) when it is set;
// otherwise the queue runner transcribes with faster-whisper.
export async function transcribe(bytes: Uint8Array, mime: string) {
  const key = env("OPENAI_API_KEY");
  if (!key) return "";
  const form = new FormData();
  form.append("file", new Blob([bytes], { type: mime || "audio/ogg" }), `voice.${EXT[mime] || "ogg"}`);
  form.append("model", "whisper-1");
  form.append("language", "en");
  const r = await fetch("https://api.openai.com/v1/audio/transcriptions", { method: "POST", headers: { Authorization: `Bearer ${key}` }, body: form });
  if (!r.ok) return "";
  const d = await r.json().catch(() => ({}));
  return s(d && d.text).trim();
}

export async function sendWhatsApp(token: string, phoneId: string, to: string, body: string, replyTo = "") {
  const r = await fetch(`${GRAPH}/${encodeURIComponent(phoneId)}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to, type: "text", text: { body: body.slice(0, 1000), preview_url: false }, ...(replyTo ? { context: { message_id: replyTo } } : {}) }),
  });
  return r.ok;
}

/* ---------------- routing ---------------- */

const label = (c: any) => (c ? s(c.business) : "");

async function addNote(db: any, client: any, text: string, source: string) {
  const at = now();
  const entry = { id: `field_${Date.now().toString(36)}`, section: "overview", text: text.slice(0, 4000), source: "field_inbox", via: source, by: "justin", added_at: at, status: "pending" };
  if (client) {
    const full = await db.CRMClient.get(client.id).catch(() => null);
    const notes = [...((full && full.notes) || []), { id: Date.now(), text: text.slice(0, 4000), date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" }), source: "field_inbox" }];
    await db.CRMClient.update(client.id, { notes });
    const brain = itemsOf(await db.BusinessBrain.filter({ client_id: client.id }, "-updated_date", 1).catch(() => []))[0];
    if (brain) await db.BusinessBrain.update(brain.id, { pending_updates: [entry, ...(brain.pending_updates || [])].slice(0, 300) }).catch(() => null);
    return { entity: "CRMClient", id: client.id, label: `Note on ${client.business}`, path: `/clients/${client.id}` };
  }
  const brain = itemsOf(await db.BusinessBrain.filter({ scope: "interstellar" }, "-updated_date", 1).catch(() => []))[0];
  if (brain) {
    await db.BusinessBrain.update(brain.id, { pending_updates: [entry, ...(brain.pending_updates || [])].slice(0, 300) });
    return { entity: "BusinessBrain", id: brain.id, label: "Note in the Interstellar Brain", path: "/brain" };
  }
  return null;
}

export async function queueSiteVisit(db: any, o: { fieldId: string; client: any; lead: any; prompt: string; media: any[]; outputs: any; isTest?: boolean }) {
  const biz = o.client ? o.client.business : s(o.lead && o.lead.name) || "unknown business";
  const title = `${o.isTest ? "[TEST] " : ""}Site visit: ${biz}`;
  const job = await db.ClaudeJob.create({
    title, kind: "site_visit", status: "queued", priority: 2,
    client_id: o.client ? o.client.id : "", client_name: o.client ? o.client.business : "",
    brand: "interstellar", instruction: s(o.prompt).trim() || "Analyze the site visit", extra: s(o.prompt).trim(),
    instructions: siteVisitBrief({ fieldId: o.fieldId, client: o.client, lead: o.lead, prompt: o.prompt, media: o.media, outputs: o.outputs, isTest: o.isTest }),
    references: o.media.map((m: any) => ({ kind: m.type, title: m.name || m.type, file_url: m.url, note: "Site visit media" })),
    requested_at: now(), complete_task_on_approve: false,
    context: { source: "field_inbox", field_inbox_id: o.fieldId, lead_business: o.lead || null, outputs: o.outputs || {}, is_test: !!o.isTest },
  });
  return { job, title };
}

export type RouteInput = {
  source: "whatsapp" | "web" | "upload"; text: string; media?: any[]; fromNumber?: string; externalId?: string; contactName?: string;
  messageType?: string; transcriptSource?: string; pendingTranscript?: boolean; clientId?: string; isTest?: boolean;
};

// Creates the FieldInbox row, decides where it goes, writes it there and records routed_to. Returns the row + reply.
export async function routeItem(base44: any, input: RouteInput) {
  const db = base44.asServiceRole.entities;
  const media = input.media || [];
  const text = s(input.text).trim();
  const row = await db.FieldInbox.create({
    source: input.source, external_id: s(input.externalId), from_number: s(input.fromNumber), contact_name: s(input.contactName),
    message_type: s(input.messageType), text, transcript_source: s(input.transcriptSource) || (text ? "typed" : ""), media,
    status: "new", is_test: !!input.isTest, created_at: now(),
  });
  try {
    const clients = await loadClients(db);
    const hasVideo = media.some((m: any) => m.type === "video");
    let client = input.clientId ? clients.find((c: any) => c.id === input.clientId) || null : matchClient(text, clients);
    let llm: any = null;
    let decision: any;
    if (input.pendingTranscript) {
      decision = { intent: "claude_job", rule: "voice_pending", status: "inbox", client_id: "", confidence: 1 };
    } else {
      const rule = ruleIntent(text, { hasVideo });
      if ((!rule || !client) && text.length > 3) llm = await classify(base44, text, clients);
      decision = routeDecision({ text, hasVideo, rule, llm, clientId: client ? client.id : "" });
      if (!client && decision.client_id) client = clients.find((c: any) => c.id === decision.client_id) || null;
    }
    const title = s(llm && llm.title).trim().slice(0, 120) || titleFrom(text) || (hasVideo ? "Review WhatsApp video" : media.length ? `Review WhatsApp ${media[0].type}` : "Field note");
    const mediaLines = media.map((m: any) => `- ${m.type}: ${m.url}`).join("\n");
    let routed: any = null;
    let summary = "";

    if (decision.intent === "task") {
      const t = await db.Task.create({
        title, status: decision.status, priority: 3, category: "ops", task_type: client ? "billable" : "internal",
        client_id: client ? client.id : null, client_name: client ? client.business : null, labels: ["field"],
        source: input.source === "whatsapp" ? "voice" : "manual",
        notes: [`From the field inbox (${input.source}).`, text, mediaLines].filter(Boolean).join("\n\n").slice(0, 6000),
      });
      routed = { entity: "Task", id: t.id, label: title, path: "/tasks" };
      summary = decision.rule === "ambiguous" ? "Not sure where it goes, so it is a task in your Inbox." : decision.rule === "video_no_prompt" ? "A video with no words: in your Inbox until you say who it is for." : `Task (${decision.status})${client ? ` for ${client.business}` : ""}.`;
    } else if (decision.intent === "idea") {
      const i = await db.Idea.create({ title, description: [text, mediaLines].filter(Boolean).join("\n\n"), category: "Other", status: "New", stage: "idea", date: now().slice(0, 10), source: "field" });
      routed = { entity: "Idea", id: i.id, label: title, path: "/idea-vault" };
      summary = "Saved to the Idea Vault.";
    } else if (decision.intent === "note") {
      routed = await addNote(db, client, [text.replace(/^\s*note\s*[:\-–—]\s*/i, ""), mediaLines].filter(Boolean).join("\n"), input.source);
      if (!routed) {
        const t = await db.Task.create({ title: `Note: ${title}`, status: "inbox", priority: 3, category: "ops", task_type: "internal", labels: ["field"], source: "manual", notes: text });
        routed = { entity: "Task", id: t.id, label: `Note: ${title}`, path: "/tasks" };
      }
      summary = client ? `Note added to ${client.business} (Brain pending update).` : "Note added to the Interstellar Brain.";
    } else if (decision.intent === "site_visit") {
      const { job, title: jt } = await queueSiteVisit(db, { fieldId: row.id, client, lead: null, prompt: text, media, outputs: { website: true, operations: true, content: true }, isTest: input.isTest });
      routed = { entity: "ClaudeJob", id: job.id, label: jt, path: `/claude?job=${job.id}` };
      summary = "Site visit queued for Claude (analysis and drafts only).";
    } else {
      const jobTitle = input.pendingTranscript ? `Voice note from the field${client ? ` (${client.business})` : ""}` : `${client ? `${client.business}: ` : ""}${title}`.slice(0, 140);
      const job = await db.ClaudeJob.create({
        title: `${input.isTest ? "[TEST] " : ""}${jobTitle}`, kind: "task", status: "queued", priority: 3,
        client_id: client ? client.id : "", client_name: client ? client.business : "", brand: "interstellar",
        instruction: text || "(voice note)", instructions: fieldJobBrief({ text, client, media, fieldId: row.id, pendingTranscript: input.pendingTranscript }),
        references: media.map((m: any) => ({ kind: m.type, title: m.name || m.type, file_url: m.url })),
        requested_at: now(), complete_task_on_approve: false, context: { source: "field_inbox", field_inbox_id: row.id, is_test: !!input.isTest },
      });
      routed = { entity: "ClaudeJob", id: job.id, label: jobTitle, path: `/claude?job=${job.id}` };
      summary = input.pendingTranscript ? "Voice note queued for Claude to transcribe and file." : "Queued for Claude (stops at needs approval).";
    }

    const reply = confirmationText({ intent: decision.intent, title: routed ? routed.label : title, clientName: label(client), status: decision.status, pendingTranscript: input.pendingTranscript });
    const updated = await db.FieldInbox.update(row.id, {
      intent: decision.intent, rule: decision.rule, confidence: decision.confidence, status: decision.intent === "site_visit" || decision.intent === "claude_job" ? "processing" : "routed",
      routed_to: routed, client_id: client ? client.id : "", client_name: client ? client.business : "", ai_summary: summary, reply_text: reply, processed_at: now(),
    });
    return { row: { ...row, ...(updated || {}) }, reply, routed };
  } catch (e) {
    await db.FieldInbox.update(row.id, { status: "failed", error: s((e as Error).message).slice(0, 500), processed_at: now() }).catch(() => null);
    return { row, reply: "Saved, but filing it failed. It is in the field inbox on /field.", routed: null, error: (e as Error).message };
  }
}
