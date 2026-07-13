import { useState } from "react";
import { createPortal } from "react-dom";
import { Check, X, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const UNITS = ["Hours", "Days", "Weeks", "Months"];

export default function CompleteTaskModal({ task, onConfirm, onCancel }) {
  const [amount, setAmount] = useState(task.estimatedAmount ? String(task.estimatedAmount) : "");
  const [unit, setUnit] = useState(task.estimatedUnit || "Hours");

  const handleConfirm = () => {
    onConfirm({
      actualAmount: parseFloat(amount) || null,
      actualUnit: unit,
      completedDate: new Date().toISOString(),
    });
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-card border border-white/[0.10] rounded-2xl p-6 w-full max-w-md shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-9 h-9 rounded-lg bg-green-500/15 border border-green-500/25 flex items-center justify-center shrink-0">
            <Check className="w-4 h-4 text-green-400" />
          </div>
          <div>
            <h2 className="text-white font-bold text-sm tracking-wide">Complete Task?</h2>
            <p className="text-white/40 text-xs mt-0.5">This will archive the task and log your output data.</p>
          </div>
        </div>

        {/* Task name */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-3 mb-5">
          <p className="text-white/70 text-sm leading-relaxed">"{task.title}"</p>
        </div>

        {/* Time input */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-3.5 h-3.5 text-orange-500/60" />
            <label className="text-white/50 text-xs font-medium uppercase tracking-wider">How long did this take?</label>
          </div>
          {task.estimatedAmount && task.estimatedUnit && (
            <p className="text-white/25 text-[10px] mb-2">Estimated: {task.estimatedAmount} {task.estimatedUnit}</p>
          )}
          <div className="flex gap-2">
            <Input
              type="number"
              min="0"
              step="0.5"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 2.5"
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-white/20 flex-1"
            />
            <Select value={unit} onValueChange={setUnit}>
              <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-white/[0.06]">
                {UNITS.map((u) => (
                  <SelectItem key={u} value={u} className="text-white/70">{u}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={handleConfirm}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 text-green-400 text-sm font-semibold rounded-xl transition-all"
          >
            <Check className="w-4 h-4" />
            Yes, Mark Complete
          </button>
          <button
            onClick={onCancel}
            className="px-4 py-2.5 text-white/30 hover:text-white/60 text-sm transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}