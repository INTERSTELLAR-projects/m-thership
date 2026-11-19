// Usage & cost: pure math behind the page (burn rate, sending costs, the scale calculator). Rates are editable.

export const DEFAULT_RATES = {
  ses_per_1000: 0.16, // Amazon SES, per 1,000 emails
  ses_dedicated_ip: false, // optional managed dedicated IP
  ses_ip_monthly: 15,
  ses_ip_per_1000: 0.08,
  sms_per_msg: 0.0083, // Twilio SMS, US
  sms_carrier: 0.0045, // ~carrier fee per SMS
  mms_per_msg: 0.022,
  mms_carrier: 0.01,
  agent_run_cost: 0.01, // estimate: Base44 integration credits behind one agent run, in dollars
};

export const RATE_FIELDS = [
  ["ses_per_1000", "Amazon SES · per 1,000 emails", "$"],
  ["ses_ip_monthly", "SES managed dedicated IP · per month", "$"],
  ["ses_ip_per_1000", "SES dedicated IP · per 1,000 emails", "$"],
  ["sms_per_msg", "Twilio SMS · per text", "$"],
  ["sms_carrier", "SMS carrier fee · per text (approx.)", "$"],
  ["mms_per_msg", "Twilio MMS · per message", "$"],
  ["mms_carrier", "MMS carrier fee · per message (approx.)", "$"],
  ["agent_run_cost", "Agent run · estimated cost each", "$"],
];

const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
export const withRates = (r) => ({ ...DEFAULT_RATES, ...(r || {}) });

export function emailCost(count, rates) {
  const r = withRates(rates);
  const base = (n(count) / 1000) * r.ses_per_1000;
  const ip = r.ses_dedicated_ip ? r.ses_ip_monthly + (n(count) / 1000) * r.ses_ip_per_1000 : 0;
  return base + ip;
}
export const smsCost = (count, rates) => { const r = withRates(rates); return n(count) * (r.sms_per_msg + r.sms_carrier); };
export const mmsCost = (count, rates) => { const r = withRates(rates); return n(count) * (r.mms_per_msg + r.mms_carrier); };

// Scale calculator. Every input is per client per month except clients and agentRunsPerDay (per client, per day).
export function scenario(input, rates) {
  const i = { clients: 1, listSize: 0, campaignsPerMonth: 0, textsPerMonth: 0, mmsShare: 0, agentRunsPerDay: 0, subscription: 0, ...(input || {}) };
  const clients = Math.max(0, n(i.clients));
  const emails = clients * n(i.listSize) * n(i.campaignsPerMonth);
  const texts = clients * n(i.textsPerMonth);
  const mms = Math.round(texts * Math.min(1, Math.max(0, n(i.mmsShare))));
  const sms = texts - mms;
  const runs = clients * n(i.agentRunsPerDay) * 30;
  const r = withRates(rates);
  const vendors = [
    { key: "ses", label: "Amazon SES (email)", volume: emails, unit: "emails", cost: emailCost(emails, r) },
    { key: "twilio", label: "Twilio (texts)", volume: texts, unit: "texts", cost: smsCost(sms, r) + mmsCost(mms, r) },
    { key: "agents", label: "Agent runs (Base44 credits, est.)", volume: runs, unit: "runs", cost: runs * r.agent_run_cost },
  ];
  const total = vendors.reduce((t, v) => t + v.cost, 0);
  const perClient = clients ? total / clients : 0;
  const sub = n(i.subscription);
  return { emails, texts, runs, vendors, total, perClient, subscription: sub, shareOfSub: sub ? perClient / sub : null };
}

export const PRESETS = [
  { key: "vsrl", label: "VSRL (21K list, ~850K emails/yr)", input: { clients: 1, listSize: 21000, campaignsPerMonth: Math.round((850000 / 12 / 21000) * 10) / 10, textsPerMonth: 0, mmsShare: 0, agentRunsPerDay: 20, subscription: 750 }, note: "Text list size still to confirm on the process call." },
  { key: "500k", label: "500,000 emails/month", input: { clients: 1, listSize: 100000, campaignsPerMonth: 5, textsPerMonth: 0, mmsShare: 0, agentRunsPerDay: 0, subscription: 750 } },
  { key: "roster", label: "20 clients, email + texts", input: { clients: 20, listSize: 5000, campaignsPerMonth: 4, textsPerMonth: 4000, mmsShare: 0.2, agentRunsPerDay: 30, subscription: 750 } },
];

// Claude plan burn: readings [{ pct_used, recorded_at }] for the current week (since reset - 7 days).
// Rate = % per hour from the week's start (0%) or the first reading; projects when 100% is reached.
export function burn(readings, resetAt, now = Date.now()) {
  const reset = resetAt ? new Date(resetAt).getTime() : null;
  if (!reset || !Number.isFinite(reset)) return null;
  const start = reset - 7 * 864e5;
  const week = (readings || []).map((r) => ({ pct: n(r.pct_used), t: new Date(r.recorded_at).getTime() })).filter((r) => Number.isFinite(r.t) && r.t >= start && r.t <= now).sort((a, b) => a.t - b.t);
  if (!week.length) return { start, reset, points: [], rate: null, runOutAt: null, beforeReset: false };
  const last = week[week.length - 1];
  const hours = (last.t - start) / 36e5;
  const rate = hours > 0 ? last.pct / hours : null; // % per hour, averaged over the week so far
  const runOutAt = rate && rate > 0 ? last.t + ((100 - last.pct) / rate) * 36e5 : null;
  return { start, reset, points: week, rate, current: last.pct, runOutAt, beforeReset: !!(runOutAt && runOutAt < reset) };
}

// Next reset at a weekday + hour (local), e.g. Monday 00:00.
export function nextReset(day = 1, hour = 0, from = new Date()) {
  const d = new Date(from);
  d.setHours(hour, 0, 0, 0);
  const add = (day - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + add);
  if (d.getTime() <= from.getTime()) d.setDate(d.getDate() + 7);
  return d;
}

export const money = (v) => {
  const x = n(v);
  if (x === 0) return "$0";
  if (x < 1) return `$${x.toFixed(2)}`;
  return `$${x.toLocaleString("en-US", { maximumFractionDigits: x < 100 ? 2 : 0 })}`;
};
