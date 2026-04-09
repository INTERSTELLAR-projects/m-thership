import { useState, useMemo } from "react";
import { Plus, DollarSign, CalendarDays, TrendingUp, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "../components/PageHeader";

// dueDay: day of month (1-31)
// dueMonth: null = monthly, 1-12 = annual (month number)
const EXPENSES = [
  { id: 1,  platform: "SERP API",                      amount: 75,   frequency: "Monthly",  dueDay: 7,  dueMonth: null },
  { id: 2,  platform: "GB Gmail",                       amount: 1.99, frequency: "Monthly",  dueDay: 9,  dueMonth: null },
  { id: 3,  platform: "Meta Verified",                  amount: 15,   frequency: "Monthly",  dueDay: 15, dueMonth: null },
  { id: 4,  platform: "Envato",                         amount: 39,   frequency: "Monthly",  dueDay: 21, dueMonth: null },
  { id: 5,  platform: "Render",                         amount: 30,   frequency: "Monthly",  dueDay: 22, dueMonth: null },
  { id: 6,  platform: "iCloud+",                        amount: 9.99, frequency: "Monthly",  dueDay: 23, dueMonth: null },
  { id: 7,  platform: "Canva",                          amount: 15,   frequency: "Monthly",  dueDay: 23, dueMonth: null },
  { id: 8,  platform: "Genspark",                       amount: 25,   frequency: "Monthly",  dueDay: 23, dueMonth: null },
  { id: 9,  platform: "ChatGPT",                        amount: 20,   frequency: "Monthly",  dueDay: 24, dueMonth: null },
  { id: 10, platform: "Typeform",                       amount: 39,   frequency: "Monthly",  dueDay: 26, dueMonth: null },
  { id: 11, platform: "Framer",                         amount: 45,   frequency: "Monthly",  dueDay: 27, dueMonth: null },
  { id: 12, platform: "QuickBooks Simple Start",        amount: 38,   frequency: "Monthly",  dueDay: 29, dueMonth: null },
  { id: 13, platform: "MongoDB",                        amount: 30,   frequency: "Monthly",  dueDay: 6,  dueMonth: null },
  { id: 14, platform: "Claude",                         amount: 20,   frequency: "Monthly",  dueDay: 7,  dueMonth: null },
  { id: 15, platform: "SMPL Social Coding Management",  amount: 200,  frequency: "Monthly",  dueDay: 9,  dueMonth: null },
  { id: 16, platform: "Custom E-Signature",             amount: 68,   frequency: "Annually", dueDay: 25, dueMonth: 1  },
  { id: 17, platform: "Business Gmail / Google Ads",    amount: 168,  frequency: "Annually", dueDay: 2,  dueMonth: 3  },
  { id: 18, platform: "Domain",                         amount: 20,   frequency: "Annually", dueDay: 17, dueMonth: 3  },
  { id: 19, platform: "ZenBusiness Start-Up",           amount: 100,  frequency: "Annually", dueDay: 26, dueMonth: 3  },
  { id: 20, platform: "Zapier Pro",                     amount: 240,  frequency: "Annually", dueDay: 22, dueMonth: 5  },
];

// Returns the current cycle's due date as a Date object
function getCurrentDueDate(expense, now) {
  if (expense.frequency === "Monthly") {
    const d = new Date(now.getFullYear(), now.getMonth(), expense.dueDay);
    return d;
  } else {
    // Annual
    const thisYear = new Date(now.getFullYear(), expense.dueMonth - 1, expense.dueDay);
    if (thisYear < now) {
      return new Date(now.getFullYear() + 1, expense.dueMonth - 1, expense.dueDay);
    }
    return thisYear;
  }
}

// Returns a stable cycle key string for localStorage
function getCycleKey(expense, now) {
  const due = getCurrentDueDate(expense, now);
  if (expense.frequency === "Monthly") {
    return `${expense.id}-${due.getFullYear()}-${due.getMonth()}`;
  }
  return `${expense.id}-${due.getFullYear()}`;
}

function loadPaidState() {
  try { return JSON.parse(localStorage.getItem("ic_financial_paid") || "{}"); } catch { return {}; }
}
function savePaidState(state) {
  localStorage.setItem("ic_financial_paid", JSON.stringify(state));
}

export default function Financial() {
  const now = useMemo(() => new Date(), []);
  const [paidMap, setPaidMap] = useState(() => loadPaidState());
  const [freqFilter, setFreqFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const getStatus = (expense) => {
    const key = getCycleKey(expense, now);
    if (paidMap[key]) return "Paid";
    const due = getCurrentDueDate(expense, now);
    if (due < now) return "Overdue";
    return "Upcoming";
  };

  const markPaid = (expense) => {
    const key = getCycleKey(expense, now);
    const next = { ...paidMap, [key]: true };
    setPaidMap(next);
    savePaidState(next);
  };

  const enriched = EXPENSES.map((e) => ({
    ...e,
    dueDate: getCurrentDueDate(e, now),
    status: getStatus(e),
  }));

  // Upcoming section: not paid, sort by due date ascending, within next 30 days
  const upcoming = enriched
    .filter((e) => e.status !== "Paid")
    .sort((a, b) => a.dueDate - b.dueDate)
    .slice(0, 8);

  const filtered = enriched
    .filter((e) => freqFilter === "All" || e.frequency === freqFilter)
    .filter((e) => statusFilter === "All" || e.status === statusFilter)
    .sort((a, b) => a.dueDate - b.dueDate);

  const totalMonthly = EXPENSES.filter((e) => e.frequency === "Monthly").reduce((s, e) => s + e.amount, 0);
  const totalAnnual = EXPENSES.filter((e) => e.frequency === "Annually").reduce((s, e) => s + e.amount, 0);
  const overdueCount = enriched.filter((e) => e.status === "Overdue").length;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Command Center / Financial" rightText="Expense Management" />

      <div className="px-8 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <SummaryCard icon={DollarSign} label="Total Monthly" value={`$${totalMonthly.toFixed(2)}`} />
          <SummaryCard icon={TrendingUp} label="Total Annual" value={`$${totalAnnual.toFixed(2)}`} />
          <SummaryCard icon={AlertCircle} label="Overdue / Unpaid" value={`${overdueCount} bills`} accent={overdueCount > 0} danger={overdueCount > 0} />
        </div>

        {/* Upcoming Section */}
        {upcoming.length > 0 && (
          <div>
            <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase mb-3">Upcoming Expenses</h2>
            <div className="grid grid-cols-2 gap-3">
              {upcoming.map((e) => (
                <div key={e.id} className={`bg-card rounded-xl border p-4 flex items-center gap-4 transition-all ${e.status === "Overdue" ? "border-red-500/20" : "border-white/[0.06]"}`}>
                  <div className="w-9 h-9 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/30 text-xs font-bold shrink-0">
                    {e.platform.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white/85 text-sm font-medium truncate">{e.platform}</p>
                    <p className="text-white/25 text-xs">{formatDueDate(e.dueDate)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-orange-500 text-sm font-bold">${e.amount.toFixed(2)}</p>
                    <StatusBadge status={e.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters + Add */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase mr-2">Expense List</h2>
            {["All", "Monthly", "Annually"].map((f) => (
              <FilterPill key={f} label={f} active={freqFilter === f} onClick={() => setFreqFilter(f)} />
            ))}
            <span className="text-white/10 text-xs mx-1">|</span>
            {["All", "Upcoming", "Paid", "Overdue"].map((f) => (
              <FilterPill key={f} label={f} active={statusFilter === f} onClick={() => setStatusFilter(f)} danger={f === "Overdue"} />
            ))}
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-orange-500 hover:bg-orange-600 text-white h-9 gap-2">
                <Plus className="w-4 h-4" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-white/[0.06] text-white">
              <DialogHeader><DialogTitle className="text-white">Add New Expense</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-2">
                <div><Label className="text-white/50 text-xs">Platform</Label><Input className="bg-white/[0.03] border-white/[0.06] text-white mt-1" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-white/50 text-xs">Bill Amount ($)</Label><Input type="number" className="bg-white/[0.03] border-white/[0.06] text-white mt-1" /></div>
                  <div>
                    <Label className="text-white/50 text-xs">Billing Frequency</Label>
                    <Select>
                      <SelectTrigger className="bg-white/[0.03] border-white/[0.06] text-white mt-1"><SelectValue placeholder="Frequency" /></SelectTrigger>
                      <SelectContent className="bg-card border-white/[0.06]">
                        <SelectItem value="Monthly" className="text-white/70">Monthly</SelectItem>
                        <SelectItem value="Annually" className="text-white/70">Annually</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div><Label className="text-white/50 text-xs">Due Date</Label><Input className="bg-white/[0.03] border-white/[0.06] text-white mt-1" placeholder="e.g. 15 or 03/17" /></div>
                <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white">Add Expense</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Expense Table */}
        <div className="space-y-2">
          {filtered.map((expense) => (
            <div
              key={expense.id}
              className={`bg-card rounded-xl border p-4 flex items-center gap-5 group transition-all ${
                expense.status === "Overdue" ? "border-red-500/15" :
                expense.status === "Paid" ? "border-green-500/10 opacity-70" :
                "border-white/[0.06] hover:border-orange-500/15"
              }`}
            >
              <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/30 text-xs font-bold shrink-0">
                {expense.platform.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-white/85 text-sm font-medium">{expense.platform}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-[10px] font-semibold tracking-wider px-1.5 py-0.5 rounded ${expense.frequency === "Monthly" ? "bg-blue-500/10 text-blue-400/60" : "bg-purple-500/10 text-purple-400/60"}`}>
                    {expense.frequency}
                  </span>
                  <span className="text-white/20 text-xs">Due {formatDueDate(expense.dueDate)}</span>
                </div>
              </div>
              <p className="text-orange-500 text-sm font-bold w-16 text-right shrink-0">${expense.amount.toFixed(2)}</p>
              <div className="shrink-0">
                {expense.status === "Paid" ? (
                  <span className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-500/10 text-green-400/70 border border-green-500/15">✓ Paid</span>
                ) : expense.status === "Overdue" ? (
                  <button
                    onClick={() => markPaid(expense)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-500/10 text-red-400/80 border border-red-500/20 hover:bg-green-500/10 hover:text-green-400/80 hover:border-green-500/20 transition-all"
                  >
                    Not Paid
                  </button>
                ) : (
                  <button
                    onClick={() => markPaid(expense)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/[0.04] text-white/30 border border-white/[0.06] hover:bg-green-500/10 hover:text-green-400/80 hover:border-green-500/20 transition-all"
                  >
                    Mark Paid
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function formatDueDate(date) {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function StatusBadge({ status }) {
  if (status === "Paid") return <span className="text-[10px] font-semibold text-green-400/60">Paid</span>;
  if (status === "Overdue") return <span className="text-[10px] font-semibold text-red-400/70">Overdue</span>;
  return <span className="text-[10px] font-semibold text-orange-400/60">Upcoming</span>;
}

function FilterPill({ label, active, onClick, danger }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
        active
          ? danger
            ? "bg-red-500/15 text-red-400 border border-red-500/20"
            : "bg-orange-500/15 text-orange-500 border border-orange-500/20"
          : "text-white/30 hover:text-white/50 border border-transparent"
      }`}
    >
      {label}
    </button>
  );
}

function SummaryCard({ icon: Icon, label, value, accent, danger }) {
  return (
    <div className="bg-card rounded-xl border border-white/[0.06] p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${danger ? "text-red-400/60" : accent ? "text-orange-500" : "text-white/25"}`} />
        <span className="text-white/30 text-xs">{label}</span>
      </div>
      <p className={`text-xl font-bold ${danger ? "text-red-400/80" : accent ? "text-orange-500" : "text-white/80"}`}>{value}</p>
    </div>
  );
}