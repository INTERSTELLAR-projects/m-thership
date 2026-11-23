// @ts-nocheck
// Who is calling the Lead Engine / sales functions, and what they may touch.
//   admin  → Justin (and any admin): everything.
//   sales  → a non-admin login whose email matches an active (or invited) SalesRep row: only leads assigned to
//            them or whose preview they built, Lead Finder, Templates (read + suggest), Lead Desk, their own deals
//            and pay. Never agency finances, settings, price floors or other clients' data.
//   null   → anyone else (portal clients and leads). Refused.
// Every entity involved is admin-only RLS, so reps only ever reach data through these server checks.

export type Staff = { kind: "admin"; email: string; name: string; rep: null } | { kind: "sales"; email: string; name: string; rep: Record<string, any> };

export async function staffOf(db: any, user: any): Promise<Staff | null> {
  if (!user) return null;
  const email = String(user.email || "").trim().toLowerCase();
  if (user.role === "admin") return { kind: "admin", email, name: user.full_name || email, rep: null };
  if (!email) return null;
  const rows = ((await db.SalesRep.filter({ email }, "-created_date", 3).catch(() => [])) || []) as any[];
  const rep = rows.find((r) => ["active", "invited"].includes(String(r.status || "active")));
  if (!rep) return null;
  if (rep.status === "invited") await db.SalesRep.update(rep.id, { status: "active", started_on: rep.started_on || new Date().toISOString().slice(0, 10) }).catch(() => null);
  return { kind: "sales", email, name: rep.name || user.full_name || email, rep: { ...rep, status: "active" } };
}

// A rep may work a lead assigned to them or one whose preview they built.
export function canWorkLead(staff: Staff | null, client: any) {
  if (!staff || !client) return false;
  if (staff.kind === "admin") return true;
  return client.assigned_rep_id === staff.rep.id || client.builder_rep_id === staff.rep.id;
}

// The lead fields a rep may see (no billing, Stripe, portal logins, notes from Justin, or deal values).
export const REP_LEAD_FIELDS = ["id", "business", "contact", "phones", "emails", "websites", "domain", "gbp_url", "one_liner", "industry", "industry_key", "niche_key", "location", "city", "state", "status", "pipeline_stage", "lead_source", "scrape_status", "scraped_at", "scrape_summary", "logo_url", "place_id", "gbp_cache", "gbp_fetched_at", "lead_flags", "site_check", "do_not_contact", "email_opt_out", "lead_incentive", "desk_outcome", "desk_last_call_at", "next_step", "next_step_at", "assigned_rep_id", "assigned_rep_name", "builder_rep_id", "portal_tier", "created_date"];
export const forStaff = (staff: Staff, c: any) => (staff.kind === "admin" ? c : Object.fromEntries(REP_LEAD_FIELDS.filter((k) => c?.[k] !== undefined).map((k) => [k, c[k]])));

export const isEmail = (e: unknown) => /^[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}$/i.test(String(e || "").trim());
export const clip = (v: unknown, n = 2000) => String(v ?? "").trim().slice(0, n);
export const nowIso = () => new Date().toISOString();
export const noteDate = () => new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });

// Weighted round-robin assignment of one lead (writes the lead and the rep's counters). Returns the rep or null.
export async function assignLead(db: any, lead: any, routeLead: any, opts: { by?: string } = {}) {
  if (!lead || lead.assigned_rep_id) return null;
  const reps = ((await db.SalesRep.filter({ status: "active" }, "name", 200).catch(() => [])) || []) as any[];
  if (!reps.length) return null;
  const open = ((await db.CRMClient.filter({ status: "Lead" }, "-created_date", 1000).catch(() => [])) || []) as any[];
  const counts: Record<string, number> = {};
  for (const c of open) if (c.assigned_rep_id && !["won", "lost"].includes(String(c.pipeline_stage || ""))) counts[c.assigned_rep_id] = (counts[c.assigned_rep_id] || 0) + 1;
  const rep = routeLead(lead, reps, counts);
  if (!rep) return null;
  const at = nowIso();
  await db.CRMClient.update(lead.id, { assigned_rep_id: rep.id, assigned_rep_name: rep.name, assigned_at: at });
  await db.SalesRep.update(rep.id, { assigned_total: (Number(rep.assigned_total) || 0) + 1, last_assigned_at: at });
  await db.AgentAuditLog.create({ at, ok: true, actor: opts.by || "automation:routing", action: "lead_assigned", entity: "CRMClient", record_id: lead.id, summary: `${lead.business} → ${rep.name} (round-robin)` }).catch(() => null);
  return rep;
}
