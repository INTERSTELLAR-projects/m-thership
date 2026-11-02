import React, { useCallback, useEffect, useState } from "react";
import { Plus, Search } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "@/components/PageHeader";
import TasksNav from "@/features/tasks/components/TasksNav";
import ProjectCard from "@/features/tasks/components/ProjectCard";
import ProjectFormDialog from "@/features/tasks/components/ProjectFormDialog";
import EmptyState from "@/features/tasks/ui-kit/EmptyState";
import RollButton from "@/features/tasks/ui-kit/RollButton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PROJECT_STATUSES, PROJECT_TYPES } from "@/features/tasks/lib/constants";
import { fetchClients, itemsOf } from "@/features/tasks/lib/clients";
import { inputClass, selectContentClass, selectItemClass, selectTriggerClass } from "@/features/tasks/lib/ui";
import { money } from "@/features/tasks/lib/format";
import { cn } from "@/lib/utils";
import ProjectsHero from "@/features/projects/ProjectsHero";

const ALL = "__all__";

const toMap = (rows) =>
  (Array.isArray(rows) ? rows : []).reduce((acc, row) => {
    if (row.project_id) acc[row.project_id] = row.count || 0;
    return acc;
  }, {});

export default function Projects() {
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [counts, setCounts] = useState({});
  const [doneCounts, setDoneCounts] = useState({});
  const [taskTime, setTaskTime] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [type, setType] = useState(ALL);
  const [status, setStatus] = useState(ALL);
  const [dialogOpen, setDialogOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [projectPage, clientRows, taskAgg, doneAgg, taskRows] = await Promise.all([
        base44.entities.Project.list({ sort: "-updated_date", limit: 200 }),
        fetchClients(),
        base44.entities.Task.aggregate({ query: {}, groupBy: "project_id" }).catch(() => null),
        base44.entities.Task.aggregate({ query: { status: "done" }, groupBy: "project_id" }).catch(() => null),
        base44.entities.Task.list("-updated_date", 2000).catch(() => [])
      ]);
      const timeMap = {};
      itemsOf(taskRows).forEach((task) => {
        if (!task.project_id) return;
        const slot = timeMap[task.project_id] || (timeMap[task.project_id] = { seconds: 0, estMinutes: 0 });
        slot.seconds += Number(task.logged_seconds) || (Number(task.logged_hours) || 0) * 3600;
        slot.estMinutes += Number(task.estimated_minutes) || (Number(task.estimated_hours) || 0) * 60;
      });
      setTaskTime(timeMap);
      setProjects(itemsOf(projectPage));
      setClients(clientRows);
      setCounts(toMap(taskAgg && taskAgg.rows));
      setDoneCounts(toMap(doneAgg && doneAgg.rows));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const clientMap = clients.reduce((acc, client) => {
    acc[client.id] = client.name;
    return acc;
  }, {});

  const filtered = projects.filter((project) => {
    if (type !== ALL && project.type !== type) return false;
    if (status !== ALL && project.status !== status) return false;
    if (search.trim() && !(project.title || "").toLowerCase().includes(search.trim().toLowerCase())) return false;
    return true;
  });

  const live = filtered.filter((project) => project.status !== "done");
  const pipeline = live.reduce((sum, project) => sum + (Number(project.contract_value) || 0), 0);

  return (
    <div className="min-h-screen pb-24">
      <PageHeader breadcrumb="Command / Projects" title="Projects" rightText={live.length + " in flight · " + money(pipeline)}>
        <RollButton label="New project" icon={Plus} onClick={() => setDialogOpen(true)} />
      </PageHeader>
      <TasksNav />

      <div className="space-y-5 px-5 py-6 md:px-8">
        {loading && !projects.length ? null : (
          <ProjectsHero
            projects={projects}
            taskTime={taskTime}
            counts={counts}
            doneCounts={doneCounts}
            type={type}
            status={status}
            onType={setType}
            onStatus={setStatus}
            all={ALL}
          />
        )}

        <div className="flex flex-wrap items-center gap-2 rounded-md border border-hair bg-card p-3">
          <div className="relative min-w-[190px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink/35" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search projects" className={cn(inputClass, "pl-9")} />
          </div>
          <Select value={type} onValueChange={setType}>
            <SelectTrigger className={cn(selectTriggerClass, "w-[150px]")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
              <SelectItem className={selectItemClass} value={ALL}>All types</SelectItem>
              {PROJECT_TYPES.map((option) => (
                <SelectItem key={option.value} className={selectItemClass} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className={cn(selectTriggerClass, "w-[160px]")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
              <SelectItem className={selectItemClass} value={ALL}>All statuses</SelectItem>
              {PROJECT_STATUSES.map((option) => (
                <SelectItem key={option.value} className={selectItemClass} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <p className="py-16 text-center text-[12.5px] text-ink/45">Pulling live projects...</p>
        ) : filtered.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((project) => (
              <ProjectCard key={project.id} project={project} done={doneCounts[project.id] || 0} total={counts[project.id] || 0} clientName={clientMap[project.client_id]} />
            ))}
          </div>
        ) : (
          <EmptyState title="No projects match" hint="Change the filters, or start a new project and let the core draft the plan." />
        )}
      </div>

      <ProjectFormDialog open={dialogOpen} onOpenChange={setDialogOpen} clients={clients} initial={null} onSaved={load} />
    </div>
  );
}
