// QA-only fake data for the `usage` function (preview sandbox with ?qa=1). Never used on the live app.
const month = new Date().toISOString().slice(0, 7);
const mk = (id, business, plan, plan_label, caps, usage, studios, extra = {}) => ({
  id, business, plan, plan_label, caps, unlimited: false, custom: false, overrides: {}, portal_enabled: true,
  studios: { social: "preview", email: "preview", ads: "preview", accounting: "preview", hiring: "preview", presentations: "preview", ...studios },
  ses: { from_email: "", from_name: "", reply_to: "", domain: "", verified: false },
  usage: { ai_action: 0, marketing_email: 0, ads_run: 0, admin_ai_action: 0, admin_marketing_email: 0, admin_ads_run: 0, est_cost_usd: 0, ...usage },
  ...extra,
});
const CLIENTS = [
  mk("c1", "Summit Roofing Co", "hypercare", "HyperCare+", { ai_action: 1000, marketing_email: 25000, ads_cadence: "daily" },
    { ai_action: 842, marketing_email: 6120, ads_run: 4, admin_ai_action: 37, est_cost_usd: 4.91 }, { social: "on", email: "on" },
    { ses: { from_email: "news@summitroofing.test", from_name: "Summit Roofing", reply_to: "dana@summit.test", domain: "summitroofing.test", verified: true } }),
  mk("c2", "Harbor Coffee", "website", "Website-only", { ai_action: 500, marketing_email: 10000, ads_cadence: "weekly" },
    { ai_action: 61, marketing_email: 0, est_cost_usd: 0.22 }, { social: "on" }),
  mk("c3", "Northline Fitness", "gravitycare", "GravïtyCare", { ai_action: 200, marketing_email: 2500, ads_cadence: "none" },
    { ai_action: 200, marketing_email: 2500, est_cost_usd: 1.06 }, { email: "on", hiring: "off" }, { custom: true }),
];

export function qaUsageInvoke(args = {}) {
  if (args.action === "overview") return { month, truncated: false, agency: { est_cost_usd: 0.84 }, clients: CLIENTS };
  if (args.action === "config") return {
    secrets: { ANTHROPIC_API_KEY: true, AWS_SES_ACCESS_KEY_ID: false, AWS_SES_SECRET_ACCESS_KEY: false, AWS_SES_REGION: false },
    models: { routine: { id: "claude-haiku-5-5" }, long: { id: "claude-sonnet-5-5" } },
    ses_feedback_webhook: "https://interstellar-mothership.com/functions/email-bulk?hook=QA_SAMPLE_TOKEN", checked_at: new Date().toISOString(),
  };
  if (args.action === "summary") {
    const c = CLIENTS.find((x) => x.id === (args.client_id || "c1")) || CLIENTS[0];
    return { visible: true, month, plan: c.plan, plan_label: c.plan_label, caps: c.caps, usage: c.usage, admin_usage: {}, est_cost_usd: c.usage.est_cost_usd, unlimited: false, custom: c.custom, studios: c.studios };
  }
  return {};
}
