import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import * as C from "../../shared/command.js";
import { requireAdmin, audit, cleanAnswer, clientNames } from "../../shared/commandServer.ts";

// Møthership Command: Teach the Brain.
//   { action: "next", skip?: [question_key] } -> { question, coverage, facts }
//   { action: "clean", text, question } -> { statements[], source: llm|rules, about_client, pillar_hint } (nothing saved)
//   { action: "answer", question_key, question, pillar, statements[], raw_text, client_name? } -> saves the confirmed
//       statements as BrainFacts (raw_text keeps what he said), returns the next question
//   { action: "reclean", dry_run? } -> tidies existing facts that have no raw_text yet (original kept in raw_text)
//   { action: "move", id, pillar, client_name? } -> refile one fact
//   { action: "seed" } -> imports what Møthership already knows (AgencyKnowledge, Interstellar brain, revenue goal), once
// Questions come from a fixed bank, ordered by the pillar with the lowest confidence and the most impact.

const str = (v: unknown) => (v == null ? "" : String(v));
const strip = (md: string) => str(md).replace(/[#*_`>|]/g, "").replace(/\[(.*?)\]\(.*?\)/g, "$1").replace(/\s+/g, " ").trim();

async function state(db: any, skip: string[] = []) {
  const src = await C.loadSources(db);
  const { s, scores } = C.computeAll(src, new Date(), {});
  const question = C.nextQuestion(s.facts, scores, skip);
  const coverage = Object.fromEntries(C.PILLARS.map((p: any) => [p.id, { name: p.name, facts: s.factsBy[p.id] || 0, confidence: scores[p.id].confidence, score: scores[p.id].score }]));
  const answered = C.BRAIN_QUESTIONS.length - C.BRAIN_QUESTIONS.filter((q: any) => !s.facts.some((f: any) => f.question_key === q.key || (f.data?.covers || []).includes(q.key))).length;
  return { question, coverage, total_questions: C.BRAIN_QUESTIONS.length, answered, facts: s.facts.slice(0, 200).map((f: any) => ({ id: f.id, pillar: f.pillar, statement: f.statement, source: f.source, date: f.date, question_key: f.question_key })) };
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user, denied } = await requireAdmin(base44);
    if (denied) return denied;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "next");
    const db = base44.asServiceRole.entities;
    const skip = Array.isArray(body?.skip) ? body.skip.map(String).slice(0, 60) : [];
    const today = C.zonedParts(new Date(), C.TZ_DEFAULT).date;

    if (action === "next") return Response.json(await state(db, skip));

    if (action === "clean") {
      const text = str(body?.text).trim();
      if (!text) return Response.json({ error: "Nothing to clean up" }, { status: 400 });
      const q = C.BRAIN_QUESTIONS.find((x: any) => x.key === body?.question_key);
      return Response.json(await cleanAnswer(base44, text, q?.q || str(body?.question), await clientNames(db)));
    }

    if (action === "answer") {
      const raw = str(body?.raw_text || body?.text).trim().slice(0, 4000);
      const statements = (Array.isArray(body?.statements) && body.statements.length ? body.statements : [raw]).map((x: any) => str(x).trim().slice(0, 1000)).filter(Boolean).slice(0, 3);
      if (!statements.length) return Response.json({ error: "Say or type an answer" }, { status: 400 });
      const all = `${raw} ${statements.join(" ")}`;
      if (/password|passcode|\bpin\b\s*[:=]?\s*\d{3,}/i.test(all) && /\d{3,}|[:=]/.test(all)) return Response.json({ error: "That looks like a password or PIN. The Brain never stores credentials: say where it lives instead." }, { status: 400 });
      const key = str(body?.question_key) || null;
      const q = C.BRAIN_QUESTIONS.find((x: any) => x.key === key);
      const pillar = C.PILLAR_IDS.includes(body?.pillar) ? body.pillar : q?.pillar || "owner";
      if (key) {
        const old = await db.BrainFact.filter({ question_key: key, status: "active" }, "-created_date", 20).catch(() => []);
        for (const f of old || []) await db.BrainFact.update(f.id, { status: "superseded" }).catch(() => null);
      }
      const data = C.factData(key, raw, statements.join(" "));
      const saved: any[] = [];
      for (const statement of statements) {
        const fact = await db.BrainFact.create({ pillar, statement, raw_text: raw, question_key: key, question: q?.q || str(body?.question).slice(0, 400), source: "interview", confidence: "high", date: today, status: "active", ...(str(body?.client_name) ? { client_name: str(body.client_name).slice(0, 120) } : {}), ...(data ? { data } : {}) });
        await audit(db, { actor: user.email, action: "fact_saved", entity: "BrainFact", record_id: fact.id, summary: `[${pillar}] ${statement.slice(0, 160)}`, undo: { entity: "BrainFact", id: fact.id, patch: { status: "superseded" } } });
        saved.push({ id: fact.id, statement, pillar });
      }
      if (key) {
        const cards = await db.ProposedAction.filter({ kind: "question", status: "pending" }, "-created_date", 50).catch(() => []);
        for (const c of cards || []) if (c.payload?.question_key === key) await db.ProposedAction.update(c.id, { status: "answered", answer: raw.slice(0, 2000), executed_at: new Date().toISOString() }).catch(() => null);
      }
      return Response.json({ saved: saved[0], saved_all: saved, ...(await state(db, skip)) });
    }

    if (action === "reclean") {
      const names = await clientNames(db);
      const facts = await db.BrainFact.filter({ status: "active" }, "-created_date", 300).catch(() => []);
      const out: any[] = [];
      for (const f of facts || []) {
        if (f.raw_text || str(f.source).startsWith("seed:")) continue;
        const q = C.BRAIN_QUESTIONS.find((x: any) => x.key === f.question_key);
        const override = body?.overrides && typeof body.overrides[f.id] === "string" ? String(body.overrides[f.id]).trim() : "";
        const c = override ? { statements: [override], source: "reviewed", about_client: "", pillar_hint: "" } : await cleanAnswer(base44, f.statement, q?.q || f.question || "", names);
        let after = c.statements.join(" ");
        // Existing facts were already distilled once: keep an AI clean-up only if it stays close to the stored wording
        // and voice; otherwise use the rule clean-up so the meaning can't drift.
        const words = (t: string) => new Set(String(t).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean));
        const A = words(f.statement), B = words(after);
        const sim = [...A].filter((w) => B.has(w)).length / Math.max(1, new Set([...A, ...B]).size);
        const voiceFlip = !/^i\b/i.test(String(f.statement).trim()) && /^i\b/i.test(after.trim());
        if (c.source === "llm" && (sim < 0.75 || voiceFlip)) { after = C.ruleClean(f.statement, names); (c as any).source = "rules (kept close to the original)"; }
        const row = { id: f.id, pillar: f.pillar, before: f.statement, after, source: c.source, about_client: c.about_client, pillar_hint: c.pillar_hint, misfiled: Boolean(c.pillar_hint && c.pillar_hint !== f.pillar) || Boolean(c.about_client && f.pillar === "owner") };
        out.push(row);
        if (!body?.dry_run) {
          const data = C.factData(f.question_key, f.statement, after);
          await db.BrainFact.update(f.id, { statement: after, raw_text: f.statement, ...(data ? { data } : {}) });
          await audit(db, { actor: user.email, action: "record_changed", entity: "BrainFact", record_id: f.id, summary: `Cleaned: "${str(f.statement).slice(0, 80)}" → "${after.slice(0, 80)}"`, before: { statement: f.statement }, after: { statement: after }, undo: null });
        }
      }
      return Response.json({ cleaned: out.length, dry_run: !!body?.dry_run, facts: out });
    }

    if (action === "move") {
      const f = await db.BrainFact.get(str(body?.id));
      if (!f || !C.PILLAR_IDS.includes(body?.pillar)) return Response.json({ error: "Fact or pillar not found" }, { status: 400 });
      const patch: any = { pillar: body.pillar };
      if (typeof body?.client_name === "string") patch.client_name = body.client_name.slice(0, 120);
      await db.BrainFact.update(f.id, patch);
      await audit(db, { actor: user.email, action: "record_changed", entity: "BrainFact", record_id: f.id, summary: `Refiled from ${f.pillar} to ${body.pillar}${patch.client_name ? " (" + patch.client_name + ")" : ""}: ${str(f.statement).slice(0, 100)}`, before: { pillar: f.pillar, client_name: f.client_name || null }, after: patch, undo: null });
      return Response.json({ ok: true });
    }

    if (action === "seed") {
      const existing = await db.BrainFact.list("-created_date", 500).catch(() => []);
      if ((existing || []).some((f: any) => str(f.source).startsWith("seed:"))) return Response.json({ seeded: 0, note: "Already seeded", ...(await state(db, skip)) });
      const docs: any[] = [];
      const ak = await db.AgencyKnowledge.list("sort", 100).catch(() => []);
      for (const k of ak || []) {
        const text = strip(k.body);
        if (!text || /credential|password|login/i.test(k.key)) continue;
        const covers = (C.SEED_MAP as any)[k.key] || [];
        docs.push({ pillar: (C.AGENCY_PILLAR as any)[k.key] || "owner", statement: `${k.title}: ${text.slice(0, 420)}${text.length > 420 ? "…" : ""}`, question_key: covers[0] || `seed.${k.key}`, source: "seed:agency_knowledge", confidence: "high", date: today, status: "active", data: { covers, agency_key: k.key } });
      }
      const brains = await db.BusinessBrain.filter({ scope: "interstellar" }, "-updated_date", 1).catch(() => []);
      const sections = brains?.[0]?.sections || {};
      const secPillar = (key: string) => /offer|price|sales|lead/i.test(key) ? "sales" : /audience|brand|voice|competitor|gbp|listing|social|seo|content/i.test(key) ? "marketing" : /team|staff|people/i.test(key) ? "team" : /tool|system|tech|app/i.test(key) ? "systems" : /client|retention/i.test(key) ? "clients" : /money|finance|revenue/i.test(key) ? "finance" : "owner";
      for (const [key, v] of Object.entries(sections) as any) {
        const text = strip(v?.text);
        if (!text || /login|password|credential/i.test(key)) continue;
        docs.push({ pillar: secPillar(key), statement: `${key.replace(/_/g, " ")}: ${text.slice(0, 420)}${text.length > 420 ? "…" : ""}`, question_key: `seed.brain.${key}`, source: "seed:business_brain", confidence: v?.confidence === "high" ? "high" : v?.confidence === "low" ? "low" : "medium", date: today, status: "active" });
      }
      const goals = await db.RevenueGoal.list("-created_date", 5).catch(() => []);
      const g = (goals || []).find((x: any) => x.is_primary) || (goals || [])[0];
      if (g) docs.push({ pillar: "owner", statement: `Primary goal: ${g.title} (${C.money(g.target_amount)} ${str(g.metric).replace(/_/g, " ")}, ${g.start_date || "?"} to ${g.deadline || "?"}).`, question_key: "owner.goal_2027", source: "seed:revenue_goal", confidence: "high", date: today, status: "active" });
      if (docs.length) await db.BrainFact.bulkCreate(docs);
      await audit(db, { actor: user.email, action: "brain_seeded", entity: "BrainFact", summary: `Seeded ${docs.length} facts from Agency knowledge, the Interstellar brain and the revenue goal` });
      return Response.json({ seeded: docs.length, ...(await state(db, skip)) });
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("command-brain", (e as Error)?.message);
    return Response.json({ error: (e as Error)?.message || "Brain failed" }, { status: 500 });
  }
});
