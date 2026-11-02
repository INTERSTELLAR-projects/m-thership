import { useEffect, useMemo, useState } from "react";
import { base44 } from "@/api/base44Client";
import { Plus, ArrowUpRight, CheckCircle2, XCircle, Pencil, ExternalLink, Play } from "lucide-react";
import { useClientRecords } from "./hooks";
import { Panel, Empty, Btn, SmallBtn, Tag, Stat, FormDialog } from "./ui";
import { WORK_KINDS, SERVICE_LABELS, fmtDate, timeAgo } from "@/lib/useData";
import { settleTimer } from "@/features/tasks/lib/timer";
import { KIND_ORDER, kindLabel } from "@/features/requests/formSchema";

const today = () => new Date().toISOString().slice(0, 10);
const kindOptions = Object.entries(WORK_KINDS).filter(([value]) => value !== "claude_job").map(([value, label]) => ({ value, label }));

/* Clients sharing a `bundle` name are one deal; returns null when the client is not in a package. */
function usePackage(client) {
  const [siblings, setSiblings] = useState(null);
  const key = (client.bundle || "").trim();
  useEffect(() => {
    if (!key) { setSiblings(null); return; }
    let alive = true;
    base44.entities.CRMClient.filter({ bundle: key }).then((rows) => { if (alive) setSiblings(Array.isArray(rows) ? rows : []); }).catch(() => { if (alive) setSiblings([]); });
    return () => { alive = false; };
  }, [key]);
  if (!key || !siblings || siblings.length < 2) return null;
  const total = siblings.reduce((s, c) => s + (c.services || []).reduce((a, x) => a + (Number(x.price) || 0), 0), 0);
  const others = siblings.filter((c) => c.id !== client.id).map((c) => c.business);
  return { name: key, total, others };
}

/* ---------------- Overview ---------------- */
export function OverviewTab({ client, onEdit, go }) {
  const work = useClientRecords("WorkLog", client.id, { sort: "-date" });
  const autos = useClientRecords("Automation", client.id);
  const reqs = useClientRecords("ClientRequest", client.id);
  const goals = useClientRecords("ClientGoal", client.id, { sort: "sort" });
  const gaps = useClientRecords("ClientGap", client.id);
  const tasks = useClientRecords("Task", client.id, { sort: "priority" });

  const ms = new Date(); ms.setDate(1);
  const monthStart = ms.toISOString().slice(0, 10);
  const month = work.rows.filter((w) => (w.date || "") >= monthStart);
  const count = (k) => month.filter((w) => w.kind === k).length;
  const openReq = reqs.rows.filter((r) => !["complete", "declined"].includes(r.status));
  const openTasks = tasks.rows.filter((t) => t.status !== "done");
  const bad = autos.rows.filter((a) => a.status === "error" || a.last_result === "failed");
  const openGaps = gaps.rows.filter((g) => g.status !== "fixed");
  const mrr = (client.services || []).reduce((s, x) => s + (Number(x.price) || 0), 0);
  // Package deals: pull the siblings so a $0 member shows the deal it belongs to.
  const pack = usePackage(client);

  return (
    <div className="space-y-5">
      <div className="grid overflow-hidden rounded-md border border-hair bg-card sm:grid-cols-3 lg:grid-cols-6">
        <Stat value={count("blog")} label="Blogs this month" />
        <Stat value={count("gbp_post")} label="GBP posts" />
        <Stat value={count("site_edit") + count("new_page") + count("project_page")} label="Site updates" />
        <Stat value={count("citation") + count("press") + count("mention") + count("backlink")} label="Citations & press" />
        <Stat value={openReq.length} label="Open requests" accent={openReq.length > 0} />
        {pack ? (
          <Stat value={`$${pack.total.toLocaleString()}`} label={`Package · ${pack.name}`} hint={`with ${pack.others.join(" + ")}`} />
        ) : (
          <Stat value={`$${mrr.toLocaleString()}`} label="Monthly value" />
        )}
      </div>
      {pack ? (
        <p className="label-cross text-[10.5px] text-ink/60">(Package deal · {pack.name} · billed together with {pack.others.join(" + ")} · ${pack.total.toLocaleString()}/mo combined)</p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel label="Profile" title="Account" action={<SmallBtn onClick={onEdit}><Pencil className="h-3 w-3" /> Edit</SmallBtn>} className="lg:col-span-1" bodyClass="divide-y divide-hair text-[13px]">
          {[
            ["Plan", client.plan || "—"],
            ["Domain", client.domain || client.websites?.[0] || "—"],
            ["Contact", client.contact || "—"],
            ["Email", client.emails?.[0] || "—"],
            ["Phone", client.phones?.[0] || "—"],
            ["Industry", client.industry || "—"],
            ["Portal", client.portal_enabled ? `On · ${(client.portal_emails || []).length} login(s)` : "Off"],
          ].map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 px-4 py-2.5"><span className="text-ink/50">{k}</span><span className="truncate text-right font-medium">{v}</span></div>
          ))}
          <div className="flex flex-wrap gap-1.5 px-4 py-3">
            {(client.services_managed || []).length ? client.services_managed.map((s) => <Tag key={s} tone="ink">{SERVICE_LABELS[s] || s}</Tag>) : <span className="text-ink/45">No managed services set</span>}
          </div>
          {(client.site_app_id || client.ops_app_id) && (
            <div className="flex flex-wrap gap-3 px-4 py-3">
              {client.site_app_id && <a className="inline-flex items-center gap-1 text-[12px] text-ink/60 hover:text-[#ff3c00]" href={`https://app.base44.com/apps/${client.site_app_id}/editor/preview`} target="_blank" rel="noreferrer">Website app <ExternalLink className="h-3 w-3" /></a>}
              {client.ops_app_id && <a className="inline-flex items-center gap-1 text-[12px] text-ink/60 hover:text-[#ff3c00]" href={`https://app.base44.com/apps/${client.ops_app_id}/editor/preview`} target="_blank" rel="noreferrer">System app <ExternalLink className="h-3 w-3" /></a>}
            </div>
          )}
        </Panel>

        <Panel label="Latest" title="Recent work" action={<SmallBtn onClick={() => go("work")}>All work →</SmallBtn>} className="lg:col-span-2">
          {work.rows.length === 0 ? (
            <Empty>No work logged yet. Blogs, GBP posts and site edits appear here automatically once automations report in, and you can log anything by hand on the Work tab.</Empty>
          ) : (
            <ul className="divide-y divide-hair">
              {work.rows.slice(0, 7).map((w) => (
                <li key={w.id} className="flex items-center gap-3 px-4 py-2.5">
                  <Tag tone={w.kind === "blog" || w.kind === "gbp_post" ? "flame" : "muted"}>{WORK_KINDS[w.kind] || w.kind}</Tag>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-medium">{w.title}</span>
                  <span className="font-mono text-[10.5px] text-ink/45">{fmtDate(w.date)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <MiniList title="Automations" n={autos.rows.length} warn={bad.length ? `${bad.length} failing` : null} onOpen={() => go("automations")}
          items={autos.rows.slice(0, 4).map((a) => ({ id: a.id, text: a.name, sub: a.last_run_at ? timeAgo(a.last_run_at) : "never run", dot: a.status === "error" || a.last_result === "failed" ? "bg-red-600" : a.status === "active" ? "bg-green-600" : "bg-ink/25" }))} />
        <MiniList title="Open tasks" n={openTasks.length} onOpen={() => go("tasks")} items={openTasks.slice(0, 4).map((t) => ({ id: t.id, text: t.title, sub: t.due_date ? `Due ${fmtDate(t.due_date)}` : t.status }))} />
        <MiniList title="Goals" n={goals.rows.length} onOpen={() => go("goals")} items={goals.rows.slice(0, 4).map((g) => ({ id: g.id, text: g.title, sub: g.target_value != null ? `${g.current_value ?? 0} / ${g.target_value} ${g.unit || ""}` : g.status }))} />
        <MiniList title="Open gaps" n={openGaps.length} onOpen={() => go("goals")} items={openGaps.slice(0, 4).map((g) => ({ id: g.id, text: g.title, sub: g.severity, dot: g.severity === "high" ? "bg-red-600" : g.severity === "medium" ? "bg-amber-500" : "bg-ink/25" }))} />
      </div>
    </div>
  );
}

function MiniList({ title, n, items, onOpen, warn }) {
  return (
    <Panel label={title} title={<span className="tabular-nums">{n}{warn && <span className="ml-2 text-[12px] font-medium text-red-700">{warn}</span>}</span>} action={<SmallBtn onClick={onOpen}>Open</SmallBtn>}>
      {items.length === 0 ? <p className="px-4 py-5 text-[12.5px] text-ink/45">None yet.</p> : (
        <ul className="divide-y divide-hair">
          {items.map((i) => (
            <li key={i.id} className="flex items-center gap-2.5 px-4 py-2">
              {i.dot && <span className={`h-2 w-2 shrink-0 rounded-full ${i.dot}`} />}
              <span className="min-w-0 flex-1 truncate text-[12.5px]">{i.text}</span>
              <span className="shrink-0 text-[11px] text-ink/45">{i.sub}</span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}

/* ---------------- Work ---------------- */
const WORK_FIELDS = [
  { name: "kind", label: "Type", type: "select", options: kindOptions, required: true },
  { name: "title", label: "Title", type: "text", required: true },
  { name: "url", label: "Link", type: "text", placeholder: "https://" },
  { name: "date", label: "Date", type: "date" },
  { name: "status", label: "Status", type: "select", options: ["live", "generated", "scheduled", "failed"], required: true },
  { name: "verified_live", label: "Verified live", type: "checkbox", hint: "I checked it's actually published" },
  { name: "description", label: "Notes", type: "textarea", rows: 3 },
  { name: "portal_visible", label: "Client can see this", type: "checkbox", hint: "Show in their portal" },
];

export function WorkTab({ client }) {
  const work = useClientRecords("WorkLog", client.id, { sort: "-date" });
  const [kind, setKind] = useState("all");
  const [edit, setEdit] = useState(null);
  const rows = kind === "all" ? work.rows : work.rows.filter((w) => w.kind === kind);
  const groups = useMemo(() => {
    const g = {};
    rows.forEach((w) => { const k = (w.date || w.created_date || "").slice(0, 7) || "Undated"; (g[k] ||= []).push(w); });
    return Object.entries(g).sort((a, b) => b[0].localeCompare(a[0]));
  }, [rows]);
  const kinds = [...new Set(work.rows.map((w) => w.kind))];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          <SmallBtn active={kind === "all"} onClick={() => setKind("all")}>All {work.rows.length}</SmallBtn>
          {kinds.map((k) => <SmallBtn key={k} active={kind === k} onClick={() => setKind(k)}>{WORK_KINDS[k] || k} {work.rows.filter((w) => w.kind === k).length}</SmallBtn>)}
        </div>
        <Btn icon={Plus} onClick={() => setEdit({ kind: "site_edit", date: today(), status: "live", portal_visible: true })}>Log work</Btn>
      </div>

      {groups.length === 0 ? (
        <Panel><Empty>Every piece of work done for {client.business} lives here — what the client sees as proof of what you&apos;re doing for them.</Empty></Panel>
      ) : groups.map(([m, list]) => (
        <Panel key={m} label={m === "Undated" ? m : new Date(`${m}-15`).toLocaleDateString("en-US", { month: "long", year: "numeric" })} title={`${list.length} item${list.length === 1 ? "" : "s"}`}>
          <ul className="divide-y divide-hair">
            {list.map((w) => (
              <li key={w.id} className="group flex items-center gap-3 px-4 py-2.5">
                <Tag tone={w.status === "failed" ? "red" : w.kind === "blog" || w.kind === "gbp_post" ? "flame" : "muted"}>{WORK_KINDS[w.kind] || w.kind}</Tag>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-medium">{w.title}</p>
                  <p className="truncate text-[11.5px] text-ink/50">
                    {w.source === "automation" ? "Automated" : "Manual"} · {w.status}{w.verified_live ? " · verified live" : ""}{w.portal_visible === false ? " · hidden from client" : ""}
                  </p>
                </div>
                <span className="font-mono text-[10.5px] text-ink/45">{fmtDate(w.date)}</span>
                {w.url && <a href={w.url} target="_blank" rel="noreferrer" className="text-ink/40 hover:text-[#ff3c00]"><ArrowUpRight className="h-4 w-4" /></a>}
                <button onClick={() => setEdit(w)} className="text-ink/30 opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"><Pencil className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        </Panel>
      ))}

      <FormDialog
        open={!!edit}
        title={edit?.id ? "Edit work" : "Log work"}
        fields={WORK_FIELDS}
        initial={edit}
        onClose={() => setEdit(null)}
        onSubmit={(v) => (edit?.id ? work.update(edit.id, v) : work.create({ ...v, client_name: client.business, source: "manual" }))}
        onDelete={edit?.id ? () => work.remove(edit.id) : undefined}
      />
    </div>
  );
}

/* ---------------- Tasks (simple; full Task Matrix lives on /todo) ---------------- */
const PRI = { 1: "P0", 2: "P1", 3: "P2", 4: "P3" };
export function TasksTab({ client }) {
  const tasks = useClientRecords("Task", client.id, { sort: "priority" });
  const [edit, setEdit] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const rows = tasks.rows.filter((t) => (showDone ? t.status === "done" : t.status !== "done"));
  const FIELDS = [
    { name: "title", label: "Task", type: "text", required: true },
    { name: "status", label: "Status", type: "select", options: ["inbox", "next", "doing", "blocked", "done"], required: true },
    { name: "priority", label: "Priority", type: "select", options: [{ value: 1, label: "P0 Critical" }, { value: 2, label: "P1 High" }, { value: 3, label: "P2 Normal" }, { value: 4, label: "P3 Low" }] },
    { name: "category", label: "Category", type: "select", options: ["design", "development", "strategy", "content", "marketing", "sales", "admin", "finance", "ops"] },
    { name: "due_date", label: "Due", type: "date" },
    { name: "remind_at", label: "Remind me", type: "datetime" },
    { name: "notes", label: "Notes", type: "textarea", rows: 3 },
    { name: "portal_visible", label: "Client can see this", type: "checkbox", hint: "Show as upcoming work in their portal" },
  ];
  const save = (v) => {
    const data = { ...v, priority: v.priority ? Number(v.priority) : 3, completed_at: v.status === "done" ? new Date().toISOString() : null };
    if (edit?.id && v.status === "done" && edit.status !== "done") return settleTimer(edit).then(() => tasks.update(edit.id, data));
    return edit?.id ? tasks.update(edit.id, data) : tasks.create({ ...data, client_name: client.business, source: "manual" });
  };
  const toggle = async (t) => {
    if (t.status !== "done") await settleTimer(t);
    return tasks.update(t.id, { status: t.status === "done" ? "next" : "done", completed_at: t.status === "done" ? null : new Date().toISOString() });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          <SmallBtn active={!showDone} onClick={() => setShowDone(false)}>Open {tasks.rows.filter((t) => t.status !== "done").length}</SmallBtn>
          <SmallBtn active={showDone} onClick={() => setShowDone(true)}>Done {tasks.rows.filter((t) => t.status === "done").length}</SmallBtn>
        </div>
        <Btn icon={Plus} onClick={() => setEdit({ status: "next", priority: 3, category: "ops" })}>Add task</Btn>
      </div>
      <Panel>
        {rows.length === 0 ? <Empty>No {showDone ? "completed" : "open"} tasks for this client.</Empty> : (
          <ul className="divide-y divide-hair">
            {rows.map((t) => (
              <li key={t.id} className="group flex items-center gap-3 px-4 py-2.5">
                <button onClick={() => toggle(t)} className={`flex h-4 w-4 shrink-0 items-center justify-center border ${t.status === "done" ? "border-[#ff3c00] bg-[#ff3c00] text-white" : "border-ink/40 hover:border-[#ff3c00]"}`}>
                  {t.status === "done" && <CheckCircle2 className="h-3 w-3" />}
                </button>
                <span className="mono-label w-6 text-[9.5px] text-ink/50">{PRI[t.priority] || "P2"}</span>
                <span className={`min-w-0 flex-1 truncate text-[13.5px] ${t.status === "done" ? "text-ink/45 line-through" : "font-medium"}`}>{t.title}</span>
                {t.status === "blocked" && <Tag tone="red">Blocked</Tag>}
                {t.status === "doing" && <Tag tone="flame">Doing</Tag>}
                <span className="font-mono text-[10.5px] text-ink/45">{t.due_date ? fmtDate(t.due_date) : ""}</span>
                <button onClick={() => setEdit(t)} className="text-ink/30 opacity-0 hover:text-ink group-hover:opacity-100"><Pencil className="h-3.5 w-3.5" /></button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <FormDialog open={!!edit} title={edit?.id ? "Edit task" : "New task"} fields={FIELDS} initial={edit} onClose={() => setEdit(null)} onSubmit={save} onDelete={edit?.id ? () => tasks.remove(edit.id) : undefined} />
    </div>
  );
}

/* ---------------- Requests ---------------- */
const REQ_FLOW = ["received", "in_progress", "complete"];
export function RequestsTab({ client }) {
  const reqs = useClientRecords("ClientRequest", client.id);
  const [edit, setEdit] = useState(null);
  const [filter, setFilter] = useState("open");
  const rows = reqs.rows.filter((r) => (filter === "open" ? !["complete", "declined"].includes(r.status) : ["complete", "declined"].includes(r.status)));
  const FIELDS = [
    { name: "kind", label: "Type", type: "select", options: KIND_ORDER.map((k) => ({ value: k, label: kindLabel(k) })), required: true },
    { name: "title", label: "Title", type: "text", required: true },
    { name: "details", label: "Details", type: "textarea" },
    { name: "status", label: "Status", type: "select", options: ["received", "in_progress", "needs_info", "complete", "declined"], required: true },
    { name: "priority", label: "Priority", type: "select", options: ["low", "normal", "high", "urgent"] },
    { name: "due_date", label: "Needed by", type: "date" },
    { name: "client_note", label: "Note to client", type: "textarea", rows: 2, help: "Shown in their portal" },
    { name: "admin_notes", label: "Internal notes", type: "textarea", rows: 2 },
  ];
  const advance = (r) => {
    const i = REQ_FLOW.indexOf(r.status);
    const next = REQ_FLOW[Math.min(REQ_FLOW.length - 1, i + 1)] || "in_progress";
    return reqs.update(r.id, { status: next, completed_at: next === "complete" ? new Date().toISOString() : r.completed_at });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-1.5">
          <SmallBtn active={filter === "open"} onClick={() => setFilter("open")}>Open</SmallBtn>
          <SmallBtn active={filter === "closed"} onClick={() => setFilter("closed")}>Closed</SmallBtn>
        </div>
        <Btn icon={Plus} onClick={() => setEdit({ kind: "site_edit", status: "received", priority: "normal" })}>Add request</Btn>
      </div>
      <Panel>
        {rows.length === 0 ? <Empty>No {filter} requests. When {client.business} submits a site edit or a new project from their portal, it lands here.</Empty> : (
          <ul className="divide-y divide-hair">
            {rows.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Tag tone={r.status === "received" ? "flame" : r.status === "complete" ? "green" : r.status === "needs_info" ? "amber" : "muted"}>{r.status.replace("_", " ")}</Tag>
                    <span className="mono-label text-[9px] text-ink/45">{r.kind.replace("_", " ")}</span>
                    {r.priority === "urgent" && <Tag tone="red">Urgent</Tag>}
                    {r.page_status && r.page_status !== "none" && <Tag tone="ink">Page: {r.page_status}</Tag>}
                  </div>
                  <p className="mt-1 text-[13.5px] font-medium">{r.title}</p>
                  {r.details && <p className="mt-0.5 line-clamp-2 text-[12.5px] text-ink/60">{r.details}</p>}
                </div>
                <span className="font-mono text-[10.5px] text-ink/45">{fmtDate(r.created_date)}</span>
                {!["complete", "declined"].includes(r.status) && (
                  <SmallBtn onClick={() => advance(r)}><Play className="h-3 w-3" /> {r.status === "received" ? "Start" : "Complete"}</SmallBtn>
                )}
                <SmallBtn onClick={() => setEdit(r)}><Pencil className="h-3 w-3" /></SmallBtn>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <FormDialog open={!!edit} title={edit?.id ? "Request" : "New request"} fields={FIELDS} initial={edit} onClose={() => setEdit(null)}
        onSubmit={(v) => (edit?.id ? reqs.update(edit.id, { ...v, completed_at: v.status === "complete" ? edit.completed_at || new Date().toISOString() : null }) : reqs.create({ ...v, client_name: client.business, submitted_by: "admin" }))}
        onDelete={edit?.id ? () => reqs.remove(edit.id) : undefined} />
    </div>
  );
}

/* ---------------- Automations ---------------- */
export function AutomationsTab({ client }) {
  const autos = useClientRecords("Automation", client.id);
  const runs = useClientRecords("AutomationRun", client.id, { sort: "-started_at", limit: 60 });
  const [edit, setEdit] = useState(null);
  const FIELDS = [
    { name: "name", label: "Name", type: "text", required: true, placeholder: "Blog drop (Tue/Thu)" },
    { name: "kind", label: "What it does", type: "select", options: ["blog", "gbp_post", "project_page", "search_console", "analytics", "bing", "schema_check", "rich_results", "citations", "digest", "email", "other"], required: true },
    { name: "runner", label: "Runs on", type: "select", options: [{ value: "claude_scheduled", label: "Claude scheduled task" }, { value: "base44_workflow", label: "Base44 workflow" }, { value: "base44_function", label: "Base44 function" }, { value: "manual", label: "Manual" }], required: true },
    { name: "schedule", label: "Schedule", type: "text", placeholder: "Tue + Thu 9am PT" },
    { name: "target_app_id", label: "Base44 app it writes to", type: "text", placeholder: client.site_app_id || "app id" },
    { name: "target_url", label: "Where results show", type: "text", placeholder: "https://site.com/blog" },
    { name: "status", label: "Status", type: "select", options: ["setup", "active", "paused", "error"], required: true },
    { name: "portal_visible", label: "Client can see this", type: "checkbox", hint: "Show as an active service in their portal" },
    { name: "notes", label: "Notes", type: "textarea", rows: 3 },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="max-w-2xl text-[13px] text-ink/60">Every automation that works on {client.business}. Runs report in through the activity hook (Phase 5), so this shows what fired, when, and whether it actually went live.</p>
        <Btn icon={Plus} onClick={() => setEdit({ kind: "blog", runner: "claude_scheduled", status: "setup", portal_visible: true, target_app_id: client.site_app_id })}>Add automation</Btn>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {autos.rows.length === 0 && <Panel className="md:col-span-2 xl:col-span-3"><Empty>No automations registered for this client yet.</Empty></Panel>}
        {autos.rows.map((a) => {
          const bad = a.status === "error" || a.last_result === "failed";
          return (
            <button key={a.id} onClick={() => setEdit(a)} className="card-hover rounded-md border border-hair bg-card p-4 text-left">
              <div className="flex items-center justify-between">
                <Tag tone={bad ? "red" : a.status === "active" ? "green" : "muted"}>{bad ? "Failing" : a.status}</Tag>
                <span className="mono-label text-[9px] text-ink/45">{a.runner?.replace(/_/g, " ")}</span>
              </div>
              <p className="mt-3 text-[15px] font-semibold tracking-[-0.02em]">{a.name}</p>
              <p className="text-[12px] text-ink/55">{a.schedule || "No schedule set"}</p>
              <div className="mt-4 flex items-center justify-between border-t border-hair pt-3 text-[12px]">
                <span className="text-ink/55">Last run {a.last_run_at ? timeAgo(a.last_run_at) : "—"}</span>
                <span className="font-mono tabular-nums text-ink/60">{a.runs_count || 0} runs</span>
              </div>
              {bad && a.last_message && <p className="mt-2 text-[12px] text-red-700">{a.last_message}</p>}
            </button>
          );
        })}
      </div>
      <Panel label="History" title="Recent runs">
        {runs.rows.length === 0 ? <Empty>No runs reported yet.</Empty> : (
          <ul className="divide-y divide-hair">
            {runs.rows.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-4 py-2.5">
                {r.status === "failed" ? <XCircle className="h-4 w-4 text-red-600" /> : <CheckCircle2 className="h-4 w-4 text-green-700" />}
                <span className="min-w-0 flex-1 truncate text-[13px]">{r.message || r.kind || "Run"}</span>
                <span className="font-mono text-[10.5px] text-ink/45">{timeAgo(r.started_at || r.created_date)}</span>
                {r.output_url && <a href={r.output_url} target="_blank" rel="noreferrer" className="text-ink/40 hover:text-[#ff3c00]"><ArrowUpRight className="h-4 w-4" /></a>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
      <FormDialog open={!!edit} title={edit?.id ? "Automation" : "New automation"} fields={FIELDS} initial={edit} onClose={() => setEdit(null)}
        onSubmit={(v) => (edit?.id ? autos.update(edit.id, v) : autos.create({ ...v, client_name: client.business }))}
        onDelete={edit?.id ? () => autos.remove(edit.id) : undefined} />
    </div>
  );
}
