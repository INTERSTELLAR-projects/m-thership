// Contacts: search / filter, add one, import a CSV, per-contact activity.
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileUp, Loader2, Search, UserPlus, Users, MousePointerClick, Eye, MailX, Ban, Plus } from "lucide-react";
import ImportWizard from "./ImportWizard";
import { Badge, Btn, ConfirmBtn, Drawer, Empty, Label, Notice, Toggle, inputCls } from "./ui";
import { ago, errMsg, num } from "./api";

function AddContact({ open, onClose, data, call, onDone }) {
  const [f, setF] = useState({ email: "", first_name: "", last_name: "", phone: "", city: "", state: "", zip: "", birthday: "", tags: "" });
  const [lists, setLists] = useState([]);
  const [basis, setBasis] = useState("express");
  const [source, setSource] = useState("");
  const [auto, setAuto] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { if (open) { setLists(data.lists?.[0] ? [data.lists[0].id] : []); setErr(""); } }, [open, data.lists]);
  const save = async () => {
    setBusy(true); setErr("");
    try {
      await call("contact_save", { contact: { ...f, tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean) }, list_ids: lists, consent: { basis, source }, start_automations: auto });
      onDone(); onClose(); setF({ email: "", first_name: "", last_name: "", phone: "", city: "", state: "", zip: "", birthday: "", tags: "" }); setSource("");
    } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  const field = (k, l, ph, half = true) => <div className={half ? "" : "sm:col-span-2"}><Label>{l}</Label><input className={inputCls} value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} placeholder={ph} /></div>;
  return (
    <Drawer open={open} onClose={onClose} title="Add a contact" footer={<div className="flex justify-end gap-2"><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="flame" busy={busy} disabled={!f.email || !source.trim()} onClick={save}>Add contact</Btn></div>}>
      <div className="grid gap-3 sm:grid-cols-2">
        {field("email", "Email *", "name@example.com", false)}
        {field("first_name", "First name", "")}{field("last_name", "Last name", "")}
        {field("phone", "Phone", "")}{field("birthday", "Birthday", "MM/DD")}
        {field("city", "City", "")}{field("zip", "ZIP", "")}
        {field("tags", "Tags", "comma, separated", false)}
      </div>
      <div className="mt-4"><Label>Lists</Label>
        <div className="flex flex-wrap gap-2">{(data.lists || []).map((l) => { const on = lists.includes(l.id); return <button key={l.id} type="button" onClick={() => setLists(on ? lists.filter((x) => x !== l.id) : [...lists, l.id])} className={`rounded-full border px-3 py-1 text-[12.5px] font-medium ${on ? "border-[#ff3c00] bg-[#ff3c00]/10 text-[#c22d00]" : "border-hair text-ink/60"}`}>{l.name}</button>; })}</div>
      </div>
      <div className="mt-4 rounded-lg border border-hair bg-white p-3.5">
        <Label>How did they agree to hear from you? *</Label>
        <select className={inputCls} value={basis} onChange={(e) => setBasis(e.target.value)}><option value="express">They asked to get emails</option><option value="existing_customer">They&apos;re a customer</option></select>
        <input className={`${inputCls} mt-2`} value={source} onChange={(e) => setSource(e.target.value)} placeholder="e.g. Signed up at the counter, Nov 2026" />
      </div>
      <div className="mt-4"><Toggle on={auto} onChange={setAuto} label="Start welcome automations" hint="If a welcome series is on for one of these lists." /></div>
      {err && <div className="mt-4"><Notice tone="error">{err}</Notice></div>}
    </Drawer>
  );
}

const ICONS = { open: Eye, click: MousePointerClick, unsubscribe: MailX, bounce: Ban, complaint: Ban };
function ContactDrawer({ id, onClose, call, onChanged, lists }) {
  const q = useQuery({ queryKey: ["email-contact", id], queryFn: () => call("contact_get", { id }), enabled: !!id });
  const c = q.data?.contact;
  const ln = Object.fromEntries((lists || []).map((l) => [l.id, l.name]));
  return (
    <Drawer open={!!id} onClose={onClose} title={c ? (c.name || c.email) : "Contact"}>
      {q.isLoading ? <Loader2 className="mx-auto h-5 w-5 animate-spin text-ink/40" /> : q.isError ? <Notice tone="error">{errMsg(q.error)}</Notice> : c && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2"><Badge tone={c.status}>{c.status}</Badge>{c.test && <Badge tone="test">test</Badge>}<span className="text-[13px] text-ink/55">{c.email}</span></div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl border border-hair bg-white p-4 text-[13px]">
            {[["Lists", (c.list_ids || []).map((x) => ln[x]).filter(Boolean).join(", ") || "–"], ["Tags", (c.tags || []).join(", ") || "–"], ["Location", [c.city, c.state, c.zip].filter(Boolean).join(", ") || "–"], ["Time zone", c.timezone || "Your time zone"], ["Birthday", c.birthday || "–"], ["Added", `${ago(c.created_at || c.created_date)} · ${c.source || ""}`], ["Last emailed", ago(c.last_sent_at)], ["Last opened", ago(c.last_opened_at)]].map(([k, v]) => <div key={k}><dt className="text-[11.5px] text-ink/45">{k}</dt><dd className="mt-0.5 font-medium">{v}</dd></div>)}
          </dl>
          {Object.keys(c.fields || {}).length > 0 && <div className="rounded-xl border border-hair bg-white p-4 text-[13px]"><p className="mb-2 text-[11.5px] text-ink/45">Custom fields</p>{Object.entries(c.fields).map(([k, v]) => <p key={k}><span className="text-ink/55">{k}:</span> {String(v)}</p>)}</div>}
          <div className="rounded-xl border border-hair bg-white p-4 text-[12.5px] text-ink/60"><p className="text-[11.5px] text-ink/45">Consent</p><p className="mt-1">{c.consent?.basis === "double_opt_in" ? "Confirmed by email" : c.consent?.basis === "existing_customer" ? "Existing customer" : c.consent?.basis === "express" ? "Asked to get emails" : "–"}{c.consent?.source ? ` · ${c.consent.source}` : ""}{c.consent?.at ? ` · ${new Date(c.consent.at).toLocaleDateString()}` : ""}</p></div>
          <div>
            <p className="mb-2 text-[13px] font-semibold">Activity</p>
            {q.data.activity?.length ? (
              <ol className="space-y-2">{q.data.activity.map((a, i) => { const I = ICONS[a.type] || Eye; return <li key={i} className="flex items-start gap-3 text-[13px]"><span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#ff3c00]/10 text-[#ff3c00]"><I className="h-3.5 w-3.5" /></span><span className="min-w-0 flex-1"><span className="font-medium capitalize">{a.type === "open" ? "Opened" : a.type === "click" ? "Clicked" : a.type === "unsubscribe" ? "Unsubscribed" : a.type}</span>{a.campaign ? ` · ${a.campaign}` : a.automation_id ? " · automation" : ""}{a.url && <span className="block truncate text-[12px] text-ink/50">{a.url}</span>}</span><span className="text-[12px] text-ink/45">{ago(a.at)}</span></li>; })}</ol>
            ) : <p className="text-[13px] text-ink/50">No opens or clicks yet.</p>}
          </div>
          {c.status === "subscribed" && <ConfirmBtn icon={MailX} confirmLabel="Yes, unsubscribe them" onConfirm={async () => { await call("contact_unsubscribe", { id: c.id }); q.refetch(); onChanged(); }}>Unsubscribe this contact</ConfirmBtn>}
        </div>
      )}
    </Drawer>
  );
}

export default function ContactsTab({ data, call, refresh }) {
  const [q, setQ] = useState("");
  const [dq, setDq] = useState("");
  const [list, setList] = useState("");
  const [status, setStatus] = useState("");
  const [skip, setSkip] = useState(0);
  const [imp, setImp] = useState(false);
  const [add, setAdd] = useState(false);
  const [sel, setSel] = useState(null);
  const [newList, setNewList] = useState(null);
  useEffect(() => { const t = setTimeout(() => { setDq(q); setSkip(0); }, 250); return () => clearTimeout(t); }, [q]);
  const res = useQuery({ queryKey: ["email-contacts", data.client?.id, dq, list, status, skip], queryFn: () => call("contacts", { q: dq, list_id: list, status, skip, limit: 50 }), keepPreviousData: true });
  const ln = Object.fromEntries((data.lists || []).map((l) => [l.id, l.name]));
  const reload = () => { res.refetch(); refresh(); };

  if (!data.counts?.total && !res.data?.total) {
    return (
      <>
        <Empty icon={Users} title="Bring in your customers" action={<div className="flex flex-wrap justify-center gap-2"><Btn kind="flame" icon={FileUp} onClick={() => setImp(true)}>Import a CSV</Btn><Btn kind="ghost" icon={UserPlus} onClick={() => setAdd(true)} disabled={!data.lists?.length}>Add one</Btn>{!data.lists?.length && <Btn kind="ghost" icon={Plus} onClick={async () => { await call("list_save", { name: "Customers" }); refresh(); }}>Create a “Customers” list</Btn>}</div>}>
          Import from your POS, CRM, Mailchimp or a spreadsheet. We check duplicates and anyone who unsubscribed before, and record how each person agreed to hear from you.
        </Empty>
        <ImportWizard open={imp} onClose={() => setImp(false)} data={data} call={call} onDone={reload} />
        <AddContact open={add} onClose={() => setAdd(false)} data={data} call={call} onDone={reload} />
      </>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(data.lists || []).map((l) => (
          <button key={l.id} type="button" onClick={() => { setList(list === l.id ? "" : l.id); setSkip(0); }} className={`rounded-xl border px-4 py-2.5 text-left transition-colors ${list === l.id ? "border-[#ff3c00] bg-[#ff3c00]/[0.05]" : "border-hair bg-white hover:border-ink/30"}`}>
            <span className="block text-[13.5px] font-semibold">{l.name}</span>
            <span className="text-[12px] text-ink/50">{num(l.subscribed)} subscribed{l.count !== l.subscribed ? ` · ${num(l.count)} total` : ""}</span>
          </button>
        ))}
        {newList === null
          ? <button type="button" onClick={() => setNewList("")} className="rounded-xl border border-dashed border-hair px-4 py-2.5 text-[13px] text-ink/55 hover:border-[#ff3c00] hover:text-[#ff3c00]">+ New list</button>
          : <div className="flex items-center gap-2 rounded-xl border border-hair bg-white px-2 py-1.5"><input autoFocus className="w-40 border-0 bg-transparent text-[13.5px] outline-none" value={newList} onChange={(e) => setNewList(e.target.value)} placeholder="List name" onKeyDown={async (e) => { if (e.key === "Enter" && newList.trim()) { await call("list_save", { name: newList.trim() }); setNewList(null); refresh(); } if (e.key === "Escape") setNewList(null); }} /><Btn size="sm" kind="ink" disabled={!newList.trim()} onClick={async () => { await call("list_save", { name: newList.trim() }); setNewList(null); refresh(); }}>Add</Btn></div>}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink/35" /><input className={`${inputCls} pl-9`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, email, city or tag" /></div>
        <select className={`${inputCls} w-auto`} value={status} onChange={(e) => { setStatus(e.target.value); setSkip(0); }}><option value="">Everyone</option><option value="subscribed">Subscribed</option><option value="pending">Waiting to confirm</option><option value="unsubscribed">Unsubscribed</option><option value="cleaned">Bounced</option></select>
        <Btn kind="ghost" icon={UserPlus} onClick={() => setAdd(true)}>Add</Btn>
        <Btn kind="flame" icon={FileUp} onClick={() => setImp(true)}>Import</Btn>
      </div>
      <div className="overflow-hidden rounded-xl border border-hair bg-white">
        {res.isLoading ? <p className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-ink/40" /></p> : res.data?.contacts?.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-[13px]">
              <thead><tr className="border-b border-hair text-left text-[11.5px] text-ink/50"><th className="px-4 py-2.5 font-medium">Contact</th><th className="font-medium">Lists</th><th className="font-medium">Tags</th><th className="font-medium">Last opened</th><th className="pr-4 text-right font-medium">Status</th></tr></thead>
              <tbody>{res.data.contacts.map((c) => (
                <tr key={c.id} onClick={() => setSel(c.id)} className="cursor-pointer border-b border-hair/60 last:border-0 hover:bg-[#ff3c00]/[0.03]">
                  <td className="px-4 py-2.5"><p className="font-medium">{c.name || c.email}</p>{c.name && <p className="text-[11.5px] text-ink/50">{c.email}</p>}</td>
                  <td className="max-w-[160px] truncate text-ink/60">{(c.list_ids || []).map((x) => ln[x]).filter(Boolean).join(", ") || "–"}</td>
                  <td><div className="flex max-w-[180px] flex-wrap gap-1">{(c.tags || []).slice(0, 3).map((t) => <span key={t} className="rounded bg-ink/[0.05] px-1.5 py-0.5 text-[11px] text-ink/65">{t}</span>)}</div></td>
                  <td className="text-ink/55">{c.last_opened_at ? ago(c.last_opened_at) : "–"}</td>
                  <td className="pr-4 text-right"><Badge tone={c.status}>{c.status === "cleaned" ? "bounced" : c.status === "pending" ? "confirming" : c.status}</Badge></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : <p className="py-10 text-center text-[13px] text-ink/50">No contacts match.</p>}
        {res.data?.total > 50 && (
          <div className="flex items-center justify-between border-t border-hair px-4 py-2.5 text-[12.5px] text-ink/55"><span>{skip + 1}–{Math.min(skip + 50, res.data.total)} of {num(res.data.total)}</span><div className="flex gap-2"><Btn size="sm" kind="ghost" disabled={!skip} onClick={() => setSkip(skip - 50)}>Previous</Btn><Btn size="sm" kind="ghost" disabled={skip + 50 >= res.data.total} onClick={() => setSkip(skip + 50)}>Next</Btn></div></div>
        )}
      </div>
      <ImportWizard open={imp} onClose={() => setImp(false)} data={data} call={call} onDone={reload} />
      <AddContact open={add} onClose={() => setAdd(false)} data={data} call={call} onDone={reload} />
      <ContactDrawer id={sel} onClose={() => setSel(null)} call={call} onChanged={reload} lists={data.lists} />
    </div>
  );
}
