import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import TaskRail from "@/features/tasks/components/TaskRail";

// Mission Control: Focus now + Next up from the task engine.
export default function FocusWidget() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["Task", "mission-focus"],
    queryFn: async () => {
      const [focus, next] = await Promise.all([
        base44.entities.Task.filter({ is_focus: true, status: { $ne: "done" } }, "priority", 6),
        base44.entities.Task.filter({ status: "next" }, "priority", 6),
      ]);
      return { focus: focus || [], next: (next || []).filter((t) => !t.is_focus) };
    },
  });
  const complete = async (task) => {
    await base44.entities.Task.update(task.id, { status: "done", completed_at: new Date().toISOString(), is_focus: false });
    qc.invalidateQueries({ queryKey: ["Task"] });
  };
  return (
    <div className="px-5 pt-8 md:px-8">
      <div className="mb-4 flex items-end justify-between">
        <p className="label-cross">(Your tasks)</p>
        <Link to="/tasks" className="mono-label text-[10px] text-ink/50 hover:text-[#ff3c00]">Task matrix →</Link>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <TaskRail kicker="Focus" title="Focus now" tasks={q.data?.focus || []} emptyHint="Bolt a task on the Task matrix to pin it here." onComplete={complete} />
        <TaskRail kicker="Queue" title="Next up" tasks={q.data?.next || []} emptyHint="Nothing queued." onComplete={complete} />
      </div>
    </div>
  );
}
