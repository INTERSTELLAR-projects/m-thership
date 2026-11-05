// People > Training: tracks, modules, assignments, grounded drafting and the manager view.
// Callers: Justin (admin, any scope: client_id "agency" = Interstellar, or a CRMClient id) and portal owners (their own
// client only, Training Studio: HyperCare+ and switched on in Client usage, like every other Studio).
//   overview        {}                                   tracks + assignments (with overdue / stuck / open questions)
//   track           { track_id }                         track + ordered modules (owner view: answers, quotes, gaps)
//   save_track      { track }                            create / update (title, description, role, status, es_enabled, pass_score, requires_signoff)
//   delete_track    { track_id }                         track + modules removed, its assignments archived
//   save_module     { module }                           create / update one module (owner edits mark it reviewed)
//   delete_module   { module_id }
//   reorder         { track_id, module_ids }
//   templates       {}                                   role templates (outline, needs SOPs)
//   from_template   { template_key, title? }             outline track, every module marked "needs SOPs"
//   sources         {}                                   SOPs / documents this caller may draft from
//   draft           { source_ids[], pasted?, role, title?, template_key?, notes?, track_id? }
//                   AI drafts modules grounded ONLY in those sources, through the ai-gateway (house rules, metered
//                   against the client's Fuel). Every point / task / quiz answer must quote its source; code drops what
//                   it can't trace and records the gaps.
//   translate       { module_id }                        Spanish draft (ai-gateway, routine tier) for owner review
//   approve_es      { module_id, es? }                   owner-reviewed Spanish (optionally edited) goes live
//   assign          { track_id, trainee_name, trainee_email?, start_date?, due_date?, language?, source?, hire_key? }
//   update_assignment { assignment_id, due_date?, module_due?, archive? }
//   signoff         { assignment_id, note? }             manager sign-off (completes the track when every module is done)
//   answer          { assignment_id, question_id, answer }
//   player          { assignment_id? | track_id }        owner preview of the trainee player (answers revealed)
// WorkEntry ledger rows are written when a track is built and when a trainee completes one.
// deno-lint-ignore-file no-explicit-any
import { createClientFromRequest } from "npm:@base44/sdk@0.8.54";
import { requireSecondFactor } from "../../shared/twoFactor.ts";
import { resolveClient, getSecret } from "../../shared/portalClient.ts";
import { planUnlocksStudios, studioState } from "../../shared/usagePlans.ts";
import { callClaude, AnthropicError } from "../../shared/anthropic.ts";
import { check, record } from "../../shared/meter.ts";
import { estimateAiCost, monthKey, AI_MODELS } from "../../shared/usagePlans.ts";
import { loadFuelConfig, weightFor } from "../../shared/fuel.ts";
import {
  ROLES, templateList, templateModules, ROLE_TEMPLATES, DRAFT_SYSTEM, DRAFT_SCHEMA, draftPrompt, groundDraft,
  TRANSLATE_SYSTEM, TRANSLATE_SCHEMA, translatePrompt, checkTranslation, computeProgress, flags, playerPayload,
  logTrainingWork, rid, token, today, clip, badgeFor,
} from "../../shared/training.ts";

const arr = (v: any) => (Array.isArray(v) ? v : (v && v.items) || []);
const err = (error: string, status = 400, extra: Record<string, unknown> = {}) => Response.json({ error, ...extra }, { status });
const MAX_SOURCE_CHARS = 60_000;

async function all(ent: any, q: any, sort = "-created_date", max = 2000) {
  const out: any[] = [];
  for (let skip = 0; skip < max; skip += 500) {
    const rows = arr(await ent.filter(q, sort, 500, skip).catch(() => []));
    out.push(...rows);
    if (rows.length < 500) break;
  }
  return out;
}

function sopText(t: any) {
  const lines = [t.description ? String(t.description) : ""];
  let phase = "";
  for (const i of arr(t.items)) {
    if ((i.phase || "") !== phase) { phase = i.phase || ""; if (phase) lines.push(`Phase: ${phase}`); }
    lines.push(`- ${i.title}${i.notes ? ` (${i.notes})` : ""}`);
  }
  return lines.filter(Boolean).join("\n");
}
const brainText = (s: any) => (typeof s === "string" ? s : String(s?.text || ""));

// AI through the ai-gateway as the caller (house rules, Fuel metering, model routing). When the forwarded call can't
// reach the gateway (lost 2-step session header, transport error) the same shared meter + Anthropic path runs here.
async function ai(base44: any, db: any, user: any, client: any, args: { tier: "routine" | "long"; feature: string; system: string; prompt: string; schema: any; max_tokens: number }) {
  const payload = { action: "complete", tier: args.tier, feature: args.feature, studio: "training", system: args.system, prompt: args.prompt, response_json_schema: args.schema, max_tokens: args.max_tokens, ...(client ? { client_id: client.id } : {}) };
  try {
    const r = await base44.functions.invoke("ai-gateway", payload);
    const d = r?.data || r;
    if (d?.json) return { json: d.json, meter: d.meter || null };
    throw Object.assign(new Error(d?.error || "No reply"), { status: 502, data: d });
  } catch (e: any) {
    const status = e?.response?.status || e?.status || 0;
    const data = e?.response?.data || e?.data || {};
    if (status && status !== 428 && status < 500) throw Object.assign(new Error(data?.error || e.message), { status, code: data?.code, meter: data?.meter });
    if (status >= 500 && data?.code) throw Object.assign(new Error(data?.error || e.message), { status, code: data.code });
  }
  // Fallback: identical rules, in process.
  const key = getSecret("ANTHROPIC_API_KEY");
  if (!key) throw Object.assign(new Error("Drafting isn't configured yet. Interstellar has been notified."), { status: 503, code: "ai_not_configured" });
  const isAdmin = user.role === "admin";
  const cfg = await loadFuelConfig(db);
  if (client) {
    const c = await check(db, client, "ai_action", weightFor(args.tier === "long" ? AI_MODELS.long.id : AI_MODELS.routine.id, 0, args.feature, cfg), { admin: isAdmin, feature: args.feature });
    if (!c.ok) throw Object.assign(new Error(c.reason || "Out of fuel"), { status: 429, code: c.code, meter: c });
  }
  const out = await callClaude({ key, tier: args.tier, system: args.system, prompt: args.prompt, schema: args.schema, max_tokens: args.max_tokens });
  const est = estimateAiCost(out.model, out.input_tokens, out.output_tokens);
  const units = weightFor(out.model, out.input_tokens, args.feature, cfg);
  if (client) await record(db, client, "ai_action", units, { admin: isAdmin, model: out.model, est_cost_usd: est, feature: args.feature, user_email: user.email, input_tokens: out.input_tokens, output_tokens: out.output_tokens, calls: 1 });
  else await db.UsageLedger.create({ client_id: "agency", client_name: "Interstellar (admin)", month: monthKey(), kind: "ai_action", units, calls: 1, model: out.model, est_cost_usd: est, feature: args.feature, user_email: user.email, by_admin: true, input_tokens: out.input_tokens, output_tokens: out.output_tokens, created_at: new Date().toISOString() }).catch(() => null);
  return { json: out.json, meter: null };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (!user) return err("Not signed in", 401);
    const gate = await requireSecondFactor(base44, req, user);
    if (gate) return gate;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "overview");
    const db = base44.asServiceRole.entities;
    const isAdmin = user.role === "admin";

    // ---- scope
    let client: any = null;
    let cid = "agency";
    if (isAdmin) {
      const want = String(body?.client_id || "agency");
      if (want !== "agency") {
        client = await db.CRMClient.get(want).catch(() => null);
        if (!client) return err("Client not found", 404);
        cid = client.id;
      }
    } else {
      client = await resolveClient(db, user, body?.client_id);
      if (!client) return err("No portal is set up for this login yet.", 403, { code: "no_client" });
      cid = client.id;
      if (!planUnlocksStudios(client)) return err("Training is included with HyperCare+. Ask us about upgrading from your portal.", 403, { code: "studios_locked" });
      if (studioState(client, "training") !== "on") return err("Training isn't switched on for your account yet.", 403, { code: "studio_off" });
    }
    const scope: "agency" | "client" = cid === "agency" ? "agency" : "client";
    const business = scope === "agency" ? "Interstellar Strategies" : String(client?.business || "");
    const via = isAdmin ? "admin" : "portal";

    const getTrack = async (id: unknown) => {
      const t = await db.TrainingTrack.get(String(id || "")).catch(() => null);
      return t && t.client_id === cid ? t : null;
    };
    const getModules = async (t: any) => {
      const rows = await all(db.TrainingModule, { track_id: t.id }, "sort");
      const order = arr(t.module_ids);
      return rows.sort((a: any, b: any) => {
        const ia = order.indexOf(a.id), ib = order.indexOf(b.id);
        return (ia < 0 ? 1e6 + (a.sort || 0) : ia) - (ib < 0 ? 1e6 + (b.sort || 0) : ib);
      });
    };
    const getAssignment = async (id: unknown) => {
      const a = await db.TrainingAssignment.get(String(id || "")).catch(() => null);
      return a && a.client_id === cid ? a : null;
    };
    const createModules = async (track: any, mods: any[]) => {
      const ids: string[] = [];
      for (const [i, mo] of mods.entries()) {
        const row = await db.TrainingModule.create({ ...mo, sort: i, track_id: track.id, client_id: cid });
        ids.push(row.id);
      }
      return ids;
    };
    const logBuilt = async (track: any, how: "drafted" | "template", modCount: number) => {
      const clientVisible = isAdmin && scope === "client";
      await logTrainingWork(db, {
        client_id: cid, client_name: business, task_type: "training_track", source_id: track.id,
        title: `Training track ${how === "drafted" ? "drafted from SOPs" : "created from the role template"}: ${track.title} (${modCount} modules)`,
        notes: `${track.role_label || ROLES[track.role] || ""}. Built in ${via === "admin" ? "Møthership" : "the client portal"} by ${user.email}.`,
        done_by: how === "drafted" ? "agent" : isAdmin ? "justin_manual" : "team", agent_name: how === "drafted" ? "Training drafter" : undefined,
        dedupe_key: `training:track:${track.id}:${how}`,
        visibility: clientVisible ? "client" : "internal",
        ...(clientVisible ? { client_title: `We built the "${clip(track.title, 40)}" training track for your team`, client_summary: "New team members can now learn your processes step by step, with hands-on tasks and quick checks along the way." } : {}),
        ...(how === "template" ? { minutes_baseline: 30 } : {}),
      });
    };

    // ------------------------------------------------------------ reads
    if (action === "overview") {
      const [tracks, assigns, mods] = await Promise.all([
        all(db.TrainingTrack, { client_id: cid }, "-updated_date"),
        all(db.TrainingAssignment, { client_id: cid }, "-updated_date"),
        all(db.TrainingModule, { client_id: cid }, "sort", 4000),
      ]);
      const byTrack = new Map<string, any[]>();
      for (const mo of mods) byTrack.set(mo.track_id, [...(byTrack.get(mo.track_id) || []), mo]);
      const trackOut = tracks.filter((t: any) => t.status !== "archived" || body?.include_archived).map((t: any) => {
        const ms = byTrack.get(t.id) || [];
        const asg = assigns.filter((a: any) => a.track_id === t.id && a.status !== "archived");
        return {
          id: t.id, title: t.title, description: t.description || "", role: t.role, role_label: t.role_label || ROLES[t.role] || "", status: t.status,
          es_enabled: !!t.es_enabled, modules: ms.length, needs_sops: ms.filter((x: any) => x.needs_sops).length,
          minutes: ms.reduce((s: number, x: any) => s + (Number(x.est_minutes) || 0), 0), gaps: arr(t.gaps).length + ms.reduce((s: number, x: any) => s + arr(x.gaps).length, 0),
          es_approved: ms.filter((x: any) => x.es?.status === "approved").length, active: asg.filter((a: any) => a.status !== "completed").length,
          completed: asg.filter((a: any) => a.status === "completed").length, created_via: t.created_via, updated_date: t.updated_date, template_key: t.template_key || "",
          hiring_role_key: t.hiring_role_key || "",
        };
      });
      const titles = new Map(tracks.map((t: any) => [t.id, t.title]));
      const assignOut = assigns.filter((a: any) => a.status !== "archived").map((a: any) => {
        const ms = byTrack.get(a.track_id) || [];
        return {
          id: a.id, track_id: a.track_id, track_title: titles.get(a.track_id) || a.track_title || "", trainee_name: a.trainee_name, trainee_email: a.trainee_email || "",
          language: a.language || "en", start_date: a.start_date || "", due_date: a.due_date || "", pct: a.pct || 0, status: a.status, started_at: a.started_at || "",
          last_active_at: a.last_active_at || "", completed_at: a.completed_at || "", signoff: a.signoff || null, badge: a.badge || null, source: a.source || "manual", hire_key: a.hire_key || "",
          questions: arr(a.questions), access_token: a.access_token, module_due: a.module_due || {},
          modules: ms.map((x: any) => {
            const p = (a.progress || {})[x.id] || {};
            return { id: x.id, title: x.title, required: x.required !== false, quiz: arr(x.quiz).length, lesson_done: !!p.lesson_done, checks: Object.values(p.checks || {}).filter(Boolean).length, checklist: arr(x.checklist).length, quiz_score: p.quiz_score ?? null, last_score: p.last_score ?? null, attempts: p.attempts || 0, quiz_passed: !!p.quiz_passed, completed_at: p.completed_at || "" };
          }),
          ...flags(a),
        };
      });
      return Response.json({ scope, client_id: cid, business, tracks: trackOut, assignments: assignOut, can_edit: true, roles: ROLES });
    }

    if (action === "track") {
      const t = await getTrack(body.track_id);
      if (!t) return err("Track not found", 404);
      return Response.json({ track: t, modules: await getModules(t), roles: ROLES });
    }

    if (action === "templates") return Response.json({ templates: templateList(scope) });

    if (action === "sources") {
      const out: any[] = [];
      const sops = await all(db.TaskTemplate, {}, "sort_order");
      for (const t of sops) {
        if (!isAdmin && !arr(t.portal_client_ids).includes(cid)) continue;
        out.push({ id: `sop:${t.id}`, type: "sop", title: `${t.sop_code ? t.sop_code + " · " : ""}${t.name}`, detail: `${arr(t.items).length} steps${t.description ? ` · ${clip(t.description, 120)}` : ""}`, group: "SOPs" });
      }
      if (scope === "client") {
        const files = await all(db.ClientFile, { client_id: cid }, "-created_date");
        for (const f of files) {
          if (!isAdmin && f.portal_visible === false) continue;
          if (!f.description) continue;
          out.push({ id: `file:${f.id}`, type: "client_file", title: f.title, detail: `${f.category || "file"} · description only`, group: "Your documents" });
        }
        if (isAdmin) {
          const brain = arr(await db.BusinessBrain.filter({ client_id: cid }, "-updated_date", 1).catch(() => []))[0];
          for (const [k, v] of Object.entries(brain?.sections || {})) {
            const text = brainText(v);
            if (text.trim().length > 40) out.push({ id: `brain:${k}`, type: "brain", title: `Business Brain · ${k.replace(/_/g, " ")}`, detail: clip(text, 120), group: "Business Brain" });
          }
        }
      } else {
        const plan = arr(await db.HiringPlan.filter({ key: "primary" }, "-updated_date", 1).catch(() => []))[0];
        for (const b of arr(plan?.blocks)) {
          if (["job_description", "ramp", "growth", "interview"].includes(b.key)) out.push({ id: `hiring:${b.key}`, type: "hiring", title: `Hiring plan · ${b.title}`, detail: clip(String(b.body || "").replace(/[#\n]+/g, " "), 120), group: "Hiring plan" });
        }
        const brain = arr(await db.BusinessBrain.filter({ scope: "interstellar" }, "-updated_date", 1).catch(() => []))[0];
        for (const [k, v] of Object.entries(brain?.sections || {})) {
          const text = brainText(v);
          if (text.trim().length > 40) out.push({ id: `brain:${k}`, type: "brain", title: `Interstellar Brain · ${k.replace(/_/g, " ")}`, detail: clip(text, 120), group: "Business Brain" });
        }
      }
      return Response.json({ sources: out, paste_allowed: true });
    }

    if (action === "player") {
      let a: any = null;
      let t: any = null;
      if (body.assignment_id) { a = await getAssignment(body.assignment_id); if (!a) return err("Assignment not found", 404); t = await getTrack(a.track_id); }
      else t = await getTrack(body.track_id);
      if (!t) return err("Track not found", 404);
      return Response.json({ ...playerPayload(t, await getModules(t), a, { reveal: true, business }), preview: true });
    }

    // ------------------------------------------------------------ writes: tracks + modules
    if (action === "save_track") {
      const v = body.track || {};
      const fields: any = {};
      for (const k of ["title", "description", "role_label"]) if (v[k] !== undefined) fields[k] = clip(v[k], k === "description" ? 2000 : 160);
      if (v.role !== undefined) fields.role = ROLES[v.role] ? v.role : "custom";
      if (v.status !== undefined && ["draft", "needs_sops", "published", "archived"].includes(v.status)) {
        fields.status = v.status;
        if (v.status === "published") fields.published_at = new Date().toISOString();
      }
      for (const k of ["es_enabled", "requires_signoff"]) if (typeof v[k] === "boolean") fields[k] = v[k];
      if (v.pass_score !== undefined) fields.pass_score = Math.min(100, Math.max(0, Number(v.pass_score) || 80));
      if (v.id) {
        const t = await getTrack(v.id);
        if (!t) return err("Track not found", 404);
        return Response.json({ track: await db.TrainingTrack.update(t.id, fields) });
      }
      if (!fields.title) return err("Give the track a title");
      const t = await db.TrainingTrack.create({ client_id: cid, client_name: business, status: "draft", module_ids: [], created_via: via, created_by: user.email, pass_score: 80, requires_signoff: true, ...fields });
      return Response.json({ track: t });
    }

    if (action === "delete_track") {
      const t = await getTrack(body.track_id);
      if (!t) return err("Track not found", 404);
      for (const mo of await all(db.TrainingModule, { track_id: t.id })) await db.TrainingModule.delete(mo.id).catch(() => null);
      for (const a of await all(db.TrainingAssignment, { track_id: t.id })) await db.TrainingAssignment.update(a.id, { status: "archived" }).catch(() => null);
      await db.TrainingTrack.delete(t.id);
      return Response.json({ ok: true });
    }

    if (action === "save_module") {
      const v = body.module || {};
      const t = await getTrack(v.track_id || (v.id ? (await db.TrainingModule.get(String(v.id)).catch(() => null))?.track_id : ""));
      if (!t) return err("Track not found", 404);
      const fields: any = {};
      if (v.title !== undefined) fields.title = clip(v.title, 120);
      if (v.summary !== undefined) fields.summary = clip(v.summary, 400);
      if (v.lesson_md !== undefined) fields.lesson_md = clip(v.lesson_md, 40000);
      if (Array.isArray(v.embeds)) fields.embeds = v.embeds.slice(0, 12).filter((e: any) => /^https:\/\/\S+$/i.test(String(e?.url || ""))).map((e: any) => ({ type: e.type === "image" ? "image" : "video", url: clip(e.url, 1000), caption: clip(e.caption, 200) }));
      if (Array.isArray(v.sop_refs)) fields.sop_refs = v.sop_refs.slice(0, 12).map((r: any) => ({ type: clip(r.type, 20), id: clip(r.id, 80), title: clip(r.title, 160) }));
      if (Array.isArray(v.checklist)) fields.checklist = v.checklist.slice(0, 20).filter((c: any) => String(c?.text || "").trim()).map((c: any, i: number) => ({ ...c, id: clip(c.id, 20) || `c${i + 1}_${rid()}`, text: clip(c.text, 300) }));
      if (Array.isArray(v.quiz)) fields.quiz = v.quiz.slice(0, 10).filter((q: any) => String(q?.question || "").trim() && arr(q.options).length >= 2).map((q: any, i: number) => {
        const options = arr(q.options).slice(0, 5).map((o: any) => clip(o, 200));
        return { ...q, id: clip(q.id, 20) || `q${i + 1}_${rid()}`, question: clip(q.question, 300), options, answer_index: Math.min(options.length - 1, Math.max(0, Number(q.answer_index) || 0)), explanation: clip(q.explanation, 400) };
      });
      if (v.est_minutes !== undefined) fields.est_minutes = Math.min(240, Math.max(1, Number(v.est_minutes) || 15));
      if (typeof v.required === "boolean") fields.required = v.required;
      if (Array.isArray(v.gaps)) fields.gaps = v.gaps.map((g: any) => clip(g, 300)).filter(Boolean).slice(0, 20);
      if (typeof v.needs_sops === "boolean") fields.needs_sops = v.needs_sops;
      fields.reviewed = true;
      // Content changed after a Spanish version was approved: it goes back to the owner for review.
      if (v.id) {
        const cur = await db.TrainingModule.get(String(v.id)).catch(() => null);
        if (!cur || cur.track_id !== t.id) return err("Module not found", 404);
        if (cur.es?.status === "approved" && ["title", "lesson_md", "checklist", "quiz"].some((k) => fields[k] !== undefined && JSON.stringify(fields[k]) !== JSON.stringify(cur[k]))) fields.es = { ...cur.es, status: "draft", stale: true };
        return Response.json({ module: await db.TrainingModule.update(cur.id, fields) });
      }
      if (!fields.title) return err("Give the module a title");
      const mo = await db.TrainingModule.create({ track_id: t.id, client_id: cid, sort: arr(t.module_ids).length, checklist: [], quiz: [], embeds: [], sop_refs: [], est_minutes: 15, required: true, ...fields });
      await db.TrainingTrack.update(t.id, { module_ids: [...arr(t.module_ids), mo.id] });
      return Response.json({ module: mo });
    }

    if (action === "delete_module") {
      const mo = await db.TrainingModule.get(String(body.module_id || "")).catch(() => null);
      const t = mo ? await getTrack(mo.track_id) : null;
      if (!mo || !t) return err("Module not found", 404);
      await db.TrainingModule.delete(mo.id);
      await db.TrainingTrack.update(t.id, { module_ids: arr(t.module_ids).filter((x: string) => x !== mo.id) });
      return Response.json({ ok: true });
    }

    if (action === "reorder") {
      const t = await getTrack(body.track_id);
      if (!t) return err("Track not found", 404);
      const mine = new Set((await getModules(t)).map((x: any) => x.id));
      const ids = arr(body.module_ids).map(String).filter((x: string) => mine.has(x));
      for (const x of mine) if (!ids.includes(x)) ids.push(x);
      return Response.json({ track: await db.TrainingTrack.update(t.id, { module_ids: ids }) });
    }

    if (action === "from_template") {
      const tpl = ROLE_TEMPLATES[String(body.template_key || "")];
      if (!tpl || (tpl.agency_only && scope !== "agency")) return err("Unknown template");
      const t = await db.TrainingTrack.create({
        client_id: cid, client_name: business, role: tpl.key, role_label: tpl.label, title: clip(body.title, 160) || `${tpl.label} onboarding`,
        description: tpl.description, status: "needs_sops", template_key: tpl.key, created_via: via, created_by: user.email, module_ids: [], pass_score: 80, requires_signoff: true,
        gaps: ["Outline only: every module needs your SOPs. Add them, then use Build from SOPs, or write each lesson yourself."],
      });
      const ids = await createModules(t, templateModules(tpl.key));
      const track = await db.TrainingTrack.update(t.id, { module_ids: ids });
      await logBuilt(track, "template", ids.length);
      return Response.json({ track });
    }

    // ------------------------------------------------------------ AI: grounded drafting + translation
    if (action === "draft") {
      const want = arr(body.source_ids).map(String).slice(0, 12);
      const pasted = body.pasted && String(body.pasted.text || "").trim().length > 40 ? { title: clip(body.pasted.title, 120) || "Pasted process", text: clip(body.pasted.text, 30000) } : null;
      if (!want.length && !pasted) return err("Pick at least one SOP or document, or paste a process.");
      const sources: { id: string; title: string; text: string; ref: any }[] = [];
      const sopIds = want.filter((x) => x.startsWith("sop:")).map((x) => x.slice(4));
      for (const id of sopIds) {
        const t = await db.TaskTemplate.get(id).catch(() => null);
        if (!t || (!isAdmin && !arr(t.portal_client_ids).includes(cid))) continue;
        sources.push({ id: `S${sources.length + 1}`, title: `${t.sop_code ? t.sop_code + " " : ""}${t.name}`, text: sopText(t), ref: { type: "sop", id: t.id, title: `${t.sop_code ? t.sop_code + " · " : ""}${t.name}` } });
      }
      for (const id of want.filter((x) => x.startsWith("file:")).map((x) => x.slice(5))) {
        const f = await db.ClientFile.get(id).catch(() => null);
        if (!f || f.client_id !== cid || (!isAdmin && f.portal_visible === false)) continue;
        sources.push({ id: `S${sources.length + 1}`, title: f.title, text: `${f.title}\n${f.description || ""}`, ref: { type: "client_file", id: f.id, title: f.title } });
      }
      const brainKeys = want.filter((x) => x.startsWith("brain:")).map((x) => x.slice(6));
      if (brainKeys.length && isAdmin) {
        const brain = arr(await db.BusinessBrain.filter(scope === "agency" ? { scope: "interstellar" } : { client_id: cid }, "-updated_date", 1).catch(() => []))[0];
        for (const k of brainKeys) {
          const text = brainText(brain?.sections?.[k]);
          if (text.trim()) sources.push({ id: `S${sources.length + 1}`, title: `Business Brain: ${k.replace(/_/g, " ")}`, text, ref: { type: "brain", id: k, title: `Business Brain · ${k.replace(/_/g, " ")}` } });
        }
      }
      const hiringKeys = want.filter((x) => x.startsWith("hiring:")).map((x) => x.slice(7));
      if (hiringKeys.length && isAdmin && scope === "agency") {
        const plan = arr(await db.HiringPlan.filter({ key: "primary" }, "-updated_date", 1).catch(() => []))[0];
        for (const k of hiringKeys) {
          const b = arr(plan?.blocks).find((x: any) => x.key === k);
          if (b?.body) sources.push({ id: `S${sources.length + 1}`, title: `Hiring plan: ${b.title}`, text: String(b.body), ref: { type: "hiring", id: k, title: `Hiring plan · ${b.title}` } });
        }
      }
      if (pasted) sources.push({ id: `S${sources.length + 1}`, title: pasted.title, text: pasted.text, ref: { type: "pasted", id: "", title: pasted.title } });
      if (!sources.length) return err("None of the picked sources could be read.");
      let total = 0;
      for (const s of sources) { s.text = s.text.slice(0, Math.max(0, MAX_SOURCE_CHARS - total)); total += s.text.length; }

      const tpl = ROLE_TEMPLATES[String(body.template_key || "")];
      const role = ROLES[String(body.role || "")] ? String(body.role) : tpl?.key || "custom";
      const roleLabel = clip(body.role_label, 120) || tpl?.label || ROLES[role];
      let out: any;
      try {
        const r = await ai(base44, db, user, client, {
          tier: "long", feature: "training_draft", system: DRAFT_SYSTEM, schema: DRAFT_SCHEMA, max_tokens: 16000,
          prompt: draftPrompt(sources, { role: roleLabel, title: body.title, structure: tpl && (!tpl.agency_only || scope === "agency") ? tpl.modules : undefined, business, notes: body.notes }),
        });
        out = r.json;
      } catch (e: any) {
        if (e instanceof AnthropicError) return err(e.message, 502, { code: "ai_error" });
        return err(e.message || "Drafting failed", e.status || 500, { code: e.code, meter: e.meter });
      }
      const g = groundDraft(out, sources);
      if (!g.modules.length) return err("Nothing in those sources could be turned into training. Pick SOPs with more steps, or paste the process.", 422, { gaps: g.gaps });
      const allGaps = [...g.gaps];
      let t: any = body.track_id ? await getTrack(body.track_id) : null;
      const fields = {
        role, role_label: roleLabel, description: t?.description || g.description, source_refs: sources.map((s) => s.ref), gaps: allGaps,
        status: g.modules.some((x: any) => x.needs_sops) ? "needs_sops" : "draft", drafted_at: new Date().toISOString(), template_key: tpl?.key || t?.template_key || "",
      };
      if (t) {
        for (const mo of await all(db.TrainingModule, { track_id: t.id })) await db.TrainingModule.delete(mo.id).catch(() => null);
        t = await db.TrainingTrack.update(t.id, { ...fields, title: t.title || g.title });
      } else {
        t = await db.TrainingTrack.create({ client_id: cid, client_name: business, title: clip(body.title, 160) || g.title || `${roleLabel} onboarding`, created_via: via, created_by: user.email, module_ids: [], pass_score: 80, requires_signoff: true, ...fields });
      }
      const ids = await createModules(t, g.modules);
      t = await db.TrainingTrack.update(t.id, { module_ids: ids });
      await logBuilt(t, "drafted", ids.length);
      return Response.json({ track: t, dropped: g.dropped, gaps: allGaps, modules: ids.length });
    }

    if (action === "translate") {
      const mo = await db.TrainingModule.get(String(body.module_id || "")).catch(() => null);
      const t = mo ? await getTrack(mo.track_id) : null;
      if (!mo || !t) return err("Module not found", 404);
      let es: any;
      try {
        es = (await ai(base44, db, user, client, { tier: "routine", feature: "training_translate", system: TRANSLATE_SYSTEM, schema: TRANSLATE_SCHEMA, max_tokens: 8000, prompt: translatePrompt(mo) })).json;
      } catch (e: any) {
        if (e instanceof AnthropicError) return err(e.message, 502, { code: "ai_error" });
        return err(e.message || "Translation failed", e.status || 500, { code: e.code, meter: e.meter });
      }
      if (!checkTranslation(mo, es)) return err("The Spanish draft didn't line up with the module (items were added or missing). Try again.", 502);
      const row = { title: clip(es.title, 120), summary: clip(es.summary, 400), lesson_md: clip(es.lesson_md, 40000), checklist: arr(es.checklist).map((c: any, i: number) => ({ id: mo.checklist[i].id, text: clip(c.text, 300) })), quiz: arr(es.quiz).map((q: any, i: number) => ({ id: mo.quiz[i].id, question: clip(q.question, 300), options: arr(q.options).map((o: any) => clip(o, 200)), explanation: clip(q.explanation, 400) })), status: "draft", translated_at: new Date().toISOString() };
      return Response.json({ module: await db.TrainingModule.update(mo.id, { es: row }) });
    }

    if (action === "approve_es") {
      const mo = await db.TrainingModule.get(String(body.module_id || "")).catch(() => null);
      const t = mo ? await getTrack(mo.track_id) : null;
      if (!mo || !t || !mo.es) return err("Nothing to approve", 404);
      const ed = body.es || {};
      const es = { ...mo.es };
      for (const k of ["title", "summary", "lesson_md"]) if (typeof ed[k] === "string") es[k] = clip(ed[k], k === "lesson_md" ? 40000 : 400);
      if (Array.isArray(ed.checklist) && ed.checklist.length === arr(mo.checklist).length) es.checklist = ed.checklist.map((c: any, i: number) => ({ id: mo.checklist[i].id, text: clip(c.text, 300) }));
      if (Array.isArray(ed.quiz) && ed.quiz.length === arr(mo.quiz).length) es.quiz = ed.quiz.map((q: any, i: number) => ({ id: mo.quiz[i].id, question: clip(q.question, 300), options: arr(q.options).slice(0, arr(mo.quiz[i].options).length).map((o: any) => clip(o, 200)), explanation: clip(q.explanation, 400) }));
      es.status = body.unapprove ? "draft" : "approved";
      es.stale = false;
      es.approved_at = body.unapprove ? null : new Date().toISOString();
      es.approved_by = user.email;
      return Response.json({ module: await db.TrainingModule.update(mo.id, { es }) });
    }

    // ------------------------------------------------------------ assignments + manager actions
    if (action === "assign") {
      const t = await getTrack(body.track_id);
      if (!t) return err("Track not found", 404);
      const name = clip(body.trainee_name, 120).trim();
      if (!name) return err("Add the trainee's name");
      const email = clip(body.trainee_email, 200).trim().toLowerCase();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return err("That email doesn't look right");
      const due = /^\d{4}-\d{2}-\d{2}$/.test(String(body.due_date || "")) ? body.due_date : "";
      const start = /^\d{4}-\d{2}-\d{2}$/.test(String(body.start_date || "")) ? body.start_date : today();
      // Spread module due dates evenly between start and the track due date.
      const mods = await getModules(t);
      const module_due: Record<string, string> = {};
      if (due && mods.length) {
        const s = Date.parse(start + "T12:00:00Z"), d = Date.parse(due + "T12:00:00Z");
        mods.forEach((x: any, i: number) => { module_due[x.id] = new Date(s + ((d - s) * (i + 1)) / mods.length).toISOString().slice(0, 10); });
      }
      const a = await db.TrainingAssignment.create({
        track_id: t.id, track_title: t.title, client_id: cid, trainee_name: name, trainee_email: email, language: body.language === "es" && t.es_enabled ? "es" : "en",
        start_date: start, due_date: due, module_due, progress: {}, pct: 0, status: "not_started", questions: [], access_token: token(), assigned_by: user.email,
        source: body.source === "hiring_plan" ? "hiring_plan" : "manual", hire_key: clip(body.hire_key, 80), current_module_id: mods[0]?.id || "",
      });
      if (t.status === "draft") await db.TrainingTrack.update(t.id, { status: "published", published_at: new Date().toISOString() }).catch(() => null);
      return Response.json({ assignment: { id: a.id, access_token: a.access_token, path: `/t/${a.id}?k=${a.access_token}` } });
    }

    if (action === "update_assignment") {
      const a = await getAssignment(body.assignment_id);
      if (!a) return err("Assignment not found", 404);
      const patch: any = {};
      if (body.due_date !== undefined) patch.due_date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.due_date)) ? body.due_date : "";
      if (body.module_due && typeof body.module_due === "object") patch.module_due = { ...(a.module_due || {}), ...body.module_due };
      if (body.archive === true) patch.status = "archived";
      if (body.new_link === true) patch.access_token = token();
      return Response.json({ assignment: await db.TrainingAssignment.update(a.id, patch) });
    }

    if (action === "signoff") {
      const a = await getAssignment(body.assignment_id);
      if (!a) return err("Assignment not found", 404);
      const t = await getTrack(a.track_id);
      if (!t) return err("Track not found", 404);
      const mods = await getModules(t);
      const signoff = { by: user.full_name || user.email, email: user.email, at: new Date().toISOString(), note: clip(body.note, 600) };
      const c = computeProgress(t, mods, { ...a, signoff });
      if (c.pct < 100) return err(`${a.trainee_name} still has ${c.total - c.done} module${c.total - c.done === 1 ? "" : "s"} to finish before sign-off.`, 409);
      const patch: any = { signoff, status: "completed", pct: 100, completed_at: a.completed_at || new Date().toISOString(), badge: a.badge || badgeFor(t, a) };
      const updated = await db.TrainingAssignment.update(a.id, patch);
      if (a.status !== "completed") {
        await db.TrainingTrack.update(t.id, { completions: (Number(t.completions) || 0) + 1 }).catch(() => null);
        await logTrainingWork(db, {
          client_id: cid, client_name: business, task_type: "training_complete", done_by: "team", source_id: a.id, minutes_baseline: 0, visibility: "internal",
          title: `${a.trainee_name} completed training: ${t.title}`, notes: `Signed off by ${signoff.by}.${signoff.note ? ` ${signoff.note}` : ""}`,
          dedupe_key: `training:complete:${a.id}`,
        });
      }
      return Response.json({ assignment: updated });
    }

    if (action === "answer") {
      const a = await getAssignment(body.assignment_id);
      if (!a) return err("Assignment not found", 404);
      const qs = arr(a.questions).map((q: any) => (q.id === body.question_id ? { ...q, answer: clip(body.answer, 2000), answered_at: new Date().toISOString(), answered_by: user.full_name || user.email } : q));
      return Response.json({ assignment: await db.TrainingAssignment.update(a.id, { questions: qs }) });
    }

    return err("Unknown action");
  } catch (e) {
    console.error("training", (e as Error)?.message);
    return err((e as Error)?.message || "Training request failed", 500);
  }
});
