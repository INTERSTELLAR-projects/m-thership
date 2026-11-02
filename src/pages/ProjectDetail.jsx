import React, { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, Check, Pencil, Plus, Sparkles, Target } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import Panel from "@/features/tasks/ui-kit/Panel";
import StatCard from "@/features/tasks/ui-kit/StatCard";
import RollButton from "@/features/tasks/ui-kit/RollButton";
import ProjectTaskList from "@/features/tasks/components/ProjectTaskList";
import TaskFormDialog from "@/features/tasks/components/TaskFormDialog";
import ProjectFormDialog from "@/features/tasks/components/ProjectFormDialog";
import ApplyTemplateDialog from "@/features/tasks/components/ApplyTemplateDialog";
import { projectStatusMeta, projectTypeMeta, statusPatch } from "@/features/tasks/lib/constants";
import { settleTimer } from "@/features/tasks/lib/timer";
import { moneyFull, percent, hours as hoursLabel, longDate } from "@/features/tasks/lib/format";
import { fmtMinutes, itemMinutes } from "@/features/tasks/lib/estimate";
import { applySop } from "@/features/tasks/lib/applySop";
import { fetchClients, itemsOf } from "@/features/tasks/lib/clients";
import { btnGhost } from "@/features/tasks/lib/ui";

export default function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [clients, setClients] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [missing, setMissing] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [plan, setPlan] = useState(null);
  const [taskDialog, setTaskDialog] = useState({ open: false, initial: null, parent: null });
  const [editOpen, setEditOpen] = useState(false);
  const [sopOpen, setSopOpen] = useState(false);

  const load = useCallback(async () => {
    const [record, taskPage, clientRows, templatePage] = await Promise.all([
      base44.entities.Project.get(id).catch((error) => {
        const status = (error && error.status) || (error && error.response && error.response.status);
        return status === 404 ? null : Promise.reject(error);
      }),
      base44.entities.Task.filter({ project_id: id }, { sort: "priority", limit: 300 }),
      fetchClients(),
      base44.entities.TaskTemplate.list({ sort: "-times_applied", limit: 50 })
    ]);
    if (!record) {
      setMissing(true);
      return;
    }
    setProject(record);
    setTasks(itemsOf(taskPage));
    setClients(clientRows);
    setTemplates(itemsOf(templatePage));
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const syncProgress = async (rows) => {
    if (!project) return;
    const progress = percent(rows.filter((t) => t.status === "done").length, rows.length);
    if (progress !== Number(project.progress || 0)) {
      setProject((prev) => (prev ? { ...prev, progress } : prev));
      await base44.entities.Project.update(project.id, { progress }).catch(() => {});
    }
  };

  const refreshTasks = async () => {
    const page = await base44.entities.Task.filter({ project_id: id }, { sort: "priority", limit: 300 });
    const rows = itemsOf(page);
    setTasks(rows);
    syncProgress(rows);
  };

  const toggleTask = async (task) => {
    const patch = statusPatch(task.status === "done" ? "next" : "done");
    const rows = tasks.map((row) => (row.id === task.id ? { ...row, ...patch } : row));
    setTasks(rows);
    if (patch.status === "done") await settleTimer(task);
    await base44.entities.Task.update(task.id, patch);
    syncProgress(rows);
  };

  const runSop = async (template) => {
    setBusyId(template.id);
    try {
      await applySop({ template, project });
      await refreshTasks();
    } finally {
      setBusyId(null);
      setSopOpen(false);
    }
  };

  const draftPlan = async () => {
    setPlan({ loading: true, items: [] });
    try {
      const response = await base44.functions.invoke("suggest-checklist", {
        project_type: project.type,
        project_title: project.title,
        client_name: project.client_name || "",
        count: 9
      });
      const data = (response && response.data) || {};
      setPlan({ loading: false, items: Array.isArray(data.items) ? data.items : [] });
    } catch (error) {
      setPlan({ loading: false, items: [], error: true });
    }
  };

  const commitPlan = async () => {
    const items = (plan && plan.items) || [];
    if (!items.length) return;
    const base = project.start_date ? new Date(project.start_date + "T12:00:00") : new Date();
    await base44.entities.Task.bulkCreate(
      items.map((item) => {
        const offset = Number(item.offset_days) || 0;
        return {
          title: item.title,
          category: item.category || "ops",
          priority: Number(item.priority) || 3,
          estimated_days: Number(item.estimated_days) || 0,
          estimated_minutes: (Number(item.estimated_days) || 0) * 480,
          project_type: project.type || null,
          status: "next",
          source: "ai",
          project_id: project.id,
          project_name: project.title,
          client_id: project.client_id || null,
          client_name: project.client_name || null,
          due_date: new Date(base.getTime() + offset * 86400000).toISOString().slice(0, 10)
        };
      })
    );
    setPlan(null);
    await refreshTasks();
  };

  if (missing) {
    return (
      <div className="min-h-screen">
        <PageHeader breadcrumb="Command / Projects / Not found" />
        <div className="px-5 py-24 text-center md:px-8">
          <p className="text-[20px] font-semibold tracking-[-0.03em] text-ink">That project is no longer in the system.</p>
          <Link to="/projects" className="mono-label mt-4 inline-block text-[10.5px] text-[#ff3c00]">
            Back to projects
          </Link>
        </div>
      </div>
    );
  }

  if (!project) {
    return <p className="py-24 text-center text-[12.5px] text-ink/45">Loading project...</p>;
  }

  const type = projectTypeMeta(project.type);
  const status = projectStatusMeta(project.status);
  const done = tasks.filter((task) => task.status === "done").length;
  const projectedMin = tasks.reduce((sum, task) => sum + itemMinutes(task), 0);
  const loggedSec = tasks.reduce((sum, task) => sum + (Number(task.logged_seconds) || 0), 0);

  return (
    <div className="min-h-screen pb-24">
      <PageHeader breadcrumb="Command / Projects" title={project.title} rightText={(project.client_name || "Internal") + " · due " + longDate(project.due_date)}>
        <button type="button" onClick={draftPlan} className={btnGhost}>
          <Sparkles className="h-3.5 w-3.5 text-[#ff3c00]" />
          Draft plan
        </button>
        <button type="button" onClick={() => setSopOpen(true)} className={btnGhost}>
          <BookOpen className="h-3.5 w-3.5" />
          Run SOP
        </button>
        <button type="button" onClick={() => setEditOpen(true)} className={btnGhost}>
          <Pencil className="h-3.5 w-3.5" />
          Edit
        </button>
        <RollButton label="Add task" icon={Plus} onClick={() => setTaskDialog({ open: true, initial: null, parent: null })} />
      </PageHeader>

      <div className="space-y-5 px-5 py-6 md:px-8">
        <div className="flex flex-wrap items-center gap-3">
          <Link to="/projects" className="mono-label inline-flex items-center gap-2 text-[10px] text-ink/50 transition-colors hover:text-ink">
            <ArrowLeft className="h-3.5 w-3.5" />
            All projects
          </Link>
          <span className="mono-label flex items-center gap-1.5 text-[10px] text-ink/60">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: type.color }} />
            {type.label}
          </span>
          <span className="mono-label rounded-sm border px-2 py-[2px] text-[9.5px]" style={{ borderColor: status.color + "40", color: status.color, background: status.color + "10" }}>
            {status.label}
          </span>
          {project.is_focus ? (
            <span className="flex items-center gap-1 text-[11px] text-[#ff3c00]">
              <Target className="h-3 w-3" />
              focus
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Contract value" value={moneyFull(project.contract_value)} hint={project.billing} />
          <StatCard label="Projected work" value={projectedMin ? fmtMinutes(projectedMin) : hoursLabel(project.estimated_hours)} hint={projectedMin ? Math.round(projectedMin / 60) + "h across " + tasks.length + " steps" : "no estimates yet"} accent="#1a1a1a" />
          <StatCard label="Clocked so far" value={loggedSec ? fmtMinutes(loggedSec / 60) : hoursLabel(project.logged_hours)} hint={projectedMin && loggedSec ? Math.round((loggedSec / 60 / projectedMin) * 100) + "% of estimate" : "start a task clock to track it"} accent={projectedMin && loggedSec / 60 > projectedMin ? "#ff3c00" : "#b45309"} />
          <StatCard label="Completion" value={percent(done, tasks.length) + "%"} hint={done + " of " + tasks.length + " steps"} accent="#15803d" />
        </div>

        {plan ? (
          <Panel
            kicker="AI drafted delivery plan"
            title={plan.loading ? "Reading how this kind of work ships..." : (plan.items.length || 0) + " steps proposed"}
            action={
              plan.items && plan.items.length ? (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setPlan(null)} className={btnGhost}>
                    Discard
                  </button>
                  <RollButton label="Add all" icon={Check} onClick={commitPlan} />
                </div>
              ) : (
                <button type="button" onClick={() => setPlan(null)} className={btnGhost}>
                  Close
                </button>
              )
            }
          >
            {plan.loading ? (
              <p className="text-[12.5px] text-ink/50">Drafting...</p>
            ) : plan.items && plan.items.length ? (
              <ol className="space-y-2">
                {plan.items.map((item, index) => (
                  <li key={item.title + index} className="flex items-start gap-3 text-[12.5px] text-ink/80">
                    <span className="mono-label mt-[2px] text-[9.5px] text-ink/40">{String(index + 1).padStart(2, "0")}</span>
                    <span className="flex-1">{item.title}</span>
                    <span className="text-ink/45">{item.category}</span>
                    <span className="text-ink/45">{item.estimated_days}d</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-[12.5px] text-ink/50">The core could not draft a plan for this one.</p>
            )}
          </Panel>
        ) : null}

        {project.description ? (
          <Panel kicker="Scope" title="Brief">
            <p className="whitespace-pre-line text-[13px] leading-relaxed text-ink/70">{project.description}</p>
          </Panel>
        ) : null}

        <Panel kicker="Delivery" title={tasks.length + " steps"} bodyClassName="p-0">
          <ProjectTaskList
            tasks={tasks}
            onToggle={toggleTask}
            onEdit={(task) => setTaskDialog({ open: true, initial: task, parent: null })}
            onAddSubtask={(task) => setTaskDialog({ open: true, initial: null, parent: task.id })}
            onAdd={() => setTaskDialog({ open: true, initial: null, parent: null })}
            onPatch={(task, patch) => setTasks((prev) => prev.map((row) => (row.id === task.id ? { ...row, ...patch } : row)))}
          />
        </Panel>
      </div>

      <TaskFormDialog
        open={taskDialog.open}
        onOpenChange={(open) => setTaskDialog((prev) => ({ ...prev, open }))}
        projects={[project]}
        clients={clients}
        lockProject={project.id}
        initial={
          taskDialog.initial ||
          (taskDialog.parent
            ? { parent_task_id: taskDialog.parent, project_id: project.id, client_id: project.client_id || "", status: "next" }
            : { project_id: project.id, client_id: project.client_id || "" })
        }
        onSaved={refreshTasks}
      />

      <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} clients={clients} initial={project} onSaved={load} />
      <ApplyTemplateDialog open={sopOpen} onOpenChange={setSopOpen} templates={templates} onApply={runSop} busyId={busyId} />
    </div>
  );
}
