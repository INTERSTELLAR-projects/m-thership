import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// TEMPORARY read-only scan (Claude, Nov 9 2026): finds records whose text still carries ® next to an Interstellar mark.
// Returns only entity, record id and field path. Delete this function after use.
const ENTS = ["OfferCatalog", "AddOn", "ClientAddOn", "AppSettings", "BusinessBrain", "ClientDossier", "WorkLog", "WorkEntry", "ClientFile", "Presentation", "DeckProject", "EmailTemplate", "EmailDraft", "EmailCampaign", "Signature", "SignatureTemplate", "AgencyKnowledge", "IndustryPlaybook", "ContentPlan", "SocialPlan", "SocialPost", "SocialVariant", "ChannelPost", "SocialBrand", "AutomationCatalog", "TrainingModule", "TrainingTrack", "TaskTemplate", "Task", "Project", "LaunchItem", "PortalInvite", "FormTemplate", "RequestForm", "OnboardingFlight", "PrestigeReward", "AppDocument", "LegalItem", "Ad", "AdCreative", "OrbitSEOClient", "CeoBrief", "AssistantBriefing", "ClaudeJob", "Automation", "AgentRegistry", "ClientRequest", "Idea", "ResearchNote", "QrTemplate", "UsageLedger", "CreditPurchase", "RevenueProjection", "PlanAnalysis", "LedgerTransaction", "LedgerRule", "Expense"];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function paths(v: any, p: string, out: string[]) {
  if (typeof v === "string") { if (/®/.test(v) && /(interstellar|m[øo]thership|[øo]rbit|hypercare|gravitycare|grav[ïi]tycare|appcare|manage\+|[øo]rigin)/i.test(v)) out.push(p); }
  else if (Array.isArray(v)) v.forEach((x, i) => paths(x, `${p}.${i}`, out));
  else if (v && typeof v === "object") for (const k of Object.keys(v)) paths(v[k], p ? `${p}.${k}` : k, out);
}
Deno.serve(async (req) => {
  const db = createClientFromRequest(req).asServiceRole.entities;
  const body = await req.json().catch(() => ({}));
  const part = Number(body.part || 0);
  const list = ENTS.slice(part * 20, part * 20 + 20);
  const found: any[] = [];
  const errors: any[] = [];
  for (const e of list) {
    try {
      const rows = (await db[e].list("-updated_date", 1000)) || [];
      for (const r of rows) { const out: string[] = []; paths(r, "", out); if (out.length) found.push({ e, id: r.id, paths: out.slice(0, 8), sample: String(out[0].split(".").reduce((o: any, k) => o?.[k], r)).slice(0, 120) }); }
    } catch (err) { errors.push({ e, err: String((err as Error)?.message || err).slice(0, 120) }); }
    await sleep(400);
  }
  return Response.json({ part, scanned: list, found, errors });
});
