import { base44 } from "@/api/base44Client";

export async function applySop({ template, project }) {
  const items = Array.isArray(template && template.items) ? template.items : [];
  if (!items.length) return 0;
  const base = project.start_date ? new Date(project.start_date + "T12:00:00") : new Date();
  const docs = items.map((item) => {
    const offset = Number(item.offset_days) || 0;
    const due = new Date(base.getTime() + offset * 86400000);
    return {
      title: item.title,
      category: item.category || "ops",
      priority: Number(item.priority) || 3,
      estimated_days: Number(item.estimated_days) || 0,
      status: "next",
      source: "sop",
      project_id: project.id,
      project_name: project.title,
      client_id: project.client_id || null,
      client_name: project.client_name || null,
      due_date: due.toISOString().slice(0, 10),
      labels: []
    };
  });
  await base44.entities.Task.bulkCreate(docs);
  await base44.entities.TaskTemplate.update(template.id, {
    times_applied: (Number(template.times_applied) || 0) + 1
  });
  return docs.length;
}
