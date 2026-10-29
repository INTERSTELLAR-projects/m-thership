import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { TASK_CATEGORIES, requireAdmin } from "../../shared/assistant.ts";

const SCHEMA = {
  type: "object",
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          category: { type: "string", enum: TASK_CATEGORIES },
          priority: { type: "number" },
          estimated_days: { type: "number" },
          offset_days: { type: "number" }
        },
        required: ["title", "category"]
      }
    }
  },
  required: ["items"]
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { denied } = await requireAdmin(base44);
    if (denied) return denied;

    const body = await req.json().catch(() => ({}));
    const type = String(body && body.project_type ? body.project_type : "website").slice(0, 40);
    const title = String(body && body.project_title ? body.project_title : "").slice(0, 120);
    const client = String(body && body.client_name ? body.client_name : "").slice(0, 80);
    const count = Math.min(14, Math.max(3, Number(body && body.count) || 9));

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: [
        "You are the operations lead at a creative agency. Write the standard operating procedure checklist for delivering this kind of work.",
        "Work type: " + type + ". Project: " + (title || "(unnamed)") + ". Client: " + (client || "(internal)") + ".",
        "Return exactly " + count + " tasks in delivery order, from kickoff to handoff and post launch follow up.",
        "Each task: a short imperative title (max 8 words), one category from " + TASK_CATEGORIES.join(", ") + ", priority 1 (critical) to 4 (low), estimated_days as a realistic working-day estimate (can be a decimal), and offset_days = working days after kickoff when it starts.",
        "Be concrete and practical, no filler tasks, no duplicate work, no emoji. Return only the JSON object."
      ].join("\n"),
      response_json_schema: SCHEMA
    });

    const items = Array.isArray(result && result.items) ? result.items.slice(0, 14) : [];
    return Response.json({
      items: items.map((item: any) => ({
        title: String(item.title || "").slice(0, 90),
        category: TASK_CATEGORIES.includes(item.category) ? item.category : "ops",
        priority: Math.min(4, Math.max(1, Math.round(Number(item.priority) || 3))),
        estimated_days: Number(item.estimated_days) || 0,
        offset_days: Number(item.offset_days) || 0
      }))
    });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
