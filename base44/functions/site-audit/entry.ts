import { createClientFromRequest } from "npm:@base44/sdk@0.8.44";

// Site audit: runs Google PageSpeed Insights (Lighthouse) on a client's site, fetches the page
// itself for on-page and indexing facts, and saves one SiteAudit record. Read-only on the client
// site: it never changes anything it checks. Admin only.
//
//   { action: "run", client_id, strategy?: "mobile" | "desktop", mode?: "manual" | "auto", force?: boolean }
//   { action: "run_due", max_age_days?: 7, limit?: 3 }   (auto mode, for a schedule)
//
// Optional secret PAGESPEED_API_KEY raises Google's quota; without it PageSpeed still works at a low rate.
// Clients whose site is still on Framer (PowerLift) never get automatic audits.

const AUTO_BLOCKED = [/power\s*lift/i];
const isAutoBlocked = (c: Record<string, unknown>) => AUTO_BLOCKED.some((re) => re.test(String(c.business || "")));
const WEIGHTS: Record<string, number> = { seo: 40, performance: 30, accessibility: 15, best_practices: 15 };
const CATS: Record<string, string> = { performance: "performance", seo: "seo", accessibility: "accessibility", "best-practices": "best_practices" };
const CRITICAL = new Set(["is-crawlable", "http-status-code"]);
const HIGH = new Set(["document-title", "meta-description", "image-alt", "canonical", "largest-contentful-paint", "cumulative-layout-shift", "total-blocking-time", "viewport", "link-text", "crawlable-anchors", "hreflang", "robots-txt", "is-on-https"]);
const UA = "Mozilla/5.0 (compatible; InterstellarSiteAudit/1.0; +https://interstellar-strategies.com)";

type Rec = Record<string, any>;

function siteUrl(c: Rec): string {
  const raw = String(c.domain || (c.websites || [])[0] || "").trim();
  if (!raw) return "";
  const u = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try { return new URL(u).origin + "/"; } catch { return ""; }
}

function stripMd(s = ""): string {
  return String(s).replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/`/g, "").trim();
}

function severityFor(id: string, a: Rec, catKey: string, weight: number): string {
  if (CRITICAL.has(id)) return "critical";
  const savings = Number(a?.details?.overallSavingsMs || a?.numericValue || 0);
  if (HIGH.has(id)) return (a.score ?? 1) < 0.5 ? "high" : "medium";
  if (catKey === "performance" && a?.details?.type === "opportunity") return savings > 1000 ? "high" : savings > 300 ? "medium" : "low";
  if (catKey === "accessibility") return weight >= 7 ? "medium" : "low";
  return (a.score ?? 1) < 0.5 ? "medium" : "low";
}

function sampleItems(a: Rec) {
  const items = Array.isArray(a?.details?.items) ? a.details.items : [];
  return items.slice(0, 8).map((it: Rec) => ({
    url: typeof it.url === "string" ? it.url : typeof it.source?.url === "string" ? it.source.url : "",
    snippet: String(it.node?.snippet || it.snippet || "").slice(0, 300),
    label: String(it.node?.nodeLabel || it.label || it.text || "").slice(0, 160),
    savings_ms: typeof it.wastedMs === "number" ? Math.round(it.wastedMs) : undefined,
    savings_bytes: typeof it.wastedBytes === "number" ? Math.round(it.wastedBytes) : undefined,
  }));
}

async function pageSpeed(url: string, strategy: string) {
  const key = Deno.env.get("PAGESPEED_API_KEY");
  const qs = new URLSearchParams({ url, strategy });
  ["performance", "seo", "accessibility", "best-practices"].forEach((c) => qs.append("category", c));
  if (key) qs.set("key", key);
  const res = await fetch(`https://www.googleapis.com/pagespeedonline/v5/runPagespeed?${qs}`, { signal: AbortSignal.timeout(90000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) throw new Error(data?.error?.message || `PageSpeed ${res.status}`);
  const lr = data.lighthouseResult || {};
  const audits: Rec = lr.audits || {};
  const scores: Rec = {};
  const issues: Rec[] = [];
  for (const [lhKey, key2] of Object.entries(CATS)) {
    const cat = lr.categories?.[lhKey];
    if (!cat) continue;
    if (typeof cat.score === "number") scores[key2] = Math.round(cat.score * 100);
    for (const ref of cat.auditRefs || []) {
      const a = audits[ref.id];
      if (!a || a.score == null || a.score >= 0.9) continue;
      if (!["binary", "numeric", "metricSavings"].includes(a.scoreDisplayMode)) continue;
      if (ref.group === "metrics" && key2 === "performance" && !["largest-contentful-paint", "cumulative-layout-shift", "total-blocking-time"].includes(ref.id)) continue;
      if (issues.some((i) => i.key === ref.id)) continue;
      issues.push({
        key: ref.id, source: "lighthouse", category: key2, title: a.title, score: Math.round(a.score * 100),
        severity: severityFor(ref.id, a, key2, Number(ref.weight || 0)), display_value: a.displayValue || "",
        description: stripMd(a.description), items: sampleItems(a),
      });
    }
  }
  const n = (id: string) => (typeof audits[id]?.numericValue === "number" ? audits[id].numericValue : null);
  const fm = data.loadingExperience?.metrics || {};
  const vitals: Rec = {
    lcp_ms: n("largest-contentful-paint"), cls: n("cumulative-layout-shift"), tbt_ms: n("total-blocking-time"),
    fcp_ms: n("first-contentful-paint"), si_ms: n("speed-index"), ttfb_ms: n("server-response-time"),
    field_lcp_ms: fm.LARGEST_CONTENTFUL_PAINT_MS?.percentile ?? null,
    field_inp_ms: fm.INTERACTION_TO_NEXT_PAINT?.percentile ?? null,
    field_cls: typeof fm.CUMULATIVE_LAYOUT_SHIFT_SCORE?.percentile === "number" ? fm.CUMULATIVE_LAYOUT_SHIFT_SCORE.percentile / 100 : null,
    field_category: data.loadingExperience?.overall_category || null,
  };
  for (const k of Object.keys(vitals)) if (typeof vitals[k] === "number" && k !== "cls" && k !== "field_cls") vitals[k] = Math.round(vitals[k]);
  if (typeof vitals.cls === "number") vitals.cls = Math.round(vitals.cls * 1000) / 1000;
  return { scores, vitals, issues, final_url: lr.finalDisplayedUrl || lr.finalUrl || url };
}

const attr = (tag: string, name: string) => {
  const m = tag.match(new RegExp(`${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  return m ? (m[2] ?? m[3] ?? m[4] ?? "") : null;
};
const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();

async function onPage(url: string) {
  const page: Rec = { url };
  const issues: Rec[] = [];
  const add = (key: string, title: string, severity: string, category: string, description: string, items: Rec[] = []) =>
    issues.push({ key, source: "onpage", category, title, severity, description, items });
  try {
    const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
    page.http_status = res.status;
    page.final_url = res.url;
    page.https = res.url.startsWith("https://");
    page.x_robots = res.headers.get("x-robots-tag") || "";
    const html = (await res.text()).slice(0, 2_000_000);
    const head = html.match(/<head[\s\S]*?<\/head>/i)?.[0] || html.slice(0, 200000);
    page.title = decode(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
    const metas = head.match(/<meta\b[^>]*>/gi) || [];
    const meta = (n: string) => { const t = metas.find((m) => (attr(m, "name") || attr(m, "property") || "").toLowerCase() === n); return t ? decode(attr(t, "content") || "") : null; };
    page.meta_description = meta("description");
    page.robots_meta = meta("robots") || "";
    page.og = { title: meta("og:title"), description: meta("og:description"), image: meta("og:image") };
    const canon = (head.match(/<link\b[^>]*>/gi) || []).find((l) => (attr(l, "rel") || "").toLowerCase() === "canonical");
    page.canonical = canon ? attr(canon, "href") : null;
    page.lang = attr(html.match(/<html\b[^>]*>/i)?.[0] || "", "lang");
    page.h1s = (html.match(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi) || []).map((h) => decode(h.replace(/<[^>]+>/g, " "))).filter(Boolean).slice(0, 6);
    const types = new Set<string>();
    for (const m of html.matchAll(/<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      try {
        const walk = (o: unknown): void => {
          if (Array.isArray(o)) return o.forEach(walk);
          if (o && typeof o === "object") {
            const t = (o as Rec)["@type"];
            (Array.isArray(t) ? t : t ? [t] : []).forEach((x: unknown) => types.add(String(x)));
            Object.values(o as Rec).forEach((v) => { if (v && typeof v === "object") walk(v); });
          }
        };
        walk(JSON.parse(m[1].trim()));
      } catch { types.add("(invalid JSON-LD)"); }
    }
    page.jsonld_types = [...types];
    const imgs = html.match(/<img\b[^>]*>/gi) || [];
    page.images_total = imgs.length;
    page.images_missing_alt = imgs.filter((i) => { const a = attr(i, "alt"); return a == null || !a.trim(); })
      .map((i) => attr(i, "src") || attr(i, "data-src") || "").filter(Boolean).slice(0, 20);
    page.word_count = decode(html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")).split(" ").filter(Boolean).length;

    const noindex = /noindex/i.test(page.robots_meta) || /noindex/i.test(page.x_robots);
    page.noindex = noindex;
    if (noindex) add("noindex", "Home page is set to noindex", "critical", "indexing", "A robots meta tag or X-Robots-Tag header tells search engines not to index this page.");
    if (res.status >= 400) add("http-error", `Home page returns HTTP ${res.status}`, "critical", "indexing", "The page answers with an error status, so search engines drop it.");
    if (!page.https) add("not-https", "Site does not end on HTTPS", "high", "best_practices", "The final URL is not served over HTTPS.");
    if (page.title && (page.title.length < 30 || page.title.length > 60)) add("title-length", `Title is ${page.title.length} characters`, "medium", "seo", "Titles between about 30 and 60 characters show in full in Google results.", [{ label: page.title }]);
    if (page.meta_description && (page.meta_description.length < 70 || page.meta_description.length > 160)) add("meta-description-length", `Meta description is ${page.meta_description.length} characters`, "low", "seo", "Descriptions between about 70 and 160 characters are least likely to be cut off.", [{ label: page.meta_description }]);
    if (page.h1s.length === 0) add("h1-missing", "No H1 heading on the page", "medium", "seo", "The page has no main H1 heading.");
    if (page.h1s.length > 1) add("h1-multiple", `${page.h1s.length} H1 headings on the page`, "low", "seo", "The page has more than one H1.", page.h1s.map((h: string) => ({ label: h })));
    const local = page.jsonld_types.some((t: string) => /LocalBusiness|Organization|Store|Restaurant|Service|Contractor|HomeAndConstructionBusiness|ProfessionalService|HealthAndBeautyBusiness|FoodEstablishment|SportsActivityLocation/i.test(t));
    if (!page.jsonld_types.length) add("schema-missing", "No structured data (JSON-LD)", "high", "seo", "No JSON-LD schema was found on the page.");
    else if (!local) add("schema-business-missing", "No LocalBusiness / Organization schema", "medium", "seo", `Schema types found: ${page.jsonld_types.join(", ")}.`);
    if (page.jsonld_types.includes("(invalid JSON-LD)")) add("schema-invalid", "A JSON-LD block does not parse", "high", "seo", "At least one JSON-LD script is not valid JSON, so Google ignores it.");
    if (!page.og.title || !page.og.image) add("open-graph-missing", "Open Graph tags incomplete", "low", "seo", "og:title or og:image is missing, so shared links show a poor preview.");
    if (!page.canonical) add("canonical-missing", "No canonical tag", "low", "seo", "The page does not declare its canonical URL.");
  } catch (e) {
    page.fetch_error = (e as Error).message;
  }

  const origin = (() => { try { return new URL(page.final_url || url).origin; } catch { return url.replace(/\/$/, ""); } })();
  try {
    const r = await fetch(`${origin}/robots.txt`, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
    const txt = r.ok ? (await r.text()).slice(0, 50000) : "";
    const blocks = /user-agent:\s*\*[\s\S]*?(?=user-agent:|$)/i.exec(txt)?.[0] || "";
    page.robots_txt = { status: r.status, blocks_all: /^\s*disallow:\s*\/\s*$/im.test(blocks), sitemaps: [...txt.matchAll(/^\s*sitemap:\s*(\S+)/gim)].map((m) => m[1]).slice(0, 5) };
    if (!r.ok) add("robots-txt-missing", "No robots.txt file", "low", "indexing", `robots.txt answered HTTP ${r.status}.`);
    if (page.robots_txt.blocks_all) add("robots-blocks-all", "robots.txt blocks the whole site", "critical", "indexing", "robots.txt has Disallow: / for all crawlers.");
  } catch (e) { page.robots_txt = { error: (e as Error).message }; }
  try {
    const smUrl = page.robots_txt?.sitemaps?.[0] || `${origin}/sitemap.xml`;
    const r = await fetch(smUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(10000) });
    const txt = r.ok ? (await r.text()).slice(0, 3_000_000) : "";
    page.sitemap = { url: smUrl, status: r.status, url_count: (txt.match(/<loc>/gi) || []).length };
    if (!r.ok) add("sitemap-missing", "No XML sitemap found", "medium", "indexing", `${smUrl} answered HTTP ${r.status}.`);
  } catch (e) { page.sitemap = { error: (e as Error).message }; }
  return { page, issues };
}

function health(scores: Rec): number | null {
  let sum = 0, w = 0;
  for (const [k, wt] of Object.entries(WEIGHTS)) if (typeof scores[k] === "number") { sum += scores[k] * wt; w += wt; }
  return w ? Math.round(sum / w) : null;
}

async function runOne(db: Rec, client: Rec, strategy: string, mode: string) {
  const url = siteUrl(client);
  if (!url) return { error: "No website on this client" };
  const [ps, op] = await Promise.allSettled([pageSpeed(url, strategy), onPage(url)]);
  const lh = ps.status === "fulfilled" ? ps.value : null;
  const on = op.status === "fulfilled" ? op.value : { page: {}, issues: [] };
  const lhKeys = new Set((lh?.issues || []).map((i: Rec) => i.key));
  // Drop on-page duplicates of what Lighthouse already reported.
  const dupes: Record<string, string> = { "not-https": "is-on-https", "canonical-missing": "canonical", "robots-txt-missing": "robots-txt" };
  const issues = [...(lh?.issues || []), ...on.issues.filter((i: Rec) => !lhKeys.has(dupes[i.key]))];
  const rec = {
    client_id: client.id, client_name: client.business, url, strategy, mode, source: "pagespeed",
    status: lh ? "complete" : on.page?.http_status ? "partial" : "failed",
    run_at: new Date().toISOString(),
    scores: lh?.scores || {}, health_score: lh ? health(lh.scores) : null, vitals: lh?.vitals || {},
    page: on.page, issues,
    error: ps.status === "rejected" ? `PageSpeed: ${(ps.reason as Error)?.message || ps.reason}` : "",
  };
  return db.SiteAudit.create(rec);
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== "admin") return Response.json({ error: "Admins only" }, { status: 403 });
    const body = await req.json().catch(() => ({}));
    const { action = "run" } = body || {};
    const db = base44.asServiceRole.entities;
    const strategy = body.strategy === "desktop" ? "desktop" : "mobile";

    if (action === "run") {
      const client = await db.CRMClient.get(body.client_id).catch(() => null);
      if (!client) return Response.json({ error: "Client not found" }, { status: 404 });
      const mode = body.mode === "auto" ? "auto" : "manual";
      if (isAutoBlocked(client) && (mode === "auto" || !body.force)) {
        return Response.json({ skipped: true, reason: `${client.business} is excluded from audits until the site moves off Framer.${mode === "manual" ? " Pass force to run one by hand." : ""}` });
      }
      const audit = await runOne(db, client, strategy, mode);
      return Response.json({ audit });
    }

    if (action === "run_due") {
      const maxAge = Number(body.max_age_days || 7) * 864e5;
      const limit = Math.min(Number(body.limit || 3), 5);
      const clients = (await db.CRMClient.filter({ status: "Active" }, "business", 200)) || [];
      const recent = (await db.SiteAudit.list("-run_at", 500)) || [];
      const last = new Map<string, number>();
      recent.forEach((a: Rec) => { if (!last.has(a.client_id)) last.set(a.client_id, new Date(a.run_at || a.created_date).getTime()); });
      const due = clients.filter((c: Rec) => siteUrl(c) && !isAutoBlocked(c)
        && ((c.services_managed || []).includes("orbit_seo") || (c.services_managed || []).includes("website"))
        && (Date.now() - (last.get(c.id) || 0)) > maxAge);
      const results = [];
      for (const c of due.slice(0, limit)) {
        try { const a = await runOne(db, c, strategy, "auto"); results.push({ client: c.business, id: a.id, health: a.health_score }); }
        catch (e) { results.push({ client: c.business, error: (e as Error).message }); }
      }
      return Response.json({ ran: results, remaining: Math.max(0, due.length - limit), skipped_blocked: clients.filter(isAutoBlocked).map((c: Rec) => c.business) });
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
});
