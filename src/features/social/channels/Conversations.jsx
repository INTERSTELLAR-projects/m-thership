import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, ExternalLink, Loader2, Save, Sparkles, Trash2, Undo2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { Btn, Field, Select, TextInput, copyText, inputCls } from "../ui";
import { CONVERSATION_KINDS, LINKS } from "./channels";
import { draftConversation } from "./channelAi";
import { CONV_KEY, conv, useConversations } from "./data";

const ACCOUNTS = [{ value: "linkedin_personal", label: "Justin (personal)" }, { value: "linkedin_company", label: "Interstellar Business OS (company)" }];
const kindLabel = (k) => CONVERSATION_KINDS.find((x) => x.key === k)?.label || k;

/** LinkedIn message drafter. Copy-only: the app never sends anything and stores only what Justin typed. */
export default function Conversations() {
  const qc = useQueryClient();
  const q = useConversations();
  const [f, setF] = useState({ account: "linkedin_personal", kind: "connection_request", person_label: "", context: "", goal: "" });
  const [out, setOut] = useState(null); // { draft, alternatives }
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("draft");
  const k = CONVERSATION_KINDS.find((x) => x.key === f.kind);
  const set = (patch) => setF((x) => ({ ...x, ...patch }));
  const refresh = () => qc.invalidateQueries({ queryKey: CONV_KEY });

  const draft = async () => {
    setBusy(true);
    try { setOut(await draftConversation({ account: f.account, kind: f.kind, person: f.person_label, context: f.context, goal: f.goal })); }
    catch (e) { toast({ title: "Couldn't draft", description: String(e?.message || e), variant: "destructive" }); }
    finally { setBusy(false); }
  };
  const save = async () => {
    await conv.create({ ...f, draft: out?.draft || "", status: "draft" });
    toast({ title: "Saved to drafts" });
    setOut(null);
    set({ person_label: "", context: "", goal: "" });
    refresh();
  };
  const list = (q.data || []).filter((c) => (c.status || "draft") === filter);

  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
      <section className="border border-hair bg-card">
        <header className="border-b border-hair px-4 py-3">
          <p className="mono-label text-[9px] text-ink/45">LinkedIn</p>
          <h3 className="text-[20px] font-semibold tracking-[-0.04em]">Conversation <span className="text-[#ff3c00]">/drafter</span></h3>
          <p className="mt-1 text-[11.5px] leading-snug text-ink/50">Paste or dictate the context. Claude drafts; you copy and send it yourself. Only what you type here is saved.</p>
        </header>
        <div className="space-y-3 px-4 py-3.5">
          <div className="grid grid-cols-2 gap-2">
            <Field label="From"><Select value={f.account} onChange={(v) => set({ account: v })} options={ACCOUNTS} /></Field>
            <Field label="Type"><Select value={f.kind} onChange={(v) => set({ kind: v })} options={CONVERSATION_KINDS.map((x) => ({ value: x.key, label: x.label }))} /></Field>
          </div>
          <Field label="Who" hint="name or role, as you'd like it"><TextInput value={f.person_label} onChange={(v) => set({ person_label: v })} placeholder="e.g. owner of a roofing company in Salem" /></Field>
          <Field label="Context"><textarea rows={5} value={f.context} onChange={(e) => set({ context: e.target.value })} placeholder="How you know them, what they said or posted, the comment/DM you're replying to…" className={`${inputCls} resize-y`} /></Field>
          <Field label="Goal" hint="optional"><TextInput value={f.goal} onChange={(v) => set({ goal: v })} placeholder="e.g. get a 15-minute call, just say thanks" /></Field>
          {k?.hint && <p className="text-[11px] text-ink/45">{k.hint}</p>}
          <Btn variant="flame" className="w-full" onClick={draft} disabled={busy || !f.context.trim()}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Draft message</Btn>

          {out && (
            <div className="space-y-2 border border-[#ff3c00]/40 bg-[#ff3c00]/[0.03] p-3">
              <textarea rows={6} value={out.draft} onChange={(e) => setOut({ ...out, draft: e.target.value })} className={`${inputCls} resize-y`} />
              <p className={`font-mono text-[10px] ${out.draft.length > (k?.limit || 9999) ? "text-[#b42318]" : "text-ink/45"}`}>{out.draft.length} / {k?.limit} chars</p>
              {out.alternatives?.map((a, i) => (
                <button key={i} type="button" onClick={() => setOut({ ...out, draft: a })} className="block w-full border border-hair bg-paper px-2.5 py-2 text-left text-[12px] leading-snug text-ink/70 hover:border-[#ff3c00]">{a}</button>
              ))}
              <div className="flex gap-2">
                <CopyBtn text={out.draft} />
                <Btn onClick={save}><Save className="h-3.5 w-3.5" />Save draft</Btn>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="border border-hair bg-card">
        <header className="flex items-center gap-1 border-b border-hair px-4 pt-2">
          {[["draft", "Drafts"], ["sent", "Sent"]].map(([key, l]) => (
            <button key={key} type="button" onClick={() => setFilter(key)} className={`-mb-px border-b-2 px-3 pb-2 pt-1 text-[13px] ${filter === key ? "border-[#ff3c00] font-semibold" : "border-transparent text-ink/50"}`}>{l} <span className="font-mono text-[10px] text-ink/40">{(q.data || []).filter((c) => (c.status || "draft") === key).length}</span></button>
          ))}
          <a href={LINKS.linkedin_personal_feed.replace("feed/", "messaging/")} target="_blank" rel="noreferrer" className="mb-1.5 ml-auto inline-flex items-center gap-1 text-[12px] text-ink/55 hover:text-[#ff3c00]"><ExternalLink className="h-3 w-3" />LinkedIn messages</a>
        </header>
        <div className="divide-y divide-hair">
          {list.length === 0 && <p className="px-4 py-10 text-center text-[12.5px] text-ink/45">{filter === "draft" ? "No saved drafts." : "Nothing marked sent yet."}</p>}
          {list.map((c) => (
            <div key={c.id} className="space-y-1.5 px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="mono-label border border-hair px-1.5 py-0.5 text-[8.5px] text-ink/60">{kindLabel(c.kind)}</span>
                <span className="text-[13px] font-medium">{c.person_label || "Someone"}</span>
                <span className="font-mono text-[10px] text-ink/40">{c.account === "linkedin_company" ? "company" : "personal"} · {new Date(c.sent_at || c.created_date).toLocaleDateString()}</span>
              </div>
              <p className="whitespace-pre-wrap text-[12.5px] leading-snug text-ink/75">{c.draft}</p>
              <div className="flex flex-wrap gap-1.5">
                <CopyBtn text={c.draft} />
                {c.status !== "sent"
                  ? <Btn onClick={async () => { await conv.update(c.id, { status: "sent", sent_at: new Date().toISOString() }); refresh(); }}><Check className="h-3.5 w-3.5" />Mark sent</Btn>
                  : <Btn variant="ghost" onClick={async () => { await conv.update(c.id, { status: "draft", sent_at: null }); refresh(); }}><Undo2 className="h-3.5 w-3.5" />Back to draft</Btn>}
                <Btn variant="ghost" className="ml-auto" onClick={async () => { await conv.remove(c.id); refresh(); }} title="Delete (removes what you typed)"><Trash2 className="h-3.5 w-3.5" /></Btn>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function CopyBtn({ text }) {
  const [done, setDone] = useState(false);
  return <Btn variant="ink" onClick={async () => { if (await copyText(text)) { setDone(true); setTimeout(() => setDone(false), 1400); } }}>{done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{done ? "Copied" : "Copy"}</Btn>;
}
