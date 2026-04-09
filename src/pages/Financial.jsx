import { useState } from "react";
import { Plus, DollarSign, CalendarDays, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PageHeader from "../components/PageHeader";

const expenses = [
  { id: 1, platform: "Vercel", amount: 20, frequency: "Monthly", dueDate: "1st", category: "Hosting", notes: "Pro plan" },
  { id: 2, platform: "SEMrush", amount: 119.95, frequency: "Monthly", dueDate: "15th", category: "SEO Tools", notes: "Guru plan" },
  { id: 3, platform: "Google Workspace", amount: 72, frequency: "Monthly", dueDate: "1st", category: "Operations", notes: "6 seats" },
  { id: 4, platform: "Cloudflare", amount: 25, frequency: "Monthly", dueDate: "5th", category: "Hosting", notes: "Pro plan" },
  { id: 5, platform: "Figma", amount: 15, frequency: "Monthly", dueDate: "10th", category: "Design", notes: "Professional" },
  { id: 6, platform: "Slack", amount: 8.75, frequency: "Monthly", dueDate: "1st", category: "Operations", notes: "Pro per seat" },
  { id: 7, platform: "Notion", amount: 10, frequency: "Monthly", dueDate: "20th", category: "Operations", notes: "Plus plan" },
];

export default function Financial() {
  const totalMonthly = expenses.reduce((sum, e) => sum + e.amount, 0);
  const totalAnnual = totalMonthly * 12;
  const upcoming = expenses.filter((e) => parseInt(e.dueDate) <= 15).length;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Command Center / Financial" rightText="Expense Management" />

      <div className="px-8 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-4">
          <SummaryCard icon={DollarSign} label="Total Monthly Expenses" value={`$${totalMonthly.toFixed(2)}`} />
          <SummaryCard icon={TrendingUp} label="Total Annual Expenses" value={`$${totalAnnual.toFixed(2)}`} />
          <SummaryCard icon={CalendarDays} label="Upcoming This Month" value={`${upcoming} bills`} accent />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <h2 className="text-white font-bold text-xs tracking-[0.2em] uppercase">Expense List</h2>
          <Dialog>
            <DialogTrigger asChild>
              <Button className="bg-orange-500 hover:bg-orange-600 text-white h-9 gap-2">
                <Plus className="w-4 h-4" />
                Add Expense
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-white/[0.06] text-white">
              <DialogHeader>
                <DialogTitle className="text-white">Add New Expense</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label className="text-white/50 text-xs">Platform</Label>
                  <Input className="bg-white/[0.03] border-white/[0.06] text-white mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-white/50 text-xs">Bill Amount ($)</Label>
                    <Input type="number" className="bg-white/[0.03] border-white/[0.06] text-white mt-1" />
                  </div>
                  <div>
                    <Label className="text-white/50 text-xs">Billing Frequency</Label>
                    <Select>
                      <SelectTrigger className="bg-white/[0.03] border-white/[0.06] text-white mt-1">
                        <SelectValue placeholder="Frequency" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-white/[0.06]">
                        <SelectItem value="monthly" className="text-white/70">Monthly</SelectItem>
                        <SelectItem value="quarterly" className="text-white/70">Quarterly</SelectItem>
                        <SelectItem value="annually" className="text-white/70">Annually</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-white/50 text-xs">Due Date</Label>
                    <Input className="bg-white/[0.03] border-white/[0.06] text-white mt-1" placeholder="e.g. 1st, 15th" />
                  </div>
                  <div>
                    <Label className="text-white/50 text-xs">Category</Label>
                    <Input className="bg-white/[0.03] border-white/[0.06] text-white mt-1" />
                  </div>
                </div>
                <div>
                  <Label className="text-white/50 text-xs">Notes</Label>
                  <Input className="bg-white/[0.03] border-white/[0.06] text-white mt-1" />
                </div>
                <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white">Add Expense</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Expense List */}
        <div className="space-y-2">
          {expenses.map((expense) => (
            <div
              key={expense.id}
              className="bg-card rounded-xl border border-white/[0.06] p-4 flex items-center gap-6 group hover:border-orange-500/15 transition-all"
            >
              <div className="w-10 h-10 rounded-lg bg-white/[0.04] flex items-center justify-center text-white/30 text-xs font-bold">
                {expense.platform.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-white/85 text-sm font-medium">{expense.platform}</span>
                <p className="text-white/25 text-xs mt-0.5">{expense.category} · {expense.notes}</p>
              </div>
              <div className="text-right">
                <p className="text-orange-500 text-sm font-bold">${expense.amount.toFixed(2)}</p>
                <p className="text-white/20 text-xs">{expense.frequency} · Due {expense.dueDate}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, accent }) {
  return (
    <div className="bg-card rounded-xl border border-white/[0.06] p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${accent ? "text-orange-500" : "text-white/25"}`} />
        <span className="text-white/30 text-xs">{label}</span>
      </div>
      <p className={`text-xl font-bold ${accent ? "text-orange-500" : "text-white/80"}`}>{value}</p>
    </div>
  );
}