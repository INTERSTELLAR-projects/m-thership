import { createClientFromRequest } from 'npm:@base44/sdk@0.8.38';

function addDays(dateStr, days) {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function upsertEvent(accessToken, existingEventId, summary, dateStr) {
  const body = {
    summary,
    start: { date: dateStr },
    end: { date: addDays(dateStr, 1) },
  };

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
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "admin") return Response.json({ error: "Forbidden" }, { status: 403 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlecalendar");
    const clients = await base44.asServiceRole.entities.OrbitSEOClient.list("-created_date", 200);

    let synced = 0;

    for (const client of clients) {
      const updates = {};

      if (client.nextBlogDue) {
        const eventId = await upsertEvent(
          accessToken,
          client.blogCalendarEventId,
          `${client.businessName} — Blog Post Due`,
          client.nextBlogDue
        );
        if (eventId !== client.blogCalendarEventId) updates.blogCalendarEventId = eventId;
        synced++;
      }

      if (client.gbpNextDue) {
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