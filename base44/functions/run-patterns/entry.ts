import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { addDays } from "../../shared/patterns.ts";
import { requireAdmin } from "../../shared/assistant.ts";

const itemsOf = (page: any) => (Array.isArray(page) ? page : (page && page.items) || []);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { denied } = await requireAdmin(base44);
    if (denied) return denied;

    const today = new Date();
    const todayIso = today.toISOString().slice(0, 10);

    const items = itemsOf(await base44.entities.RecurringPattern.filter({ status: "enabled" }, { limit: 200 }));

    let created = 0;
    let skipped = 0;

    for (const pattern of items) {
      const due = pattern.next_due_date ? String(pattern.next_due_date).slice(0, 10) : todayIso;
      if (due > todayIso) {
        skipped += 1;
        continue;
      }

      const existing = itemsOf(
        await base44.entities.Task.filter({ recurring_pattern_id: pattern.id, created_date: { $gte: todayIso } }, { limit: 1 })
      );
      if (existing.length) {
        skipped += 1;
        continue;
      }

      const cadence = Number(pattern.cadence_days) || 7;
      await base44.entities.Task.create({
        title: pattern.title,
        category: pattern.category,
        task_type: pattern.task_type,
        priority: pattern.priority,
        project_id: pattern.project_id || null,
        project_name: pattern.project_name || null,
        client_id: pattern.client_id || null,
        client_name: pattern.client_name || null,
        labels: pattern.labels || [],
        source: "automation",
        status: "next",
        due_date: addDays(today, cadence),
        recurring_pattern_id: pattern.id
      });

      await base44.entities.RecurringPattern.update(pattern.id, {
        last_created_date: todayIso,
        next_due_date: addDays(today, cadence)
      });
      created += 1;
    }

    return Response.json({ created, skipped, ran_at: todayIso });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
