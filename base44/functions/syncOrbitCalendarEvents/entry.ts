import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const RRULE_DAYS = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

// Finds the next date (today or later) whose weekday is in dayNumbers (0=Sun..6=Sat)
function nextOccurrence(dayNumbers) {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  for (let i = 0; i < 7; i++) {
    const candidate = addDays(todayStr, i);
    const weekday = new Date(candidate + "T00:00:00Z").getUTCDay();
    if (dayNumbers.includes(weekday)) return candidate;
  }
  return todayStr;
}

async function upsertEvent(accessToken, existingEventId, summary, dateStr, dayNumbers) {
  const body = {
    summary,
    start: { date: dateStr },
    end: { date: addDays(dateStr, 1) },
  };
  if (dayNumbers && dayNumbers.length > 0) {
    body.recurrence = [`RRULE:FREQ=WEEKLY;BYDAY=${dayNumbers.map((d) => RRULE_DAYS[d]).join(",")}`];
  }

  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": "application/json",
  };

  if (existingEventId) {
    const res = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events/${existingEventId}`,
      { method: "PATCH", headers, body: JSON.stringify(body) }
    );
    if (res.ok) {
      const data = await res.json();
      return data.id;
    }
    // Event may have been deleted on the calendar side — fall through to create a new one
  }

  const createRes = await fetch(
    "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    { method: "POST", headers, body: JSON.stringify(body) }
  );
  if (!createRes.ok) {
    throw new Error(`Failed to create calendar event: ${await createRes.text()}`);
  }
  const created = await createRes.json();
  return created.id;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    // Manual calls (the "Sync to Calendar" button) carry a user session and must be admin.
    // Automation-triggered calls (on client update) run without a user session — allow those through.
    let user = null;
    try {
      user = await base44.auth.me();
    } catch (_e) {
      user = null;
    }
    if (user && user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlecalendar");
    const clients = await base44.asServiceRole.entities.OrbitSEOClient.list("-created_date", 200);

    let synced = 0;

    for (const client of clients) {
      const updates = {};

      if ((client.blogDays || []).length > 0) {
        const dateStr = client.nextBlogDue || nextOccurrence(client.blogDays);
        const eventId = await upsertEvent(
          accessToken,
          client.blogCalendarEventId,
          `${client.businessName} — Blog Post Due`,
          dateStr,
          client.blogDays
        );
        if (eventId !== client.blogCalendarEventId) updates.blogCalendarEventId = eventId;
        synced++;
      } else if (client.nextBlogDue) {
        const eventId = await upsertEvent(
          accessToken,
          client.blogCalendarEventId,
          `${client.businessName} — Blog Post Due`,
          client.nextBlogDue
        );
        if (eventId !== client.blogCalendarEventId) updates.blogCalendarEventId = eventId;
        synced++;
      }

      // GBP days auto-match blog days (per the UI), and don't apply to International clients
      if (client.serviceType !== "International" && (client.blogDays || []).length > 0) {
        const dateStr = client.gbpNextDue || nextOccurrence(client.blogDays);
        const eventId = await upsertEvent(
          accessToken,
          client.gbpCalendarEventId,
          `${client.businessName} — GBP Post Due`,
          dateStr,
          client.blogDays
        );
        if (eventId !== client.gbpCalendarEventId) updates.gbpCalendarEventId = eventId;
        synced++;
      } else if (client.gbpNextDue) {
        const eventId = await upsertEvent(
          accessToken,
          client.gbpCalendarEventId,
          `${client.businessName} — GBP Post Due`,
          client.gbpNextDue
        );
        if (eventId !== client.gbpCalendarEventId) updates.gbpCalendarEventId = eventId;
        synced++;
      }

      if (Object.keys(updates).length > 0) {
        await base44.asServiceRole.entities.OrbitSEOClient.update(client.id, updates);
      }
    }

    return Response.json({ success: true, eventsSynced: synced });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});