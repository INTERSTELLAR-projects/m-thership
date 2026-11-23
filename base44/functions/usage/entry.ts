import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { requireSecondFactor } from "../../shared/twoFactor.ts";
import { resolveClient, hasSecret } from "../../shared/portalClient.ts";
import { capsFor, anyStudioOn, studioState, STUDIO_KEYS, monthKey, AI_MODELS } from "../../shared/usagePlans.ts";
import { monthUsage } from "../../shared/meter.ts";
import { loadFuelConfig, allowanceFor } from "../../shared/fuel.ts";
import { sesHookToken } from "../../shared/emailUnsub.ts";
import { inviteSettings } from "../../shared/portalInvite.ts";

// Studios fair-use reads.
//   summary  { client_id? }  portal user: own client (client_id ignored); admin: any client.
//            Portal users get { visible: false } until at least one Studio is switched ON for them.
//   overview { month? }      admin: every active client with plan, caps, this month's usage, est. cost, states.
//   config   {}              admin: secret PRESENCE only (never values), model ids, SES feedback webhook URL.

const capOut = (n: number) => (isFinite(n) ? n : null);
// Caps now come from the plan + HyperCare+ tier (shared/fuel.ts, Fuel economics settings); ads cadence from capsFor.
const capsWithTier = (c: any, cfg: any) => {
  const caps = capsFor(c);
  const a = allowanceFor(c, cfg);
  return { ...caps, ai_action: a.ai_action, marketing_email: a.marketing_email, ads_cadence: a.studios_unlocked ? caps.ads_cadence : "none", tier_label: a.tier_label, studios_unlocked: a.studios_unlocked };
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
    const gate = await requireSecondFactor(base44, req, user);
    if (gate) return gate;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "summary");
    const db = base44.asServiceRole.entities;
    const isAdmin = user.role === "admin";

    if (action === "summary") {
      const client = await resolveClient(db, user, body?.client_id);
      if (!client) return Response.json({ visible: false });
      if (!isAdmin && !anyStudioOn(client)) return Response.json({ visible: false });
      const caps = capsWithTier(client, await loadFuelConfig(db));
      const u = await monthUsage(db, String(client.id));
      const out: Record<string, unknown> = {
        visible: anyStudioOn(client) || isAdmin, month: u.month, plan: caps.plan, plan_label: caps.plan_label,
        caps: { ai_action: capOut(caps.ai_action), marketing_email: capOut(caps.marketing_email), ads_cadence: caps.ads_cadence },
        usage: { ai_action: u.ai_action, marketing_email: u.marketing_email, ads_run: u.ads_run },
      };
      if (isAdmin) Object.assign(out, {
        admin_usage: { ai_action: u.admin_ai_action, marketing_email: u.admin_marketing_email, ads_run: u.admin_ads_run },
        est_cost_usd: u.est_cost_usd, unlimited: caps.unlimited, custom: caps.custom,
        studios: Object.fromEntries(STUDIO_KEYS.map((k) => [k, studioState(client, k)])),
      });
      return Response.json(out);
    }

    if (!isAdmin) return Response.json({ error: "Admins only" }, { status: 403 });

    if (action === "overview") {
      const month = /^\d{4}-\d{2}$/.test(String(body?.month || "")) ? String(body.month) : monthKey();
      const clients = ((await db.CRMClient.filter({ status: "Active" }, "business", 500).catch(() => [])) || []) as any[];
      const rows = ((await db.UsageLedger.filter({ month }, "-created_date", 5000).catch(() => [])) || []) as any[];
      const agg: Record<string, any> = {};
      for (const r of rows) {
        const a = (agg[r.client_id] ||= { ai_action: 0, marketing_email: 0, ads_run: 0, admin_ai_action: 0, admin_marketing_email: 0, admin_ads_run: 0, est_cost_usd: 0 });
        const k = String(r.kind);
        if (!["ai_action", "marketing_email", "ads_run"].includes(k)) continue;
        a[r.by_admin ? `admin_${k}` : k] += Number(r.units) || 0;
        a.est_cost_usd += Number(r.est_cost_usd) || 0;
      }
      const empty = { ai_action: 0, marketing_email: 0, ads_run: 0, admin_ai_action: 0, admin_marketing_email: 0, admin_ads_run: 0, est_cost_usd: 0 };
      const fuelCfg = await loadFuelConfig(db);
      return Response.json({
        month,
        truncated: rows.length >= 5000,
        agency: agg.agency || empty,
        clients: clients.map((c) => {
          const caps = capsWithTier(c, fuelCfg);
          return {
            id: c.id, business: c.business, logo_url: c.logo_url || "", plan: caps.plan, plan_label: caps.plan_label, tier_label: caps.tier_label, studios_unlocked: caps.studios_unlocked,
            caps: { ai_action: capOut(caps.ai_action), marketing_email: capOut(caps.marketing_email), ads_cadence: caps.ads_cadence },
            unlimited: caps.unlimited, custom: caps.custom, overrides: c.usage_overrides || {},
            studios: Object.fromEntries(STUDIO_KEYS.map((k) => [k, studioState(c, k)])),
            portal_enabled: !!c.portal_enabled,
            ses: { from_email: c.ses_from_email || "", from_name: c.ses_from_name || "", reply_to: c.ses_reply_to || "", domain: c.ses_domain || "", verified: !!c.ses_domain_verified },
            usage: agg[c.id] || empty,
          };
        }),
      });
    }

    if (action === "config") {
      const settings = await inviteSettings(db).catch(() => ({ portal_url: "" }));
      let hook = "";
      try { hook = `${String(settings.portal_url || "https://interstellar-mothership.com").replace(/\/+$/, "")}/functions/email-bulk?hook=${await sesHookToken()}`; } catch { hook = ""; }
      return Response.json({
        secrets: Object.fromEntries(["AWS_SES_ACCESS_KEY_ID", "AWS_SES_SECRET_ACCESS_KEY", "AWS_SES_REGION"].map((n) => [n, hasSecret(n)])),
        models: { routine: AI_MODELS.routine, long: AI_MODELS.long },
        ses_feedback_webhook: hook,
        checked_at: new Date().toISOString(),
      });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("usage", (e as Error)?.message);
    return Response.json({ error: (e as Error)?.message || "Usage lookup failed" }, { status: 500 });
  }
});
// Terms gate (Nov 23 2026): portal logins resolve only after accepting the active Terms of Service (docs/portal-terms.md).
