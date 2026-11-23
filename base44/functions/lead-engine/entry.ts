// @ts-nocheck
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { staffOf, canWorkLead, forStaff, assignLead, clip, nowIso, noteDate, isEmail } from "../../shared/staff.ts";
import { seedTemplates, SEED_KEYS, matchTemplate, buildPreview, applyOverrides, presentationPack, nextAction, followUpDraft, presenterFor, routeLead, OUTCOMES, PAY_METHODS, INCENTIVE } from "../../shared/leadEngine.js";
import { runScrape } from "../../shared/leadScrape.ts";
import { moveStage, stageOf } from "../../shared/leadStage.ts";
import { inviteSettings, normEmail } from "../../shared/portalInvite.ts";
import { sendBrandedEmail } from "../../shared/onboardingEmail.ts";
import { leadInviteEmail, leadSettings, optOutUrl, verifyOptOut, optOutPage } from "../../shared/leadInvite.ts";

/*
 * Lead Engine: templates, lead previews, presentation packs, agents, the Lead Desk and the lead-tier portal invite.
 * Admins see everything; sales reps (SalesRep rows) only their own leads (assigned to them or built by them).
 * Nothing here emails, texts or invites anyone except invite_send, which needs a person's click (confirm: true)
 * and refuses do-not-contact / opted-out leads and a missing postal address.
 * Public: GET/POST ?optout=<signed token> (one-click opt-out from the invite email).
 */

const err = (error: string, status = 400, extra = {}) => Response.json({ error, ...extra }, { status });
const arr = (v: any) => (Array.isArray(v) ? v : []);

async function templatesOf(db: any) {
  const rows = ((await db.IndustryTemplate.filter({ archived: { $ne: true } }, "name", 100).catch(() => [])) || []) as any[];
  return { rows, list: rows.length ? rows : seedTemplates(), seeded: rows.length > 0 };
}
async function previewOf(db: any, clientId: string) {
  return (((await db.LeadPreview.filter({ client_id: clientId }, "-updated_date", 1).catch(() => [])) || []) as any[])[0] || null;
}
const logEntry = (by: string, action: string, version: number, note = "") => ({ at: nowIso(), by, action, version, note: String(note).slice(0, 300) });
const audit = (db: any, actor: string, action: string, record: any, summary: string) => db.AgentAuditLog.create({ at: nowIso(), ok: true, actor, action, entity: "LeadPreview", record_id: record?.id || "", summary }).catch(() => null);

async function optOutHandler(req: Request, db: any, url: URL) {
  let tok = url.searchParams.get("optout") || "";
  if (req.method === "POST") { const f = await req.formData().catch(() => null); if (f) tok = String(f.get("optout") || tok); }
  const html = (s: string, status = 200) => new Response(s, { status, headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
  const id = await verifyOptOut(tok);
  if (!id) return html(optOutPage("This link isn't valid", "Reply to the email you received and ask to be removed, and we'll take you off right away."), 400);
  const c = await db.CRMClient.get(id).catch(() => null);
  if (!c) return html(optOutPage("You're off the list", "We won't contact you again."));
  if (req.method !== "POST") {
    const esc = (s: string) => String(s).replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] as string));
    return html(optOutPage("Stop hearing from us?", `We'll stop contacting ${esc(c.business || "your business")} about the preview we built. No calls, no emails.`, `<form method="POST"><input type="hidden" name="optout" value="${esc(tok)}"><button type="submit">Opt out</button></form>`));
  }
  if (!c.do_not_contact || !c.email_opt_out) {
    await db.CRMClient.update(c.id, { email_opt_out: true, do_not_contact: true, dnc_reason: "Opted out from the invite email link", dnc_at: nowIso() });
    await db.LeadCallLog.create({ client_id: c.id, client_name: c.business, outcome: "do_not_contact", note: "Opted out with the email link", caller: "opt-out link", at: nowIso() }).catch(() => null);
  }
  return html(optOutPage("You're off the list", "Done. We won't call or email you about this again."));
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    if (url.searchParams.get("optout") || (req.method === "POST" && (req.headers.get("content-type") || "").includes("form"))) return await optOutHandler(req, db, url);

    const user = await base44.auth.me().catch(() => null);
    const staff = await staffOf(db, user);
    if (!staff) return err("Admins and sales reps only", 403);
    const admin = staff.kind === "admin";
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const lead = async () => {
      const c = await db.CRMClient.get(clip(body.client_id, 64)).catch(() => null);
      if (!c) throw Object.assign(new Error("Lead not found"), { status: 404 });
      if (!canWorkLead(staff, c)) throw Object.assign(new Error("This lead isn't assigned to you"), { status: 403 });
      return c;
    };

    /* ---------------- Templates ---------------- */
    if (action === "templates") {
      const { list, seeded } = await templatesOf(db);
      return Response.json({ templates: list, seeded, can_edit: admin, allowed: staff.rep?.allowed_industries || null, multi: !!staff.rep?.multi_industry_ready });
    }
    if (action === "templates_seed") {
      if (!admin) return err("Admins only", 403);
      const { rows } = await templatesOf(db);
      const have = new Set(rows.map((r: any) => r.industry_key));
      const add = seedTemplates().filter((t) => !have.has(t.industry_key));
      for (const t of add) await db.IndustryTemplate.create({ ...t, updated_by: "Claude (seed)" });
      return Response.json({ created: add.length, total: have.size + add.length, keys: SEED_KEYS });
    }
    if (action === "template_save") {
      if (!admin) return err("Admins only. Use Suggest to send a refinement.", 403);
      const t = await db.IndustryTemplate.get(clip(body.id, 64)).catch(() => null);
      if (!t) return err("Template not found", 404);
      const p = body.patch || {};
      const allowed = ["name", "category", "status", "places_query", "match_keywords", "website_template", "command_template", "reference_builds"];
      const patch: any = {};
      for (const k of allowed) if (p[k] !== undefined) patch[k] = p[k];
      if (patch.status && !["draft", "refining", "ready"].includes(patch.status)) delete patch.status;
      const changed = Object.keys(patch).filter((k) => JSON.stringify(patch[k]) !== JSON.stringify(t[k]));
      if (!changed.length && !clip(body.note)) return Response.json({ template: t, unchanged: true });
      const note = { at: nowIso(), author: staff.name, email: staff.email, kind: body.agent === true ? "agent" : "human", note: clip(body.note, 1000) || `Edited ${changed.join(", ")}`, fields: changed };
      const saved = await db.IndustryTemplate.update(t.id, { ...patch, version: (Number(t.version) || 1) + (changed.length ? 1 : 0), refinement_notes: [...arr(t.refinement_notes), note].slice(-200), updated_by: staff.email });
      return Response.json({ template: saved });
    }
    if (action === "template_suggest") {
      const t = await db.IndustryTemplate.get(clip(body.id, 64)).catch(() => null);
      if (!t) return err("Template not found (ask Justin to seed the library).", 404);
      const text = clip(body.note, 1500);
      if (text.length < 5) return err("Write the refinement you're suggesting.");
      const note = { at: nowIso(), author: staff.name, email: staff.email, kind: "suggestion", note: text, status: "open" };
      await db.IndustryTemplate.update(t.id, { refinement_notes: [...arr(t.refinement_notes), note].slice(-200) });
      return Response.json({ ok: true });
    }

    /* ---------------- Leads ---------------- */
    if (action === "leads") {
      const all = ((await db.CRMClient.filter({ status: "Lead" }, "-created_date", 1000).catch(() => [])) || []) as any[];
      const mine = admin ? all : all.filter((c) => canWorkLead(staff, c));
      const ids = new Set(mine.map((c) => c.id));
      const previews = ((await db.LeadPreview.list("-updated_date", 1000).catch(() => [])) || []).filter((p: any) => ids.has(p.client_id));
      const byClient = new Map(previews.map((p: any) => [p.client_id, p]));
      const reps = admin ? (((await db.SalesRep.list("name", 200).catch(() => [])) || []) as any[]).map((r) => ({ id: r.id, name: r.name, status: r.status, mode: r.mode })) : [];
      return Response.json({
        leads: mine.map((c) => {
          const p = byClient.get(c.id) || null;
          return { ...forStaff(staff, c), preview: p ? { id: p.id, status: p.status, version: p.version, built_at: p.built_at, engagement: p.engagement || null, industry_key: p.industry_key, has_pack: !!p.presentation } : null, next: nextAction(c, p) };
        }),
        reps, me: staff.kind === "sales" ? { id: staff.rep.id, name: staff.rep.name, mode: staff.rep.mode } : null,
      });
    }
    if (action === "lead") {
      const c = await lead();
      const [p, calls, tpl] = await Promise.all([previewOf(db, c.id), db.LeadCallLog.filter({ client_id: c.id }, "-at", 50).catch(() => []), templatesOf(db)]);
      const t = matchTemplate(tpl.list, { industry_key: c.industry_key, text: `${c.industry || ""} ${c.one_liner || ""} ${(c.scrape_summary?.gbp?.categories || []).join(" ")}`, niche_key: c.niche_key });
      return Response.json({ client: forStaff(staff, c), preview: p, calls: calls || [], template: t ? { industry_key: t.industry_key, name: t.name, version: t.version } : null, next: nextAction(c, p), follow_up: followUpDraft(c.desk_outcome || "no_answer", { client: c, rep: staff.rep }) });
    }
    if (action === "scrape") {
      const c = await lead();
      const r = await runScrape(base44, c);
      if (r?.error) return err(r.error, r.status || 500);
      return Response.json(r);
    }
    if (action === "build_preview") {
      const c = await lead();
      const tpl = await templatesOf(db);
      const t = matchTemplate(tpl.list, { industry_key: clip(body.industry_key, 60) || c.industry_key, text: `${c.industry || ""} ${c.one_liner || ""} ${(c.scrape_summary?.gbp?.categories || []).join(" ")} ${c.scrape_summary?.industry || ""}`, niche_key: c.niche_key });
      if (!t) return err("No templates yet. Seed the library on the Templates page.");
      const built = buildPreview({ client: c, template: t, now: nowIso() });
      const prev = await previewOf(db, c.id);
      const overrides = body.reset_edits === true ? {} : prev?.website_overrides || {};
      const version = (Number(prev?.version) || 0) + 1;
      const data: any = {
        client_id: c.id, client_name: c.business, industry_key: t.industry_key, website_base: built.website_config, website_overrides: overrides,
        website_config: applyOverrides(built.website_config, overrides), command_config: built.command_config, missing: built.missing,
        built_at: nowIso(), built_by: staff.email, version, template_version: t.version || 1,
        status: prev && ["sent", "viewed"].includes(prev.status) ? prev.status : "draft",
        build_log: [...arr(prev?.build_log), logEntry(staff.email, prev ? "rebuild" : "build", version, `${t.name} template v${t.version || 1}${built.missing.length ? ` · missing: ${built.missing.join(", ")}` : ""}`)].slice(-40),
      };
      const row = prev ? await db.LeadPreview.update(prev.id, data) : await db.LeadPreview.create(data);
      const cpatch: any = {};
      if (!c.industry_key) cpatch.industry_key = t.industry_key;
      if (staff.kind === "sales") {
        cpatch.builder_rep_id = staff.rep.id;
        // First right to present: the builder takes the lead when they sell (closer or both) and nobody else has it.
        if (staff.rep.mode !== "builder" && (!c.assigned_rep_id || c.assigned_rep_id === staff.rep.id)) Object.assign(cpatch, { assigned_rep_id: staff.rep.id, assigned_rep_name: staff.rep.name, assigned_at: c.assigned_at || nowIso() });
      }
      if (Object.keys(cpatch).length) await db.CRMClient.update(c.id, cpatch);
      await audit(db, staff.email, prev ? "preview_rebuilt" : "preview_built", row, `${c.business}: preview v${version} from ${t.name}`);
      return Response.json({ preview: row, missing: built.missing });
    }
    if (action === "preview_patch") {
      const c = await lead();
      const p = await previewOf(db, c.id);
      if (!p) return err("Build the preview first.");
      const o = body.overrides && typeof body.overrides === "object" ? body.overrides : {};
      const merged = { hero: { ...(p.website_overrides?.hero || {}), ...(o.hero || {}) }, sections: { ...(p.website_overrides?.sections || {}), ...(o.sections || {}) }, order: Array.isArray(o.order) ? o.order.map((x: any) => clip(x, 40)).slice(0, 30) : p.website_overrides?.order || [], seo: { ...(p.website_overrides?.seo || {}), ...(o.seo || {}) } };
      const row = await db.LeadPreview.update(p.id, { website_overrides: merged, website_config: applyOverrides(p.website_base || p.website_config, merged), build_log: [...arr(p.build_log), logEntry(staff.email, "edit", p.version || 1, clip(body.note, 200) || "Text / sections edited")].slice(-40) });
      return Response.json({ preview: row });
    }
    if (action === "preview_status") {
      const c = await lead();
      const p = await previewOf(db, c.id);
      if (!p) return err("Build the preview first.");
      const status = body.status === "ready" ? "ready" : "draft";
      const row = await db.LeadPreview.update(p.id, { status: ["sent", "viewed"].includes(p.status) && status === "ready" ? p.status : status, ...(status === "ready" ? { ready_at: nowIso() } : {}), build_log: [...arr(p.build_log), logEntry(staff.email, status, p.version || 1)].slice(-40) });
      return Response.json({ preview: row });
    }
    if (action === "presentation") {
      const c = await lead();
      const p = await previewOf(db, c.id);
      if (!p) return err("Build the preview first; the pack is made from it.");
      const tpl = await templatesOf(db);
      const t = tpl.list.find((x: any) => x.industry_key === p.industry_key) || null;
      const reps = ((await db.SalesRep.list("name", 200).catch(() => [])) || []) as any[];
      const pack = presentationPack({ client: c, preview: p, template: t, rep: staff.rep || presenterFor(c, reps) });
      const row = await db.LeadPreview.update(p.id, { presentation: pack, build_log: [...arr(p.build_log), logEntry(staff.email, "presentation", p.version || 1)].slice(-40) });
      return Response.json({ presentation: pack, preview: row });
    }
    if (action === "agent_run") {
      // The lead agent: research, build, prep, suggest. Never sends anything; drafts wait for a person.
      const ids: string[] = body.all_new === true && admin
        ? (((await db.CRMClient.filter({ status: "Lead", lead_source: "lead_finder" }, "-created_date", 200).catch(() => [])) || []) as any[]).filter((c) => !c.do_not_contact && c.scrape_status !== "running").slice(0, Math.min(5, Number(body.limit) || 3)).map((c) => c.id)
        : [clip(body.client_id, 64)];
      const out: any[] = [];
      for (const id of ids) {
        let c = await db.CRMClient.get(id).catch(() => null);
        if (!c || !canWorkLead(staff, c)) { out.push({ id, error: "not allowed" }); continue; }
        const steps: string[] = [];
        if (!c.scrape_summary && c.scrape_status !== "running") { const r = await runScrape(base44, c); steps.push(r?.error ? `scrape failed: ${r.error}` : `scraped (Brain ${r.completeness ?? 0}%)`); c = await db.CRMClient.get(id); }
        let p = await previewOf(db, id);
        if (!p && c.scrape_summary) {
          const tpl = await templatesOf(db);
          const t = matchTemplate(tpl.list, { industry_key: c.industry_key, text: `${c.industry || ""} ${c.one_liner || ""} ${c.scrape_summary?.industry || ""}`, niche_key: c.niche_key });
          const built = buildPreview({ client: c, template: t, now: nowIso() });
          p = await db.LeadPreview.create({ client_id: id, client_name: c.business, industry_key: t.industry_key, website_base: built.website_config, website_overrides: {}, website_config: built.website_config, command_config: built.command_config, missing: built.missing, built_at: nowIso(), built_by: "agent", version: 1, template_version: t.version || 1, status: "draft", build_log: [logEntry("agent", "build", 1, `Drafted by the lead agent from ${t.name}`)] });
          if (!c.industry_key) await db.CRMClient.update(id, { industry_key: t.industry_key });
          steps.push(`preview drafted from ${t.name} (waits for a person to mark it Ready)`);
        }
        if (p && !p.presentation) {
          const tpl = await templatesOf(db);
          const pack = presentationPack({ client: c, preview: p, template: tpl.list.find((x: any) => x.industry_key === p.industry_key) || null, rep: staff.rep });
          p = await db.LeadPreview.update(p.id, { presentation: pack });
          steps.push("presentation pack prepared");
        }
        const next = nextAction(c, p);
        const draft = followUpDraft(c.desk_outcome || "no_answer", { client: c, rep: staff.rep });
        await audit(db, "agent:lead", "lead_agent_run", p, `${c.business}: ${steps.join("; ") || "nothing to do"} · next: ${next.label}`);
        out.push({ id, business: c.business, steps, next, draft });
      }
      return Response.json({ results: out });
    }

    /* ---------------- Lead Desk ---------------- */
    if (action === "desk_log") {
      const c = await lead();
      const outcome = String(body.outcome || "");
      if (!OUTCOMES.some((o) => o.key === outcome) && outcome !== "note") return err("Pick an outcome.");
      if (c.do_not_contact && outcome !== "note") return err("This lead is marked do-not-contact.", 409);
      const def = OUTCOMES.find((o) => o.key === outcome);
      const follow = /^\d{4}-\d{2}-\d{2}$/.test(String(body.follow_up_at || "")) ? body.follow_up_at : def && def.next_days ? new Date(Date.now() + def.next_days * 86400000).toISOString().slice(0, 10) : "";
      const note = clip(body.note, 2000);
      await db.LeadCallLog.create({ client_id: c.id, client_name: c.business, outcome, note, caller: staff.email, at: nowIso(), ...(follow ? { follow_up_at: follow } : {}) });
      const label = def?.label || "Note";
      const patch: any = { notes: [...arr(c.notes).filter((n: any) => n && typeof n === "object"), { id: Date.now(), text: `Lead Desk · ${label}${note ? `: ${note}` : ""} (${staff.name})`, date: noteDate() }] };
      if (outcome !== "note") Object.assign(patch, { desk_outcome: outcome, desk_last_call_at: nowIso() });
      if (follow) Object.assign(patch, { next_step: outcome === "booked" ? "Walkthrough" : outcome === "callback" ? "Call back" : "Follow up", next_step_at: follow });
      if (outcome === "not_interested") Object.assign(patch, { next_step: "", next_step_at: null });
      await db.CRMClient.update(c.id, patch);
      const stage = stageOf(c);
      if (outcome === "booked" && ["new", "contacted"].includes(stage)) await moveStage(db, c.id, "call_booked", { by: staff.email, reason: "Walkthrough booked from the Lead Desk", source: "dropdown" }).catch(() => null);
      else if (outcome !== "note" && outcome !== "no_answer" && stage === "new") await moveStage(db, c.id, "contacted", { by: staff.email, reason: `Lead Desk: ${label}`, source: "dropdown" }).catch(() => null);
      if (outcome === "booked" && !(c.lead_incentive?.status && c.lead_incentive.status !== "none")) await db.CRMClient.update(c.id, { lead_incentive: { status: "owed", amount: INCENTIVE.amount, minutes: INCENTIVE.minutes, owed_at: nowIso() } });
      return Response.json({ ok: true, follow_up_at: follow || null });
    }
    if (action === "incentive_save") {
      const c = await lead();
      const status = ["none", "owed", "paid"].includes(body.status) ? body.status : "owed";
      const method = PAY_METHODS.includes(body.method) ? body.method : "";
      const note = clip(body.note, 300);
      // Never store payment account numbers, handles or emails for the payout.
      if (/\d{5,}|@|\$[a-z]/i.test(note)) return err("Don't store account numbers, handles or emails here. Just the method and date.");
      if (status === "paid" && !method) return err("Pick how it was paid.");
      const inc = { ...(c.lead_incentive || {}), status, amount: Math.max(0, Math.min(500, Number(body.amount) || INCENTIVE.amount)), minutes: Math.max(0, Math.min(240, Number(body.minutes) || INCENTIVE.minutes)), method, note, paid_at: status === "paid" ? (/^\d{4}-\d{2}-\d{2}$/.test(String(body.paid_at || "")) ? body.paid_at : nowIso().slice(0, 10)) : null, updated_by: staff.email, updated_at: nowIso() };
      await db.CRMClient.update(c.id, { lead_incentive: inc });
      await db.LeadCallLog.create({ client_id: c.id, client_name: c.business, outcome: "incentive", note: `$${inc.amount} ${status}${method ? ` via ${method}` : ""}`, caller: staff.email, at: nowIso(), incentive: inc });
      return Response.json({ incentive: inc });
    }
    if (action === "dnc_set") {
      const c = await lead();
      const on = body.on !== false;
      if (!on && !admin) return err("Only an admin can remove do-not-contact.", 403);
      await db.CRMClient.update(c.id, on ? { do_not_contact: true, dnc_reason: clip(body.reason, 200) || "Asked not to be contacted", dnc_at: nowIso(), next_step: "", next_step_at: null } : { do_not_contact: false, dnc_reason: "", dnc_at: null });
      await db.LeadCallLog.create({ client_id: c.id, client_name: c.business, outcome: "do_not_contact", note: on ? clip(body.reason, 200) || "Asked not to be contacted" : "Do-not-contact removed", caller: staff.email, at: nowIso() });
      return Response.json({ ok: true, do_not_contact: on });
    }
    if (action === "invite_compose" || action === "invite_send") {
      const c = await lead();
      const p = await previewOf(db, c.id);
      const email = normEmail(body.email || (c.portal_emails || [])[0] || (c.emails || [])[0] || "");
      const settings = await inviteSettings(db);
      const ls = await leadSettings(db);
      const blockers: string[] = [];
      if (c.do_not_contact) blockers.push("This lead is marked do-not-contact.");
      if (c.email_opt_out) blockers.push("This lead opted out of emails.");
      if (!p || !["ready", "sent", "viewed"].includes(p.status)) blockers.push("Mark the preview Ready to show first.");
      if (!isEmail(email)) blockers.push("Add the owner's email address.");
      if (!ls.postal_address.trim()) blockers.push("Add Interstellar's mailing address in Lead Desk › Settings (the law requires it in this email).");
      if (c.status !== "Lead" || c.portal_tier === "client") blockers.push("This is already a client; use the normal portal invite.");
      const optOut = await optOutUrl(settings.portal_url, c.id);
      const repName = staff.kind === "sales" ? staff.rep.name : "";
      const { subject, html } = leadInviteEmail({ business: c.business, contact: c.contact || "", email: email || "you@example.com", loginUrl: `${settings.portal_url}/login`, optOut, postal: ls.postal_address || "[mailing address needed]", logo: c.logo_url || "", replyEmail: ls.reply_email, repName });
      if (action === "invite_compose") return Response.json({ to: email, subject, html, blockers, portal_url: settings.portal_url });
      if (body.confirm !== true) return err("Click Send to confirm.");
      if (blockers.length) return err(blockers[0], 409, { blockers });
      const emails = [...new Set([...(c.portal_emails || []).map(normEmail), email])];
      await db.CRMClient.update(c.id, { portal_emails: emails, portal_enabled: true, portal_tier: "lead", portal_tier_changed_at: nowIso(), emails: [...new Set([...(c.emails || []), email])] });
      const inv = await db.PortalInvite.create({ client_id: c.id, client_name: c.business, email, source: "manual", status: "queued", due_at: nowIso(), invited_by: staff.email, package: "Lead preview (lead tier)" });
      try {
        try { await base44.asServiceRole.users.inviteUser(email, "user"); } catch (e) { if (!/already|exist/i.test(String(e?.response?.data?.message || e?.message || e))) throw e; }
        await sendBrandedEmail(base44, { to: email, subject, html });
      } catch (e) {
        const msg = String(e?.response?.data?.message || e?.message || e).slice(0, 300);
        await db.PortalInvite.update(inv.id, { status: "failed", message: msg });
        return err(`Couldn't send: ${msg}`, 502);
      }
      await db.PortalInvite.update(inv.id, { status: "sent", sent_at: nowIso(), message: `Lead-tier portal access granted and the preview email sent to ${email} by ${staff.email}.` });
      await db.LeadPreview.update(p.id, { status: p.status === "viewed" ? "viewed" : "sent", sent_at: nowIso(), build_log: [...arr(p.build_log), logEntry(staff.email, "sent", p.version || 1, `Invite to ${email}`)].slice(-40) });
      await db.LeadCallLog.create({ client_id: c.id, client_name: c.business, outcome: "sent_portal", note: `Portal invite sent to ${email}`, caller: staff.email, at: nowIso() });
      await db.CRMClient.update(c.id, { desk_outcome: "sent_portal", desk_last_call_at: nowIso() });
      return Response.json({ ok: true, to: email });
    }

    /* ---------------- Admin ---------------- */
    if (action === "settings") {
      if (!admin) return err("Admins only", 403);
      const ls = await leadSettings(db);
      if (body.save) {
        const next = { postal_address: clip(body.postal_address, 200), reply_email: isEmail(body.reply_email) ? normEmail(body.reply_email) : ls.reply_email };
        if (ls.row) await db.AppSettings.update(ls.row.id, { pageSettings: { ...(ls.row.pageSettings || {}), ...next } });
        else await db.AppSettings.create({ key: "lead_engine", pageSettings: next });
        return Response.json({ settings: next });
      }
      return Response.json({ settings: { postal_address: ls.postal_address, reply_email: ls.reply_email } });
    }
    if (action === "set_tier") {
      if (!admin) return err("Admins only", 403);
      const c = await lead();
      const tier = body.tier === "client" ? "client" : "lead";
      await db.CRMClient.update(c.id, { portal_tier: tier, portal_tier_changed_at: nowIso() });
      await db.AgentAuditLog.create({ at: nowIso(), ok: true, actor: staff.email, action: "portal_tier", entity: "CRMClient", record_id: c.id, summary: `${c.business}: portal tier → ${tier} (by hand; nothing deleted)` }).catch(() => null);
      return Response.json({ ok: true, tier });
    }
    if (action === "route_unassigned") {
      if (!admin) return err("Admins only", 403);
      const open = ((await db.CRMClient.filter({ status: "Lead" }, "-created_date", 500).catch(() => [])) || []).filter((c: any) => !c.assigned_rep_id && !c.do_not_contact && !["won", "lost"].includes(String(c.pipeline_stage || ""))).slice(0, 100);
      const res: any[] = [];
      for (const c of open) { const r = await assignLead(db, c, routeLead, { by: staff.email }); if (r) res.push({ lead: c.business, rep: r.name }); }
      return Response.json({ assigned: res, left: open.length - res.length });
    }
    if (action === "assign") {
      if (!admin) return err("Admins only", 403);
      const c = await lead();
      const rep = body.rep_id ? await db.SalesRep.get(clip(body.rep_id, 64)).catch(() => null) : null;
      await db.CRMClient.update(c.id, rep ? { assigned_rep_id: rep.id, assigned_rep_name: rep.name, assigned_at: nowIso() } : { assigned_rep_id: "", assigned_rep_name: "", assigned_at: null });
      if (rep) await db.SalesRep.update(rep.id, { assigned_total: (Number(rep.assigned_total) || 0) + 1, last_assigned_at: nowIso() });
      return Response.json({ ok: true });
    }
    if (action === "stats") {
      if (!admin) return err("Admins only", 403);
      const week = new Date(Date.now() - 7 * 86400000).toISOString();
      const [found, previews, all] = await Promise.all([
        db.CRMClient.filter({ lead_source: "lead_finder", created_date: { $gte: week } }, "-created_date", 1000).catch(() => []),
        db.LeadPreview.list("-updated_date", 1000).catch(() => []),
        db.CRMClient.filter({ lead_source: "lead_finder" }, "-created_date", 2000).catch(() => []),
      ]);
      const pv = (previews || []) as any[];
      const withPreview = new Set(pv.map((p) => p.client_id));
      const leads = (all || []) as any[];
      const owed = leads.filter((c) => c.lead_incentive?.status === "owed");
      return Response.json({
        found_week: (found || []).length,
        previews_ready: pv.filter((p) => ["ready", "sent", "viewed"].includes(p.status)).length,
        previews_draft: pv.filter((p) => p.status === "draft").length,
        portal_logins: pv.filter((p) => p.engagement?.first_login_at).length,
        walkthroughs: pv.filter((p) => p.engagement?.walkthrough_booked_at).length + leads.filter((c) => c.desk_outcome === "booked" && !pv.find((p) => p.client_id === c.id && p.engagement?.walkthrough_booked_at)).length,
        incentives_owed: owed.length, incentives_owed_usd: owed.reduce((a, c) => a + (Number(c.lead_incentive?.amount) || INCENTIVE.amount), 0),
        conversions: leads.filter((c) => c.status === "Active" && withPreview.has(c.id)).length,
      });
    }

    return err("Unknown action");
  } catch (e) {
    return Response.json({ error: String(e?.message || e).slice(0, 300) }, { status: e?.status || 500 });
  }
});
