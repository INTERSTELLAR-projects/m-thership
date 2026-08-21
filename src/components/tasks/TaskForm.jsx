import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import MicButton from "@/components/MicButton";
import { CATEGORIES, TASK_TYPES, EST_UNITS, INTERSTELLAR_OPTION } from "@/lib/tasks";

export default function TaskForm({ form, setForm, onSave, onCancel, title, inline, clients = [] }) {
  const assignOptions = [INTERSTELLAR_OPTION, ...clients.map((c) => c.business)];
  return (
    <div className="bg-card rounded-xl border border-orange-500/20 p-5 space-y-3">
      <h3 className="text-white font-bold text-xs tracking-[0.15em] uppercase">{title}</h3>
      <div>
        <Label className="text-white/40 text-xs">Title</Label>
        <div className="flex items-center gap-2 mt-1">
          <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Task title..." className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 flex-1" autoFocus />
          <MicButton onResult={(t) => setForm((p) => ({ ...p, title: p.title + (p.title ? " " : "") + t }))} />
        </div>
      </div>
      <div>
        <Label className="text-white/40 text-xs">Description (optional)</Label>
        <div className="relative mt-1">
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Add more detail..." className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 pr-9 text-sm text-white placeholder:text-white/20 outline-none resize-none min-h-[60px]" />
          <MicButton onResult={(t) => setForm((p) => ({ ...p, description: p.description + (p.description ? " " : "") + t }))} className="absolute top-2 right-1" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-white/40 text-xs">Task Type</Label>
          <Select value={form.taskType || ""} onValueChange={(v) => setForm({ ...form, taskType: v })}>
            <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white mt-1 h-9"><SelectValue placeholder="— Select —" /></SelectTrigger>
            <SelectContent className="bg-card border-white/[0.06]">
              {TASK_TYPES.map((t) => <SelectItem key={t} value={t} className="text-white/70">{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-white/40 text-xs">Assigned To</Label>
          <select value={form.assignedTo || ""} onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
            className="w-full mt-1 h-9 bg-white/[0.04] border border-white/[0.08] rounded-md px-2 text-sm text-white outline-none">
            <option value="">— Select —</option>
            {assignOptions.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-white/40 text-xs">Category</Label>
          <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
            <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white mt-1 h-9"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-white/[0.06]">
              {CATEGORIES.map((c) => <SelectItem key={c} value={c} className="text-white/70">{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-white/40 text-xs">Due Date</Label>
          <Input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="bg-white/[0.04] border-white/[0.08] text-white mt-1 h-9" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-white/40 text-xs">Est. Time (amount)</Label>
          <Input type="number" min="0" value={form.estimatedAmount} onChange={(e) => setForm({ ...form, estimatedAmount: e.target.value })} placeholder="e.g. 3" className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 mt-1 h-9" />
        </div>
        <div>
          <Label className="text-white/40 text-xs">Est. Unit</Label>
          <Select value={form.estimatedUnit} onValueChange={(v) => setForm({ ...form, estimatedUnit: v })}>
            <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white mt-1 h-9"><SelectValue /></SelectTrigger>
            <SelectContent className="bg-card border-white/[0.06]">
              {EST_UNITS.map((u) => <SelectItem key={u} value={u} className="text-white/70">{u}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2 pt-1">
        <button onClick={onSave} className="flex items-center gap-1.5 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-xs font-semibold rounded-lg transition-colors"><Check className="w-3.5 h-3.5" />Save Task</button>
        <button onClick={onCancel} className="px-4 py-2 text-white/30 hover:text-white/60 text-xs transition-colors">Cancel</button>
      </div>
    </div>
  );
}