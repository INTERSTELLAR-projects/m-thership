// Structure call (/calls): turns what Justin wants to cover on a client call into a tight, timeboxed plan, and turns
// what happened on the call into action items and proposed brain facts. Built-in InvokeLLM only. Admin only.
//   { mode: "structure", call_prep_id }                      reads raw_notes + client context, writes the plan (status ready)
//   { mode: "structure", client_id, raw_notes, title?, scheduled_for?, timebox_minutes? }   creates the CallPrep first
//   { mode: "debrief", call_prep_id, outcomes? }             proposes action_items + brain_facts_proposed (status done)
//   { mode: "fact", call_prep_id, index, decision }          decision accepted -> writes a BrainFact on the client; rejected -> marks it
//   { mode: "context", client_id }                           what the agent would read (for the UI)
// Never invents facts, prices or promises; flags conflicts with stored facts; nothing personal is ever proposed as a fact.
// deno-lint-ignore-file no-explicit-any
import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";

const s = (v: any) => (v == null ? "" : String(v)).trim();
const arr = (v: any) => (Array.isArray(v) ? v : []);
const clip = (v: any, n: number) => { const t = s(v); return t.length > n ? t.slice(0, n) + "…" : t; };
const now = () => new Date().toISOString();
const PURPOSES = ["decide", "inform", "ask", "show"];
const PILLARS = ["sales", "marketing", "delivery", "finance", "clients", "team", "systems", "owner"];
// Facts about people's private lives never go into a brain, whatever the model proposes.
const SENSITIVE = /\b(health|medical|diagnos|illness|sick|pregnan|therapy|religio|church|politic|vote|divorce|custody|wife|husband|girlfriend|boyfriend|sexual|password|passcode|ssn|social security|bank account|routing number|credit card|debt|bankrupt|lawsuit|arrest|criminal|immigra)/i;

async function safe<T>(p: Promise<T>, fallback: T): Promise<T> { try { return await p; } catch { return fallback; } }

async function loadContext(db: any, clientId: string, excludeId = "") {
  const [client, facts, dossiers, work, tasks, posts, apps, calls] = await Promise.all([
    safe(db.CRMClient.get(clientId), null),
    safe(db.BrainFact.filter({ client_id: clientId, status: "active" }, "-updated_date", 120), []),
    safe(db.ClientDossier.filter({ client_id: clientId }, "-updated_date", 2), []),
    safe(db.WorkEntry.filter({ client_id: clientId }, "-completed_at", 15), []),
    safe(db.Task.filter({ client_id: clientId }, "-updated_date", 60), []),
    safe(db.ContentPost.filter({ client_id: clientId }, "-published_at", 8), []),
    safe(db.ClientAppProfile.filter({ client_id: clientId }, "-updated_date", 6), []),
    safe(db.CallPrep.filter({ client_id: clientId }, "-created_date", 6), []),
  ]);
  const byName = client?.business ? await safe(db.BrainFact.filter({ client_name: client.business, status: "active" }, "-updated_date", 40), []) : [];
  const allFacts = [...arr(facts), ...arr(byName).filter((f: any) => !arr(facts).some((x: any) => x.id === f.id))];
  const openTasks = arr(tasks).filter((t: any) => !["done", "cancelled", "archived"].includes(s(t.status)));
  const prior = arr(calls).filter((c: any) => c.id !== excludeId).slice(0, 3);
  const followUps: string[] = [];
  for (const c of prior) for (const a of arr(c.action_items)) if (!a?.done && s(a?.text)) followUps.push(`${s(a.text)} (${a.owner === "client" ? "client" : "Justin"}${a.due ? `, due ${s(a.due)}` : ""}; from "${s(c.title) || "earlier call"}")`);
  return { client, facts: allFacts, dossier: arr(dossiers)[0] || null, work: arr(work), openTasks, posts: arr(posts), apps: arr(apps), prior, followUps };
}

function contextText(ctx: any) {
  const c = ctx.client || {};
  const d = ctx.dossier || {};
  const lines: string[] = [];
  lines.push(`CLIENT: ${s(c.business)} · contact ${s(c.contact) || "unknown"} · ${s(c.domain)} · status ${s(c.status)} · plan ${s(c.plan) || "unknown"}`);
  if (c.industry) lines.push(`Industry: ${s(c.industry)}`);
  if (c.location) lines.push(`Location: ${s(c.location)}`);
  if (arr(c.services_managed).length) lines.push(`We manage: ${arr(c.services_managed).join(", ")}`);
  if (arr(c.notes).length) lines.push(`CRM notes: ${arr(c.notes).map((n: any) => clip(n, 220)).join(" | ")}`);
  if (c.next_step) lines.push(`CRM next step: ${s(c.next_step)}`);
  if (arr(d.offers).length) lines.push(`Offers (dossier): ${arr(d.offers).map((o: any) => `${s(o.name)}${o.price ? ` ${s(o.price)}` : ""}${o.promise ? ` (${s(o.promise)})` : ""}`).join("; ")}`);
  if (arr(d.services).length) lines.push(`Services (dossier): ${arr(d.services).map((x: any) => s(x.name)).filter(Boolean).join(", ")}`);
  if (ctx.facts.length) lines.push(`STORED FACTS (brain):\n${ctx.facts.slice(0, 80).map((f: any) => `- [${s(f.pillar)}] ${clip(f.statement, 260)}`).join("\n")}`);
  if (ctx.work.length) lines.push(`RECENT WORK DONE:\n${ctx.work.slice(0, 12).map((w: any) => `- ${s(w.completed_at).slice(0, 10)} ${clip(w.title, 200)}`).join("\n")}`);
  if (ctx.openTasks.length) lines.push(`OPEN TASKS:\n${ctx.openTasks.slice(0, 25).map((t: any) => `- ${clip(t.title, 160)} (${s(t.status)}${t.due_date ? `, due ${s(t.due_date)}` : ""})`).join("\n")}`);
  if (ctx.posts.length) lines.push(`RECENT SITE POSTS: ${ctx.posts.map((p: any) => `${clip(p.title, 80)} (${s(p.status)})`).join("; ")}`);
  if (ctx.apps.length) lines.push(`CLIENT SYSTEMS: ${ctx.apps.map((a: any) => `${s(a.app_name)} [${s(a.kind)}] ${s(a.publish_state)}${a.domain ? ` ${s(a.domain)}` : ""}`).join("; ")}`);
  if (ctx.prior.length) lines.push(`LAST CALLS:\n${ctx.prior.map((p: any) => `- ${s(p.title)} (${s(p.status)}${p.completed_at ? `, ${s(p.completed_at).slice(0, 10)}` : ""}) outcomes: ${clip(p.outcomes, 500) || "none recorded"}`).join("\n")}`);
  if (ctx.followUps.length) lines.push(`OPEN ACTION ITEMS FROM LAST CALLS (roll these forward):\n${ctx.followUps.map((f: string) => `- ${f}`).join("\n")}`);
  return lines.join("\n");
}

export function toMarkdown(cp: any) {
  const out: string[] = [];
  const total = arr(cp.agenda).reduce((n: number, a: any) => n + (Number(a.minutes) || 0), 0);
  out.push(`# ${s(cp.title) || "Call"}${cp.client_name ? ` · ${s(cp.client_name)}` : ""}`);
  if (cp.scheduled_for) out.push(`_${new Date(cp.scheduled_for).toLocaleString("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} PT · ${total} min_`);
  else out.push(`_${total} min_`);
  if (cp.goal) out.push(`\n**Goal:** ${s(cp.goal)}`);
  if (arr(cp.prep_checklist).length) out.push(`\n**Have open**\n${arr(cp.prep_checklist).map((x: any) => `- [ ] ${s(x)}`).join("\n")}`);
  out.push("\n## Agenda");
  arr(cp.agenda).forEach((a: any, i: number) => {
    out.push(`\n### ${i + 1}. ${s(a.topic)} (${Number(a.minutes) || 0} min · ${s(a.purpose)})`);
    if (a.decision_needed) out.push(`**Decision:** ${s(a.decision_needed)}`);
    arr(a.talking_points).forEach((t: any) => out.push(`- ${s(t)}`));
    arr(a.questions).forEach((q: any) => out.push(`- Ask: ${s(q)}`));
  });
  if (arr(cp.asks_from_client).length) out.push(`\n## Get from ${s(cp.client_name) || "the client"}\n${arr(cp.asks_from_client).map((x: any) => `- ${s(x)}`).join("\n")}`);
  if (arr(cp.risks).length) out.push(`\n## Watch for\n${arr(cp.risks).map((x: any) => `- ${s(x)}`).join("\n")}`);
  if (arr(cp.conflicts).length) out.push(`\n## Check before the call (conflicts with what we have on file)\n${arr(cp.conflicts).map((x: any) => `- ${s(x)}`).join("\n")}`);
  return out.join("\n");
}

const STRUCTURE_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    goal: { type: "string" },
    timebox_minutes: { type: "number" },
    agenda: {
      type: "array",
      items: {
        type: "object",
        properties: {
          topic: { type: "string" }, minutes: { type: "number" }, purpose: { type: "string", enum: PURPOSES },
          talking_points: { type: "array", items: { type: "string" } }, questions: { type: "array", items: { type: "string" } }, decision_needed: { type: "string" },
        },
        required: ["topic", "minutes", "purpose"],
      },
    },
    prep_checklist: { type: "array", items: { type: "string" } },
    asks_from_client: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    conflicts: { type: "array", items: { type: "string" } },
  },
  required: ["goal", "agenda"],
};

function structurePrompt(cp: any, ctx: any) {
  return [
    "You are Justin Cowell's call planner. Justin runs Interstellar Strategies, a digital agency. He spends too long on client calls; your job is a tight call that gets more done.",
    "Turn his notes into a call plan. Rules:",
    "- goal: ONE sentence, what must be true when the call ends.",
    "- Agenda order: open with the goal (1-2 min, purpose inform), then every DECISION item, then show items, then asks, then informs. Close with a final item 'Recap, next steps, next call date' (2-3 min, purpose decide) that confirms owners and dates.",
    "- If OPEN ACTION ITEMS FROM LAST CALLS are given, add an early item 'Follow-ups from last call' covering only those, briefly.",
    `- Timebox every item in whole minutes. Total = ${Number(cp.timebox_minutes) || 25} minutes unless his notes clearly need less (default range 20-30). Never exceed 30 unless he asked for longer.`,
    "- talking_points: short, concrete, from his notes or the context. questions: exact questions to ask the client. decision_needed: the yes/no or choice to get, for decide items.",
    "- prep_checklist: things Justin should have open before the call (specific pages, URLs, numbers, files) drawn from the notes and context.",
    "- asks_from_client: what to get from the client (assets, approvals, numbers).",
    "- risks: things that could derail the call or the project; keep it to real ones.",
    "- conflicts: anything in his notes that disagrees with STORED FACTS, dossier, CRM notes or the site (e.g. two different numbers for the same thing). Quote both sides. Empty if none.",
    "- NEVER invent facts, prices, dates, numbers or promises. If something is unknown, make it a question. Do not promise outcomes on Justin's behalf.",
    "- title: short, e.g. 'Pre-launch walkthrough'. Use plain words, no emoji, no hype.",
    "",
    contextText(ctx),
    "",
    `JUSTIN'S NOTES FOR THIS CALL (verbatim):\n${s(cp.raw_notes)}`,
  ].join("\n");
}

function cleanStructure(r: any, cp: any) {
  const agenda = arr(r?.agenda).map((a: any) => ({
    topic: clip(a?.topic, 140), minutes: Math.max(1, Math.round(Number(a?.minutes) || 2)), purpose: PURPOSES.includes(a?.purpose) ? a.purpose : "inform",
    talking_points: arr(a?.talking_points).map((x: any) => clip(x, 300)).filter(Boolean).slice(0, 8),
    questions: arr(a?.questions).map((x: any) => clip(x, 300)).filter(Boolean).slice(0, 6),
    decision_needed: clip(a?.decision_needed, 300), done: false,
  })).filter((a: any) => a.topic).slice(0, 12);
  const list = (v: any, n = 12) => arr(v).map((x: any) => clip(x, 300)).filter(Boolean).slice(0, n);
  return {
    title: s(cp.title) || clip(r?.title, 100) || "Client call",
    goal: clip(r?.goal, 300),
    agenda,
    timebox_minutes: agenda.reduce((n: number, a: any) => n + a.minutes, 0),
    prep_checklist: list(r?.prep_checklist), asks_from_client: list(r?.asks_from_client), risks: list(r?.risks, 8), conflicts: list(r?.conflicts, 8),
  };
}

const DEBRIEF_SCHEMA = {
  type: "object",
  properties: {
    action_items: { type: "array", items: { type: "object", properties: { text: { type: "string" }, owner: { type: "string", enum: ["justin", "client"] }, due: { type: "string" } }, required: ["text", "owner"] } },
    brain_facts: { type: "array", items: { type: "object", properties: { fact: { type: "string" }, pillar: { type: "string", enum: PILLARS }, quote: { type: "string" } }, required: ["fact", "quote"] } },
  },
  required: ["action_items", "brain_facts"],
};

function debriefPrompt(cp: any, ctx: any, outcomes: string) {
  return [
    "You turn Justin's after-call notes into action items and brain facts for one client.",
    "action_items: every concrete next step that was said. owner 'justin' (Justin / Interstellar) or 'client'. due only if a date or day was said (write it as said); otherwise empty.",
    "brain_facts: durable facts about the CLIENT'S BUSINESS that were actually said in the notes (prices, lead times, preferences, approvals, decisions, numbers, goals). Rules:",
    "- Only what the notes say. Never infer, never generalize, never add numbers. quote = the words in the notes it comes from.",
    "- One fact per item, written as a plain statement that will still be true later, e.g. 'Standard fabrication lead time is about 4 days (Tyler, Nov 2026 call)'.",
    "- Skip anything personal or sensitive about any person (health, family, relationships, religion, politics, money troubles, legal matters), credentials, and small talk.",
    "- Skip facts already in STORED FACTS unless the notes change them; when they change one, say so in the fact ('now ... instead of ...').",
    "",
    `CALL: ${s(cp.title)} · goal: ${s(cp.goal)}`,
    `AGENDA: ${arr(cp.agenda).map((a: any) => s(a.topic)).join("; ")}`,
    ctx.facts.length ? `STORED FACTS:\n${ctx.facts.slice(0, 60).map((f: any) => `- ${clip(f.statement, 200)}`).join("\n")}` : "STORED FACTS: none",
    "",
    `AFTER-CALL NOTES (verbatim):\n${outcomes}`,
  ].join("\n");
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch(() => null);
    if (user?.role !== "admin") return Response.json({ ok: false, error: user ? "Forbidden" : "Unauthorized" }, { status: user ? 403 : 401 });
    const db = base44.asServiceRole.entities;
    const llm = (prompt: string, schema: any) => base44.asServiceRole.integrations.Core.InvokeLLM({ prompt, response_json_schema: schema });
    const b = await req.json().catch(() => ({}));
    const mode = s(b.mode) || "structure";

    if (mode === "context") {
      const ctx = await loadContext(db, s(b.client_id));
      if (!ctx.client) return Response.json({ ok: false, error: "Client not found" }, { status: 404 });
      return Response.json({ ok: true, follow_ups: ctx.followUps, counts: { facts: ctx.facts.length, work: ctx.work.length, open_tasks: ctx.openTasks.length, posts: ctx.posts.length, apps: ctx.apps.length, prior_calls: ctx.prior.length } });
    }

    let cp: any = null;
    if (b.call_prep_id) cp = await db.CallPrep.get(s(b.call_prep_id)).catch(() => null);
    if (!cp && mode === "structure" && b.client_id) {
      const client = await db.CRMClient.get(s(b.client_id)).catch(() => null);
      if (!client) return Response.json({ ok: false, error: "Client not found" }, { status: 404 });
      cp = await db.CallPrep.create({
        client_id: client.id, client_name: s(client.business), title: s(b.title), scheduled_for: b.scheduled_for || undefined, status: "draft",
        raw_notes: s(b.raw_notes), timebox_minutes: Number(b.timebox_minutes) || 25, created_at: now(),
      });
    }
    if (!cp) return Response.json({ ok: false, error: "Call prep not found" }, { status: 404 });

    if (mode === "structure") {
      if (b.raw_notes != null && s(b.raw_notes) !== s(cp.raw_notes)) cp = { ...cp, raw_notes: s(b.raw_notes) };
      if (b.timebox_minutes) cp = { ...cp, timebox_minutes: Number(b.timebox_minutes) };
      if (s(cp.raw_notes).length < 5) return Response.json({ ok: false, error: "Say or type what the call needs to cover first" }, { status: 400 });
      const ctx = await loadContext(db, cp.client_id, cp.id);
      const r: any = await llm(structurePrompt(cp, ctx), STRUCTURE_SCHEMA);
      const st = cleanStructure(r, cp);
      if (!st.agenda.length) return Response.json({ ok: false, error: "The planner returned no agenda; try again" }, { status: 502 });
      const patch: any = {
        ...st, raw_notes: cp.raw_notes, follow_ups: ctx.followUps, status: cp.status === "done" ? "done" : "ready", generated_at: now(),
        client_name: s(ctx.client?.business) || cp.client_name,
        context_summary: `${ctx.facts.length} brain facts · ${ctx.work.length} recent work · ${ctx.openTasks.length} open tasks · ${ctx.posts.length} site posts · ${ctx.apps.length} systems · ${ctx.prior.length} earlier calls${ctx.dossier ? " · dossier" : ""}`,
      };
      patch.structure = toMarkdown({ ...cp, ...patch });
      const saved = await db.CallPrep.update(cp.id, patch);
      return Response.json({ ok: true, call_prep: { ...cp, ...patch, ...(saved || {}), id: cp.id } });
    }

    if (mode === "debrief") {
      const outcomes = s(b.outcomes ?? cp.outcomes);
      if (outcomes.length < 5) return Response.json({ ok: false, error: "Say or type what happened on the call first" }, { status: 400 });
      const ctx = await loadContext(db, cp.client_id, cp.id);
      const r: any = await llm(debriefPrompt(cp, ctx, outcomes), DEBRIEF_SCHEMA);
      const action_items = arr(r?.action_items).map((a: any) => ({ text: clip(a?.text, 300), owner: a?.owner === "client" ? "client" : "justin", due: clip(a?.due, 60), done: false })).filter((a: any) => a.text).slice(0, 20);
      const keep = arr(cp.brain_facts_proposed).filter((f: any) => f.status !== "proposed");
      const brain_facts_proposed = [
        ...keep,
        ...arr(r?.brain_facts)
          .map((f: any) => ({ fact: clip(f?.fact, 400), pillar: PILLARS.includes(f?.pillar) ? f.pillar : "clients", quote: clip(f?.quote, 300), status: "proposed" }))
          .filter((f: any) => f.fact && f.quote && !SENSITIVE.test(f.fact) && !SENSITIVE.test(f.quote))
          .filter((f: any) => !keep.some((k: any) => s(k.fact).toLowerCase() === f.fact.toLowerCase()))
          .slice(0, 15),
      ];
      const patch = { outcomes, action_items, brain_facts_proposed, status: "done", completed_at: cp.completed_at || now() };
      await db.CallPrep.update(cp.id, patch);
      return Response.json({ ok: true, call_prep: { ...cp, ...patch } });
    }

    if (mode === "fact") {
      const list = [...arr(cp.brain_facts_proposed)];
      const i = Number(b.index);
      const f = list[i];
      if (!f) return Response.json({ ok: false, error: "No such fact" }, { status: 400 });
      const decision = b.decision === "accepted" ? "accepted" : b.decision === "rejected" ? "rejected" : "";
      if (!decision) return Response.json({ ok: false, error: "decision must be accepted or rejected" }, { status: 400 });
      if (f.status === "accepted" && f.brain_fact_id) return Response.json({ ok: true, call_prep: cp, note: "Already in the brain" });
      if (decision === "accepted") {
        if (SENSITIVE.test(s(f.fact))) return Response.json({ ok: false, error: "That looks personal or sensitive, so it can't go in the brain" }, { status: 400 });
        const rec = await db.BrainFact.create({
          pillar: PILLARS.includes(f.pillar) ? f.pillar : "clients", statement: s(f.fact), raw_text: s(f.quote), client_id: cp.client_id, client_name: s(cp.client_name),
          source: "call", capture_source: `call: ${s(cp.title) || "client call"}`, confidence: "high", date: now().slice(0, 10), status: "active", data: { call_prep_id: cp.id },
          captured_by_name: s(user.full_name || user.email),
        });
        list[i] = { ...f, status: "accepted", brain_fact_id: rec?.id || "" };
      } else {
        list[i] = { ...f, status: "rejected" };
      }
      await db.CallPrep.update(cp.id, { brain_facts_proposed: list });
      return Response.json({ ok: true, call_prep: { ...cp, brain_facts_proposed: list } });
    }

    return Response.json({ ok: false, error: `Unknown mode ${mode}` }, { status: 400 });
  } catch (e) {
    return Response.json({ ok: false, error: String((e as any)?.message || e) }, { status: 500 });
  }
});
