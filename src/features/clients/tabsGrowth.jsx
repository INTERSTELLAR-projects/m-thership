import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Pencil, Upload, Download, Link2, Sparkles, Copy, Check, Send, ChevronDown } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { useClientRecords } from "./hooks";
import { Panel, Empty, Btn, SmallBtn, Tag, FormDialog, Field } from "./ui";
import { fmtDate, timeAgo } from "@/lib/useData";
import { INTAKE_SECTIONS, intakeProgress, intakeAsText } from "./intakeQuestions";

/* ---------------- Performance ---------------- */
export const METRICS = {
  gbp: { label: "Google Business Profile", keys: [["views", "Profile views"], ["searches", "Searches"], ["calls", "Calls"], ["directions", "Directions"], ["website_clicks", "Website clicks"]] },
  gsc: { label: "Search Console", keys: [["clicks", "Clicks"], ["impressions", "Impressions"], ["ctr", "CTR %"], ["avg_position", "Avg. position"]] },
  ga4: { label: "Google Analytics", keys: [["users", "Users"], ["sessions", "Sessions"], ["conversions", "Conversions"], ["engagement_rate", "Engagement %"]] },
  bing: { label: "Bing", keys: [["clicks", "Clicks"], ["impressions", "Impressions"]] },
  // Synced daily by social-clients (month to date) once the client's Instagram is linked in Social Studio.
  instagram: { label: "Instagram", keys: [["followers", "Followers"], ["reach", "Accounts reached"], ["views", "Views"], ["accounts_engaged", "Accounts engaged"], ["total_interactions", "Interactions"], ["posts", "Posts"]] },
};

export function PerformanceView({ snapshots, onAdd, compact }) {
  const latest = (src) => snapshots.filter((s) => s.source === src).sort((a, b) => String(b.period_end).localeCompare(String(a.period_end)));
  // Client portal (compact): only show sources that have numbers, and one friendly note when none do yet.
  const sources = Object.entries(METRICS).filter(([src]) => !compact || latest(src).length);
  if (compact && !sources.length) {
    return (
      <Panel label="Monthly numbers" title="Your first report is on its way">
        <Empty>Google Business, Search Console and Analytics numbers appear here once your first full month is in. You&apos;ll see calls, website clicks, searches and how each one moved month over month.</Empty>
      </Panel>
    );
  }
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {sources.map(([src, def]) => {
        const list = latest(src);
        const cur = list[0];
        const prev = list[1];
        return (
          <Panel key={src} label={def.label} title={cur ? `${fmtDate(cur.period_start)} – ${fmtDate(cur.period_end)}` : "No data yet"} action={onAdd && <SmallBtn onClick={() => onAdd(src)}><Plus className="h-3 w-3" /> Add</SmallBtn>}>
            {cur ? (
              <div className={`grid ${compact ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3"}`}>
                {def.keys.map(([k, l]) => {
                  const v = Number(cur.metrics?.[k]);
                  const p = Number(prev?.metrics?.[k]);
                  const delta = prev && Number.isFinite(p) && p !== 0 && Number.isFinite(v) ? Math.round(((v - p) / p) * 100) : null;
                  const lowerBetter = k === "avg_position";
                  const good = delta == null ? null : lowerBetter ? delta < 0 : delta > 0;
                  return (
                    <div key={k} className="border-b border-r border-hair px-4 py-3">
                      <p className="text-[22px] font-semibold tabular-nums tracking-[-0.03em]">{Number.isFinite(v) ? v.toLocaleString() : "—"}</p>
                      <p className="mono-label mt-1 text-[9px] text-ink/50">{l}</p>
                      {delta != null && <p className={`mt-1 text-[11px] font-medium ${good ? "text-green-700" : "text-red-700"}`}>{delta > 0 ? "+" : ""}{delta}% vs prior</p>}
                    </div>
                  );
                })}
              </div>
            ) : (
              <Empty>{src === "gbp" || src === "gsc" || src === "ga4" ? "Connects automatically in Phase 5. Until then you can enter monthly numbers by hand." : "Add numbers by hand for now."}</Empty>
            )}
          </Panel>
        );
      })}
    </div>
  );
}

export function PerformanceTab({ client }) {
  const snaps = useClientRecords("PerformanceSnapshot", client.id, { sort: "-period_end" });
  const [src, setSrc] = useState(null);
  const def = src ? METRICS[src] : null;
  const fields = def ? [
    { name: "period_start", label: "Period start", type: "date", required: true },
    { name: "period_end", label: "Period end", type: "date", required: true },
    ...def.keys.map(([k, l]) => ({ name: `m_${k}`, label: l, type: "number" })),
  ] : [];
  return (
    <>
      <PerformanceView snapshots={snaps.rows} onAdd={setSrc} />
      <FormDialog open={!!src} title={def ? `${def.label} numbers` : ""} fields={fields} initial={{}} onClose={() => setSrc(null)}
        onSubmit={(v) => {
          const metrics = {}; def.keys.forEach(([k]) => { if (v[`m_${k}`] != null) metrics[k] = v[`m_${k}`]; });
          return snaps.create({ source: src, period_start: v.period_start, period_end: v.period_end, metrics, captured_at: new Date().toISOString() });
        }} />
    </>
  );
}

/* ---------------- Goals, gaps & future projects ---------------- */
export function GoalsTab({ client }) {
  const goals = useClientRecords("ClientGoal", client.id, { sort: "sort" });
  const gaps = useClientRecords("ClientGap", client.id);
  const projects = useClientRecords("Project", client.id);
  const [g, setG] = useState(null);
  const [gap, setGap] = useState(null);
  const [proj, setProj] = useState(null);
  const future = projects.rows.filter((p) => ["proposed", "backlog"].includes(p.status));

  const GOAL_FIELDS = [
    { name: "title", label: "Goal", type: "text", required: true, placeholder: "Double booked jobs from Google" },
    { name: "year", label: "Year", type: "number" },
    { name: "metric", label: "Measured by", type: "text", placeholder: "Calls from GBP per month" },
    { name: "baseline_value", label: "Starting value", type: "number" },
    { name: "current_value", label: "Current value", type: "number" },
    { name: "target_value", label: "Target", type: "number" },
    { name: "unit", label: "Unit", type: "text", placeholder: "calls / mo" },
    { name: "status", label: "Status", type: "select", options: ["not_started", "on_track", "at_risk", "achieved"], required: true },
    { name: "plan_text", label: "Plan of attack (one step per line)", type: "textarea", rows: 5 },
    { name: "notes", label: "Notes", type: "textarea", rows: 2 },
  ];
  const GAP_FIELDS = [
    { name: "title", label: "The crack", type: "text", required: true, placeholder: "No review requests after jobs" },
    { name: "area", label: "Area", type: "select", options: ["website", "seo", "gbp", "brand", "system", "ops", "reviews", "social", "ads", "other"], required: true },
    { name: "severity", label: "Severity", type: "select", options: ["high", "medium", "low"], required: true },
    { name: "status", label: "Status", type: "select", options: ["open", "planned", "in_progress", "fixed"], required: true },
    { name: "impact", label: "What it's costing them", type: "textarea", rows: 2 },
    { name: "recommendation", label: "How we fix it", type: "textarea", rows: 3 },
    { name: "portal_visible", label: "Client can see this", type: "checkbox", hint: "Show in their portal" },
  ];
  const PROJ_FIELDS = [
    { name: "title", label: "Project", type: "text", required: true },
    { name: "type", label: "Type", type: "select", options: ["website", "app", "branding", "marketing", "seo", "automation", "consulting", "other"], required: true },
    { name: "status", label: "Status", type: "select", options: ["proposed", "backlog", "planning", "in_progress", "review", "launched", "on_hold", "done"], required: true },
    { name: "contract_value", label: "Value ($)", type: "number" },
    { name: "description", label: "What it is / why", type: "textarea", rows: 3 },
    { name: "portal_visible", label: "Client can see this", type: "checkbox", hint: "Show under Future projects in their portal" },
  ];
  const saveGoal = (v) => {
    const steps = (v.plan_text || "").split("\n").map((s) => s.trim()).filter(Boolean);
    const old = g?.plan_steps || [];
    const plan_steps = steps.map((title) => ({ title, done: !!old.find((o) => o.title === title)?.done }));
    const { plan_text, ...rest } = v; // eslint-disable-line no-unused-vars
    return g?.id ? goals.update(g.id, { ...rest, plan_steps }) : goals.create({ ...rest, plan_steps });
  };
  const toggleStep = (goal, i) => goals.update(goal.id, { plan_steps: goal.plan_steps.map((s, j) => (j === i ? { ...s, done: !s.done } : s)) });

  return (
    <div className="space-y-6">
      <div>
        <div className="mb-3 flex items-center justify-between">
          <p className="label-cross">(Goals & plan of attack)</p>
          <Btn icon={Plus} onClick={() => setG({ year: new Date().getFullYear() + (new Date().getMonth() > 9 ? 1 : 0), status: "not_started" })}>Add goal</Btn>
        </div>
        {goals.rows.length === 0 ? <Panel><Empty>Set this year&apos;s targets with {client.business} and the steps to hit them. Their portal shows progress against each one.</Empty></Panel> : (
          <div className="grid gap-4 lg:grid-cols-2">
            {goals.rows.map((goal) => {
              const pct = goal.target_value ? Math.max(0, Math.min(100, Math.round((((goal.current_value ?? goal.baseline_value ?? 0) - (goal.baseline_value ?? 0)) / ((goal.target_value - (goal.baseline_value ?? 0)) || 1)) * 100))) : 0;
              return (
                <Panel key={goal.id} label={`${goal.year || ""} · ${goal.metric || "Goal"}`} title={goal.title} action={<SmallBtn onClick={() => setG({ ...goal, plan_text: (goal.plan_steps || []).map((s) => s.title).join("\n") })}><Pencil className="h-3 w-3" /></SmallBtn>}>
                  <div className="px-4 py-4">
                    <div className="flex items-end justify-between">
                      <p className="text-[26px] font-semibold tabular-nums tracking-[-0.04em]">{goal.current_value ?? "—"}<span className="text-[14px] text-ink/45"> / {goal.target_value ?? "—"} {goal.unit}</span></p>
                      <Tag tone={goal.status === "achieved" ? "green" : goal.status === "at_risk" ? "red" : goal.status === "on_track" ? "flame" : "muted"}>{goal.status.replace("_", " ")}</Tag>
                    </div>
                    <div className="mt-3 h-1.5 bg-ink/[0.08]"><div className="h-full flame-bg transition-all" style={{ width: `${pct}%` }} /></div>
                    {(goal.plan_steps || []).length > 0 && (
                      <ul className="mt-4 space-y-1.5">
                        {goal.plan_steps.map((s, i) => (
                          <li key={i}>
                            <label className="flex cursor-pointer items-start gap-2 text-[13px]">
                              <input type="checkbox" checked={!!s.done} onChange={() => toggleStep(goal, i)} className="mt-0.5 h-4 w-4 accent-[#ff3c00]" />
                              <span className={s.done ? "text-ink/45 line-through" : ""}>{s.title}</span>
                            </label>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Panel>
              );
            })}
          </div>
        )}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="label-cross">(Cracks to fix)</p>
            <SmallBtn onClick={() => setGap({ area: "website", severity: "medium", status: "open", portal_visible: true })}><Plus className="h-3 w-3" /> Add gap</SmallBtn>
          </div>
          <Panel>
            {gaps.rows.length === 0 ? <Empty>What isn&apos;t done yet that&apos;s costing them business. Seeing these is what sells the next project.</Empty> : (
              <ul className="divide-y divide-hair">
                {gaps.rows.map((x) => (
                  <li key={x.id} className="group flex items-start gap-3 px-4 py-3">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${x.severity === "high" ? "bg-red-600" : x.severity === "medium" ? "bg-amber-500" : "bg-ink/30"}`} />
                    <div className="min-w-0 flex-1">
                      <p className={`text-[13.5px] font-medium ${x.status === "fixed" ? "text-ink/45 line-through" : ""}`}>{x.title}</p>
                      {x.recommendation && <p className="mt-0.5 text-[12px] text-ink/55">{x.recommendation}</p>}
                    </div>
                    <Tag tone={x.status === "fixed" ? "green" : x.status === "open" ? "muted" : "flame"}>{x.status.replace("_", " ")}</Tag>
                    <button onClick={() => setGap(x)} className="text-ink/30 opacity-0 hover:text-ink group-hover:opacity-100"><Pencil className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="label-cross">(Future projects)</p>
            <SmallBtn onClick={() => setProj({ type: "website", status: "proposed", portal_visible: true })}><Plus className="h-3 w-3" /> Add project</SmallBtn>
          </div>
          <Panel>
            {future.length === 0 ? <Empty>Projects you&apos;ve pitched or planned next for this client.</Empty> : (
              <ul className="divide-y divide-hair">
                {future.map((p) => (
                  <li key={p.id} className="group flex items-center gap-3 px-4 py-3">
                    <Tag>{p.type}</Tag>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{p.title}</span>
                    {p.contract_value ? <span className="font-mono text-[12px] tabular-nums">${Number(p.contract_value).toLocaleString()}</span> : null}
                    <button onClick={() => setProj(p)} className="text-ink/30 opacity-0 hover:text-ink group-hover:opacity-100"><Pencil className="h-3.5 w-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>

      <FormDialog open={!!g} title={g?.id ? "Edit goal" : "New goal"} fields={GOAL_FIELDS} initial={g} onClose={() => setG(null)} onSubmit={saveGoal} onDelete={g?.id ? () => goals.remove(g.id) : undefined} />
      <FormDialog open={!!gap} title={gap?.id ? "Edit gap" : "New gap"} fields={GAP_FIELDS} initial={gap} onClose={() => setGap(null)} onSubmit={(v) => (gap?.id ? gaps.update(gap.id, v) : gaps.create(v))} onDelete={gap?.id ? () => gaps.remove(gap.id) : undefined} />
      <FormDialog open={!!proj} title={proj?.id ? "Edit project" : "New project"} fields={PROJ_FIELDS} initial={proj} onClose={() => setProj(null)} onSubmit={(v) => (proj?.id ? projects.update(proj.id, v) : projects.create({ ...v, client_name: client.business }))} onDelete={proj?.id ? () => projects.remove(proj.id) : undefined} />
    </div>
  );
}

/* ---------------- Files & brand ---------------- */
export const FILE_CATS = [
  ["brand_kit", "Brand kit"], ["sop", "SOPs"], ["guide", "Guides"], ["social", "Social content"], ["presentation", "Presentations"], ["email_signature", "Email signatures"],
  ["report", "Reports"], ["design", "Design"], ["video", "Video"], ["contract", "Contracts"], ["other", "Other"],
];
export function FileGrid({ files, onEdit }) {
  const groups = FILE_CATS.map(([k, l]) => [k, l, files.filter((f) => (f.category || "other") === k)]).filter(([, , list]) => list.length);
  if (!groups.length) return null;
  return (
    <div className="space-y-5">
      {groups.map(([k, label, list]) => (
        <div key={k}>
          <p className="label-cross mb-2">({label})</p>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {list.map((f) => (
              <div key={f.id} className="card-hover group flex items-center gap-3 rounded-md border border-hair bg-card p-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center bg-ink text-[10px] font-semibold uppercase text-white">
                  {(f.file_url || f.link_url || "").split("?")[0].split(".").pop()?.slice(0, 4) || "file"}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{f.title}</p>
                  <p className="truncate text-[11.5px] text-ink/50">{f.delivered_on ? `Delivered ${fmtDate(f.delivered_on)}` : f.description || ""}</p>
                </div>
                {(f.file_url || f.link_url) && (
                  <a href={f.file_url || f.link_url} target="_blank" rel="noreferrer" className="text-ink/45 hover:text-[#ff3c00]" title="Open">
                    {f.file_url ? <Download className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                  </a>
                )}
                {onEdit && <button onClick={() => onEdit(f)} className="text-ink/30 opacity-0 hover:text-ink group-hover:opacity-100"><Pencil className="h-3.5 w-3.5" /></button>}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function FilesTab({ client }) {
  const files = useClientRecords("ClientFile", client.id, { sort: "-delivered_on" });
  const [edit, setEdit] = useState(null);
  const [busy, setBusy] = useState(false);
  const inp = useRef(null);
  const FIELDS = [
    { name: "title", label: "Title", type: "text", required: true },
    { name: "category", label: "Category", type: "select", options: FILE_CATS.map(([value, label]) => ({ value, label })), required: true },
    { name: "file_url", label: "File URL", type: "text", help: "Filled in automatically when you upload" },
    { name: "link_url", label: "Or a link (Drive, Canva, Figma…)", type: "text" },
    { name: "delivered_on", label: "Delivered on", type: "date" },
    { name: "description", label: "Description", type: "textarea", rows: 2 },
    { name: "portal_visible", label: "Client can download this", type: "checkbox", hint: "Show in their portal" },
  ];
  const upload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setEdit({ title: file.name.replace(/\.[^.]+$/, ""), file_url, category: "other", delivered_on: new Date().toISOString().slice(0, 10), portal_visible: true });
    } finally { setBusy(false); e.target.value = ""; }
  };
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-ink/60">Brand kit, SOPs, presentations, social content and everything else delivered to {client.business}. If they don&apos;t have a system of their own, this is where they download it.</p>
        <div className="flex gap-2">
          <input ref={inp} type="file" className="hidden" onChange={upload} />
          <Btn icon={Upload} variant="outline" onClick={() => inp.current?.click()} disabled={busy}>{busy ? "Uploading…" : "Upload"}</Btn>
          <Btn icon={Plus} onClick={() => setEdit({ category: "other", portal_visible: true, delivered_on: new Date().toISOString().slice(0, 10) })}>Add link</Btn>
        </div>
      </div>
      {files.rows.length === 0 ? <Panel><Empty>No files delivered yet.</Empty></Panel> : <FileGrid files={files.rows} onEdit={setEdit} />}
      <FormDialog open={!!edit} title={edit?.id ? "Edit file" : "Deliver a file"} fields={FIELDS} initial={edit} onClose={() => setEdit(null)} onSubmit={(v) => (edit?.id ? files.update(edit.id, v) : files.create(v))} onDelete={edit?.id ? () => files.remove(edit.id) : undefined} />
    </div>
  );
}

/* ---------------- Intake audit ---------------- */
export function AuditTab({ client }) {
  const audits = useClientRecords("IntakeAudit", client.id);
  const audit = audits.rows[0];
  const [answers, setAnswers] = useState({});
  const [open, setOpen] = useState(INTAKE_SECTIONS[0].id);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [copied, setCopied] = useState("");
  const timer = useRef(null);

  useEffect(() => { if (audit) setAnswers(audit.answers || {}); }, [audit?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  const prog = useMemo(() => intakeProgress(answers), [answers]);

  const start = () => audits.create({ business_name: client.business, contact_email: client.emails?.[0], status: "in_progress", answers: { legal_name: client.business, site_url: client.domain || client.websites?.[0] || "" } });
  const change = (k, v) => {
    const next = { ...answers, [k]: v };
    setAnswers(next);
    clearTimeout(timer.current);
    setSaving(true);
    timer.current = setTimeout(async () => { await audits.update(audit.id, { answers: next, status: audit.status === "draft" ? "in_progress" : audit.status }); setSaving(false); }, 700);
  };
  const analyze = async () => {
    setAnalyzing(true);
    try {
      const res = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Justin Cowell's sales and build strategist at Interstellar Strategies (websites, custom CRM/ERP systems, automations, HyperCare+, brand kits, listings setup).
Offers: Mission ALPHA ($8,997 — 45-day rebuild: audit, custom website, Command System CRM+ERP+client portal+rewards, Ops Command SOPs+automations+AI Email Agent+Chrome Workspace, Brand Arsenal, Launch Grid listings). Mission BRAVO ($6,497 — Intel Briefing + website + Command System; add-ons Ops Command $3,000, Brand Arsenal $2,500, Launch Grid $1,400). Website only $4,997 and Command System only $5,997 are offered on calls. Every build includes the Intel Briefing (audit + final sweep) free and requires a care plan. Recurring: HyperCare+ Local $750/mo (+$350/location), National $1,750, Global $3,000; GravïtyCare $197/mo.
Business: ${client.business}. Intake answers:
${intakeAsText(answers)}

Return JSON with:
- summary: 4–6 sentence read on the business, its biggest leaks and the opportunity.
- opportunities: array of {offer, why, est_value_usd, priority: "high"|"medium"|"low"} — the Interstellar offers/add-ons that fit and why, highest value first.
- website_prompt: a complete, specific prompt for Base44 to build this business's website (pages, sections, copy direction, SEO structure, schema, forms, brand), using only facts from the intake.
- system_prompt: a complete, specific prompt for Base44 to build their custom operations app (entities, roles, pages, automations, client portal) based on their sales process, tools and wishlist.`,
        response_json_schema: {
          type: "object",
          properties: {
            summary: { type: "string" },
            opportunities: { type: "array", items: { type: "object", properties: { offer: { type: "string" }, why: { type: "string" }, est_value_usd: { type: "number" }, priority: { type: "string" } } } },
            website_prompt: { type: "string" },
            system_prompt: { type: "string" },
          },
        },
      });
      await audits.update(audit.id, { ...res, analyzed_at: new Date().toISOString(), status: "reviewed" });
    } finally { setAnalyzing(false); }
  };
  const copy = async (key, text) => { await navigator.clipboard.writeText(text || ""); setCopied(key); setTimeout(() => setCopied(""), 1500); };

  if (audits.isLoading) return null;
  if (!audit) return <Panel><Empty action={<Btn icon={Plus} onClick={start}>Start intake</Btn>}>The intake audit captures everything about {client.business} — offer, sales process, tools, website, listings, brand and goals — so you can see every offer that fits and generate the website and system build prompts.</Empty></Panel>;

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_420px]">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <p className="text-[13px] font-medium tabular-nums">{prog.answered}/{prog.total} answered</p>
            <div className="h-1.5 w-40 bg-ink/[0.08]"><div className="h-full flame-bg" style={{ width: `${prog.pct}%` }} /></div>
          </div>
          <span className="mono-label text-[9.5px] text-ink/45">{saving ? "Saving…" : "Saved"}</span>
        </div>
        {INTAKE_SECTIONS.map((s) => {
          const p = intakeProgress(Object.fromEntries(s.questions.map((q) => [q.id, answers[q.id]])));
          const isOpen = open === s.id;
          return (
            <section key={s.id} className="rounded-md border border-hair bg-card">
              <button onClick={() => setOpen(isOpen ? null : s.id)} className="flex w-full items-center justify-between px-4 py-3 text-left">
                <span className="text-[15px] font-semibold tracking-[-0.02em]">{s.title}</span>
                <span className="flex items-center gap-3">
                  <span className="font-mono text-[11px] tabular-nums text-ink/50">{s.questions.filter((q) => { const v = answers[q.id]; return Array.isArray(v) ? v.length : v; }).length}/{s.questions.length}</span>
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </span>
              </button>
              {isOpen && (
                <div className="space-y-4 border-t border-hair px-4 py-4">
                  {s.questions.map((q) => (
                    <div key={q.id}>
                      <label className="mb-1.5 block text-[13px] font-medium">{q.label}</label>
                      <Field f={{ ...q, name: q.id }} value={answers[q.id]} onChange={change} />
                      {q.help && <p className="mt-1 text-[11.5px] text-ink/45">{q.help}</p>}
                    </div>
                  ))}
                  <p className="text-right font-mono text-[10px] text-ink/40">{p.pct}% of this section</p>
                </div>
              )}
            </section>
          );
        })}
      </div>

      <div className="space-y-4 xl:sticky xl:top-[54px] xl:self-start">
        <Panel label="Analysis" title={audit.analyzed_at ? `Analyzed ${timeAgo(audit.analyzed_at)}` : "Not analyzed yet"} action={<Btn icon={Sparkles} onClick={analyze} disabled={analyzing || prog.answered < 8}>{analyzing ? "Thinking…" : "Analyze"}</Btn>}>
          {audit.summary ? (
            <div className="space-y-4 px-4 py-4">
              <p className="text-[13px] leading-relaxed text-ink/80">{audit.summary}</p>
              {(audit.opportunities || []).length > 0 && (
                <ul className="divide-y divide-hair border-y border-hair">
                  {audit.opportunities.map((o, i) => (
                    <li key={i} className="py-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[13px] font-semibold">{o.offer}</p>
                        {o.est_value_usd ? <span className="font-mono text-[12px] tabular-nums text-[#ff3c00]">${Number(o.est_value_usd).toLocaleString()}</span> : null}
                      </div>
                      <p className="mt-0.5 text-[12px] text-ink/60">{o.why}</p>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-wrap gap-2">
                <SmallBtn onClick={() => copy("w", audit.website_prompt)}>{copied === "w" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} Website build prompt</SmallBtn>
                <SmallBtn onClick={() => copy("s", audit.system_prompt)}>{copied === "s" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />} System build prompt</SmallBtn>
              </div>
            </div>
          ) : (
            <p className="px-4 py-5 text-[12.5px] text-ink/55">Answer at least 8 questions, then analyze to get the offers that fit, the summary for your pitch, and ready-to-paste Base44 prompts for their website and system.</p>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ---------------- Messages ---------------- */
export function MessageThread({ messages, meRole, onSend, placeholder = "Write a message…" }) {
  const [text, setText] = useState("");
  const end = useRef(null);
  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [messages.length]);
  const send = async (e) => { e.preventDefault(); const t = text.trim(); if (!t) return; setText(""); await onSend(t); };
  return (
    <div className="flex h-[60vh] min-h-[420px] flex-col rounded-md border border-hair bg-card">
      <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && <p className="py-10 text-center text-[13px] text-ink/45">No messages yet.</p>}
        {messages.map((m) => {
          const mine = m.sender_role === meRole;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] px-3.5 py-2.5 text-[13.5px] leading-relaxed ${mine ? "bg-ink text-white" : "border border-hair bg-paper"}`}>
                <p className="whitespace-pre-wrap">{m.content}</p>
                <p className={`mt-1 font-mono text-[9.5px] ${mine ? "text-white/50" : "text-ink/40"}`}>{timeAgo(m.timestamp || m.created_date)}</p>
              </div>
            </div>
          );
        })}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="flex items-center gap-2 border-t border-hair p-3">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} className="h-10 flex-1 border border-hair bg-paper px-3 text-[13.5px] outline-none focus:border-[#ff3c00]" />
        <button type="submit" className="flex h-10 w-10 items-center justify-center bg-[#ff3c00] text-white hover:bg-ink" aria-label="Send"><Send className="h-4 w-4" /></button>
      </form>
    </div>
  );
}

export function MessagesTab({ client }) {
  const { user } = useAuth();
  const msgs = useClientRecords("ConversationMessage", client.id, { sort: "created_date" });
  useEffect(() => {
    const unread = msgs.rows.filter((m) => m.sender_role === "client" && !m.read_at);
    unread.forEach((m) => base44.entities.ConversationMessage.update(m.id, { read_at: new Date().toISOString() }));
  }, [msgs.rows.length]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <MessageThread
      messages={msgs.rows}
      meRole="admin"
      placeholder={`Message ${client.contact || client.business}…`}
      onSend={(content) => msgs.create({ content, sender_role: "admin", senderEmail: user?.email, recipientEmail: client.emails?.[0], messageType: "text", timestamp: new Date().toISOString() })}
    />
  );
}
