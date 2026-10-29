import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { signatureOf, medianGap, roundCadence, mostFrequent, isoDate, addDays } from "../../shared/patterns.ts";
import { requireAdmin } from "../../shared/assistant.ts";

const itemsOf = (page: any) => (Array.isArray(page) ? page : (page && page.items) || []);

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { denied } = await requireAdmin(base44);
    if (denied) return denied;

    const items = itemsOf(await base44.entities.Task.filter({}, { sort: "-created_date", limit: 500 }));

    const groups = new Map();
    for (const task of items) {
      const signature = signatureOf(task.title);
      if (!signature) continue;
      if (!groups.has(signature)) groups.set(signature, []);
      groups.get(signature).push(task);
    }

    const candidates: any[] = [];
    for (const [signature, tasks] of groups) {
      if (tasks.length < 3) continue;
      const daySet = new Set(tasks.map((task: any) => String(task.created_date || "").slice(0, 10)));
      if (daySet.size < 2) continue;

      const sorted = [...tasks].sort((a: any, b: any) => new Date(a.created_date || 0).getTime() - new Date(b.created_date || 0).getTime());
      const gaps: number[] = [];
      for (let i = 1; i < sorted.length; i += 1) {
        const prev = new Date(sorted[i - 1].created_date || 0).getTime();
        const curr = new Date(sorted[i].created_date || 0).getTime();
        gaps.push((curr - prev) / 86400000);
      }
      const cadence = roundCadence(medianGap(gaps));
      const lastSeenRaw = sorted[sorted.length - 1].created_date || new Date().toISOString();
      const lastSeen = isoDate(lastSeenRaw);

      const project = tasks.find((task: any) => task.project_id);
      const client = tasks.find((task: any) => task.client_id);

      candidates.push({
        signature,
        title: mostFrequent(tasks.map((task: any) => task.title)) || tasks[0].title,
        category: mostFrequent(tasks.map((task: any) => task.category).filter(Boolean)) || "ops",
        task_type: mostFrequent(tasks.map((task: any) => task.task_type).filter(Boolean)) || "billable",
        priority: mostFrequent(tasks.map((task: any) => Number(task.priority)).filter((n: number) => !isNaN(n))) || 3,
        project_id: project ? project.project_id : null,
        project_name: project ? project.project_name : null,
        client_id: client ? client.client_id : null,
        client_name: client ? client.client_name : null,
        labels: tasks
          .flatMap((task: any) => (Array.isArray(task.labels) ? task.labels : []))
          .filter((label: string) => !String(label).startsWith("legacy:"))
          .filter((label: string, index: number, array: string[]) => array.indexOf(label) === index)
          .slice(0, 5),
        cadence_days: cadence,
        occurrences: tasks.length,
        last_seen_date: lastSeen,
        next_due_date: addDays(new Date(lastSeenRaw), cadence),
        sample_titles: Array.from(new Set(tasks.map((task: any) => task.title))).slice(0, 4)
      });
    }

    if (!candidates.length) return Response.json({ detected: 0, created: 0, updated: 0 });

    const signatures = candidates.map((candidate) => candidate.signature);
    const existing = itemsOf(await base44.entities.RecurringPattern.filter({ signature: { $in: signatures } }, { limit: 200 }));
    const bySignature = new Map(existing.map((pattern: any) => [pattern.signature, pattern]));

    let created = 0;
    let updated = 0;
    for (const candidate of candidates) {
      const prior: any = bySignature.get(candidate.signature);
      if (prior) {
        await base44.entities.RecurringPattern.update(prior.id, {
          occurrences: candidate.occurrences,
          last_seen_date: candidate.last_seen_date,
          cadence_days: candidate.cadence_days,
          sample_titles: candidate.sample_titles,
          category: candidate.category,
          task_type: candidate.task_type,
          priority: candidate.priority
        });
        updated += 1;
      } else {
        await base44.entities.RecurringPattern.create({ ...candidate, status: "suggested" });
        created += 1;
      }
    }

    return Response.json({ detected: candidates.length, created, updated });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
