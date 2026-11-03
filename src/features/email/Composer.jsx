import { useMemo, useState } from "react";
import { BookmarkPlus, FlaskConical, Loader2, Save, Send, Sparkles, Undo2, Wand2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import DictationBox from "@/features/voice/DictationBox";
import { MERGE_FIELDS, TEST_EMAIL } from "./emailBlocks";
import { composeEmail, reviseEmail } from "./ai";
import { docWarnings, kindFor, resolveAudience } from "./recipients";
import { createTemplate, saveDraft, sendEmail, sendTest } from "./store";
import BlockEditor from "./BlockEditor";
import PreviewPane from "./PreviewPane";
import RecipientPicker from "./RecipientPicker";
import SendDialog from "./SendDialog";
import { Btn, Field, Panel, Pill, PromptDialog, TextInput } from "./ui";

// The composer: dictate or type a direction -> AI writes typed blocks -> edit / reorder / revise -> live preview
// per recipient -> test to me -> confirm -> send (one email per recipient).
export default function Composer({ email, setEmail, data, onSaved }) {
  const { clients, subscribers, lists, portalUrl } = data;
  const [direction, setDirection] = useState(email.prompt || "");
  const [revision, setRevision] = useState("");
  const [busy, setBusy] = useState("");
  const [notes, setNotes] = useState([]);
  const [undo, setUndo] = useState(null);
  const [previewKey, setPreviewKey] = useState("template");
  const [sendOpen, setSendOpen] = useState(false);
  const [tplOpen, setTplOpen] = useState(false);

  const doc = useMemo(() => ({ subject: email.subject, blocks: email.blocks }), [email.subject, email.blocks]);
  const audience = email.audience || { mode: "clients", client_ids: [] };
  const kind = kindFor(audience.mode);
  const recipients = useMemo(() => resolveAudience(audience, { clients, subscribers, lists, portalUrl }), [audience, clients, subscribers, lists, portalUrl]);
  const live = recipients.filter((r) => r.email && !r.excluded);
  const warnings = docWarnings(doc);
  const patch = (p) => setEmail((e) => ({ ...e, ...p }));

  // Clients whose facts the AI may use: the chosen clients, or the clients on the chosen list.
  const aiClients = useMemo(() => {
    const ids = audience.mode === "clients" ? audience.client_ids || [] : audience.mode === "list" ? ((lists.find((l) => l.id === audience.list_id) || {}).client_ids || []) : [];
    return ids.map((id) => clients.find((c) => c.id === id)).filter(Boolean);
  }, [audience, clients, lists]);

  const runAi = async (mode) => {
    const text = (mode === "revise" ? revision : direction).trim();
    if (!text) return;
    setBusy(mode);
    try {
      const out = mode === "revise"
        ? await reviseEmail({ direction: text, doc, clients: aiClients, kind })
        : await composeEmail({ direction: text, clients: aiClients, kind });
      setUndo({ subject: email.subject, blocks: email.blocks });
      patch({ subject: out.subject || email.subject, blocks: out.blocks, prompt: mode === "revise" ? email.prompt : text });
      setNotes(out.notes || []);
      if (mode === "revise") setRevision("");
      if (aiClients.length === 1 && previewKey === "template") { const r = live.find((x) => x.client_id === aiClients[0].id); if (r) setPreviewKey(r.key); }
    } catch (e) {
      toast({ title: "The AI couldn't write that", description: e.message, variant: "destructive" });
    } finally { setBusy(""); }
  };

  const save = async (quiet = false) => {
    setBusy("save");
    try {
      const row = await saveDraft(email.status === "sent" ? null : email.id, { title: email.subject || "Untitled email", subject: email.subject, blocks: email.blocks, prompt: email.prompt || direction, audience, kind });
      patch({ id: row.id, status: "draft" });
      onSaved && onSaved();
      if (!quiet) toast({ title: "Draft saved" });
      return row.id;
    } catch (e) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
      return null;
    } finally { setBusy(""); }
  };

  const test = async () => {
    setBusy("test");
    try {
      const r = live.find((x) => x.key === previewKey) || live[0];
      const out = await sendTest({ subject: email.subject, blocks: email.blocks, vars: r ? r.vars : { portal_url: portalUrl }, kind });
      toast({ title: "Test sent", description: `Sent to ${out.to}${r ? ` with ${r.name || r.email}'s merge data` : ""}.` });
    } catch (e) {
      toast({ title: "Test failed", description: e.message, variant: "destructive" });
    } finally { setBusy(""); }
  };

  const send = async () => {
    const draftId = await save(true);
    const out = await sendEmail({ draftId, subject: email.subject, blocks: email.blocks, kind, recipients: live, audience });
    patch({ id: out.draft_id || draftId, status: "sent" });
    onSaved && onSaved();
    return out;
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      <div className="min-w-0 space-y-4">
        <Panel label="Step 1" title="Tell it what to write" right={undo && <Btn variant="ghost" className="h-7" onClick={() => { patch(undo); setUndo(null); }}><Undo2 className="h-3.5 w-3.5" /> Undo AI</Btn>} bodyClass="p-3.5 space-y-3">
          <DictationBox
            label="Direction (dictate or type)"
            value={direction}
            onChange={setDirection}
            rows={4}
            placeholder="e.g. Create an email using my company's template for Chasing Gains Coaching: the new site is live, we're starting the blog schedule next week, and we need their logo files."
          />
          <div className="flex flex-wrap items-center gap-2">
            <Btn variant="flame" disabled={!direction.trim() || !!busy} onClick={() => runAi("compose")}>
              {busy === "compose" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {email.blocks.length > 4 ? "Rewrite email" : "Write email"}
            </Btn>
            <span className="text-[11.5px] text-ink/45">
              {aiClients.length ? `Uses the client file${aiClients.length > 1 ? "s" : ""} for ${aiClients.slice(0, 3).map((c) => c.business).join(", ")}${aiClients.length > 3 ? "…" : ""} + Agency knowledge.` : "Pick clients below so it can use their real facts. Agency knowledge is always included."}
            </span>
          </div>
          {notes.length > 0 && (
            <div className="border border-amber-500/40 bg-amber-50 p-2.5 text-[12px] text-amber-900">
              <p className="mono-label mb-1 text-[8.5px]">The AI needs these facts (left as [placeholders])</p>
              <ul className="list-disc space-y-0.5 pl-4">{notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          )}
          {(email.subject.trim() || email.prompt) && (
            <div className="border-t border-hair pt-3">
              <DictationBox label="Revise (follow-up change)" value={revision} onChange={setRevision} rows={2} placeholder="e.g. Make it shorter, add a billing card with their plan, change the button to Book a call." />
              <Btn className="mt-2" disabled={!revision.trim() || !!busy} onClick={() => runAi("revise")}>
                {busy === "revise" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />} Revise
              </Btn>
            </div>
          )}
        </Panel>

        <Panel label="Step 2" title="Recipients" right={<Pill tone={kind === "mass" ? "flame" : "ink"}>{kind === "mass" ? "Mass · unsubscribe link" : "1:1 client email"}</Pill>} bodyClass="p-3.5">
          <RecipientPicker audience={audience} onAudience={(a) => patch({ audience: a })} clients={clients} subscribers={subscribers} lists={lists} recipients={recipients} doc={doc} />
        </Panel>

        <Panel label="Step 3" title="Edit the email" bodyClass="p-3.5 space-y-3">
          <Field label="Subject line" hint="No preheader. Merge fields work here too.">
            <TextInput value={email.subject} onChange={(v) => patch({ subject: v })} placeholder="Subject" />
          </Field>
          <div className="flex flex-wrap items-center gap-1">
            <span className="mono-label mr-1 text-[8.5px] text-ink/45">Merge fields (click to copy)</span>
            {MERGE_FIELDS.map((m) => (
              <button key={m.key} type="button" title={m.label} onClick={() => { navigator.clipboard && navigator.clipboard.writeText(`{{${m.key}}}`).catch(() => null); toast({ title: `Copied {{${m.key}}}` }); }} className="border border-hair bg-paper px-1.5 py-0.5 font-mono text-[10.5px] text-ink/65 hover:border-[#ff3c00] hover:text-[#ff3c00]">
                {`{{${m.key}}}`}
              </button>
            ))}
          </div>
          <BlockEditor blocks={email.blocks} onChange={(blocks) => patch({ blocks })} />
        </Panel>

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center gap-2 border border-hair bg-card/95 p-2.5 backdrop-blur">
          <Btn disabled={!!busy} onClick={() => save()}>{busy === "save" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save draft</Btn>
          <Btn disabled={!!busy} onClick={() => setTplOpen(true)}><BookmarkPlus className="h-3.5 w-3.5" /> Save as template</Btn>
          <Btn disabled={!!busy || !email.subject.trim()} title={`One test copy to ${TEST_EMAIL}`} onClick={test}>{busy === "test" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />} Send test to me</Btn>
          <Btn variant="flame" className="ml-auto" disabled={!!busy || !live.length || !email.subject.trim()} onClick={() => setSendOpen(true)}><Send className="h-3.5 w-3.5" /> Send to {live.length || "…"}</Btn>
        </div>
      </div>

      <div className="min-w-0">
        <div className="border border-hair bg-card xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
          <PreviewPane doc={doc} recipients={recipients} kind={kind} portalUrl={portalUrl} previewKey={previewKey} onPreviewKey={setPreviewKey} />
        </div>
      </div>

      <SendDialog open={sendOpen} onClose={() => setSendOpen(false)} doc={doc} recipients={live} kind={kind} warnings={warnings} onSend={send} />
      <PromptDialog
        open={tplOpen}
        title="Save as template"
        label="Template name"
        initial={email.subject ? email.subject.replace(/\{\{[^}]+\}\}/g, "").trim().slice(0, 60) : ""}
        onClose={() => setTplOpen(false)}
        onSubmit={async (name) => {
          try { await createTemplate({ name, subject: email.subject, blocks: email.blocks, description: `Saved from Email Studio${aiClients[0] ? ` (${aiClients[0].business})` : ""}` }); toast({ title: "Template saved" }); onSaved && onSaved(); }
          catch (e) { toast({ title: "Couldn't save the template", description: e.message, variant: "destructive" }); }
        }}
      />
    </div>
  );
}
