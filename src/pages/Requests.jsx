import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search, Play, Check, X, ExternalLink, Inbox, FileText } from "lucide-react";
import PageHeader from "../components/PageHeader";
import { base44 } from "@/api/base44Client";
import { useList, useInvalidate, fmtDate, timeAgo } from "@/lib/useData";
import { Tag, SmallBtn, Panel, Empty } from "@/features/clients/ui";
import ClientFormsPanel from "@/features/requests/FormBuilder";
import { KIND_LABELS, KIND_ORDER } from "@/features/requests/formSchema";

const COLUMNS = [["received", "Received"], ["in_progress", "In progress"], ["needs_info", "Needs info"], ["complete", "Complete"]];
const isImg = (u) => /\.(png|jpe?g|webp|gif|heic)$/i.test(String(u).split("?")[0]);

function RequestDetail({ r, onClose, onMove }) {
  const [note, setNote] = useState(r.client_note || "");
  const [admin, setAdmin] = useState(r.admin_notes || "");
  const invalidate = useInvalidate();
  const saveNotes = async () => { await base44.entities.ClientRequest.update(r.id, { client_note: note, admin_notes: admin }); invalidate("ClientRequest"); };
  const answers = Array.isArray(r.answers) && r.answers.length ? r.answers : Object.entries(r.fields || {}).map(([k, v]) => ({ id: k, label: k.replace(/_/g, " "), value: v }));
  const show = (a) => Array.isArray(a.value) ? (a.value.length ? (a.value.every((x) => /^https?:\/\//.test(String(x))) ? null : a.value.join(", ")) : "—") : a.value === true ? "Yes" : a.value === false ? "No" : (a.value ?? "—");
  return (
    <div role="dialog" className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-ink/40 p-4 pt-[5vh]" onMouseDown={onClose}>
      <div onMouseDown={(e) => e.stopPropagation()} className="w-full max-w-3xl border border-hair bg-canvas shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-hair px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone="ink">{KIND_LABELS[r.kind] || r.kind}</Tag>
              <Tag tone={r.status === "received" ? "flame" : r.status === "complete" ? "green" : r.status === "needs_info" ? "amber" : "muted"}>{r.status.replace("_", " ")}</Tag>
              {r.priority === "urgent" && <Tag tone="red">Urgent</Tag>}
              {r.page_status && r.page_status !== "none" && <Tag tone="muted">Page: {r.page_status}</Tag>}
              <span className="mono-label text-[9px] text-ink/45">{r.source || "portal"}</span>
            </div>
            <h3 className="mt-2 text-[20px] font-semibold tracking-[-0.03em]">{r.title}</h3>
            <p className="text-[12px] text-ink/55"><Link to={`/clients/${r.client_id}?tab=requests`} className="hover:text-[#ff3c00]">{r.client_name}</Link> · {r.form_title || "no form"} · {fmtDate(r.created_date)} · {r.contact_email || r.submitted_by}</p>
          </div>
          <button type="button" onClick={onClose} className="text-ink/50 hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid gap-5 px-5 py-5 md:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <dl className="divide-y divide-hair border border-hair bg-card">
              {answers.map((a) => { const v = show(a); if (v === null) return null; return (
                <div key={a.id} className="grid gap-1 px-4 py-2.5 md:grid-cols-[180px_1fr]">
                  <dt className="mono-label text-[9.5px] text-ink/50">{a.label}</dt>
                  <dd className="whitespace-pre-wrap text-[13px]">{v}</dd>
                </div>); })}
              {answers.length === 0 && r.details && <div className="px-4 py-3 text-[13px] whitespace-pre-wrap">{r.details}</div>}
            </dl>
            {(r.attachments || []).length > 0 && (
              <div>
                <p className="mono-label mb-2 text-[9.5px] text-ink/50">{r.attachments.length} attachment{r.attachments.length === 1 ? "" : "s"}</p>
                <div className="flex flex-wrap gap-2">
                  {r.attachments.map((u) => <a key={u} href={u} target="_blank" rel="noreferrer" className="block h-24 w-24 overflow-hidden border border-hair bg-paper">{isImg(u) ? <img src={u} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full items-center justify-center text-[11px]"><FileText className="h-4 w-4" /></span>}</a>)}
                </div>
              </div>
            )}
            {r.page_url && <a href={r.page_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] text-[#ff3c00] hover:underline">View the live page <ExternalLink className="h-3 w-3" /></a>}
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {r.status === "received" && <SmallBtn onClick={() => onMove(r, "in_progress")}><Play className="h-3 w-3" /> Start</SmallBtn>}
              {["in_progress", "needs_info"].includes(r.status) && <SmallBtn onClick={() => onMove(r, "complete")}><Check className="h-3 w-3" /> Complete</SmallBtn>}
              {r.status === "in_progress" && <SmallBtn onClick={() => onMove(r, "needs_info")}>Needs info</SmallBtn>}
              {r.status !== "declined" && r.status !== "complete" && <SmallBtn onClick={() => onMove(r, "declined")}>Decline</SmallBtn>}
            </div>
            <div><label className="mono-label mb-1 block text-[9.5px] text-ink/55">Note to client (shown in their portal)</label><textarea rows={4} className="w-full border border-hair bg-paper px-3 py-2 text-[13px] outline-none focus:border-[#ff3c00]" value={note} onChange={(e) => setNote(e.target.value)} /></div>
            <div><label className="mono-label mb-1 block text-[9.5px] text-ink/55">Internal notes</label><textarea rows={3} className="w-full border border-hair bg-paper px-3 py-2 text-[13px] outline-none focus:border-[#ff3c00]" value={admin} onChange={(e) => setAdmin(e.target.value)} /></div>
            <SmallBtn onClick={saveNotes}>Save notes</SmallBtn>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Requests() {
  const [params, setParams] = useSearchParams();
  const view = params.get("view") || "queue";
  const reqs = useList("ClientRequest", { sort: "-created_date", limit: 500 });
  const forms = useList("RequestForm", { sort: "client_name", limit: 500 });
  const clients = useList("CRMClient", { sort: "business", limit: 200 });
  const invalidate = useInvalidate();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const [clientF, setClientF] = useState("all");
  const [open, setOpen] = useState(null);
  const [formClient, setFormClient] = useState(null);

  const rows = useMemo(() => (reqs.data || []).filter((r) => {
    const s = q.toLowerCase();
    return (!s || r.title?.toLowerCase().includes(s) || r.client_name?.toLowerCase().includes(s)) && (kind === "all" || r.kind === kind) && (clientF === "all" || r.client_id === clientF);
  }), [reqs.data, q, kind, clientF]);
  const move = async (r, status) => {
    await base44.entities.ClientRequest.update(r.id, { status, completed_at: status === "complete" ? new Date().toISOString() : null });
    invalidate("ClientRequest"); setOpen((o) => (o && o.id === r.id ? { ...o, status } : o));
  };
  const activeClients = (clients.data || []).filter((c) => c.status !== "Inactive").sort((a, b) => (a.business || "").localeCompare(b.business || ""));
  const formsByClient = (id) => (forms.data || []).filter((f) => f.client_id === id);
  const received = (reqs.data || []).filter((r) => r.status === "received").length;

  return (
    <div className="pb-16">
      <PageHeader breadcrumb="Command / Requests" rightText={`${received} waiting`} title="Client /Requests">
        <div className="flex gap-1.5">
          <SmallBtn active={view === "queue"} onClick={() => setParams({})}><Inbox className="h-3 w-3" /> Queue</SmallBtn>
          <SmallBtn active={view === "forms"} onClick={() => setParams({ view: "forms" })}><FileText className="h-3 w-3" /> Forms</SmallBtn>
        </div>
      </PageHeader>

      {view === "forms" ? (
        <div className="grid gap-5 px-5 pt-6 md:px-8 lg:grid-cols-[300px_1fr]">
          <Panel label="Clients" title="Pick a client" bodyClass="divide-y divide-hair">
            {activeClients.map((c) => { const n = formsByClient(c.id).length; return (
              <button key={c.id} type="button" onClick={() => setFormClient(c)} className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-[#ff3c00]/[0.04] ${formClient?.id === c.id ? "bg-[#ff3c00]/[0.07]" : ""}`}>
                <span className="flex h-8 w-8 items-center justify-center overflow-hidden border border-hair bg-white">{c.logoUrl || c.logo_url ? <img src={c.logoUrl || c.logo_url} alt="" className="h-full w-full object-contain p-1" /> : <span className="text-[12px] font-semibold text-[#ff3c00]">{c.business?.[0]}</span>}</span>
                <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium">{c.business}</span><span className="block text-[11px] text-ink/45">{n ? `${n} forms` : "no forms yet"}</span></span>
                {!n && <span className="h-2 w-2 rounded-full bg-[#ff3c00]" title="Needs forms" />}
              </button>); })}
          </Panel>
          <div>
            {formClient ? (
              <>
                <div className="mb-3 flex items-end justify-between"><div><p className="mono-label text-[9.5px] text-ink/50">Request forms</p><h2 className="text-[22px] font-semibold tracking-[-0.03em]">{formClient.business}</h2></div>
                  <p className="text-[12px] text-ink/50">These show in their portal. Each has a public link for their website or app.</p></div>
                <ClientFormsPanel client={formClient} forms={forms.data || []} onChange={() => invalidate("RequestForm")} />
              </>
            ) : <Panel><Empty>Pick a client to see and edit the forms they submit through. Clients with an orange dot have none yet.</Empty></Panel>}
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 px-5 pt-6 md:px-8">
            <div className="flex h-9 flex-1 items-center gap-2 border border-hair bg-paper px-3 md:max-w-sm">
              <Search className="h-3.5 w-3.5 text-ink/40" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search requests or clients" className="flex-1 bg-transparent text-[13px] outline-none" />
            </div>
            <select className="h-9 border border-hair bg-paper px-2 text-[12.5px]" value={clientF} onChange={(e) => setClientF(e.target.value)}>
              <option value="all">All clients</option>{activeClients.map((c) => <option key={c.id} value={c.id}>{c.business}</option>)}
            </select>
            <div className="flex flex-wrap gap-1.5">
              <SmallBtn active={kind === "all"} onClick={() => setKind("all")}>All</SmallBtn>
              {KIND_ORDER.map((k) => <SmallBtn key={k} active={kind === k} onClick={() => setKind(k)}>{KIND_LABELS[k]}</SmallBtn>)}
            </div>
          </div>

          <div className="grid gap-4 px-5 pt-5 md:px-8 lg:grid-cols-4">
            {COLUMNS.map(([status, label]) => {
              const list = rows.filter((r) => r.status === status);
              return (
                <section key={status} className="flex min-h-[300px] flex-col rounded-md border border-hair bg-card">
                  <header className="flex items-center justify-between border-b border-hair px-4 py-3">
                    <p className="text-[14px] font-semibold">{label}</p>
                    <span className="font-mono text-[11px] tabular-nums text-ink/50">{list.length}</span>
                  </header>
                  <ul className="flex-1 space-y-2 p-2">
                    {list.map((r) => (
                      <li key={r.id} className="card-hover cursor-pointer border border-hair bg-paper p-3" onClick={() => setOpen(r)}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="mono-label text-[9px] text-ink/45">{KIND_LABELS[r.kind] || r.kind}</span>
                          {r.priority === "urgent" && <Tag tone="red">Urgent</Tag>}
                          {r.page_status && r.page_status !== "none" && <Tag tone="ink">Page {r.page_status}</Tag>}
                        </div>
                        <p className="mt-1 text-[13.5px] font-medium">{r.title}</p>
                        <p className="text-[11.5px] text-ink/55">{r.client_name} · {timeAgo(r.created_date)}</p>
                        {(r.attachments || []).length > 0 && (
                          <div className="mt-2 flex gap-1">{r.attachments.filter(isImg).slice(0, 4).map((u) => <img key={u} src={u} alt="" className="h-9 w-9 border border-hair object-cover" />)}{r.attachments.length > 4 && <span className="flex h-9 w-9 items-center justify-center border border-hair text-[10px] text-ink/50">+{r.attachments.length - 4}</span>}</div>
                        )}
                        <div className="mt-2 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {status === "received" && <SmallBtn onClick={() => move(r, "in_progress")}><Play className="h-3 w-3" /> Start</SmallBtn>}
                          {(status === "in_progress" || status === "needs_info") && <SmallBtn onClick={() => move(r, "complete")}><Check className="h-3 w-3" /> Complete</SmallBtn>}
                          {status === "in_progress" && <SmallBtn onClick={() => move(r, "needs_info")}>Needs info</SmallBtn>}
                        </div>
                      </li>
                    ))}
                    {list.length === 0 && <li className="px-2 py-6 text-center text-[12px] text-ink/40">Empty</li>}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}
      {open && <RequestDetail r={open} onClose={() => setOpen(null)} onMove={move} />}
    </div>
  );
}
