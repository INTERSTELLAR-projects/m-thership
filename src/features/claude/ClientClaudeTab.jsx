import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles, Radar, ScanSearch, Upload, Link2, Trash2, Loader2, FileVideo, Image as ImageIcon, FileText, Globe, Hammer } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useClientRecords } from "@/features/clients/hooks";
import { timeAgo } from "@/lib/useData";
import { cn } from "@/lib/utils";
import { useJobs, useRefreshJobs, queueAudit, queueBuild, JOB_STATUS, KIND_LABELS } from "./jobs";
import { MEETINGS_FOLDER } from "./briefs";

const KIND_ICON = { screen_recording: FileVideo, screenshot: ImageIcon, reference_site: Globe, meeting_notes: FileText, file: FileText, other: FileText };
const KINDS = [
  ["screen_recording", "Screen recording"], ["screenshot", "Screenshot"], ["reference_site", "Reference site"], ["meeting_notes", "Meeting notes"], ["file", "Other file"],
];

function Card({ icon: Icon, title, sub, children, action }) {
  return (
    <section className="rounded-md border border-hair bg-card">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-hair px-4 py-3">
        <div className="flex items-start gap-2.5">
          <Icon className="mt-0.5 h-4 w-4 text-[#ff3c00]" strokeWidth={1.75} />
          <div>
            <h3 className="text-[15px] font-semibold tracking-[-0.02em]">{title}</h3>
            {sub && <p className="mt-0.5 max-w-xl text-[12.5px] text-ink/55">{sub}</p>}
          </div>
        </div>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function FlameBtn({ onClick, busy, children, disabled }) {
  return (
    <button type="button" onClick={onClick} disabled={busy || disabled}
      className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-3.5 py-2 text-[12.5px] font-medium text-white disabled:opacity-50">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{children}
    </button>
  );
}

function JobLine({ job }) {
  const s = JOB_STATUS[job.status] || JOB_STATUS.queued;
  return (
    <Link to={`/claude?job=${job.id}`} className="flex items-center gap-3 px-1 py-2 hover:bg-ink/[0.03]">
      <span className={cn("mono-label shrink-0 rounded-sm px-1.5 py-0.5 text-[8.5px]", s.tone)}>{s.label}</span>
      <span className="min-w-0 flex-1 truncate text-[13px]">{job.title}</span>
      <span className="font-mono text-[10.5px] text-ink/40">{timeAgo(job.finished_at || job.requested_at || job.created_date)}</span>
    </Link>
  );
}

export default function ClientClaudeTab({ client }) {
  const { data: jobs = [] } = useJobs(400);
  const refresh = useRefreshJobs();
  const refs = useClientRecords("BuildReference", client.id);
  const gaps = useClientRecords("ClientGap", client.id);
  const [busy, setBusy] = useState("");
  const [type, setType] = useState("website");
  const [extra, setExtra] = useState("");
  const [form, setForm] = useState({ kind: "screen_recording", title: "", link_url: "", note: "" });
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef(null);

  const mine = jobs.filter((j) => j.client_id === client.id);
  const audits = mine.filter((j) => j.kind === "audit");
  const builds = mine.filter((j) => j.kind === "build_website" || j.kind === "build_app");
  const auditGaps = gaps.rows.filter((g) => g.source_job_id);
  const typeRefs = refs.rows.filter((r) => r.build_type === "both" || r.build_type === type);

  const run = async (key, fn) => { setBusy(key); try { await fn(); refresh(); } finally { setBusy(""); } };

  const addRef = async (file) => {
    setUploading(true);
    try {
      let file_url = "";
      if (file) ({ file_url } = await base44.integrations.Core.UploadFile({ file }));
      await refs.create({
        kind: form.kind, build_type: type, title: form.title.trim() || file?.name || form.link_url || "Reference",
        file_url, link_url: form.link_url.trim(), note: form.note.trim(),
      });
      setForm((f) => ({ ...f, title: "", link_url: "", note: "" }));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const input = "w-full rounded-sm border border-hair bg-canvas/60 px-3 py-2 text-[13px] outline-none focus:border-[#ff3c00]";

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_380px]">
      <div className="space-y-5">
        <Card icon={Radar} title="Intel Briefing"
          sub="Free with every build. Claude runs the audit, writes each finding to Goals & Gaps, and drafts the briefing. Nothing reaches their portal until you approve it in the Claude Queue.">
          <div className="flex flex-wrap gap-2">
            <FlameBtn busy={busy === "audit"} onClick={() => run("audit", () => queueAudit(client, "initial"))}>Audit the business</FlameBtn>
            <button type="button" disabled={!!busy} onClick={() => run("sweep", () => queueAudit(client, "final"))}
              className="inline-flex items-center gap-1.5 rounded-sm border border-hair px-3.5 py-2 text-[12.5px] hover:border-[#ff3c00]">
              {busy === "sweep" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ScanSearch className="h-3.5 w-3.5" />} Run the final sweep
            </button>
          </div>
          <div className="mt-3 flex flex-wrap gap-4 text-[12px] text-ink/55">
            <span>{auditGaps.length} audit findings on file</span>
            <span>{auditGaps.filter((g) => g.portal_visible).length} visible in their portal</span>
            <span>{auditGaps.filter((g) => g.status === "fixed").length} fixed</span>
          </div>
          {audits.length > 0 && <div className="mt-3 divide-y divide-hair border-t border-hair">{audits.slice(0, 5).map((j) => <JobLine key={j.id} job={j} />)}</div>}
        </Card>

        <Card icon={Hammer} title="Build with Claude"
          sub="Claude builds a new Base44 app step by step from the intake, your recorded calls and these references. Integrations and the final sweep always come last. You approve each stage."
          action={
            <div className="flex rounded-sm border border-hair p-0.5">
              {[["website", "Website"], ["app", "Command System"]].map(([k, l]) => (
                <button key={k} type="button" onClick={() => setType(k)} className={cn("rounded-sm px-3 py-1 text-[12px]", type === k ? "bg-ink text-canvas" : "text-ink/60")}>{l}</button>
              ))}
            </div>
          }>
          <ol className="space-y-2 text-[13px]">
            <li className="flex gap-2"><span className="font-mono text-ink/40">1</span>
              <span><b className="font-medium">Intake</b> — <Link to={`/clients/${client.id}?tab=audit`} className="text-[#ff3c00] hover:underline">Intake Audit tab</Link>. Claude reads whatever is filled in.</span></li>
            <li className="flex gap-2"><span className="font-mono text-ink/40">2</span>
              <span><b className="font-medium">Calls</b> — found automatically in your <a href={`https://drive.google.com/drive/folders/${MEETINGS_FOLDER}`} target="_blank" rel="noreferrer" className="text-[#ff3c00] hover:underline">Meet recordings folder</a> by the business name ({client.business}). Name new calls "Interstellar Meeting | {client.business}".</span></li>
            <li className="flex gap-2"><span className="font-mono text-ink/40">3</span>
              <span><b className="font-medium">References</b> — upload below ({typeRefs.length} for this {type === "website" ? "website" : "system"}).</span></li>
          </ol>
          <textarea value={extra} onChange={(e) => setExtra(e.target.value)} rows={2} placeholder="Anything else Claude should know for this build (optional)" className={cn(input, "mt-4")} />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <FlameBtn busy={busy === "build"} onClick={() => run("build", () => queueBuild(client, type, { refs: typeRefs, extra: extra.trim() }))}>
              Build the {type === "website" ? "website" : "Command System"} with Claude
            </FlameBtn>
            <span className="text-[11.5px] text-ink/45">Queues stage 1. Approving a stage queues the next.</span>
          </div>
          {builds.length > 0 && <div className="mt-4 divide-y divide-hair border-t border-hair">{builds.slice(0, 8).map((j) => <JobLine key={j.id} job={j} />)}</div>}
        </Card>
      </div>

      <Card icon={Upload} title="Reference uploads" sub={`Screen recordings of sites they like, screenshots, links. Tagged to the ${type === "website" ? "website" : "Command System"} build.`}>
        <div className="space-y-2">
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} className={input}>
            {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Name (e.g. Competitor homepage walkthrough)" className={input} />
          <input value={form.link_url} onChange={(e) => setForm({ ...form, link_url: e.target.value })} placeholder="Link (reference site, Drive file…)" className={input} />
          <textarea value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} rows={2} placeholder="What to take from it — layout, feel, a feature" className={input} />
          <div className="flex flex-wrap gap-2">
            <label className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-sm bg-ink px-3 py-2 text-[12.5px] text-canvas", uploading && "opacity-60")}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Upload file
              <input ref={fileRef} type="file" accept="video/*,image/*,.pdf,.doc,.docx" className="hidden" disabled={uploading}
                onChange={(e) => e.target.files?.[0] && addRef(e.target.files[0])} />
            </label>
            <button type="button" disabled={uploading || !form.link_url.trim()} onClick={() => addRef(null)}
              className="inline-flex items-center gap-1.5 rounded-sm border border-hair px-3 py-2 text-[12.5px] hover:border-[#ff3c00] disabled:opacity-40">
              <Link2 className="h-3.5 w-3.5" /> Save link
            </button>
          </div>
        </div>
        <ul className="mt-4 divide-y divide-hair border-t border-hair">
          {refs.rows.length === 0 && <li className="py-6 text-center text-[12.5px] text-ink/45">No references yet.</li>}
          {refs.rows.map((r) => {
            const Icon = KIND_ICON[r.kind] || FileText;
            return (
              <li key={r.id} className="group flex items-start gap-2.5 py-2.5">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink/45" />
                <div className="min-w-0 flex-1">
                  <a href={r.file_url || r.link_url || "#"} target="_blank" rel="noreferrer" className="block truncate text-[13px] font-medium hover:text-[#ff3c00]">{r.title}</a>
                  <p className="truncate text-[11.5px] text-ink/50">{r.build_type === "app" ? "Command System" : r.build_type === "both" ? "Both" : "Website"}{r.note ? ` · ${r.note}` : ""}</p>
                </div>
                <button type="button" onClick={() => refs.remove(r.id)} className="p-1 text-ink/30 opacity-0 hover:text-red-600 group-hover:opacity-100" title="Remove">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
        {mine.length > 0 && (
          <div className="mt-5 border-t border-hair pt-3">
            <p className="mono-label mb-1 text-[9.5px] text-ink/45">All Claude jobs for {client.business}</p>
            <div className="divide-y divide-hair">{mine.slice(0, 8).map((j) => <JobLine key={j.id} job={j} />)}</div>
            <p className="mt-1 text-[11px] text-ink/40">{mine.length} total · {KIND_LABELS.audit}s, builds and task steps</p>
          </div>
        )}
      </Card>
    </div>
  );
}
