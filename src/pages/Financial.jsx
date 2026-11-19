import { useState, useEffect, useMemo } from "react";
import { Plus, Edit, Check, X, Trash2, Loader2, Settings, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import InvestmentsList from "../components/financial/InvestmentsList";
import StripeRevenue from "../components/financial/StripeRevenue";
import RevenueProjections from "../components/financial/RevenueProjections";
import ProjectProjections from "../components/financial/ProjectProjections";
import FinanceDashboard from "../components/financial/FinanceDashboard";
import ExpensesTab from "../components/financial/ExpensesTab";
import { getCurrentDueDate, getCycleKey, getStatus as expenseStatus, formatDueDate } from "../components/financial/finance/expenses";
import GoalTab from "../components/financial/GoalTab";
import InvestmentAdvisor from "../components/financial/InvestmentAdvisor";
import AccountingCenter from "@/features/accounting/AccountingCenter";
import { useCategoryList } from "@/hooks/useOptionList";
import useFinanceData from "../components/financial/finance/useFinanceData";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { base44 } from "@/api/base44Client";
import PageHeader from "../components/PageHeader";
import ClientAnalytics from "@/features/clients/ClientAnalytics";
import { useList } from "@/lib/useData";

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
const FIN_TABS = [
  ["dashboard", "Dashboard"], ["goal", "Goal"], ["advisor", "Advisor"], ["overview", "Expenses"], ["accounting", "Accounting & Taxes"],
  ["stripe", "Stripe"], ["clients", "Client numbers"], ["projections", "Projections"], ["investments", "Investments"],
];
// Client numbers moved here from the Clients page (Nov 2026): MRR, revenue by service, top clients.
function ClientNumbers() {
  const q = useList("CRMClient", { sort: "business", limit: 500 });
  const [svc, setSvc] = useState(null);
  return q.isLoading ? <p className="text-[13px] text-ink/45">Loading…</p> : <ClientAnalytics clients={q.data || []} serviceFilter={svc} onServiceFilter={setSvc} />;
}
const LIVE_TABS = new Set(["dashboard", "goal", "advisor", "overview"]);
// Expenses and their categories go hand in hand: Categories is a tab INSIDE Expenses ("Expenses | Categories").
// The old ?tab=categories link still lands there.
const EXP_TABS = [["expenses", "Expenses"], ["categories", "Categories"]];

function ExpSubTabs({ value, onChange }) {
  return (
    <div className="inline-flex border border-ink/[0.13] bg-card p-0.5" role="tablist" aria-label="Expenses view">
      {EXP_TABS.map(([k, label]) => (
        <button key={k} type="button" role="tab" aria-selected={value === k} onClick={() => onChange(k)}
          className={`px-4 py-1.5 text-xs font-semibold tracking-wider uppercase transition-colors ${value === k ? "bg-ink text-white" : "text-ink/[0.48] hover:text-ink/70"}`}>{label}</button>
      ))}
    </div>
  );
}

// Expense categories are shared: Settings > Lists & fields > Expense categories (old per-browser list seeds it once).

export default function Financial() {
  const now = useMemo(() => new Date(), []);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [subPage, setSubPage] = useState(() => {
    const t = new URLSearchParams(window.location.search).get("tab");
    if (t === "categories") return "overview";
    return FIN_TABS.some(([k]) => k === t) ? t : "dashboard";
  });
  const [expSub, setExpSub] = useState(() => {
    const q = new URLSearchParams(window.location.search);
    return q.get("tab") === "categories" || q.get("sub") === "categories" ? "categories" : "expenses";
  });
  const financeData = useFinanceData(LIVE_TABS.has(subPage));
  const [categories, saveCats] = useCategoryList("expense_categories", FIN_CATS_KEY);
  const [managingCats, setManagingCats] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [editCat, setEditCat] = useState(null);


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

  const getStatus = (expense) => expenseStatus(expense, now);

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

  // Used by the Expenses tab's edit dialog: same entity fields as the inline editor.
  const updateExpense = async (id, fields) => {
    await base44.entities.Expense.update(id, fields);
    setExpenses((prev) => prev.map((e) => e.id === id ? { ...e, ...fields } : e));
  };

  const addExpense = async (form) => {
    const created = await base44.entities.Expense.create({ ...form, paidCycles: [] });
    setExpenses((prev) => [...prev, created]);
  };

  const deleteExpense = async (id) => {
    await base44.entities.Expense.delete(id);
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  const enriched = expenses.map((e) => ({ ...e, dueDate: getCurrentDueDate(e, now), status: getStatus(e) }));
  const grouped = categories.reduce((acc, cat) => { acc[cat] = enriched.filter((e) => e.category === cat); return acc; }, {});

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-6 h-6 text-ink/[0.38] animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Agency / Financial" rightText="Money · Goal · Advisor" />
      <div className="px-5 md:px-8 pt-4 flex gap-1 border-b border-ink/[0.13] overflow-x-auto">
        {FIN_TABS.map(([tab, label]) => (
          <button key={tab} onClick={() => setSubPage(tab)} className={`shrink-0 whitespace-nowrap px-4 py-2 text-xs font-semibold tracking-wider uppercase transition-all rounded-t-lg ${subPage === tab ? "bg-orange-500/15 text-orange-500 border-b-2 border-orange-500" : "text-ink/[0.48] hover:text-ink/60"}`}>{label}</button>
        ))}
      </div>
      <div className="px-5 md:px-8 py-6 space-y-6">
        {subPage === "dashboard" ? (
          <FinanceDashboard data={financeData} />
        ) : subPage === "goal" ? (
          <GoalTab data={financeData} />
        ) : subPage === "advisor" ? (
          <InvestmentAdvisor data={financeData} />
        ) : subPage === "accounting" ? (
          <AccountingCenter />
        ) : subPage === "overview" && expSub === "expenses" ? (
          <>
            <ExpSubTabs value={expSub} onChange={setExpSub} />
            <ExpensesTab expenses={expenses} categories={categories} now={now} finance={financeData}
              onAdd={addExpense} onUpdate={updateExpense} onDelete={deleteExpense} onMarkPaid={markPaid} />
          </>
        ) : subPage === "projections" ? (
          <>
            <RevenueProjections />
            <ProjectProjections />
          </>
        ) : subPage === "clients" ? (
          <ClientNumbers />
        ) : subPage === "stripe" ? (
          <StripeRevenue />
        ) : subPage === "investments" ? (
          <InvestmentsList />
        ) : (
          <div className="space-y-4">
            <ExpSubTabs value={expSub} onChange={setExpSub} />
            <div className="flex items-center justify-between">
              <p className="text-ink/[0.43] text-xs">Group your expenses by category.</p>
              <button onClick={() => setManagingCats(!managingCats)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${managingCats ? "bg-orange-500/15 text-orange-500 border-orange-500/20" : "text-ink/[0.48] hover:text-ink/60 border-ink/[0.13]"}`}>
                <Settings className="w-3.5 h-3.5" />{managingCats ? "Done" : "Manage Categories"}
              </button>
            </div>

            {managingCats && (
              <div className="bg-card rounded-md border border-ink/[0.13] p-5 space-y-3">
                <h3 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">Manage Categories</h3>
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
                              <div ref={drag.innerRef} {...drag.draggableProps} className="flex items-center gap-2 p-2 rounded-lg bg-ink/[0.02] border border-ink/[0.13]">
                                <span {...drag.dragHandleProps} className="text-ink/[0.33] hover:text-ink/[0.58] cursor-grab active:cursor-grabbing"><GripVertical className="w-3.5 h-3.5" /></span>
                                {editCat?.index === i ? (
                                  <>
                                    <input value={editCat.val} onChange={(e) => setEditCat({ ...editCat, val: e.target.value })} onKeyDown={(e) => {
                                      if (e.key === "Enter") { const t = editCat.val.trim(); if (t) { saveCats(categories.map((c, idx) => idx === i ? t : c)); setEditCat(null); } }
                                      if (e.key === "Escape") setEditCat(null);
                                    }} className="flex-1 bg-ink/[0.04] border border-ink/[0.13] rounded px-2 py-0.5 text-xs text-ink outline-none" autoFocus />
                                    <button onClick={() => { const t = editCat.val.trim(); if (t) { saveCats(categories.map((c, idx) => idx === i ? t : c)); setEditCat(null); } }} className="text-orange-500 text-xs font-semibold hover:text-orange-600">Save</button>
                                    <button onClick={() => setEditCat(null)} className="text-ink/[0.48] text-xs hover:text-ink/60">Cancel</button>
                                  </>
                                ) : (
                                  <>
                                    <span className="flex-1 text-ink/70 text-sm">{cat}</span>
                                    <button onClick={() => setEditCat({ index: i, val: cat })} className="p-1 text-ink/[0.43] hover:text-ink/60 transition-colors"><Edit className="w-3.5 h-3.5" /></button>
                                    <button onClick={() => saveCats(categories.filter((_, idx) => idx !== i))} className="p-1 text-ink/[0.43] hover:text-red-600/70 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
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

            <div className="space-y-6">
              {categories.map((cat) => {
                const items = grouped[cat];
                if (!items || !items.length) return null;
                const total = items.reduce((s, e) => s + e.amount, 0);
                return (
                  <div key={cat}>
                    <div className="flex items-center justify-between mb-3">
                      <h2 className="font-display font-bold text-xs tracking-[0.22em] uppercase bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">{cat}</h2>
                      <span className="text-xs font-display font-bold bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">${total.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}/mo equiv.</span>
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
      <div className="bg-card rounded-md border border-orange-500/20 p-4 flex items-center gap-3 flex-wrap">
        <Input value={editForm.platform} onChange={(e) => setEditForm({ ...editForm, platform: e.target.value })} className="bg-ink/[0.04] border-ink/[0.13] text-ink h-8 w-40" placeholder="Platform" />
        <Input value={editForm.amount} onChange={(e) => setEditForm({ ...editForm, amount: e.target.value })} type="number" className="bg-ink/[0.04] border-ink/[0.13] text-ink h-8 w-24" placeholder="Amount" />
        <Select value={editForm.frequency} onValueChange={(v) => setEditForm({ ...editForm, frequency: v })}>
          <SelectTrigger className="bg-ink/[0.04] border-ink/[0.13] text-ink h-8 w-32"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-card border-ink/[0.13]">{FREQUENCIES.map((f) => <SelectItem key={f} value={f} className="text-ink/70">{f}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={editForm.category} onValueChange={(v) => setEditForm({ ...editForm, category: v })}>
          <SelectTrigger className="bg-ink/[0.04] border-ink/[0.13] text-ink h-8 w-36"><SelectValue /></SelectTrigger>
          <SelectContent className="bg-card border-ink/[0.13]">{categories.map((c) => <SelectItem key={c} value={c} className="text-ink/70">{c}</SelectItem>)}</SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <Input value={editForm.dueDay} onChange={(e) => setEditForm({ ...editForm, dueDay: e.target.value })} type="number" min="1" max="31" className="bg-ink/[0.04] border-ink/[0.13] text-ink h-8 w-16" placeholder="Day" />
          {editForm.frequency === "Annually" && <Input value={editForm.dueMonth || ""} onChange={(e) => setEditForm({ ...editForm, dueMonth: e.target.value })} type="number" min="1" max="12" className="bg-ink/[0.04] border-ink/[0.13] text-ink h-8 w-16" placeholder="Mo" />}
          <span className="text-ink/[0.38] text-[10px]">due</span>
        </div>
        <div className="flex gap-2 ml-auto">
          <button onClick={onSave} className="p-1.5 rounded-md bg-green-500/10 text-green-600/70 hover:bg-green-500/20 transition-all"><Check className="w-4 h-4" /></button>
          <button onClick={onCancel} className="p-1.5 rounded-md bg-ink/[0.04] text-ink/[0.48] hover:bg-ink/[0.08] transition-all"><X className="w-4 h-4" /></button>
        </div>
      </div>
    );
  }

  return (
    <div className={`card-hover bg-card rounded-md border p-4 flex items-center gap-5 group ${expense.status === "Overdue" ? "border-red-500/15" : expense.status === "Paid" ? "border-green-500/10 opacity-70" : "border-ink/[0.13]"}`}>
      <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-orange-500/25 to-yellow-400/10 border border-orange-500/25 flex items-center justify-center text-orange-600 font-display font-extrabold text-xs shrink-0">{expense.platform?.charAt(0)}</div>
      <div className="flex-1 min-w-0">
        <span className="text-ink/85 text-sm font-medium">{expense.platform}</span>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded ${expense.frequency === "Monthly" ? "bg-blue-500/10 text-blue-600/60" : expense.frequency === "Quarterly" ? "bg-yellow-500/10 text-yellow-600/60" : "bg-purple-500/10 text-purple-600/60"}`}>{expense.frequency}</span>
          <span className="text-ink/[0.33] text-[10px] px-1.5 py-0.5 rounded bg-ink/[0.03]">{expense.category}</span>
          <span className="text-ink/[0.38] text-xs">Due {formatDueDate(expense.dueDate)}</span>
        </div>
      </div>
      <p className="text-sm font-display font-bold w-24 text-right shrink-0 tabular-nums bg-gradient-to-r from-orange-400 to-amber-300 bg-clip-text text-transparent">${Number(expense.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      <button onClick={onEdit} className="p-1.5 rounded-md hover:bg-ink/5 text-ink/[0.33] hover:text-ink/50 transition-all shrink-0"><Edit className="w-3.5 h-3.5" /></button>
      <button onClick={onDelete} className="p-1.5 rounded-md hover:bg-ink/5 text-ink/[0.33] hover:text-red-600/50 transition-all shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
      <div className="shrink-0">
        {expense.status === "Paid" ? (
          <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500/10 text-green-600/70 border border-green-500/15">✓ Paid</span>
        ) : expense.status === "Overdue" ? (
          <button onClick={onMarkPaid} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-600/80 border border-red-500/20 hover:bg-green-500/10 hover:text-green-600/80 hover:border-green-500/20 transition-all">Not Paid</button>
        ) : (
          <button onClick={onMarkPaid} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-ink/[0.04] text-ink/[0.48] border border-ink/[0.13] hover:bg-green-500/10 hover:text-green-600/80 hover:border-green-500/20 transition-all">Mark Paid</button>
        )}
      </div>
    </div>
  );
}
