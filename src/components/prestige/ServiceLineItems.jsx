import { Plus, Trash2, Repeat } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const SERVICES = ["Next-Gen Websites", "HyperCare+", "Web Øps", "Førge"];

const EMPTY = { service: "", subscription: false, amount: "" };

export default function ServiceLineItems({ value, onChange }) {
  const items = Array.isArray(value) && value.length ? value : [{ ...EMPTY }];
  const update = (i, patch) => onChange(items.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  const add = () => onChange([...items, { ...EMPTY }]);
  const remove = (i) => onChange(items.length > 1 ? items.filter((_, idx) => idx !== i) : items);
  const total = items.reduce((s, it) => s + (parseFloat(it.amount) || 0), 0);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-ink/[0.58] text-[11px] flex items-center gap-1.5">
          <Repeat className="w-3 h-3 text-orange-600" /> Packages & Services
        </Label>
        <span className="text-[10px] text-orange-600 font-semibold tracking-wide">Total ${total.toLocaleString()}</span>
      </div>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-ink/[0.13] bg-white/70 p-2">
            <select
              value={it.service}
              onChange={(e) => update(i, { service: e.target.value })}
              className="flex-1 min-w-0 bg-ink/[0.03] border border-ink/[0.13] rounded-md px-2 py-1.5 text-xs text-ink outline-none"
            >
              <option value="">— Select Service —</option>
              {SERVICES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <button
              type="button"
              onClick={() => update(i, { subscription: !it.subscription })}
              className={`shrink-0 flex items-center gap-1 px-2 py-1.5 rounded-md border text-[10px] font-semibold transition-all ${it.subscription ? "bg-orange-500/15 border-orange-500/40 text-orange-600" : "bg-ink/[0.03] border-ink/[0.13] text-ink/[0.58] hover:text-ink/70"}`}
            >
              <Repeat className="w-3 h-3" /> Sub
            </button>
            <div className="relative w-24 shrink-0">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-ink/[0.48] text-xs">$</span>
              <Input type="number" min="0" value={it.amount} onChange={(e) => update(i, { amount: e.target.value })} placeholder="Amount" className="pl-5 bg-ink/[0.03] border-ink/[0.13] text-ink placeholder:text-ink/[0.38] h-8 text-xs" />
            </div>
            {items.length > 1 && (
              <button type="button" onClick={() => remove(i)} className="shrink-0 p-1.5 text-ink/[0.38] hover:text-red-600/60 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
            )}
          </div>
        ))}
      </div>
      <button type="button" onClick={add} className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-dashed border-ink/15 text-ink/[0.58] hover:text-orange-600 hover:border-orange-500/40 transition-colors text-[11px] font-medium">
        <Plus className="w-3.5 h-3.5" /> Add Service / Package
      </button>
    </div>
  );
}