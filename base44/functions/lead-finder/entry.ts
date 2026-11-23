// @ts-nocheck
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { staffOf, assignLead, clip, nowIso, noteDate } from "../../shared/staff.ts";
import { PLACES_PRICING, PLACES_CACHE_DAYS, US_STATE_NAMES, seedTemplates, matchTemplate, placeFlags, datedSignals, digitsOf, domainOfUrl, routeLead } from "../../shared/leadEngine.js";

/*
 * Lead Finder (Lead Engine). Admins and sales reps only. Uses the OFFICIAL Google Places API (New) Text Search with
 * the GOOGLE_PLACES_API_KEY secret (never in code). Never scrapes Google Maps pages.
 * Places terms: place_id is stored permanently; every other Places field is a cache with gbp_fetched_at and is
 * refreshed on view after 30 days (action refresh).
 *   status                      → { configured, pricing, usage }
 *   search { state, industry_key, place?, page_token? }  → { results, next_page_token, est_cost_usd }
 *   check_sites { urls[] }      → { checks: { url: {dated, reasons, copyright} } }  (≤10 homepages, 6s each)
 *   add_leads { places[], industry_key, state }           → { created, skipped }  (dedupe by place_id / phone / domain)
 *   add_manual { gbp_url, business, industry_key?, phone?, website?, state?, city? }
 *   refresh { client_id, force? } → re-reads Place Details when the cache is older than 30 days
 * Rate limits: 10 searches a minute and 150 a day per person (reps 60 a day).
 */

const FIELDS = ["id", "displayName", "formattedAddress", "addressComponents", "nationalPhoneNumber", "websiteUri", "rating", "userRatingCount", "googleMapsUri", "primaryTypeDisplayName", "photos", "businessStatus"];
const SEARCH_MASK = [...FIELDS.map((f) => `places.${f}`), "nextPageToken"].join(",");
const DETAILS_MASK = FIELDS.join(",");
const DAY = 86400000;

const key = () => { try { return Deno.env.get("GOOGLE_PLACES_API_KEY") || ""; } catch { return ""; } };
const err = (error: string, status = 400, extra = {}) => Response.json({ error, ...extra }, { status });

function shapePlace(p: any) {
  const comp = (type: string, short = false) => { const c = (p.addressComponents || []).find((x: any) => (x.types || []).includes(type)); return c ? (short ? c.shortText : c.longText) : ""; };
  const out = {
    place_id: String(p.id || ""),
    name: String(p.displayName?.text || ""),
    category: String(p.primaryTypeDisplayName?.text || ""),
    rating: typeof p.rating === "number" ? p.rating : null,
    review_count: typeof p.userRatingCount === "number" ? p.userRatingCount : 0,
    phone: String(p.nationalPhoneNumber || ""),
    website: String(p.websiteUri || ""),
    address: String(p.formattedAddress || ""),
    city: comp("locality") || comp("postal_town") || comp("administrative_area_level_3"),
    state: comp("administrative_area_level_1", true),
    maps_url: String(p.googleMapsUri || ""),
    photo_count: Array.isArray(p.photos) ? p.photos.length : 0,
    status: String(p.businessStatus || ""),
  };
  return { ...out, flags: placeFlags(out) };
}

// Same place/phone/domain already in the CRM?
async function existingIndex(db: any) {
  const rows = ((await db.CRMClient.list("-created_date", 2000).catch(() => [])) || []) as any[];
  const byPlace = new Map(), byPhone = new Map(), byDomain = new Map();
  for (const c of rows) {
    const keep = { id: c.id, business: c.business, status: c.status, assigned_rep_id: c.assigned_rep_id || "" };
    if (c.place_id) byPlace.set(String(c.place_id), keep);
    for (const p of c.phones || []) { const d = digitsOf(p); if (d.length === 10) byPhone.set(d, keep); }
    for (const w of [...(c.websites || []), c.domain]) { const d = domainOfUrl(w || ""); if (d && !/google\.|facebook\.|instagram\./.test(d)) byDomain.set(d, keep); }
  }
  return (p: any) => (p.place_id && byPlace.get(p.place_id)) || (digitsOf(p.phone).length === 10 && byPhone.get(digitsOf(p.phone))) || (domainOfUrl(p.website) && byDomain.get(domainOfUrl(p.website))) || null;
}

const PRIVATE = /^(localhost|127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|0\.|\[?::1|.*\.internal$|.*\.local$)/i;
async function checkSite(url: string) {
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(url) ? url : `https://${url}`); } catch { return { error: "bad url" }; }
  if (!/^https?:$/.test(u.protocol) || PRIVATE.test(u.hostname)) return { error: "not allowed" };
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 6000);
  try {
    const res = await fetch(u.toString(), { redirect: "follow", signal: ctl.signal, headers: { "user-agent": "Mozilla/5.0 (compatible; SiteCheck/1.0)", accept: "text/html" } });
    const reader = res.body?.getReader();
    let html = "", total = 0;
    if (reader) {
      while (total < 400000) { const { value, done } = await reader.read(); if (done) break; total += value.length; html += new TextDecoder().decode(value); }
      try { reader.cancel(); } catch { /* done */ }
    }
    return { ...datedSignals(html, res.url || u.toString()), status: res.status, final_url: res.url || u.toString() };
  } catch (e) {
    return { error: String(e?.name === "AbortError" ? "timed out" : e?.message || e).slice(0, 120) };
  } finally { clearTimeout(timer); }
}

async function templatesOf(db: any) {
  const rows = ((await db.IndustryTemplate.filter({ archived: { $ne: true } }, "name", 100).catch(() => [])) || []) as any[];
  return rows.length ? rows : seedTemplates();
}

async function rateLimited(db: any, staff: any) {
  const since = new Date(Date.now() - DAY).toISOString();
  const rows = ((await db.LeadSearch.filter({ by: staff.email, at: { $gte: since } }, "-at", 300).catch(() => [])) || []) as any[];
  const minute = rows.filter((r) => Date.parse(r.at) > Date.now() - 60000).length;
  const cap = staff.kind === "admin" ? 150 : 60;
  if (minute >= 10) return "Slow down: 10 searches a minute max. Try again in a moment.";
  if (rows.length >= cap) return `Daily limit reached (${cap} searches in 24 hours). It resets as the day rolls over.`;
  return "";
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    const db = base44.asServiceRole.entities;
    const staff = await staffOf(db, user);
    if (!staff) return err("Admins and sales reps only", 403);
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "status");

    if (action === "status") {
      const monthStart = new Date().toISOString().slice(0, 7) + "-01T00:00:00Z";
      const rows = ((await db.LeadSearch.filter({ at: { $gte: monthStart } }, "-at", 1000).catch(() => [])) || []) as any[];
      const mine = rows.filter((r) => r.by === staff.email);
      return Response.json({
        configured: key().length > 0,
        pricing: PLACES_PRICING, cache_days: PLACES_CACHE_DAYS,
        usage: { month_requests: staff.kind === "admin" ? rows.length : mine.length, month_est_usd: Math.round((staff.kind === "admin" ? rows : mine).reduce((a, r) => a + (Number(r.est_cost_usd) || 0), 0) * 100) / 100, today: mine.filter((r) => Date.parse(r.at) > Date.now() - DAY).length },
        staff: { kind: staff.kind, allowed_industries: staff.rep?.allowed_industries || null, multi_industry_ready: !!staff.rep?.multi_industry_ready },
      });
    }

    if (action === "search") {
      const k = key();
      if (!k) return err("GOOGLE_PLACES_API_KEY is not set. Add it in Settings → Secrets.", 400, { code: "no_key" });
      const state = clip(body.state, 2).toUpperCase();
      if (!US_STATE_NAMES[state]) return err("Pick a state on the map.");
      const templates = await templatesOf(db);
      const t = templates.find((x: any) => x.industry_key === clip(body.industry_key, 60));
      if (!t) return err("Pick an industry.");
      if (staff.kind === "sales" && !(staff.rep.multi_industry_ready && !(staff.rep.allowed_industries || []).length) && !(staff.rep.allowed_industries || []).includes(t.industry_key)) return err("That industry isn't on your list yet. Ask Justin to add it.", 403);
      const limit = await rateLimited(db, staff);
      if (limit) return err(limit, 429);
      const place = clip(body.place, 80).replace(/[^\w\s.,'-]/g, "");
      const query = `${clip(t.places_query || t.name, 60)} in ${place ? `${place}, ` : ""}${US_STATE_NAMES[state]}`;
      const page = Math.max(1, Math.min(3, Number(body.page) || 1));
      const reqBody: any = { textQuery: query, pageSize: 20, regionCode: "US", languageCode: "en" };
      if (body.page_token) reqBody.pageToken = clip(body.page_token, 1200);
      const res = await fetch("https://places.googleapis.com/v1/places:searchText", { method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": k, "X-Goog-FieldMask": SEARCH_MASK }, body: JSON.stringify(reqBody) });
      const data = await res.json().catch(() => ({}));
      const log = { at: nowIso(), by: staff.email, state, place, industry_key: t.industry_key, query, page, est_cost_usd: PLACES_PRICING.per_request_usd, test: body.test === true };
      if (!res.ok) {
        await db.LeadSearch.create({ ...log, ok: false, results: 0, error: String(data?.error?.message || res.status).slice(0, 300) }).catch(() => null);
        return err(`Google Places said: ${String(data?.error?.message || res.statusText).slice(0, 200)}`, 502, { code: "places_error" });
      }
      const find = await existingIndex(db);
      const results = (data.places || []).map(shapePlace).filter((p: any) => p.place_id && p.status !== "CLOSED_PERMANENTLY").map((p: any) => ({ ...p, existing: find(p) }));
      await db.LeadSearch.create({ ...log, ok: true, results: results.length }).catch(() => null);
      return Response.json({ query, results, next_page_token: data.nextPageToken || "", page, est_cost_usd: PLACES_PRICING.per_request_usd, fetched_at: nowIso() });
    }

    if (action === "check_sites") {
      const urls = (Array.isArray(body.urls) ? body.urls : []).map((u: any) => clip(u, 300)).filter(Boolean).slice(0, 10);
      const out: Record<string, unknown> = {};
      await Promise.all(urls.map(async (u: string) => { out[u] = await checkSite(u); }));
      return Response.json({ checks: out });
    }

    if (action === "add_leads") {
      const templates = await templatesOf(db);
      const t = templates.find((x: any) => x.industry_key === clip(body.industry_key, 60)) || null;
      if (staff.kind === "sales" && t && !(staff.rep.multi_industry_ready && !(staff.rep.allowed_industries || []).length) && !(staff.rep.allowed_industries || []).includes(t.industry_key)) return err("That industry isn't on your list yet.", 403);
      const list = (Array.isArray(body.places) ? body.places : []).slice(0, 60);
      const find = await existingIndex(db);
      const created: any[] = [], skipped: any[] = [];
      const seen = new Set();
      for (const raw of list) {
        const p = {
          place_id: clip(raw?.place_id, 200), name: clip(raw?.name, 160), category: clip(raw?.category, 80), rating: typeof raw?.rating === "number" ? raw.rating : null,
          review_count: Number(raw?.review_count) || 0, phone: clip(raw?.phone, 40), website: clip(raw?.website, 300), address: clip(raw?.address, 300),
          city: clip(raw?.city, 60), state: clip(raw?.state || body.state, 2).toUpperCase(), maps_url: /^https:\/\/(maps\.google\.com|www\.google\.com\/maps|maps\.app\.goo\.gl)/.test(String(raw?.maps_url || "")) ? clip(raw.maps_url, 400) : "",
          photo_count: Number(raw?.photo_count) || 0,
        };
        if (!p.place_id || !p.name) { skipped.push({ name: p.name || "?", reason: "missing place id" }); continue; }
        if (seen.has(p.place_id)) continue;
        seen.add(p.place_id);
        const dup = find(p);
        if (dup) { skipped.push({ name: p.name, reason: `already in CRM as ${dup.business}`, id: dup.id }); continue; }
        const check = raw?.site_check && typeof raw.site_check === "object" ? { at: nowIso(), dated: !!raw.site_check.dated, reasons: (raw.site_check.reasons || []).map((x: any) => clip(x, 30)).slice(0, 8), copyright: Number(raw.site_check.copyright) || null } : null;
        const flags = [...placeFlags(p), ...(check?.dated ? ["dated"] : [])];
        const tt = t || matchTemplate(templates, { text: `${p.category} ${p.name}` });
        const site = p.website ? (/^https?:\/\//i.test(p.website) ? p.website : `https://${p.website}`) : "";
        const rec: any = {
          business: p.name, status: "Lead", pipeline_stage: "new", pipeline_stage_logged: "new", stage_changed_at: nowIso(),
          lead_source: "lead_finder", one_liner: p.category, industry: tt?.name || p.category, industry_key: tt?.industry_key || "", niche_key: tt?.niche_key || "other",
          place_id: p.place_id, gbp_url: p.maps_url, gbp_fetched_at: nowIso(),
          gbp_cache: { name: p.name, category: p.category, rating: p.rating, review_count: p.review_count, phone: p.phone, website: p.website, address: p.address, maps_url: p.maps_url, photo_count: p.photo_count, fetched_at: nowIso() },
          phones: p.phone ? [p.phone] : [], websites: site ? [site] : [], domain: domainOfUrl(site), state: p.state, city: p.city,
          location: [p.city, p.state].filter(Boolean).join(", "), lead_flags: flags, ...(check ? { site_check: check } : {}), scrape_status: "none",
          notes: [{ id: Date.now(), text: `Added from Lead Finder by ${staff.name} (${tt?.name || "industry"} · ${p.city || ""}${p.state ? `, ${p.state}` : ""}).`, date: noteDate() }],
        };
        if (staff.kind === "sales") Object.assign(rec, { assigned_rep_id: staff.rep.id, assigned_rep_name: staff.rep.name, assigned_at: nowIso() });
        const c = await db.CRMClient.create(rec);
        if (staff.kind === "admin") await assignLead(db, c, routeLead, { by: "automation:routing" }).catch(() => null);
        created.push({ id: c.id, business: c.business });
      }
      if (created.length) await db.AgentAuditLog.create({ at: nowIso(), ok: true, actor: staff.email, action: "leads_added", entity: "CRMClient", record_id: created[0].id, summary: `Lead Finder: ${created.length} lead(s) added${skipped.length ? `, ${skipped.length} skipped as duplicates` : ""}` }).catch(() => null);
      return Response.json({ created, skipped });
    }

    if (action === "add_manual") {
      const url = clip(body.gbp_url, 600);
      if (!/^https:\/\/(www\.google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|maps\.app\.goo\.gl|g\.page|share\.google|www\.google\.com\/search|g\.co\/kgs)/i.test(url)) return err("Paste a Google Business Profile or Google Maps link (https://maps.app.goo.gl/… or https://www.google.com/maps/place/…).");
      let business = clip(body.business, 160);
      if (!business) { const m = url.match(/\/maps\/place\/([^/@?]+)/); if (m) business = decodeURIComponent(m[1].replace(/\+/g, " ")).slice(0, 160); }
      if (!business) return err("Add the business name.");
      const phone = clip(body.phone, 40), website = clip(body.website, 300);
      const find = await existingIndex(db);
      const all = ((await db.CRMClient.filter({ gbp_url: url }, "-created_date", 1).catch(() => [])) || []) as any[];
      const dup = all[0] ? { id: all[0].id, business: all[0].business } : find({ phone, website });
      if (dup) return err(`Already in the CRM as ${dup.business}.`, 409, { id: dup.id });
      const templates = await templatesOf(db);
      const t = templates.find((x: any) => x.industry_key === clip(body.industry_key, 60)) || matchTemplate(templates, { text: business });
      const site = website ? (/^https?:\/\//i.test(website) ? website : `https://${website}`) : "";
      const rec: any = {
        business, status: "Lead", pipeline_stage: "new", pipeline_stage_logged: "new", stage_changed_at: nowIso(), lead_source: "lead_finder",
        gbp_url: url, industry: t?.name || "", industry_key: t?.industry_key || "", niche_key: t?.niche_key || "other", phones: phone ? [phone] : [], websites: site ? [site] : [], domain: domainOfUrl(site),
        state: clip(body.state, 2).toUpperCase(), city: clip(body.city, 60), location: [clip(body.city, 60), clip(body.state, 2).toUpperCase()].filter(Boolean).join(", "), lead_flags: site ? [] : ["no_website"], scrape_status: "none",
        notes: [{ id: Date.now(), text: `Added by pasting a Google Business Profile link (${staff.name}).`, date: noteDate() }],
      };
      if (staff.kind === "sales") Object.assign(rec, { assigned_rep_id: staff.rep.id, assigned_rep_name: staff.rep.name, assigned_at: nowIso() });
      const c = await db.CRMClient.create(rec);
      if (staff.kind === "admin") await assignLead(db, c, routeLead).catch(() => null);
      return Response.json({ created: [{ id: c.id, business: c.business }] });
    }

    if (action === "refresh") {
      const c = await db.CRMClient.get(clip(body.client_id, 64)).catch(() => null);
      if (!c) return err("Lead not found", 404);
      if (staff.kind === "sales" && c.assigned_rep_id !== staff.rep.id && c.builder_rep_id !== staff.rep.id) return err("Not your lead", 403);
      if (!c.place_id) return Response.json({ refreshed: false, reason: "no place id" });
      const age = Date.now() - Date.parse(c.gbp_fetched_at || 0);
      if (age < PLACES_CACHE_DAYS * DAY && !(body.force === true && staff.kind === "admin")) return Response.json({ refreshed: false, reason: "fresh", age_days: Math.floor(age / DAY) });
      const k = key();
      if (!k) return Response.json({ refreshed: false, reason: "no key" });
      const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(c.place_id)}?languageCode=en`, { headers: { "X-Goog-Api-Key": k, "X-Goog-FieldMask": DETAILS_MASK } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return Response.json({ refreshed: false, reason: String(data?.error?.message || res.status).slice(0, 200) });
      const p = shapePlace(data);
      const gbp_cache = { name: p.name, category: p.category, rating: p.rating, review_count: p.review_count, phone: p.phone, website: p.website, address: p.address, maps_url: p.maps_url, photo_count: p.photo_count, fetched_at: nowIso() };
      const flags = [...new Set([...(c.lead_flags || []).filter((f: string) => f === "dated"), ...p.flags])];
      await db.CRMClient.update(c.id, { gbp_cache, gbp_fetched_at: nowIso(), lead_flags: flags });
      return Response.json({ refreshed: true, gbp_cache });
    }

    return err("Unknown action");
  } catch (e) {
    return Response.json({ error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
});
