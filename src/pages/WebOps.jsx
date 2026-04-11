import { useState, useEffect } from "react";
import { Search, Plus, Loader2, ChevronDown, ChevronRight, AlertCircle, X, Check } from "lucide-react";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import ProjectDetail from "../components/webops/ProjectDetail";

const REQ_STATUSES = ["Pending", "In Progress", "Completed"];
const PROJ_STATUSES = ["Planning", "In Progress", "Review", "Completed", "On Hold", "Waiting on Client"];

const REQ_STATUS_COLOR = {
  Pending: "bg-white/5 text-white/40",
  "In Progress": "bg-orange-500/10 text-orange-400",
  Completed: "bg-green-500/10 text-green-400",
};

const PROJ_STATUS_COLOR = {
  Planning: "bg-blue-500/10 text-blue-400",
  "In Progress": "bg-orange-500/10 text-orange-400",
  Review: "bg-purple-500/10 text-purple-400",
  Completed: "bg-green-500/10 text-green-400",
  "On Hold": "bg-white/5 text-white/30",
  "Waiting on Client": "bg-yellow-500/10 text-yellow-400",
};

function PipelineBar({ stages, data, colorMap }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  return (
    <div className="space-y-2">
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {stages.map((s, i) => {
          const count = data[s] || 0;
          const pct = total === 0 ? 0 : (count / total) * 100;
          const colors = ["bg-white/10", "bg-blue-500/60", "bg-orange-500/60", "bg-green-500/60", "bg-purple-500/40"];
          return <div key={s} className={`${colors[i] || "bg-white/10"} transition-all`} style={{ width: `${pct}%`, minWidth: pct > 0 ? "4px" : "0" }} />;
        })}
      </div>
      <div className="flex gap-4 flex-wrap">
        {stages.map((s, i) => {
          const colors2 = ["text-white/30", "text-blue-400", "text-orange-400", "text-green-400", "text-purple-400"];
          return (
            <span key={s} className={`text-[10px] font-medium ${colors2[i] || "text-white/30"}`}>
              {s}: {data[s] || 0}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function WebOps() {
  const [requests, setRequests] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState(null);
  const [reqSearch, setReqSearch] = useState("");
  const [reqStatusFilter, setReqStatusFilter] = useState("All");
  const [reqPriorityFilter, setReqPriorityFilter] = useState("All");
  const [projSearch, setProjSearch] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);
  const [newProject, setNewProject] = useState({ name: "", clientName: "", projectType: "Website Update", status: "Planning", priority: "Standard" });

  useEffect(() => {
    Promise.all([
      base44.entities.CRMClient.list("business", 200),
      base44.entities.WebOpsProject.list("-created_date", 200),
    ]).then(([crmClients, dbProjects]) => {
      // Flatten all Web Øps requests from CRM
      const allRequests = crmClients.flatMap((client) =>
        (client.requests || [])
          .filter((r) =>
            r.formType?.toLowerCase().includes("web") ||
            r.title?.toLowerCase().includes("web") ||
            r.formType?.toLowerCase().includes("øps") ||
            r.formType?.toLowerCase().includes("ops")
          )
          .map((r, i) => ({
            ...r,
            _uid: `${client.id}-${i}`,
            clientName: client.business,
            clientId: client.id,
          }))
      );
      setRequests(allRequests);
      setProjects(dbProjects);
      setLoading(false);
    });
  }, []);

  const updateRequestStatus = async (req, newStatus) => {
    // Update in CRM client
    const client = await base44.entities.CRMClient.filter({ id: req.clientId }, "business", 1);
    if (client.length > 0) {
      const c = client[0];
      const updatedRequests = (c.requests || []).map((r, i) =>
        `${c.id}-${i}` === req._uid ? { ...r, status: newStatus } : r
      );
      await base44.entities.CRMClient.update(c.id, { requests: updatedRequests });
    }
    setRequests((prev) => prev.map((r) => r._uid === req._uid ? { ...r, status: newStatus } : r));
  };

  const addProject = async () => {
    if (!newProject.name.trim()) return;
    const created = await base44.entities.WebOpsProject.create({ ...newProject, progress: 0, tasks: [] });
    setProjects((prev) => [...prev, created]);
    setNewProject({ name: "", clientName: "", projectType: "Website Update", status: "Planning", priority: "Standard" });
    setAddProjectOpen(false);
  };

  const updateProject = (updated) => {
    setProjects((prev) => prev.map((p) => p.id === updated.id ? updated : p));
    setSelectedProject(updated);
  };

  // Stats
  const activeReqs = requests.filter((r) => r.status !== "Completed");
  const activeProjs = projects.filter((p) => p.status !== "Completed");
  const reqPipeline = REQ_STATUSES.reduce((acc, s) => { acc[s] = requests.filter((r) => r.status === s).length; return acc; }, {});
  const projPipeline = ["Planning", "In Progress", "Review", "Completed"].reduce((acc, s) => { acc[s] = projects.filter((p) => p.status === s).length; return acc; }, {});
  const now = new Date();
  const completedThisMonth = [
    ...requests.filter((r) => r.status === "Completed"),
    ...projects.filter((p) => p.status === "Completed"),
  ].length;
  const highPriority = requests.filter((r) => r.urgency === "High Priority" || r.priority === "High Priority").length;

  const filteredReqs = requests.filter((r) => {
    const active = reqStatusFilter === "Archive" ? r.status === "Completed" : r.status !== "Completed";
    const matchStatus = reqStatusFilter === "All" || reqStatusFilter === "Archive" || r.status === reqStatusFilter;
    const matchPriority = reqPriorityFilter === "All" || r.urgency === reqPriorityFilter || r.priority === reqPriorityFilter;
    const matchSearch = !reqSearch || r.title?.toLowerCase().includes(reqSearch.toLowerCase()) || r.clientName?.toLowerCase().includes(reqSearch.toLowerCase());
    return active && matchStatus && matchPriority && matchSearch;
  });

  const activeFilteredProjs = projects.filter((p) => {
    const notDone = p.status !== "Completed";
    const matchSearch = !projSearch || p.name?.toLowerCase().includes(projSearch.toLowerCase()) || p.clientName?.toLowerCase().includes(projSearch.toLowerCase());
    return notDone && matchSearch;
  });

  const completedProjs = projects.filter((p) => p.status === "Completed");
  const completedReqs = requests.filter((r) => r.status === "Completed");

  if (selectedProject) {
    return <ProjectDetail project={selectedProject} requests={requests} onBack={() => setSelectedProject(null)} onUpdate={updateProject} />;
  }

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Portal / Web Øps" rightText="Operations Command" />

      <div className="px-8 py-6 space-y-6">

        {/* OVERVIEW */}
        <div className="grid grid-cols-2 gap-5">
          {/* Stats row */}
          <div className="bg-card rounded-xl border border-white/[0.06] p-5 space-y-4">
            <h2 className="text-white font-bold text-xs tracking-[0.18em] uppercase">Requests Pipeline</h2>
            <PipelineBar stages={REQ_STATUSES} data={reqPipeline} />
            <div className="grid grid-cols-2 gap-3 pt-1">
              <MiniStat label="Active Requests" value={activeReqs.length} color="text-orange-500" />
              <MiniStat label="High Priority" value={highPriority} color={highPriority > 0 ? "text-orange-400" : "text-white/30"} />
            </div>
          </div>
          <div className="bg-card rounded-xl border border-white/[0.06] p-5 space-y-4">
            <h2 className="text-white font-bold text-xs tracking-[0.18em] uppercase">Projects Pipeline</h2>
            <PipelineBar stages={["Planning", "In Progress", "Review", "Completed"]} data={projPipeline} />
            <div className="grid grid-cols-2 gap-3 pt-1">
              <MiniStat label="Active Projects" value={activeProjs.length} color="text-blue-400" />
              <MiniStat label="Completed Total" value={completedThisMonth} color="text-green-400" />
            </div>
          </div>
        </div>

        {/* REQUESTS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase">Website Update Requests</h2>
            <span className="text-white/25 text-xs">{activeReqs.length} active</span>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input value={reqSearch} onChange={(e) => setReqSearch(e.target.value)} placeholder="Search requests..." className="w-full pl-10 pr-4 py-2 bg-card border border-white/[0.06] rounded-lg text-sm text-white placeholder:text-white/20 outline-none" />
            </div>
            <div className="flex gap-1.5">
              {["All", "Pending", "In Progress"].map((s) => (
                <button key={s} onClick={() => setReqStatusFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${reqStatusFilter === s ? "bg-orange-500/15 text-orange-500 border border-orange-500/20" : "text-white/30 hover:text-white/50 border border-transparent"}`}>{s}</button>
              ))}
            </div>
            <div className="flex gap-1.5">
              {["All", "Standard", "High Priority"].map((p) => (
                <button key={p} onClick={() => setReqPriorityFilter(p)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${reqPriorityFilter === p ? "bg-orange-500/15 text-orange-500 border border-orange-500/20" : "text-white/30 hover:text-white/50 border border-transparent"}`}>{p}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="w-5 h-5 text-white/20 animate-spin" /></div>
          ) : filteredReqs.length === 0 ? (
            <div className="bg-card rounded-xl border border-white/[0.06] p-8 text-center">
              <p className="text-white/25 text-sm">{requests.length === 0 ? "No Web Øps requests yet. Requests submitted from the client portal will appear here." : "No requests match your filters."}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredReqs.map((req) => (
                <RequestRow key={req._uid} req={req} onStatusChange={(s) => updateRequestStatus(req, s)} />
              ))}
            </div>
          )}
        </div>

        {/* PROJECTS */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase">Website Projects</h2>
            <button onClick={() => setAddProjectOpen(true)} className="flex items-center gap-1.5 text-orange-500/70 hover:text-orange-500 text-xs font-medium transition-colors">
              <Plus className="w-3.5 h-3.5" />New Project
            </button>
          </div>

          <div className="relative max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
            <input value={projSearch} onChange={(e) => setProjSearch(e.target.value)} placeholder="Search projects..." className="w-full pl-10 pr-4 py-2 bg-card border border-white/[0.06] rounded-lg text-sm text-white placeholder:text-white/20 outline-none" />
          </div>

          {activeFilteredProjs.length === 0 ? (
            <div className="bg-card rounded-xl border border-white/[0.06] p-8 text-center">
              <p className="text-white/25 text-sm">No active projects. Create one above.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              {activeFilteredProjs.map((project) => (
                <ProjectCard key={project.id} project={project} onClick={() => setSelectedProject(project)} />
              ))}
            </div>
          )}
        </div>

        {/* ARCHIVE */}
        {(completedReqs.length > 0 || completedProjs.length > 0) && (
          <div className="space-y-3">
            <button onClick={() => setArchiveOpen(!archiveOpen)} className="flex items-center gap-2 text-white/30 hover:text-white/60 text-xs font-medium transition-colors">
              {archiveOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              Archive ({completedReqs.length + completedProjs.length} completed)
            </button>
            {archiveOpen && (
              <div className="space-y-2">
                {completedReqs.map((req) => (
                  <RequestRow key={req._uid} req={req} onStatusChange={(s) => updateRequestStatus(req, s)} archived />
                ))}
                {completedProjs.map((project) => (
                  <ProjectCard key={project.id} project={project} onClick={() => setSelectedProject(project)} archived />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ADD PROJECT MODAL */}
      {addProjectOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
          <div className="bg-card border border-white/[0.08] rounded-2xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-bold text-sm">New Web Øps Project</h3>
              <button onClick={() => setAddProjectOpen(false)} className="text-white/30 hover:text-white/60"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-white/40 text-xs block mb-1">Project Name</label>
                <input autoFocus value={newProject.name} onChange={(e) => setNewProject({ ...newProject, name: e.target.value })} onKeyDown={(e) => e.key === "Enter" && addProject()} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none" />
              </div>
              <div>
                <label className="text-white/40 text-xs block mb-1">Client Name</label>
                <input value={newProject.clientName} onChange={(e) => setNewProject({ ...newProject, clientName: e.target.value })} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-white/40 text-xs block mb-1">Type</label>
                  <select value={newProject.projectType} onChange={(e) => setNewProject({ ...newProject, projectType: e.target.value })} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none">
                    {["Website Build", "Website Update", "Redesign", "Maintenance"].map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/40 text-xs block mb-1">Priority</label>
                  <select value={newProject.priority} onChange={(e) => setNewProject({ ...newProject, priority: e.target.value })} className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white outline-none">
                    {["Standard", "High Priority"].map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            </div>
            <button onClick={addProject} className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm font-semibold rounded-lg transition-colors">Create Project</button>
          </div>
        </div>
      )}
    </div>
  );
}

function RequestRow({ req, onStatusChange, archived }) {
  const [open, setOpen] = useState(false);
  const isHighPriority = req.urgency === "High Priority" || req.priority === "High Priority";

  return (
    <div className={`bg-card rounded-xl border p-4 space-y-2 ${archived ? "border-white/[0.03] opacity-60" : "border-white/[0.06]"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white/85 text-sm font-medium">{req.title || "Untitled Request"}</span>
            {isHighPriority && <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-500/15 text-orange-400 border border-orange-500/20">High Priority</span>}
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${REQ_STATUS_COLOR[req.status] || "bg-white/5 text-white/30"}`}>{req.status || "Submitted"}</span>
          </div>
          <div className="flex items-center gap-3 mt-1 flex-wrap">
            <span className="text-orange-500/60 text-xs font-medium">{req.clientName}</span>
            {req.submittedDate && <span className="text-white/25 text-xs">{req.submittedDate}</span>}
          </div>
          {open && req.description && <p className="text-white/40 text-xs mt-2 leading-relaxed">{req.description}</p>}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <select
            value={req.status || "Submitted"}
            onChange={(e) => onStatusChange(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-1 text-xs text-white/60 outline-none"
          >
            {REQ_STATUSES.map((s) => <option key={s}>{s}</option>)}
          </select>
          <button onClick={() => setOpen(!open)} className="text-white/20 hover:text-white/50 transition-colors">
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectCard({ project, onClick, archived }) {
  const pct = project.progress || 0;
  return (
    <button onClick={onClick} className={`card-hover text-left bg-card rounded-xl border p-5 space-y-4 w-full ${archived ? "border-white/[0.03] opacity-60" : "border-white/[0.06]"}`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-white/90 font-semibold text-sm">{project.name}</p>
          {project.clientName && <p className="text-orange-500/60 text-xs mt-0.5">{project.clientName}</p>}
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${PROJ_STATUS_COLOR[project.status] || "bg-white/5 text-white/30"}`}>{project.status}</span>
          {project.priority === "High Priority" && <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-500/10 text-orange-400">High Priority</span>}
        </div>
      </div>
      <div className="space-y-1.5">
        <div className="flex justify-between items-center">
          <span className="text-white/25 text-[10px] uppercase tracking-wider">{project.projectType}</span>
          <span className="text-white/40 text-xs font-semibold">{pct}%</span>
        </div>
        <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
          <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
      </div>
      {(project.startDate || project.targetDate) && (
        <div className="flex items-center justify-between pt-1 border-t border-white/[0.04]">
          {project.startDate && <span className="text-white/25 text-[10px]">Start: {new Date(project.startDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
          {project.targetDate && <span className="text-white/40 text-[10px] font-medium">Due: {new Date(project.targetDate + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>}
        </div>
      )}
    </button>
  );
}

function MiniStat({ label, value, color }) {
  return (
    <div className="bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-white/25 text-[10px] uppercase tracking-wider mt-0.5">{label}</p>
    </div>
  );
}