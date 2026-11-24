// Portal terms gate (clickwrap), docs/portal-terms.md.
// Portal logins:
//   { action: "status", client_id? }  -> { required, gate } or { required: false, acceptances } (own client)
//   { action: "accept", client_id?, version_id, sha256, typed_signature, checks: { agree_tos, agree_cancellation }, scrolled_to_end }
//        Server stamps accepted_at, ip, user_agent; re-checks the active version's hash; writes ONE append-only
//        TermsAcceptance with a private PDF snapshot; emails a copy (client + agency admins; [TEST]: admins only).
//   { action: "pdf_link", acceptance_id } -> short-lived signed link to that PDF (own client's rows, or any for admins)
// Admins:
//   { action: "versions" } · { action: "save_draft", id?, version, title, body_markdown, summary_points, change_note, effective_date }
//   { action: "new_draft_from", id } · { action: "seed_draft_v1" } · { action: "publish", id, lawyer_reviewed }
//   { action: "client_status", client_id } · { action: "summary" } (signed client ids for the Clients filter)
// There is no update or delete of TermsAcceptance anywhere: corrections are a new acceptance.
// deno-lint-ignore-file no-explicit-any
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { resolveClient } from "../../shared/portalClient.ts";
import { REQUIRED_CHECKS, acceptanceErrors, buildAcceptance, clientIp, clientTermsStatus, clientUserAgent, hasAccepted, planPublish, sha256Hex } from "../../shared/terms.js";
import { DRAFT_V1 } from "../../shared/termsDraftV1.js";
import { acceptancesFor, activeVersion, buildPdf, clearActiveCache, isTestClient, publicTerms, sendCopies, signedLink, storePdf, termsGate, verifiedActive } from "../../shared/termsServer.ts";

const s = (v: unknown) => (v == null ? "" : String(v));
const itemsOf = (r: any) => (Array.isArray(r) ? r : (r && r.items) || []);
const bad = (error: string, status = 400, extra: Record<string, unknown> = {}) => Response.json({ error, ...extra }, { status });
const isTestRun = (client: any, user: any) => isTestClient(client) || /^\[TEST\]/i.test(s(user?.full_name));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return bad("Not signed in", 401);
    const db = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const action = s(body.action || "status");
    const admin = user.role === "admin";

    /* ---------- admin ---------- */
    if (["versions", "save_draft", "new_draft_from", "seed_draft_v1", "publish", "client_status", "summary"].includes(action)) {
      if (!admin) return bad("Forbidden", 403);
      const versions = itemsOf(await db.TermsVersion.list("-created_date", 100));
      if (action === "versions") {
        const acc = itemsOf(await db.TermsAcceptance.list("-accepted_at", 2000).catch(() => []));
        return Response.json({ versions: versions.map((v: any) => ({ ...v, acceptances: acc.filter((a: any) => a.terms_version_id === v.id).length })) });
      }
      if (action === "seed_draft_v1") {
        const existing = versions.find((v: any) => v.version === DRAFT_V1.version);
        if (existing) return Response.json({ ok: true, version: existing, existed: true });
        const created = await db.TermsVersion.create({ ...DRAFT_V1, status: "draft", sha256: await sha256Hex(DRAFT_V1.body_markdown), lawyer_reviewed: false });
        return Response.json({ ok: true, version: created });
      }
      if (action === "save_draft") {
        const fields = {
          version: s(body.version).trim().slice(0, 40), title: s(body.title).trim().slice(0, 200) || "Interstellar Terms of Service",
          body_markdown: s(body.body_markdown), change_note: s(body.change_note).slice(0, 2000), effective_date: s(body.effective_date).slice(0, 10),
          summary_points: (Array.isArray(body.summary_points) ? body.summary_points : []).map((x: unknown) => s(x).trim()).filter(Boolean).slice(0, 12),
        };
        if (!fields.version || !fields.body_markdown.trim()) return bad("A draft needs a version label and the terms text.");
        const sha256 = await sha256Hex(fields.body_markdown);
        if (body.id) {
          const cur = versions.find((v: any) => v.id === body.id);
          if (!cur) return bad("Draft not found", 404);
          if (cur.status !== "draft") return bad("Only drafts can be edited. Make a new draft from it instead.", 409);
          if (versions.some((v: any) => v.id !== cur.id && v.version === fields.version)) return bad(`Version ${fields.version} already exists.`, 409);
          return Response.json({ ok: true, version: await db.TermsVersion.update(cur.id, { ...fields, sha256, lawyer_reviewed: false }) });
        }
        if (versions.some((v: any) => v.version === fields.version)) return bad(`Version ${fields.version} already exists.`, 409);
        return Response.json({ ok: true, version: await db.TermsVersion.create({ ...fields, sha256, status: "draft", lawyer_reviewed: false }) });
      }
      if (action === "new_draft_from") {
        const src = versions.find((v: any) => v.id === body.id);
        if (!src) return bad("Version not found", 404);
        const label = new Date().toISOString().slice(0, 10);
        const version = versions.some((v: any) => v.version === label) ? `${label}-${versions.length + 1}` : label;
        return Response.json({ ok: true, version: await db.TermsVersion.create({ version, title: src.title, body_markdown: src.body_markdown, summary_points: src.summary_points || [], change_note: "", effective_date: "", status: "draft", sha256: await sha256Hex(src.body_markdown), lawyer_reviewed: false }) });
      }
      if (action === "publish") {
        if (body.lawyer_reviewed !== true) return bad("Confirm a lawyer reviewed this version before activating it.");
        // Test-only versions ([TEST] clients) are never retired by a real publish, and never published from here.
        const plan = planPublish(versions.filter((v: any) => !v.test_only), s(body.id));
        if ((plan as any).error) return bad((plan as any).error, 409);
        const draft = versions.find((v: any) => v.id === body.id);
        const now = new Date().toISOString();
        for (const id of (plan as any).retire) await db.TermsVersion.update(id, { status: "retired", retired_at: now });
        const activated = await db.TermsVersion.update(draft.id, { status: "active", sha256: await sha256Hex(draft.body_markdown), lawyer_reviewed: true, published_at: now, published_by: user.email, effective_date: draft.effective_date || now.slice(0, 10) });
        clearActiveCache();
        return Response.json({ ok: true, version: activated, retired: (plan as any).retire });
      }
      if (action === "client_status") {
        const cid = s(body.client_id);
        const cl = await db.CRMClient.get(cid).catch(() => null);
        const active = await activeVersion(db, true, isTestClient(cl));
        const acc = await acceptancesFor(db, cid);
        return Response.json({ active: publicTerms(active), status: clientTermsStatus(acc, { clientId: cid, active }), acceptances: acc });
      }
      if (action === "summary") {
        const active = await activeVersion(db, true);
        const acc = itemsOf(await db.TermsAcceptance.list("-accepted_at", 5000).catch(() => []));
        const signed = active ? [...new Set(acc.filter((a: any) => a.version === active.version && a.terms_sha256 === active.sha256).map((a: any) => a.client_id))] : [];
        const ever = [...new Set(acc.map((a: any) => a.client_id))];
        return Response.json({ active: active ? { id: active.id, version: active.version } : null, signed_client_ids: signed, ever_signed_client_ids: ever });
      }
    }

    /* ---------- portal logins ---------- */
    if (action === "pdf_link") {
      const row = await db.TermsAcceptance.get(s(body.acceptance_id)).catch(() => null);
      if (!row) return bad("Not found", 404);
      if (!admin) {
        const client = await resolveClient(db, user, row.client_id, { skipTerms: true });
        if (!client || client.id !== row.client_id) return bad("Forbidden", 403);
      }
      return Response.json({ url: await signedLink(base44, s(row.pdf_url), 600) });
    }

    if (admin) return bad("Admins preview the portal without signing. Sign in as the client's login to accept.", 403);
    const client = await resolveClient(db, user, body.client_id, { skipTerms: true });
    if (!client) return bad("No portal is set up for this login yet.", 403, { code: "no_client" });

    if (action === "status") {
      const gate = await termsGate(db, user, client);
      if (gate) return Response.json({ required: true, gate });
      const acc = (await acceptancesFor(db, client.id)).map((a: any) => ({ id: a.id, version: a.version, user_email: a.user_email, typed_signature: a.typed_signature, accepted_at: a.accepted_at, has_pdf: !!a.pdf_url }));
      return Response.json({ required: false, acceptances: acc });
    }

    if (action === "accept") {
      const { active, ok } = await verifiedActive(db, isTestClient(client));
      if (active && !ok) return bad("These terms can't be signed right now (integrity check failed). Interstellar has been notified.", 409, { code: "hash_mismatch" });
      const checks = Object.fromEntries(REQUIRED_CHECKS.map((c) => [c.key, body.checks?.[c.key] === true]));
      const errs = acceptanceErrors({ active, sentVersionId: body.version_id, sentSha: body.sha256, checks, signature: body.typed_signature, scrolledToEnd: body.scrolled_to_end === true });
      if (errs.length) return bad(errs[0], 422, { errors: errs, code: errs[0].startsWith("The terms") ? "terms_changed" : "invalid" });
      const mine = await acceptancesFor(db, client.id, user.email);
      if (hasAccepted(mine, { clientId: client.id, email: user.email, version: active.version, sha256: active.sha256 })) return Response.json({ ok: true, already: true });

      const isTest = isTestRun(client, user);
      const rec = buildAcceptance({
        client, user, active, signature: body.typed_signature, checks, scrolledToEnd: true,
        ip: clientIp(req.headers), userAgent: clientUserAgent(req.headers), acceptedAt: new Date().toISOString(), isTest,
      });
      try {
        const bytes = await buildPdf(active, rec);
        rec.pdf_url = await storePdf(base44, bytes, `terms-${s(active.version)}-${s(client.id).slice(-6)}-${Date.now()}.pdf`);
      } catch (_e) { rec.pdf_url = ""; }
      const link = rec.pdf_url ? await signedLink(base44, rec.pdf_url).catch(() => "") : "";
      (rec as any).email_status = await sendCopies(base44, rec, link, isTest).catch(() => "failed");
      const saved = await db.TermsAcceptance.create(rec);
      return Response.json({ ok: true, acceptance: { id: saved.id, version: saved.version, accepted_at: saved.accepted_at, has_pdf: !!saved.pdf_url } });
    }

    return bad("Unknown action");
  } catch (_e) {
    return bad("Terms error", 500);
  }
});
