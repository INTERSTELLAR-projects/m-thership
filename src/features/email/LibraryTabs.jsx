import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Copy, PenLine, Plus, Trash2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { renderEmail } from "./emailBlocks";
import { parseAddresses } from "./recipients";
import { deleteDraft, deleteList, deleteTemplate, saveList } from "./store";
import { Btn, ConfirmDialog, Field, Panel, Pill, Select, TextArea, TextInput, fmtDate, inputCls } from "./ui";

/* ---------------- Drafts & Sent history ---------------- */

export function HistoryTab({ drafts, onOpen, onDuplicate, refresh, initialOpen = null }) {
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState(initialOpen);
  const [confirm, setConfirm] = useState(null);
  const rows = drafts.filter((d) => !filter || (filter === "sent" ? d.status === "sent" : d.status !== "sent"));
  return (
    <Panel label="Saved" title="Drafts & sent history" right={<Select value={filter} onChange={setFilter} placeholder="All" options={[{ value: "draft", label: "Drafts" }, { value: "sent", label: "Sent" }]} className="w-32" />}>
      {rows.length === 0 && <p className="p-6 text-center text-[12.5px] text-ink/45">Nothing saved yet. Drafts and every send land here.</p>}
      {rows.map((d) => {
        const results = d.results || [];
        const isOpen = open === d.id;
        return (
          <div key={d.id} className="border-b border-hair last:border-b-0">
            <div className="flex flex-wrap items-center gap-2 px-3.5 py-2.5">
              <button type="button" onClick={() => setOpen(isOpen ? null : d.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                {isOpen ? <ChevronDown className="h-3.5 w-3.5 shrink-0 text-ink/40" /> : <ChevronRight className="h-3.5 w-3.5 shrink-0 text-ink/40" />}
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium">{d.subject || d.title || "Untitled"}</span>
                  <span className="block text-[11.5px] text-ink/50">
                    {d.status === "sent" ? `Sent ${fmtDate(d.sent_at)} · ${d.sent_count || 0} sent${d.failed_count ? ` · ${d.failed_count} failed` : ""}${d.skipped_count ? ` · ${d.skipped_count} skipped` : ""}` : `Edited ${fmtDate(d.updated_date || d.created_date)}`}
                  </span>
                </span>
              </button>
              <Pill tone={d.status === "sent" ? "ink" : d.status === "failed" ? "warn" : "plain"}>{d.status || "draft"}</Pill>
              {d.kind && <Pill tone={d.kind === "mass" ? "flame" : "muted"}>{d.kind === "mass" ? "mass" : "1:1"}</Pill>}
              {d.status === "sent"
                ? <Btn className="h-8" onClick={() => onDuplicate(d)}><Copy className="h-3.5 w-3.5" /> Reuse</Btn>
                : <Btn className="h-8" onClick={() => onOpen(d)}><PenLine className="h-3.5 w-3.5" /> Open</Btn>}
              {d.status !== "sent" && <button type="button" title="Delete draft" onClick={() => setConfirm(d)} className="p-1 text-ink/35 hover:text-[#ff3c00]"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
            {isOpen && (
              <div className="grid gap-3 border-t border-hair bg-paper/50 p-3.5 lg:grid-cols-2">
                <div className="max-h-80 overflow-auto border border-hair bg-card">
                  {results.length === 0 ? <p className="p-3 text-[12px] text-ink/45">Not sent yet.</p> : results.map((r, i) => (
                    <div key={`${r.email}-${i}`} className="flex items-center gap-2 border-b border-hair px-2.5 py-1.5 text-[12px] last:border-b-0">
                      <span className="flex-1 truncate">{r.name && r.name !== r.email ? `${r.name} · ` : ""}{r.email}</span>
                      <Pill tone={r.status === "sent" ? "plain" : "warn"}>{r.status}</Pill>
                      {r.error && <span className="text-[11px] text-ink/45">{r.error}</span>}
                    </div>
                  ))}
                </div>
                <iframe title="Sent email" srcDoc={renderEmail(d, { vars: null })} sandbox="" className="h-80 w-full border border-hair bg-white" />
              </div>
            )}
          </div>
        );
      })}
      <ConfirmDialog open={!!confirm} title="Delete this draft?" body={confirm ? `"${confirm.subject || "Untitled"}" is deleted.` : ""} confirmLabel="Delete" danger onClose={() => setConfirm(null)} onConfirm={async () => { await deleteDraft(confirm.id); refresh(); }} />
    </Panel>
  );
}

/* ---------------- Templates ---------------- */

export function TemplatesTab({ templates, onUse, refresh }) {
  const [confirm, setConfirm] = useState(null);
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {templates.map((t) => (
        <div key={t.id} className="flex flex-col border border-hair bg-card">
          <div className="h-56 overflow-hidden border-b border-hair bg-[#ebe8e4]">
            <iframe title={t.name} srcDoc={renderEmail(t, { vars: null })} sandbox="" scrolling="no" className="pointer-events-none h-[1100px] w-[720px] origin-top-left scale-[0.5] border-0" />
          </div>
          <div className="flex flex-1 flex-col p-3.5">
            <div className="flex items-center gap-2">
              <h3 className="flex-1 text-[14px] font-semibold tracking-tight">{t.name}</h3>
              {t.seed_key ? <Pill tone="flame">house</Pill> : <Pill>{t.category || "saved"}</Pill>}
            </div>
            <p className="mt-1 flex-1 text-[12px] leading-snug text-ink/55">{t.description || t.subject}</p>
            <div className="mt-3 flex items-center gap-2">
              <Btn variant="flame" className="h-8" onClick={() => onUse(t)}><PenLine className="h-3.5 w-3.5" /> Use template</Btn>
              {!t.seed_key && <button type="button" title="Delete template" onClick={() => setConfirm(t)} className="ml-auto p-1 text-ink/35 hover:text-[#ff3c00]"><Trash2 className="h-3.5 w-3.5" /></button>}
            </div>
          </div>
        </div>
      ))}
      {templates.length === 0 && <p className="text-[12.5px] text-ink/45">Loading templates…</p>}
      <ConfirmDialog open={!!confirm} title="Delete this template?" body={confirm ? `"${confirm.name}" is deleted. Emails already sent are not affected.` : ""} confirmLabel="Delete" danger onClose={() => setConfirm(null)} onConfirm={async () => { await deleteTemplate(confirm.id); refresh(); }} />
    </div>
  );
}

/* ---------------- Saved lists ---------------- */

const EMPTY = { id: null, name: "", description: "", client_ids: [], subscriber_tag: "", emails_text: "" };

export function ListsTab({ lists, clients, subscribers, refresh }) {
  const [form, setForm] = useState(EMPTY);
  const [q, setQ] = useState("");
  const [confirm, setConfirm] = useState(null);
  const tags = useMemo(() => [...new Set(subscribers.flatMap((s) => s.tags || []))].sort(), [subscribers]);
  const chosen = new Set(form.client_ids);
  const shown = clients.filter((c) => !q || `${c.business} ${c.contact || ""}`.toLowerCase().includes(q.toLowerCase()));
  const save = async () => {
    try {
      await saveList(form.id, { name: form.name.trim(), description: form.description, client_ids: form.client_ids, subscriber_tag: form.subscriber_tag, emails: parseAddresses(form.emails_text) });
      toast({ title: form.id ? "List updated" : "List saved" });
      setForm(EMPTY);
      refresh();
    } catch (e) { toast({ title: "Couldn't save the list", description: e.message, variant: "destructive" }); }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
      <Panel label="Saved lists" title={`${lists.length} list${lists.length === 1 ? "" : "s"}`}>
        {lists.length === 0 && <p className="p-5 text-[12.5px] text-ink/45">No lists yet. Make one to send to the same group again, e.g. "Active HyperCare+ clients".</p>}
        {lists.map((l) => (
          <div key={l.id} className="flex items-center gap-2 border-b border-hair px-3.5 py-2.5 last:border-b-0">
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium">{l.name}</p>
              <p className="text-[11.5px] text-ink/50">{(l.client_ids || []).length} clients{l.subscriber_tag ? ` · subscribers tagged "${l.subscriber_tag}"` : ""}{(l.emails || []).length ? ` · ${(l.emails || []).length} addresses` : ""}</p>
            </div>
            <Btn className="h-8" onClick={() => setForm({ id: l.id, name: l.name || "", description: l.description || "", client_ids: l.client_ids || [], subscriber_tag: l.subscriber_tag || "", emails_text: (l.emails || []).join(", ") })}>Edit</Btn>
            <button type="button" title="Delete list" onClick={() => setConfirm(l)} className="p-1 text-ink/35 hover:text-[#ff3c00]"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
      </Panel>
      <Panel label={form.id ? "Edit list" : "New list"} title={form.name || "Untitled list"} right={form.id && <Btn variant="ghost" className="h-7" onClick={() => setForm(EMPTY)}><Plus className="h-3.5 w-3.5" /> New</Btn>} bodyClass="space-y-3 p-3.5">
        <Field label="Name"><TextInput value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="e.g. Active clients" /></Field>
        <Field label={`Clients · ${form.client_ids.length}`} hint={<button type="button" className="hover:text-[#ff3c00]" onClick={() => setForm({ ...form, client_ids: clients.filter((c) => c.status === "Active").map((c) => c.id) })}>Select all Active</button>}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients" className={`${inputCls} mb-1.5 h-9`} />
          <div className="max-h-48 overflow-auto border border-hair">
            {shown.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2 border-b border-hair px-2.5 py-1.5 text-[12.5px] last:border-b-0 hover:bg-paper">
                <input type="checkbox" className="accent-[#ff3c00]" checked={chosen.has(c.id)} onChange={() => setForm({ ...form, client_ids: chosen.has(c.id) ? form.client_ids.filter((x) => x !== c.id) : [...form.client_ids, c.id] })} />
                <span className="flex-1 truncate">{c.business}</span><Pill tone="muted">{c.status || "?"}</Pill>
              </label>
            ))}
          </div>
        </Field>
        <Field label="Plus subscribers with tag"><Select value={form.subscriber_tag} onChange={(v) => setForm({ ...form, subscriber_tag: v })} placeholder="No subscribers" options={tags} /></Field>
        <Field label="Plus these addresses"><TextArea rows={2} value={form.emails_text} onChange={(v) => setForm({ ...form, emails_text: v })} placeholder="name@example.com, …" /></Field>
        <Btn variant="flame" disabled={!form.name.trim()} onClick={save}>{form.id ? "Update list" : "Save list"}</Btn>
      </Panel>
      <ConfirmDialog open={!!confirm} title="Delete this list?" body={confirm ? `"${confirm.name}" is deleted. Clients and subscribers are not touched.` : ""} confirmLabel="Delete" danger onClose={() => setConfirm(null)} onConfirm={async () => { await deleteList(confirm.id); refresh(); }} />
    </div>
  );
}
