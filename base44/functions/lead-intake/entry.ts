import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Lead intake → Møthership. Called server to server by the Interstellar website's `booking` function and by the
// Interstellar Booking funnel app (interstellar-booking.com).
// POST with header `x-lead-key: <LEAD_INTAKE_KEY>` and JSON { action: "start" | "business" | "book", client_id?, ...answers }.
//   start    → finds the client by email (or creates one with status "Lead", pipeline_stage "new"); returns client_id
//   business → saves industry / revenue / team size / interest / timeline / biggest problem on the client + as a note
//   subscribe → newsletter signup (website footer): upserts an EmailSubscriber (status subscribed), never a lead
//   book     → adds the booked call (date, time, Meet link) as a note, sets booked_call_at, moves a lead to
//              pipeline_stage "call_booked", and creates a P1 sales task on the call date
// Optional on every action: source ("website" | "funnel" | "referral" | "cold" | "ads" | "social" | "other"; default
// "website"), funnel (funnel name), referred_by, utm_source / utm_medium / utm_campaign / utm_content / utm_term, referrer, lang.
// Existing Active clients are never downgraded to "Lead" and their pipeline stage is never touched.

const clip = (v: unknown, n = 2000) => (v == null ? "" : String(v).trim().slice(0, n));
const today = () => new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/Los_Angeles" });
const domainOf = (w: string) => w.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split(/[/?#]/)[0].toLowerCase();
const SOURCES = ["website", "funnel", "referral", "cold", "ads", "social", "other"];
const SOURCE_LABEL: Record<string, string> = { website: "website booking form", funnel: "booking funnel", referral: "referral", cold: "cold approach", ads: "ads", social: "social", other: "other source" };
const LATER_STAGES = ["call_held", "proposal_sent", "won"];

// "2026-11-04" + "10:30 AM" (Pacific) → ISO instant. Falls back to the bare date when the time can't be read.
function bookedIso(date: string, time: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "";
  const m = String(time || "").trim().match(/^(\d{1,2})(?::(\d{2}))?\s*([ap]\.?m\.?)?/i);
  if (!m) return date;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  const ap = (m[3] || "").toLowerCase().replace(/\./g, "");
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h > 23 || min > 59) return date;
  const [y, mo, d] = date.split("-").map(Number);
  const guess = Date.UTC(y, mo - 1, d, h, min);
  // Offset of America/Los_Angeles at that moment.
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    .formatToParts(new Date(guess)).map((p) => [p.type, p.value]));
  const asLa = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour) % 24, Number(parts.minute));
  return new Date(guess + (guess - asLa)).toISOString();
}

Deno.serve(async (req) => {
  try {
    if (req.method !== "POST") return Response.json({ error: "POST only" }, { status: 405 });
    const key = Deno.env.get("LEAD_INTAKE_KEY");
    if (!key || req.headers.get("x-lead-key") !== key) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const b = await req.json().catch(() => ({}));
    const action = clip(b.action, 20);
    const email = clip(b.email, 200).toLowerCase();
    if (!email || !/\S+@\S+\.\S+/.test(email)) return Response.json({ error: "Valid email required" }, { status: 400 });

    // Newsletter signups (website footer "Stay informed") are email subscribers, not leads: they go to
    // EmailSubscriber (Email Studio > Subscribers). action "subscribe" is the current call; the older website
    // build sent action "start" with full_name "Newsletter subscriber" / utm_source "footer-newsletter".
    const isNewsletter = action === "subscribe" || clip(b.source, 20).toLowerCase() === "newsletter" ||
      (action === "start" && (clip(b.full_name, 120) === "Newsletter subscriber" || clip(b.utm_source, 120) === "footer-newsletter"));
    if (isNewsletter) {
      const db = createClientFromRequest(req).asServiceRole.entities;
      const rows = (await db.EmailSubscriber.filter({ email }, "-created_date", 5).catch(() => [])) || [];
      const name = clip(b.full_name, 120) === "Newsletter subscriber" ? "" : clip(b.full_name || b.name, 120);
      if (rows.length) {
        // Signing up again is a fresh opt-in.
        const r = rows[0];
        await db.EmailSubscriber.update(r.id, { status: "subscribed", ...(name && !r.name ? { name } : {}), tags: [...new Set([...(r.tags || []), "newsletter"])] });
        return Response.json({ ok: true, subscriber_id: r.id, existing: true });
      }
      const row = await db.EmailSubscriber.create({
        email, name, status: "subscribed", source: clip(b.signup_source, 40) || "website_footer", created_at: new Date().toISOString(),
        tags: ["newsletter"], lang: clip(b.lang, 8), referrer: clip(b.referrer, 300),
      });
      return Response.json({ ok: true, subscriber_id: row.id });
    }

    const rawSource = clip(b.source, 20).toLowerCase();
    const source = SOURCES.includes(rawSource) ? rawSource : "website";
    const funnel = clip(b.funnel, 120);
    const referredBy = clip(b.referred_by, 120);
    const sourceText = source === "funnel" ? `the ${funnel ? `"${funnel}" ` : ""}booking funnel (interstellar-booking.com)` : `the ${SOURCE_LABEL[source]}`;

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
    const utm: Record<string, string> = {};
    ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"].forEach((k) => { if (b[k]) utm[k] = clip(b[k], 120); });
    const nowIso = new Date().toISOString();

    if (!client) {
      client = await db.CRMClient.create({
        business, contact: name, status: "Lead",
        emails: [email], phones: phone ? [phone] : [], websites: website ? [website] : [],
        domain: website ? domainOf(website) : "", industry: clip(b.business_type, 80),
        pipeline_stage: "new", stage_changed_at: nowIso, lead_source: source,
        ...(funnel ? { lead_funnel: funnel } : {}),
        ...(referredBy ? { lead_referrer: referredBy } : {}),
        ...(Object.keys(utm).length || b.referrer || b.lang ? { lead_details: { ...utm, ...(b.referrer ? { referrer: clip(b.referrer, 200) } : {}), ...(b.lang ? { lang: clip(b.lang, 5) } : {}) } } : {}),
        notes: [{ id: Date.now(), text: `New lead from ${sourceText}${b.lang === "es" ? " (Spanish)" : ""}.${referredBy ? ` Referred by ${referredBy}.` : ""}${utm.utm_source ? ` UTM: ${utm.utm_source}/${utm.utm_medium || ""}/${utm.utm_campaign || ""}.` : ""}${b.referrer ? ` Came from ${clip(b.referrer, 200)}.` : ""}`, date: today() }],
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
      if (client.status === "Lead" && !client.lead_source) patch.lead_source = source;
      if (client.status === "Lead" && !client.lead_funnel && funnel) patch.lead_funnel = funnel;
      if (!client.lead_referrer && referredBy) patch.lead_referrer = referredBy;
      if (Object.keys(utm).length && !Object.keys(client.lead_details || {}).some((k) => k.startsWith("utm_"))) patch.lead_details = { ...(client.lead_details || {}), ...utm };
      if (Object.keys(patch).length) client = { ...client, ...(await db.CRMClient.update(client.id, patch)), ...patch };
    }

    const addNote = async (text: string, extra: Record<string, unknown> = {}) => {
      const fresh = await db.CRMClient.get(client.id).catch(() => client);
      await db.CRMClient.update(client.id, { notes: [...(fresh?.notes || []), { id: Date.now(), text, date: today() }], ...extra });
      return fresh;
    };

    const sourceLine = `Source: ${source}${funnel ? ` · funnel "${funnel}"` : ""}${referredBy ? ` · referred by ${referredBy}` : ""}`;

    if (action === "business") {
      const details: Record<string, string> = {};
      if (b.business_type) details.business_type = clip(b.business_type, 80);
      if (b.annual_revenue) details.annual_revenue = clip(b.annual_revenue, 40);
      if (b.team_size) details.team_size = clip(b.team_size, 40);
      if (b.timeline) details.timeline = clip(b.timeline, 60);
      if (b.biggest_problem) details.biggest_problem = clip(b.biggest_problem, 1500);
      const extra: Record<string, unknown> = { lead_details: { ...(client.lead_details || {}), ...details } };
      if (b.service_interested && !client.lead_interest) extra.lead_interest = clip(b.service_interested, 80);
      await addNote([
        `Booking form — about the business (${sourceLine}):`,
        b.business_type && `Industry: ${clip(b.business_type, 80)}`,
        b.annual_revenue && `Annual revenue: ${clip(b.annual_revenue, 40)}`,
        b.team_size && `Team size: ${clip(b.team_size, 40)}`,
        b.service_interested && `Most interested in: ${clip(b.service_interested, 80)}`,
        b.timeline && `Wants it done: ${clip(b.timeline, 60)}`,
        b.biggest_problem && `Biggest problem: ${clip(b.biggest_problem, 1500)}`,
      ].filter(Boolean).join("\n"), extra);
    }

    if (action === "book") {
      const date = clip(b.appointment_date, 10);
      const time = clip(b.appointment_time, 20);
      const meet = clip(b.meet_link, 300);
      const confirmed = b.confirmed === true;
      const extra: Record<string, unknown> = {};
      const iso = bookedIso(date, time);
      if (iso) extra.booked_call_at = iso;
      // Leads move to "call booked" unless they are already further along. Active / Inactive clients keep their stage.
      if (client.status === "Lead" && !LATER_STAGES.includes(client.pipeline_stage)) {
        extra.pipeline_stage = "call_booked";
        extra.stage_changed_at = nowIso;
        if (!client.next_step) { extra.next_step = "Strategy call"; if (/^\d{4}-\d{2}-\d{2}$/.test(date)) extra.next_step_at = date; }
      }
      await addNote([
        `Strategy call booked: ${date} at ${time}${confirmed ? "" : " (requested — calendar invite not sent yet, confirm by hand)"}`,
        sourceLine,
        meet && `Google Meet: ${meet}`,
      ].filter(Boolean).join("\n"), extra);
      await db.Task.create({
        title: `Strategy call — ${business} (${time})`,
        category: "sales", priority: 1, status: "next", source: "automation", task_type: "internal",
        due_date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined,
        client_id: client.id, client_name: client.business || business, estimated_minutes: 60, estimated_hours: 1, estimated_days: 0.13,
        labels: ["Booking", source === "funnel" ? "Funnel" : source === "website" ? "Website" : source[0].toUpperCase() + source.slice(1)],
        notes: [
          `${name} · ${email}${phone ? " · " + phone : ""}`, website && `Site: ${website}`, sourceLine,
          b.business_type && `Industry: ${clip(b.business_type, 80)}`, b.annual_revenue && `Revenue: ${clip(b.annual_revenue, 40)}`,
          b.team_size && `Team size: ${clip(b.team_size, 40)}`,
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
