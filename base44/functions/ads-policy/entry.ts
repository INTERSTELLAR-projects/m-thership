// Ads Studio policy guard (admin only).
//   rules → the merged rule set (defaults + Settings overrides + custom rules) with sources
//   check → { subject_type: "creative"|"campaign", subject_id, ai?: boolean }
//           runs every enabled rule, probes the landing page, optionally asks the LLM for a second opinion
//           (its findings are capped at "soft": it can warn, never pass or block on its own), stores an
//           AdPolicyCheck and sets policy_status on the subject. ads-execute refuses to push anything whose
//           latest check is "fail".
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { loadSettings, requireAdmin } from "../../shared/ads.ts";
import { RULES_VERSION, SOURCES, creativeText, landingProbe, mergedRules, pricesIn, resultOf, runRules } from "../../shared/adsPolicy.ts";

const json = (b: unknown, status = 200) => Response.json(b, { status });

const AI_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          rule_key: { type: "string" },
          title: { type: "string" },
          message: { type: "string" },
          matched: { type: "string" },
          severity: { type: "string", enum: ["soft", "info"] },
        },
        required: ["title", "message", "severity"],
      },
    },
    summary: { type: "string" },
  },
  required: ["findings"],
};

async function aiReview(base44: any, platform: string, text: string) {
  const prompt = `You are an ad-policy reviewer for ${platform === "google" ? "Google Ads" : "Meta (Facebook + Instagram)"} ads run by a digital marketing agency.
Review ONLY the ad copy below. Flag anything likely to be rejected or misleading:
- asserting or implying the viewer's personal attributes (financial status, health, age, religion, sexual orientation, disability, criminal record) — e.g. "Are you a business owner struggling…" is a violation
- guarantees or improbable results (rankings, leads, revenue, ROI), unsubstantiated statistics or superlatives
- before/after framing that implies a guaranteed outcome
- fake urgency or scarcity
- credit / financing, employment or housing wording that would need a Meta Special Ad Category
- prohibited or restricted content
Do not invent problems. If the copy is fine, return an empty findings list. Severity must be "soft" (likely issue) or "info" (minor).
Ad copy:
"""
${text.slice(0, 4000)}
"""`;
  try {
    const out = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: AI_SCHEMA });
    const findings = (out?.findings || []).slice(0, 8).map((f: any) => ({
      rule_key: `ai_${String(f.rule_key || "review").replace(/[^a-z0-9_]/gi, "_").toLowerCase()}`,
      severity: f.severity === "info" ? "info" : "soft",
      title: `AI review: ${f.title}`,
      message: f.message,
      matched: f.matched || "",
      source_url: platform === "google" ? SOURCES.google_overview : SOURCES.meta_standards,
      verified: false,
      verified_note: "LLM second opinion — advisory only, never blocks or passes on its own.",
    }));
    return { findings, summary: out?.summary || "" };
  } catch (e) {
    return { findings: [], summary: "", error: String((e as Error)?.message || e).slice(0, 200) };
  }
}

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireAdmin(base44);
    if (!user) return json({ error: "Admins only" }, 403);
    const db = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const { settings } = await loadSettings(db);

    if (body.action === "rules") return json({ version: RULES_VERSION, rules: mergedRules(settings), sources: SOURCES });

    if (body.action !== "check") return json({ error: "Unknown action" }, 400);
    const kind = body.subject_type === "campaign" ? "campaign" : "creative";
    const id = String(body.subject_id || "");
    const sections = (await db.AgencyKnowledge.list("sort", 100).catch(() => [])) || [];
    const offers = (sections.find((s: any) => s.key === "offers")?.data?.offers || []) as any[];

    let creative: any = null;
    let campaign: any = null;
    let creatives: any[] = [];
    if (kind === "creative") {
      creative = await db.AdCreative.get(id);
      if (!creative) return json({ error: "Creative not found" }, 404);
      creatives = [creative];
    } else {
      campaign = await db.AdCampaign.get(id);
      if (!campaign) return json({ error: "Campaign not found" }, 404);
      const ids: string[] = campaign.draft?.creative_ids || [];
      creatives = (await Promise.all(ids.map((cid) => db.AdCreative.get(cid).catch(() => null)))).filter(Boolean);
    }
    const platform = (creative?.platform || campaign?.platform || "meta") === "google" ? "google" : "meta";

    // Landing probe on the first creative's destination: offer name + any prices in the copy must appear.
    const first = creatives.find((c) => c?.destination_url);
    let landing: any = null;
    if (first) {
      const offer = offers.find((o) => o.key === first.offer_key);
      const terms = [offer?.name, ...pricesIn(creativeText(first)).map((p) => p.toLocaleString("en-US"))].filter(Boolean) as string[];
      landing = await landingProbe(first.final_url || first.destination_url, terms);
    }

    const findings: any[] = runRules({ platform, kind, creative, campaign, creatives, sections, settings, landing });
    let ai: any = null;
    if (body.ai && creatives.length) {
      ai = await aiReview(base44, platform, creatives.map(creativeText).join("\n---\n"));
      findings.push(...ai.findings);
    }
    const result = resultOf(findings);
    const check = await db.AdPolicyCheck.create({
      subject_type: kind, subject_id: id, platform, result, findings, landing: landing || {}, ai_review: ai || {},
      rules_version: RULES_VERSION, checked_at: new Date().toISOString(), client_id: (creative || campaign)?.client_id || "",
    });
    if (kind === "creative") await db.AdCreative.update(id, { policy_status: result, policy_check_id: check.id });
    else await db.AdCampaign.update(id, { policy_status: result });
    return json({ ok: true, check });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
