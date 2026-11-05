// "Build a track from your SOPs" + "Start from a role template". Drafting stays inside the picked sources: anything
// the SOPs don't cover comes back as a flagged gap for the owner, never as an invented step.
import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, Check, ClipboardPaste, FileText, Loader2, Sparkles, Wand2 } from "lucide-react";
import { Button, Field, Modal, Notice, inputCls } from "./ui";
import { errCode, errText } from "./api";

export function BuildFromSopsDialog({ open, onClose, call, portal, templates, onBuilt, preset }) {
  const [sources, setSources] = useState(null);
  const [picked, setPicked] = useState(() => new Set());
  const [paste, setPaste] = useState({ title: "", text: "" });
  const [showPaste, setShowPaste] = useState(false);
  const [role, setRole] = useState("");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [loadErr, setLoadErr] = useState("");

  useEffect(() => {
    if (!open) return;
    setErr(""); setBusy(false);
    setRole(preset?.template_key || "");
    setTitle(preset?.title || "");
    setPicked(new Set(preset?.source_ids || []));
    call("sources").then((r) => setSources(r.sources || [])).catch((e) => { setSources([]); setLoadErr(errText(e)); });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const g = new Map();
    for (const s of sources || []) g.set(s.group, [...(g.get(s.group) || []), s]);
    return [...g.entries()];
  }, [sources]);
  const toggle = (id) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const hasPaste = paste.text.trim().length > 40;
  const canGo = (picked.size > 0 || hasPaste) && !busy;

  const go = async () => {
    setBusy(true); setErr("");
    try {
      const tpl = templates?.find((t) => t.key === role);
      const r = await call("draft", { source_ids: [...picked], pasted: hasPaste ? paste : null, template_key: tpl ? tpl.key : "", role: tpl ? tpl.key : "custom", role_label: tpl ? tpl.label : "", title, notes, track_id: preset?.track_id || "" });
      onBuilt(r);
    } catch (e) {
      const code = errCode(e);
      setErr(code === "out_of_fuel" || code === "insufficient_fuel" ? `${errText(e)} You can Refuel from the Studios menu.` : errText(e));
    } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={busy ? () => {} : onClose} wide kicker="Build from your SOPs" title={preset?.track_id ? "Rebuild this track from SOPs" : "Build a track from your SOPs"}
      footer={<>
        <p className="mr-auto max-w-[420px] text-[11.5px] leading-snug text-ink/50">{portal ? "Lessons, tasks and quiz questions come only from what you pick. Anything missing is flagged for you to fill in." : "AI drafts from the picked sources only (ai-gateway, Sonnet, metered against this client's Fuel). Every step must quote its source; untraceable items are dropped and gaps are flagged."}</p>
        <Button kind="quiet" onClick={onClose} disabled={busy}>Cancel</Button>
        <Button kind="flame" icon={portal ? Wand2 : Sparkles} busy={busy} disabled={!canGo} onClick={go}>{busy ? "Drafting…" : "Draft the track"}</Button>
      </>}>
      {busy ? (
        <div className="flex flex-col items-center py-14 text-center" data-drafting>
          <span className="flame-bg flex h-14 w-14 items-center justify-center text-white"><Loader2 className="h-6 w-6 animate-spin" /></span>
          <p className="mt-5 text-[17px] font-semibold tracking-[-0.02em]">Drafting modules from {picked.size + (hasPaste ? 1 : 0)} source{picked.size + (hasPaste ? 1 : 0) === 1 ? "" : "s"}…</p>
          <p className="mt-1 max-w-sm text-[13px] text-ink/55">Lessons, hands-on tasks and quiz questions, each checked against the SOP text. This takes about a minute.</p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="mono-label text-[9.5px] text-ink/55">1 · Pick the SOPs and documents to teach from</p>
            {sources == null ? (
              <p className="mt-3 flex items-center gap-2 text-[13px] text-ink/50"><Loader2 className="h-4 w-4 animate-spin" />Loading your SOPs…</p>
            ) : !sources.length ? (
              <Notice className="mt-3">{loadErr || (portal ? "No SOPs are shared to your portal yet. Paste a process below, or ask us to add your SOPs." : "No SOPs found for this scope. Paste a process below.")}</Notice>
            ) : (
              <div className="mt-2 max-h-[340px] space-y-4 overflow-y-auto pr-1">
                {groups.map(([g, items]) => (
                  <div key={g}>
                    <p className="text-[11.5px] font-semibold text-ink/60">{g}</p>
                    <ul className="mt-1.5 space-y-1.5">
                      {items.map((s) => {
                        const on = picked.has(s.id);
                        return (
                          <li key={s.id}>
                            <button type="button" onClick={() => toggle(s.id)} aria-pressed={on} className={`flex w-full items-start gap-2.5 border px-3 py-2.5 text-left transition-colors ${on ? "border-[#ff3c00] bg-[#ff3c00]/[0.05]" : "border-hair bg-card hover:border-ink/30"}`}>
                              <span className={`mt-0.5 flex h-4.5 h-[18px] w-[18px] shrink-0 items-center justify-center border ${on ? "border-[#ff3c00] bg-[#ff3c00] text-white" : "border-ink/30 bg-white"}`}>{on && <Check className="h-3 w-3" />}</span>
                              {s.type === "sop" ? <BookOpenCheck className="mt-0.5 h-4 w-4 shrink-0 text-ink/45" /> : <FileText className="mt-0.5 h-4 w-4 shrink-0 text-ink/45" />}
                              <span className="min-w-0 flex-1">
                                <span className="block text-[13px] font-medium leading-snug">{s.title}</span>
                                <span className="block truncate text-[11.5px] text-ink/50">{s.detail}</span>
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
            <button type="button" onClick={() => setShowPaste((x) => !x)} className="mt-3 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#ff3c00] hover:underline"><ClipboardPaste className="h-3.5 w-3.5" />{showPaste ? "Hide pasted process" : "Paste a process instead"}</button>
            {showPaste && (
              <div className="mt-2 space-y-2">
                <input value={paste.title} onChange={(e) => setPaste((s) => ({ ...s, title: e.target.value }))} placeholder="Name it, e.g. Opening checklist" className={inputCls} />
                <textarea value={paste.text} onChange={(e) => setPaste((s) => ({ ...s, text: e.target.value }))} rows={6} placeholder="Paste the steps exactly as your team does them." className={`${inputCls} resize-y`} />
              </div>
            )}
          </div>
          <div className="space-y-4">
            <p className="mono-label text-[9.5px] text-ink/55">2 · Who is this for?</p>
            <Field label="Role template (optional structure)" hint="The template sets the module order. Modules your SOPs don't cover come back flagged “needs SOPs”.">
              <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
                <option value="">No template: follow the SOPs</option>
                {(templates || []).map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Track title (optional)"><input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} placeholder="e.g. Crew member onboarding" /></Field>
            <Field label="Notes for the draft (optional)" hint="Focus, audience, what to skip. Notes never add steps."><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={`${inputCls} resize-none`} placeholder="New hires are bilingual; keep it short." /></Field>
            {preset?.track_id && <Notice tone="warn">Rebuilding replaces this track&apos;s current modules.</Notice>}
            {err && <Notice tone="error">{err}</Notice>}
          </div>
        </div>
      )}
    </Modal>
  );
}

export function TemplateDialog({ open, onClose, templates, call, onBuilt }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  const make = async (t) => {
    setBusy(t.key); setErr("");
    try { const r = await call("from_template", { template_key: t.key }); onBuilt(r); } catch (e) { setErr(errText(e)); } finally { setBusy(""); }
  };
  return (
    <Modal open={open} onClose={onClose} wide kicker="Role templates" title="Start from a role template">
      <p className="text-[13px] text-ink/60">Each template is an outline of modules for the role. Every module is marked <span className="font-medium text-ink">needs SOPs</span> until your own process fills it, so nothing in it is made up.</p>
      <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
        {(templates || []).map((t) => (
          <button key={t.key} type="button" onClick={() => make(t)} disabled={!!busy} className="flex flex-col items-start border border-hair bg-card p-4 text-left transition-colors hover:border-[#ff3c00] disabled:opacity-60">
            <span className="flex w-full items-center gap-2 text-[15px] font-semibold tracking-[-0.02em]">{t.label}{busy === t.key && <Loader2 className="ml-auto h-4 w-4 animate-spin" />}</span>
            <span className="mt-1 text-[12.5px] leading-snug text-ink/55">{t.description}</span>
          </button>
        ))}
      </div>
      {err && <Notice tone="error" className="mt-3">{err}</Notice>}
    </Modal>
  );
}
