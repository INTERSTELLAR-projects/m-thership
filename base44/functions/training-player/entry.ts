// Trainee player API (public, no login). A trainee opens /t/<assignment id>?k=<access_token>; the token is per
// assignment and only unlocks that one trainee's track. Quiz answers never leave the server: they're graded here.
//   POST { action: "load", id, k }                                       -> track, modules, progress
//   POST { action: "save", id, k, module_id, lesson_done?, check?, quiz_answers?, language? } -> progress (+ quiz result)
//   POST { action: "ask",  id, k, module_id, text }                       -> question routed to the owner
// Completion (every module done; sign-off when the track needs it) writes a WorkEntry through the work-ledger normalizer.
// deno-lint-ignore-file no-explicit-any
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { playerPayload, applyPlayerSave, logTrainingWork, badgeFor, rid, clip } from "../../shared/training.ts";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const json = (b: unknown, s = 200) => Response.json(b, { status: s, headers: CORS });
const arr = (v: any) => (Array.isArray(v) ? v : []);

function same(a: string, b: string) {
  if (!a || !b || a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "load");
    const a = await db.TrainingAssignment.get(String(body?.id || "")).catch(() => null);
    if (!a || a.status === "archived" || !same(String(a.access_token || ""), String(body?.k || ""))) return json({ error: "This training link isn't valid anymore. Ask your manager for a new one." }, 404);
    const t = await db.TrainingTrack.get(String(a.track_id)).catch(() => null);
    if (!t || t.status === "archived") return json({ error: "This training track isn't available right now." }, 404);
    const mods = arr(await db.TrainingModule.filter({ track_id: t.id }, "sort", 200).catch(() => []));
    const order = arr(t.module_ids);
    mods.sort((x: any, y: any) => (order.indexOf(x.id) < 0 ? 1e6 : order.indexOf(x.id)) - (order.indexOf(y.id) < 0 ? 1e6 : order.indexOf(y.id)));
    let business = "Interstellar Strategies";
    if (t.client_id !== "agency") business = (await db.CRMClient.get(t.client_id).catch(() => null))?.business || t.client_name || "";

    if (action === "load") return json(playerPayload(t, mods, a, { reveal: false, business }));

    if (action === "save") {
      const { patch, result } = applyPlayerSave(t, mods, a, body);
      const finished = patch.status === "completed" && a.status !== "completed";
      if (finished) patch.badge = a.badge || badgeFor(t, a);
      const updated = await db.TrainingAssignment.update(a.id, patch);
      if (finished) {
        await db.TrainingTrack.update(t.id, { completions: (Number(t.completions) || 0) + 1 }).catch(() => null);
        await logTrainingWork(db, {
          client_id: t.client_id, client_name: business, task_type: "training_complete", done_by: "team", source_id: a.id, minutes_baseline: 0, visibility: "internal",
          title: `${a.trainee_name} completed training: ${t.title}`, notes: "Every module done; this track doesn't need a manager sign-off.", dedupe_key: `training:complete:${a.id}`,
        });
      }
      return json({ ...playerPayload(t, mods, updated, { reveal: false, business }), result });
    }

    if (action === "ask") {
      const text = clip(body?.text, 1500).trim();
      if (text.length < 3) return json({ error: "Type your question first." }, 400);
      if (arr(a.questions).length >= 200) return json({ error: "Too many questions on this link. Ask your manager directly." }, 429);
      const mod = mods.find((x: any) => x.id === String(body?.module_id || ""));
      const q = { id: rid("q"), module_id: mod?.id || "", module_title: mod?.title || "", text, asked_at: new Date().toISOString(), answer: "" };
      const updated = await db.TrainingAssignment.update(a.id, { questions: [...arr(a.questions), q], last_active_at: q.asked_at });
      // Interstellar's own trainees: the question also lands on Justin's task board. Client owners see it in their
      // Training manager view (open-questions badge).
      if (t.client_id === "agency") {
        await db.Task.create({
          title: `Training question from ${a.trainee_name}: ${clip(text, 80)}`, category: "ops", priority: 2, status: "next", source: "automation", task_type: "internal",
          due_date: new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" }), client_id: "",
          notes: `${t.title}${mod ? ` · ${mod.title}` : ""}\n\n${text}\n\nAnswer it in Operations > Training > People.\nOpen: /training`,
        }).catch(() => null);
      }
      return json({ ...playerPayload(t, mods, updated, { reveal: false, business }), asked: q.id });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("training-player", (e as Error)?.message);
    return json({ error: "Something went wrong. Try again in a moment." }, 500);
  }
});
