import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Website → Møthership lead intake. Called only by the website's `booking` function (server to server).
// POST with header `x-lead-key: <LEAD_INTAKE_KEY>` and JSON { action: "start" | "business" | "book", client_id?, ...answers }.
//   start    → finds the client by email (or creates one with status "Lead"); returns client_id
//   business → saves industry / revenue / interest / timeline / biggest problem as a note on that client
//   book     → adds the booked call (date, time, Meet link) as a note and a P1 sales task on the call date
// Existing Active clients are never downgraded to "Lead"; their notes and task are added the same way.

const clip = (v: unknown, n = 2000) => (v == null ? "" : String(v).trim().slice(0, n));
const today = () => new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });
const domainOf = (w: string) => w.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0].toLowerCase();

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return Response.json({ error: "POST only" }, { status: 405 });
    const key = Deno.env.get("LEAD_INTAKE_KEY");
    if (!key || req.headers.get("x-lead-key") !== key) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const b = await req.json().catch(() => ({}));
    const action = clip(b.action, 20);
    const email = clip(b.email, 200).toLowerCase();
    if (!email || !/\S+@\S+\.\S+/.test(email)) return Response.json({ error: "Valid email required" }, { status: 400 });

    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;

    // Find the client: the id we handed back on step 1, else anyone already on file with this email.
    let client: any = null;
    const givenId = clip(b.client_id, 64);
    if (givenId) client = await db.CRMClient.get(givenId).catch(() => null);
    if (!client) {
      const all = await db.CRMClient.list("-created_date", 1000);
      client = all.find((c: any) => (c.emails || []).some((e: string) => String(e).toLowerCase() === email)) || null;
    }

    const name = clip(b.full_name, 120);
    const business = clip(b.business_name, 160) || name || email;
    const phone = clip(b.phone, 40);
    const website = clip(b.website, 300);

    if (!client) {
      client = await db.CRMClient.create({
        business, contact: name, status: "Lead",
        emails: [email], phones: phone ? [phone] : [], websites: website ? [website] : [],
        domain: website ? domainOf(website) : "", industry: clip(b.business_type, 80),
        notes: [{ id: Date.now(), text: `New lead from the website booking form${b.lang === "es" ? " (Spanish)" : ""}.${b.utm_source ? ` Source: ${b.utm_source}/${b.utm_medium || ""}/${b.utm_campaign || ""}.` : ""}${b.referrer ? ` Came from ${clip(b.referrer, 200)}.` : ""}`, date: today() }],
        services: [], services_managed: [], documents: [], completedTasks: [], blogSchedule: [],
      });
    } else {
      // Fill gaps only; never overwrite what is already on file.
      const patch: Record<string, unknown> = {};
      if (!client.contact && name) patch.contact = name;
      if (phone && !(client.phones || []).includes(phone)) patch.phones = [...(client.phones || []), phone];
      if (website && !(client.websites || []).includes(website)) patch.websites = [...(client.websites || []), website];
      if (!client.domain && website) patch.domain = domainOf(website);
      if (!client.industry && b.business_type) patch.industry = clip(b.business_type, 80);
      if (Object.keys(patch).length) client = { ...client, ...(await db.CRMClient.update(client.id, patch)) , ...patch };
    }

    const addNote = async (text: string) => {
      const fresh = await db.CRMClient.get(client.id).catch(() => client);
      await db.CRMClient.update(client.id, { notes: [...(fresh?.notes || []), { id: Date.now(), text, date: today() }] });
    };

    if (action === "business") {
      await addNote([
        "Booking form — about the business:",
        b.business_type && `Industry: ${clip(b.business_type, 80)}`,
        b.annual_revenue && `Annual revenue: ${clip(b.annual_revenue, 40)}`,
        b.service_interested && `Most interested in: ${clip(b.service_interested, 80)}`,
        b.timeline && `Wants it done: ${clip(b.timeline, 60)}`,
        b.biggest_problem && `Biggest problem: ${clip(b.biggest_problem, 1500)}`,
      ].filter(Boolean).join("\n"));
    }

    if (action === "book") {
      const date = clip(b.appointment_date, 10);
      const time = clip(b.appointment_time, 20);
      const meet = clip(b.meet_link, 300);
      const confirmed = b.confirmed === true;
      await addNote([
        `Strategy call booked: ${date} at ${time}${confirmed ? "" : " (requested — calendar invite not sent yet, confirm by hand)"}`,
        meet && `Google Meet: ${meet}`,
      ].filter(Boolean).join("\n"));
      await db.Task.create({
        title: `Strategy call — ${business} (${time})`,
        category: "sales", priority: 1, status: "next", source: "automation", task_type: "internal",
        due_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
        client_id: client.id, client_name: client.business || business, estimated_minutes: 60, estimated_hours: 1, estimated_days: 0.13,
        labels: ["Booking"],
        notes: [
          `${name} · ${email}${phone ? " · " + phone : ""}`, website && `Site: ${website}`,
          b.business_type && `Industry: ${clip(b.business_type, 80)}`, b.annual_revenue && `Revenue: ${clip(b.annual_revenue, 40)}`,
          b.service_interested && `Interested in: ${clip(b.service_interested, 80)}`, b.timeline && `Timeline: ${clip(b.timeline, 60)}`,
          b.biggest_problem && `Biggest problem: ${clip(b.biggest_problem, 1500)}`, meet && `Meet: ${meet}`,
          !confirmed && "Calendar invite was NOT sent automatically — confirm the time and send the invite.",
        ].filter(Boolean).join("\n"),
      });
    }

    return Response.json({ ok: true, client_id: client.id, status: client.status });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
