import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { ALL_TEMPLATES, instantiate, templateFor, TEMPLATE_VERSION, missingItems } from "../../shared/buildTemplates.js";

/*
 * Build Engine step 4: build checklists from niche templates.
 *   { action: "seed_templates" }   creates the BuildChecklistTemplate for any niche that has none, from the defaults in
 *                                  shared/buildTemplates.js, and upgrades templates still on older seeded defaults.
 *                                  Idempotent, takes no input, never touches a template someone edited.
 *                                  Workflow "Build checklists — seed templates (one-time)" runs it.
 *   { action: "ensure", client_id } admin: the client's BuildChecklist, created from its niche's template if missing.
 *                                  An older checklist gets the template's new items appended unticked (v3: linked apps);
 *                                  nothing existing is removed or changed.
 */
const s = (v: unknown) => (v == null ? "" : String(v));

async function seed(db: any) {
  const rows = (await db.BuildChecklistTemplate.list("niche_key", 50).catch(() => [])) || [];
  const have = new Set(rows.map((t: any) => t.niche_key));
  const made: string[] = [];
  const upgraded: string[] = [];
  // Upgrade templates that are still the seeded defaults (never one Justin edited) to the current version.
  for (const r of rows) {
    if ((Number(r.version) || 1) >= TEMPLATE_VERSION || !/^Seeded from/.test(String(r.notes || ""))) continue;
    const t = templateFor(r.niche_key);
    await db.BuildChecklistTemplate.update(r.id, { version: t.version, tracks: t.tracks, notes: `Seeded from shared/buildTemplates.js (v${t.version})` });
    upgraded.push(r.niche_key);
  }
  for (const t of ALL_TEMPLATES) {
    if (have.has(t.niche_key)) continue;
    await db.BuildChecklistTemplate.create({ niche_key: t.niche_key, label: t.label, version: t.version, tracks: t.tracks, notes: "Seeded from shared/buildTemplates.js" });
    made.push(t.niche_key);
  }
  return { ok: true, created: made, upgraded, existing: [...have] };
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    if (body?.action === "seed_templates") return Response.json(await seed(db));
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== "admin") return Response.json({ error: "Admins only" }, { status: 403 });
    if (body?.action === "ensure") {
      const c = await db.CRMClient.get(s(body.client_id)).catch(() => null);
      if (!c) return Response.json({ error: "Client not found" }, { status: 404 });
      const existing = ((await db.BuildChecklist.filter({ client_id: c.id }, "-updated_date", 1).catch(() => [])) || [])[0];
      const tpl = ((await db.BuildChecklistTemplate.filter({ niche_key: c.niche_key || "other" }, "-version", 1).catch(() => [])) || [])[0] || templateFor(c.niche_key);
      if (existing) {
        const up = (Number(existing.template_version) || 1) < (Number(tpl.version) || TEMPLATE_VERSION) ? missingItems(existing, tpl, c) : null;
        if (!up) return Response.json({ ok: true, checklist: existing, created: false });
        const rec = await db.BuildChecklist.update(existing.id, { tracks: up.tracks, template_version: up.template_version, updated_by: user.email });
        return Response.json({ ok: true, checklist: rec, created: false, added: up.added });
      }
      const rec = await db.BuildChecklist.create({ ...instantiate(tpl, c), website_app_id: s(c.site_app_id), command_app_id: s(c.command_app_id), updated_by: user.email });
      return Response.json({ ok: true, checklist: rec, created: true });
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: s((e as Error)?.message).slice(0, 300) }, { status: 500 });
  }
}
