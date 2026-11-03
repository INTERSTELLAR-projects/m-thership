import { useMemo, useRef, useState } from "react";
import { Download, Loader2, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { downloadText, parseCsv, toCsv } from "./csv";
import { deleteSubscriber, isEmail, normEmail, updateSubscriber, upsertSubscribers } from "./store";
import { Btn, ConfirmDialog, Panel, Pill, Select, TextInput, fmtDate, inputCls } from "./ui";

// Email Subscribers: website footer signups, imports and manual adds. Import / export CSV.
export default function SubscribersTab({ subscribers, refresh }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [tag, setTag] = useState("");
  const [add, setAdd] = useState({ email: "", name: "", tags: "" });
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState(null);
  const file = useRef(null);
  const tags = useMemo(() => [...new Set(subscribers.flatMap((s) => s.tags || []))].sort(), [subscribers]);
  const shown = subscribers.filter((s) => (!status || s.status === status) && (!tag || (s.tags || []).includes(tag)) && (!q || `${s.email} ${s.name || ""} ${s.business || ""}`.toLowerCase().includes(q.toLowerCase())));
  const counts = { subscribed: subscribers.filter((s) => s.status !== "unsubscribed").length, unsubscribed: subscribers.filter((s) => s.status === "unsubscribed").length };

  const addOne = async () => {
    const email = normEmail(add.email);
    if (!isEmail(email)) { toast({ title: "Enter a valid email", variant: "destructive" }); return; }
    setBusy("add");
    try {
      const r = await upsertSubscribers([{ ...add, email }], subscribers, "manual");
      toast({ title: r.created ? "Subscriber added" : "Already on the list (updated)" });
      setAdd({ email: "", name: "", tags: "" });
      refresh();
    } catch (e) { toast({ title: "Couldn't add", description: e.message, variant: "destructive" }); }
    finally { setBusy(""); }
  };

  const importCsv = async (f) => {
    if (!f) return;
    setBusy("import");
    try {
      const rows = parseCsv(await f.text());
      const r = await upsertSubscribers(rows, subscribers, "import");
      toast({ title: "Import finished", description: `${r.created} added, ${r.updated} updated, ${rows.length - r.created - r.updated} unchanged or invalid.` });
      refresh();
    } catch (e) { toast({ title: "Import failed", description: e.message, variant: "destructive" }); }
    finally { setBusy(""); if (file.current) file.current.value = ""; }
  };

  const exportCsv = () => {
    downloadText(`interstellar-subscribers-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(shown, ["email", "name", "business", "status", "source", "tags", "created_at", "unsubscribed_at", "last_sent_at"]));
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Panel bodyClass="p-3.5"><p className="mono-label text-[8.5px] text-ink/45">Subscribed</p><p className="mt-1 text-[28px] font-semibold tracking-tight">{counts.subscribed}</p></Panel>
        <Panel bodyClass="p-3.5"><p className="mono-label text-[8.5px] text-ink/45">Unsubscribed</p><p className="mt-1 text-[28px] font-semibold tracking-tight text-ink/50">{counts.unsubscribed}</p></Panel>
        <Panel bodyClass="p-3.5"><p className="mono-label text-[8.5px] text-ink/45">From the website footer</p><p className="mt-1 text-[28px] font-semibold tracking-tight text-[#ff3c00]">{subscribers.filter((s) => s.source === "website_footer").length}</p></Panel>
      </div>

      <Panel label="Add" title="Add a subscriber" bodyClass="p-3.5">
        <div className="grid gap-2 sm:grid-cols-[1.3fr_1fr_1fr_auto]">
          <TextInput value={add.email} onChange={(v) => setAdd({ ...add, email: v })} placeholder="email@example.com" />
          <TextInput value={add.name} onChange={(v) => setAdd({ ...add, name: v })} placeholder="Name (optional)" />
          <TextInput value={add.tags} onChange={(v) => setAdd({ ...add, tags: v })} placeholder="Tags, comma separated" />
          <Btn variant="flame" disabled={busy === "add"} onClick={addOne}>{busy === "add" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />} Add</Btn>
        </div>
        <p className="mt-2 text-[11px] text-ink/45">Only add people who asked to hear from you. Website footer signups land here automatically.</p>
      </Panel>

      <Panel
        label="List"
        title={`Email Subscribers · ${shown.length}`}
        right={
          <div className="flex gap-1.5">
            <input ref={file} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => importCsv(e.target.files && e.target.files[0])} />
            <Btn className="h-8" disabled={busy === "import"} onClick={() => file.current && file.current.click()}>{busy === "import" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Import CSV</Btn>
            <Btn className="h-8" disabled={!shown.length} onClick={exportCsv}><Download className="h-3.5 w-3.5" /> Export CSV</Btn>
          </div>
        }
      >
        <div className="flex flex-wrap gap-2 border-b border-hair p-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-ink/35" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search email, name, business" className={`${inputCls} h-9 pl-8`} />
          </div>
          <Select value={status} onChange={setStatus} placeholder="Any status" options={[{ value: "subscribed", label: "Subscribed" }, { value: "unsubscribed", label: "Unsubscribed" }]} className="w-40" />
          <Select value={tag} onChange={setTag} placeholder="Any tag" options={tags} className="w-40" />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-[12.5px]">
            <thead><tr className="mono-label border-b border-hair text-[8.5px] text-ink/45"><th className="px-3 py-2">Email</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Tags</th><th className="px-3 py-2">Joined</th><th className="px-3 py-2">Status</th><th className="px-3 py-2" /></tr></thead>
            <tbody>
              {shown.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-ink/45">No subscribers yet. Footer signups on the Interstellar website will show up here.</td></tr>}
              {shown.slice(0, 1000).map((s) => (
                <tr key={s.id} className="border-b border-hair last:border-b-0">
                  <td className="px-3 py-2 font-medium">{s.email}</td>
                  <td className="px-3 py-2 text-ink/70">{s.name || "—"}</td>
                  <td className="px-3 py-2 text-ink/55">{(s.source || "—").replace(/_/g, " ")}</td>
                  <td className="px-3 py-2">{(s.tags || []).map((t) => <span key={t} className="mr-1"><Pill>{t}</Pill></span>)}</td>
                  <td className="px-3 py-2 text-ink/55">{fmtDate(s.created_at || s.created_date).split(",").slice(0, 2).join(",")}</td>
                  <td className="px-3 py-2">
                    <button type="button" title="Click to change" onClick={async () => { await updateSubscriber(s.id, s.status === "unsubscribed" ? { status: "subscribed" } : { status: "unsubscribed", unsubscribed_at: new Date().toISOString() }); refresh(); }}>
                      <Pill tone={s.status === "unsubscribed" ? "muted" : "flame"}>{s.status || "subscribed"}</Pill>
                    </button>
                  </td>
                  <td className="px-3 py-2 text-right"><button type="button" title="Delete" onClick={() => setConfirm(s)} className="text-ink/35 hover:text-[#ff3c00]"><Trash2 className="h-3.5 w-3.5" /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <ConfirmDialog
        open={!!confirm}
        title="Delete this subscriber?"
        body={confirm ? `${confirm.email} is removed from the list. To keep a record that they opted out, mark them unsubscribed instead.` : ""}
        confirmLabel="Delete"
        danger
        onClose={() => setConfirm(null)}
        onConfirm={async () => { await deleteSubscriber(confirm.id); refresh(); }}
      />
    </div>
  );
}
