// @ts-nocheck
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { safeItem, fetchOgImage, addLaunched, galleryHtml, caseHtml, slugify, BUILT_LABEL } from "../../shared/portfolio.ts";

/*
 * Portfolio of launched client websites.
 * Public (no login):
 *   GET  /functions/portfolio            → Interstellar-branded gallery of PUBLISHED items (filters: industry, what we built)
 *   GET  /functions/portfolio?item=slug  → one case study
 *   POST { action: "public_list" } / { action: "public_item", slug } → same data as JSON (in-app /work page)
 * Background (workflow "Portfolio — add launched site"): { action: "on_launch", client_id } → draft card once the
 *   client's own domain is verified live (CRMClient.website_live_at). Never publishes.
 * Admin: list · save · set_status · refresh_og · sync · settings
 * Only public facts; results only when verified; client name only when show_client_name. Never mentions the platform.
 */
const err = (error: string, status = 400) => Response.json({ error }, { status });
const html = (s: string) => new Response(s, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=300" } });
const clip = (v: unknown, n = 500) => String(v ?? "").trim().slice(0, n);

async function settings(db: any) {
  const row = ((await db.AppSettings.filter({ key: "portfolio" }, "-created_date", 1).catch(() => [])) || [])[0] || null;
  const s = row?.pageSettings || {};
  return { row, noindex: s.noindex !== false };
}
async function published(db: any) {
  const rows = ((await db.PortfolioItem.filter({ status: "published" }, "sort", 200).catch(() => [])) || []) as any[];
  return rows.sort((a, b) => (Number(a.sort) || 100) - (Number(b.sort) || 100) || String(b.launched_at || "").localeCompare(String(a.launched_at || ""))).map(safeItem);
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    if (req.method === "GET") {
      const st = await settings(db);
      const items = await published(db);
      const slug = url.searchParams.get("item");
      if (slug) { const i = items.find((x) => x.slug === slug); return i ? html(caseHtml(i, st.noindex)) : html(galleryHtml(items, st.noindex)); }
      return html(galleryHtml(items, st.noindex));
    }
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "public_list");
    if (action === "public_list") { const st = await settings(db); return Response.json({ items: await published(db), noindex: st.noindex, built_labels: BUILT_LABEL }); }
    if (action === "public_item") { const i = (await published(db)).find((x) => x.slug === clip(body.slug, 80)); return i ? Response.json({ item: i }) : err("Not found", 404); }
    if (action === "on_launch") {
      // Reads only the stored client record by id; creates a draft card at most once.
      const c = await db.CRMClient.get(clip(body.client_id, 64)).catch(() => null);
      return Response.json(await addLaunched(db, c));
    }

    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== "admin") return err("Admins only", 403);
    if (action === "list") {
      const rows = ((await db.PortfolioItem.list("sort", 300).catch(() => [])) || []) as any[];
      const st = await settings(db);
      return Response.json({ items: rows, noindex: st.noindex });
    }
    if (action === "save") {
      const p = body.item || {};
      const data: any = {
        client_name: clip(p.client_name, 120), show_client_name: p.show_client_name !== false, industry: clip(p.industry, 80), industry_key: clip(p.industry_key, 60),
        url: /^https:\/\//i.test(String(p.url || "")) ? clip(p.url, 300) : "", description: clip(p.description, 200), objective: clip(p.objective, 600),
        built: (Array.isArray(p.built) ? p.built : []).filter((b: string) => BUILT_LABEL[b]), highlights: (Array.isArray(p.highlights) ? p.highlights : []).map((h: any) => clip(h, 240)).filter(Boolean).slice(0, 4),
        // Results keep their verification: a row only shows publicly with verified_by + source.
        results: (Array.isArray(p.results) ? p.results : []).filter((r: any) => r && clip(r.text, 240)).slice(0, 6).map((r: any) => ({ text: clip(r.text, 240), source: clip(r.source, 160), verified_by: r.verified ? user.email : clip(r.verified_by, 120), verified_at: r.verified ? new Date().toISOString() : r.verified_at || null })),
        image_desktop: /^https:\/\//.test(String(p.image_desktop || "")) ? clip(p.image_desktop, 600) : "", image_phone: /^https:\/\//.test(String(p.image_phone || "")) ? clip(p.image_phone, 600) : "",
        sort: Number(p.sort) || 100,
      };
      if (!data.client_name || !data.url) return err("Add the name and the https:// live URL.");
      data.domain = data.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
      if (!p.id) Object.assign(data, { slug: slugify(data.client_name), status: "draft", source: "manual", launched_at: p.launched_at || new Date().toISOString(), og_image: await fetchOgImage(data.url), og_checked_at: new Date().toISOString() });
      const row = p.id ? await db.PortfolioItem.update(clip(p.id, 64), data) : await db.PortfolioItem.create(data);
      return Response.json({ item: row });
    }
    if (action === "set_status") {
      const status = ["draft", "published", "hidden"].includes(body.status) ? body.status : "draft";
      const row = await db.PortfolioItem.update(clip(body.id, 64), { status, ...(status === "published" ? { published_at: new Date().toISOString() } : {}) });
      return Response.json({ item: row });
    }
    if (action === "refresh_og") {
      const ids = (Array.isArray(body.ids) ? body.ids : [body.id]).map((x: any) => clip(x, 64)).filter(Boolean).slice(0, 20);
      const out: any[] = [];
      for (const id of ids) {
        const i = await db.PortfolioItem.get(id).catch(() => null);
        if (!i) continue;
        const og = await fetchOgImage(i.url);
        await db.PortfolioItem.update(id, { og_image: og, og_checked_at: new Date().toISOString() });
        out.push({ id, og_image: og });
      }
      return Response.json({ results: out });
    }
    if (action === "sync") {
      const clients = ((await db.CRMClient.filter({ status: "Active" }, "business", 500).catch(() => [])) || []) as any[];
      const res: any[] = [];
      for (const c of clients.filter((x) => x.website_live_at)) res.push({ client: c.business, ...(await addLaunched(db, c)) });
      return Response.json({ results: res });
    }
    if (action === "settings") {
      const st = await settings(db);
      if (typeof body.noindex === "boolean") {
        const ps = { ...(st.row?.pageSettings || {}), noindex: body.noindex };
        if (st.row) await db.AppSettings.update(st.row.id, { pageSettings: ps }); else await db.AppSettings.create({ key: "portfolio", pageSettings: ps });
        return Response.json({ noindex: body.noindex });
      }
      return Response.json({ noindex: st.noindex });
    }
    return err("Unknown action");
  } catch (e) {
    return Response.json({ error: String(e?.message || e).slice(0, 300) }, { status: 500 });
  }
});
