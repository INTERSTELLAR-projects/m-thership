// Legal › Terms of Service: edit a draft, preview it exactly as clients see it, publish it as the one active version
// (publishing retires the previous one and re-prompts every portal login). docs/portal-terms.md.
import { useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Copy, Eye, FilePlus2, Loader2, Pencil, Rocket, ScrollText } from "lucide-react";
import { terms, useTermsVersions, fmtWhen } from "./termsApi";
import TermsGate from "./TermsGate";

const STATUS_TONE = { draft: "bg-amber-100 text-amber-800", active: "bg-green-100 text-green-800", retired: "bg-ink/[0.07] text-ink/55" };
const input = "w-full border border-hair bg-white px-3 text-[13px] outline-none focus:border-[#ff3c00]";

function Chip({ status }) {
  return <span className={`rounded-sm px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-[0.08em] ${STATUS_TONE[status] || STATUS_TONE.draft}`}>{status}</span>;
}

export default function TermsAdmin() {
  const qc = useQueryClient();
  const q = useTermsVersions();
  const versions = useMemo(() => q.data?.versions || [], [q.data]);
  const [selId, setSelId] = useState("");
  const sel = versions.find((v) => v.id === selId) || versions.find((v) => v.status === "draft") || versions.find((v) => v.status === "active") || versions[0] || null;
  const [form, setForm] = useState(null);
  const [mode, setMode] = useState("edit");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState(null);
  const [reviewed, setReviewed] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!sel) { setForm(null); return; }
    setForm({ version: sel.version || "", title: sel.title || "", effective_date: sel.effective_date || "", change_note: sel.change_note || "", summary: (sel.summary_points || []).join("\n"), body_markdown: sel.body_markdown || "" });
    setReviewed(false); setConfirming(false);
  }, [sel?.id, sel?.updated_date]); // eslint-disable-line react-hooks/exhaustive-deps

  const refresh = () => qc.invalidateQueries({ queryKey: ["terms"] });
  const run = async (label, fn) => {
    setBusy(label); setMsg(null);
    try { const r = await fn(); refresh(); return r; } catch (e) { setMsg({ ok: false, text: e.message }); return null; } finally { setBusy(""); }
  };
  const editable = sel?.status === "draft";
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const save = () => run("save", async () => {
    const r = await terms("save_draft", { id: sel.id, version: form.version, title: form.title, effective_date: form.effective_date, change_note: form.change_note, summary_points: form.summary.split("\n"), body_markdown: form.body_markdown });
    setMsg({ ok: true, text: "Draft saved. Fingerprint updated." });
    return r;
  });
  const publish = () => run("publish", async () => {
    const r = await terms("publish", { id: sel.id, lawyer_reviewed: reviewed });
    setMsg({ ok: true, text: `Version ${r.version.version} is active. Every portal login will be asked to accept it.` });
    setConfirming(false);
    return r;
  });
  const seed = () => run("seed", async () => { const r = await terms("seed_draft_v1"); setSelId(r.version.id); return r; });
  const copyToDraft = () => run("copy", async () => { const r = await terms("new_draft_from", { id: sel.id }); setSelId(r.version.id); setMode("edit"); return r; });

  const previewGate = form && sel ? { terms: { id: sel.id, version: form.version, title: form.title, body_markdown: form.body_markdown, summary_points: form.summary.split("\n").filter(Boolean), change_note: form.change_note, sha256: sel.sha256 }, client: { business: "Client preview" }, previous_version: versions.some((v) => v.status === "active" && v.id !== sel.id) ? (versions.find((v) => v.status === "active") || {}).version : "" } : null;

  return (
    <section className="border border-hair bg-paper/80" aria-label="Terms of Service" data-testid="terms-admin">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-hair px-4 py-3 md:px-6">
        <h2 className="flex items-center gap-2 text-[16px] font-semibold tracking-[-0.01em]"><ScrollText className="h-4 w-4 text-[#ff3c00]" />Client Terms of Service</h2>
        <span className="font-mono text-[10px] uppercase tracking-[0.12em] text-ink/45">Portal gate · one active version</span>
      </header>

      {q.isLoading ? <p className="px-6 py-6 text-[13px] text-ink/50">Loading…</p> : q.isError ? <p className="px-6 py-6 text-[13px] text-red-700">Couldn&apos;t load terms: {String(q.error?.message || q.error)}</p> : !versions.length ? (
        <div className="px-6 py-8">
          <p className="text-[13.5px] text-ink/65">No terms yet. Start from the v1 draft (plain-English first draft with your 30-day notice and $750 migration terms).</p>
          <button type="button" onClick={seed} disabled={!!busy} className="mt-3 inline-flex h-10 items-center gap-2 bg-ink px-4 text-[13px] text-white hover:bg-[#ff3c00]">{busy === "seed" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}Create draft v1</button>
        </div>
      ) : (
        <div className="grid gap-0 lg:grid-cols-[240px,1fr]">
          <aside className="border-b border-hair lg:border-b-0 lg:border-r">
            <ul className="divide-y divide-hair">
              {versions.map((v) => (
                <li key={v.id}>
                  <button type="button" onClick={() => { setSelId(v.id); setMode("edit"); }} className={`flex w-full flex-col items-start gap-1 px-4 py-3 text-left hover:bg-[#ff3c00]/[0.04] ${sel?.id === v.id ? "bg-white" : ""}`}>
                    <span className="flex w-full items-center justify-between gap-2"><span className="font-mono text-[12.5px] font-medium">{v.test_only ? "[TEST] " : ""}v{v.version}</span><Chip status={v.status} /></span>
                    <span className="text-[11.5px] text-ink/50">{v.status === "active" ? `Live since ${fmtWhen(v.published_at)}` : v.status === "retired" ? `Retired ${fmtWhen(v.retired_at)}` : "Not live"} · {v.acceptances || 0} signed</span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>

          {sel && form && (
            <div className="min-w-0 p-4 md:p-6">
              {editable && (
                <p className="mb-4 flex items-start gap-2 border border-amber-500/50 bg-amber-50 px-3.5 py-2.5 text-[13px] font-medium text-amber-900" role="note" data-testid="lawyer-note">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Draft, have a lawyer review before activating.
                </p>
              )}
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <div className="seg-ms flex" role="tablist" aria-label="Edit or preview">
                  <button type="button" role="tab" aria-selected={mode === "edit"} onClick={() => setMode("edit")} className={mode === "edit" ? "on" : ""}><Pencil className="mr-1 inline h-3 w-3" />{editable ? "Edit" : "Read"}</button>
                  <button type="button" role="tab" aria-selected={mode === "preview"} onClick={() => setMode("preview")} className={mode === "preview" ? "on" : ""}><Eye className="mr-1 inline h-3 w-3" />Preview as client</button>
                </div>
                <span className="ml-auto font-mono text-[10px] text-ink/40" title={sel.sha256}>fingerprint {String(sel.sha256 || "").slice(0, 12)}…</span>
                {!editable && <button type="button" onClick={copyToDraft} disabled={!!busy} className="inline-flex h-9 items-center gap-1.5 border border-hair bg-white px-3 text-[12.5px] hover:border-ink">{busy === "copy" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" />}New draft from this</button>}
              </div>

              {mode === "preview" && previewGate ? (
                <div className="relative h-[720px] overflow-hidden border border-hair" data-testid="terms-preview">
                  <div className="absolute inset-0 [transform:translateZ(0)]"><TermsGate gate={previewGate} preview /></div>
                </div>
              ) : (
                <fieldset disabled={!editable || !!busy} className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Version label</span><input className={`${input} mt-1 h-10 font-mono`} value={form.version} onChange={set("version")} /></label>
                    <label className="block sm:col-span-2"><span className="mono-label text-[9.5px] text-ink/50">Title</span><input className={`${input} mt-1 h-10`} value={form.title} onChange={set("title")} /></label>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Effective date</span><input type="date" className={`${input} mt-1 h-10`} value={form.effective_date} onChange={set("effective_date")} /></label>
                    <label className="block sm:col-span-2"><span className="mono-label text-[9.5px] text-ink/50">What changed (shown to people who signed an older version)</span><input className={`${input} mt-1 h-10`} value={form.change_note} onChange={set("change_note")} /></label>
                  </div>
                  <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Summary points (one per line, shown first)</span><textarea rows={6} className={`${input} mt-1 py-2`} value={form.summary} onChange={set("summary")} /></label>
                  <label className="block"><span className="mono-label text-[9.5px] text-ink/50">Full terms (markdown) · this exact text is fingerprinted</span><textarea rows={18} className={`${input} mt-1 py-2 font-mono text-[12px] leading-[1.55]`} value={form.body_markdown} onChange={set("body_markdown")} /></label>
                </fieldset>
              )}

              {msg && <p role="status" className={`mt-4 text-[13px] ${msg.ok ? "text-green-800" : "text-red-700"}`}>{msg.ok && <CheckCircle2 className="mr-1 inline h-3.5 w-3.5" />}{msg.text}</p>}

              {editable && (
                <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-hair pt-4">
                  <button type="button" onClick={save} disabled={!!busy} className="inline-flex h-10 items-center gap-1.5 bg-ink px-4 text-[13px] text-white hover:bg-[#ff3c00] disabled:opacity-50">{busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />}Save draft</button>
                  {!confirming ? (
                    <button type="button" onClick={() => setConfirming(true)} disabled={!!busy} className="inline-flex h-10 items-center gap-1.5 border border-[#ff3c00] px-4 text-[13px] text-[#c23000] hover:bg-[#ff3c00] hover:text-white"><Rocket className="h-4 w-4" />Publish as active…</button>
                  ) : (
                    <div className="w-full border border-[#ff3c00]/40 bg-[#ff3c00]/[0.04] p-3.5">
                      <p className="text-[13px] leading-[1.5] text-ink/80">Publishing makes v{form.version} the only active version, retires the current one, and every client login must accept it before their portal opens. Save first: the saved text is what gets published.</p>
                      <label className="mt-2.5 flex items-center gap-2 text-[13px]"><input type="checkbox" className="h-4 w-4 accent-[#ff3c00]" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />A lawyer reviewed this version.</label>
                      <div className="mt-3 flex gap-2">
                        <button type="button" onClick={publish} disabled={!reviewed || !!busy} className="inline-flex h-9 items-center gap-1.5 bg-[#ff3c00] px-3.5 text-[12.5px] text-white hover:bg-ink disabled:opacity-40">{busy === "publish" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Publish v{form.version}</button>
                        <button type="button" onClick={() => setConfirming(false)} className="h-9 px-3 text-[12.5px] text-ink/60 hover:text-ink">Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
