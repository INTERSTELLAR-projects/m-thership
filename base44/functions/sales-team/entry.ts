// @ts-nocheck
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { staffOf, canWorkLead, clip, nowIso, isEmail } from "../../shared/staff.ts";
import { DEAL_PRODUCTS, dealTotals, earningsFor, US_STATE_NAMES } from "../../shared/leadEngine.js";
import { moveStage, stageOf } from "../../shared/leadStage.ts";
import { inviteSettings, normEmail } from "../../shared/portalInvite.ts";
import { renderEmail, SIGNATURE } from "../../shared/emailBlocks.ts";
import { sendBrandedEmail } from "../../shared/onboardingEmail.ts";

/*
 * Sales team (Lead Engine). Who: admins (Sales HQ, reps, comp, floors, approvals) and sales reps (their own profile,
 * deals and pay). Price floors live ONLY here and in admin settings; a rep never receives a floor number, only
 * "this price needs approval". Nothing here emails anyone except rep_invite with confirm: true (a person's click).
 *   me · offers · deals · deal_save · statement                         (rep or admin)
 *   reps · rep_save · rep_invite · deal_decide · comp · floors · hq      (admin)
 */

// Admin-only defaults. Justin edits them in Sales HQ › Settings; these apply until he does.
const DEFAULT_FLOORS = { website: 1000, app: 5000, bundle: 5000 };
const DEFAULT_COMP = {
  base_default: 5000, base_range: [5000, 7000],
  tiers: [{ from: 0, rate: 0.05 }, { from: 15000, rate: 0.08 }, { from: 30000, rate: 0.1 }],
  seo_bonus_per_sub: 250, monthly_counts_months: 3,
  note: "Starting defaults: change them to your real plan. Commission = tier rate × (one-time value + monthly value × months counted) of deals won that month, plus a bonus per new SEO subscription.",
};

const err = (error: string, status = 400, extra = {}) => Response.json({ error, ...extra }, { status });
const arr = (v: any) => (Array.isArray(v) ? v : []);
const num = (v: any) => Math.max(0, Number(v) || 0);
const monthOf = (d: any) => String(d || "").slice(0, 7);

async function setting(db: any, key: string, def: any) {
  const row = ((await db.AppSettings.filter({ key }, "-created_date", 1).catch(() => [])) || [])[0] || null;
  return { row, value: { ...def, ...(row?.pageSettings || {}) } };
}
async function saveSetting(db: any, key: string, value: any) {
  const { row } = await setting(db, key, {});
  if (row) await db.AppSettings.update(row.id, { pageSettings: value });
  else await db.AppSettings.create({ key, pageSettings: value });
  return value;
}

// Floor check (server only). Returns the list of product keys under floor; never the floor values.
function underFloor(products: any[], floors: any) {
  const out: string[] = [];
  for (const p of products) if (["website", "app", "bundle"].includes(p.key) && num(p.price) < num(floors[p.key])) out.push(p.key);
  const site = products.filter((p) => p.key === "website").reduce((a, p) => a + num(p.price), 0);
  const app = products.filter((p) => p.key === "app").reduce((a, p) => a + num(p.price), 0);
  if (site > 0 && app > 0 && site + app < num(floors.bundle)) out.push("bundle");
  return [...new Set(out)];
}

const SAFE_REP = (r: any) => ({ id: r.id, name: r.name, email: r.email, status: r.status, mode: r.mode, build_pct: r.build_pct, allowed_industries: r.allowed_industries || [], multi_industry_ready: !!r.multi_industry_ready, training_path: r.training_path || "", base_retainer: r.base_retainer || 0, started_on: r.started_on || "" });
const repDeal = (d: any) => ({ id: d.id, client_id: d.client_id, client_name: d.client_name, products: d.products || [], contract_value: d.contract_value, monthly_value: d.monthly_value, status: d.status, needs_approval: !!d.needs_approval, closed_at: d.closed_at || null, notes: d.notes || "", created_date: d.created_date, rep_name: d.rep_name });

async function offerPrices(db: any) {
  const rows = ((await db.OfferCatalog.filter({ status: "active" }, "sort", 80).catch(() => [])) || []) as any[];
  return DEAL_PRODUCTS.map((p) => {
    const o = rows.find((r) => r.key === p.offer_key);
    return { ...p, list_price: o ? Number(o.price) || 0 : 0, price_display: o?.price_display || "", name: o?.name || p.label };
  });
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const db = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "me");
    const staff = await staffOf(db, user);

    // Any signed-in user may ask "am I a rep?" (the app uses it to pick the sales view vs the portal).
    if (action === "me") {
      if (!user) return err("Not signed in", 401);
      if (!staff) return Response.json({ kind: null });
      return Response.json({ kind: staff.kind, rep: staff.rep ? SAFE_REP(staff.rep) : null, name: staff.name, email: staff.email });
    }
    if (!staff) return err("Sales team only", 403);
    const admin = staff.kind === "admin";

    if (action === "offers") return Response.json({ products: await offerPrices(db) });

    if (action === "deals") {
      const q = admin ? (body.rep_id ? { rep_id: clip(body.rep_id, 64) } : {}) : { rep_id: staff.rep.id };
      const rows = ((await db.Deal.filter(q, "-created_date", 500).catch(() => [])) || []) as any[];
      return Response.json({ deals: admin ? rows : rows.map(repDeal) });
    }

    if (action === "deal_save") {
      const c = await db.CRMClient.get(clip(body.client_id, 64)).catch(() => null);
      if (!c) return err("Lead not found", 404);
      if (!canWorkLead(staff, c)) return err("This lead isn't assigned to you", 403);
      const existing = body.id ? await db.Deal.get(clip(body.id, 64)).catch(() => null) : null;
      if (existing && !admin && existing.rep_id !== staff.rep.id) return err("Not your deal", 403);
      if (existing && existing.status === "won" && !admin) return err("Won deals are locked. Ask an admin to change it.", 409);
      const catalog = await offerPrices(db);
      const products = arr(body.products).slice(0, 8).map((p: any) => {
        const def = catalog.find((x) => x.key === p?.key);
        if (!def) return null;
        return { key: def.key, offer_key: def.offer_key, label: def.name, billing: def.billing, list_price: def.list_price, price: Math.round(num(p.price)) };
      }).filter(Boolean).filter((p: any) => p.price > 0);
      if (!products.length) return err("Add at least one product with a price.");
      const totals = dealTotals(products);
      const { value: floors } = await setting(db, "sales_floors", DEFAULT_FLOORS);
      const under = underFloor(products, floors);
      const wanted = ["draft", "won", "lost"].includes(body.status) ? body.status : "draft";
      let status = wanted;
      let needs = false;
      const approvedSame = existing?.approval?.decision === "approved" && JSON.stringify(existing.products) === JSON.stringify(products);
      if (under.length && !admin && !approvedSame) { needs = true; status = wanted === "lost" ? "lost" : "pending_approval"; }
      const repId = admin && body.rep_id ? clip(body.rep_id, 64) : admin ? (existing?.rep_id || c.assigned_rep_id || "") : staff.rep.id;
      const rep = repId ? await db.SalesRep.get(repId).catch(() => null) : null;
      const data: any = {
        client_id: c.id, client_name: c.business, industry_key: c.industry_key || "", rep_id: repId, rep_name: rep?.name || (admin ? "" : staff.rep.name), builder_rep_id: c.builder_rep_id || "",
        products, contract_value: totals.contract_value, monthly_value: totals.monthly_value, status, needs_approval: needs, notes: clip(body.notes, 1000),
        ...(status === "won" ? { closed_at: existing?.closed_at || nowIso() } : {}),
        ...(needs ? { approval: { requested_at: nowIso(), requested_by: staff.email, under: under } } : {}),
        log: [...arr(existing?.log), { at: nowIso(), by: staff.email, status, note: needs ? "Price needs approval" : "" }].slice(-30),
      };
      const row = existing ? await db.Deal.update(existing.id, data) : await db.Deal.create(data);
      if (status === "won") {
        const one = totals.contract_value, mon = totals.monthly_value;
        await db.CRMClient.update(c.id, { deal_one_time: { amount: one, status: "quoted", label: products.filter((p: any) => p.billing !== "monthly").map((p: any) => p.label).join(" + ") || "Build" }, ...(mon ? { deal_monthly: { plan: "hypercare", amount: mon, start: "build_done" } } : {}) }).catch(() => null);
        if (stageOf(c) !== "won") await moveStage(db, c.id, "won", { by: staff.email, reason: `Deal won${rep ? ` by ${rep.name}` : ""}: $${one.toLocaleString()} one-time${mon ? ` + $${mon}/mo` : ""}`, source: "dialog" }).catch(() => null);
      } else if (stageOf(c) !== "proposal_sent" && ["new", "contacted", "call_booked", "call_held"].includes(stageOf(c)) && status !== "lost") {
        await moveStage(db, c.id, "proposal_sent", { by: staff.email, reason: "Deal drafted", source: "dialog" }).catch(() => null);
      }
      if (needs) await db.AgentAuditLog.create({ at: nowIso(), ok: true, actor: staff.email, action: "deal_needs_approval", entity: "Deal", record_id: row.id, summary: `${c.business}: price needs approval (${under.join(", ")})` }).catch(() => null);
      return Response.json({ deal: admin ? row : repDeal(row), needs_approval: needs, message: needs ? "This price needs approval. Justin will review it; you'll see the status change here." : "Saved." });
    }

    if (action === "statement") {
      const repId = admin ? clip(body.rep_id, 64) : staff.rep.id;
      const rep = await db.SalesRep.get(repId).catch(() => null);
      if (!rep) return err("Rep not found", 404);
      const { value: comp } = await setting(db, "sales_comp", DEFAULT_COMP);
      const rules = { ...comp, ...(rep.comp_overrides || {}) };
      const deals = ((await db.Deal.filter({ rep_id: rep.id, status: "won" }, "-closed_at", 500).catch(() => [])) || []) as any[];
      const months: string[] = [];
      const now = new Date();
      for (let i = 0; i < 6; i++) months.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
      const statements = months.map((m) => earningsFor(rep, deals, rules, m));
      return Response.json({ rep: SAFE_REP(rep), statements, rules: { tiers: rules.tiers, seo_bonus_per_sub: rules.seo_bonus_per_sub, monthly_counts_months: rules.monthly_counts_months } });
    }

    /* ---------------- admin only below ---------------- */
    if (!admin) return err("Admins only", 403);

    if (action === "reps") {
      const reps = ((await db.SalesRep.list("name", 200).catch(() => [])) || []) as any[];
      return Response.json({ reps });
    }
    if (action === "rep_save") {
      const r = body.rep || {};
      const email = normEmail(r.email);
      if (!clip(r.name, 120)) return err("Add the rep's name.");
      if (!isEmail(email)) return err("Add a valid email.");
      const dupe = ((await db.SalesRep.filter({ email }, "-created_date", 2).catch(() => [])) || []).find((x: any) => x.id !== r.id);
      if (dupe) return err("A rep with that email already exists.", 409);
      const admins = ((await db.User.filter({ email }, "-created_date", 1).catch(() => [])) || []) as any[];
      if (admins[0]?.role === "admin") return err("That email is an admin login. Reps need their own non-admin login.", 409);
      const allowed = arr(r.allowed_industries).map((x: any) => clip(x, 60)).filter(Boolean).slice(0, 30);
      const multi = !!r.multi_industry_ready;
      const data: any = {
        name: clip(r.name, 120), email, phone: clip(r.phone, 40), status: ["invited", "active", "paused", "inactive"].includes(r.status) ? r.status : "active",
        mode: ["builder", "closer", "both"].includes(r.mode) ? r.mode : "both", build_pct: Math.max(0, Math.min(100, Number(r.build_pct) || 50)),
        allowed_industries: multi ? allowed : allowed.slice(0, 1), multi_industry_ready: multi,
        weight: Math.max(0.1, Math.min(5, Number(r.weight) || 1)), capacity: Math.max(1, Math.min(500, Number(r.capacity) || 40)),
        base_retainer: Math.max(0, Number(r.base_retainer) || 0), notes: clip(r.notes, 1000),
        ...(r.training_track_id !== undefined ? { training_track_id: clip(r.training_track_id, 64) } : {}),
        ...(r.training_assignment_id !== undefined ? { training_assignment_id: clip(r.training_assignment_id, 64), training_path: clip(r.training_path, 300) } : {}),
        ...(r.comp_overrides && typeof r.comp_overrides === "object" ? { comp_overrides: r.comp_overrides } : {}),
      };
      const row = r.id ? await db.SalesRep.update(clip(r.id, 64), data) : await db.SalesRep.create({ ...data, assigned_total: 0, started_on: nowIso().slice(0, 10) });
      return Response.json({ rep: row });
    }
    if (action === "rep_invite") {
      // Built, not automatic: only runs when an admin clicks Send invite (confirm: true).
      const rep = await db.SalesRep.get(clip(body.id, 64)).catch(() => null);
      if (!rep) return err("Rep not found", 404);
      const settings = await inviteSettings(db);
      const blocks = [
        { type: "header", eyebrow: "Sales team", show_date: true },
        { type: "hero", title: `Welcome to the team,`, accent: String(rep.name || "").split(" ")[0] || "crew" },
        { type: "intro", text: "Your Interstellar sales workspace is ready: your leads, Lead Finder, the industry templates, the preview builder, the Lead Desk and your pay statement, in one login." },
        { type: "steps", items: [{ title: "Sign in", text: `Use ${rep.email}: continue with Google, or choose Sign up once to set a password.`, foot: "One minute" }, { title: "Start your training", text: "Your training checklist is on your home screen.", foot: "Day one" }, { title: "Work your first lead", text: "Open My leads, build the preview, read the pack, make the call.", foot: "Day one" }] },
        { type: "button", label: "Open your workspace", url: `${settings.portal_url}/login` },
        { type: "signature", ...SIGNATURE, ps: "" },
      ];
      const subject = "Your Interstellar sales workspace is ready";
      const html = renderEmail({ subject, blocks }, { vars: {} });
      if (body.confirm !== true) return Response.json({ preview: { to: rep.email, subject, html } });
      try { await base44.asServiceRole.users.inviteUser(rep.email, "user"); } catch (e) { if (!/already|exist/i.test(String(e?.message || e))) return err(String(e?.message || e).slice(0, 200), 502); }
      await sendBrandedEmail(base44, { to: rep.email, subject, html });
      await db.SalesRep.update(rep.id, { invited_at: nowIso(), status: rep.status === "active" ? "active" : "invited" });
      return Response.json({ ok: true });
    }
    if (action === "deal_decide") {
      const d = await db.Deal.get(clip(body.id, 64)).catch(() => null);
      if (!d) return err("Deal not found", 404);
      const ok = body.decision === "approved";
      const row = await db.Deal.update(d.id, { status: ok ? "approved" : "draft", needs_approval: false, approval: { ...(d.approval || {}), decided_at: nowIso(), decided_by: staff.email, decision: ok ? "approved" : "declined", note: clip(body.note, 500) }, log: [...arr(d.log), { at: nowIso(), by: staff.email, status: ok ? "approved" : "declined", note: clip(body.note, 200) }].slice(-30) });
      return Response.json({ deal: row });
    }
    if (action === "comp") {
      if (body.save) {
        const c = body.comp || {};
        const tiers = arr(c.tiers).map((t: any) => ({ from: num(t.from), rate: Math.min(0.5, num(t.rate)) })).slice(0, 8);
        const v = { base_default: num(c.base_default) || DEFAULT_COMP.base_default, base_range: [num(c.base_range?.[0]) || 5000, num(c.base_range?.[1]) || 7000], tiers: tiers.length ? tiers : DEFAULT_COMP.tiers, seo_bonus_per_sub: num(c.seo_bonus_per_sub), monthly_counts_months: Math.min(24, num(c.monthly_counts_months)), note: clip(c.note, 500) || DEFAULT_COMP.note, updated_by: staff.email, updated_at: nowIso() };
        return Response.json({ comp: await saveSetting(db, "sales_comp", v) });
      }
      return Response.json({ comp: (await setting(db, "sales_comp", DEFAULT_COMP)).value });
    }
    if (action === "floors") {
      if (body.save) {
        const f = body.floors || {};
        const v = { website: num(f.website), app: num(f.app), bundle: num(f.bundle), updated_by: staff.email, updated_at: nowIso() };
        return Response.json({ floors: await saveSetting(db, "sales_floors", v) });
      }
      return Response.json({ floors: (await setting(db, "sales_floors", DEFAULT_FLOORS)).value });
    }

    if (action === "hq") {
      const days = Math.max(7, Math.min(365, Number(body.days) || 30));
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const [reps, calls, previews, deals, leads, goalRows, active] = await Promise.all([
        db.SalesRep.list("name", 200).catch(() => []), db.LeadCallLog.list("-at", 3000).catch(() => []), db.LeadPreview.list("-updated_date", 2000).catch(() => []),
        db.Deal.list("-created_date", 2000).catch(() => []), db.CRMClient.filter({ status: "Lead" }, "-created_date", 2000).catch(() => []),
        db.RevenueGoal.list("-created_date", 10).catch(() => []), db.CRMClient.filter({ status: "Active" }, "business", 500).catch(() => []),
      ]);
      const { value: comp } = await setting(db, "sales_comp", DEFAULT_COMP);
      const repsL = (reps || []) as any[];
      const byEmail = new Map(repsL.map((r) => [String(r.email).toLowerCase(), r]));
      const inRange = (d: any) => String(d || "") >= since;
      const callRows = ((calls || []) as any[]).filter((x) => ["no_answer", "callback", "not_interested", "booked", "sent_portal"].includes(x.outcome));
      const pv = (previews || []) as any[];
      const allLeads = [...((leads || []) as any[]), ...((active || []) as any[])];
      const leadById = new Map(allLeads.map((c) => [c.id, c]));
      const dl = (deals || []) as any[];
      const gross = (d: any) => num(d.contract_value) + num(d.monthly_value) * 12;
      const month = new Date().toISOString().slice(0, 7);
      const board = repsL.map((r) => {
        const em = String(r.email).toLowerCase();
        const myCalls = callRows.filter((x) => String(x.caller).toLowerCase() === em && inRange(x.at));
        const myLeads = allLeads.filter((c) => c.assigned_rep_id === r.id);
        const won = dl.filter((d) => d.rep_id === r.id && d.status === "won" && inRange(d.closed_at));
        const built = pv.filter((p) => (p.build_log || []).some((l: any) => String(l.by).toLowerCase() === em && ["build", "rebuild"].includes(l.action) && inRange(l.at)));
        const rules = { ...comp, ...(r.comp_overrides || {}) };
        const e = earningsFor(r, dl, rules, month);
        return {
          id: r.id, name: r.name, status: r.status, mode: r.mode, allowed_industries: r.allowed_industries || [], open_leads: myLeads.filter((c) => c.status === "Lead").length,
          calls: myCalls.length, conversations: myCalls.filter((x) => x.outcome !== "no_answer").length, meetings: myCalls.filter((x) => x.outcome === "booked").length,
          previews_built: built.length, portal_logins: pv.filter((p) => leadById.get(p.client_id)?.assigned_rep_id === r.id && inRange(p.engagement?.first_login_at)).length,
          deals_closed: won.length, revenue: won.reduce((a, d) => a + gross(d), 0), one_time: won.reduce((a, d) => a + num(d.contract_value), 0), seo_subs: won.reduce((a, d) => a + dealTotals(d.products || []).seo_subs, 0),
          month_cost: e.total, month_commission: e.commission + e.seo_bonus, month_gross: dl.filter((d) => d.rep_id === r.id && d.status === "won" && monthOf(d.closed_at) === month).reduce((a, d) => a + gross(d), 0), base_retainer: num(r.base_retainer),
        };
      });
      // Activity over time: 8 weeks of calls, previews and deals won.
      const weeks = Array.from({ length: 8 }, (_, i) => { const end = Date.now() - (7 - i) * 7 * 86400000; return { start: new Date(end - 7 * 86400000).toISOString().slice(0, 10), end: new Date(end).toISOString().slice(0, 10) }; });
      const wk = (d: any, w: any) => { const s = String(d || "").slice(0, 10); return s > w.start && s <= w.end; };
      const activity = weeks.map((w) => ({ week: w.end, calls: callRows.filter((x) => wk(x.at, w)).length, meetings: callRows.filter((x) => x.outcome === "booked" && wk(x.at, w)).length, previews: pv.filter((p) => wk(p.built_at, w)).length, deals: dl.filter((d) => d.status === "won" && wk(d.closed_at, w)).length }));
      const openLeads = (leads || []) as any[];
      const stages: Record<string, number> = {}, industries: Record<string, number> = {};
      for (const c of openLeads) { const s = stageOf(c); stages[s] = (stages[s] || 0) + 1; const k = c.industry_key || "unsorted"; industries[k] = (industries[k] || 0) + 1; }
      const withPreview = new Set(pv.map((p) => p.client_id));
      const finder = allLeads.filter((c) => c.lead_source === "lead_finder");
      const funnel = [
        { key: "found", label: "Found", n: finder.length },
        { key: "built", label: "Preview built", n: finder.filter((c) => withPreview.has(c.id)).length },
        { key: "contacted", label: "Contacted", n: finder.filter((c) => c.desk_outcome || ["contacted", "call_booked", "call_held", "proposal_sent", "won"].includes(stageOf(c))).length },
        { key: "meeting", label: "Meeting booked", n: finder.filter((c) => c.desk_outcome === "booked" || ["call_booked", "call_held", "proposal_sent", "won"].includes(stageOf(c))).length },
        { key: "closed", label: "Closed", n: finder.filter((c) => c.status === "Active" || stageOf(c) === "won").length },
      ];
      // 2027 goal: the primary RevenueGoal (e.g. $1M in 2027). Project revenue = one-time value of deals won each month;
      // MRR = live Stripe MRR across clients today + monthly value of deals won (committed SEO subscriptions).
      const goal = ((goalRows || []) as any[]).find((g) => g.is_primary) || (goalRows || [])[0] || null;
      const year = goal?.deadline ? Number(String(goal.deadline).slice(0, 4)) : 2027;
      const target = num(goal?.target_amount) || 1000000;
      const stripeMrr = ((active || []) as any[]).reduce((a, c) => a + num(c.stripe_mrr), 0);
      const goalMonths = Array.from({ length: 12 }, (_, i) => {
        const m = `${year}-${String(i + 1).padStart(2, "0")}`;
        const won = dl.filter((d) => d.status === "won" && monthOf(d.closed_at) === m);
        return { month: m, target: Math.round(target / 12), project: won.reduce((a, d) => a + num(d.contract_value), 0), new_mrr: won.reduce((a, d) => a + num(d.monthly_value), 0) };
      });
      const pending = dl.filter((d) => d.status === "pending_approval");
      return Response.json({
        days, board, activity, pipeline: { stages, industries }, funnel, pending_approvals: pending,
        goal: { title: goal?.title || "$1M in 2027", target, year, stripe_mrr: Math.round(stripeMrr), committed_mrr: dl.filter((d) => d.status === "won").reduce((a, d) => a + num(d.monthly_value), 0), months: goalMonths, from_goal: !!goal },
        totals: { calls: board.reduce((a, b) => a + b.calls, 0), meetings: board.reduce((a, b) => a + b.meetings, 0), deals: board.reduce((a, b) => a + b.deals_closed, 0), revenue: board.reduce((a, b) => a + b.revenue, 0), cost: board.reduce((a, b) => a + b.month_cost, 0) },
      });
    }

    return err("Unknown action");
  } catch (e) {
    return Response.json({ error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
});
