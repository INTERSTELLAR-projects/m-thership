import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Start a purchased service for a client: one Project + every task from the matching SOP playbooks
// (TaskTemplate.service_key), dated from the start date. Safe to call twice: the same order_ref
// never creates a second list. Called from the client page today; a Stripe purchase can call the
// same logic later (not wired yet — automations come last).

type Pkg = { label: string; type: string; value: number; billing: string; streams: string[]; onboarding: boolean; services: string[] };
export const PACKAGES: Record<string, Pkg> = {
  mission_alpha:  { label: "Mission ALPHA", type: "website", value: 8997, billing: "one_time", onboarding: true,
                    streams: ["intel_briefing", "website", "system", "ops_command", "brand_arsenal", "launch_grid", "transmission", "starship"],
                    services: ["website", "system", "brand", "starship_care"] },
  mission_bravo:  { label: "Mission BRAVO", type: "website", value: 6497, billing: "one_time", onboarding: true,
                    streams: ["website", "system"], services: ["website", "system"] },
  custom_website: { label: "Custom Website", type: "website", value: 0, billing: "one_time", onboarding: true, streams: ["website"], services: ["website"] },
  command_system: { label: "Command System", type: "app", value: 0, billing: "one_time", onboarding: true, streams: ["system"], services: ["system"] },
  ops_command:    { label: "Ops Command", type: "automation", value: 3000, billing: "one_time", onboarding: false, streams: ["ops_command"], services: ["system"] },
  brand_arsenal:  { label: "Brand Arsenal", type: "branding", value: 2500, billing: "one_time", onboarding: false, streams: ["brand_arsenal"], services: ["brand"] },
  launch_grid:    { label: "Launch Grid", type: "seo", value: 1400, billing: "one_time", onboarding: false, streams: ["launch_grid"], services: [] },
  intel_briefing: { label: "Intel Briefing", type: "consulting", value: 1500, billing: "one_time", onboarding: false, streams: ["intel_briefing"], services: [] },
  transmission:   { label: "Transmission Video", type: "marketing", value: 0, billing: "one_time", onboarding: false, streams: ["transmission"], services: [] },
  orbit_local:    { label: "HyperCare+ Local", type: "seo", value: 750, billing: "retainer", onboarding: false,
                    streams: ["orbit_setup", "orbit_local", "starship"], services: ["orbit_seo", "starship_care"] },
  orbit_multi:    { label: "HyperCare+ Multi-Location", type: "seo", value: 350, billing: "retainer", onboarding: false, streams: ["orbit_multi"], services: ["orbit_seo"] },
  orbit_national: { label: "HyperCare+ National", type: "seo", value: 1750, billing: "retainer", onboarding: false,
                    streams: ["orbit_setup", "orbit_national", "starship"], services: ["orbit_seo", "starship_care"] },
  orbit_global:   { label: "HyperCare+ Global", type: "seo", value: 3000, billing: "retainer", onboarding: false,
                    streams: ["orbit_setup", "orbit_national", "orbit_global", "starship"], services: ["orbit_seo", "starship_care"] },
  starship_care:  { label: "Starshïp Care", type: "other", value: 197, billing: "retainer", onboarding: false, streams: ["starship"], services: ["starship_care"] },
};

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== "admin") return Response.json({ error: "Admins only" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    if (body?.action === "catalog") return Response.json({ packages: PACKAGES });

    const pkg = PACKAGES[String(body?.package || "")];
    if (!pkg) return Response.json({ error: "Unknown package" }, { status: 400 });
    const clientId = String(body?.client_id || "");
    if (!clientId) return Response.json({ error: "Missing client_id" }, { status: 400 });
    const start = /^\d{4}-\d{2}-\d{2}$/.test(body?.start_date || "") ? body.start_date : new Date().toISOString().slice(0, 10);
    const withOnboarding = typeof body?.include_onboarding === "boolean" ? body.include_onboarding : pkg.onboarding;
    const orderRef = String(body?.order_ref || `manual-${clientId}-${body.package}-${start}`);

    const db = base44.asServiceRole.entities;
    const client = await db.CRMClient.get(clientId).catch(() => null);
    if (!client) return Response.json({ error: "Client not found" }, { status: 404 });

    const [existing] = await db.Project.filter({ order_ref: orderRef });
    if (existing) return Response.json({ ok: true, duplicate: true, project_id: existing.id, tasks: 0 });

    const streams = [...(withOnboarding ? ["onboarding"] : []), ...pkg.streams];
    const templates = await db.TaskTemplate.list("sort_order", 200);
    const byKey = new Map<string, any>();
    for (const t of templates) if (t.service_key && !byKey.has(t.service_key)) byKey.set(t.service_key, t);
    const missing = streams.filter((s) => !byKey.has(s));

    const used = streams.filter((s) => byKey.has(s)).map((s) => byKey.get(s));
    const lastOffset = Math.max(0, ...used.flatMap((t) => (t.items || []).map((i: any) => (Number(i.offset_days) || 0) + (Number(i.estimated_days) || 0))));
    const title = `${client.business} · ${pkg.label}`;

    const project = await db.Project.create({
      title, client_id: client.id, client_name: client.business, type: pkg.type, status: "planning", priority: 2,
      start_date: start, due_date: addDays(start, lastOffset), contract_value: Number(body?.value ?? pkg.value) || 0,
      billing: pkg.billing, description: `Started from the service catalog: ${pkg.label}. Playbooks: ${used.map((t) => t.name).join(", ")}.`,
      service_key: body.package, order_ref: orderRef, sop_id: used[0]?.id || null, portal_visible: true, progress: 0,
    });

    const minutesOf = (i: any) => Number(i.estimated_minutes) > 0 ? Number(i.estimated_minutes) : (Number(i.estimated_days) || 0) * 480;
    const docs = used.flatMap((t) => (t.items || []).map((i: any) => ({
      title: i.title, category: i.category || "ops", priority: Number(i.priority) || 3,
      estimated_minutes: minutesOf(i), estimated_hours: Math.round((minutesOf(i) / 60) * 100) / 100,
      estimated_days: Math.round((minutesOf(i) / 480) * 100) / 100, status: "next", source: "sop",
      sop_name: t.name, sop_step: i.title, project_type: pkg.type,
      project_id: project.id, project_name: title, client_id: client.id, client_name: client.business,
      due_date: addDays(start, Number(i.offset_days) || 0),
      labels: [t.name], notes: [i.phase, t.sop_code].filter(Boolean).join(" · "), task_type: "billable",
    })));
    for (let k = 0; k < docs.length; k += 100) await db.Task.bulkCreate(docs.slice(k, k + 100));
    for (const t of used) await db.TaskTemplate.update(t.id, { times_applied: (Number(t.times_applied) || 0) + 1 });

    const services = Array.from(new Set([...(client.services_managed || []), ...pkg.services]));
    const patch: Record<string, unknown> = { services_managed: services };
    if (client.status !== "Active") patch.status = "Active";
    if (!client.plan) patch.plan = pkg.label;
    else if (!String(client.plan).includes(pkg.label)) patch.plan = `${client.plan} + ${pkg.label}`;
    await db.CRMClient.update(client.id, patch);

    return Response.json({ ok: true, project_id: project.id, tasks: docs.length, playbooks: used.map((t) => t.name), missing });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
