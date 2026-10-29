import { useState } from "react";
import { ArrowLeft, Save, Plus, Check, X, Trash2, CheckSquare, Square } from "lucide-react";
import { base44 } from "@/api/base44Client";

const PROJECT_TYPES = ["Automation", "App", "Software", "AI System", "Integration", "Internal Tool"];
const STATUSES = ["Planning", "Development", "Testing", "Deployment", "Completed", "On Hold", "Waiting on Client"];

const STATUS_COLOR = {
  Planning: "bg-blue-500/10 text-blue-600",
  Development: "bg-orange-500/10 text-orange-600",
  Testing: "bg-purple-500/10 text-purple-600",
  Deployment: "bg-yellow-500/10 text-yellow-600",
  Completed: "bg-green-500/10 text-green-600",
  "On Hold": "bg-ink/5 text-ink/[0.48]",
  "Waiting on Client": "bg-yellow-500/10 text-yellow-600",
};

function Field({ label, value, onChange, multiline }) {
  const cls = "w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 text-sm text-ink outline-none focus:border-orange-500/30 transition-colors";
  return (
    <div>
      <label className="text-ink/[0.58] text-[10px] uppercase tracking-wider block mb-1">{label}</label>
      {multiline
        ? <textarea value={value || ""} onChange={(e) => onChange(e.target.value)} rows={4} className={cls + " resize-none"} />
        : <input value={value || ""} onChange={(e) => onChange(e.target.value)} className={cls} />}
    </div>
  );
}

export default function ForgeProjectDetail({ project, requests, onBack, onUpdate }) {
  const [form, setForm] = useState({ ...project });
  const [saving, setSaving] = useState(false);
  const [newTask, setNewTask] = useState("");
  const [addingTask, setAddingTask] = useState(false);

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));

  const save = async () => {
    setSaving(true);
    const { id, created_date, updated_date, created_by, ...fields } = form;
    await base44.entities.ForgeProject.update(project.id, fields);
    onUpdate({ ...project, ...fields });
    setSaving(false);
  };

  const addTask = async () => {
    if (!newTask.trim()) return;
    const tasks = [...(form.tasks || []), { id: Date.now(), text: newTask.trim(), done: false }];
    setForm((f) => ({ ...f, tasks }));
    await base44.entities.ForgeProject.update(project.id, { tasks });
    setNewTask("");
    setAddingTask(false);
  };

  const toggleTask = async (id) => {
    const tasks = (form.tasks || []).map((t) => t.id === id ? { ...t, done: !t.done } : t);
    setForm((f) => ({ ...f, tasks }));
    await base44.entities.ForgeProject.update(project.id, { tasks });
  };

  const deleteTask = async (id) => {
    const tasks = (form.tasks || []).filter((t) => t.id !== id);
    setForm((f) => ({ ...f, tasks }));
    await base44.entities.ForgeProject.update(project.id, { tasks });
  };

  const linkedRequests = requests.filter((r) => (form.linkedRequestIds || []).includes(r._uid));
  const doneTasks = (form.tasks || []).filter((t) => t.done).length;
  const totalTasks = (form.tasks || []).length;

  return (
    <div className="min-h-screen bg-background">
      <div className="flex items-center justify-between px-8 py-5 border-b border-ink/[0.13]">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="text-ink/[0.48] hover:text-ink/60 transition-colors flex items-center gap-1.5 text-sm">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <span className="text-ink/[0.33]">/</span>
          <span className="text-ink font-bold text-sm">{form.name}</span>
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${STATUS_COLOR[form.status] || "bg-ink/5 text-ink/[0.48]"}`}>{form.status}</span>
        </div>
        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50">
          <Save className="w-3.5 h-3.5" />{saving ? "Saving..." : "Save Changes"}
        </button>
      </div>

      <div className="px-8 py-6 grid grid-cols-3 gap-5">
        <div className="col-span-2 space-y-5">
          <div className="bg-card rounded-md border border-ink/[0.13] p-5 space-y-4">
            <h3 className="text-ink font-bold text-xs tracking-[0.18em] uppercase">Project Details</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Project Name" value={form.name} onChange={(v) => update("name", v)} />
              <Field label="Client Name" value={form.clientName} onChange={(v) => update("clientName", v)} />
              <div>
                <label className="text-ink/[0.58] text-[10px] uppercase tracking-wider block mb-1">Project Type</label>
                <select value={form.projectType || "App"} onChange={(e) => update("projectType", e.target.value)} className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 text-sm text-ink outline-none">
                  {PROJECT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="text-ink/[0.58] text-[10px] uppercase tracking-wider block mb-1">Status</label>
                <select value={form.status || "Planning"} onChange={(e) => update("status", e.target.value)} className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 text-sm text-ink outline-none">
                  {STATUSES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="text-ink/[0.58] text-[10px] uppercase tracking-wider block mb-1">Start Date</label>
                <input type="date" value={form.startDate || ""} onChange={(e) => update("startDate", e.target.value)} className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 text-sm text-ink outline-none" />
              </div>
              <div>
                <label className="text-ink/[0.58] text-[10px] uppercase tracking-wider block mb-1">Target Completion</label>
                <input type="date" value={form.targetDate || ""} onChange={(e) => update("targetDate", e.target.value)} className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 text-sm text-ink outline-none" />
              </div>
            </div>
            <div>
              <label className="text-ink/[0.58] text-[10px] uppercase tracking-wider block mb-1">Progress ({form.progress || 0}%)</label>
              <input type="range" min="0" max="100" value={form.progress || 0} onChange={(e) => update("progress", parseInt(e.target.value))} className="w-full accent-orange-500" />
              <div className="mt-2 h-2 bg-ink/5 rounded-full overflow-hidden">
                <div className="h-full bg-orange-500 rounded-full transition-all" style={{ width: `${form.progress || 0}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-md border border-ink/[0.13] p-5 space-y-4">
            <h3 className="text-ink font-bold text-xs tracking-[0.18em] uppercase">Build Details</h3>
            <Field label="Project Objective" value={form.objective} onChange={(v) => update("objective", v)} multiline />
            <Field label="Core Functionality" value={form.coreFunctionality} onChange={(v) => update("coreFunctionality", v)} multiline />
            <Field label="Build Strategy / Notes" value={form.buildStrategy} onChange={(v) => update("buildStrategy", v)} multiline />
          </div>

          <div className="bg-card rounded-md border border-ink/[0.13] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-ink font-bold text-xs tracking-[0.18em] uppercase">
                Feature Checklist {totalTasks > 0 && <span className="text-ink/[0.48] font-normal">({doneTasks}/{totalTasks})</span>}
              </h3>
              <button onClick={() => setAddingTask(true)} className="flex items-center gap-1.5 text-orange-500/70 hover:text-orange-500 text-xs transition-colors"><Plus className="w-3.5 h-3.5" />Add Item</button>
            </div>
            {addingTask && (
              <div className="flex items-center gap-2">
                <input autoFocus value={newTask} onChange={(e) => setNewTask(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addTask(); if (e.key === "Escape") setAddingTask(false); }} placeholder="Feature or task..." className="flex-1 bg-ink/[0.04] border border-ink/[0.13] rounded px-3 py-1.5 text-sm text-ink placeholder:text-ink/[0.38] outline-none" />
                <button onClick={addTask} className="p-1.5 text-green-600/70 hover:text-green-600"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={() => setAddingTask(false)} className="p-1.5 text-ink/[0.48] hover:text-ink/60"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}
            {(form.tasks || []).length === 0 && !addingTask && <p className="text-ink/[0.38] text-xs text-center py-3">No items yet.</p>}
            <div className="space-y-1.5">
              {(form.tasks || []).map((task) => (
                <div key={task.id} className="flex items-center gap-2.5 group py-1">
                  <button onClick={() => toggleTask(task.id)} className="shrink-0 text-ink/[0.38] hover:text-orange-500/70 transition-colors">
                    {task.done ? <CheckSquare className="w-4 h-4 text-green-600/70" /> : <Square className="w-4 h-4" />}
                  </button>
                  <span className={`flex-1 text-sm ${task.done ? "line-through text-ink/[0.43]" : "text-ink/70"}`}>{task.text}</span>
                  <button onClick={() => deleteTask(task.id)} className="p-0.5 text-ink/[0.28] hover:text-red-600/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card rounded-md border border-ink/[0.13] p-5 space-y-3">
            <h3 className="text-ink font-bold text-xs tracking-[0.18em] uppercase">Internal Notes</h3>
            <textarea value={form.notes || ""} onChange={(e) => update("notes", e.target.value)} rows={5} placeholder="Internal notes, decisions, future iterations..." className="w-full bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink/[0.38] outline-none resize-none focus:border-orange-500/30 transition-colors" />
          </div>
        </div>

        <div className="space-y-5">
          <div className="bg-card rounded-md border border-ink/[0.13] p-5 space-y-3">
            <h3 className="text-ink font-bold text-xs tracking-[0.18em] uppercase">Priority</h3>
            <div className="flex gap-2">
              {["Standard", "High Priority"].map((p) => (
                <button key={p} onClick={() => update("priority", p)} className={`flex-1 py-2 rounded-lg text-xs font-medium transition-all border ${form.priority === p ? (p === "High Priority" ? "bg-orange-500/15 text-orange-600 border-orange-500/25" : "bg-ink/[0.06] text-ink/70 border-ink/[0.13]") : "text-ink/[0.43] border-ink/[0.13] hover:border-ink/[0.13]"}`}>{p}</button>
              ))}
            </div>
          </div>

          {linkedRequests.length > 0 && (
            <div className="bg-card rounded-md border border-ink/[0.13] p-5 space-y-3">
              <h3 className="text-ink font-bold text-xs tracking-[0.18em] uppercase">Linked Requests</h3>
              {linkedRequests.map((r, i) => (
                <div key={i} className="p-3 bg-ink/[0.02] rounded-lg border border-ink/[0.13]">
                  <p className="text-ink/70 text-xs font-medium">{r.title}</p>
                  <p className="text-ink/[0.48] text-[10px] mt-0.5">{r.clientName}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}