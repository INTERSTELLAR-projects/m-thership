import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Check, Copy, Download, History, Loader2, Shuffle, Sparkles, Trash2, Undo2, Wand2,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { PILLARS, PLATFORMS } from "./brand";
import PublishPanel from "./PublishPanel";
import { renderAndUpload, specHash } from "./lib/publish";
import ScaledPost, { PostRender } from "./PostCanvas";
import MockEditor from "./MockEditor";
import { getTemplate, switchTemplate, TEMPLATES } from "./templates";
import { POSTS_KEY, deletePost, folderNames, getPost, listPosts, listSavedFolders, FOLDERS_KEY, updatePost } from "./lib/socialStore";
import { downloadDataUrl, postToPng, slugify } from "./lib/exportPng";
import { editSpecWithAi, generateVariations, specDiff, writeCaptions } from "./lib/aiEdit";
import { Btn, ConfirmDialog, Field, Panel, Select, StatusBadge, TextArea, TextInput, copyText, inputCls } from "./ui";

// Autosave only ever writes these content fields. Status, schedule, image and publish results are
// changed by explicit actions (PublishPanel) and the publisher, never by a stale autosave.
const EDITABLE = ["title", "folder", "pillar", "platforms", "template", "spec", "caption", "caption_linkedin", "alt_text", "notes", "revision_history"];
const pick = (p) => Object.fromEntries(EDITABLE.map((k) => [k, p?.[k]]));
const MAX_HISTORY = 30;

export default function PostDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const postQ = useQuery({
    queryKey: ["SocialPost", id],
    queryFn: () => getPost(id),
    // Watch the status flip while it is publishing or due within the hour.
    refetchInterval: (q) => {
      const p = q.state.data;
      return p && (p.status === "publishing" || (p.status === "approved" && Date.parse(p.scheduled_at || 0) < Date.now() + 3600000)) ? 20000 : false;
    },
  });
  const allQ = useQuery({ queryKey: POSTS_KEY, queryFn: listPosts });
  const foldersQ = useQuery({ queryKey: FOLDERS_KEY, queryFn: listSavedFolders });
  const folders = folderNames(allQ.data || [], foldersQ.data);

  const [draft, setDraft] = useState(null);
  const [saveState, setSaveState] = useState("saved"); // saved | dirty | saving | error
  const [confirmDelete, setConfirmDelete] = useState(false);
  const exportRef = useRef(null);
  const timer = useRef(null);
  const latest = useRef(null);

  useEffect(() => {
    if (postQ.data && !draft) setDraft(pick(postQ.data));
  }, [postQ.data, draft]);

  // Approved post whose design changed: re-render the JPEG and re-upload so the publisher posts
  // exactly what is on screen (the publisher refuses an image whose hash doesn't match the spec).
  const [rerender, setRerender] = useState(null); // null | "pending" | "working" | "error"
  const server = postQ.data;
  const draftHash = draft ? specHash(draft.template, draft.spec) : null;
  const needsRender = server?.status === "approved" && !!draftHash && server.image_spec_hash !== draftHash;
  useEffect(() => {
    if (!needsRender || saveState !== "saved") return undefined;
    setRerender("pending");
    const t = setTimeout(async () => {
      setRerender("working");
      try {
        const fields = await renderAndUpload(exportRef.current, { ...server, ...latest.current, template: draft.template, spec: draft.spec });
        await updatePost(id, fields);
        await qc.invalidateQueries({ queryKey: ["SocialPost", id] });
        qc.invalidateQueries({ queryKey: POSTS_KEY });
        setRerender(null);
      } catch {
        setRerender("error");
      }
    }, 1800);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsRender, draftHash, saveState]);

  // Debounced autosave.
  useEffect(() => {
    if (saveState !== "dirty") return undefined;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      setSaveState("saving");
      try {
        await updatePost(id, latest.current);
        setSaveState((s) => (s === "saving" ? "saved" : s));
        qc.invalidateQueries({ queryKey: POSTS_KEY });
      } catch {
        setSaveState("error");
      }
    }, 700);
    return () => clearTimeout(timer.current);
  }, [saveState, draft, id, qc]);

  const set = (patch) => {
    setDraft((d) => {
      const next = { ...d, ...(typeof patch === "function" ? patch(d) : patch) };
      latest.current = next;
      return next;
    });
    setSaveState("dirty");
  };
  const setSpec = (patch) => set((d) => ({ spec: { ...(d.spec || {}), ...patch } }));

  const pushHistory = (d, instruction) =>
    [...(d.revision_history || []), { at: new Date().toISOString(), instruction, before_spec: d.spec, before_template: d.template }].slice(-MAX_HISTORY);

  const applySpec = (spec, instruction, template) =>
    set((d) => ({ spec, template: template || d.template, revision_history: pushHistory(d, instruction) }));

  const undo = () =>
    set((d) => {
      const h = [...(d.revision_history || [])];
      const last = h.pop();
      if (!last) return {};
      return { spec: last.before_spec, template: last.before_template || d.template, revision_history: h };
    });

  const restoreTo = (i) =>
    set((d) => {
      const h = d.revision_history || [];
      const entry = h[i];
      if (!entry) return {};
      return { spec: entry.before_spec, template: entry.before_template || d.template, revision_history: h.slice(0, i) };
    });

  if (postQ.isLoading || (!draft && postQ.data)) return <p className="py-24 text-center text-[13px] text-ink/50"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading post…</p>;
  if (postQ.isError || !postQ.data) return <div className="py-24 text-center text-[13px] text-ink/60">Post not found. <Link to="/social" className="text-[#ff3c00] hover:underline">Back to Social Studio</Link></div>;

  const tpl = getTemplate(draft.template);
  const spec = draft.spec || {};

  const downloadPng = async () => {
    try {
      const url = await postToPng(exportRef.current);
      downloadDataUrl(url, `${slugify(draft.title || spec.headline)}.png`);
    } catch (e) {
      toast({ title: "Export failed", description: String(e?.message || e), variant: "destructive" });
    }
  };

  return (
    <div className="min-h-full">
      <div style={{ position: "fixed", left: -20000, top: 0, pointerEvents: "none" }} aria-hidden="true">
        <PostRender ref={exportRef} template={draft.template} spec={spec} />
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-center gap-3 border-b border-hair px-5 py-4 md:px-8">
        <Link to="/social" className="mono-label inline-flex items-center gap-1 text-[10px] text-ink/50 hover:text-[#ff3c00]"><ArrowLeft className="h-3 w-3" />Social Studio</Link>
        <input value={draft.title || ""} onChange={(e) => set({ title: e.target.value })} className="min-w-[200px] flex-1 border-b border-transparent bg-transparent text-[22px] font-semibold tracking-[-0.03em] outline-none focus:border-[#ff3c00]" />
        <StatusBadge status={server.status} />
        <span className="mono-label text-[9px] text-ink/45">
          {saveState === "saving" ? "Saving…" : saveState === "dirty" ? "Unsaved" : saveState === "error" ? <span className="text-[#d83300]">Save failed</span> : "Saved"}
        </span>
        <Btn onClick={undo} disabled={!(draft.revision_history || []).length} title="Undo last AI edit or template switch"><Undo2 className="h-3.5 w-3.5" />Undo</Btn>
        <Btn variant="flame" onClick={downloadPng}><Download className="h-3.5 w-3.5" />Download PNG</Btn>
      </div>

      <div className="grid gap-5 px-5 py-5 md:px-8 xl:grid-cols-[minmax(0,1fr)_480px]">
        {/* Left: preview + AI */}
        <div className="min-w-0 space-y-4">
          <div className="mx-auto w-full max-w-[720px]">
            <div className="border border-hair shadow-[0_30px_60px_-40px_rgba(26,26,26,.6)]">
              <ScaledPost template={draft.template} spec={spec} />
            </div>
            <p className="mono-label mt-2 text-center text-[9px] text-ink/40">{tpl.label} · exports at exactly 1080 × 1080</p>
          </div>
          <AiPanel template={draft.template} spec={spec} onApply={applySpec} />
          <HistoryPanel history={draft.revision_history || []} onRestore={restoreTo} />
        </div>

        {/* Right: editors */}
        <div className="min-w-0 space-y-4">
          <PublishPanel post={{ ...server, ...draft }} saving={saveState !== "saved"} rerender={rerender} stale={needsRender} />
          <Panel label="Template" bodyClass="p-3.5 space-y-3">
            <div className="grid grid-cols-2 gap-1.5">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => t.key !== draft.template && applySpec(switchTemplate(spec, t.key), `Switched template to ${t.label}`, t.key)}
                  className={`border px-2 py-1.5 text-left text-[12px] transition-colors ${t.key === draft.template ? "border-[#ff3c00] bg-[#ff3c00]/5 text-[#d83300]" : "border-hair hover:border-[#ff3c00]/50"}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-ink/45">{tpl.description}</p>
          </Panel>

          <Panel label="Copy on the image" bodyClass="p-3.5 space-y-3">
            <Field label="Eyebrow" hint="(label)"><TextInput value={spec.eyebrow} onChange={(v) => setSpec({ eyebrow: v })} /></Field>
            <Field label="Headline" hint={`${String(spec.headline || "").length}/72`}><TextArea rows={2} value={spec.headline} onChange={(v) => setSpec({ headline: v })} /></Field>
            <Field label="Accent word" hint={spec.accent_word && !String(spec.headline || "").toLowerCase().includes(String(spec.accent_word).toLowerCase()) ? "not in headline" : "orange part of the headline"}>
              <TextInput value={spec.accent_word} onChange={(v) => setSpec({ accent_word: v })} />
            </Field>
            <Field label="Subhead" hint={`${String(spec.subhead || "").length}/140`}><TextArea rows={2} value={spec.subhead} onChange={(v) => setSpec({ subhead: v })} /></Field>
            {(draft.template === "quote_hook" || spec.body) && <Field label="Body"><TextArea rows={3} value={spec.body} onChange={(v) => setSpec({ body: v })} /></Field>}
            <Field label="CTA" hint="empty = no button"><TextInput value={spec.cta} onChange={(v) => setSpec({ cta: v })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Theme">
                <div className="flex border border-hair">
                  {["light", "dark"].map((th) => (
                    <button key={th} type="button" onClick={() => setSpec({ theme: th })} className={`h-9 flex-1 text-[12px] capitalize ${(spec.theme || "light") === th ? "bg-ink text-white" : "bg-paper text-ink/60"}`}>{th}</button>
                  ))}
                </div>
              </Field>
              <Field label="Logo lockup">
                <Select value={spec.lockup || "interstellar"} onChange={(v) => setSpec({ lockup: v })} options={[{ value: "interstellar", label: "INTERSTELLAR®" }, { value: "mothership", label: "MØTHERSHIP®" }, { value: "none", label: "None" }]} />
              </Field>
            </div>
          </Panel>

          <Panel label="Mock data" title={tpl.label} bodyClass="p-3.5">
            <MockEditor mock={spec.mock} example={tpl.example.mock} onChange={(mock) => setSpec({ mock })} />
            <p className="mt-3 text-[11px] text-ink/40">Fictional businesses only. Numbers on mock UI carry a Sample data tag.</p>
          </Panel>

          <CaptionPanel draft={draft} set={set} />

          <Panel label="Workflow" bodyClass="p-3.5 space-y-3">
            <Field label="Pillar"><Select value={draft.pillar || ""} onChange={(v) => set({ pillar: v })} placeholder="—" options={PILLARS.map((p) => ({ value: p.key, label: p.label }))} /></Field>
            <Field label="Folder">
              <input list="social-folders" value={draft.folder || ""} onChange={(e) => set({ folder: e.target.value })} className={inputCls} placeholder="e.g. Week of 2026-11-09" />
              <datalist id="social-folders">{folders.map((f) => <option key={f} value={f} />)}</datalist>
            </Field>
            <Field label="Platforms">
              <div className="flex flex-wrap gap-1.5">
                {PLATFORMS.map((p) => {
                  const on = (draft.platforms || []).includes(p.key);
                  return (
                    <button key={p.key} type="button" onClick={() => set((d) => ({ platforms: on ? (d.platforms || []).filter((x) => x !== p.key) : [...(d.platforms || []), p.key] }))}
                      className={`border px-2.5 py-1 text-[12px] ${on ? "border-ink bg-ink text-white" : "border-hair text-ink/55 hover:border-ink/40"}`}>{p.label}</button>
                  );
                })}
              </div>
            </Field>
            <Field label="Notes"><TextArea rows={2} value={draft.notes} onChange={(v) => set({ notes: v })} /></Field>
            <div className="flex flex-wrap items-center gap-2 border-t border-hair pt-3">
              {server.image_url && <a href={server.image_url} target="_blank" rel="noreferrer" className="text-[12px] text-[#ff3c00] hover:underline">View publishing image (JPEG)</a>}
              <Btn variant="ghost" className="ml-auto" onClick={() => setConfirmDelete(true)}><Trash2 className="h-3.5 w-3.5" />Delete</Btn>
            </div>
            {postQ.data.generation_batch && <p className="mono-label text-[9px] text-ink/40">Batch {postQ.data.generation_batch} · by {postQ.data.generated_by || "justin"}{postQ.data.planned_for ? ` · planned ${postQ.data.planned_for}` : ""}</p>}
          </Panel>
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this post?"
        description="This removes the post and its revision history."
        confirmLabel="Delete"
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          await deletePost(id);
          qc.invalidateQueries({ queryKey: POSTS_KEY });
          navigate("/social");
        }}
      />
    </div>
  );
}

/* ─── Edit with AI + variations ─────────────────────────────────────── */
function AiPanel({ template, spec, onApply }) {
  const [instruction, setInstruction] = useState("");
  const [busy, setBusy] = useState(null); // "edit" | "vars"
  const [proposal, setProposal] = useState(null); // { spec, note, instruction }
  const [vars, setVars] = useState([]);
  const diff = useMemo(() => (proposal ? specDiff(spec, proposal.spec) : []), [proposal, spec]);

  const runEdit = async () => {
    const text = instruction.trim();
    if (!text) return;
    setBusy("edit");
    try {
      const res = await editSpecWithAi({ template, spec, instruction: text });
      setProposal({ ...res, instruction: text });
    } catch (e) {
      toast({ title: "AI edit failed", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const runVars = async () => {
    setBusy("vars");
    try {
      setVars(await generateVariations({ template, spec }));
    } catch (e) {
      toast({ title: "Couldn't generate variations", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Panel label="Claude" title="Edit with AI" right={<Wand2 className="h-4 w-4 text-[#ff3c00]" />} bodyClass="p-3.5 space-y-3">
      <div className="flex gap-2">
        <textarea
          rows={2}
          value={instruction}
          onChange={(e) => setInstruction(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) runEdit(); }}
          placeholder="Make the headline punchier, keep the rest"
          className={`${inputCls} flex-1 resize-none`}
        />
        <div className="flex flex-col gap-1.5">
          <Btn variant="flame" onClick={runEdit} disabled={!instruction.trim() || !!busy}>{busy === "edit" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Edit</Btn>
          <Btn onClick={runVars} disabled={!!busy} title="3 alternative headlines/hooks">{busy === "vars" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shuffle className="h-3.5 w-3.5" />}Variations</Btn>
        </div>
      </div>

      {proposal && (
        <div className="border border-[#ff3c00]/40 bg-[#ff3c00]/[0.03] p-3">
          <div className="flex items-start gap-3">
            <div className="w-40 shrink-0 border border-hair"><ScaledPost template={template} spec={proposal.spec} /></div>
            <div className="min-w-0 flex-1">
              <p className="mono-label text-[9px] text-[#ff3c00]">Proposed change</p>
              {proposal.note && <p className="mt-1 text-[12.5px] text-ink/70">{proposal.note}</p>}
              {diff.length === 0 ? (
                <p className="mt-2 text-[12px] text-ink/50">No changes.</p>
              ) : (
                <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto">
                  {diff.map((d) => (
                    <li key={d.path} className="text-[12px] leading-snug">
                      <span className="mono-label text-[8.5px] text-ink/45">{d.path}</span>
                      {d.before !== undefined && d.before !== "" && <p className="text-ink/45 line-through">{String(d.before)}</p>}
                      <p className="text-ink">{d.after === undefined ? <em className="text-ink/40">removed</em> : String(d.after)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <Btn onClick={() => setProposal(null)}>Discard</Btn>
            <Btn variant="flame" disabled={!diff.length} onClick={() => { onApply(proposal.spec, proposal.instruction); setProposal(null); setInstruction(""); }}><Check className="h-3.5 w-3.5" />Apply</Btn>
          </div>
        </div>
      )}

      {vars.length > 0 && (
        <div className="space-y-2">
          <p className="mono-label text-[9px] text-ink/45">Variations</p>
          {vars.map((v, i) => (
            <div key={i} className="flex items-start gap-3 border border-hair bg-paper/60 p-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-semibold leading-snug tracking-[-0.02em]">{v.headline}</p>
                {v.subhead && <p className="mt-0.5 text-[12px] text-ink/55">{v.subhead}</p>}
                {v.angle && <p className="mono-label mt-1 text-[8.5px] text-ink/40">{v.angle}</p>}
              </div>
              <Btn onClick={() => { onApply({ ...spec, headline: v.headline, accent_word: v.accent_word, ...(v.subhead ? { subhead: v.subhead } : {}) }, `Variation ${i + 1}${v.angle ? `: ${v.angle}` : ""}`); setVars([]); }}>Use</Btn>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function HistoryPanel({ history, onRestore }) {
  if (!history.length) return null;
  return (
    <Panel label="Revision history" title={`${history.length} change${history.length === 1 ? "" : "s"}`} right={<History className="h-4 w-4 text-ink/35" />}>
      <ul className="divide-y divide-hair">
        {history.map((h, i) => ({ h, i })).reverse().map(({ h, i }) => (
          <li key={i} className="flex items-center gap-3 px-3.5 py-2">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-medium">{h.instruction || "Edit"}</p>
              <p className="font-mono text-[10px] text-ink/45">{h.at ? new Date(h.at).toLocaleString() : ""}</p>
            </div>
            <Btn variant="ghost" onClick={() => onRestore(i)} title="Restore the version from before this change">Restore before</Btn>
          </li>
        ))}
      </ul>
    </Panel>
  );
}

/* ─── Captions ──────────────────────────────────────────────────────── */
function CopyBtn({ active, text, label, onCopy }) {
  return (
    <button type="button" onClick={onCopy} disabled={!text} className="inline-flex items-center gap-1 border border-hair px-2 py-1 text-[11px] text-ink/65 hover:border-[#ff3c00] hover:text-[#ff3c00] disabled:opacity-40">
      {active ? <Check className="h-3 w-3 text-[#ff3c00]" /> : <Copy className="h-3 w-3" />}{label}
    </button>
  );
}

function CaptionPanel({ draft, set }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState("");
  const copy = async (key, text) => {
    if (await copyText(text)) { setCopied(key); setTimeout(() => setCopied(""), 1400); }
  };
  const write = async () => {
    setBusy(true);
    try {
      set(await writeCaptions({ template: draft.template, spec: draft.spec, pillar: draft.pillar }));
    } catch (e) {
      toast({ title: "Couldn't write captions", description: String(e?.message || e), variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };
  const main = draft.caption || "";
  const li = draft.caption_linkedin || "";
  const btn = (k, text, label) => <CopyBtn key={k} active={copied === k} text={text} label={label} onCopy={() => copy(k, text)} />;
  return (
    <Panel label="Captions" right={<Btn variant="ghost" onClick={write} disabled={busy}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Write with AI</Btn>} bodyClass="p-3.5 space-y-3">
      <Field label="Caption" hint={`${main.length} chars${main.length > 280 ? " · trim for X" : ""}`}>
        <TextArea rows={6} value={main} onChange={(v) => set({ caption: v })} />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        {btn("ig", main, "Instagram")}
        {btn("fb", main, "Facebook")}
        {btn("x", main, "X")}
        {btn("tt", main, "TikTok")}
      </div>
      <Field label="LinkedIn caption" hint={`${li.length} chars`}>
        <TextArea rows={6} value={li} onChange={(v) => set({ caption_linkedin: v })} />
      </Field>
      <div className="flex flex-wrap gap-1.5">
        {btn("li", li || main, "LinkedIn")}
        {btn("alt", draft.alt_text, "Alt text")}
      </div>
      <Field label="Alt text"><TextArea rows={2} value={draft.alt_text} onChange={(v) => set({ alt_text: v })} /></Field>
    </Panel>
  );
}
