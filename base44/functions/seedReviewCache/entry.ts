import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";
// TEMPORARY one-time migration: copies the last good review cache from the old Stärboard app.
// Only fills clients whose cache is empty. Delete after use (2026-10-29).
Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const db = base44.asServiceRole.entities.ReviewClient;
  const rows = await db.list();
  const out: any[] = [];
  for (const c of rows) {
    if (c.cache) { out.push({ slug: c.slug, skipped: true }); continue; }
    try {
      const r = await fetch("https://interstellar-st-rboard.base44.app/functions/reviews?client=" + c.slug, { signal: AbortSignal.timeout(10000) });
      const d = await r.json();
      if (!r.ok || !Array.isArray(d.reviews) || d.error) { out.push({ slug: c.slug, status: r.status }); continue; }
      const { cachedAt, stale, ...cache } = d;
      await db.update(c.id, { cache, cached_at: cachedAt || new Date().toISOString(), last_attempt_at: cachedAt || new Date().toISOString() });
      out.push({ slug: c.slug, reviews: cache.reviews.length, rating: cache.rating });
    } catch (e) { out.push({ slug: c.slug, error: String(e) }); }
  }
  return Response.json(out);
});
