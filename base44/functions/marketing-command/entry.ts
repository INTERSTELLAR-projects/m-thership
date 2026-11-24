// Marketing Command (docs/marketing-command.md). Admin only.
//   { action: "generate", season?, year? } -> reads the Interstellar Business Brain, the active offers and the season
//      (holiday windows), asks Base44 InvokeLLM for one weekly target per pillar with reasoning, and saves a DRAFT
//      MarketingPlan + draft PillarTargets. Nothing is approved, spent or sent.
//   { action: "approve", plan_id } -> plan active, its targets approved, the previous active Interstellar plan archived.
// No secrets: InvokeLLM is the app's built-in integration.
// deno-lint-ignore-file no-explicit-any
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { requireAdmin } from "../../shared/assistant.ts";
import { DEFAULT_REVENUE, EXAMPLE_DEAL_MIX, STATED_PRICING, TARGETS_SCHEMA, cleanTargets, holidaysBetween, isoDay, planPrompt, seasonFor, seasonRange } from "../../shared/marketingCommand.js";

const s = (v: unknown) => (v == null ? "" : String(v));
const itemsOf = (r: any) => (Array.isArray(r) ? r : (r && r.items) || []);

function brainText(b: any) {
  if (!b) return "";
  if (b.context_md) return s(b.context_md);
  const sec = b.sections || {};
  return ["overview", "offer_pricing", "audience", "goals", "problems", "competitors", "content"].map((k) => (sec[k] && sec[k].text ? `## ${k}\n${sec[k].text}` : "")).filter(Boolean).join("\n\n");
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user, denied } = await requireAdmin(base44);
    if (denied) return denied;
    const db = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const action = s(body.action || "generate");

    if (action === "generate") {
      const today = isoDay(new Date());
      const season = ["winter", "spring", "summer", "fall"].includes(body.season) ? body.season : seasonFor(today);
      const year = Number(body.year) || (season === "winter" && new Date().getUTCMonth() < 2 ? new Date().getUTCFullYear() - 1 : new Date().getUTCFullYear());
      const { start, end } = seasonRange(season, year);
      const holidays = holidaysBetween(start, end);
      const [brains, offersRaw, active] = await Promise.all([
        db.BusinessBrain.filter({ scope: "interstellar" }, "-updated_date", 1).catch(() => []),
        db.OfferCatalog.filter({ status: "active" }, "sort", 100).catch(() => []),
        db.MarketingPlan.filter({ scope: "interstellar", status: "active" }, "-approved_at", 1).catch(() => []),
      ]);
      const offers = itemsOf(offersRaw).filter((o: any) => ["mission", "build", "subscription", "subscription_tier"].includes(o.kind));
      const prev = itemsOf(active)[0];
      const revenue = { daily_target: Number(prev?.daily_revenue_target) || DEFAULT_REVENUE.daily_target, days_per_week: Number(prev?.days_per_week) || DEFAULT_REVENUE.days_per_week };
      let raw: any = null;
      try {
        raw = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt: planPrompt({ season, start, end, holidays, offers, brain: brainText(itemsOf(brains)[0]), revenue }), response_json_schema: TARGETS_SCHEMA });
      } catch (e) {
        return Response.json({ error: `The planner could not run (${s((e as Error).message).slice(0, 120)}). Try again.` }, { status: 502 });
      }
      const clean = cleanTargets(raw);
      if (!clean.targets.length) return Response.json({ error: "The planner returned no usable targets. Try again." }, { status: 502 });
      const plan = await db.MarketingPlan.create({
        title: `${season[0].toUpperCase()}${season.slice(1)} ${year} plan (draft)`, season, year, start_date: start, end_date: end,
        offer_ids: offers.map((o: any) => o.id), daily_revenue_target: revenue.daily_target, days_per_week: revenue.days_per_week,
        deal_mix: prev?.deal_mix?.length ? prev.deal_mix : EXAMPLE_DEAL_MIX, holiday_windows: holidays, summary: clean.summary,
        pricing_context: STATED_PRICING, status: "draft", source: "generated", generated_at: new Date().toISOString(), scope: "interstellar",
        notes: clean.missing.length ? `The planner skipped: ${clean.missing.join(", ")}. Add those targets by hand.` : "",
      });
      await db.PillarTarget.bulkCreate(clean.targets.map((t: any) => ({ ...t, plan_id: plan.id, status: "draft", scope: "interstellar" })));
      return Response.json({ ok: true, plan_id: plan.id, targets: clean.targets.length, missing: clean.missing });
    }

    if (action === "approve") {
      const plan = await db.MarketingPlan.get(s(body.plan_id)).catch(() => null);
      if (!plan) return Response.json({ error: "Plan not found" }, { status: 404 });
      const now = new Date().toISOString();
      const others = itemsOf(await db.MarketingPlan.filter({ scope: plan.scope || "interstellar", status: "active" }, "-approved_at", 20).catch(() => []))
        .filter((p: any) => p.id !== plan.id && (p.scope !== "client" || p.client_id === plan.client_id));
      for (const p of others) await db.MarketingPlan.update(p.id, { status: "archived" });
      await db.MarketingPlan.update(plan.id, { status: "active", approved_at: now, approved_by: user.email, title: s(plan.title).replace(/\s*\(draft\)$/, "") });
      const targets = itemsOf(await db.PillarTarget.filter({ plan_id: plan.id }, "pillar", 50));
      for (const t of targets) await db.PillarTarget.update(t.id, { status: "approved" });
      return Response.json({ ok: true, archived: others.map((p: any) => p.id) });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (_e) {
    return Response.json({ error: "Marketing Command error" }, { status: 500 });
  }
});
