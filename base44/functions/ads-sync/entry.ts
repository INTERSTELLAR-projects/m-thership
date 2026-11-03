// Ads Studio — read-only sync from the Meta Marketing API (via the app's "meta_ads" connector) into
// AdAccount / AdCampaign / AdSet / Ad / AdMetricDaily. Never changes anything on Meta.
//   status            → connector state + stored accounts (admin)
//   list_meta_accounts→ ad accounts the connected Meta user can see (admin)
//   add_account       → store/enable one Meta ad account {account_id, name, currency, timezone} (admin)
//   sync              → pull structure + daily insights for the last `days` (default 30) (admin)
//   scheduled         → daily automation: same as sync for every connected Meta account, at most once per 20h
// Google Ads has no connector: its numbers arrive through the CSV import in the UI.
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { actId, daysAgo, graph, loadSettings, logChange, metaToken, metricFromInsight, num, requireAdmin, toMajor } from "../../shared/ads.ts";

const json = (b: unknown, status = 200) => Response.json(b, { status });

async function upsertBy(db: any, entity: string, match: Record<string, unknown>, data: Record<string, unknown>) {
  const rows = (await db[entity].filter(match, "-updated_date", 1).catch(() => [])) || [];
  if (rows[0]) {
    await db[entity].update(rows[0].id, data);
    return rows[0].id;
  }
  const c = await db[entity].create({ ...match, ...data });
  return c.id;
}

async function pool<T>(items: T[], n: number, fn: (t: T) => Promise<unknown>) {
  let i = 0;
  const run = async () => {
    while (i < items.length) {
      const t = items[i++];
      await fn(t).catch(() => null);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, run));
}

async function syncAccount(db: any, g: any, account: any, settings: any, days: number) {
  const act = actId(account.account_id);
  const cur = account.currency || "USD";
  const now = new Date().toISOString();
  const counts = { campaigns: 0, adsets: 0, ads: 0, metrics_new: 0, metrics_updated: 0 };

  const info = await g.get(act, { fields: "name,currency,timezone_name,account_status" }).catch(() => null);
  if (info) {
    await db.AdAccount.update(account.id, {
      name: account.name || info.name,
      currency: info.currency || cur,
      timezone: info.timezone_name || account.timezone,
      status: info.account_status === 1 ? "active" : "disabled",
    });
  }

  const campaigns = await g.all(`${act}/campaigns`, { fields: "id,name,objective,status,effective_status,daily_budget,lifetime_budget,special_ad_categories" });
  const campRef: Record<string, string> = {};
  for (const c of campaigns) {
    const status = c.status === "ACTIVE" ? "active" : c.status === "PAUSED" ? "paused" : c.status === "ARCHIVED" ? "archived" : c.status === "DELETED" ? "deleted" : "unknown";
    const existing = ((await db.AdCampaign.filter({ platform: "meta", external_id: c.id }, "-updated_date", 1).catch(() => [])) || [])[0];
    const data: Record<string, unknown> = {
      account_ref: account.id, name: c.name, objective: c.objective, effective_status: c.effective_status,
      daily_budget: toMajor(c.daily_budget, cur), lifetime_budget: toMajor(c.lifetime_budget, cur),
      special_ad_categories: c.special_ad_categories || [], client_id: account.client_id || "", last_synced_at: now,
    };
    // An in-app draft pushed as PAUSED keeps its "pushed_paused" state until it is actually launched.
    if (!(existing && existing.status === "pushed_paused" && status === "paused")) data.status = status;
    if (existing) {
      await db.AdCampaign.update(existing.id, data);
      campRef[c.id] = existing.id;
    } else {
      const row = await db.AdCampaign.create({ platform: "meta", external_id: c.id, origin: "synced", ...data });
      campRef[c.id] = row.id;
    }
    counts.campaigns++;
  }

  const adsets = await g.all(`${act}/adsets`, { fields: "id,name,campaign_id,status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,targeting" });
  const setRef: Record<string, string> = {};
  await pool(adsets, 4, async (s: any) => {
    setRef[s.id] = await upsertBy(db, "AdSet", { platform: "meta", external_id: s.id }, {
      account_ref: account.id, campaign_ref: campRef[s.campaign_id] || "", external_campaign_id: s.campaign_id, name: s.name,
      status: s.status, effective_status: s.effective_status, daily_budget: toMajor(s.daily_budget, cur), lifetime_budget: toMajor(s.lifetime_budget, cur),
      optimization_goal: s.optimization_goal, billing_event: s.billing_event, targeting: s.targeting || {}, client_id: account.client_id || "", last_synced_at: now,
    });
    counts.adsets++;
  });

  const ads = await g.all(`${act}/ads`, { fields: "id,name,adset_id,campaign_id,status,effective_status,creative{id,thumbnail_url,title,body}" });
  await pool(ads, 4, async (a: any) => {
    await upsertBy(db, "Ad", { platform: "meta", external_id: a.id }, {
      account_ref: account.id, campaign_ref: campRef[a.campaign_id] || "", adset_ref: setRef[a.adset_id] || "", external_adset_id: a.adset_id,
      external_campaign_id: a.campaign_id, name: a.name, status: a.status, effective_status: a.effective_status,
      external_creative_id: a.creative?.id || "", thumbnail_url: a.creative?.thumbnail_url || "", headline: a.creative?.title || "", body: a.creative?.body || "",
      client_id: account.client_id || "", last_synced_at: now,
    });
    counts.ads++;
  });

  // Daily insights at three levels. Only real numbers Meta returns are stored; days with no delivery have no row.
  const since = daysAgo(days);
  const until = daysAgo(0);
  const existing = (await db.AdMetricDaily.filter({ platform: "meta", account_ref: account.id, date: { $gte: since } }, "-date", 10000).catch(() => [])) || [];
  const byKey = new Map(existing.map((r: any) => [r.key, r]));
  const fresh: any[] = [];
  const changed: any[] = [];
  for (const level of ["campaign", "adset", "ad"]) {
    const fields = "campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,impressions,reach,frequency,clicks,actions,action_values";
    const rows = await g.all(`${act}/insights`, { level, fields, time_increment: 1, time_range: { since, until } }, 20000);
    for (const r of rows) {
      const m = metricFromInsight(r, level, settings, { ...account, currency: info?.currency || cur });
      const prev: any = byKey.get(m.key);
      if (!prev) fresh.push(m);
      else if (["spend", "impressions", "clicks", "conversions", "revenue", "reach"].some((k) => num(prev[k]) !== num((m as any)[k]))) changed.push({ id: prev.id, data: m });
    }
  }
  for (let i = 0; i < fresh.length; i += 200) await db.AdMetricDaily.bulkCreate(fresh.slice(i, i + 200));
  await pool(changed, 5, (c: any) => db.AdMetricDaily.update(c.id, c.data));
  counts.metrics_new = fresh.length;
  counts.metrics_updated = changed.length;

  await db.AdAccount.update(account.id, { connected: true, last_synced_at: now, last_sync_error: "" });
  return counts;
}

async function syncAll(base44: any, db: any, settings: any, onlyRef?: string, days = 30) {
  const token = await metaToken(base44);
  if (!token) return { ok: false, error: "Meta Ads isn't connected yet. Base44 dashboard → Integrations → Meta Ads, then pick the ad account here." };
  const g = graph(token, settings.graph_version);
  const accounts = ((await db.AdAccount.filter({ platform: "meta" }, "-created_date", 50)) || []).filter((a: any) => a.connected !== false && (!onlyRef || a.id === onlyRef));
  if (!accounts.length) return { ok: false, error: "No Meta ad account picked yet. Choose one under Connections." };
  const results: any[] = [];
  for (const a of accounts) {
    try {
      results.push({ account: a.name || a.account_id, ...(await syncAccount(db, g, a, settings, days)) });
    } catch (e) {
      const msg = String((e as Error)?.message || e).slice(0, 500);
      await db.AdAccount.update(a.id, { last_sync_error: msg });
      results.push({ account: a.name || a.account_id, error: msg });
    }
  }
  return { ok: results.every((r) => !r.error), results };
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "status");
    const user = await requireAdmin(base44);
    const { row, settings } = await loadSettings(db);

    if (action === "scheduled") {
      // Called by the daily automation (no user). Read-only, throttled.
      const last = row?.last_sync_run ? Date.parse(row.last_sync_run) : 0;
      if (!user && Date.now() - last < 20 * 3600000) return json({ skipped: true, reason: "Synced in the last 20h", last: row?.last_sync_run });
      const out = await syncAll(base44, db, settings, undefined, num(body.days) || 30);
      if (row) await db.AdSettings.update(row.id, { last_sync_run: new Date().toISOString() });
      else await db.AdSettings.create({ scope: "agency", last_sync_run: new Date().toISOString() });
      await logChange(db, { action: "sync", platform: "meta", actor: user ? user.email : "automation", result: out.ok ? "ok" : "error", message: JSON.stringify(out).slice(0, 1800) });
      return json(out);
    }

    if (!user) return json({ error: "Admins only" }, 403);

    if (action === "status") {
      const token = await metaToken(base44);
      const accounts = (await db.AdAccount.list("-created_date", 50)) || [];
      return json({ meta_connected: !!token, accounts, settings, google: { connector: false, note: "No Base44 connector for Google Ads. Use CSV import, or a developer token + OAuth client later." } });
    }

    if (action === "list_meta_accounts") {
      const token = await metaToken(base44);
      if (!token) return json({ error: "Meta Ads isn't connected yet." }, 400);
      const g = graph(token, settings.graph_version);
      const list = await g.all("me/adaccounts", { fields: "account_id,name,currency,timezone_name,account_status,business{name}" }, 200);
      return json({ accounts: list });
    }

    if (action === "add_account") {
      const id = String(body.account_id || "").replace(/^act_/, "").trim();
      if (!/^\d+$/.test(id)) return json({ error: "account_id must be the numeric Meta ad account id" }, 400);
      const ref = await upsertBy(db, "AdAccount", { platform: "meta", account_id: id }, {
        name: String(body.name || ""), currency: String(body.currency || "USD"), timezone: String(body.timezone || ""),
        connected: true, source: "connector", client_id: String(body.client_id || ""), is_primary: !!body.is_primary,
      });
      return json({ ok: true, id: ref });
    }

    if (action === "sync") {
      const out = await syncAll(base44, db, settings, body.account_ref ? String(body.account_ref) : undefined, Math.min(90, num(body.days) || 30));
      await logChange(db, { action: "sync", platform: "meta", actor: user.email, result: out.ok ? "ok" : "error", message: JSON.stringify(out).slice(0, 1800) });
      return json(out, out.ok || out.results ? 200 : 400);
    }

    return json({ error: `Unknown action ${action}` }, 400);
  } catch (e) {
    return json({ error: String((e as Error)?.message || e) }, 500);
  }
}
