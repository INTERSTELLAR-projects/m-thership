import { createClientFromRequest } from 'npm:@base44/sdk@0.8.44';

// One-time maintenance function: deletes every Google Calendar event previously
// synced by syncOrbitCalendarEvents (titles ending in " — Blog Post Due" or
// " — GBP Post Due") from the builder's primary calendar, and clears the stored
// event-id fields on each OrbitSEOClient record.
export default async function(req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return Response.json({ error: 'Forbidden' }, { status: 403 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');
    const authHeader = { Authorization: `Bearer ${accessToken}` };

    // Wide date range (±1 year) to catch past and future synced events.
    const timeMin = new Date(Date.now() - 365 * 86400000).toISOString();
    const timeMax = new Date(Date.now() + 365 * 86400000).toISOString();

    let pageToken = null;
    const allItems = [];
    let pages = 0;
    do {
      let url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?maxResults=250&singleEvents=true&timeMin=${timeMin}&timeMax=${timeMax}`;
      if (pageToken) url += `&pageToken=${pageToken}`;
      const res = await fetch(url, { headers: authHeader });
      if (!res.ok) return Response.json({ error: 'list_failed', status: res.status, detail: await res.text() }, { status: 500 });
      const data = await res.json();
      allItems.push(...(data.items || []));
      pageToken = data.nextPageToken;
      pages++;
    } while (pageToken && pages < 20);

    const targetSuffixes = [' \u2014 Blog Post Due', ' \u2014 GBP Post Due'];
    const matched = allItems.filter((e) =>
      e.summary && targetSuffixes.some((s) => e.summary.endsWith(s)) && e.status !== 'cancelled'
    );

    let deleted = 0;
    const deletedTitles = [];
    for (const ev of matched) {
      const delRes = await fetch(`https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(ev.id)}`, {
        method: 'DELETE',
        headers: authHeader,
      });
      if (delRes.ok || delRes.status === 410 || delRes.status === 404) {
        deleted++;
        deletedTitles.push(ev.summary);
      }
    }

    // Clear the stored event-id fields on all OrbitSEOClient records (single batched update).
    const clients = await base44.asServiceRole.entities.OrbitSEOClient.list('-created_date', 500);
    let cleared = 0;
    for (const c of clients) {
      if (c.blogCalendarEventId || c.gbpCalendarEventId) {
        await base44.asServiceRole.entities.OrbitSEOClient.update(c.id, {
          blogCalendarEventId: null,
          gbpCalendarEventId: null,
        });
        cleared++;
      }
    }

    return Response.json({
      success: true,
      totalPages: pages,
      totalEventsFetched: allItems.length,
      matchedCount: matched.length,
      deleted,
      deletedTitles,
      clearedClientFields: cleared,
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}