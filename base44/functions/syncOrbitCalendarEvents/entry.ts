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

// Finds every existing (non-cancelled) event on the calendar with this exact summary/title.
// We match by title instead of trusting a stored event id, so stale/duplicate events are
// always found and cleaned up, however they got created.
async function findEventIds(accessToken, summary) {
  const params = new URLSearchParams({ q: summary, singleEvents: "false", maxResults: "50" });
  const res = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return [];
  const data = await res.json();
  return (data.items || []).filter((e) => e.summary === summary && e.status !== "cancelled").map((e) => e.id);
}

async function deleteEvent(accessToken, eventId) {
  await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${eventId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// Deletes any existing event(s) with this title, then creates exactly one fresh event.
// This guarantees there is never more than one event per client per type (blog/GBP),
// even if a previous sync left behind duplicates or a stale event id.
async function replaceEvent(accessToken, summary, dateStr, dayNumbers) {
  const existingIds = await findEventIds(accessToken, summary);
  for (const id of existingIds) {
    await deleteEvent(accessToken, id);
  }

  const body = {
    summary,
    start: { date: dateStr },
    end: { date: addDays(dateStr, 1) },
  };
  if (dayNumbers && dayNumbers.length > 0) {
    body.recurrence = [`RRULE:FREQ=WEEKLY;BYDAY=${dayNumbers.map((d) => RRULE_DAYS[d]).join(",")}`];
  }

  const createRes = await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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

    const payload = await req.json().catch(() => ({}));
    const entityId = payload?.event?.entity_id || null;

    const { accessToken } = await base44.asServiceRole.connectors.getConnection("googlecalendar");

    let clients;
    if (entityId) {
      // Automation-triggered: only re-sync the single client that changed.
      const single = await base44.asServiceRole.entities.OrbitSEOClient.get(entityId);
      clients = single ? [single] : [];
    } else {
      // Manual "Sync to Calendar" button: re-sync everyone.
      clients = await base44.asServiceRole.entities.OrbitSEOClient.list("-created_date", 200);
    }

    let synced = 0;

    for (const client of clients) {
      const updates = {};

      if ((client.blogDays || []).length > 0) {
        const dateStr = client.nextBlogDue || nextOccurrence(client.blogDays);
        const summary = `${client.businessName} — Blog Post Due`;
        const eventId = await replaceEvent(accessToken, summary, dateStr, client.blogDays);
        updates.blogCalendarEventId = eventId;
        synced++;
      }

      // GBP days auto-match blog days (per the UI), and don't apply to International clients
      if (client.serviceType !== "International" && (client.blogDays || []).length > 0) {
        const dateStr = client.gbpNextDue || nextOccurrence(client.blogDays);
        const summary = `${client.businessName} — GBP Post Due`;
        const eventId = await replaceEvent(accessToken, summary, dateStr, client.blogDays);
        updates.gbpCalendarEventId = eventId;
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