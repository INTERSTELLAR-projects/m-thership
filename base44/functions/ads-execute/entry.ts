// Ads Studio — the ONLY function that changes anything on an ad platform. Every action needs a signed-in admin
// (Justin) and an explicit `confirm: true` sent by an approval button in the UI. There is no scheduled entry.
//   decide      {recommendation_id, decision: approve|reject, accept_clamped?, note?}
//               reject → status rejected. approve → executes executable types (budget_*, pause) after re-reading
//               the live value from Meta, enforcing the per-day % cap and the monthly cap; logs before/after.
//               Non-executable types (new_variant, audience, creative_refresh, other) are only marked approved.
//   push_draft  {campaign_id}  → creates campaign + ad set + ads on Meta, ALL PAUSED. Blocked on a failing or
//               missing policy check, a missing Page id, or a daily budget above the monthly cap.
//   launch      {campaign_id}  → sets a pushed campaign and its ad sets/ads ACTIVE. Separate approval. Blocked at
//               or over the monthly cap.
//   pause       {external_id, level, name?} → manual pause (only ever reduces spend).
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { actId, budgetGate, graph, loadSettings, logChange, metaToken, monthToDateSpend, num, requireAdmin, round, toMajor, toMinor } from "../../shared/ads.ts";

const json = (b: unknown, status = 200) => Response.json(b, { status });

function toBase64(buf: ArrayBuffer) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

const OBJECTIVES: Record<string, { objective: string; optimization_goal: string; event?: string }> = {
  traffic: { objective: "OUTCOME_TRAFFIC", optimization_goal: "LANDING_PAGE_VIEWS" },
  leads: { objective: "OUTCOME_LEADS", optimization_goal: "OFFSITE_CONVERSIONS", event: "LEAD" },
  sales: { objective: "OUTCOME_SALES", optimization_goal: "OFFSITE_CONVERSIONS", event: "PURCHASE" },
  awareness: { objective: "OUTCOME_AWARENESS", optimization_goal: "REACH" },
};

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await requireAdmin(base44);
    if (!user) return json({ error: "Only Justin (admin) can approve ad changes." }, 403);
    const body = await req.json().catch(() => ({}));
    if (body.confirm !== true) return json({ error: "Missing explicit confirmation." }, 400);
    const db = base44.asServiceRole.entities;
    const { settings } = await loadSettings(db);
    const cap = num(settings.monthly_budget_cap) || null;
    const action = String(body.action || "");
    const actor = user.email;

    /* ---------- reject is local ---------- */
    if (action === "decide" && body.decision === "reject") {
      const rec = await db.AdRecommendation.get(String(body.recommendation_id));
      if (!rec) return json({ error: "Not found" }, 404);
      await db.AdRecommendation.update(rec.id, { status: "rejected", decided_by: actor, decided_at: new Date().toISOString(), outcome_note: String(body.note || "") });
      return json({ ok: true, status: "rejected" });
    }

    const needsMeta = ["decide", "push_draft", "launch", "pause"].includes(action);
    const token = needsMeta ? await metaToken(base44) : null;

    /* ---------- decide / approve ---------- */
    if (action === "decide") {
      const rec = await db.AdRecommendation.get(String(body.recommendation_id));
      if (!rec) return json({ error: "Not found" }, 404);
      if (rec.status !== "proposed") return json({ error: `Already ${rec.status}` }, 409);
      const decided = { decided_by: actor, decided_at: new Date().toISOString() };
      if (!rec.executable) {
        await db.AdRecommendation.update(rec.id, { status: "approved", ...decided, outcome_note: String(body.note || "") });
        return json({ ok: true, status: "approved", executed: false });
      }
      if (!token) return json({ error: "Meta Ads isn't connected, so this can't be applied." }, 400);
      const g = graph(token, settings.graph_version);
      const pc = rec.proposed_change || {};
      const mtd = await monthToDateSpend(db, rec.client_id || "");
      const fail = async (msg: string, status = 422, result = "blocked") => {
        await logChange(db, { action: rec.type === "pause" ? "pause" : "budget_change", platform: "meta", account_ref: rec.account_ref, target_level: rec.target_level, target_external_id: rec.target_external_id, target_name: rec.target_name, actor, recommendation_id: rec.id, result, message: msg });
        return json({ error: msg }, status);
      };

      async function setBudget(extId: string, name: string, to: number, increase: boolean) {
        const live = await g.get(extId, { fields: "daily_budget,status,name,account_id" });
        const acct = await g.get(actId(live.account_id), { fields: "currency" }).catch(() => ({ currency: "USD" }));
        const cur = acct.currency || "USD";
        const current = toMajor(live.daily_budget, cur);
        if (current === null || current <= 0) throw new Error(`${name} has no ad-set daily budget (campaign budget or lifetime budget) — change it in Ads Manager.`);
        if (increase && cap && mtd >= cap) throw new Error(`Month-to-date spend ${mtd} has reached the monthly cap ${cap}. Increases are blocked.`);
        const gate = await budgetGate(db, settings, extId, current, to);
        let target = to;
        if (!gate.ok) {
          if (!body.accept_clamped) throw Object.assign(new Error(`Change exceeds the ${gate.pct}%/day cap. Allowed today: ${gate.lo}–${gate.hi} (from ${gate.baseline}).`), { clamp: gate });
          target = gate.clamped;
        }
        await g.post(extId, { daily_budget: toMinor(target, cur) });
        await logChange(db, { action: "budget_change", platform: "meta", account_ref: rec.account_ref, target_level: "adset", target_external_id: extId, target_name: name, before: { daily_budget: current, status: live.status }, after: { daily_budget: target }, actor, recommendation_id: rec.id, result: "ok", message: `${current} → ${target} (${round(((target - current) / current) * 100, 1)}%)` });
        const local = ((await db.AdSet.filter({ platform: "meta", external_id: extId }, "-updated_date", 1).catch(() => [])) || [])[0];
        if (local) await db.AdSet.update(local.id, { daily_budget: target });
        return { before: current, after: target };
      }

      try {
        let before: any = {}, after: any = {};
        if (rec.type === "budget_increase" || rec.type === "budget_decrease") {
          const r = await setBudget(rec.target_external_id, rec.target_name, num(pc.to), rec.type === "budget_increase");
          before = { daily_budget: r.before }; after = { daily_budget: r.after };
        } else if (rec.type === "budget_shift") {
          const a = await setBudget(pc.from_id, rec.target_name, num(pc.from_after), false);
          const b = await setBudget(pc.to_id, rec.secondary_name, num(pc.to_after), true);
          before = { from: a.before, to: b.before }; after = { from: a.after, to: b.after };
        } else if (rec.type === "pause") {
          const live = await g.get(rec.target_external_id, { fields: "status" });
          await g.post(rec.target_external_id, { status: "PAUSED" });
          await logChange(db, { action: "pause", platform: "meta", account_ref: rec.account_ref, target_level: rec.target_level, target_external_id: rec.target_external_id, target_name: rec.target_name, before: { status: live.status }, after: { status: "PAUSED" }, actor, recommendation_id: rec.id, result: "ok" });
          before = { status: live.status }; after = { status: "PAUSED" };
        } else {
          return await fail(`Type ${rec.type} can't be executed from the inbox.`);
        }
        await db.AdRecommendation.update(rec.id, { status: "executed", ...decided, executed_at: new Date().toISOString(), before, after, outcome_note: String(body.note || "") });
        return json({ ok: true, status: "executed", before, after });
      } catch (e: any) {
        const msg = String(e?.message || e).slice(0, 600);
        if (e?.clamp) return json({ error: msg, clamp: e.clamp }, 422);
        await db.AdRecommendation.update(rec.id, { error: msg });
        return await fail(msg, 422, msg.startsWith("Meta API") ? "error" : "blocked");
      }
    }

    /* ---------- manual pause ---------- */
    if (action === "pause") {
      if (!token) return json({ error: "Meta Ads isn't connected." }, 400);
      const g = graph(token, settings.graph_version);
      const id = String(body.external_id || "");
      const live = await g.get(id, { fields: "status" });
      await g.post(id, { status: "PAUSED" });
      await logChange(db, { action: "pause", platform: "meta", target_level: String(body.level || ""), target_external_id: id, target_name: String(body.name || ""), before: { status: live.status }, after: { status: "PAUSED" }, actor, result: "ok" });
      return json({ ok: true });
    }

    /* ---------- push a draft (PAUSED) ---------- */
    if (action === "push_draft") {
      if (!token) return json({ error: "Meta Ads isn't connected." }, 400);
      const g = graph(token, settings.graph_version);
      const camp = await db.AdCampaign.get(String(body.campaign_id));
      if (!camp) return json({ error: "Draft not found" }, 404);
      if (camp.external_id) return json({ error: "Already pushed" }, 409);
      if (!["pass", "warn"].includes(camp.policy_status)) return json({ error: `Policy check is ${camp.policy_status || "missing"} — run it and fix hard fails first.` }, 422);
      const account = await db.AdAccount.get(camp.account_ref).catch(() => null);
      if (!account || account.platform !== "meta") return json({ error: "Pick a Meta ad account for this draft." }, 422);
      if (!account.page_id) return json({ error: "Add the Facebook Page id to the ad account under Connections." }, 422);
      const d = camp.draft || {};
      const s = d.adset || {};
      const daily = num(s.daily_budget);
      if (!(daily > 0)) return json({ error: "Set a daily budget on the draft." }, 422);
      if (cap && daily > cap) return json({ error: `Daily budget ${daily} is above the monthly cap ${cap}.` }, 422);
      const obj = OBJECTIVES[d.goal || "traffic"] || OBJECTIVES.traffic;
      if (obj.event && !account.pixel_id) return json({ error: "Conversion objectives need the pixel id on the ad account." }, 422);
      const creatives = (await Promise.all((d.creative_ids || []).map((id: string) => db.AdCreative.get(id).catch(() => null)))).filter(Boolean) as any[];
      if (!creatives.length) return json({ error: "No creatives in this draft." }, 422);
      const bad = creatives.find((c) => c.policy_status === "fail" || c.policy_status === "unchecked");
      if (bad) return json({ error: `Creative "${bad.name}" policy is ${bad.policy_status}.` }, 422);
      const cur = account.currency || "USD";
      const act = actId(account.account_id);
      const sac = (camp.special_ad_categories || []).filter((x: string) => x && x !== "NONE");
      const created: any = { ads: [] };
      try {
        const c = await g.post(`${act}/campaigns`, { name: camp.name, objective: obj.objective, status: "PAUSED", special_ad_categories: sac, is_adset_budget_sharing_enabled: false });
        created.campaign = c.id;
        const targeting: any = { geo_locations: { countries: (s.countries && s.countries.length ? s.countries : ["US"]) } };
        if (s.regions?.length) targeting.geo_locations = { regions: s.regions.map((key: string) => ({ key })) };
        if (!sac.length) { targeting.age_min = num(s.age_min) || 18; targeting.age_max = num(s.age_max) || 65; }
        const set = await g.post(`${act}/adsets`, {
          name: s.name || `${camp.name} — ad set`, campaign_id: c.id, daily_budget: toMinor(daily, cur), billing_event: "IMPRESSIONS",
          optimization_goal: obj.optimization_goal, bid_strategy: "LOWEST_COST_WITHOUT_CAP", targeting, status: "PAUSED",
          ...(obj.event ? { promoted_object: { pixel_id: account.pixel_id, custom_event_type: obj.event } } : {}),
        });
        created.adset = set.id;
        for (const cr of creatives) {
          const ratio = d.image_ratio || "4:5";
          const imgUrl = cr.image_urls?.[ratio] || cr.image_urls?.["1:1"] || cr.image_urls?.["4:5"];
          if (!imgUrl) throw new Error(`Creative "${cr.name}" has no exported image.`);
          const buf = await (await fetch(imgUrl)).arrayBuffer();
          const img = await g.post(`${act}/adimages`, { bytes: toBase64(buf) });
          const hash = Object.values(img.images || {})[0] as any;
          const link = cr.final_url || cr.destination_url;
          const story: any = { page_id: account.page_id, link_data: { image_hash: hash?.hash, link, message: cr.primary_text || "", name: cr.headline || "", description: cr.description || "", call_to_action: { type: cr.cta || "LEARN_MORE", value: { link } } } };
          if (account.instagram_user_id) story.instagram_user_id = account.instagram_user_id;
          const adc = await g.post(`${act}/adcreatives`, { name: cr.name, object_story_spec: story });
          const ad = await g.post(`${act}/ads`, { name: cr.name, adset_id: set.id, creative: { creative_id: adc.id }, status: "PAUSED" });
          created.ads.push(ad.id);
          await db.AdCreative.update(cr.id, { status: "pushed" });
        }
        await db.AdCampaign.update(camp.id, { external_id: c.id, objective: obj.objective, status: "pushed_paused", pushed_at: new Date().toISOString(), draft: { ...d, pushed: created } });
        await logChange(db, { action: "push_draft", platform: "meta", account_ref: account.id, target_level: "campaign", target_external_id: c.id, target_name: camp.name, before: {}, after: { status: "PAUSED", ...created, daily_budget: daily }, actor, result: "ok" });
        return json({ ok: true, created });
      } catch (e) {
        const msg = String((e as Error)?.message || e).slice(0, 600);
        await logChange(db, { action: "push_draft", platform: "meta", account_ref: account.id, target_level: "campaign", target_name: camp.name, after: created, actor, result: "error", message: `${msg}${created.campaign ? " — partial objects were created PAUSED on Meta; delete them in Ads Manager or push again after fixing." : ""}` });
        return json({ error: msg, partial: created }, 422);
      }
    }

    /* ---------- launch (separate approval) ---------- */
    if (action === "launch") {
      if (!token) return json({ error: "Meta Ads isn't connected." }, 400);
      const g = graph(token, settings.graph_version);
      const camp = await db.AdCampaign.get(String(body.campaign_id));
      if (!camp || !camp.external_id) return json({ error: "Push the draft first." }, 422);
      if (!["pushed_paused", "paused"].includes(camp.status)) return json({ error: `Campaign is ${camp.status}.` }, 409);
      const mtd = await monthToDateSpend(db, camp.client_id || "");
      if (cap && mtd >= cap) return json({ error: `Month-to-date spend ${mtd} has reached the monthly cap ${cap}. Raise the cap in Goals first.` }, 422);
      const pushed = camp.draft?.pushed || {};
      const ids = [camp.external_id, pushed.adset, ...(pushed.ads || [])].filter(Boolean);
      const done: string[] = [];
      try {
        // Children first so nothing delivers half-configured; the campaign switch is last.
        for (const id of ids.slice(1)) { await g.post(id, { status: "ACTIVE" }); done.push(id); }
        await g.post(camp.external_id, { status: "ACTIVE" });
        done.push(camp.external_id);
      } catch (e) {
        const msg = String((e as Error)?.message || e).slice(0, 600);
        await logChange(db, { action: "launch", platform: "meta", target_level: "campaign", target_external_id: camp.external_id, target_name: camp.name, after: { activated: done }, actor, result: "error", message: msg });
        return json({ error: msg, activated: done }, 422);
      }
      await db.AdCampaign.update(camp.id, { status: "active", launched_at: new Date().toISOString() });
      await logChange(db, { action: "launch", platform: "meta", target_level: "campaign", target_external_id: camp.external_id, target_name: camp.name, before: { status: "PAUSED", mtd_spend: mtd }, after: { status: "ACTIVE", activated: done }, actor, result: "ok" });
      return json({ ok: true });
    }

    return json({ error: `Unknown action ${action}` }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
