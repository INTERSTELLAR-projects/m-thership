// @ts-nocheck
// Lead-tier portal (Lead Engine). A login on a CRMClient with portal_tier "lead" sees only: the welcome, their own
// website preview, their own Command System preview (sample data, read-only), what Interstellar is (packages from
// OfferCatalog, the single source of truth; no prices: quotes are custom on the walkthrough), the walkthrough booking
// and the $30-for-30-minutes offer. Every other portal action is refused for a lead (see portalApi.ts).
// Engagement (first login, sessions, views, seconds per view, walkthrough booked) is written onto LeadPreview.engagement
// and shown on the lead in Møthership. Admin previews never count as engagement.

import { sweepLead } from "./leadFollowups.ts";
import { safeItem, relevantFor } from "./portfolio.ts";

export const LEAD_ACTIONS = ["home", "lead_track"];
const VIEWS = ["home", "website", "command", "offer", "book"];

async function previewFor(db: any, cid: string) {
  return (((await db.LeadPreview.filter({ client_id: cid }, "-updated_date", 1).catch(() => [])) || []) as any[])[0] || null;
}

async function offers(db: any) {
  const rows = ((await db.OfferCatalog.filter({ public: true, status: "active" }, "sort", 60).catch(() => [])) || []) as any[];
  const byKey = new Map(rows.map((r) => [r.key, r]));
  const nameOf = (k: string) => byKey.get(k)?.name || k.replace(/_/g, " ");
  // Missions + builds + care plans; names, summaries and what's included. Prices deliberately left out.
  return rows.filter((r) => ["mission", "build", "subscription"].includes(String(r.kind)) && r.key !== "intel_briefing")
    .map((r) => ({ key: r.key, kind: r.kind, name: String(r.name || "").replace(/®/g, "™"), summary: r.summary || "", includes: (r.includes || []).map(nameOf).slice(0, 8) }));
}

export async function leadHome(db: any, client: any, user: any) {
  const p = await previewFor(db, client.id);
  const ready = p && ["ready", "sent", "viewed"].includes(p.status);
  return {
    tier: "lead",
    client: { id: client.id, business: client.business, logo_url: client.logo_url || "", contact: client.contact || "", city: client.city || "", state: client.state || "" },
    user: { email: user.email, name: user.full_name, is_admin_preview: user.role === "admin" },
    preview: ready || user.role === "admin" ? { status: p?.status || null, website: p?.website_config || null, command: p?.command_config || null, version: p?.version || 0 } : null,
    offers: await offers(db),
    incentive: { amount: 30, minutes: 30, per_minute: 1, methods: ["Venmo", "Cash App", "PayPal", "check"] },
    booked: !!p?.engagement?.walkthrough_booked_at,
    // "Our work": published portfolio sites (public facts only), most relevant to this lead's industry first.
    portfolio: relevantFor((((await db.PortfolioItem.filter({ status: "published" }, "sort", 100).catch(() => [])) || []) as any[]).map(safeItem), client.industry_key || p?.industry_key || "", 12),
    businesses: [],
  };
}

// One tracking call per view change / heartbeat. Seconds are capped per call so a left-open tab can't inflate them.
export async function leadTrack(db: any, client: any, user: any, args: any) {
  if (user.role === "admin") return { ok: true, skipped: "admin preview" };
  const p = await previewFor(db, client.id);
  if (!p) return { ok: true, skipped: "no preview" };
  const now = new Date().toISOString();
  const e = { views: {}, seconds: {}, sessions: 0, ...(p.engagement || {}) };
  const view = VIEWS.includes(String(args.view)) ? String(args.view) : "home";
  const secs = Math.max(0, Math.min(60, Math.round(Number(args.seconds) || 0)));
  if (!e.first_login_at) e.first_login_at = now;
  if (args.event === "session") e.sessions = (Number(e.sessions) || 0) + 1;
  if (args.event === "view") e.views = { ...e.views, [view]: (Number(e.views?.[view]) || 0) + 1 };
  if (secs) e.seconds = { ...e.seconds, [view]: (Number(e.seconds?.[view]) || 0) + secs };
  e.last_seen_at = now;
  const patch: any = { engagement: e };
  if (p.status === "sent" || p.status === "ready") patch.status = "viewed";
  if (!p.engagement?.first_login_at) patch.build_log = [...(p.build_log || []), { at: now, by: user.email, action: "viewed", version: p.version || 1, note: "First login to the lead portal" }].slice(-40);
  const row = await db.LeadPreview.update(p.id, patch);
  // A new session or first login re-heats the lead and opens the "call within 2 hours" task on the call sheet.
  if (args.event === "session" || !p.engagement?.first_login_at) await sweepLead(db, client, { preview: { ...p, ...patch, ...(row || {}) } }).catch(() => null);
  return { ok: true };
}

// Called by portal-booking after a lead books the walkthrough.
export async function leadBooked(db: any, client: any, when: string) {
  const p = await previewFor(db, client.id);
  if (!p) return;
  const now = new Date().toISOString();
  await db.LeadPreview.update(p.id, { engagement: { ...(p.engagement || {}), walkthrough_booked_at: now, walkthrough_when: String(when || "").slice(0, 80) } }).catch(() => null);
  const inc = client.lead_incentive || {};
  await db.CRMClient.update(client.id, { desk_outcome: "booked", next_step: "Walkthrough", ...(inc.status && inc.status !== "none" ? {} : { lead_incentive: { status: "owed", amount: 30, minutes: 30, owed_at: now } }) }).catch(() => null);
  await db.LeadCallLog.create({ client_id: client.id, client_name: client.business, outcome: "note", note: `Booked the walkthrough from the portal: ${when}`, caller: "lead (portal)", at: now }).catch(() => null);
  await sweepLead(db, { ...client, desk_outcome: "booked" }).catch(() => null);
}
