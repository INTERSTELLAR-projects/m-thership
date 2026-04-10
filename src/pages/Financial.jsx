import { useState, useEffect, useMemo } from "react";
import { Plus, DollarSign, TrendingUp, AlertCircle, Edit, Check, X, Trash2, Loader2, Settings, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import FinancialAnalytics from "../components/financial/FinancialAnalytics";
import InvestmentsList from "../components/financial/InvestmentsList";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";

const INITIAL_EXPENSES = [
  { platform: "SERP API", amount: 75, frequency: "Monthly", dueDay: 7, dueMonth: null, category: "SEO", paidCycles: [] },
  { platform: "GB Gmail", amount: 1.99, frequency: "Monthly", dueDay: 9, dueMonth: null, category: "Operations", paidCycles: [] },
  { platform: "Meta Verified", amount: 15, frequency: "Monthly", dueDay: 15, dueMonth: null, category: "Marketing", paidCycles: [] },
  { platform: "Envato", amount: 39, frequency: "Monthly", dueDay: 21, dueMonth: null, category: "Design", paidCycles: [] },
  { platform: "Render", amount: 30, frequency: "Monthly", dueDay: 22, dueMonth: null, category: "Hosting", paidCycles: [] },
  { platform: "iCloud+", amount: 9.99, frequency: "Monthly", dueDay: 23, dueMonth: null, category: "Operations", paidCycles: [] },
  { platform: "Canva", amount: 15, frequency: "Monthly", dueDay: 23, dueMonth: null, category: "Design", paidCycles: [] },
  { platform: "Genspark", amount: 25, frequency: "Monthly", dueDay: 23, dueMonth: null, category: "AI Tools", paidCycles: [] },
  { platform: "ChatGPT", amount: 20, frequency: "Monthly", dueDay: 24, dueMonth: null, category: "AI Tools", paidCycles: [] },
  { platform: "Typeform", amount: 39, frequency: "Monthly", dueDay: 26, dueMonth: null, category: "Operations", paidCycles: [] },
  { platform: "Framer", amount: 45, frequency: "Monthly", dueDay: 27, dueMonth: null, category: "Hosting", paidCycles: [] },
  { platform: "QuickBooks Simple Start", amount: 38, frequency: "Monthly", dueDay: 29, dueMonth: null, category: "Finance", paidCycles: [] },
  { platform: "MongoDB", amount: 30, frequency: "Monthly", dueDay: 6, dueMonth: null, category: "Hosting", paidCycles: [] },
  { platform: "Claude", amount: 20, frequency: "Monthly", dueDay: 7, dueMonth: null, category: "AI Tools", paidCycles: [] },
  { platform: "SMPL Social Coding Management", amount: 200, frequency: "Monthly", dueDay: 9, dueMonth: null, category: "Operations", paidCycles: [] },
  { platform: "Custom E-Signature", amount: 68, frequency: "Annually", dueDay: 25, dueMonth: 1, category: "Operations", paidCycles: [] },
  { platform: "Business Gmail / Google Ads", amount: 168, frequency: "Annually", dueDay: 2, dueMonth: 3, category: "Marketing", paidCycles: [] },
  { platform: "Domain", amount: 20, frequency: "Annually", dueDay: 17, dueMonth: 3, category: "Hosting", paidCycles: [] },
  { platform: "ZenBusiness Start-Up", amount: 100, frequency: "Annually", dueDay: 26, dueMonth: 3, category: "Finance", paidCycles: [] },
  { platform: "Zapier Pro", amount: 240, frequency: "Annually", dueDay: 22, dueMonth: 5, category: "Operations", paidCycles: [] },
];

const DEFAULT_CATEGORIES = ["AI Tools", "Design", "Finance", "Hosting", "Marketing", "Operations", "SEO"];
const FREQUENCIES = ["Monthly", "Quarterly", "Annually"];
const FIN_CATS_KEY = "financial_categories";

function loadFinCategories() {
  try {
    const saved = JSON.parse(localStorage.getItem(FIN_CATS_KEY));
    if (Array.isArray(saved) && saved.length > 0) return saved;
  } catch {}
  return DEFAULT_CATEGORIES;
}

function getCurrentDueDate(expense, now) {
  if (expense.frequency === "Monthly" || expense.frequency === "Quarterly") {
    return new Date(now.getFullYear(), now.getMonth(), expense.dueDay);
  }
  const thisYear = new Date(now.getFullYear(), (expense.dueMonth || 1) - 1, expense.dueDay);
  if (thisYear < now) return new Date(now.getFullYear() + 1, (expense.dueMonth || 1) - 1, expense.dueDay);
  return thisYear;
}

function getCycleKey(expense, now) {
  const due = getCurrentDueDate(expense, now);
  if (expense.frequency === "Monthly" || expense.frequency === "Quarterly") return `${due.getFullYear()}-${due.getMonth()}`;
  return `${due.getFullYear()}`;
}

function formatDueDate(date) { return date.toLocaleDateString("en-US", { month: "short", day: "numeric" }); }

export default function Financial() {
  const now = useMemo(() => new Date(), []);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [freqFilter, setFreqFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [subPage, setSubPage] = useState("overview");
  const [categories, setCategories] = useState(loadFinCategories);
  const [managingCats, setManagingCats] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editCat, setEditCat] = useState(null);

  const saveCats = (next) => {
    setCategories(next);
    localStorage.setItem(FIN_CATS_KEY, JSON.stringify(next));
  };

  useEffect(() => {
    base44.entities.Expense.list("platform", 200).then(async (data) => {
      if (data.length === 0) {
        const created = await base44.entities.Expense.bulkCreate(INITIAL_EXPENSES);
        setExpenses(created);
      } else {
        setExpenses(data);
      }
      setLoading(false);
    });
  }, []);

  const getStatus = (expense) => {
    const key = getCycleKey(expense, now);
    if ((expense.paidCycles || []).includes(key)) return "Paid";
    if (getCurrentDueDate(expense, now) < now) return "Overdue";
    return "Upcoming";
  };

  const markPaid = async (expense) => {
    const key = getCycleKey(expense, now);
    const paidCycles = [...(expense.paidCycles || []), key];
    await base44.entities.Expense.update(expense.id, { paidCycles });
    setExpenses((prev) => prev.map((e) => e.id === expense.id ? { ...e, paidCycles } : e));
  };

  const startEdit = (expense) => { setEditingId(expense.id); setEditForm({ ...expense }); };

  const saveEdit = async () => {
    const { id, created_date, updated_date, created_by, ...fields } = editForm;
    const updated = { ...fields, amount: parseFloat(editForm.amount) || 0, dueDay: parseInt(editForm.dueDay) || 1 };
    await base44.entities.Expense.update(id, updated);
    setExpenses((prev) => prev.map((e) => e.id === id ? { ...e, ...updated } : e));
    setEditingId(null);
  };

  const deleteExpense = async (id) => {
    await base44.entities.Expense.delete(id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const enriched = expenses.map((e) => ({ ...e, dueDate: getCurrentDueDate(e, now), status: getStatus(e) }));
  const upcoming = enriched.filter((e) => e.status !== "Paid").sort((a, b) => a.dueDate - b.dueDate).slice(0, 8);
  const filtered = enriched.filter((e) => freqFilter === "All" || e.frequency === freqFilter).filter((e) => statusFilter === "All" || e.status === statusFilter).sort((a, b) => a.dueDate - b.dueDate);
  const totalMonthly = enriched.filter((e) => e.frequency === "Monthly").reduce((s, e) => s + e.amount, 0);
  const totalAnnual = enriched.filter((e) => e.frequency === "Annually").reduce((s, e) => s + e.amount, 0);
  const overdueCount = enriched.filter((e) => e.status === "Overdue").length;
  const grouped = categories.reduce((acc, cat) => { acc[cat] = enriched.filter((e) => e.category === cat); return acc; }, {});

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-white/20 animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Command Center / Financial" rightText="Expense Management" />
      <div className="px-8 pt-4 flex gap-1 border-b border-white/[0.05]">
        {["overview", "categories", "analytics", "investments"].map((tab) => (
          <button key={tab} onClick={() => setSubPage(tab)} className={`px-4 py-2 text-xs font-semibold tracking-wider uppercase transition-all rounded-t-lg ${subPage === tab ? "bg-orange-500/15 text-orange-500 border-b-2 border-orange-500" : "text-white/30 hover:text-white/60"}`}>{tab === "overview" ? "Overview" : tab === "categories" ? "Categories" : tab === "analytics" ? "Analytics" : "Investments"}</button>
        ))}
      </div>
      <div className="px-8 py-6 space-y-6">
        {subPage === "overview" ? (
          <>
            <div className="grid grid-cols-3 gap-4">
              <SummaryCard icon={DollarSign} label="Total Monthly" value={`$${totalMonthly.toFixed(2)}`} />
              <SummaryCard icon={TrendingUp} label="Total Annual" value={`$${totalAnnual.toFixed(2)}`} />
              <SummaryCard icon={AlertCircle} label="Overdue / Unpaid" value={`${overdueCount} bills`} danger={overdueCount > 0} />
            </div>
            {upcoming.length > 0 && (
              <div>
                <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase mb-3">Upcoming Expenses</h2>
                <div className="grid grid-cols-2 gap-3">
                  {upcoming.map((e) => (
                    <div key={e.id} className={`bg-card rounded-xl border p-4 flex items-center gap-4 ${e.status === "Overdue" ? "border-red-500/20" : "border-white/[0.06]"}`}>
                      <div className="w-9 h-9 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/30 text-xs font-bold shrink-0">{e.platform?.charAt(0)}</div>
                      <div className="flex-1 min-w-0"><p className="text-white/85 text-sm font-medium truncate">{e.platform}</p><p className="text-white/25 text-xs">{formatDueDate(e.dueDate)}</p></div>
                      <div className="text-right shrink-0"><p className="text-orange-500 text-sm font-bold">${e.amount.toFixed(2)}</p><StatusBadge status={e.status} /></div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase mr-2">All Expenses</h2>
                {["All", "Monthly", "Quarterly", "Annually"].map((f) => <FilterPill key={f} label={f} active={freqFilter === f} onClick={() => setFreqFilter(f)} />)}
                <span className="text-white/10 mx-1">|</span>
                {["All", "Upcoming", "Paid", "Overdue"].map((f) => <FilterPill key={f} label={f} active={statusFilter === f} onClick={() => setStatusFilter(f)} danger={f === "Overdue"} />)}
              </div>
              <AddExpenseDialog categories={categories} onAdd={async (form) => {
                const created = await base44.entities.Expense.create({ ...form, paidCycles: [] });
                setExpenses((prev) => [...prev, created]);
              }} />
            </div>
            <div className="space-y-2">
              {filtered.map((expense) => (
                <ExpenseRow key={expense.id} expense={expense} isEditing={editingId === expense.id} editForm={editForm} setEditForm={setEditForm} onEdit={() => startEdit(expense)} onSave={saveEdit} onCancel={() => setEditingId(null)} onMarkPaid={() => markPaid(expense)} onDelete={() => deleteExpense(expense.id)} categories={categories} />
              ))}
            </div>
          </>
        ) : subPage === "analytics" ? (
          <FinancialAnalytics totalMonthlyExpenses={totalMonthly} />
        ) : subPage === "investments" ? (
          <InvestmentsList />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-white/25 text-xs">Group your expenses by category.</p>
              <button onClick={() => setManagingCats(!managingCats)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${managingCats ? "bg-orange-500/15 text-orange-500 border-orange-500/20" : "text-white/30 hover:text-white/60 border-white/10"}`}>
                <Settings className="w-3.5 h-3.5" />{managingCats ? "Done" : "Manage Categories"}
              </button>
            </div>

            {managingCats && (
              <div className="bg-card rounded-xl border border-white/[0.08] p-5 space-y-3">
                <h3 className="text-white font-bold text-xs tracking-[0.15em] uppercase">Manage Categories</h3>
                <DragDropContext onDragEnd={(result) => {
                  if (!result.destination) return;
                  const next = Array.from(categories);
                  const [removed] = next.splice(result.source.index, 1);
                  next.splice(result.destination.index, 0, removed);
                  saveCats(next);
                }}>
                  <Droppable droppableId="fin-cats">
                    {(provided) => (
                      <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-1 max-h-64 overflow-y-auto">
                        {categories.map((cat, i) => (
                          <Draggable key={cat} draggableId={cat} index={i}>
                            {(drag) => (
                              <div ref={drag.innerRef} {...drag.draggableProps} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/[0.04]">
                                <span {...drag.dragHandleProps} className="text-white/15 hover:text-white/40 cursor-grab active:cursor-grabbing"><GripVertical className="w-3.5 h-3.5" /></span>
                                {editCat?.index === i ? (
                                  <>
                                    <input value={editCat.val} onChange={(e) => setEditCat({ ...editCat, val: e.target.value })} onKeyDown={(e) => {
                                      if (e.key === "Enter") { const t = editCat.val.trim(); if (t) { saveCats(categories.map((c, idx) => idx === i ? t : c)); setEditCat(null); } }
                                      if (e.key === "Escape") setEditCat(null);
                                    }} className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-0.5 text-xs text-white outline-none" autoFocus />
                                    <button onClick={() => { const t = editCat.val.trim(); if (t) { saveCats(categories.map((c, idx) => idx === i ? t : c)); setEditCat(null); } }} className="text-orange-500 text-xs font-semibold hover:text-orange-400">Save</button>
                                    <button onClick={() => setEditCat(null)} className="text-white/30 text-xs hover:text-white/60">Cancel</button>
                                  </>
                                ) : (
                                  <>
                                    <span className="flex-1 text-white/70 text-sm">{cat}</span>
                                    <button onClick={() => setEditCat({ index: i, val: cat })} className="p-1 text-white/25 hover:text-white/60 transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => saveCats(categories.filter((_, idx) => idx !== i))} className="p-1 text-white/25 hover:text-red-400/70 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
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
                  <input placeholder="New category..." value={newCatName} onChange={(e) => setNewCatName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { const t = newCatName.trim(); if (t && !categories.includes(t)) { saveCats([...categories, t]); setNewCatName(""); } } }} className="flex-1 bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 outline-none" />
                  <button onClick={() => { const t = newCatName.trim(); if (t && !categories.includes(t)) { saveCats([...categories, t]); setNewCatName(""); } }} className="px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"><Plus className="w-4 h-4" /></button>
                </div>
              </div>
            )}

            <div className="space-y-6">
              {categories.map((cat) => {
                const items = grouped[cat];
                if (!items || !items.length) return null;
                const total = items.reduce((s, e) => s + e.amount, 0);
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase">{cat}</h2>
                      <span className="text-orange-500 text-xs font-bold">${total.toFixed(2)}/mo equiv.</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((expense) => (
                        <ExpenseRow key={expense.id} expense={expense} isEditing={editingId === expense.id} editForm={editForm} setEditForm={setEditForm} onEdit={() => startEdit(expense)} onSave={saveEdit} onCancel={() => setEditingId(null)} onMarkPaid={() => markPaid(expense)} onDelete={() => deleteExpense(expense.id)} categories={categories} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ExpenseRow({ expense, isEditing, editForm, setEditForm, onEdit, onSave, onCancel, onMarkPaid, onDelete, categories }) {
  categories = categories || DEFAULT_CATEGORIES;
  if (isEditing) {
    return (
      <div className="bg-card rounded-xl border border-orange-500/20 p-4 flex items-center gap-3 flex-wrap">
        <Input value={editForm.platform} onChange={(e) => setEditForm({ ...editForm, platform: e.target.value })} className="bg-white/[0.04] border-white/[0.08] text-white h-8 w-40" placeholder="Platform" />
        <Input value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} type="number" className="bg-white/[0.04] border-white/[0.08] text-white h-8 w-24" placeholder="Amount" />
        <Select value={editForm.frequency} onValueChange={(v) => setEditForm({ ...editForm, frequency: v })}>
          <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white h-8 w-32"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-card border-white/[0.06]">{FREQUENCIES.map((f) => <SelectItem key={f} value={f} className="text-white/70">{f}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
          <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white h-8 w-36"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-card border-white/[0.06]">{categories.map((c) => <SelectItem key={c} value={c} className="text-white/70">{c}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <Input value={editForm.dueDay} onChange={(e) => setEditForm({ ...editForm, dueDay: e.target.value })} type="number" min="1" max="31" className="bg-white/[0.04] border-white/[0.08] text-white h-8 w-16" placeholder="Day" />
          {editForm.frequency === "Annually" && <Input value={editForm.dueMonth || ""} onChange={(e) => setEditForm({ ...editForm, dueMonth: e.target.value })} type="number" min="1" max="12" className="bg-white/[0.04] border-white/[0.08] text-white h-8 w-16" placeholder="Mo" />}
          <span className="text-white/20 text-[10px]">due</span>
        </div>
        <div className="flex gap-2 ml-auto">
          <button onClick={onSave} className="p-1.5 rounded-md bg-green-500/10 text-green-400/70 hover:bg-green-500/20 transition-all"><Check className="w-4 h-4" /></button>
          <button onClick={onCancel} className="p-1.5 rounded-md bg-white/[0.04] text-white/30 hover:bg-white/[0.08] transition-all"><X className="w-4 h-4" /></button>
        </div>
      </div>
    );
  }

  return (
    <div className={`card-hover bg-card rounded-xl border p-4 flex items-center gap-5 group ${expense.status === "Overdue" ? "border-red-500/15" : expense.status === "Paid" ? "border-green-500/10 opacity-70" : "border-white/[0.06]"}`}>
      <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/30 text-xs font-bold shrink-0">{expense.platform?.charAt(0)}</div>
      <div className="flex-1 min-w-0">
        <span className="text-white/85 text-sm font-medium">{expense.platform}</span>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded ${expense.frequency === "Monthly" ? "bg-blue-500/10 text-blue-400/60" : expense.frequency === "Quarterly" ? "bg-yellow-500/10 text-yellow-400/60" : "bg-purple-500/10 text-purple-400/60"}`}>{expense.frequency}</span>
          <span className="text-white/15 text-[10px] px-1.5 py-0.5 rounded bg-white/[0.03]">{expense.category}</span>
          <span className="text-white/20 text-xs">Due {formatDueDate(expense.dueDate)}</span>
        </div>
      </div>
      <p className="text-orange-500 text-sm font-bold w-16 text-right shrink-0">${expense.amount.toFixed(2)}</p>
      <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-white/5 text-white/15 hover:text-white/50 transition-all shrink-0"><Edit className="w-3.5 h-3.5" /></button>
      <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-white/5 text-white/15 hover:text-red-400/50 transition-all shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
      <div className="shrink-0">
        {expense.status === "Paid" ? (
          <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500/10 text-green-400/70 border border-green-500/15">✓ Paid</span>
        ) : expense.status === "Overdue" ? (
          <button onClick={onMarkPaid} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400/80 border border-red-500/20 hover:bg-green-500/10 hover:text-green-400/80 hover:border-green-500/20 transition-all">Not Paid</button>
        ) : (
          <button onClick={onMarkPaid} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.04] text-white/30 border border-white/[0.06] hover:bg-green-500/10 hover:text-green-400/80 hover:border-green-500/20 transition-all">Mark Paid</button>
        )}
      </div>
    </div>
  );
}

function AddExpenseDialog({ onAdd, categories }) {
  categories = categories || DEFAULT_CATEGORIES;
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ platform: "", amount: "", frequency: "Monthly", category: "Operations", dueDay: "", dueMonth: "" });
  const handleAdd = async () => {
    if (!form.platform || !form.amount) return;
    await onAdd({ ...form, amount: parseFloat(form.amount), dueDay: parseInt(form.dueDay) || 1, dueMonth: form.frequency === "Annually" ? (parseInt(form.dueMonth) || 1) : null });
    setOpen(false);
    setForm({ platform: "", amount: "", frequency: "Monthly", category: "Operations", dueDay: "", dueMonth: "" });
  };
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button className="bg-orange-500 hover:bg-orange-600 text-white h-9 gap-2"><Plus className="w-4 h-4" />Add Expense</Button></DialogTrigger>
      <DialogContent className="bg-card border-white/[0.06] text-white">
        <DialogHeader><DialogTitle className="text-white">Add New Expense</DialogTitle></DialogHeader>
        <div className="space-y-4 pt-2">
          <div><Label className="text-white/50 text-xs">Platform</Label><Input value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })} className="bg-white/[0.03] border-white/[0.06] text-white mt-1" /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-white/50 text-xs">Amount ($)</Label><Input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="bg-white/[0.03] border-white/[0.06] text-white mt-1" /></div>
            <div><Label className="text-white/50 text-xs">Frequency</Label>
              <Select value={form.frequency} onValueChange={(v) => setForm({ ...form, frequency: v })}>
                <SelectTrigger className="bg-white/[0.03] border-white/[0.06] text-white mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-white/[0.06]">{FREQUENCIES.map((f) => <SelectItem key={f} value={f} className="text-white/70">{f}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-white/50 text-xs">Due Day (1-31)</Label><Input type="number" value={form.dueDay} onChange={(e) => setForm({ ...form, dueDay: e.target.value })} className="bg-white/[0.03] border-white/[0.06] text-white mt-1" /></div>
            {form.frequency === "Annually" && <div><Label className="text-white/50 text-xs">Due Month (1-12)</Label><Input type="number" value={form.dueMonth} onChange={(e) => setForm({ ...form, dueMonth: e.target.value })} className="bg-white/[0.03] border-white/[0.06] text-white mt-1" /></div>}
          </div>
          <div><Label className="text-white/50 text-xs">Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger className="bg-white/[0.03] border-white/[0.06] text-white mt-1"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-card border-white/[0.06]">{categories.map((c) => <SelectItem key={c} value={c} className="text-white/70">{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <Button onClick={handleAdd} className="w-full bg-orange-500 hover:bg-orange-600 text-white">Add Expense</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StatusBadge({ status }) {
  if (status === "Paid") return <span className="text-[10px] font-semibold text-green-400/60">Paid</span>;
  if (status === "Overdue") return <span className="text-[10px] font-semibold text-red-400/70">Overdue</span>;
  return <span className="text-[10px] font-semibold text-orange-400/60">Upcoming</span>;
}

function FilterPill({ label, active, onClick, danger }) {
  return <button onClick={onClick} className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${active ? danger ? "bg-red-500/15 text-red-400 border border-red-500/20" : "bg-orange-500/15 text-orange-500 border border-orange-500/20" : "text-white/30 hover:text-white/50 border border-transparent"}`}>{label}</button>;
}

function SummaryCard({ icon: Icon, label, value, danger }) {
  return (
    <div className="bg-card rounded-xl border border-white/[0.06] p-5">
      <div className="flex items-center gap-2 mb-3"><Icon className={`w-4 h-4 ${danger ? "text-red-400/60" : "text-white/25"}`} /><span className="text-white/30 text-xs">{label}</span></div>
      <p className={`text-xl font-bold ${danger ? "text-red-400/80" : "text-white/80"}`}>{value}</p>
    </div>
  );
}