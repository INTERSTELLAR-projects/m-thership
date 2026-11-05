import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Stärboard (in Møthership) · public Google-reviews endpoint for every Interstellar client site (moved into Møthership).
// Google is asked at most ONCE PER DAY PER CLIENT; every other request is served from ReviewClient.cache.
// A failed refresh is retried at most every 6 hours, and the last good copy is always served.
//   GET  /functions/reviews?client=<slug>     or     POST /functions/reviews { "client": "<slug>" }

const REFRESH_MS = 24 * 60 * 60 * 1000;
const RETRY_MS = 6 * 60 * 60 * 1000;
// nationalPhoneNumber/formattedAddress are the GBP's NAP (source of truth for client phones); same Places SKU as reviews.
// regularOpeningHours = the GBP's hours (source of truth for client sites + CRM); same Places SKU tier as reviews.
const FIELD_MASK = "displayName,rating,userRatingCount,reviews,googleMapsUri,nationalPhoneNumber,internationalPhoneNumber,formattedAddress,regularOpeningHours";
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-App-Id, Authorization",
};
const reply = (body: unknown, status = 200, maxAge = 3600) =>
  Response.json(body, { status, headers: { ...CORS, "Cache-Control": `public, max-age=${maxAge}` } });

async function fetchFromGoogle(placeId: string) {
  const key = Deno.env.get("GOOGLE_PLACES_API_KEY");
  if (!key) throw new Error("GOOGLE_PLACES_API_KEY is not set in Møthership secrets");
  const res = await fetch("https://places.googleapis.com/v1/places/" + encodeURIComponent(placeId) + "?languageCode=en",
    { headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELD_MASK }, signal: AbortSignal.timeout(10000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data?.error?.message || `Places API ${res.status}`);
  const reviews = (Array.isArray(data.reviews) ? data.reviews : [])
    .filter((r: any) => r && r.rating >= 4 && r.text?.text)
    .map((r: any) => ({
      author: r.authorAttribution?.displayName || "Google Reviewer",
      photo: r.authorAttribution?.photoUri || "",
      rating: r.rating, text: r.text?.text || "", time: r.publishTime || null,
      relative: r.relativePublishTimeDescription || "", profileUrl: r.authorAttribution?.uri || "",
    }))
    .sort((a: any, b: any) => (b.time || "").localeCompare(a.time || ""));
  return {
    configured: true,
    rating: typeof data.rating === "number" ? data.rating : null,
    total: typeof data.userRatingCount === "number" ? data.userRatingCount : null,
    businessName: data.displayName?.text || null,
    mapsUrl: data.googleMapsUri || null,
    phone: data.nationalPhoneNumber || null,
    phoneIntl: data.internationalPhoneNumber || null,
    address: data.formattedAddress || null,
    hours: Array.isArray(data.regularOpeningHours?.weekdayDescriptions) ? data.regularOpeningHours.weekdayDescriptions : null,
    reviewUrl: "https://search.google.com/local/writereview?placeid=" + encodeURIComponent(placeId),
    reviews,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  try {
    const url = new URL(req.url);
    let slug = url.searchParams.get("client") || "";
    let force = false;
    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      slug = slug || String(body?.client || "");
      force = body?.force === true;
    }
    slug = slug.trim().toLowerCase();
    if (!slug) return reply({ error: "Missing ?client=<slug>", reviews: [] }, 400, 60);

    const base44 = createClientFromRequest(req);
    if (force) {
      // manual "Refresh now" from the Møthership admin only
      const user = await base44.auth.me().catch(() => null);
      if (!user || user.role !== "admin") force = false;
    }
    const db = base44.asServiceRole.entities.ReviewClient;
    const [client] = await db.filter({ slug });
    if (!client || client.active === false) return reply({ error: "Unknown client", reviews: [] }, 404, 300);

    const now = Date.now();
    const cachedAt = client.cached_at ? Date.parse(client.cached_at) : 0;
    const attemptAt = client.last_attempt_at ? Date.parse(client.last_attempt_at) : 0;
    const fresh = client.cache && now - cachedAt < REFRESH_MS;
    const coolingDown = now - attemptAt < (client.last_error ? RETRY_MS : REFRESH_MS);
    // One-time backfill: caches written before the GBP phone/address were requested refresh once.
    // Same for caches written before opening hours were requested (Nov 5, 2026).
    const missingNap = client.cache && (!("phone" in client.cache) || !("hours" in client.cache)) && !client.last_error;
    if (!force && !missingNap && (fresh || coolingDown)) {
      return reply({ ...(client.cache || { configured: true, reviews: [] }), cachedAt: client.cached_at || null });
    }

    await db.update(client.id, { last_attempt_at: new Date(now).toISOString() });
    try {
      const data = await fetchFromGoogle(client.place_id);
      const keyOf = (r: any) => `${r.author}|${r.time}`;
      const seen = new Map<string, any>();
      for (const r of [...data.reviews, ...((client.cache?.reviews as any[]) || [])]) if (!seen.has(keyOf(r))) seen.set(keyOf(r), r);
      (data as any).reviews = [...seen.values()].sort((a: any, b: any) => (b.time || "").localeCompare(a.time || "")).slice(0, 100);
      const stamp = new Date().toISOString();
      await db.update(client.id, { cache: data, cached_at: stamp, last_error: "" });
      return reply({ ...data, cachedAt: stamp });
    } catch (err) {
      await db.update(client.id, { last_error: String((err as Error).message || err).slice(0, 300) });
      return reply({ ...(client.cache || { configured: true, reviews: [] }), cachedAt: client.cached_at || null, stale: true }, 200, 600);
    }
  } catch (error) {
    return reply({ error: (error as Error).message, reviews: [] }, 500, 60);
  }
});
