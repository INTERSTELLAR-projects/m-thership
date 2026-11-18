import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import * as C from "../../shared/command.js";
import { requireAdmin, audit, invokeJson, generateBrief } from "../../shared/commandServer.ts";
import { systemsContext, systemsFallback } from "../../shared/systemsBrain.ts";

// Møthership Command: the Ask bar. { text } -> { reply, speak, done[], proposed[], replanned }
// One LLM call turns what Justin said into intents; code decides what runs and what waits for approval:
//   runs now (internal, logged, undoable): create_task, brain_fact, interruption/replan
//   becomes a Needs-you card: update_task, draft_email, draft_sms, draft_estimate, log_expense, client_note
// Without the LLM a rule parser still handles tasks, interruptions, facts and simple questions.

const str = (v: unknown) => (v == null ? "" : String(v));
const ISO = /^\d{4}-\d{2}-\d{2}$/;

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user, denied } = await requireAdmin(base44);
    if (denied) return denied;
    const body = await req.json().catch(() => ({}));
    const text = str(body?.text).trim().slice(0, 2000);
    if (!text) return Response.json({ error: "Say or type something" }, { status: 400 });
    const db = base44.asServiceRole.entities;
    const tz = C.TZ_DEFAULT;
    const now = new Date();
    const src = await C.loadSources(db);
    const { s, scores } = C.computeAll(src, now, { tz, name: user.full_name });
    const briefRows = await db.DailyBrief.filter({ date: s.today }, "-updated_date", 1).catch(() => []);
    const brief = (briefRows || [])[0] || null;

    // Systems brain: the keys / connections / systems facts that match the question (names and wiring only, no values).
    const sys = await systemsContext(db, text).catch(() => ({ block: "", keys: [] as any[], links: [] as any[] }));

    let out: any = null, llmOk = true;
    try { out = await invokeJson(base44, C.askPrompt(text, s, scores, brief, s.facts) + sys.block, C.ASK_SCHEMA, 40000); } catch { out = null; }
    if (!out || !Array.isArray(out.intents)) {
      llmOk = false;
      const intent = C.fallbackIntent(text);
      const sysReply = intent.type === "answer" ? systemsFallback(sys.keys, sys.links) : "";
      out = { reply: intent.type === "answer" ? sysReply || C.answerFromSnapshot(text, s, scores, brief) : "", intents: [intent] };
    }

    const clientById = new Map(s.clients.map((c: any) => [c.id, c]));
    const emails = new Set(s.clients.flatMap((c: any) => (c.emails || []).map((e: string) => e.toLowerCase())));
    const phones = new Set(s.clients.flatMap((c: any) => (c.phones || []).map((p: string) => p.replace(/\D/g, ""))));
    const done: any[] = [];
    const proposed: any[] = [];
    let replanned = false;
    const propose = async (doc: any) => { const r = await db.ProposedAction.create({ status: "pending", source: "ask", priority: 65, ...doc, source_ref: { entity: "Ask", id: "", label: text.slice(0, 90), path: "/" } }); proposed.push({ id: r.id, title: r.title, kind: r.kind }); };

    for (const it of (out.intents || []).slice(0, 5)) {
      const client: any = it.client_id ? clientById.get(it.client_id) : null;
      switch (it.type) {
        case "create_task": {
          if (!str(it.title).trim()) break;
          const t = await db.Task.create({ title: str(it.title).slice(0, 200), status: "next", priority: [1, 2, 3, 4].includes(Number(it.priority)) ? Number(it.priority) : 3, due_date: ISO.test(str(it.due_date)) ? it.due_date : null, client_id: client?.id || null, client_name: client?.business || null, category: "ops", source: "voice", notes: `From the Ask bar: "${text.slice(0, 300)}"` });
          const log = await audit(db, { actor: "agent", action: "task_created", entity: "Task", record_id: t.id, summary: `Task: ${t.title}`, undo: { entity: "Task", id: t.id, patch: { status: "done", labels: ["undone"] } } });
          done.push({ type: "task", id: t.id, label: `Task added: ${t.title}`, audit_id: log?.id });
          break;
        }
        case "brain_fact": {
          const statement = str(it.statement || text).slice(0, 1000);
          const pillar = C.PILLAR_IDS.includes(it.pillar) ? it.pillar : "owner";
          const f = await db.BrainFact.create({ pillar, statement, source: "ask", confidence: "medium", date: s.today, status: "active" });
          const log = await audit(db, { actor: "agent", action: "fact_saved", entity: "BrainFact", record_id: f.id, summary: `[${pillar}] ${statement.slice(0, 160)}`, undo: { entity: "BrainFact", id: f.id, patch: { status: "superseded" } } });
          done.push({ type: "fact", id: f.id, label: `Brain learned (${C.pillarName(pillar)}): ${statement.slice(0, 80)}`, audit_id: log?.id });
          break;
        }
        case "interruption": {
          const r = await generateBrief(base44, user, { tz, useLlm: false, reason: "something came up", interruption: { text: it.title || text, minutes: it.minutes } });
          replanned = true;
          done.push({ type: "replan", id: r.brief.id, label: `Re-planned around: ${str(it.title || text).slice(0, 60)}` });
          break;
        }
        case "replan": {
          const r = await generateBrief(base44, user, { tz, reason: "re-plan from Ask" });
          replanned = true;
          done.push({ type: "replan", id: r.brief.id, label: "Day re-planned" });
          break;
        }
        case "update_task": {
          const task = s.open.find((t: any) => t.id === it.task_id);
          if (!task) break;
          const patch: any = {};
          if (["inbox", "next", "doing", "blocked", "done"].includes(it.status)) { patch.status = it.status; if (it.status === "done") patch.completed_at = "$now"; }
          if (ISO.test(str(it.due_date))) patch.due_date = it.due_date;
          if ([1, 2, 3, 4].includes(Number(it.priority))) patch.priority = Number(it.priority);
          if (!Object.keys(patch).length) break;
          await propose({ kind: "record_change", pillar: C.taskPillar(task), title: `Update "${task.title.slice(0, 60)}"`, rationale: `You asked: "${text.slice(0, 140)}"`, payload: { changes: [{ entity: "Task", id: task.id, label: task.title, patch }] } });
          break;
        }
        case "draft_email":
        case "draft_estimate": {
          const to = str(it.to).trim().toLowerCase();
          const okTo = to && (emails.has(to) || to === C.TEST_EMAIL) ? to : (client?.emails || [])[0] || "";
          const lines = Array.isArray(it.line_items) ? it.line_items.filter((l: any) => l && str(l.label) && Number(l.amount) > 0) : [];
          const est = it.type === "draft_estimate" && lines.length ? `\n\n${lines.map((l: any) => `- ${l.label}: ${C.money(l.amount)}`).join("\n")}\nTotal: ${C.money(lines.reduce((t: number, l: any) => t + Number(l.amount), 0))}` : "";
          await propose({ kind: "send_email", risk: "external", pillar: it.type === "draft_estimate" ? "sales" : client?.status === "Lead" ? "sales" : "clients", title: `${it.type === "draft_estimate" ? "Estimate" : "Email"} to ${client?.business || okTo || "(add recipient)"}`, rationale: `Drafted from: "${text.slice(0, 160)}"${okTo ? "" : ". No matching address on file: add the recipient before approving."}`, payload: { to: okTo, subject: str(it.subject || it.title || "Following up").slice(0, 200), body: (str(it.body).trim() + est).slice(0, 6000), client_id: client?.id || null } });
          break;
        }
        case "draft_sms": {
          const digits = str(it.phone).replace(/\D/g, "");
          const phone = digits && phones.has(digits) ? it.phone : (client?.phones || [])[0] || "";
          await propose({ kind: "send_sms", risk: "external", pillar: client?.status === "Lead" ? "sales" : "clients", title: `Text to ${client?.business || phone || "(add number)"}`, rationale: `Drafted from: "${text.slice(0, 160)}". Texts open in your Messages app; Møthership doesn't send them.`, payload: { phone, body: str(it.body).slice(0, 1000), client_id: client?.id || null } });
          break;
        }
        case "log_expense": {
          if (!(Number(it.amount) > 0) || !str(it.platform).trim()) break;
          await propose({ kind: "log_expense", risk: "money", pillar: "finance", title: `Log expense: ${it.platform} ${C.money(it.amount)}${it.frequency ? " " + String(it.frequency).toLowerCase() : ""}`, rationale: `You said: "${text.slice(0, 160)}". Adds it to Financial › Expenses; nothing is paid.`, payload: { expense: { platform: it.platform, amount: Number(it.amount), frequency: it.frequency, category: it.category || "Operations" } } });
          break;
        }
        case "client_note": {
          if (!client || !str(it.body).trim()) break;
          await propose({ kind: "client_note", pillar: client.status === "Lead" ? "sales" : "clients", title: `Add a note to ${client.business}`, rationale: `From: "${text.slice(0, 160)}"`, payload: { client_id: client.id, body: str(it.body).slice(0, 2000) } });
          break;
        }
        default:
          break;
      }
    }
    if (proposed.length) await audit(db, { actor: "agent", action: "proposed", summary: `Ask → ${proposed.length} card(s): ${proposed.map((p) => p.title).join(" | ")}`.slice(0, 500) });
    let reply = str(out.reply).trim();
    if (!reply) reply = [...done.map((d) => d.label), ...proposed.map((p) => `Drafted for your OK: ${p.title}`)].join(". ") || "Got it.";
    else if (proposed.length && !/approv|ok|review/i.test(reply)) reply += ` ${proposed.length === 1 ? "It's" : "They're"} waiting in Needs you for your OK.`;
    return Response.json({ reply, speak: str(out.speak || reply).slice(0, 400), done, proposed, replanned, llm: llmOk });
  } catch (e) {
    console.error("command-ask", (e as Error)?.message);
    return Response.json({ error: (e as Error)?.message || "Ask failed" }, { status: 500 });
  }
});
