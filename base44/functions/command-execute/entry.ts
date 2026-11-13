import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import * as C from "../../shared/command.js";
import { requireAdmin, audit, applyChanges, undoAudit, emailHtml, validEmail, generateBrief, nowIso, SENDER_NAME } from "../../shared/commandServer.ts";

// Møthership Command: carries out a ProposedAction AFTER Justin approves it, and only then.
//   { action: "approve", id, edits?, confirm?, test?, option?, answer? }
//       send_email   needs confirm: true (the on-screen final confirm). test: true sends ONLY to TEST_EMAIL and keeps
//                    the card pending. Recipient = the approved address, no CC/BCC.
//       send_sms     never sent from here: returns an sms: link for the phone's Messages app.
//       record_change / create_task / log_expense / client_note / choice (option index) / question (answer text)
//   { action: "skip", id } · { action: "snooze", id, until? } · { action: "undo", audit_id }
// Every run writes AgentAuditLog. Never moves money, never deletes records.

const EDIT_KEYS = ["to", "subject", "body", "phone", "title", "due_date", "amount", "platform"];
const str = (v: unknown) => (v == null ? "" : String(v));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user, denied } = await requireAdmin(base44);
    if (denied) return denied;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "");
    const db = base44.asServiceRole.entities;
    const actor = user.email;

    if (action === "undo") {
      await undoAudit(db, String(body?.audit_id || ""), actor);
      return Response.json({ ok: true });
    }

    const pa = body?.id ? await db.ProposedAction.get(String(body.id)).catch(() => null) : null;
    if (!pa) return Response.json({ error: "Card not found" }, { status: 404 });

    if (action === "skip") {
      await db.ProposedAction.update(pa.id, { status: "skipped" });
      await audit(db, { actor, action: "skipped", entity: "ProposedAction", record_id: pa.id, summary: `Skipped: ${pa.title}`, proposed_action_id: pa.id, undo: null });
      return Response.json({ ok: true, status: "skipped" });
    }
    if (action === "snooze") {
      const until = body?.until && !Number.isNaN(Date.parse(body.until)) ? new Date(body.until).toISOString() : new Date(Date.now() + 3 * 3600e3).toISOString();
      await db.ProposedAction.update(pa.id, { status: "snoozed", snooze_until: until });
      await audit(db, { actor, action: "snoozed", entity: "ProposedAction", record_id: pa.id, summary: `Snoozed until ${until}: ${pa.title}`, proposed_action_id: pa.id });
      return Response.json({ ok: true, status: "snoozed", snooze_until: until });
    }
    if (action !== "approve") return Response.json({ error: "Unknown action" }, { status: 400 });
    if (!["pending", "snoozed", "failed"].includes(pa.status)) return Response.json({ error: `This card is already ${pa.status}` }, { status: 409 });

    const payload = { ...(pa.payload || {}) };
    for (const k of EDIT_KEYS) if (body?.edits && typeof body.edits[k] !== "undefined") payload[k] = body.edits[k];

    // External sends: the final confirm must come from the screen that showed the exact text.
    if (pa.kind === "send_email") {
      const to = body?.test ? C.TEST_EMAIL : str(payload.to).trim();
      if (!validEmail(to)) return Response.json({ error: "Add a valid recipient email before approving" }, { status: 400 });
      if (!str(payload.subject).trim() || !str(payload.body).trim()) return Response.json({ error: "Subject and message are required" }, { status: 400 });
      if (!body?.confirm) return Response.json({ code: "confirm_required", preview: { to, subject: payload.subject, body: payload.body } }, { status: 428 });
      if (body?.test) {
        await base44.asServiceRole.integrations.Core.SendEmail({ to, subject: `[TEST] ${payload.subject}`, body: emailHtml(payload.body), from_name: SENDER_NAME });
        await audit(db, { actor, action: "email_test", entity: "ProposedAction", record_id: pa.id, summary: `Test send to ${to}: ${payload.subject}`, proposed_action_id: pa.id });
        if (body?.edits) await db.ProposedAction.update(pa.id, { payload });
        return Response.json({ ok: true, test: true, to });
      }
    }

    await db.ProposedAction.update(pa.id, { status: "approved", approved_by: actor, approved_at: nowIso(), payload });
    let result: Record<string, unknown> = {};
    let status = "executed";
    try {
      switch (pa.kind) {
        case "send_email": {
          const to = str(payload.to).trim();
          await base44.asServiceRole.integrations.Core.SendEmail({ to, subject: payload.subject, body: emailHtml(payload.body), from_name: SENDER_NAME });
          const log = await audit(db, { actor, action: "email_sent", entity: "ProposedAction", record_id: pa.id, summary: `Email to ${to}: ${payload.subject}`, after: { to, subject: payload.subject }, proposed_action_id: pa.id, undo: null });
          if (payload.client_id) {
            const c = await db.CRMClient.get(String(payload.client_id)).catch(() => null);
            if (c) await db.CRMClient.update(c.id, { notes: [...(c.notes || []), { id: Date.now(), text: `Email sent from Command: "${payload.subject}"`, date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }] }).catch(() => null);
          }
          result = { to, audit_id: log?.id };
          break;
        }
        case "send_sms": {
          const phone = str(payload.phone).replace(/[^\d+]/g, "");
          if (phone.length < 7) throw new Error("Add a phone number first");
          result = { sms_url: `sms:${phone}?&body=${encodeURIComponent(str(payload.body))}`, channel: "sms_handoff" };
          await audit(db, { actor, action: "sms_handoff", entity: "ProposedAction", record_id: pa.id, summary: `Text draft handed to Messages for ${phone}`, proposed_action_id: pa.id });
          break;
        }
        case "record_change": {
          result = { changed: await applyChanges(db, payload.changes || [], actor, pa.id) };
          break;
        }
        case "create_task": {
          const t = payload.task || {};
          const created = await db.Task.create({ title: str(t.title || payload.title).slice(0, 200), status: t.status || "next", priority: Number(t.priority) || 3, due_date: t.due_date || payload.due_date || null, client_id: t.client_id || null, client_name: t.client_name || null, category: t.category || "ops", source: "ai", notes: "Created from Møthership Command" });
          const log = await audit(db, { actor, action: "task_created", entity: "Task", record_id: created.id, summary: `Task: ${created.title}`, proposed_action_id: pa.id, undo: { entity: "Task", id: created.id, patch: { status: "done", labels: ["undone"] } } });
          result = { task_id: created.id, audit_id: log?.id };
          break;
        }
        case "log_expense": {
          const x = payload.expense || payload;
          const amount = Number(x.amount);
          if (!str(x.platform).trim() || !(amount > 0)) throw new Error("An expense needs a name and an amount");
          const created = await db.Expense.create({ platform: str(x.platform).slice(0, 120), amount, frequency: ["Monthly", "Quarterly", "Annually"].includes(x.frequency) ? x.frequency : "Monthly", dueDay: Number(x.dueDay) || new Date().getDate(), dueMonth: x.dueMonth || null, category: str(x.category || "Operations"), paidCycles: [] });
          const log = await audit(db, { actor, action: "expense_logged", entity: "Expense", record_id: created.id, summary: `Expense: ${created.platform} ${amount}`, proposed_action_id: pa.id, undo: null });
          result = { expense_id: created.id, audit_id: log?.id };
          break;
        }
        case "client_note": {
          const c = await db.CRMClient.get(String(payload.client_id));
          if (!c) throw new Error("Client not found");
          const notes = [...(c.notes || []), { id: Date.now(), text: str(payload.body || payload.text).slice(0, 2000), date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) }];
          result = { changed: await applyChanges(db, [{ entity: "CRMClient", id: c.id, label: `${c.business} note`, patch: { notes } }], actor, pa.id) };
          break;
        }
        case "choice": {
          const opt = (payload.options || [])[Number(body?.option)];
          if (!opt) throw new Error("Pick an option");
          const eff = opt.effect || { type: "none" };
          if (eff.type === "record_change") result = { changed: await applyChanges(db, eff.changes || [], actor, pa.id) };
          else if (eff.type === "create_task") {
            const t = eff.task || {};
            const created = await db.Task.create({ title: str(t.title).slice(0, 200) || "Untitled task", status: "next", priority: Number(t.priority) || 3, due_date: t.due_date || null, client_id: t.client_id || null, client_name: t.client_name || null, category: t.category || "ops", source: "voice", notes: "Placed from a Needs-you card" });
            const log = await audit(db, { actor, action: "task_created", entity: "Task", record_id: created.id, summary: `Task: ${created.title}`, proposed_action_id: pa.id, undo: { entity: "Task", id: created.id, patch: { status: "done", labels: ["undone"] } } });
            result = { task_id: created.id, changed: [{ entity: "Task", id: created.id, audit_id: log?.id }] };
          }
          else if (eff.type === "plan_block" && eff.day === "today") {
            const out = await generateBrief(base44, user, { useLlm: false, reason: "block added", extraBlock: { title: eff.title, minutes: eff.minutes, pillar: eff.pillar, kind: "admin" } });
            result = { replanned: true, version: out.brief.version };
          } else if (eff.type === "plan_block") {
            const tz = C.TZ_DEFAULT;
            const due = C.addDays(C.zonedParts(new Date(), tz).date, 1);
            const t = await db.Task.create({ title: eff.title, status: "next", priority: 2, due_date: due, category: "ops", source: "ai", notes: "Planned from Møthership Command" });
            await audit(db, { actor, action: "task_created", entity: "Task", record_id: t.id, summary: `Task for tomorrow: ${t.title}`, proposed_action_id: pa.id, undo: { entity: "Task", id: t.id, patch: { status: "done", labels: ["undone"] } } });
            result = { task_id: t.id };
          }
          result = { ...result, chose: opt.label };
          await audit(db, { actor, action: "choice", entity: "ProposedAction", record_id: pa.id, summary: `${pa.title} → ${opt.label}`, proposed_action_id: pa.id });
          break;
        }
        case "question": {
          const answer = str(body?.raw_text || body?.answer).trim();
          if (!answer) throw new Error("Type or say an answer");
          const statements = (Array.isArray(body?.statements) && body.statements.length ? body.statements : [answer]).map((x: any) => str(x).trim().slice(0, 1000)).filter(Boolean).slice(0, 3);
          const pillar = C.PILLAR_IDS.includes(pa.pillar) ? pa.pillar : "owner";
          const key = str(payload.question_key) || null;
          if (key) {
            const old = await db.BrainFact.filter({ question_key: key, status: "active" }, "-created_date", 20).catch(() => []);
            for (const f of old || []) await db.BrainFact.update(f.id, { status: "superseded" }).catch(() => null);
          }
          const data = C.factData(key, answer, statements.join(" "));
          const clientName = str(body?.client_name || payload.client_name).slice(0, 120);
          let fact: any = null;
          for (const statement of statements) {
            fact = await db.BrainFact.create({ pillar, statement, raw_text: answer.slice(0, 4000), question: str(payload.question).slice(0, 400), question_key: key, source: "interview", confidence: "high", date: C.zonedParts(new Date(), C.TZ_DEFAULT).date, status: "active", ...(clientName ? { client_name: clientName } : {}), ...(data ? { data } : {}) });
            await audit(db, { actor, action: "fact_saved", entity: "BrainFact", record_id: fact.id, summary: `[${pillar}] ${statement.slice(0, 160)}`, proposed_action_id: pa.id, undo: { entity: "BrainFact", id: fact.id, patch: { status: "superseded" } } });
          }
          if (payload.launch_item_id) await applyChanges(db, [{ entity: "LaunchItem", id: payload.launch_item_id, label: pa.title, patch: { answer: answer.slice(0, 2000), answered_at: "$now" } }], actor, pa.id).catch(() => null);
          status = "answered";
          result = { fact_id: fact.id };
          await db.ProposedAction.update(pa.id, { answer: answer.slice(0, 2000) });
          break;
        }
        default:
          throw new Error(`Unknown card type ${pa.kind}`);
      }
    } catch (e) {
      const msg = (e as Error).message || "Failed";
      await db.ProposedAction.update(pa.id, { status: "failed", error: msg });
      await audit(db, { actor, action: "failed", entity: "ProposedAction", record_id: pa.id, summary: `${pa.title}: ${msg}`, proposed_action_id: pa.id, ok: false });
      return Response.json({ error: msg }, { status: 400 });
    }
    await db.ProposedAction.update(pa.id, { status, executed_at: nowIso(), result, error: "" });
    return Response.json({ ok: true, status, result });
  } catch (e) {
    console.error("command-execute", (e as Error)?.message);
    return Response.json({ error: (e as Error)?.message || "Failed" }, { status: 500 });
  }
});
