// Persistence + side effects for the flight plan walkthrough.
// One OnboardingFlight per client + package. Answers are written once and pushed to the records that
// already feed the rest of Møthership (CRMClient fields, the latest IntakeAudit that every Claude brief reads).
import { base44 } from "@/api/base44Client";
import { itemsOf } from "@/features/tasks/lib/clients";
import { FIELDS, SALES_FOR_PACKAGE, saleByKey, defaultPrice, needsCare, fieldByKey, intakeFormFields, answersFromRequest } from "./catalog";

const safe = (p) => Promise.resolve(p).then(itemsOf).catch(() => []);
const today = () => new Date().toLocaleDateString("en-CA");
const plusDays = (iso, n) => {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  return d.toLocaleDateString("en-CA");
};

export async function loadContext(clientId, packageKey) {
  const [flights, dossiers, intakes, client] = await Promise.all([
    safe(base44.entities.OnboardingFlight.filter({ client_id: clientId, package_key: packageKey }, "-created_date", 5)),
    safe(base44.entities.ClientDossier.filter({ client_id: clientId }, "-updated_date", 1)),
    safe(base44.entities.IntakeAudit.filter({ client_id: clientId }, "-created_date", 1)),
    base44.entities.CRMClient.get(clientId).catch(() => null)
  ]);
  const flight = flights.find((f) => f.status !== "archived") || null;
  const responses = flight && flight.intake_form_id ? await safe(base44.entities.ClientRequest.filter({ form_id: flight.intake_form_id }, "-created_date", 10)) : [];
  return { flight, dossier: dossiers[0] || null, intake: intakes[0] || null, client, responses };
}

export async function createFlight(client, pkg) {
  const saleKey = (SALES_FOR_PACKAGE[pkg.key] || [])[0] || "";
  const sale = saleByKey(saleKey);
  const start = today();
  const draft = {
    client_id: client.id,
    client_name: client.business,
    package_key: pkg.key,
    sale_package: saleKey,
    include_onboarding: Boolean(sale && sale.onboarding),
    price: defaultPrice(saleKey),
    start_date: start,
    answers: {},
    sources: {},
    skipped: {},
    launch_checks: {},
    current_step: "client",
    status: "collecting"
  };
  if (needsCare(draft, client)) {
    draft.care_plan = "orbit_local";
    draft.care_value = defaultPrice("orbit_local");
    draft.care_start_date = plusDays(start, (sale && sale.careDelay) || 30);
  }
  return base44.entities.OnboardingFlight.create(draft);
}

export const patchFlight = (flight, patch) => base44.entities.OnboardingFlight.update(flight.id, patch);

// CRM fields that a flight answer can safely fill. Arrays are merged, never replaced.
async function writeBackCrm(client, field, value) {
  if (!field.crm || !client || value === undefined || value === null || value === "") return;
  const patch = {};
  if (field.crm === "emails" || field.crm === "phones") {
    const list = Array.isArray(client[field.crm]) ? client[field.crm] : [];
    const v = String(value).trim();
    if (v && !list.includes(v)) patch[field.crm] = [v, ...list];
  } else if (field.crm === "portal_emails") {
    const list = String(value).split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter((e) => /@/.test(e));
    const merged = [...new Set([...(client.portal_emails || []), ...list])];
    if (merged.length !== (client.portal_emails || []).length) patch.portal_emails = merged;
  } else if (field.crm === "location") {
    if (!client.location) patch.location = String(value).split(/[\n,]/)[0].trim();
  } else if (field.crm === "logo_url") {
    const url = Array.isArray(value) ? value[0] : value;
    if (url && /^https?:/.test(String(url)) && client.logo_url !== url) patch.logo_url = url;
  } else if (client[field.crm] !== value) {
    patch[field.crm] = value;
  }
  if (Object.keys(patch).length) await base44.entities.CRMClient.update(client.id, patch).catch(() => null);
}

// Mirror answers into the latest IntakeAudit so the audit, build, brand-kit and deck briefs all read them.
export async function syncIntakeAudit(client, answers) {
  const mapped = {};
  FIELDS.forEach((f) => {
    const v = answers[f.key];
    if (f.intake && v !== undefined && v !== null && v !== "") mapped[f.intake] = Array.isArray(v) ? v.join(", ") : v;
  });
  if (!Object.keys(mapped).length) return;
  const [latest] = await safe(base44.entities.IntakeAudit.filter({ client_id: client.id }, "-created_date", 1));
  if (!latest) {
    await base44.entities.IntakeAudit.create({ client_id: client.id, business_name: client.business, status: "in_progress", answers: mapped }).catch(() => null);
    return;
  }
  const cur = latest.answers || {};
  const next = { ...cur };
  let changed = false;
  Object.entries(mapped).forEach(([k, v]) => {
    if (next[k] !== v) {
      next[k] = v;
      changed = true;
    }
  });
  if (changed) await base44.entities.IntakeAudit.update(latest.id, { answers: next }).catch(() => null);
}

export async function saveAnswers(flight, client, values, source = "justin") {
  const answers = { ...(flight.answers || {}), ...values };
  const sources = { ...(flight.sources || {}) };
  const skipped = { ...(flight.skipped || {}) };
  Object.keys(values).forEach((k) => {
    sources[k] = source;
    if (values[k] !== "" && values[k] !== undefined) delete skipped[k];
  });
  const updated = await patchFlight(flight, { answers, sources, skipped });
  await Promise.all(Object.entries(values).map(([k, v]) => {
    const f = fieldByKey(k);
    return f ? writeBackCrm(client, f, v) : null;
  }));
  syncIntakeAudit(client, values).catch(() => null);
  return updated;
}

export async function sendIntake(flight, client, ev) {
  const me = await base44.auth.me().catch(() => null);
  const fields = intakeFormFields(ev.askable, me && me.email);
  if (!fields.length) throw new Error("Nothing left to ask the client.");
  const sale = saleByKey(flight.sale_package);
  const body = {
    client_id: client.id,
    client_name: client.business,
    kind: "other",
    title: "Onboarding checklist" + (sale ? " · " + sale.label : ""),
    intro: "Everything we need to start, in one place. Answer what you can and skip what you don't know. Never send passwords: for access we only need the invite.",
    industry: client.industry || "",
    fields,
    active: true,
    claude_instructions: "Onboarding intake for the flight plan. Do not publish anything from it; Justin applies the answers in Møthership."
  };
  let formId = flight.intake_form_id;
  if (formId) {
    const ok = await base44.entities.RequestForm.update(formId, body).then(() => true).catch(() => false);
    if (!ok) formId = null;
  }
  if (!formId) {
    const created = await base44.entities.RequestForm.create({ ...body, form_key: Math.random().toString(36).slice(2) + Date.now().toString(36), submissions: 0 });
    formId = created.id;
  }
  return patchFlight(flight, { intake_form_id: formId, intake_sent_at: new Date().toISOString(), intake_fields: fields.map((f) => f.id) });
}

export async function applyIntake(flight, client, request) {
  const values = answersFromRequest(request, flight.intake_fields);
  const updated = Object.keys(values).length ? await saveAnswers(flight, client, values, "client_intake") : flight;
  return patchFlight(updated, { intake_applied: [...new Set([...(flight.intake_applied || []), request.id])] });
}

export async function kickoff(flight, client, ev) {
  const sale = saleByKey(flight.sale_package);
  if (!sale) throw new Error("Pick the package first.");
  const care = needsCare(flight, client) && flight.care_plan ? { package: flight.care_plan, value: Number(flight.care_value) || undefined, start_date: flight.care_start_date || undefined } : null;
  const res = await base44.functions.invoke("start-service", {
    client_id: client.id,
    package: sale.key,
    start_date: flight.start_date || today(),
    include_onboarding: Boolean(flight.include_onboarding),
    value: Number(flight.price) || undefined,
    order_ref: "flight-" + flight.id,
    ...(care ? { care_plan: care } : {})
  });
  const d = (res && res.data) || res || {};
  if (d.error) throw new Error(d.error);
  const projectIds = [d.project_id, d.care && d.care.project_id].filter(Boolean);

  // Anything skipped with a flag becomes ONE follow-up task on the project, so it is never lost.
  let followup = flight.followup_task_id || "";
  const flagged = ev.steps.flatMap((s) => s.flagged.map((i) => i.label + (i.skipped && i.skipped.reason ? " (" + i.skipped.reason + ")" : "")));
  if (flagged.length && !followup && d.project_id) {
    const t = await base44.entities.Task.create({
      title: "Collect flagged onboarding info: " + flagged.length + " item(s)",
      notes: "Skipped with a flag in the flight plan:\n- " + flagged.join("\n- "),
      category: "ops",
      status: "next",
      priority: 2,
      source: "manual",
      task_type: "billable",
      client_id: client.id,
      client_name: client.business,
      project_id: d.project_id,
      due_date: plusDays(flight.start_date || today(), 3),
      labels: ["Flight plan"]
    }).catch(() => null);
    followup = (t && t.id) || "";
  }
  return {
    result: d,
    flight: await patchFlight(flight, { project_ids: [...new Set([...(flight.project_ids || []), ...projectIds])], kicked_off_at: new Date().toISOString(), status: "kicked_off", followup_task_id: followup, current_step: "launch" })
  };
}

export async function uploadFiles(files) {
  const urls = [];
  for (const file of files) {
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    if (file_url) urls.push(file_url);
  }
  return urls;
}
