// Fair-use meter for client Studios. Every metered action writes one UsageLedger row (units can be > 1, e.g. one
// row per email batch). Caps come from the client's plan (usagePlans.ts) plus per-client admin overrides.
//
//   check(db, client, kind, units, { admin })            -> may this run? (writes nothing)
//   record(db, client, kind, units, meta)                -> ledger row + 80% / 100% alerts for Justin
//   checkAndRecord(db, client, kind, units, meta)        -> both, for actions whose units are known up front
//   monthUsage(db, clientId, month?)                     -> totals for the month (client usage only counts toward caps)
//
// Admin (Justin) actions are never capped. They are recorded with by_admin=true so cost is visible, and they do
// not eat the client's allowance. Nothing already created is ever locked: at 100% only NEW drafts / sends stop.

import { capsFor, monthKey, dayKeyLA, ALERT_AT, ADS_MIN_GAP_HOURS, PLAN_CAPS, type UsageKind } from "./usagePlans.ts";

type Db = any;
type Client = Record<string, any>;

export const KIND_LABEL: Record<UsageKind, string> = { ai_action: "AI actions", marketing_email: "marketing emails", ads_run: "ads agent runs" };

export async function monthUsage(db: Db, clientId: string, month = monthKey()) {
  const rows = ((await db.UsageLedger.filter({ client_id: clientId, month }, "-created_date", 5000).catch(() => [])) || []) as any[];
  const out = {
    month,
    ai_action: 0, marketing_email: 0, ads_run: 0,
    admin_ai_action: 0, admin_marketing_email: 0, admin_ads_run: 0,
    est_cost_usd: 0,
    last_ads_run_at: null as string | null,
    rows: rows.length,
  };
  for (const r of rows) {
    const k = String(r.kind) as UsageKind;
    if (!(k in KIND_LABEL)) continue;
    const u = Number(r.units) || 0;
    if (r.by_admin) (out as any)[`admin_${k}`] += u; else (out as any)[k] += u;
    out.est_cost_usd += Number(r.est_cost_usd) || 0;
    if (k === "ads_run" && (!out.last_ads_run_at || String(r.created_at) > out.last_ads_run_at)) out.last_ads_run_at = String(r.created_at || r.created_date || "");
  }
  out.est_cost_usd = Math.round(out.est_cost_usd * 10000) / 10000;
  return out;
}

export type CheckResult = {
  ok: boolean; code?: string; reason?: string;
  plan: string; plan_label: string; kind: UsageKind;
  used: number; cap: number | null; remaining: number | null; pct: number | null;
};

const capOf = (caps: ReturnType<typeof capsFor>, kind: UsageKind) => (kind === "ai_action" ? caps.ai_action : kind === "marketing_email" ? caps.marketing_email : caps.ads_run);
const nextMonthText = () => {
  const d = new Date(); const n = new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return n.toLocaleDateString("en-US", { month: "long", day: "numeric" });
};

export async function check(db: Db, client: Client, kind: UsageKind, units = 1, opts: { admin?: boolean } = {}): Promise<CheckResult> {
  const caps = capsFor(client);
  const usage = await monthUsage(db, String(client.id));
  const cap = capOf(caps, kind);
  const used = (usage as any)[kind] as number;
  const base = { plan: caps.plan, plan_label: caps.plan_label, kind, used, cap: isFinite(cap) ? cap : null, remaining: isFinite(cap) ? Math.max(0, cap - used) : null, pct: isFinite(cap) && cap > 0 ? used / cap : null };
  if (opts.admin) return { ok: true, ...base };
  if (cap === 0) {
    return { ok: false, code: "not_in_plan", reason: kind === "ads_run" ? `The ads agent isn't included in ${caps.plan_label}.` : `${KIND_LABEL[kind]} aren't included in ${caps.plan_label}.`, ...base };
  }
  if (kind === "ads_run" && usage.last_ads_run_at) {
    const gapH = ADS_MIN_GAP_HOURS[caps.ads_cadence];
    const since = (Date.now() - Date.parse(usage.last_ads_run_at)) / 3600000;
    if (gapH && since < gapH) return { ok: false, code: "ads_cadence", reason: `Your plan runs the ads agent ${caps.ads_cadence}. Next run available in about ${Math.ceil(gapH - since)} hours.`, ...base };
  }
  if (isFinite(cap) && used + units > cap) {
    const left = Math.max(0, cap - used);
    return {
      ok: false, code: "cap_reached",
      reason: left > 0
        ? `This needs ${units.toLocaleString("en-US")} ${KIND_LABEL[kind]} but ${left.toLocaleString("en-US")} are left this month. Your allowance resets ${nextMonthText()}.`
        : `You've used this month's ${cap.toLocaleString("en-US")} ${KIND_LABEL[kind]}. Everything you've made is still yours; new ${kind === "marketing_email" ? "sends" : "drafts"} resume ${nextMonthText()}.`,
      ...base,
    };
  }
  return { ok: true, ...base };
}

export async function record(db: Db, client: Client, kind: UsageKind, units: number, meta: {
  admin?: boolean; model?: string; est_cost_usd?: number; feature?: string; user_email?: string;
  input_tokens?: number; output_tokens?: number; campaign_id?: string;
} = {}) {
  const month = monthKey();
  const before = meta.admin ? null : await monthUsage(db, String(client.id), month).catch(() => null);
  const row = await db.UsageLedger.create({
    client_id: String(client.id), client_name: String(client.business || ""), month, kind, units: Number(units) || 0,
    model: meta.model || "", est_cost_usd: Number(meta.est_cost_usd) || 0, feature: String(meta.feature || "").slice(0, 80),
    user_email: meta.user_email || "", by_admin: !!meta.admin, input_tokens: meta.input_tokens || 0, output_tokens: meta.output_tokens || 0,
    campaign_id: meta.campaign_id || "", created_at: new Date().toISOString(),
  }).catch((e: Error) => { console.error("meter.record", e?.message); return null; });
  if (!meta.admin && before) {
    const caps = capsFor(client);
    const cap = capOf(caps, kind);
    const was = (before as any)[kind] as number;
    await maybeAlert(db, client, kind, was, was + (Number(units) || 0), cap).catch((e: Error) => console.error("meter.alert", e?.message));
  }
  return row;
}

export async function checkAndRecord(db: Db, client: Client, kind: UsageKind, units: number, meta: Parameters<typeof record>[3] = {}) {
  const c = await check(db, client, kind, units, { admin: meta.admin });
  if (!c.ok) return c;
  await record(db, client, kind, units, meta);
  return { ...c, used: c.used + (meta.admin ? 0 : units) };
}

// 80% and 100% alerts, once per client / kind / month (idempotent by AccountingAlert.key). Each alert is an in-app
// notification (AccountingAlert kind "usage", shown by the admin notice card) plus a priority Task due today, which
// is what puts it on the Command Briefing.
async function maybeAlert(db: Db, client: Client, kind: UsageKind, was: number, now: number, cap: number) {
  if (!isFinite(cap) || cap <= 0) return;
  const month = monthKey();
  const marks: { at: number; tag: string }[] = [{ at: ALERT_AT, tag: "80" }, { at: 1, tag: "100" }];
  for (const m of marks) {
    const line = cap * m.at;
    if (!(was < line && now >= line)) continue;
    const key = `usage-${kind}-${m.tag}-${client.id}-${month}`;
    const exists = await db.AccountingAlert.filter({ key }, "-created_date", 1).catch(() => []);
    if (exists?.length) continue;
    const plan = PLAN_CAPS[capsFor(client).plan]?.label || "plan";
    const title = m.tag === "100"
      ? `${client.business} hit 100% of ${KIND_LABEL[kind]} (${Math.min(now, cap).toLocaleString("en-US")}/${cap.toLocaleString("en-US")}). New ${kind === "marketing_email" ? "sends" : "drafts"} paused until next month.`
      : `${client.business} passed 80% of ${KIND_LABEL[kind]} (${now.toLocaleString("en-US")}/${cap.toLocaleString("en-US")}) on ${plan}.`;
    const body = `Fair use, ${month}. Raise the cap or set unlimited in Client usage if this client should keep going.`;
    const today = dayKeyLA();
    const task = await db.Task.create({
      title: `Fair use: ${title}`, category: "ops", priority: m.tag === "100" ? 1 : 2, status: "next", source: "automation",
      task_type: "internal", due_date: today, client_id: String(client.id), notes: `${body}\nOpen: /client-usage`,
    }).catch(() => null);
    await db.AccountingAlert.create({ business_id: "interstellar", key, kind: "usage", title, body, due_date: today, link: "/client-usage", task_id: task?.id, status: "new" }).catch(() => null);
  }
}
