import { useState } from "react";
import { Plus, FileText, Shield, Clock, CheckSquare, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import PageHeader from "../components/PageHeader";

const legalDocs = [
  { name: "Master Services Agreement", status: "Active", lastUpdated: "Mar 15, 2026" },
  { name: "Non-Disclosure Agreement (Template)", status: "Active", lastUpdated: "Feb 28, 2026" },
  { name: "Contractor Agreement", status: "Review", lastUpdated: "Mar 10, 2026" },
  { name: "Terms of Service", status: "Active", lastUpdated: "Jan 05, 2026" },
];

const policies = [
  { name: "Privacy Policy", version: "v2.3", lastUpdated: "Mar 18, 2026" },
  { name: "Data Retention Policy", version: "v1.1", lastUpdated: "Feb 01, 2026" },
  { name: "Acceptable Use Policy", version: "v1.0", lastUpdated: "Jan 15, 2026" },
];

const deadlines = [
  { task: "Annual Business License Renewal", dueDate: "Jun 30, 2026", status: "Upcoming" },
  { task: "Insurance Policy Review", dueDate: "May 15, 2026", status: "Upcoming" },
  { task: "Tax Filing (Federal)", dueDate: "Apr 15, 2026", status: "Urgent" },
];

const todos = [
  { task: "Review updated contractor agreement", done: false },
  { task: "Update privacy policy for new data regulations", done: false },
  { task: "File Q1 state taxes", done: true },
  { task: "Renew cyber liability insurance", done: false },
];

const importantDates = [
  { event: "Business License Renewal", date: "Jun 30, 2026" },
  { event: "Annual Insurance Review", date: "May 15, 2026" },
  { event: "Tax Filing Deadline", date: "Apr 15, 2026" },
  { event: "Contract Renewal - NW Tree Service", date: "Jul 01, 2026" },
];

export default function Legal() {
  return (
    <div className="min-h-screen bg-background">
      <PageHeader breadcrumb="Command Center / Legal" rightText="Legal Management" />

      <div className="px-8 py-6 space-y-6">
        {/* Top Grid */}
        <div className="grid grid-cols-2 gap-6">
          {/* Legal Documents */}
          <Section title="Legal Documents" icon={FileText}>
            <div className="space-y-2">
              {legalDocs.map((doc) => (
                <div key={doc.name} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <div>
                    <p className="text-white/75 text-sm">{doc.name}</p>
                    <p className="text-white/20 text-xs mt-0.5">Updated {doc.lastUpdated}</p>
                  </div>
                  <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded ${
                    doc.status === "Active" ? "text-green-400/70 bg-green-400/10" : "text-yellow-400/70 bg-yellow-400/10"
                  }`}>
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          {/* Policies */}
          <Section title="Policies" icon={Shield}>
            <div className="space-y-2">
              {policies.map((policy) => (
                <div key={policy.name} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <div>
                    <p className="text-white/75 text-sm">{policy.name}</p>
                    <p className="text-white/20 text-xs mt-0.5">Updated {policy.lastUpdated}</p>
                  </div>
                  <span className="text-white/20 text-xs font-mono">{policy.version}</span>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* Middle Grid */}
        <div className="grid grid-cols-2 gap-6">
          {/* Compliance Deadlines */}
          <Section title="Compliance Deadlines" icon={Clock}>
            <div className="space-y-2">
              {deadlines.map((d) => (
                <div key={d.task} className="flex items-center justify-between py-2 border-b border-white/[0.04] last:border-0">
                  <div>
                    <p className="text-white/75 text-sm">{d.task}</p>
                    <p className="text-white/20 text-xs mt-0.5">Due: {d.dueDate}</p>
                  </div>
                  <span className={`text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded ${
                    d.status === "Urgent" ? "text-red-400/70 bg-red-400/10" : "text-orange-400/70 bg-orange-400/10"
                  }`}>
                    {d.status}
                  </span>
                </div>
              ))}
            </div>
          </Section>

          {/* Legal To-Do */}
          <Section title="Legal To-Do List" icon={CheckSquare}>
            <div className="space-y-2">
              {todos.map((todo) => (
                <div key={todo.task} className="flex items-center gap-3 py-2 border-b border-white/[0.04] last:border-0">
                  <div className={`w-4 h-4 rounded border flex items-center justify-center ${
                    todo.done ? "bg-orange-500/20 border-orange-500/40" : "border-white/15"
                  }`}>
                    {todo.done && <CheckSquare className="w-3 h-3 text-orange-500" />}
                  </div>
                  <span className={`text-sm ${todo.done ? "text-white/30 line-through" : "text-white/70"}`}>
                    {todo.task}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        </div>

        {/* Important Dates */}
        <Section title="Important Dates" icon={CalendarDays}>
          <div className="grid grid-cols-2 gap-3">
            {importantDates.map((d) => (
              <div key={d.event} className="flex items-center justify-between py-2 px-3 bg-white/[0.02] rounded-lg border border-white/[0.04]">
                <span className="text-white/60 text-sm">{d.event}</span>
                <span className="text-orange-500/60 text-xs font-medium">{d.date}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, icon: SectionIcon, children }) {
  return (
    <div className="bg-card rounded-xl border border-white/[0.06] p-5">
      <div className="flex items-center gap-2 mb-4">
        <SectionIcon className="w-4 h-4 text-orange-500/40" />
        <h3 className="text-white font-bold text-xs tracking-[0.15em] uppercase">{title}</h3>
      </div>
      {children}
    </div>
  );
}