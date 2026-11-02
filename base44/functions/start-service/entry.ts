import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Start a purchased service for a client: one Project + every task from the matching SOP playbooks
// (TaskTemplate.service_key), dated from the start date. Safe to call twice: the same order_ref
// never creates a second list.
//
// Care plans: every hosted build (Mission ALPHA, Mission BRAVO, Custom Website, Command System) must
// run on a care plan — HyperCare+ (a tier) or GravïtyCare. The caller passes `care_plan` and it is
// started in the same call as its own project + billing line, so it is never forgotten.
// HyperCare+ includes the GravïtyCare work (its setup SOP carries those steps), so a client is only
// ever on one of the two, and only a standalone GravïtyCare purchase puts them on the GravïtyCare page.

type Pkg = { label: string; type: string; value: number; billing: string; streams: string[]; onboarding: boolean; services: string[]; needsCare?: boolean };
export const PACKAGES: Record<string, Pkg> = {
  mission_alpha:  { label: "Mission ALPHA", type: "website", value: 8997, billing: "one_time", onboarding: true, needsCare: true,
                    streams: ["intel_briefing", "website", "system", "ops_command", "brand_arsenal", "launch_grid", "transmission"],
                    services: ["website", "system", "brand"] },
  mission_bravo:  { label: "Mission BRAVO", type: "website", value: 6497, billing: "one_time", onboarding: true, needsCare: true,
                    streams: ["intel_briefing", "website", "system"], services: ["website", "system"] },
  // Every build includes the Intel Briefing: the audit first, the final sweep at the end. It is never sold as an add-on.
  custom_website: { label: "Custom Website", type: "website", value: 4997, billing: "one_time", onboarding: true, needsCare: true, streams: ["intel_briefing", "website"], services: ["website"] },
  command_system: { label: "Command System", type: "app", value: 5997, billing: "one_time", onboarding: true, needsCare: true, streams: ["intel_briefing", "system"], services: ["system"] },
  ops_command:    { label: "Ops Command", type: "automation", value: 3000, billing: "one_time", onboarding: false, streams: ["ops_command"], services: ["system"] },
  brand_arsenal:  { label: "Brand Arsenal", type: "branding", value: 2500, billing: "one_time", onboarding: false, streams: ["brand_arsenal"], services: ["brand"] },
  launch_grid:    { label: "Launch Grid", type: "seo", value: 1400, billing: "one_time", onboarding: false, streams: ["launch_grid"], services: [] },
  intel_briefing: { label: "Intel Briefing", type: "consulting", value: 1500, billing: "one_time", onboarding: false, streams: ["intel_briefing"], services: [] },
  transmission:   { label: "Transmission Video", type: "marketing", value: 1500, billing: "one_time", onboarding: false, streams: ["transmission"], services: [] },
  orbit_local:    { label: "HyperCare+ Local", type: "seo", value: 750, billing: "retainer", onboarding: false, streams: ["orbit_setup", "orbit_local"], services: ["orbit_seo"] },
  orbit_multi:    { label: "HyperCare+ Multi-Location", type: "seo", value: 350, billing: "retainer", onboarding: false, streams: ["orbit_multi"], services: ["orbit_seo"] },
  orbit_national: { label: "HyperCare+ National", type: "seo", value: 1750, billing: "retainer", onboarding: false, streams: ["orbit_setup", "orbit_national"], services: ["orbit_seo"] },
  orbit_global:   { label: "HyperCare+ Global", type: "seo", value: 3000, billing: "retainer", onboarding: false, streams: ["orbit_setup", "orbit_national", "orbit_global"], services: ["orbit_seo"] },
  starship_care:  { label: "GravïtyCare", type: "other", value: 197, billing: "retainer", onboarding: false, streams: ["starship"], services: ["starship_care"] },
};
const CARE_PLANS = ["orbit_local", "orbit_national", "orbit_global", "starship_care"];

const addDays = (iso: string, n: number) => {
  const d = new Date(iso + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function startOne(db: any, client: any, key: string, opts: { start: string; withOnboarding: boolean; value?: number; orderRef: string }) {
  const pkg = PACKAGES[key];
  const [existing] = await db.Project.filter({ order_ref: opts.orderRef });
  if (existing) return { duplicate: true, project_id: existing.id, tasks: 0, playbooks: [], missing: [] };

  const streams = [...(opts.withOnboarding ? ["onboarding"] : []), ...pkg.streams];
  const templates = await db.TaskTemplate.list("sort_order", 200);
  const byKey = new Map<string, any>();
  for (const t of templates) if (t.service_key && !byKey.has(t.service_key)) byKey.set(t.service_key, t);
  const missing = streams.filter((s) => !byKey.has(s));
  const used = streams.filter((s) => byKey.has(s)).map((s) => byKey.get(s));
  // The Intel final sweep always lands at the end of THIS build, not at a fixed day 40.
  const isSweep = (t: any, i: any) => t.service_key === "intel_briefing" && /sweep/i.test(String(i.phase || ""));
  const buildEnd = Math.max(0, ...used.filter((t) => t.service_key !== "intel_briefing").flatMap((t) => (t.items || []).map((i: any) => Number(i.offset_days) || 0)));
  const intel = used.find((t) => t.service_key === "intel_briefing");
  const sweepMax = Math.max(0, ...((intel?.items || []).filter((i: any) => isSweep(intel, i)).map((i: any) => Number(i.offset_days) || 0)));
  const offsetOf = (t: any, i: any) => {
    const o = Number(i.offset_days) || 0;
    if (!isSweep(t, i) || buildEnd >= sweepMax) return o;
    return Math.max(0, buildEnd - (sweepMax - o));
  };
  const lastOffset = Math.max(0, ...used.flatMap((t) => (t.items || []).map((i: any) => offsetOf(t, i) + (Number(i.estimated_days) || 0))));
  const title = `${client.business} · ${pkg.label}`;
  const monthly = Number(opts.value ?? pkg.value) || 0;

  const project = await db.Project.create({
    title, client_id: client.id, client_name: client.business, type: pkg.type, status: "planning", priority: 2,
    start_date: opts.start, due_date: addDays(opts.start, Math.ceil(lastOffset)), contract_value: monthly,
    billing: pkg.billing, description: `Started from the service catalog: ${pkg.label}. Playbooks: ${used.map((t) => t.name).join(", ")}.`,
    service_key: key, order_ref: opts.orderRef, sop_id: used[0]?.id || null, portal_visible: true, progress: 0,
  });

  const minutesOf = (i: any) => Number(i.estimated_minutes) > 0 ? Number(i.estimated_minutes) : (Number(i.estimated_days) || 0) * 480;
  const docs = used.flatMap((t) => (t.items || []).map((i: any) => ({
    title: i.title, category: i.category || "ops", priority: Number(i.priority) || 3,
    estimated_minutes: minutesOf(i), estimated_hours: Math.round((minutesOf(i) / 60) * 100) / 100,
    estimated_days: Math.round((minutesOf(i) / 480) * 100) / 100, status: "next", source: "sop",
    sop_name: t.name, sop_step: i.title, project_type: pkg.type,
    project_id: project.id, project_name: title, client_id: client.id, client_name: client.business,
    due_date: addDays(opts.start, offsetOf(t, i)),
    labels: [t.name], notes: [i.phase, t.sop_code, i.notes].filter(Boolean).join(" · "), task_type: "billable",
  })));
  for (let k = 0; k < docs.length; k += 100) await db.Task.bulkCreate(docs.slice(k, k + 100));
  // The project's budget is the sum of its SOP step estimates, so Output can compare it to clocked time.
  const estHours = Math.round((docs.reduce((s: number, d: any) => s + (Number(d.estimated_minutes) || 0), 0) / 60) * 10) / 10;
  if (estHours > 0) await db.Project.update(project.id, { estimated_hours: estHours });
  for (const t of used) await db.TaskTemplate.update(t.id, { times_applied: (Number(t.times_applied) || 0) + 1 });

  // Client record: services managed, billing line for subscriptions, status, plan label.
  const fresh = await db.CRMClient.get(client.id);
  const patch: Record<string, unknown> = { services_managed: Array.from(new Set([...(fresh.services_managed || []), ...pkg.services])) };
  if (pkg.billing === "retainer") {
    const lineName = /hypercare/i.test(pkg.label) ? "HyperCare+" : /grav/i.test(pkg.label) ? "GravïtyCare" : pkg.label;
    const lines: any[] = Array.isArray(fresh.services) ? fresh.services : [];
    patch.services = lines.some((l: any) => String(l.name || "").toLowerCase() === lineName.toLowerCase())
      ? lines.map((l: any) => (String(l.name || "").toLowerCase() === lineName.toLowerCase() ? { ...l, price: monthly } : l))
      : [...lines, { id: Date.now(), name: lineName, price: monthly, starts_on: opts.start }];
  }
  if (fresh.status !== "Active") patch.status = "Active";
  if (!fresh.plan) patch.plan = pkg.label;
  else if (!String(fresh.plan).includes(pkg.label)) patch.plan = `${fresh.plan} + ${pkg.label}`;
  await db.CRMClient.update(client.id, patch);

  return { project_id: project.id, tasks: docs.length, playbooks: used.map((t) => t.name), missing };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== "admin") return Response.json({ error: "Admins only" }, { status: 403 });

    const body = await req.json().catch(() => ({}));
    if (body?.action === "catalog") return Response.json({ packages: PACKAGES, care_plans: CARE_PLANS });

    const key = String(body?.package || "");
    const pkg = PACKAGES[key];
    if (!pkg) return Response.json({ error: "Unknown package" }, { status: 400 });
    if (key === "intel_briefing") {
      return Response.json({ error: "The Intel Briefing is not sold on its own. It comes free with every build (ALPHA, BRAVO, Website, Command System).", code: "intel_included" }, { status: 400 });
    }
    const clientId = String(body?.client_id || "");
    if (!clientId) return Response.json({ error: "Missing client_id" }, { status: 400 });
    const start = /^\d{4}-\d{2}-\d{2}$/.test(body?.start_date || "") ? body.start_date : new Date().toISOString().slice(0, 10);
    const withOnboarding = typeof body?.include_onboarding === "boolean" ? body.include_onboarding : pkg.onboarding;

    // Builds must carry a care plan, unless the client is already on one.
    const db = base44.asServiceRole.entities;
    const client = await db.CRMClient.get(clientId).catch(() => null);
    if (!client) return Response.json({ error: "Client not found" }, { status: 404 });
    const care = body?.care_plan && CARE_PLANS.includes(String(body.care_plan.package)) ? body.care_plan : null;
    const alreadyCovered = (client.services_managed || []).some((s: string) => s === "orbit_seo" || s === "starship_care");
    if (pkg.needsCare && !care && !alreadyCovered && body?.skip_care !== true) {
      return Response.json({ error: "Pick the care plan this build will run on (HyperCare+ or GravïtyCare).", code: "care_plan_required" }, { status: 400 });
    }

    const orderRef = String(body?.order_ref || `manual-${clientId}-${key}-${start}`);
    const main = await startOne(db, client, key, { start, withOnboarding, value: body?.value, orderRef });

    let careResult = null;
    if (care) {
      const careStart = /^\d{4}-\d{2}-\d{2}$/.test(care.start_date || "") ? care.start_date : start;
      careResult = await startOne(db, client, String(care.package), {
        start: careStart, withOnboarding: false, value: care.value, orderRef: `${orderRef}-care-${care.package}`,
      });
    }

    return Response.json({ ok: true, ...main, care: careResult });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
