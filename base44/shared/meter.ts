// Fuel meter for client Studios. Every metered action writes one UsageLedger row (units can be > 1: weighted AI
// actions, or one row per email campaign). Caps come from the client's plan + HyperCare+ tier (fuel.ts), plus
// per-client admin overrides, plus the client's Refuel wallet (purchased one-time credits, used after the allowance).
//
//   check(db, client, kind, units, { admin, feature })   -> may this run? (writes nothing)
//   record(db, client, kind, units, meta)                -> ledger row (allowance -> wallet -> absorbed buffer),
//                                                           80% alert, out-of-fuel pause + Command Briefing item
//   checkAndRecord(db, client, kind, units, meta)        -> both, for actions whose units are known up front
//   monthUsage(db, clientId, month?)                     -> totals for the month (client usage only counts toward caps)
//
// Studios are HyperCare+ only (fuel.ts studiosUnlocked). Other plans get a small Nøva-only AI allowance.
// Out of fuel: the item already in progress finishes (overshoot up to the buffer, 3% of the cap, is absorbed);
// queued posts / campaigns pause in place and resume after a Refuel or the monthly reset. Nothing is ever locked.
// Admin (Justin) actions are never capped; they are recorded with by_admin=true and never eat a client's fuel.

import { monthKey, dayKeyLA, ALERT_AT, ADS_MIN_GAP_HOURS, ADS_RUNS_PER_MONTH, PLAN_CAPS, capsFor, type UsageKind } from "./usagePlans.ts";
import { loadFuelConfig, allowanceFor, walletOf, fuelLeft, meterUnits, markOutOfFuel, resetLabel } from "./fuel.ts";
import { getSecret } from "./portalClient.ts";

type Db = any;
type Client = Record<string, any>;
type Kind = UsageKind | "media_credit";

export const KIND_LABEL: Record<string, string> = { ai_action: "AI actions", marketing_email: "marketing emails", ads_run: "ads agent runs", media_credit: "media credits" };

export async function monthUsage(db: Db, clientId: string, month = monthKey()) {
  const rows = ((await db.UsageLedger.filter({ client_id: clientId, month }, "-created_date", 5000).catch(() => [])) || []) as any[];
  const out = {
    month,
    ai_action: 0, marketing_email: 0, ads_run: 0, media_credit: 0,
    admin_ai_action: 0, admin_marketing_email: 0, admin_ads_run: 0, admin_media_credit: 0,
    wallet_ai_action: 0, wallet_marketing_email: 0,
    est_cost_usd: 0,
    last_ads_run_at: null as string | null,
    rows: rows.length,
  };
  for (const r of rows) {
    const k = String(r.kind);
    if (!(k in KIND_LABEL)) continue;
    const u = Number(r.units) || 0;
    if (r.by_admin) (out as any)[`admin_${k}`] += u; else (out as any)[k] += u;
    if (!r.by_admin && (k === "ai_action" || k === "marketing_email")) (out as any)[`wallet_${k}`] += Number(r.wallet_units) || 0;
    out.est_cost_usd += Number(r.est_cost_usd) || 0;
    if (k === "ads_run" && (!out.last_ads_run_at || String(r.created_at) > out.last_ads_run_at)) out.last_ads_run_at = String(r.created_at || r.created_date || "");
  }
  out.est_cost_usd = Math.round(out.est_cost_usd * 10000) / 10000;
  return out;
}

export type CheckResult = {
  ok: boolean; code?: string; reason?: string;
  plan: string; plan_label: string; kind: Kind;
  used: number; cap: number | null; remaining: number | null; pct: number | null;
  wallet?: number; left?: number | null; buffer?: number; studios_unlocked?: boolean; reset_on?: string;
};

const UPGRADE = "Studios are included with HyperCare+. Ask us about upgrading from your portal.";

export async function check(db: Db, client: Client, kind: Kind, units = 1, opts: { admin?: boolean; feature?: string } = {}): Promise<CheckResult> {
  const cfg = await loadFuelConfig(db);
  const allow = allowanceFor(client, cfg);
  const usage = await monthUsage(db, String(client.id));
  const caps = capsFor(client);
  const cap = kind === "ads_run" ? (allow.studios_unlocked ? caps.ads_run : 0) : ((allow as any)[kind] as number);
  const used = (usage as any)[kind] as number || 0;
  const wallet = kind === "ads_run" ? 0 : ((await walletOf(db, String(client.id))) as any)[kind] || 0;
  const left = kind === "ads_run" ? (isFinite(cap) ? Math.max(0, cap - used) : Infinity) : fuelLeft(cap, used, wallet);
  const buffer = isFinite(cap) ? Math.floor(cap * cfg.overshoot_buffer_pct) : 0;
  const base = {
    plan: allow.plan, plan_label: allow.plan_label, kind, used, cap: isFinite(cap) ? cap : null, remaining: isFinite(cap) ? Math.max(0, cap - used) : null,
    pct: isFinite(cap) && cap > 0 ? used / cap : null, wallet, left: isFinite(left) ? left : null, buffer, studios_unlocked: allow.studios_unlocked, reset_on: resetLabel(),
  };
  if (opts.admin) return { ok: true, ...base };

  // Plan gating: Studios (and their AI) are HyperCare+ only; Nøva runs on every plan.
  const nova = /^nova/.test(String(opts.feature || ""));
  if (!allow.studios_unlocked && !(kind === "ai_action" && nova)) {
    return { ok: false, code: "studios_locked", reason: UPGRADE, ...base };
  }
  if (cap === 0 && wallet === 0) {
    return { ok: false, code: "not_in_plan", reason: kind === "ads_run" ? `The ads agent isn't included in ${allow.plan_label}.` : `${KIND_LABEL[kind]} aren't included in ${allow.plan_label}.`, ...base };
  }
  if (kind === "ads_run") {
    if (usage.last_ads_run_at) {
      const gapH = ADS_MIN_GAP_HOURS[caps.ads_cadence];
      const since = (Date.now() - Date.parse(usage.last_ads_run_at)) / 3600000;
      if (gapH && since < gapH) return { ok: false, code: "ads_cadence", reason: `Your plan runs the ads agent ${caps.ads_cadence}. Next run available in about ${Math.ceil(gapH - since)} hours.`, ...base };
    }
    if (isFinite(cap) && used + units > cap) return { ok: false, code: "cap_reached", reason: `You've used this month's ${cap} ads agent runs. They resume ${resetLabel()}.`, ...base };
    return { ok: true, ...base };
  }
  if (left <= 0) {
    return { ok: false, code: "out_of_fuel", reason: `You're out of fuel for this month. Paused items resume automatically after a Refuel or on ${resetLabel()}.`, ...base };
  }
  if (units > left + buffer) {
    return { ok: false, code: "insufficient_fuel", reason: `This needs ${units.toLocaleString("en-US")} ${KIND_LABEL[kind]} but ${left.toLocaleString("en-US")} are left (allowance + Refuel credits). Refuel, or it waits for ${resetLabel()}.`, ...base };
  }
  return { ok: true, ...base };
}

export async function record(db: Db, client: Client, kind: Kind, units: number, meta: {
  admin?: boolean; model?: string; est_cost_usd?: number; feature?: string; user_email?: string;
  input_tokens?: number; output_tokens?: number; campaign_id?: string; calls?: number;
} = {}) {
  if (meta.admin) {
    return await db.UsageLedger.create({
      client_id: String(client.id), client_name: String(client.business || ""), month: monthKey(), kind, units: Number(units) || 0,
      model: meta.model || "", est_cost_usd: Number(meta.est_cost_usd) || 0, feature: String(meta.feature || "").slice(0, 80),
      user_email: meta.user_email || "", by_admin: true, input_tokens: meta.input_tokens || 0, output_tokens: meta.output_tokens || 0,
      campaign_id: meta.campaign_id || "", calls: meta.calls || 1, created_at: new Date().toISOString(),
    }).catch((e: Error) => { console.error("meter.record", e?.message); return null; });
  }
  const cfg = await loadFuelConfig(db);
  const m = await meterUnits(db, client, kind, Number(units) || 0, meta, cfg);
  if (kind === "ads_run") return m.row;
  // 80% of the monthly allowance: heads-up for Justin (the client sees the alert state in the portal meter).
  if (isFinite(m.cap)) await maybeAlert(db, client, kind as UsageKind, m.used_before, m.used_before + (Number(units) || 0), m.cap, cfg.alert_at ?? ALERT_AT).catch((e: Error) => console.error("meter.alert", e?.message));
  // Allowance and wallet both empty: pause the client's queued items and put it on the Command Briefing.
  const wallet = ((await walletOf(db, String(client.id))) as any)[kind] || 0;
  const leftNow = fuelLeft(m.cap, m.used_before + (Number(units) || 0), wallet);
  if (leftNow <= 0) await markOutOfFuel(db, client, kind, cfg, getSecret("STRIPE_SECRET_KEY") || null).catch((e: Error) => console.error("meter.out", e?.message));
  return m.row;
}

export async function checkAndRecord(db: Db, client: Client, kind: Kind, units: number, meta: Parameters<typeof record>[3] = {}) {
  const c = await check(db, client, kind, units, { admin: meta.admin, feature: meta.feature });
  if (!c.ok) return c;
  await record(db, client, kind, units, meta);
  return { ...c, used: c.used + (meta.admin ? 0 : units) };
}

// 80% alert, once per client / kind / month (idempotent by AccountingAlert.key). In-app notification (AccountingAlert
// kind "usage") plus a priority Task due today, which is what puts it on the Command Briefing. Running dry is
// handled by fuel.ts markOutOfFuel (its own once-a-month alert).
async function maybeAlert(db: Db, client: Client, kind: UsageKind, was: number, now: number, cap: number, at: number) {
  if (!isFinite(cap) || cap <= 0) return;
  const line = cap * at;
  if (!(was < line && now >= line)) return;
  const month = monthKey();
  const key = `usage-${kind}-80-${client.id}-${month}`;
  const exists = await db.AccountingAlert.filter({ key }, "-created_date", 1).catch(() => []);
  if (exists?.length) return;
  const plan = PLAN_CAPS[capsFor(client).plan]?.label || "plan";
  const title = `${client.business} passed ${Math.round(at * 100)}% of ${KIND_LABEL[kind]} (${now.toLocaleString("en-US")}/${cap.toLocaleString("en-US")}) on ${plan}.`;
  const body = `Fuel, ${month}. They can Refuel from the portal; raise the cap or set unlimited in Client usage if this client should keep going.`;
  const today = dayKeyLA();
  const task = await db.Task.create({
    title: `Fuel: ${title}`, category: "ops", priority: 2, status: "next", source: "automation",
    task_type: "internal", due_date: today, client_id: String(client.id), notes: `${body}\nOpen: /fuel-economics`,
  }).catch(() => null);
  await db.AccountingAlert.create({ business_id: "interstellar", key, kind: "usage", title, body, due_date: today, link: "/fuel-economics", task_id: task?.id, status: "new" }).catch(() => null);
}

export { ADS_RUNS_PER_MONTH };
