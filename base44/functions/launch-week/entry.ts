import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import * as L from "../../shared/launchWeek.js";
import * as C from "../../shared/command.js";
import { requireAdmin, audit } from "../../shared/commandServer.ts";

// Launch Week board (admin only).
//   { action: "board" } -> { clients: LaunchClientStatus[], questions: LaunchQuestion[] }
//   { action: "import", files: [{ slug, json, screenshots? }] } -> upserts by question_id (never duplicates)
//   { action: "answer", id, statements[], raw_text, mode: default|option|voice|typed|exact }
//       -> saves the answer, a client-tagged BrainFact, and queues the ClaudeJob when the client's blocking questions are done
//   { action: "status", id, status: open|ask_client|skipped }
// The clean-up step for dictated answers is the Brain's (command-brain action "clean"), so nothing is forked.

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { user, denied } = await requireAdmin(base44);
    if (denied) return denied;
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || "board");
    const db = base44.asServiceRole.entities;
    const today = C.zonedParts(new Date(), C.TZ_DEFAULT).date;

    if (action === "board") {
      const [clients, questions] = await Promise.all([db.LaunchClientStatus.list("order", 50), db.LaunchQuestion.list("order", 1000)]);
      return Response.json({ clients: clients || [], questions: questions || [] });
    }

    if (action === "import") {
      const files = Array.isArray(body?.files) ? body.files.slice(0, 20) : [];
      if (!files.length) return Response.json({ error: "No files" }, { status: 400 });
      const crm = await db.CRMClient.list("-updated_date", 300).catch(() => []);
      const out = [];
      for (const f of files) {
        const slug = String(f?.slug || "");
        try {
          const json = typeof f?.json === "string" ? JSON.parse(f.json) : f?.json;
          out.push(await L.lwImport(db, json, slug, { clients: crm || [], screenshots: f?.screenshots }));
        } catch (e) { out.push({ slug, error: (e as Error).message }); }
      }
      await audit(db, { actor: user.email, action: "launch_week_import", entity: "LaunchQuestion", summary: out.map((r: any) => `${r.slug}: ${r.error ? "error" : `${r.created} new, ${r.updated} updated`}`).join("; ") });
      return Response.json({ results: out });
    }

    if (action === "answer") {
      const r = await L.lwAnswer(db, String(body?.id || ""), { statements: body?.statements, raw_text: body?.raw_text, mode: String(body?.mode || "typed"), today });
      await audit(db, { actor: user.email, action: "fact_saved", entity: "LaunchQuestion", record_id: r.question.id, summary: `[Launch Week · ${r.question.client_name}] ${String(r.question.answer).slice(0, 140)}` });
      if (r.job?.created) await audit(db, { actor: user.email, action: "claude_job_queued", entity: "ClaudeJob", record_id: r.job.id, summary: L.lwJobTitle(r.question.client_name) });
      return Response.json(r);
    }

    if (action === "status") {
      const r = await L.lwSetStatus(db, String(body?.id || ""), String(body?.status || ""));
      return Response.json(r);
    }

    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    const msg = (e as Error)?.message || "Launch Week failed";
    const bad = /not found|Say or type|password|Unknown/.test(msg);
    if (!bad) console.error("launch-week", msg);
    return Response.json({ error: msg }, { status: bad ? 400 : 500 });
  }
});
