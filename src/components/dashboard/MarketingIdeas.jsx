import { useState } from "react";
import { Pencil, Check, X, Plus, Trash2 } from "lucide-react";

function MarketingRow({ value, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);

  const save = () => {
    if (!draft.trim()) return;
    onSave(draft.trim());
    setEditing(false);
  };

  return (
    <div className="bg-ink/[0.02] rounded-lg p-3 border border-ink/[0.13] group flex items-center justify-between gap-2">
      {editing ? (
        <>
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
            className="flex-1 bg-ink/[0.04] border border-ink/[0.13] rounded px-2 py-1 text-xs text-ink outline-none"
          />
          <button onClick={save} className="p-1 text-green-600/70 hover:text-green-600"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => { setDraft(value); setEditing(false); }} className="p-1 text-ink/[0.48] hover:text-ink/60"><X className="w-3.5 h-3.5" /></button>
        </>
      ) : (
        <>
          <p className="text-ink/70 text-xs font-medium flex-1">{value}</p>
          <button onClick={() => setEditing(true)} className="p-0.5 text-ink/[0.33] hover:text-ink/50 opacity-0 group-hover:opacity-100 transition-all shrink-0"><Pencil className="w-3 h-3" /></button>
          <button onClick={onDelete} className="p-0.5 text-ink/[0.33] hover:text-red-600/60 opacity-0 group-hover:opacity-100 transition-all shrink-0"><Trash2 className="w-3 h-3" /></button>
        </>
      )}
    </div>
  );
}

export default function MarketingIdeas({ items, onChange }) {
  const [adding, setAdding] = useState(false);
  const [newText, setNewText] = useState("");

  const addItem = () => {
    if (!newText.trim()) return;
    onChange([...items, newText.trim()]);
    setNewText("");
    setAdding(false);
  };

  const updateItem = (idx, value) => {
    onChange(items.map((it, i) => (i === idx ? value : it)));
  };

  const deleteItem = (idx) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-ink/[0.43] text-[10px] tracking-wider uppercase">Marketing</p>
        <button onClick={() => setAdding(true)} className="p-0.5 text-ink/[0.38] hover:text-orange-500/70 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
      </div>

      {items.map((item, idx) => (
        <MarketingRow key={idx} value={item} onSave={(v) => updateItem(idx, v)} onDelete={() => deleteItem(idx)} />
      ))}

      {items.length === 0 && !adding && (
        <p className="text-ink/[0.33] text-xs">No marketing ideas yet</p>
      )}

      {adding && (
        <div className="bg-ink/[0.02] rounded-lg p-3 border border-ink/[0.13] flex items-center gap-2">
          <input
            autoFocus
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addItem(); if (e.key === "Escape") { setAdding(false); setNewText(""); } }}
            placeholder="New marketing idea..."
            className="flex-1 bg-ink/[0.04] border border-ink/[0.13] rounded px-2 py-1 text-xs text-ink placeholder:text-ink/[0.38] outline-none"
          />
          <button onClick={addItem} className="p-1 text-green-600/70 hover:text-green-600"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={() => { setAdding(false); setNewText(""); }} className="p-1 text-ink/[0.48] hover:text-ink/60"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </div>
  );
}