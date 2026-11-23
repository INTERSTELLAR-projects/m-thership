// /field — the field inbox (docs/field-inbox.md). Mobile first: Justin is standing in a business with his phone.
//   1. Site visit: pick the business (client or new prospect), add videos/photos from the camera roll, say what he
//      wants, tick what to produce, send. Creates FieldInbox (upload, site_visit) + a queued site_visit ClaudeJob.
//   2. Quick capture: a line to file, routed exactly like a WhatsApp message (task / idea / note / Claude job).
//   3. Recent: every field item with its status and a link to what it became.
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Camera, CheckCircle2, Film, Image as ImageIcon, Loader2, MessageCircle, Send, Upload, X, Zap } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import DictationBox from "@/features/voice/DictationBox";
import { useList } from "@/lib/useData";
import { logAction } from "@/lib/usageLog";
import { INTENT_LABEL, STATUS_TONE, fmtMB, planFile, readDuration, routeText, submitSiteVisit, uploadMedia } from "./fieldClient";

const input = "h-11 w-full min-w-0 border border-hair bg-paper px-3 text-[14px] outline-none placeholder:text-ink/35 focus:border-[#ff3c00] md:h-10 md:text-[13px]";
const OUTPUTS = [
  { key: "website", label: "Website improvements" },
  { key: "operations", label: "Operations / Command System plan" },
  { key: "content", label: "Content clips" },
];
const SOURCE_ICON = { whatsapp: MessageCircle, upload: Film, web: Zap };

function Section({ n, title, hint, children, id }) {
  return (
    <section id={id} className="border border-hair bg-paper/80" aria-label={title}>
      <header className="flex items-baseline justify-between gap-3 border-b border-hair px-4 py-3">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]"><span className="mr-2 font-mono text-[11px] text-[#ff3c00]">{n}</span>{title}</h2>
        {hint && <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-ink/40 sm:inline">{hint}</span>}
      </header>
      <div className="space-y-4 p-4">{children}</div>
    </section>
  );
}

function ago(iso) {
  const t = Date.parse(iso || "");
  if (!t) return "";
  const m = Math.round((Date.now() - t) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  if (m < 60 * 24) return `${Math.round(m / 60)}h`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function FieldItemRow({ item }) {
  const Icon = SOURCE_ICON[item.source] || Zap;
  const r = item.routed_to || {};
  const text = item.text || (item.media?.length ? `${item.media.length} ${item.media[0].type || "file"}${item.media.length > 1 ? "s" : ""}` : item.error || "(empty)");
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-ink/45" aria-label={item.source} />
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13.5px] leading-snug">{item.is_test ? <span className="mr-1 font-mono text-[10px] text-[#ff3c00]">[TEST]</span> : null}{text}</p>
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11.5px] text-ink/50">
          <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] ${STATUS_TONE[item.status] || STATUS_TONE.new}`}>{item.status || "new"}</span>
          {item.intent && <span>{INTENT_LABEL[item.intent] || item.intent}</span>}
          {(item.client_name || item.lead_business?.name) && <span>· {item.client_name || `${item.lead_business.name} (new)`}</span>}
          <span>· {ago(item.created_at || item.created_date)}</span>
        </p>
        {item.ai_summary && <p className="mt-1 text-[12px] text-ink/60">{item.ai_summary}</p>}
      </div>
      {r.path && (
        <Link to={r.path} className="inline-flex shrink-0 items-center gap-1 pt-0.5 text-[12px] text-ink/60 hover:text-[#ff3c00]" aria-label={`Open ${r.entity}`}>
          {r.entity === "ClaudeJob" ? "Job" : r.entity === "CRMClient" ? "Client" : r.entity === "BusinessBrain" ? "Brain" : r.entity}<ArrowUpRight className="h-3 w-3" />
        </Link>
      )}
    </li>
  );
}

function FileRow({ f, onRemove, disabled }) {
  const plan = f.plan;
  const Icon = plan.kind === "video" ? Film : ImageIcon;
  const bad = plan.action === "too_big" || plan.action === "unsupported";
  return (
    <li className="px-3 py-2.5">
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 shrink-0 text-ink/45" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px]">{f.file.name}</span>
          <span className={`block text-[11.5px] ${bad ? "text-red-700" : "text-ink/50"}`}>{fmtMB(f.file.size)}{f.duration ? ` · ${Math.round(f.duration)} s` : ""}{plan.note ? ` · ${plan.note}` : ""}{f.error ? ` · ${f.error}` : ""}</span>
        </span>
        {f.state === "done" ? <CheckCircle2 className="h-4 w-4 text-green-700" aria-label="Uploaded" /> : f.state === "uploading" ? <span className="font-mono text-[11px] tabular-nums text-ink/60">{Math.round(f.progress * 100)}%</span> : (
          <button type="button" onClick={onRemove} disabled={disabled} className="p-1 text-ink/40 hover:text-ink disabled:opacity-40" aria-label={`Remove ${f.file.name}`}><X className="h-4 w-4" /></button>
        )}
      </div>
      {(f.state === "uploading" || f.state === "done") && (
        <div className="mt-2 h-1 w-full bg-ink/[0.08]" role="progressbar" aria-valuenow={Math.round(f.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <div className="h-full bg-[#ff3c00] transition-[width] duration-300" style={{ width: `${Math.round(f.progress * 100)}%` }} />
        </div>
      )}
    </li>
  );
}

function SiteVisitForm({ clients }) {
  const qc = useQueryClient();
  const [mode, setMode] = useState("client");
  const [clientId, setClientId] = useState("");
  const [search, setSearch] = useState("");
  const [lead, setLead] = useState({ name: "", website: "", city: "" });
  const [files, setFiles] = useState([]);
  const [prompt, setPrompt] = useState("");
  const [outputs, setOutputs] = useState({ website: true, operations: true, content: false });
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const [done, setDone] = useState(null);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = [...clients].sort((a, b) => String(a.business || "").localeCompare(String(b.business || "")));
    return q ? list.filter((c) => String(c.business || "").toLowerCase().includes(q)) : list;
  }, [clients, search]);

  const pick = async (e) => {
    const list = [...(e.target.files || [])].slice(0, 20);
    e.target.value = "";
    const rows = await Promise.all(list.map(async (file) => ({ id: `${file.name}-${file.size}-${file.lastModified}`, file, plan: planFile(file), duration: await readDuration(file), progress: 0, state: "ready" })));
    setFiles((x) => [...x, ...rows.filter((r) => !x.some((y) => y.id === r.id))]);
  };
  const patch = (id, p) => setFiles((x) => x.map((f) => (f.id === id ? { ...f, ...p } : f)));

  const submit = async () => {
    setErr("");
    const business = mode === "client" ? clients.find((c) => c.id === clientId) : null;
    if (mode === "client" && !business) { setErr("Pick the client, or switch to New prospect."); return; }
    if (mode === "lead" && !lead.name.trim()) { setErr("Add the business name."); return; }
    const usable = files.filter((f) => f.plan.action === "ok" || f.plan.action === "split");
    if (files.some((f) => f.plan.action === "too_big" || f.plan.action === "unsupported")) { setErr("Remove the files marked in red first."); return; }
    if (!usable.length && !prompt.trim()) { setErr("Add a video or photo, or say what you want."); return; }
    setBusy("upload");
    const media = [];
    try {
      for (const f of usable) {
        if (f.state === "done" && f.media) { media.push(f.media); continue; }
        patch(f.id, { state: "uploading", progress: 0, error: "" });
        try {
          const m = await uploadMedia(f.file, { duration: f.duration, onProgress: (p) => patch(f.id, { progress: Math.min(1, p) }) });
          patch(f.id, { state: "done", progress: 1, media: m });
          media.push(m);
        } catch (x) {
          patch(f.id, { state: "ready", error: x?.message || "Upload failed" });
          throw x;
        }
      }
      setBusy("send");
      const res = await submitSiteVisit({
        client_id: business?.id || "", lead: mode === "lead" ? lead : null, prompt, media, outputs,
      });
      logAction("field_site_visit");
      setDone(res);
      setFiles([]); setPrompt(""); setLead({ name: "", website: "", city: "" });
      qc.invalidateQueries({ queryKey: ["FieldInbox"] });
      qc.invalidateQueries({ queryKey: ["ClaudeJob"] });
    } catch (x) {
      setErr(x?.message || "Something failed. Your files stay here: try again.");
    } finally { setBusy(""); }
  };

  const tab = (id, label) => (
    <button type="button" onClick={() => setMode(id)} aria-pressed={mode === id} className={`h-10 flex-1 border text-[13px] ${mode === id ? "border-ink bg-ink text-white" : "border-hair bg-paper text-ink/70 hover:border-ink"}`}>{label}</button>
  );

  return (
    <>
      <div>
        <p className="mono-label mb-1.5 text-[9.5px] text-ink/50">Business</p>
        <div className="flex">{tab("client", "Existing client")}{tab("lead", "New prospect")}</div>
        {mode === "client" ? (
          <div className="mt-2 space-y-2">
            <input className={input} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search clients and leads" aria-label="Search clients" />
            <select className={input} value={clientId} onChange={(e) => setClientId(e.target.value)} aria-label="Client">
              <option value="">Pick a client or lead…</option>
              {shown.map((c) => <option key={c.id} value={c.id}>{c.business}{c.status === "Lead" ? " (lead)" : ""}</option>)}
            </select>
          </div>
        ) : (
          <div className="mt-2 grid gap-2 sm:grid-cols-3">
            <input className={input} value={lead.name} onChange={(e) => setLead((l) => ({ ...l, name: e.target.value }))} placeholder="Business name" aria-label="Business name" />
            <input className={input} value={lead.website} onChange={(e) => setLead((l) => ({ ...l, website: e.target.value }))} placeholder="Website URL (optional)" inputMode="url" aria-label="Website URL" />
            <input className={input} value={lead.city} onChange={(e) => setLead((l) => ({ ...l, city: e.target.value }))} placeholder="City" aria-label="City" />
          </div>
        )}
      </div>

      <div>
        <div className="mb-1.5 flex items-baseline justify-between gap-2">
          <p className="mono-label text-[9.5px] text-ink/50">Videos and photos</p>
          <p className="text-[11px] text-ink/45">Up to 100 MB per video (longer ones go in parts), 40 MB per photo</p>
        </div>
        <label className={`flex h-14 cursor-pointer items-center justify-center gap-2 border border-dashed border-ink/25 bg-paper text-[14px] text-ink/70 hover:border-[#ff3c00] hover:text-ink ${busy ? "pointer-events-none opacity-50" : ""}`}>
          <Camera className="h-4 w-4" />Add from camera roll
          <input type="file" accept="video/*,image/*" multiple className="sr-only" onChange={pick} disabled={!!busy} />
        </label>
        {files.length > 0 && <ul className="mt-2 divide-y divide-hair border border-hair bg-card">{files.map((f) => <FileRow key={f.id} f={f} disabled={!!busy} onRemove={() => setFiles((x) => x.filter((y) => y.id !== f.id))} />)}</ul>}
      </div>

      <DictationBox label="What do you want?" value={prompt} onChange={setPrompt} rows={3} placeholder="e.g. fix their website, map their operations, content for social" disabled={!!busy} />

      <fieldset>
        <legend className="mono-label mb-1.5 text-[9.5px] text-ink/50">Produce</legend>
        <div className="grid gap-1.5 sm:grid-cols-3">
          {OUTPUTS.map((o) => (
            <label key={o.key} className="flex min-h-11 cursor-pointer items-center gap-2.5 border border-hair bg-paper px-3 text-[13px]">
              <input type="checkbox" className="h-4 w-4 accent-[#ff3c00]" checked={!!outputs[o.key]} onChange={(e) => setOutputs((x) => ({ ...x, [o.key]: e.target.checked }))} />
              {o.label}
            </label>
          ))}
        </div>
      </fieldset>

      {err && <p className="text-[12.5px] text-red-700" role="alert">{err}</p>}
      <button type="button" onClick={submit} disabled={!!busy} className="flex h-12 w-full items-center justify-center gap-2 bg-[#ff3c00] text-[14.5px] font-medium text-white hover:bg-ink disabled:opacity-60">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {busy === "upload" ? "Uploading…" : busy === "send" ? "Queueing for Claude…" : "Send to Claude"}
      </button>
      <p className="text-[11.5px] text-ink/50">Claude analyses on the next queue run (hourly, 7 AM–9 PM PT). Analysis and drafts only: nothing is published or sent, and nobody at the business is contacted.</p>
      {done && (
        <p className="flex flex-wrap items-center gap-2 border border-green-700/30 bg-green-50 px-3 py-2 text-[13px] text-green-900" role="status">
          <CheckCircle2 className="h-4 w-4" />Site visit queued.
          {done.routed_to?.path && <Link to={done.routed_to.path} className="inline-flex items-center gap-1 underline">Open the job<ArrowUpRight className="h-3 w-3" /></Link>}
        </p>
      )}
    </>
  );
}

function QuickCapture() {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true); setMsg(null);
    try {
      const r = await routeText(text);
      setMsg({ ok: true, text: r.reply, path: r.routed_to?.path });
      setText("");
      logAction("field_quick_capture");
      qc.invalidateQueries({ queryKey: ["FieldInbox"] });
    } catch (x) { setMsg({ ok: false, text: x?.message || "Could not file that." }); } finally { setBusy(false); }
  };
  return (
    <>
      <DictationBox label="Say or type it" value={text} onChange={setText} rows={2} placeholder="task: call Miguel about the patio quote · idea: … · note for Royalz: … · fix the hours on …" disabled={busy} />
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" onClick={send} disabled={busy || !text.trim()} className="inline-flex h-11 items-center gap-2 bg-ink px-4 text-[13.5px] text-white hover:bg-[#ff3c00] disabled:opacity-50">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}File it
        </button>
        <span className="text-[11.5px] text-ink/50">Same rules as WhatsApp: task:, idea:, note:, build/fix/write → Claude, anything unclear → task Inbox.</span>
      </div>
      {msg && <p className={`text-[13px] ${msg.ok ? "text-green-800" : "text-red-700"}`} role="status">{msg.text} {msg.path && <Link to={msg.path} className="underline">Open</Link>}</p>}
    </>
  );
}

export default function FieldPage() {
  const clientsQ = useList("CRMClient", { sort: "business", limit: 500 });
  const inboxQ = useList("FieldInbox", { sort: "-created_date", limit: 40 });
  const clients = (clientsQ.data || []).filter((c) => c.status !== "Inactive");
  const items = inboxQ.data || [];
  return (
    <div className="pb-16">
      <PageHeader breadcrumb="Claude / Field inbox" title="Field /inbox" rightText="WhatsApp · site visits" />
      <div className="mx-auto w-full max-w-[880px] space-y-4 px-4 pt-5 md:px-8">
        <p className="text-[13px] leading-relaxed text-ink/60">
          From the glasses: <span className="font-medium text-ink">“Hey Meta, send a WhatsApp to Møthership: …”</span> files a task, idea, note or Claude job. From a business: record, then add it here.
          <Link to="/settings?tab=field" className="ml-1 whitespace-nowrap text-ink/70 underline hover:text-[#ff3c00]">Setup</Link>
        </p>
        <Section n="01" title="Site visit" hint="Video → analysis → build" id="site-visit">
          <SiteVisitForm clients={clients} />
        </Section>
        <Section n="02" title="Quick capture" hint="Routed like WhatsApp">
          <QuickCapture />
        </Section>
        <Section n="03" title="Recent" hint={`${items.length} items`}>
          {inboxQ.isLoading ? <p className="text-[12.5px] text-ink/45">Loading…</p> : items.length ? (
            <ul className="-m-4 divide-y divide-hair">{items.map((it) => <FieldItemRow key={it.id} item={it} />)}</ul>
          ) : <p className="text-[13px] text-ink/55">Nothing yet. Send a WhatsApp to Møthership or add a site visit above.</p>}
        </Section>
      </div>
    </div>
  );
}
