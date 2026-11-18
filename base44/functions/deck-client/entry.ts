// @ts-nocheck
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { requireSecondFactor } from "../../shared/twoFactor.ts";
import { resolveClient } from "../../shared/portalClient.ts";
import { studioState, planUnlocksStudios } from "../../shared/usagePlans.ts";

// Client portal Presentation Creator storage (Presentation entity is admin-only; this is the scoped door).
// The AI itself runs in the browser pipeline (src/features/presentations/lib/deckSchema.js) through the ai-gateway
// function (Base44 InvokeLLM, Fuel-metered, HyperCare+ + Presentations Studio "on").
//   context              brand + business facts for the deck (approved brand kit, profile, client-safe brain sections)
//   list                 this client's portal decks (title, cover slide, updated)
//   get {id} / save {id?, deck} / delete {id}   only decks made in the portal for this client
// Admin (Justin previewing a client) acts for that client.

const BRAIN_FOR_CLIENT = ["overview", "offer_pricing", "audience", "brand"];
const err = (error, status = 400, extra = {}) => Response.json({ error, ...extra }, { status });
const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o?.[k] !== undefined).map((k) => [k, o[k]]));
const SAVE_KEYS = ["title", "subtitle", "summary", "theme", "brand", "brand_source", "slides", "outline", "needs", "tone", "audience", "prompt", "generated_by"];

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return err("Not signed in", 401);
    const gate = await requireSecondFactor(base44, req, user);
    if (gate) return gate;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "list");
    const db = base44.asServiceRole.entities;
    const isAdmin = user.role === "admin";
    const client = await resolveClient(db, user, body?.client_id);
    if (!client) return err(isAdmin ? "Pick a client" : "No portal is set up for this login yet.", isAdmin ? 400 : 403, { code: "no_client" });
    if (!isAdmin && !planUnlocksStudios(client)) return err("Presentations are included with HyperCare+.", 403, { code: "studios_locked" });
    if (!isAdmin && studioState(client, "presentations") !== "on") return err("The Presentations Studio isn't switched on for your account yet.", 403, { code: "studio_off" });
    const cid = String(client.id);
    const mine = (p) => p && p.client_id === cid && p.brief?.portal === true;

    if (action === "context") {
      const first = async (e, q, s) => ((await db[e].filter(q, s, 1).catch(() => [])) || [])[0] || null;
      const [kit, dossier, brain] = await Promise.all([
        first("BrandKit", { client_id: cid, status: "approved" }, "-created_date"),
        first("ClientDossier", { client_id: cid }, "-updated_date"),
        first("BusinessBrain", { client_id: cid }, "-updated_date"),
      ]);
      const sections = {};
      for (const k of BRAIN_FOR_CLIENT) {
        const s = brain?.sections?.[k];
        if (s && String(s.text || "").trim()) sections[k] = { text: String(s.text).slice(0, 2500), updated_at: s.updated_at || "", confidence: s.confidence || "", updated_by: "profile" };
      }
      if (brain?.sections?.brand?.design_md?.text) sections.brand = { ...(sections.brand || { text: "" }), design_md: { text: String(brain.sections.brand.design_md.text).slice(0, 4000), updated_by: "profile" } };
      return Response.json({
        client: pick(client, ["id", "business", "industry", "location", "domain", "websites", "logo_url"]),
        kit: kit ? { kit: kit.kit || {}, status: kit.status } : null,
        dossier: dossier ? pick(dossier, ["elevator_pitch", "usp", "tagline", "services", "service_area", "brand_identity", "founded", "team_size", "story", "differentiators", "offers"]) : null,
        brain: Object.keys(sections).length ? { sections } : null,
      });
    }
    if (action === "list") {
      const rows = ((await db.Presentation.filter({ client_id: cid }, "-updated_date", 100).catch(() => [])) || []).filter(mine);
      return Response.json({ decks: rows.map((p) => ({ ...pick(p, ["id", "title", "subtitle", "theme", "brand", "updated_date", "created_date", "needs"]), slide_count: (p.slides || []).length, cover: (p.slides || [])[0] || null })) });
    }
    if (action === "get") {
      const p = await db.Presentation.get(String(body?.id || "")).catch(() => null);
      if (!mine(p)) return err("Deck not found", 404);
      return Response.json({ deck: p });
    }
    if (action === "save") {
      const d = body?.deck || {};
      const patch = pick(d, SAVE_KEYS);
      if (patch.slides && (!Array.isArray(patch.slides) || patch.slides.length > 40)) return err("Too many slides");
      if (JSON.stringify(patch).length > 900_000) return err("This deck is too large to save", 413);
      patch.title = String(patch.title || "Untitled deck").slice(0, 200);
      if (body?.id) {
        const p = await db.Presentation.get(String(body.id)).catch(() => null);
        if (!mine(p)) return err("Deck not found", 404);
        const brief = { ...(p.brief || {}), ...(d.brief && typeof d.brief === "object" ? d.brief : {}), portal: true };
        return Response.json({ deck: await db.Presentation.update(p.id, { ...patch, brief }) });
      }
      const brief = { ...(d.brief && typeof d.brief === "object" ? d.brief : {}), portal: true, created_by: user.email };
      return Response.json({ deck: await db.Presentation.create({ ...patch, brief, client_id: cid, client_name: client.business, generation_status: "ready" }) });
    }
    if (action === "delete") {
      const p = await db.Presentation.get(String(body?.id || "")).catch(() => null);
      if (!mine(p)) return err("Deck not found", 404);
      await db.Presentation.delete(p.id);
      return Response.json({ ok: true });
    }
    return err("Unknown action");
  } catch (e) {
    console.error("deck-client", e?.message);
    return err(e?.message || "Something went wrong", 500);
  }
});
