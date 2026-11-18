// Saved segments: rules over tags, lists, location, dates, engagement and custom fields, with a live count.
import { useEffect, useState } from "react";
import { Filter, Plus, Trash2, Users } from "lucide-react";
import { Btn, Card, ConfirmBtn, Empty, Label, Notice, Segmented, inputCls } from "./ui";
import { errMsg, num } from "./api";

export const FIELDS = [
  ["tag", "Tag", [["has", "has"], ["not_has", "doesn't have"]]],
  ["list", "List", [["in", "is in"], ["not_in", "isn't in"]]],
  ["city", "City", [["is", "is"], ["is_not", "isn't"], ["contains", "contains"]]],
  ["state", "State", [["is", "is"], ["is_not", "isn't"]]],
  ["zip", "ZIP", [["is", "is"], ["starts_with", "starts with"]]],
  ["created", "Added", [["within_days", "in the last … days"], ["before_days", "more than … days ago"]]],
  ["last_sent", "Last emailed", [["within_days", "in the last … days"], ["not_within_days", "not in the last … days"]]],
  ["last_opened", "Last opened", [["within_days", "in the last … days"], ["not_within_days", "not in the last … days"]]],
  ["last_clicked", "Last clicked", [["within_days", "in the last … days"], ["not_within_days", "not in the last … days"]]],
  ["field", "Custom field", [["is", "is"], ["contains", "contains"], ["exists", "has a value"], ["not_exists", "is empty"]]],
  ["source", "Source", [["is", "is"]]],
];
const F = Object.fromEntries(FIELDS.map((f) => [f[0], f]));
const isDays = (r) => ["created", "last_sent", "last_opened", "last_clicked"].includes(r.field);

function RuleRow({ r, set, remove, lists }) {
  const ops = F[r.field]?.[2] || [];
  return (
    <div className="grid grid-cols-1 gap-2 rounded-lg border border-hair bg-white p-2.5 sm:grid-cols-[1fr_1fr_1.3fr_auto] sm:items-center">
      <select className={inputCls} value={r.field} onChange={(e) => set({ field: e.target.value, op: F[e.target.value][2][0][0], value: "", key: "" })}>{FIELDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      <select className={inputCls} value={r.op} onChange={(e) => set({ op: e.target.value })}>{ops.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
      {r.field === "list" ? (
        <select className={inputCls} value={r.value} onChange={(e) => set({ value: e.target.value })}><option value="">Pick a list</option>{lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
      ) : r.field === "field" ? (
        <div className="flex gap-2"><input className={inputCls} value={r.key || ""} onChange={(e) => set({ key: e.target.value })} placeholder="field name" />{!["exists", "not_exists"].includes(r.op) && <input className={inputCls} value={r.value} onChange={(e) => set({ value: e.target.value })} placeholder="value" />}</div>
      ) : r.field === "source" ? (
        <select className={inputCls} value={r.value} onChange={(e) => set({ value: e.target.value })}><option value="">Pick one</option><option value="import">Imported</option><option value="form">Sign-up form</option><option value="webhook">Your Command System</option><option value="manual">Added by hand</option></select>
      ) : (
        <input className={inputCls} type={isDays(r) ? "number" : "text"} min={0} value={r.value} onChange={(e) => set({ value: e.target.value })} placeholder={isDays(r) ? "days, e.g. 90" : "value"} />
      )}
      <button type="button" aria-label="Remove rule" onClick={remove} className="justify-self-end rounded p-2 text-ink/40 hover:bg-red-50 hover:text-red-700"><Trash2 className="h-4 w-4" /></button>
    </div>
  );
}

function SegmentEditor({ seg, data, call, onClose, onSaved }) {
  const [name, setName] = useState(seg?.name || "");
  const [match, setMatch] = useState(seg?.match || "all");
  const [rules, setRules] = useState(seg?.rules?.length ? seg.rules : [{ field: "tag", op: "has", value: "" }]);
  const [count, setCount] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const key = JSON.stringify([match, rules]);
  useEffect(() => {
    let live = true;
    const t = setTimeout(async () => { try { const r = await call("segment_count", { match, rules }); if (live) setCount(r); } catch (e) { if (live) setErr(errMsg(e)); } }, 350);
    return () => { live = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const save = async () => {
    setBusy(true); setErr("");
    try { await call("segment_save", { id: seg?.id, name, match, rules }); onSaved(); } catch (e) { setErr(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)] [&>*]:min-w-0">
      <Card>
        <Label>Segment name</Label>
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Haven't opened in 90 days" />
        <div className="mt-4 flex flex-wrap items-center gap-2 text-[13.5px]">Contacts who match <Segmented size="sm" value={match} onChange={setMatch} options={[["all", "all"], ["any", "any"]]} /> of these rules:</div>
        <div className="mt-3 space-y-2">
          {rules.map((r, i) => <RuleRow key={i} r={r} lists={data.lists || []} set={(p) => setRules(rules.map((x, j) => (j === i ? { ...x, ...p } : x)))} remove={() => setRules(rules.filter((_, j) => j !== i))} />)}
          <button type="button" onClick={() => setRules([...rules, { field: "last_opened", op: "not_within_days", value: "90" }])} className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-hair py-2.5 text-[13px] text-ink/55 hover:border-[#ff3c00] hover:text-[#ff3c00]"><Plus className="h-4 w-4" /> Add a rule</button>
        </div>
        {err && <div className="mt-3"><Notice tone="error">{err}</Notice></div>}
        <div className="mt-5 flex justify-end gap-2"><Btn kind="ghost" onClick={onClose}>Cancel</Btn><Btn kind="flame" busy={busy} disabled={!name.trim()} onClick={save}>Save segment</Btn></div>
      </Card>
      <Card className="bg-ink text-white lg:self-start">
        <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/50">Matches right now</p>
        <p className="mt-2 text-[52px] font-semibold leading-none tracking-[-0.05em] tabular-nums">{count ? num(count.count) : "…"}</p>
        {count && <p className="mt-1 text-[13px] text-white/60">{num(count.sendable)} can be emailed</p>}
        {count?.sample?.length > 0 && <ul className="mt-4 space-y-1 text-[12.5px] text-white/55">{count.sample.map((s) => <li key={s.email} className="truncate">{s.name ? `${s.name} · ` : ""}{s.email}</li>)}</ul>}
      </Card>
    </div>
  );
}

export default function SegmentsTab({ data, call, refresh }) {
  const [edit, setEdit] = useState(null);
  if (edit) return <SegmentEditor seg={edit === "new" ? null : edit} data={data} call={call} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); refresh(); }} />;
  const segs = data.segments || [];
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-[18px] font-semibold tracking-[-0.03em]">Segments</h2><p className="text-[13px] text-ink/55">Saved groups that update themselves. Send a campaign to just the right people.</p></div>
        <Btn kind="flame" icon={Plus} onClick={() => setEdit("new")}>New segment</Btn>
      </div>
      {segs.length ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {segs.map((s) => (
            <Card key={s.id} className="flex flex-col">
              <div className="flex items-start gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#ff3c00]/10 text-[#ff3c00]"><Filter className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-[15px] font-semibold">{s.name}</p><p className="text-[12.5px] text-ink/50">{num(s.last_count)} people · {s.rules?.length || 0} rule{s.rules?.length === 1 ? "" : "s"} ({s.match})</p></div></div>
              <ul className="mt-3 flex-1 space-y-1 text-[12.5px] text-ink/60">{(s.rules || []).slice(0, 3).map((r, i) => <li key={i}>• {F[r.field]?.[1]} {F[r.field]?.[2]?.find((o) => o[0] === r.op)?.[1]?.replace("…", r.value) || r.op} {isDays(r) ? "" : r.field === "list" ? (data.lists || []).find((l) => l.id === r.value)?.name : r.field === "field" ? `${r.key} ${r.value || ""}` : r.value}</li>)}</ul>
              <div className="mt-4 flex gap-2"><Btn size="sm" kind="ghost" onClick={() => setEdit(s)}>Edit</Btn><ConfirmBtn size="sm" kind="ghost" confirmLabel="Delete it" onConfirm={async () => { await call("segment_delete", { id: s.id }); refresh(); }}>Delete</ConfirmBtn></div>
            </Card>
          ))}
        </div>
      ) : (
        <Empty icon={Users} title="No segments yet" action={<Btn kind="flame" icon={Plus} onClick={() => setEdit("new")}>New segment</Btn>}>Examples: VIP customers in Oregon, people who clicked in the last 30 days, anyone who hasn&apos;t opened in 90 days.</Empty>
      )}
    </div>
  );
}
