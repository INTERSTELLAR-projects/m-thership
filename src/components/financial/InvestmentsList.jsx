import { useState, useEffect } from "react";
import { Plus, Trash2, Edit, Check, X, ShoppingBag, GripVertical, Settings } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { base44 } from "@/api/base44Client";

const DEFAULT_CATEGORIES = ["Software", "Hardware", "Marketing", "Education", "Team", "Other"];
const INV_CATS_KEY = "investment_categories";
const PRIORITY_COLORS = {
  High: "bg-red-500/10 text-red-600/80",
  Medium: "bg-yellow-500/10 text-yellow-600/70",
  Low: "bg-ink/[0.04] text-ink/[0.48]",
};

function loadCats() {
  try {
    const s = JSON.parse(localStorage.getItem(INV_CATS_KEY));
    if (Array.isArray(s) && s.length > 0) return s;
  } catch {}
  return DEFAULT_CATEGORIES;
}

export default function InvestmentsList() {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState(loadCats);
  const [catFilter, setCatFilter] = useState("All");
  const [managingCats, setManagingCats] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editCat, setEditCat] = useState(null);
  const [addingCat, setAddingCat] = useState(null); // category name to add item into
  const [newItem, setNewItem] = useState({ name: "", estimatedCost: "", priority: "Medium", notes: "" });
  const [editId, setEditId] = useState(null);
  const [editForm, setEditForm] = useState({});

  useEffect(() => {
    base44.entities.Investment.list("-created_date", 200).then(setItems);
  }, []);

  const saveCats = (next) => {
    setCategories(next);
    localStorage.setItem(INV_CATS_KEY, JSON.stringify(next));
  };

  const addItem = async (category) => {
    if (!newItem.name.trim()) return;
    const created = await base44.entities.Investment.create({
      name: newItem.name,
      category,
      estimatedCost: parseFloat(newItem.estimatedCost) || 0,
      priority: newItem.priority,
      notes: newItem.notes,
      acquired: false,
    });
    setItems((prev) => [created, ...prev]);
    setNewItem({ name: "", estimatedCost: "", priority: "Medium", notes: "" });
    setAddingCat(null);
  };

  const toggleAcquired = async (item) => {
    await base44.entities.Investment.update(item.id, { acquired: !item.acquired });
    setItems((prev) => prev.map((i) => i.id === item.id ? { ...i, acquired: !i.acquired } : i));
  };

  const deleteItem = async (id) => {
    await base44.entities.Investment.delete(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const startEdit = (item) => { setEditId(item.id); setEditForm({ ...item }); };
  const saveEdit = async () => {
    const { id, created_date, updated_date, created_by, ...fields } = editForm;
    await base44.entities.Investment.update(id, { ...fields, estimatedCost: parseFloat(editForm.estimatedCost) || 0 });
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, ...fields } : i));
    setEditId(null);
  };

  const onDragEndCats = (result) => {
    if (!result.destination) return;
    const next = Array.from(categories);
    const [r] = next.splice(result.source.index, 1);
    next.splice(result.destination.index, 0, r);
    saveCats(next);
  };

  const [acquiredOpen, setAcquiredOpen] = useState(false);

  const filtered = catFilter === "All" ? items : items.filter((i) => i.category === catFilter);
  const grouped = categories.reduce((acc, cat) => {
    acc[cat] = filtered.filter((i) => i.category === cat && !i.acquired);
    return acc;
  }, {});

  const acquiredItems = filtered.filter((i) => i.acquired);
  const totalPending = items.filter((i) => !i.acquired).reduce((s, i) => s + (i.estimatedCost || 0), 0);
  const acquiredCount = items.filter((i) => i.acquired).length;

  return (
    <div className="space-y-5">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-ink/[0.43] text-[10px] tracking-wider uppercase">Total Pending</p>
            <p className="text-orange-500 font-bold text-lg">${totalPending.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
          </div>
          <div className="text-center">
            <p className="text-ink/[0.43] text-[10px] tracking-wider uppercase">Acquired</p>
            <p className="text-green-600/70 font-bold text-lg">{acquiredCount}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {["All", ...categories].map((c) => (
            <button key={c} onClick={() => setCatFilter(c)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${catFilter === c ? "bg-gradient-to-r from-orange-500/20 to-amber-400/10 text-orange-600 border border-orange-500/30" : "text-ink/[0.48] hover:text-ink/50 border border-transparent"}`}>{c}</button>
          ))}
          <button onClick={() => setManagingCats(!managingCats)} className={`p-1.5 rounded-lg border transition-all ${managingCats ? "bg-orange-500/15 text-orange-500 border-orange-500/20" : "text-ink/[0.38] hover:text-ink/50 border-dashed border-ink/[0.13] hover:border-ink/20"}`}><Settings className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {/* Manage categories */}
      {managingCats && (
        <div className="relative overflow-hidden bg-card rounded-md border border-orange-500/25 p-5 space-y-3">
          <h3 className="text-ink font-bold text-xs tracking-[0.15em] uppercase">Manage Categories</h3>
          <DragDropContext onDragEnd={onDragEndCats}>
            <Droppable droppableId="inv-cats">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1 max-h-56 overflow-y-auto">
                  {categories.map((cat, i) => (
                    <Draggable key={cat} draggableId={cat} index={i}>
                      {(drag) => (
                        <div ref={drag.innerRef} {...drag.draggableProps} className="flex items-center gap-2 p-2 rounded-lg bg-ink/[0.02] border border-ink/[0.13]">
                          <span {...drag.dragHandleProps} className="text-ink/[0.33] hover:text-ink/[0.58] cursor-grab active:cursor-grabbing"><GripVertical className="w-3.5 h-3.5" /></span>
                          {editCat?.index === i ? (
                            <>
                              <input value={editCat.val} onChange={(e) => setEditCat({ ...editCat, val: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") { const t = editCat.val.trim(); if (t) { saveCats(categories.map((c, idx) => idx === i ? t : c)); setEditCat(null); } } if (e.key === "Escape") setEditCat(null); }} className="flex-1 bg-ink/[0.04] border border-ink/[0.13] rounded px-2 py-0.5 text-xs text-ink outline-none" autoFocus />
                              <button onClick={() => { const t = editCat.val.trim(); if (t) { saveCats(categories.map((c, idx) => idx === i ? t : c)); setEditCat(null); } }} className="text-orange-500 text-xs font-semibold">Save</button>
                              <button onClick={() => setEditCat(null)} className="text-ink/[0.48] text-xs">Cancel</button>
                            </>
                          ) : (
                            <>
                              <span className="flex-1 text-ink/70 text-sm">{cat}</span>
                              <button onClick={() => setEditCat({ index: i, val: cat })} className="p-1 text-ink/[0.43] hover:text-ink/60"><Edit className="w-3.5 h-3.5" /></button>
                              <button onClick={() => saveCats(categories.filter((_, idx) => idx !== i))} className="p-1 text-ink/[0.43] hover:text-red-600/70"><Trash2 className="w-3.5 h-3.5" /></button>
                            </>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
          <div className="flex gap-2 pt-1">
            <input placeholder="New category..." value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { const t = newCatName.trim(); if (t && !categories.includes(t)) { saveCats([...categories, t]); setNewCatName(""); } } }} className="flex-1 bg-ink/[0.03] border border-ink/[0.13] rounded-lg px-3 py-2 text-sm text-ink placeholder:text-ink/[0.38] outline-none" />
            <button onClick={() => { const t = newCatName.trim(); if (t && !categories.includes(t)) { saveCats([...categories, t]); setNewCatName(""); } }} className="px-3 py-2 bg-gradient-to-r from-orange-500 to-amber-400 hover:from-orange-400 hover:to-amber-300 text-white font-semibold rounded-lg transition-colors"><Plus className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      {/* Category sections */}
      <div className="space-y-6">
        {categories.map((cat) => {
          const catItems = grouped[cat] || [];
          const isAdding = addingCat === cat;
          if (!catItems.length && !isAdding && catFilter !== "All" && catFilter !== cat) return null;
          return (
            <div key={cat}>
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">{cat}</h2>
                <button onClick={() => setAddingCat(isAdding ? null : cat)} className="flex items-center gap-1 text-[10px] font-semibold text-ink/[0.43] hover:text-orange-500/70 transition-colors">
                  <Plus className="w-3 h-3" />Add
                </button>
              </div>

              {isAdding && (
                <div className="relative overflow-hidden bg-card rounded-md border border-orange-500/35 p-4 mb-2 flex items-center gap-3 flex-wrap">
                  <input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="Item name..." className="flex-1 min-w-[160px] bg-ink/[0.04] border border-ink/[0.13] rounded-lg px-3 py-1.5 text-sm text-ink placeholder:text-ink/[0.43] outline-none" autoFocus />
                  <input value={newItem.estimatedCost} onChange={(e) => setNewItem({ ...newItem, estimatedCost: e.target.value })} type="number" placeholder="Est. cost $" className="w-28 bg-ink/[0.04] border border-ink/[0.13] rounded-lg px-3 py-1.5 text-sm text-ink placeholder:text-ink/[0.43] outline-none" />
                  <select value={newItem.priority} onChange={(e) => setNewItem({ ...newItem, priority: e.target.value })} className="bg-ink/[0.04] border border-ink/[0.13] rounded-lg px-2 py-1.5 text-xs text-ink outline-none">
                    <option value="High">High</option>
                    <option value="Medium">Medium</option>
                    <option value="Low">Low</option>
                  </select>
                  <input value={newItem.notes} onChange={(e) => setNewItem({ ...newItem, notes: e.target.value })} placeholder="Notes..." className="flex-1 min-w-[120px] bg-ink/[0.04] border border-ink/[0.13] rounded-lg px-3 py-1.5 text-sm text-ink placeholder:text-ink/[0.43] outline-none" />
                  <div className="flex gap-2">
                    <button onClick={() => addItem(cat)} className="p-1.5 rounded-md bg-green-500/10 text-green-600/70 hover:bg-green-500/20"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setAddingCat(null)} className="p-1.5 rounded-md bg-ink/[0.04] text-ink/[0.48] hover:bg-ink/[0.08]"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              )}

              {catItems.length === 0 && !isAdding ? (
                <p className="text-ink/[0.33] text-xs px-1">No items yet — click Add to get started.</p>
              ) : (
                <div className="space-y-2">
                  {catItems.map((item) => (
                    <div key={item.id} className={`card-hover relative overflow-hidden game-panel p-4 flex items-center gap-4 group ${item.acquired ? "border-green-500/10 opacity-60" : "border-ink/[0.13]"}`}>
                      {editId === item.id ? (
                        <div className="flex-1 flex items-center gap-3 flex-wrap">
                          <input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="flex-1 min-w-[140px] bg-ink/[0.04] border border-ink/[0.13] rounded-lg px-3 py-1.5 text-sm text-ink outline-none" />
                          <input value={editForm.estimatedCost} onChange={(e) => setEditForm({ ...editForm, estimatedCost: e.target.value })} type="number" className="w-24 bg-ink/[0.04] border border-ink/[0.13] rounded-lg px-3 py-1.5 text-sm text-ink outline-none" />
                          <select value={editForm.priority} onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })} className="bg-ink/[0.04] border border-ink/[0.13] rounded-lg px-2 py-1.5 text-xs text-ink outline-none">
                            <option value="High">High</option><option value="Medium">Medium</option><option value="Low">Low</option>
                          </select>
                          <input value={editForm.notes || ""} onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} placeholder="Notes..." className="flex-1 min-w-[100px] bg-ink/[0.04] border border-ink/[0.13] rounded-lg px-3 py-1.5 text-sm text-ink placeholder:text-ink/[0.43] outline-none" />
                          <div className="flex gap-2">
                            <button onClick={saveEdit} className="p-1.5 rounded-md bg-green-500/10 text-green-600/70 hover:bg-green-500/20"><Check className="w-4 h-4" /></button>
                            <button onClick={() => setEditId(null)} className="p-1.5 rounded-md bg-ink/[0.04] text-ink/[0.48]"><X className="w-4 h-4" /></button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <button onClick={() => toggleAcquired(item)} className={`w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-all ${item.acquired ? "bg-green-500/20 border-green-500/40 text-green-600" : "border-ink/20 hover:border-orange-500/40"}`}>
                            {item.acquired && <Check className="w-3 h-3" />}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${item.acquired ? "line-through text-ink/[0.48]" : "text-ink/85"}`}>{item.name}</p>
                            {item.notes && <p className="text-ink/[0.48] text-xs mt-0.5 truncate">{item.notes}</p>}
                          </div>
                          <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded ${PRIORITY_COLORS[item.priority] || PRIORITY_COLORS.Medium}`}>{item.priority}</span>
                          {item.estimatedCost > 0 && <span className="text-orange-500/80 text-sm font-bold w-20 text-right shrink-0">${item.estimatedCost.toLocaleString()}</span>}
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all">
                            <button onClick={() => startEdit(item)} className="p-1.5 rounded-md hover:bg-ink/5 text-ink/[0.38] hover:text-ink/60"><Edit className="w-3.5 h-3.5" /></button>
                            <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded-md hover:bg-ink/5 text-ink/[0.38] hover:text-red-600/60"><Trash2 className="w-3.5 h-3.5" /></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {items.length === 0 && (
        <div className="game-panel p-12 text-center">
          <ShoppingBag className="w-8 h-8 text-ink/[0.28] mx-auto mb-3" />
          <p className="text-ink/[0.43] text-sm">No investments yet. Click "Add" next to a category to get started.</p>
        </div>
      )}

      {/* Acquired Section */}
      {acquiredItems.length > 0 && (
        <div className="border-t border-ink/[0.13] pt-5">
          <button
            onClick={() => setAcquiredOpen(!acquiredOpen)}
            className="flex items-center gap-3 mb-3 w-full text-left group"
          >
            <h2 className="text-green-600/60 font-bold text-xs tracking-[0.2em] uppercase">Acquired</h2>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-green-500/10 text-green-600/70 border border-green-500/15">{acquiredItems.length}</span>
            <span className="text-ink/[0.38] text-[10px] ml-auto group-hover:text-ink/[0.58] transition-colors">{acquiredOpen ? "▲ hide" : "▼ show"}</span>
          </button>
          {acquiredOpen && (
            <div className="space-y-2">
              {acquiredItems.map((item) => (
                <div key={item.id} className="bg-card rounded-md border border-green-500/10 p-4 flex items-center gap-4 group opacity-60 hover:opacity-80 transition-opacity">
                  <button onClick={() => toggleAcquired(item)} className="w-5 h-5 rounded border flex items-center justify-center shrink-0 bg-green-500/20 border-green-500/40 text-green-600">
                    <Check className="w-3 h-3" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-through text-ink/[0.48]">{item.name}</p>
                    {item.notes && <p className="text-ink/[0.38] text-xs mt-0.5 truncate">{item.notes}</p>}
                  </div>
                  <span className="text-ink/[0.38] text-[10px] uppercase tracking-wider">{item.category}</span>
                  {item.estimatedCost > 0 && <span className="text-ink/[0.43] text-sm font-bold w-20 text-right shrink-0">${item.estimatedCost.toLocaleString()}</span>}
                  <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded-md hover:bg-ink/5 text-ink/[0.33] hover:text-red-600/60 opacity-0 group-hover:opacity-100 transition-all"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}