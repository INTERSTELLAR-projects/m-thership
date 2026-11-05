// Hiring plan > New hires. Adding a hire offers "Assign onboarding track" right away (Interstellar's own tracks,
// defaulting to the track built for the Hiring plan role). Hires live on HiringPlan.hires.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Check, GraduationCap, Plus, UserPlus } from "lucide-react";
import { trainingApi } from "./api";
import { AssignDialog } from "./ManagerView";
import { Bar, Button, Chip, Field, inputCls, todayIso, fmtDay } from "./ui";

const call = trainingApi("agency");

export default function HireOnboardingCard({ plan, save, defaultRole = "Client Operations & Build Specialist" }) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["training", "agency", "overview"], queryFn: () => call("overview"), retry: false });
  const hires = useMemo(() => plan?.hires || [], [plan]);
  const [form, setForm] = useState(null);
  const [assignFor, setAssignFor] = useState(null);
  const tracks = q.data?.tracks || [];
  const byHire = new Map((q.data?.assignments || []).filter((a) => a.source === "hiring_plan").map((a) => [a.hire_key || "", a]));
  const assignOf = (h) => (q.data?.assignments || []).find((a) => a.id === h.assignment_id) || byHire.get(h.key);
  const roleTrack = tracks.find((t) => t.hiring_role_key === "client_ops_build") || tracks[0];

  const add = async () => {
    const h = { key: `h${Date.now().toString(36)}`, name: form.name.trim(), email: form.email.trim(), role: form.role.trim() || defaultRole, start_date: form.start_date, added_at: new Date().toISOString() };
    const ok = await save({ hires: [...hires, h] }, `${h.name} added`);
    if (ok) { setForm(null); setAssignFor(h); }
  };

  return (
    <section className="border border-hair bg-card" data-hire-onboarding>
      <header className="flex flex-wrap items-center gap-3 border-b border-hair px-4 py-3">
        <span className="flame-bg flex h-8 w-8 items-center justify-center text-white"><UserPlus className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <p className="mono-label text-[9.5px] text-ink/50">New hires · onboarding</p>
          <h3 className="text-[15px] font-semibold tracking-[-0.02em]">Add a hire, then assign their onboarding track</h3>
        </div>
        <Link to="/training" className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#ff3c00] hover:underline">Training <ArrowUpRight className="h-3.5 w-3.5" /></Link>
        {!form && <Button size="sm" kind="ink" icon={Plus} onClick={() => setForm({ name: "", email: "", role: defaultRole, start_date: todayIso() })}>Add hire</Button>}
      </header>
      {form && (
        <div className="grid gap-3 border-b border-hair bg-paper px-4 py-4 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1.2fr_150px_auto] lg:items-end">
          <Field label="Name"><input value={form.name} onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))} className={inputCls} /></Field>
          <Field label="Email"><input type="email" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} className={inputCls} /></Field>
          <Field label="Role"><input value={form.role} onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))} className={inputCls} /></Field>
          <Field label="Start date"><input type="date" value={form.start_date} onChange={(e) => setForm((s) => ({ ...s, start_date: e.target.value }))} className={inputCls} /></Field>
          <div className="flex gap-2"><Button kind="quiet" onClick={() => setForm(null)}>Cancel</Button><Button kind="flame" disabled={!form.name.trim()} onClick={add}>Add</Button></div>
        </div>
      )}
      {!hires.length ? (
        <p className="px-4 py-5 text-[13px] text-ink/55">No hires yet. When you hire, add them here and assign {roleTrack ? <>the <span className="font-medium text-ink">{roleTrack.title}</span> track</> : "an onboarding track"} in one step.</p>
      ) : (
        <ul className="divide-y divide-hair">
          {hires.map((h) => {
            const a = assignOf(h);
            return (
              <li key={h.key} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <span className="min-w-[160px] flex-1">
                  <span className="block text-[14px] font-semibold">{h.name}</span>
                  <span className="block text-[12px] text-ink/55">{h.role}{h.start_date ? ` · starts ${fmtDay(h.start_date)}` : ""}</span>
                </span>
                {a ? (
                  <span className="flex w-full items-center gap-3 sm:w-[320px]">
                    <GraduationCap className="h-4 w-4 shrink-0 text-[#ff3c00]" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-[12px] text-ink/65">{a.track_title}</span><Bar pct={a.pct} className="mt-1 h-1.5" /></span>
                    {a.status === "completed" ? <Chip tone="green"><Check className="h-2.5 w-2.5" />Done</Chip> : <span className="font-mono text-[11px] text-ink/55">{a.pct}%</span>}
                  </span>
                ) : (
                  <Button size="sm" kind="flame" icon={GraduationCap} disabled={!tracks.length} onClick={() => setAssignFor(h)}>Assign onboarding track</Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <AssignDialog
        open={!!assignFor}
        onClose={() => setAssignFor(null)}
        tracks={tracks}
        call={call}
        refresh={() => qc.invalidateQueries({ queryKey: ["training", "agency"] })}
        preset={assignFor ? { track_id: roleTrack?.id, trainee_name: assignFor.name, trainee_email: assignFor.email, start_date: assignFor.start_date, source: "hiring_plan", hire_key: assignFor.key } : null}
      />
    </section>
  );
}
