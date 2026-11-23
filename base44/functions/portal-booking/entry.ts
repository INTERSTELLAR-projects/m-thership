import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
import { requireSecondFactor } from "../../shared/twoFactor.ts";
import { leadBooked } from "../../shared/leadPortal.ts";

// "Schedule a call" for the client portal. Same idea as the website's `booking` function, but for signed-in
// clients: the login decides which client this is (admins may pass client_id to preview), so nobody can book
// as someone else, and name / email / business come from the account rather than the form.
//   slots → open call times for the next two weeks from Justin's Google Calendar (Pacific, weekdays 9–5)
//   book  → re-checks the slot, creates the Calendar event with a Google Meet link and emails the invite to
//           Justin and the client (sendUpdates=all), then logs a ClientRequest (kind "call", shows in the
//           client's request history) and a P1 Task on the call date for Justin.
// Uses the app's Google Calendar connector (calendar.events scope), reading events rather than freeBusy.
// If the calendar can't be read, slots fall back to business hours and the booking is logged as
// "requested" so Justin confirms it by hand. Admin previews can see times but never book.

const TZ = "America/Los_Angeles";
const CALL_MIN = 30;
const DAY_START = 9 * 60;    // first call 9:00 AM PT
const LAST_START = 16 * 60 + 30; // last call starts 4:30 PM PT
const STEP = 30;
const NOTICE_H = 4;
const DAYS_AHEAD = 14;
const OWNER = "justin@interstellar-strategies.com";

const clean = (v: unknown, max = 2000) => String(v ?? "").trim().slice(0, max);

function offsetFor(date: string) {
  const d = new Date(`${date}T12:00:00Z`);
  const part = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(d).find((p) => p.type === "timeZoneName")?.value || "GMT-08:00";
  const m = part.match(/GMT([+-]\d{2}):?(\d{2})?/);
  return m ? `${m[1]}:${m[2] || "00"}` : "-08:00";
}
const label = (min: number) => {
  const h = Math.floor(min / 60), m = min % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
};
const toMin = (t: string) => {
  const m = String(t).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return -1;
  let h = Number(m[1]) % 12;
  if (m[3].toUpperCase() === "PM") h += 12;
  return h * 60 + Number(m[2]);
};
const iso = (date: string, min: number, off: string) =>
  `${date}T${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}:00${off}`;
const pacificToday = () => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
const addDays = (date: string, n: number) => {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const prettyDate = (date: string) => new Date(`${date}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

// Busy ranges from Justin's primary calendar between two dates (inclusive), read from events.
async function busyBetween(token: string, from: string, to: string) {
  const params = new URLSearchParams({
    timeMin: iso(from, 0, offsetFor(from)), timeMax: iso(to, 24 * 60 - 1, offsetFor(to)),
    singleEvents: "true", orderBy: "startTime", maxResults: "2500", timeZone: TZ,
  });
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || "Calendar unavailable");
  const out: number[][] = [];
  for (const ev of (data.items || []) as Record<string, any>[]) {
    if (ev.status === "cancelled" || ev.transparency === "transparent") continue;
    const me = (ev.attendees || []).find((a: Record<string, unknown>) => a.self);
    if (me && me.responseStatus === "declined") continue;
    if (ev.start?.dateTime && ev.end?.dateTime) out.push([Date.parse(ev.start.dateTime), Date.parse(ev.end.dateTime)]);
    else if (ev.start?.date && ev.end?.date) out.push([Date.parse(iso(ev.start.date, 0, offsetFor(ev.start.date))), Date.parse(iso(ev.end.date, 0, offsetFor(ev.end.date)))]);
  }
  return out;
}

function openSlots(date: string, busy: number[][]) {
  const off = offsetFor(date);
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay();
  if (dow === 0 || dow === 6) return [];
  const earliest = Date.now() + NOTICE_H * 3600 * 1000;
  const out: string[] = [];
  for (let m = DAY_START; m <= LAST_START; m += STEP) {
    const s = new Date(iso(date, m, off)).getTime();
    const e = s + CALL_MIN * 60000;
    if (s < earliest) continue;
    if (busy.some(([bs, be]) => s < be && e > bs)) continue;
    out.push(label(m));
  }
  return out;
}

async function calToken(base44: any): Promise<string | null> {
  try {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlecalendar");
    return accessToken || null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return Response.json({ error: "Not signed in" }, { status: 401 });
    const gate = await requireSecondFactor(base44, req, user);
    if (gate) return gate;
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const action = String(body.action || "slots");
    const asClient = clean(body.client_id, 64);
    const db = base44.asServiceRole.entities;

    // Same client resolution as the portal function.
    const preview = user.role === "admin" && !!asClient;
    let client: Record<string, unknown> | null = null;
    if (preview) client = await db.CRMClient.get(asClient).catch(() => null);
    else {
      const email = String(user.email || "").toLowerCase();
      const all = await db.CRMClient.filter({ portal_enabled: true }, "business", 500);
      // Package-deal owners: client_id picks one of THIS login's businesses; an id it isn't on is refused.
      const mine = ((all || []) as Record<string, unknown>[]).filter((c) => ((c.portal_emails as string[]) || []).some((e) => String(e).toLowerCase() === email));
      client = asClient ? mine.find((c) => c.id === asClient) || null : mine[0] || null;
      if (!client && asClient && mine.length) return Response.json({ error: "This login can't open that business.", code: "not_allowed" }, { status: 403 });
    }
    if (!client) return Response.json({ error: "No portal is set up for this login yet.", code: "no_client" }, { status: 403 });
    const cid = client.id as string;
    const business = String(client.business || "your business");

    if (action === "slots") {
      const from = pacificToday();
      const to = addDays(from, DAYS_AHEAD);
      const token = await calToken(base44);
      let busy: number[][] = [];
      let fallback = !token;
      if (token) { try { busy = await busyBetween(token, from, to); } catch (e) { fallback = true; console.error("calendar read failed", (e as Error).message); } }
      // Each slot carries its exact start time so the portal can also show it in the viewer's own time zone.
      const days: { date: string; label: string; slots: { t: string; at: string }[] }[] = [];
      for (let i = 0; i <= DAYS_AHEAD; i++) {
        const date = addDays(from, i);
        const off = offsetFor(date);
        const slots = openSlots(date, busy).map((t) => ({ t, at: new Date(iso(date, toMin(t), off)).toISOString() }));
        if (slots.length) days.push({ date, label: prettyDate(date), slots });
      }
      return Response.json({
        days, fallback, minutes: CALL_MIN, timezone: TZ, preview,
        you: { name: preview ? "" : user.full_name || "", email: preview ? "" : user.email, business },
      });
    }

    if (action === "book") {
      if (preview) return Response.json({ error: "This is an admin preview, so booking is turned off. Clients book from their own login.", code: "preview" }, { status: 403 });
      const date = clean(body.date, 10);
      const min = toMin(clean(body.time, 10));
      const topic = clean(body.topic, 1500);
      const phone = clean(body.phone, 40);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || min < 0) return Response.json({ error: "Pick a day and time." }, { status: 400 });
      if (date > addDays(pacificToday(), DAYS_AHEAD + 1)) return Response.json({ error: "Pick a time in the next two weeks." }, { status: 400 });
      // Guard against double clicks / repeat submits.
      const recent = ((await db.ClientRequest.filter({ client_id: cid, kind: "call" }, "-created_date", 5).catch(() => [])) || []) as Record<string, unknown>[];
      if (recent.some((r) => Date.now() - Date.parse(String(r.created_date || 0)) < 60 * 1000)) {
        return Response.json({ error: "You just booked a call. Check your email for the invite." }, { status: 429 });
      }

      const token = await calToken(base44);
      let busy: number[][] = [];
      if (token) { try { busy = await busyBetween(token, date, date); } catch (e) { console.error("calendar read failed", (e as Error).message); } }
      if (!openSlots(date, busy).includes(label(min))) {
        return Response.json({ error: "That time was just taken. Please pick another.", code: "slot_taken" }, { status: 409 });
      }

      const off = offsetFor(date);
      const start = new Date(iso(date, min, off));
      const end = new Date(start.getTime() + CALL_MIN * 60000);
      const name = String(user.full_name || "").trim() || String(client.contact || "").trim() || user.email;
      const when = `${prettyDate(date)} at ${label(min)} PT`;
      const desc = [
        `Client: ${business}`, `Booked by: ${name} (${user.email})`, phone && `Phone: ${phone}`,
        topic && `\nWhat they want to cover:\n${topic}`,
        `\nBooked from the Møthership client portal.`,
      ].filter(Boolean).join("\n");

      let meetLink: string | null = null;
      let eventId: string | null = null;
      if (token) {
        try {
          const res = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all", {
            method: "POST",
            headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              summary: `Interstellar × ${business} | ${client.portal_tier === "lead" ? "30-minute walkthrough" : "Client call"}`,
              description: desc,
              start: { dateTime: start.toISOString(), timeZone: TZ },
              end: { dateTime: end.toISOString(), timeZone: TZ },
              attendees: [{ email: OWNER }, { email: user.email }],
              conferenceData: { createRequest: { requestId: `portal-${cid}-${Date.now()}`, conferenceSolutionKey: { type: "hangoutsMeet" } } },
            }),
          });
          const ev = await res.json();
          if (res.ok) {
            eventId = ev.id;
            meetLink = ev.conferenceData?.entryPoints?.find((e: { entryPointType: string }) => e.entryPointType === "video")?.uri || ev.hangoutLink || null;
          } else console.error("event create failed", ev?.error?.message);
        } catch (e) { console.error("event create failed", (e as Error).message); }
      }
      const confirmed = Boolean(eventId);

      await db.ClientRequest.create({
        client_id: cid, client_name: business, kind: "call",
        title: `Call ${confirmed ? "booked" : "requested"}: ${when}`,
        details: [topic || "No agenda added.", meetLink && `Google Meet: ${meetLink}`, !confirmed && "Calendar invite was not sent automatically. Justin will confirm by email."].filter(Boolean).join("\n\n"),
        fields: { date, time: label(min), minutes: CALL_MIN, meet_link: meetLink || "", calendar_event_id: eventId || "", phone, confirmed },
        source: "portal", contact_email: user.email, submitted_by: user.email,
        status: "received", priority: "normal", due_date: date, page_status: "none",
      }).catch((e: Error) => console.error("request log failed", e.message));
      await db.Task.create({
        title: `${client.portal_tier === "lead" ? "Lead walkthrough ($30 incentive)" : "Client call"} — ${business} (${label(min)} PT)`,
        category: "strategy", priority: 1, status: "next", source: "request", task_type: "internal",
        due_date: date, client_id: cid, client_name: business, estimated_minutes: CALL_MIN,
        labels: ["Booking", "Portal"],
        notes: [desc, meetLink && `Meet: ${meetLink}`, !confirmed && "Calendar invite was NOT sent automatically — confirm the time and send the invite."].filter(Boolean).join("\n"),
      }).catch((e: Error) => console.error("task create failed", e.message));

      // Lead Engine: a lead booking its walkthrough is tracked on the lead (engagement + $30 owed + Lead Desk log).
      if (client.portal_tier === "lead") await leadBooked(db, client, when).catch((e: Error) => console.error("lead booking log failed", e.message));
      return Response.json({ ok: true, confirmed, meetLink, date, time: `${label(min)} PT`, when, email: user.email });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
