// Ads Studio optimisation agent. Reads ONLY real synced/imported numbers (AdMetricDaily), the goals in
// AdSettings and the learnings log, then PROPOSES AdRecommendations for Justin's approval inbox.
// It never spends, launches, unpauses or raises a budget. The only things it may do by itself are the two
// pause rules Justin can switch on in Settings (both off by default, both capped and logged):
//   auto_pause  → pause up to max_per_day ads/ad sets under roas_below after min_spend over lookback_days
//   pause_at_cap→ pause active Meta campaigns once month-to-date spend reaches the monthly cap
// Actions: run (admin, any time) | scheduled (daily automation, at most once per 20h).
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { daysAgo, graph, loadSettings, logChange, metaToken, monthToDateSpend, num, requireAdmin, round } from "../../shared/ads.ts";

const json = (b: unknown, status = 200) => Response.json(b, { status });

type Agg = { spend: number; impressions: number; clicks: number; conversions: number; revenue: number; reach: number; freqW: number; days: number };
const empty = (): Agg => ({ spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, reach: 0, freqW: 0, days: 0 });
function add(a: Agg, r: any) {
  a.spend += num(r.spend); a.impressions += num(r.impressions); a.clicks += num(r.clicks); a.conversions += num(r.conversions);
  a.revenue += num(r.revenue); a.reach += num(r.reach); a.freqW += num(r.frequency) * num(r.impressions); a.days += 1;
}
const derive = (a: Agg) => ({
  spend: round(a.spend), impressions: a.impressions, clicks: a.clicks, conversions: a.conversions, revenue: round(a.revenue),
  ctr: a.impressions ? round((a.clicks / a.impressions) * 100, 3) : 0,
  cpc: a.clicks ? round(a.spend / a.clicks) : null, cpa: a.conversions ? round(a.spend / a.conversions) : null,
  roas: a.spend ? round(a.revenue / a.spend, 2) : null, frequency: a.impressions ? round(a.freqW / a.impressions, 2) : null, days: a.days,
});

const REC_SCHEMA = {
  type: "object",
  properties: {
    recommendations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          candidate_id: { type: "string", description: "id of a candidate you keep (copy exactly), or empty for a new idea" },
          type: { type: "string", enum: ["budget_increase", "budget_decrease", "budget_shift", "pause", "creative_refresh", "new_variant", "audience", "other"] },
          target_external_id: { type: "string" },
          title: { type: "string" },
          rationale: { type: "string" },
          expected_impact: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
          variant_headline: { type: "string" },
          variant_primary_text: { type: "string" },
        },
        required: ["type", "title", "rationale", "expected_impact", "confidence"],
      },
    },
    learnings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["hook", "format", "audience", "offer", "placement", "budget", "creative", "other"] },
          insight: { type: "string" },
          evidence: { type: "string" },
          confidence: { type: "string", enum: ["low", "medium", "high"] },
        },
        required: ["kind", "insight", "evidence"],
      },
    },
    summary: { type: "string" },
  },
  required: ["recommendations", "learnings"],
};

Deno.serve(async (req: Request) => {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const user = await requireAdmin(base44);
    const { row: settingsRow, settings } = await loadSettings(db);
    if (!user) {
      if (body.action !== "scheduled") return json({ error: "Admins only" }, 403);
      const last = settingsRow?.last_optimizer_run ? Date.parse(settingsRow.last_optimizer_run) : 0;
      if (Date.now() - last < 20 * 3600000) return json({ skipped: true, reason: "Ran in the last 20h" });
      if (settings.optimizer_enabled === false) return json({ skipped: true, reason: "Optimizer is switched off in Ads Studio settings" });
    }
    const stamp = new Date().toISOString();
    const markRun = async () => {
      if (settingsRow) await db.AdSettings.update(settingsRow.id, { last_optimizer_run: stamp });
      else await db.AdSettings.create({ scope: "agency", last_optimizer_run: stamp });
    };

    const metrics = ((await db.AdMetricDaily.filter({ date: { $gte: daysAgo(28) } }, "-date", 10000).catch(() => [])) || []).filter((m: any) => !m.client_id);
    if (!metrics.length) {
      await markRun();
      return json({ ok: true, skipped: true, reason: "No ad performance data yet — connect Meta Ads or import a Google Ads CSV first. No recommendations were made." });
    }

    const [adsets, ads, campaigns, learnings, recent] = await Promise.all([
      db.AdSet.filter({ platform: "meta" }, "-updated_date", 1000).catch(() => []),
      db.Ad.filter({ platform: "meta" }, "-updated_date", 2000).catch(() => []),
      db.AdCampaign.list("-updated_date", 500).catch(() => []),
      db.AdLearning.filter({ active: true }, "-created_date", 40).catch(() => []),
      db.AdRecommendation.list("-created_date", 40).catch(() => []),
    ]);
    const setByExt = new Map((adsets || []).map((s: any) => [s.external_id, s]));
    const adByExt = new Map((ads || []).map((a: any) => [a.external_id, a]));
    const campByExt = new Map((campaigns || []).filter((c: any) => c.external_id).map((c: any) => [c.external_id, c]));

    // Aggregate last 7 days vs the 7 before, per object.
    const d7 = daysAgo(7), d14 = daysAgo(14);
    const objs = new Map<string, { level: string; external_id: string; name: string; platform: string; account_ref: string; cur: Agg; prev: Agg; all: Agg; campaign: string }>();
    for (const m of metrics) {
      const k = `${m.platform}|${m.level}|${m.external_id}`;
      if (!objs.has(k)) objs.set(k, { level: m.level, external_id: m.external_id, name: m.name, platform: m.platform, account_ref: m.account_ref, cur: empty(), prev: empty(), all: empty(), campaign: m.campaign_external_id });
      const o = objs.get(k)!;
      add(o.all, m);
      if (m.date >= d7) add(o.cur, m);
      else if (m.date >= d14) add(o.prev, m);
    }
    const table = [...objs.values()].map((o) => ({ ...o, c: derive(o.cur), p: derive(o.prev), a: derive(o.all) }));

    const tROAS = num(settings.target_roas) || null;
    const tCPA = num(settings.target_cpa) || null;
    const pct = settings.max_budget_change_pct;
    const cap = num(settings.monthly_budget_cap) || null;
    const mtd = await monthToDateSpend(db, "");
    const now = new Date();
    const dim = new Date(now.getUTCFullYear(), now.getUTCMonth() + 1, 0).getDate();
    const projected = round((mtd / Math.max(1, now.getUTCDate())) * dim);
    const atCap = !!cap && mtd >= cap;

    // Deterministic candidates (numbers come from the table, never from the model).
    const candidates: any[] = [];
    const minSpend = Math.max(num(settings.auto_pause?.min_spend) || 50, tCPA ? tCPA * 2 : 0);
    for (const o of table) {
      if (o.platform !== "meta" || !["adset", "ad"].includes(o.level)) continue;
      const live = o.level === "adset" ? setByExt.get(o.external_id) : adByExt.get(o.external_id);
      if (!live || String(live.effective_status || live.status).toUpperCase() !== "ACTIVE") continue;
      const losing = o.c.spend >= minSpend && ((tROAS && o.c.roas !== null && o.c.roas < tROAS * 0.5) || (tCPA && (o.c.cpa === null || o.c.cpa > tCPA * 2)));
      const winning = o.c.conversions >= 3 && ((tROAS && (o.c.roas || 0) >= tROAS * 1.2) || (tCPA && o.c.cpa !== null && o.c.cpa <= tCPA * 0.8));
      const fatigued = o.level === "ad" && (o.c.frequency || 0) >= 3 && o.p.ctr > 0 && o.c.ctr < o.p.ctr * 0.75 && o.c.impressions >= 1000;
      const snap = { last_7d: o.c, prior_7d: o.p, last_28d: o.a };
      if (losing) candidates.push({ id: `c${candidates.length}`, type: "pause", level: o.level, external_id: o.external_id, name: o.name, account_ref: o.account_ref, snap });
      if (fatigued) candidates.push({ id: `c${candidates.length}`, type: "creative_refresh", level: o.level, external_id: o.external_id, name: o.name, account_ref: o.account_ref, snap });
      if (o.level === "adset" && live.daily_budget) {
        const b = num(live.daily_budget);
        if (winning && !atCap) candidates.push({ id: `c${candidates.length}`, type: "budget_increase", level: "adset", external_id: o.external_id, name: o.name, account_ref: o.account_ref, snap, from: b, to: round(b * (1 + pct / 100)) });
        if (losing) candidates.push({ id: `c${candidates.length}`, type: "budget_decrease", level: "adset", external_id: o.external_id, name: o.name, account_ref: o.account_ref, snap, from: b, to: round(b * (1 - pct / 100)) });
      }
    }
    // A shift: biggest loser ad set funds the best winner, both within the cap.
    const incs = candidates.filter((c) => c.type === "budget_increase");
    const decs = candidates.filter((c) => c.type === "budget_decrease");
    if (incs.length && decs.length) {
      const w = incs[0], l = decs[0];
      const move = round(Math.min(l.from - l.to, w.to - w.from));
      if (move > 0) candidates.push({ id: `c${candidates.length}`, type: "budget_shift", level: "adset", external_id: l.external_id, name: l.name, secondary_external_id: w.external_id, secondary_name: w.name, account_ref: l.account_ref, snap: { from: l.snap, to: w.snap }, shift: { from_id: l.external_id, from_before: l.from, from_after: round(l.from - move), to_id: w.external_id, to_before: w.from, to_after: round(w.from + move), amount: move } });
    }

    // Ask the model to choose, explain and add creative/audience ideas — grounded in the table.
    const sections = (await db.AgencyKnowledge.list("sort", 100).catch(() => [])) || [];
    const offers = (sections.find((s: any) => s.key === "offers")?.data?.offers || []).map((o: any) => `${o.name}: $${o.price}${o.billing === "monthly" ? "/mo" : ""}`).join("; ");
    const voice = String(sections.find((s: any) => s.key === "voice")?.body || "").slice(0, 1200);
    const brief = table
      .filter((o) => o.a.spend > 0)
      .sort((a, b) => b.a.spend - a.a.spend)
      .slice(0, 40)
      .map((o) => `${o.level} ${o.external_id} "${o.name}" | 7d: spend ${o.c.spend}, conv ${o.c.conversions}, CPA ${o.c.cpa ?? "-"}, ROAS ${o.c.roas ?? "-"}, CTR ${o.c.ctr}%, freq ${o.c.frequency ?? "-"} | prior 7d: spend ${o.p.spend}, CTR ${o.p.ctr}%, ROAS ${o.p.roas ?? "-"}`)
      .join("\n");
    const prompt = `You are the ads optimisation analyst for Interstellar Strategies (a digital agency). You PROPOSE changes; a human approves every one. Never claim results you can't see in the data.
Goals: target ROAS ${tROAS ?? "not set"}, target CPA ${tCPA ?? "not set"}, monthly cap ${cap ?? "not set"} (month-to-date spend ${mtd}, projected ${projected}${atCap ? ", CAP REACHED — do not propose any increase" : ""}). Max budget change per object per day: ${pct}%.

Performance (real numbers, last 7 days vs the 7 before):
${brief || "(no spend yet)"}

Deterministic candidates already computed (keep, drop or reword them; never change their numbers):
${JSON.stringify(candidates.map((c) => ({ candidate_id: c.id, type: c.type, target: c.external_id, name: c.name, from: c.from, to: c.to, shift: c.shift })))}

What has worked before (learnings log):
${(learnings || []).map((l: any) => `- [${l.kind}] ${l.insight} (${l.evidence || ""})`).join("\n") || "(none yet)"}

Recent recommendations and outcomes:
${(recent || []).slice(0, 20).map((r: any) => `- ${r.type} ${r.target_name || ""}: ${r.status}${r.outcome_note ? ` → ${r.outcome_note}` : ""}`).join("\n") || "(none yet)"}

Offers and prices you may mention (ONLY these): ${offers || "(none on file — do not mention prices)"}
Voice rules: ${voice || "plain, confident, no hype"}. No fake urgency or scarcity, no guarantees, no personal-attribute framing ("Are you struggling…").

Return:
- recommendations: keep useful candidates (copy candidate_id), and add up to 3 new ideas of type new_variant (with variant_headline + variant_primary_text), audience or creative_refresh. Rationale must cite the numbers above. expected_impact must be a cautious, qualitative estimate (e.g. "should lower CPA if the CTR gap holds") — never a promise.
- learnings: up to 3 durable lessons supported by the numbers (hooks, formats, audiences, offers). Skip if the data is too thin.`;

    let llm: any = null;
    try {
      llm = await base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: REC_SCHEMA });
    } catch (_e) {
      llm = null;
    }

    const runId = `opt_${stamp}`;
    const byId = new Map(candidates.map((c) => [c.id, c]));
    const chosen: any[] = [];
    const llmRecs: any[] = llm?.recommendations || candidates.map((c) => ({ candidate_id: c.id, type: c.type, title: "", rationale: "", expected_impact: "", confidence: "medium" }));
    for (const r of llmRecs.slice(0, 12)) {
      const c = r.candidate_id ? byId.get(r.candidate_id) : null;
      if (r.candidate_id && !c) continue; // model invented an id
      const type = c ? c.type : r.type;
      if (!c && ["budget_increase", "budget_decrease", "budget_shift", "pause"].includes(type)) continue; // money/pause moves only from computed candidates
      if (atCap && type === "budget_increase") continue;
      const target = c || (r.target_external_id ? table.find((o) => o.external_id === r.target_external_id) : null);
      const rec: any = {
        account_ref: target?.account_ref || "", platform: "meta", run_id: runId, type,
        title: r.title || (c ? `${type.replace(/_/g, " ")}: ${c.name}` : "Idea"),
        rationale: r.rationale || "Computed from the last 7 days against your targets.",
        expected_impact: r.expected_impact || "", confidence: r.confidence || "medium",
        target_level: target?.level || (type === "new_variant" ? "creative" : "account"),
        target_external_id: target?.external_id || "", target_name: target?.name || "",
        metrics_snapshot: c ? c.snap : target ? { last_7d: (target as any).c, prior_7d: (target as any).p } : {},
        executable: ["budget_increase", "budget_decrease", "budget_shift", "pause"].includes(type),
        status: "proposed", source: "agent",
      };
      if (type === "budget_increase" || type === "budget_decrease") rec.proposed_change = { field: "daily_budget", from: c.from, to: c.to, max_change_pct: pct };
      if (type === "budget_shift") { rec.proposed_change = { field: "daily_budget", ...c.shift, max_change_pct: pct }; rec.secondary_external_id = c.secondary_external_id; rec.secondary_name = c.secondary_name; }
      if (type === "pause") rec.proposed_change = { field: "status", from: "ACTIVE", to: "PAUSED" };
      if (type === "new_variant") rec.proposed_change = { headline: r.variant_headline || "", primary_text: r.variant_primary_text || "" };
      chosen.push(rec);
    }

    // Older proposals for the same target + type are superseded.
    const open = ((await db.AdRecommendation.filter({ status: "proposed" }, "-created_date", 200).catch(() => [])) || []) as any[];
    for (const o of open) if (chosen.some((c) => c.type === o.type && c.target_external_id && c.target_external_id === o.target_external_id)) await db.AdRecommendation.update(o.id, { status: "expired" });
    if (chosen.length) await db.AdRecommendation.bulkCreate(chosen);

    // Learnings (deduped on wording).
    const have = new Set(((await db.AdLearning.list("-created_date", 300).catch(() => [])) || []).map((l: any) => String(l.insight || "").toLowerCase().trim()));
    const newL = (llm?.learnings || []).filter((l: any) => l.insight && !have.has(String(l.insight).toLowerCase().trim())).slice(0, 3).map((l: any) => ({ ...l, source: "agent", active: true, confidence: l.confidence || "low" }));
    if (newL.length) await db.AdLearning.bulkCreate(newL);

    // Opt-in pause rules (off by default). Pausing only ever reduces spend.
    const auto: any[] = [];
    const token = (settings.auto_pause?.enabled || (settings.pause_at_cap && atCap)) ? await metaToken(base44) : null;
    if (token) {
      const g = graph(token, settings.graph_version);
      if (settings.auto_pause?.enabled) {
        const ap = settings.auto_pause;
        const since = daysAgo(num(ap.lookback_days) || 7);
        const todays = ((await db.AdChangeLog.filter({ action: "auto_pause", result: "ok" }, "-created_date", 50).catch(() => [])) || []).filter((r: any) => String(r.created_date || "") >= daysAgo(0)).length;
        let budget = Math.max(0, (num(ap.max_per_day) || 2) - todays);
        const losers = table.filter((o) => o.platform === "meta" && ["ad", "adset"].includes(o.level)).map((o) => {
          const a = empty();
          for (const m of metrics) if (m.external_id === o.external_id && m.level === o.level && m.date >= since) add(a, m);
          return { o, d: derive(a) };
        }).filter(({ o, d }) => {
          const live = o.level === "adset" ? setByExt.get(o.external_id) : adByExt.get(o.external_id);
          return live && String(live.effective_status || live.status).toUpperCase() === "ACTIVE" && d.spend >= num(ap.min_spend) && (d.roas ?? 0) < num(ap.roas_below);
        }).sort((a, b) => b.d.spend - a.d.spend);
        for (const { o, d } of losers) {
          if (budget <= 0) break;
          try {
            await g.post(o.external_id, { status: "PAUSED" });
            budget--;
            await logChange(db, { action: "auto_pause", platform: "meta", account_ref: o.account_ref, target_level: o.level, target_external_id: o.external_id, target_name: o.name, before: { status: "ACTIVE", ...d }, after: { status: "PAUSED" }, actor: "rule:auto_pause", result: "ok", message: `ROAS ${d.roas ?? 0} < ${ap.roas_below} after ${d.spend} spend` });
            await db.AdRecommendation.create({ platform: "meta", run_id: runId, type: "pause", title: `Auto-paused ${o.name}`, rationale: `Your auto-pause rule: ROAS ${d.roas ?? 0} under ${ap.roas_below} after ${d.spend} spend over ${ap.lookback_days} days.`, expected_impact: "Stops spend on this item.", target_level: o.level, target_external_id: o.external_id, target_name: o.name, metrics_snapshot: d, status: "executed", source: "rule", executed_at: new Date().toISOString(), before: { status: "ACTIVE" }, after: { status: "PAUSED" } });
            auto.push(o.name);
          } catch (e) {
            await logChange(db, { action: "auto_pause", platform: "meta", target_external_id: o.external_id, target_name: o.name, actor: "rule:auto_pause", result: "error", message: String((e as Error)?.message || e).slice(0, 500) });
          }
        }
      }
      if (settings.pause_at_cap && atCap) {
        for (const c of (campaigns || []).filter((c: any) => c.platform === "meta" && c.external_id && c.status === "active")) {
          try {
            await g.post(c.external_id, { status: "PAUSED" });
            await db.AdCampaign.update(c.id, { status: "paused" });
            await logChange(db, { action: "auto_pause", platform: "meta", target_level: "campaign", target_external_id: c.external_id, target_name: c.name, before: { status: "ACTIVE", mtd_spend: mtd, cap }, after: { status: "PAUSED" }, actor: "rule:pause_at_cap", result: "ok", message: `Month-to-date spend ${mtd} reached the cap ${cap}` });
            auto.push(c.name);
          } catch (e) {
            await logChange(db, { action: "auto_pause", platform: "meta", target_external_id: c.external_id, target_name: c.name, actor: "rule:pause_at_cap", result: "error", message: String((e as Error)?.message || e).slice(0, 500) });
          }
        }
      }
    }

    await markRun();
    return json({ ok: true, run_id: runId, proposed: chosen.length, learnings: newL.length, auto_paused: auto, mtd_spend: mtd, projected_spend: projected, cap, summary: llm?.summary || "" });
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
});
