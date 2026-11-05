// People > Training workspace, shared by Møthership (Operations > Training) and the client portal (Studios >
// Training, HyperCare+). Tabs: Tracks (build + edit) and People (manager view). `portal` switches copy to the
// client-facing voice (the business's own training; no mention of how drafts are produced).
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, BookOpenCheck, Clock, FilePlus2, GraduationCap, LayoutTemplate, Loader2, Sparkles, Users, Wand2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { trainingApi, errText } from "./api";
import { Button, Chip, Modal, Notice, inputCls } from "./ui";
import TrackBuilder from "./TrackBuilder";
import ManagerView, { AssignDialog } from "./ManagerView";
import { BuildFromSopsDialog, TemplateDialog } from "./BuildDialogs";
import TrainingPlayer from "./TrainingPlayer";

const STATUS = { draft: ["Draft", "muted"], needs_sops: ["Needs SOPs", "amber"], published: ["Published", "green"], archived: ["Archived", "muted"] };

export default function TrainingWorkspace({ scopeId, portal = false, initialTab = "tracks" }) {
  const call = useMemo(() => trainingApi(scopeId), [scopeId]);
  const scopeKey = scopeId || "me";
  const qc = useQueryClient();
  const { toast } = useToast();
  const q = useQuery({ queryKey: ["training", scopeKey, "overview"], queryFn: () => call("overview"), retry: false });
  const templates = useQuery({ queryKey: ["training", scopeKey, "templates"], queryFn: () => call("templates"), retry: false, staleTime: 3600e3 });
  const refresh = () => qc.invalidateQueries({ queryKey: ["training", scopeKey] });
  const [tab, setTab] = useState(initialTab);
  const [trackId, setTrackId] = useState(null);
  const [dlg, setDlg] = useState(null); // { kind: "sops"|"template"|"blank"|"assign"|"preview", ... }
  const d = q.data;
  const openQs = (d?.assignments || []).reduce((s, a) => s + (a.open_questions || 0), 0);

  const built = async (r, msg) => {
    setDlg(null);
    await refresh();
    if (r?.track?.id) { setTab("tracks"); setTrackId(r.track.id); }
    toast({ title: msg || "Track ready", description: r?.gaps?.length ? `${r.gaps.length} gap${r.gaps.length === 1 ? "" : "s"} flagged for you to fill in.` : undefined });
  };

  if (q.isLoading) return <p className="flex items-center gap-2 py-16 text-[13px] text-ink/50"><Loader2 className="h-4 w-4 animate-spin" />Loading training…</p>;
  if (q.isError) return <Notice tone="error">{errText(q.error, "Couldn't load training.")}</Notice>;

  return (
    <div className="space-y-5" data-training-workspace>
      <div className="flex flex-wrap items-center gap-2 border-b border-hair">
        {[["tracks", "Tracks", GraduationCap, d.tracks.length], ["people", "People", Users, d.assignments.filter((a) => a.status !== "completed").length]].map(([k, l, Icon, n]) => (
          <button key={k} type="button" onClick={() => { setTab(k); setTrackId(null); }} aria-current={tab === k ? "page" : undefined} className={`relative -mb-px flex h-11 items-center gap-2 border-b-2 px-3 text-[14px] font-medium ${tab === k ? "border-[#ff3c00] text-ink" : "border-transparent text-ink/55 hover:text-ink"}`}>
            <Icon className="h-4 w-4" />{l}<span className="font-mono text-[11px] text-ink/45">{n}</span>
            {k === "people" && openQs > 0 && <span className="flex h-4 min-w-4 items-center justify-center bg-[#ff3c00] px-1 font-mono text-[10px] text-white">{openQs}</span>}
          </button>
        ))}
      </div>

      {tab === "tracks" && trackId && (
        <TrackBuilder trackId={trackId} call={call} scopeKey={scopeKey} portal={portal} roles={d.roles} onBack={() => setTrackId(null)}
          onPreview={(id) => setDlg({ kind: "preview", track_id: id })}
          onAssign={(id) => setDlg({ kind: "assign", preset: { track_id: id } })}
          onRebuild={(t) => setDlg({ kind: "sops", preset: { track_id: t.id, title: t.title, template_key: t.template_key || t.role, source_ids: (t.source_refs || []).filter((r) => r.type !== "pasted").map((r) => `${r.type === "client_file" ? "file" : r.type}:${r.id}`) } })} />
      )}

      {tab === "tracks" && !trackId && (
        <div className="space-y-5">
          <div className="grid gap-3 md:grid-cols-3">
            <StartCard icon={portal ? Wand2 : Sparkles} title="Build from your SOPs" flame
              text={portal ? "Pick your SOPs and we draft lessons, hands-on tasks and quiz questions from them. Anything they don't cover is flagged." : "Pick SOPs or documents; AI drafts modules grounded only in them. Missing info is flagged, never invented."}
              onClick={() => setDlg({ kind: "sops" })} />
            <StartCard icon={LayoutTemplate} title="Start from a role template" text="New office hire, crew member, crew lead, sales or manager. An outline marked “needs SOPs” until your process fills it." onClick={() => setDlg({ kind: "template" })} />
            <StartCard icon={FilePlus2} title="Blank track" text="Write it yourself: lessons, videos, checklists and quiz questions." onClick={() => setDlg({ kind: "blank" })} />
          </div>
          {d.tracks.length === 0 ? (
            <div className="border border-dashed border-hair bg-card px-6 py-12 text-center">
              <GraduationCap className="mx-auto h-8 w-8 text-ink/30" />
              <p className="mt-3 text-[15px] font-semibold">No training tracks yet.</p>
              <p className="mx-auto mt-1 max-w-md text-[13px] text-ink/55">Your processes become a step-by-step track a new hire works through on their phone: lesson, hands-on tasks, quick check, next.</p>
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {d.tracks.map((t) => <TrackCard key={t.id} t={t} onOpen={() => setTrackId(t.id)} />)}
            </div>
          )}
        </div>
      )}

      {tab === "people" && <ManagerView data={d} call={call} refresh={refresh} portal={portal} onAssign={(preset) => setDlg({ kind: "assign", preset })} />}

      <BuildFromSopsDialog open={dlg?.kind === "sops"} preset={dlg?.preset} onClose={() => setDlg(null)} call={call} portal={portal} templates={templates.data?.templates} onBuilt={(r) => built(r, `Drafted ${r.modules} modules`)} />
      <TemplateDialog open={dlg?.kind === "template"} onClose={() => setDlg(null)} call={call} templates={templates.data?.templates} onBuilt={(r) => built(r, "Outline track created")} />
      <BlankDialog open={dlg?.kind === "blank"} onClose={() => setDlg(null)} call={call} onBuilt={(r) => built(r, "Track created")} />
      <AssignDialog open={dlg?.kind === "assign"} preset={dlg?.preset} onClose={() => setDlg(null)} tracks={d.tracks} call={call} refresh={refresh} />
      {dlg?.kind === "preview" && <PreviewOverlay call={call} trackId={dlg.track_id} onClose={() => setDlg(null)} />}
    </div>
  );
}

function StartCard({ icon: Icon, title, text, onClick, flame }) {
  return (
    <button type="button" onClick={onClick} className={`group flex items-start gap-3 border p-4 text-left transition-colors ${flame ? "border-[#ff3c00]/40 bg-[#ff3c00]/[0.04] hover:border-[#ff3c00]" : "border-hair bg-card hover:border-ink/40"}`}>
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center ${flame ? "flame-bg text-white" : "bg-ink/[0.06] text-ink/70 group-hover:bg-ink group-hover:text-white"}`}><Icon className="h-5 w-5" /></span>
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold tracking-[-0.02em]">{title}</span>
        <span className="mt-1 block text-[12.5px] leading-snug text-ink/55">{text}</span>
      </span>
    </button>
  );
}

function TrackCard({ t, onOpen }) {
  const [s, tone] = STATUS[t.status] || STATUS.draft;
  return (
    <button type="button" onClick={onOpen} className="card-hover flex flex-col border border-hair bg-card text-left" data-track={t.id}>
      <div className="h-[3px] w-full bg-[linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)] opacity-80" />
      <div className="flex flex-1 flex-col p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Chip tone={tone}>{s}</Chip>
          {t.role_label && <span className="mono-label text-[9px] text-ink/45">{t.role_label}</span>}
          {t.hiring_role_key && <Chip tone="soft">Hiring plan</Chip>}
        </div>
        <p className="mt-2 text-[17px] font-semibold leading-snug tracking-[-0.025em]">{t.title}</p>
        {t.description && <p className="mt-1 line-clamp-2 text-[12.5px] leading-snug text-ink/55">{t.description}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 pt-4 text-[11.5px] text-ink/55">
          <span className="inline-flex items-center gap-1"><BookOpenCheck className="h-3.5 w-3.5" />{t.modules} modules</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{t.minutes} min</span>
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" />{t.active} in training · {t.completed} done</span>
          {t.es_enabled && <span>EN / ES</span>}
        </div>
        {(t.needs_sops > 0 || t.gaps > 0) && <p className="mt-2 inline-flex items-center gap-1 text-[11.5px] font-medium text-amber-800"><AlertTriangle className="h-3.5 w-3.5" />{t.needs_sops ? `${t.needs_sops} need${t.needs_sops === 1 ? "s" : ""} SOPs · ` : ""}{t.gaps} gap{t.gaps === 1 ? "" : "s"}</p>}
      </div>
    </button>
  );
}

function BlankDialog({ open, onClose, call, onBuilt }) {
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const go = async () => {
    setBusy(true); setErr("");
    try { const r = await call("save_track", { track: { title, role: "custom" } }); setTitle(""); onBuilt(r); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} kicker="New track" title="Start a blank track" footer={<><Button kind="quiet" onClick={onClose}>Cancel</Button><Button kind="flame" busy={busy} disabled={!title.trim()} onClick={go}>Create</Button></>}>
      <input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && title.trim() && go()} placeholder="e.g. Front desk week one" className={inputCls} aria-label="Track title" />
      {err && <Notice tone="error" className="mt-3">{err}</Notice>}
    </Modal>
  );
}

function PreviewOverlay({ call, trackId, onClose }) {
  const q = useQuery({ queryKey: ["training", "preview", trackId], queryFn: () => call("player", { track_id: trackId }), staleTime: 0 });
  return (
    <div className="fixed inset-0 z-[75] overflow-y-auto bg-canvas" data-training-preview>
      {q.isLoading ? <div className="grid h-full place-items-center"><Loader2 className="h-6 w-6 animate-spin text-ink/40" /></div>
        : q.isError ? <div className="p-6"><Notice tone="error">{errText(q.error)}</Notice><Button className="mt-3" onClick={onClose}>Close</Button></div>
        : <TrainingPlayer data={q.data} mode="preview" onClose={onClose} />}
    </div>
  );
}
