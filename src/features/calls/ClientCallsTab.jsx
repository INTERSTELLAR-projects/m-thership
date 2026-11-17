// Client profile → Calls: every structured call with this client, open action items, and a shortcut to structure one.
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Mic } from "lucide-react";
import { Panel, Tag, Empty, Btn } from "@/features/clients/ui";
import { E, bucket, fmtWhen, totalMinutes, typeLabel } from "./api";

const TONE = { upcoming: "flame", ready: "flame", draft: "muted", done: "ink" };

export default function ClientCallsTab({ client }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!client?.id) return;
    E.CallPrep.filter({ client_id: client.id }, "-created_date", 100).then(setRows).catch(() => setRows([]));
  }, [client?.id]);
  const open = (rows || []).flatMap((cp) => (cp.action_items || []).filter((a) => !a.done).map((a) => ({ ...a, from: cp })));
  return (
    <div className="space-y-5 pb-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[13px] text-ink/65">Say what the next call with {client?.business || "this client"} needs to cover and get a tight, timeboxed plan. After the call, dictate what happened: action items roll into the next call and the facts you accept feed this client's brain.</p>
        <Link to={`/calls/new?client=${client?.id || ""}`}><Btn icon={Mic}>Structure a call</Btn></Link>
      </div>
      {open.length ? (
        <Panel label="Open" title={`${open.length} action item${open.length === 1 ? "" : "s"} from earlier calls`} bodyClass="divide-y divide-hair">
          {open.map((a, i) => (
            <div key={i} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-[13px]">
              <Tag tone={a.owner === "client" ? "amber" : "flame"}>{a.owner === "client" ? "client" : "Justin"}</Tag>
              <span className="min-w-0 flex-1">{a.text}</span>
              {a.due ? <span className="text-[12px] text-ink/50">{a.due}</span> : null}
              <Link to={`/calls/${a.from.id}?view=after`} className="text-[12px] text-ink/50 hover:text-[#ff3c00]">{a.from.title || "call"}</Link>
            </div>
          ))}
        </Panel>
      ) : null}
      <Panel label="Calls" title="Structured calls" bodyClass="divide-y divide-hair">
        {rows === null ? <p className="px-4 py-6 text-[13px] text-ink/55">Loading…</p> : !rows.length ? (
          <Empty>No calls structured yet with this client.</Empty>
        ) : rows.map((cp) => {
          const b = bucket(cp);
          return (
            <Link key={cp.id} to={`/calls/${cp.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-ink/[0.03]">
              <Tag tone={TONE[b]}>{b}</Tag>
              {cp.call_type && cp.call_type !== "client" ? <Tag>{typeLabel(cp.call_type)}</Tag> : null}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[14px] font-medium">{cp.title || "Untitled call"}</span>
                <span className="block truncate text-[12px] text-ink/55">{cp.goal || cp.raw_notes}</span>
              </span>
              <span className="text-[12px] text-ink/45">{cp.scheduled_for ? fmtWhen(cp.scheduled_for) : ""}{(cp.agenda || []).length ? ` · ${totalMinutes(cp.agenda)} min` : ""}</span>
            </Link>
          );
        })}
      </Panel>
    </div>
  );
}
