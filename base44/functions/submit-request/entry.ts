import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Public request intake. Client websites / apps POST here so every request funnels into Møthership.
//   GET  /functions/submit-request?form=<RequestForm id>&key=<form_key>      → form definition (fields) for rendering
//   POST /functions/submit-request { form_id, key, values, contact_name?, contact_email?, source? } → creates the ClientRequest
// The key is per form and only lets a site submit to that one form.
const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const json = (b: unknown, s = 200) => Response.json(b, { status: s, headers: CORS });
// Request types live in REQUEST_TYPES (src/features/requests/formSchema.js); any slug kind is accepted.
const reqKind = (k: unknown) => (/^[a-z][a-z0-9_]{1,39}$/.test(String(k || "")) ? String(k) : "other");

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const url = new URL(req.url);
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const formId = String(body.form_id || url.searchParams.get("form") || "");
    const key = String(body.key || url.searchParams.get("key") || "");
    if (!formId || !key) return json({ error: "form and key required" }, 400);
    const form = await db.RequestForm.get(formId).catch(() => null);
    if (!form || form.active === false || !form.form_key || form.form_key !== key) return json({ error: "Unknown form" }, 404);

    if (req.method === "GET") {
      return json({ form: { id: form.id, title: form.title, intro: form.intro, kind: form.kind, client_name: form.client_name, fields: form.fields || [] } });
    }

    const vals = (typeof body.values === "object" && body.values) ? body.values : {};
    const fields: any[] = form.fields || [];
    const missing = fields.filter((f) => f.required && (vals[f.id] == null || vals[f.id] === "" || vals[f.id] === false || (Array.isArray(vals[f.id]) && !vals[f.id].length))).map((f) => f.label);
    if (missing.length) return json({ error: "Missing: " + missing.join(", ") }, 400);

    const answers = fields.map((f) => ({ id: f.id, label: f.label, type: f.type, value: vals[f.id] ?? null }));
    const firstText = fields.find((f) => f.type === "short_text" && vals[f.id]);
    const title = (firstText ? `${form.title}: ${String(vals[firstText.id]).slice(0, 120)}` : `${form.title} from ${form.client_name}`).slice(0, 200);
    const details = fields.filter((f) => !["photos", "files"].includes(f.type) && vals[f.id] != null && vals[f.id] !== "" && vals[f.id] !== false)
      .map((f) => `${f.label}: ${Array.isArray(vals[f.id]) ? vals[f.id].join(", ") : vals[f.id] === true ? "Yes" : vals[f.id]}`).join("\n").slice(0, 8000);
    const attachments = fields.filter((f) => ["photos", "files"].includes(f.type)).flatMap((f) => (Array.isArray(vals[f.id]) ? vals[f.id] : [])).filter((u) => /^https?:\/\//.test(String(u))).slice(0, 40).map(String);
    const kind = reqKind(form.kind);
    const pr = String(vals.priority || "").toLowerCase();
    const priority = vals.urgent === true ? "urgent" : ["low", "high", "urgent"].includes(pr) ? pr : "normal";
    const due = String(vals.due_date || "");
    const client = await db.CRMClient.get(form.client_id).catch(() => null);

    const r = await db.ClientRequest.create({
      client_id: form.client_id, client_name: client?.business || form.client_name, kind, title, details, attachments,
      fields: vals, answers, form_id: form.id, form_title: form.title,
      status: "received", priority, ...(/^\d{4}-\d{2}-\d{2}$/.test(due) ? { due_date: due } : {}),
      submitted_by: String(body.contact_email || "").slice(0, 200) || "client site",
      contact_name: String(body.contact_name || "").slice(0, 120), contact_email: String(body.contact_email || "").slice(0, 200),
      source: ["public_form", "client_app"].includes(body.source) ? body.source : "public_form",
      page_status: ["project_submission", "job"].includes(kind) ? "queued" : "none",
    });
    await db.RequestForm.update(form.id, { submissions: (Number(form.submissions) || 0) + 1 });
    return json({ ok: true, request_id: r.id });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
