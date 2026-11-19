// Client profile completeness meter (header card on the client page).
// Overall %, a bar per criteria group, and "Unlocks" chips showing which outputs are ready and exactly
// which fields block the rest. Click a missing field to fill it inline (saved to the entity criteria.js
// names), send one portal intake for everything the client can answer, or ask Claude to research
// public sources and propose values (accepted field by field).
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronUp, Inbox, Loader2, Lock, Send, Sparkles } from "lucide-react";
import { useJobs, JOB_STATUS } from "@/features/claude/jobs";
import { GROUPS, displayValue, evaluateCriteria } from "./criteria";
import { loadClientContext } from "./clientContext";
import { applyProfileAnswers, askableMissing, pendingProfileAnswers, sendProfileIntake, writeCriterion } from "./profileActions";
import { isEnrichJob, queueEnrichProfile } from "./enrich";
import EnrichReview from "./EnrichReview";

const barTone = (p) => (p >= 80 ? "from-[#ff3c00] to-[#ffaa00]" : p >= 50 ? "from-[#ff3c00] to-[#ff6a00]" : "from-[#ff3c00]/70 to-[#ff3c00]/70");

function InlineEdit({ item, onSave, onCancel, go }) {
  const [v, setV] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  if (item.write && item.write.to === "tab") {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2 text-[12px] text-ink/60">
        Add real figures on the Goals &amp; Gaps tab (metric, current, target).
        <button type="button" onClick={() => go(item.write.tab)} className="rounded-sm border border-hair px-2 py-1 hover:border-[#ff3c00] hover:text-[#ff3c00]">Open Goals &amp; Gaps</button>
        <button type="button" onClick={onCancel} className="text-ink/45 hover:text-ink">Close</button>
      </div>
    );
  }
  const save = async (val) => {
    setBusy(true); setErr("");
    try { await onSave(val); } catch (e) { setErr(String(e?.message || e)); setBusy(false); }
  };
  if (item.access) {
    return (
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[12px] text-ink/55">Record only. Never store passwords.</span>
        <button type="button" disabled={busy} onClick={() => save("granted")} className="rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-50">Access granted</button>
        <button type="button" disabled={busy} onClick={() => save("not_needed")} className="rounded-sm border border-hair px-2.5 py-1 text-[12px] hover:border-ink/40">Not needed</button>
        <button type="button" onClick={onCancel} className="text-[12px] text-ink/45 hover:text-ink">Cancel</button>
        {err && <span className="text-[12px] text-red-700">{err}</span>}
      </div>
    );
  }
  const long = item.write && (item.write.list || /description|voice|goal|customer|differ|case|awards|address/.test(item.key));
  return (
    <div className="mt-2 space-y-1.5">
      {long
        ? <textarea autoFocus rows={3} value={v} onChange={(e) => setV(e.target.value)} placeholder={item.write.list ? "One per line" : "Only facts you know to be true"} className="w-full rounded-sm border border-hair bg-paper px-2.5 py-1.5 text-[12.5px] outline-none focus:border-[#ff3c00]" />
        : <input autoFocus value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && v.trim()) save(v); }} placeholder="Only facts you know to be true" className="h-8 w-full rounded-sm border border-hair bg-paper px-2.5 text-[12.5px] outline-none focus:border-[#ff3c00]" />}
      <div className="flex items-center gap-2">
        <button type="button" disabled={busy || !v.trim()} onClick={() => save(v)} className="inline-flex items-center gap-1 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-2.5 py-1 text-[12px] font-medium text-white disabled:opacity-50">{busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}Save</button>
        <button type="button" onClick={onCancel} className="text-[12px] text-ink/45 hover:text-ink">Cancel</button>
        <span className="text-[11px] text-ink/40">Saves to {item.stored.split(" / ")[0]}</span>
        {err && <span className="text-[12px] text-red-700">{err}</span>}
      </div>
    </div>
  );
}

export default function ProfileMeter({ client, go, startOpen = false }) {
  const qc = useQueryClient();
  const ctxQ = useQuery({ queryKey: ["clientContext", client.id], queryFn: () => loadClientContext(client.id), staleTime: 30_000 });
  const pendingQ = useQuery({ queryKey: ["clientContext", client.id, "pendingIntake"], queryFn: () => pendingProfileAnswers(client.id), staleTime: 30_000 });
  const { data: jobs = [] } = useJobs();
  const ctx = ctxQ.data;
  const ev = useMemo(() => (ctx ? evaluateCriteria(ctx) : null), [ctx]);
  const [open, setOpen] = useState(startOpen);
  const [focus, setFocus] = useState(null); // output key whose blockers are highlighted
  const [editing, setEditing] = useState(null);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");

  const enrichJob = jobs.find((j) => j.client_id === client.id && isEnrichJob(j) && !["approved", "cancelled"].includes(j.status)) || null;
  const refresh = () => ["clientContext", "CRMClient", "profileCompleteness", "ClaudeJob"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  const act = async (key, fn, done) => {
    setBusy(key); setMsg("");
    try { const r = await fn(); refresh(); setMsg(typeof done === "function" ? done(r) : done); } catch (e) { setMsg(String(e?.message || e)); } finally { setBusy(""); }
  };

  if (ctxQ.isLoading || !ev) return <div className="mt-5 h-[74px] animate-pulse rounded-md border border-hair bg-ink/[0.03]" />;
  if (ctxQ.isError) return null;

  const askable = askableMissing(ev);
  const pending = (pendingQ.data && pendingQ.data.requests) || [];
  const form = pendingQ.data && pendingQ.data.form;
  const blockersOf = focus ? new Set((ev.outputs.find((o) => o.key === focus) || { blockers: [] }).blockers.map((b) => b.key)) : null;

  return (
    <section className={`${startOpen ? "" : "mt-5 "}rounded-md border border-hair bg-card`}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 shrink-0">
            <svg viewBox="0 0 36 36" className="h-12 w-12 -rotate-90"><circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" strokeOpacity="0.08" strokeWidth="3.5" /><circle cx="18" cy="18" r="15.5" fill="none" stroke="url(#pm-grad)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(ev.pct / 100) * 97.4} 97.4`} /><defs><linearGradient id="pm-grad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#ff3c00" /><stop offset="50%" stopColor="#ff6a00" /><stop offset="100%" stopColor="#ffaa00" /></linearGradient></defs></svg>
            <span className="absolute inset-0 flex items-center justify-center text-[12px] font-semibold tabular-nums">{ev.pct}%</span>
          </div>
          <div>
            <p className="mono-label text-[9px] text-ink/45">Client profile</p>
            <p className="text-[13px] font-medium">{ev.missing.length ? `${ev.missing.length} field${ev.missing.length === 1 ? "" : "s"} missing` : "Complete"}</p>
          </div>
        </div>
        <div className="grid min-w-[220px] flex-1 grid-cols-3 gap-x-4 gap-y-1.5 sm:grid-cols-6">
          {ev.groups.map((g) => (
            <div key={g.key} title={g.missing.length ? `Missing: ${g.missing.map((m) => m.label).join(", ")}` : "Complete"}>
              <div className="flex items-baseline justify-between gap-1"><span className="truncate text-[10.5px] text-ink/55">{g.label}</span><span className="text-[10px] tabular-nums text-ink/40">{g.pct}%</span></div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink/[0.07]"><div className={`h-full rounded-full bg-gradient-to-r ${barTone(g.pct)}`} style={{ width: `${g.pct}%` }} /></div>
            </div>
          ))}
        </div>
        <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1 rounded-sm border border-hair px-2.5 py-1.5 text-[12px] text-ink/65 hover:border-[#ff3c00] hover:text-[#ff3c00]">
          {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}{open ? "Hide" : "Fill gaps"}
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 border-t border-hair px-4 py-2.5">
        <span className="mono-label mr-1 text-[9px] text-ink/45">Unlocks</span>
        {ev.outputs.map((o) => (
          <button key={o.key} type="button" onClick={() => { setFocus(focus === o.key ? null : o.key); setOpen(true); }}
            title={o.ready ? "Ready: every field it needs is on file" : `Blocked by: ${o.blockers.map((b) => b.label).join(", ")}`}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11.5px] transition-colors ${o.ready ? "border-green-600/25 bg-green-600/[0.07] text-green-800" : "border-hair bg-ink/[0.03] text-ink/55"} ${focus === o.key ? "ring-1 ring-[#ff3c00]" : ""}`}>
            {o.ready ? <Check className="h-3 w-3" /> : <Lock className="h-3 w-3" />}{o.label}{!o.ready && <span className="text-ink/40">· {o.blockers.length}</span>}
          </button>
        ))}
      </div>

      {open && (
        <div className="space-y-4 border-t border-hair px-4 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={!!busy || !askable.length} onClick={() => act("intake", () => sendProfileIntake(ctx, ev), `Intake ${form ? "updated" : "sent"} in their portal: ${askable.length} question${askable.length === 1 ? "" : "s"}.`)}
              title={client.portal_enabled ? "One portal form with every missing field the client can answer" : "Their portal is off: the form is saved, turn the portal on so they can see it"}
              className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-3 py-1.5 text-[12px] font-medium text-white disabled:opacity-50">
              {busy === "intake" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}Send intake for missing fields ({askable.length})
            </button>
            {pending.length > 0 && (
              <button type="button" disabled={!!busy} onClick={() => act("apply", () => applyProfileAnswers(ctx, ev, pending), (n) => `Applied ${n} answer${n === 1 ? "" : "s"} to empty fields.`)} className="inline-flex items-center gap-1.5 rounded-sm border border-[#ff3c00] px-3 py-1.5 text-[12px] font-medium text-[#d83300]">
                {busy === "apply" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Inbox className="h-3.5 w-3.5" />}Apply {pending.length} intake answer{pending.length === 1 ? "" : "s"}
              </button>
            )}
            <button type="button" disabled={!!busy || !!enrichJob} onClick={() => act("enrich", () => queueEnrichProfile(ctx), "Queued for Claude: it will research their site, Google profile and listings and propose values with sources.")}
              className="inline-flex items-center gap-1.5 rounded-sm border border-hair px-3 py-1.5 text-[12px] hover:border-[#ff3c00] hover:text-[#ff3c00] disabled:opacity-50">
              {busy === "enrich" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Auto-enrich with Claude
            </button>
            {form && form.updated_date && <span className="text-[11.5px] text-ink/45">Profile intake last sent {String(form.updated_date).slice(0, 10)}{client.portal_enabled ? "" : " · portal is off"}</span>}
            {msg && <span className="text-[12px] text-ink/65">{msg}</span>}
          </div>

          {enrichJob && (
            <div className="rounded-sm border border-hair bg-paper p-3">
              <p className="mb-2 flex flex-wrap items-center gap-2 text-[12.5px] font-medium">Claude enrichment <span className={`rounded-sm px-1.5 py-0.5 text-[10.5px] ${(JOB_STATUS[enrichJob.status] || {}).tone || ""}`}>{(JOB_STATUS[enrichJob.status] || {}).label || enrichJob.status}</span>{enrichJob.result_summary && <span className="font-normal text-ink/55">{enrichJob.result_summary}</span>}</p>
              {enrichJob.status === "needs_approval" ? <EnrichReview job={enrichJob} ctx={ctx} /> : <p className="text-[12px] text-ink/50">Waiting for Claude&apos;s next run. Proposals land here for you to accept field by field.</p>}
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {GROUPS.map((g) => {
              const items = ev.items.filter((i) => i.group === g.key);
              return (
                <div key={g.key}>
                  <p className="mono-label mb-1.5 text-[9px] text-ink/45">{g.label}</p>
                  <ul className="divide-y divide-hair rounded-sm border border-hair">
                    {items.map((i) => (
                      <li key={i.key} className={`px-3 py-2 ${blockersOf && blockersOf.has(i.key) ? "bg-[#ff3c00]/[0.05]" : ""}`}>
                        <div className="flex items-start gap-2">
                          {i.filled ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-700" /> : <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-[#ff3c00]" />}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[12.5px] font-medium">{i.label}</span>
                              {!i.filled && editing !== i.key && <button type="button" onClick={() => setEditing(i.key)} className="shrink-0 text-[11.5px] text-[#d83300] hover:underline">Add</button>}
                            </div>
                            {i.filled ? <p className="truncate text-[11.5px] text-ink/55" title={displayValue(i.value, 1000)}>{displayValue(i.value, 140)}</p>
                              : <p className="text-[11px] text-ink/40">{i.unlocks.length ? `Unlocks ${i.unlocks.map((u) => ev.outputs.find((o) => o.key === u)?.label || u).join(", ")}` : "Nice to have"}</p>}
                            {editing === i.key && (
                              <InlineEdit item={i} go={go} onCancel={() => setEditing(null)} onSave={async (val) => { await writeCriterion(ctx, i.key, val); setEditing(null); refresh(); }} />
                            )}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-ink/40">Values come from the first source that has them (CRM, Constellations dossier, onboarding flight, intake, outreach profile, approved brand kit). Every generator reads this same profile. Never enter a fact you have not confirmed.</p>
        </div>
      )}
    </section>
  );
}
