import React, { useCallback, useEffect, useState } from "react";
import { Mic, MousePointerClick, RefreshCw } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import TasksNav from "@/features/tasks/components/TasksNav";
import TaskFilters from "@/features/tasks/components/TaskFilters";
import TaskTable from "@/features/tasks/components/TaskTable";
import TaskRail from "@/features/tasks/components/TaskRail";
import TaskFormDialog from "@/features/tasks/components/TaskFormDialog";
import AssistantDock from "@/features/tasks/assistant/AssistantDock";
import { AssistantProvider, useAssistant } from "@/features/tasks/assistant/AssistantContext";
import RollButton from "@/features/tasks/ui-kit/RollButton";
import { statusPatch } from "@/features/tasks/lib/constants";
import { fetchClients, itemsOf, TASKS_CHANGED } from "@/features/tasks/lib/clients";
import { btnGhost } from "@/features/tasks/lib/ui";

const ALL = "__all__";
const PAGE = 40;

function TaskBoardInner({ withDock = false }) {
  const assistant = useAssistant();
  const [filters, setFilters] = useState({ search: "", status: ALL, category: ALL, priority: ALL, client: ALL });
  const [tasks, setTasks] = useState([]);
  const [total, setTotal] = useState(0);
  const [cursor, setCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [focus, setFocus] = useState([]);
  const [next, setNext] = useState([]);
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);
  const [editing, setEditing] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const buildQuery = useCallback(() => {
    const query = {};
    if (filters.status !== ALL) query.status = filters.status;
    if (filters.category !== ALL) query.category = filters.category;
    if (filters.priority !== ALL) query.priority = Number(filters.priority);
    if (filters.client === "__none__") query.client_id = { $exists: false };
    else if (filters.client !== ALL) query.client_id = filters.client;
    if (filters.search.trim()) query.title = { $regex: filters.search.trim(), $options: "i" };
    return query;
  }, [filters]);

  const load = useCallback(
    async (nextCursor) => {
      setLoading(true);
      try {
        const query = buildQuery();
        // A cursor carries the original sort/query; later pages send only cursor + limit.
        const options = nextCursor ? { cursor: nextCursor, limit: PAGE } : { sort: "priority", limit: PAGE };
        const [page, count] = await Promise.all([base44.entities.Task.filter(query, options), base44.entities.Task.count(query)]);
        const items = itemsOf(page);
        setTasks((prev) => (nextCursor ? [...prev, ...items] : items));
        setCursor((page && page.next_cursor) || null);
        setHasMore(Boolean(page && page.has_more));
        setTotal(Number(count) || 0);
      } finally {
        setLoading(false);
      }
    },
    [buildQuery]
  );

  const loadRails = useCallback(async () => {
    const [focusPage, nextPage] = await Promise.all([
      base44.entities.Task.filter({ is_focus: true, status: { $ne: "done" } }, { sort: "priority", limit: 5 }),
      base44.entities.Task.filter({ status: "next" }, { sort: "priority", limit: 5 })
    ]);
    setFocus(itemsOf(focusPage));
    setNext(itemsOf(nextPage));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => load(null), 220);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    loadRails().catch(() => {});
    fetchClients().then(setClients);
    base44.entities.Project.filter({ status: { $ne: "done" } }, { sort: "-updated_date", limit: 150 })
      .then((res) => setProjects(itemsOf(res)))
      .catch(() => {});
  }, [loadRails]);

  // Voice commands (and anything else) can announce changes.
  useEffect(() => {
    const onChanged = () => {
      load(null);
      loadRails().catch(() => {});
    };
    window.addEventListener(TASKS_CHANGED, onChanged);
    return () => window.removeEventListener(TASKS_CHANGED, onChanged);
  }, [load, loadRails]);

  const patchLocal = (id, patch) => {
    setTasks((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setFocus((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
    setNext((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const updateTask = async (task, patch) => {
    patchLocal(task.id, patch);
    try {
      await base44.entities.Task.update(task.id, patch);
    } catch (error) {
      patchLocal(task.id, task);
    }
    if ("is_focus" in patch || "status" in patch) loadRails().catch(() => {});
  };

  const removeTask = async (task) => {
    setTasks((prev) => prev.filter((row) => row.id !== task.id));
    setFocus((prev) => prev.filter((row) => row.id !== task.id));
    setNext((prev) => prev.filter((row) => row.id !== task.id));
    setTotal((prev) => Math.max(0, prev - 1));
    await base44.entities.Task.delete(task.id);
  };

  const complete = async (task) => {
    const patch = statusPatch("done");
    setFocus((prev) => prev.filter((row) => row.id !== task.id));
    setNext((prev) => prev.filter((row) => row.id !== task.id));
    setTasks((prev) => prev.map((row) => (row.id === task.id ? { ...row, ...patch } : row)));
    await base44.entities.Task.update(task.id, patch);
  };

  const openEditor = (task) => {
    setEditing(task);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen pb-32">
      <PageHeader breadcrumb="Command / Tasks" title="Task Matrix" rightText={total + " tasks in the system"}>
        <button type="button" className={btnGhost} onClick={() => load(null)}>
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
        {assistant ? <RollButton label="Talk to the core" icon={Mic} onClick={assistant.startListening} /> : null}
      </PageHeader>
      <TasksNav />

      <div className="space-y-6 px-5 py-6 md:px-8">
        <div>
          <p className="label-cross mb-3">(Focus now)</p>
          <div className="grid gap-4 lg:grid-cols-2">
            <TaskRail
              kicker="Priority ladder"
              title="Focus now"
              tasks={focus}
              emptyHint="Flag a task with the bolt and it rides here above everything else."
              onComplete={complete}
              onOpen={openEditor}
              onPatch={(task, patch) => patchLocal(task.id, patch)}
            />
            <TaskRail
              kicker="Queued"
              title="Next up"
              tasks={next}
              emptyHint="Nothing queued. Speak a command and the core will fill this rail."
              onComplete={complete}
              onOpen={openEditor}
              onPatch={(task, patch) => patchLocal(task.id, patch)}
            />
          </div>
        </div>

        <div className="space-y-4">
          <p className="label-cross">(All tasks)</p>
          <TaskFilters
            filters={filters}
            setFilters={setFilters}
            clients={clients}
            onNew={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
          />

          {loading && !tasks.length ? (
            <p className="py-16 text-center text-[12.5px] text-ink/45">Reading the task field...</p>
          ) : (
            <TaskTable
              tasks={tasks}
              onEdit={openEditor}
              onStatus={(task, status) => updateTask(task, statusPatch(status))}
              onFocus={(task) => updateTask(task, { is_focus: !task.is_focus })}
              onDelete={removeTask}
              onPatch={(task, patch) => patchLocal(task.id, patch)}
            />
          )}

          {hasMore ? (
            <div className="flex justify-center">
              <button type="button" onClick={() => load(cursor)} disabled={loading} className={btnGhost}>
                <MousePointerClick className="h-3.5 w-3.5" />
                {loading ? "Loading..." : "Load more"}
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <TaskFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projects={projects}
        clients={clients}
        initial={editing}
        onSaved={() => {
          load(null);
          loadRails().catch(() => {});
        }}
      />

      {withDock ? <AssistantDock /> : null}
    </div>
  );
}

// If a global AssistantProvider (+ global AssistantDock) is mounted later, the page reuses it and
// does not render a second dock. Otherwise it scopes a provider and the dock to this page.
export default function TaskBoard() {
  const ctx = useAssistant();
  if (ctx) return <TaskBoardInner />;
  return (
    <AssistantProvider>
      <TaskBoardInner withDock />
    </AssistantProvider>
  );
}
