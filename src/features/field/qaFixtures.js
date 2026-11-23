// QA / Presentation fixtures for the Field inbox (fictional, in memory only).
const ago = (min) => new Date(Date.now() - min * 60000).toISOString();

export const QA_FIELD_INBOX = [
  { id: "fi1", source: "whatsapp", message_type: "text", text: "Task: send Summit the storm-season quote follow-up", intent: "task", status: "routed", client_id: "c1", client_name: "Summit Roofing Co", routed_to: { entity: "Task", id: "k1", label: "Send Summit the storm-season quote follow-up", path: "/tasks" }, ai_summary: "Task (next) for Summit Roofing Co.", reply_text: "Saved as a task for Summit Roofing Co: Send Summit the storm-season quote follow-up", created_at: ago(18), created_date: ago(18) },
  { id: "fi2", source: "upload", message_type: "video", text: "Walked their shop floor. Fix their website and map how they take orders.", intent: "site_visit", status: "processing", client_id: "c2", client_name: "Harbor Coffee", media: [{ type: "video", size: 48 * 1048576, name: "IMG_2041.MOV", duration: 94 }], routed_to: { entity: "ClaudeJob", id: "j1", label: "Site visit: Harbor Coffee", path: "/claude?job=j1" }, ai_summary: "Site visit queued for Claude (analysis and drafts only).", created_at: ago(64), created_date: ago(64) },
  { id: "fi3", source: "whatsapp", message_type: "audio", text: "Idea: a rewards punch card inside every Command System", intent: "idea", status: "routed", routed_to: { entity: "Idea", id: "i1", label: "A rewards punch card inside every Command System", path: "/idea-vault" }, ai_summary: "Saved to the Idea Vault.", created_at: ago(140), created_date: ago(140) },
  { id: "fi4", source: "whatsapp", message_type: "text", text: "Write a GBP-free holiday promo plan for Peak Fitness", intent: "claude_job", status: "processing", client_id: "c3", client_name: "Peak Fitness Lab", routed_to: { entity: "ClaudeJob", id: "j2", label: "Peak Fitness Lab: holiday promo plan", path: "/claude?job=j2" }, ai_summary: "Queued for Claude (stops at needs approval).", created_at: ago(60 * 26), created_date: ago(60 * 26) },
];

export function qaFieldInvoke(args = {}) {
  if (args.action === "status") {
    return {
      secrets: { WHATSAPP_VERIFY_TOKEN: true, WHATSAPP_APP_SECRET: true, WHATSAPP_TOKEN: false, WHATSAPP_PHONE_NUMBER_ID: false, JUSTIN_WHATSAPP_NUMBERS: false },
      optional: { OPENAI_API_KEY: false },
      webhook_url: "https://base44.app/api/apps/69d80bb06c5ad07a795df54e/functions/whatsapp-inbound",
      allowed: { from_secret: [], from_settings: ["15035550100"] },
      ready: false,
      checked_at: new Date().toISOString(),
    };
  }
  if (args.action === "save_numbers") return { ok: true, allowed_numbers: args.numbers || [] };
  if (args.action === "route") return { ok: true, reply: "Saved as a task: " + String(args.text || "").slice(0, 60), routed_to: { entity: "Task", id: "k1", path: "/tasks" } };
  if (args.action === "site_visit") return { ok: true, job_id: "qa-job", routed_to: { entity: "ClaudeJob", id: "qa-job", label: "Site visit", path: "/claude?job=qa-job" } };
  return {};
}
