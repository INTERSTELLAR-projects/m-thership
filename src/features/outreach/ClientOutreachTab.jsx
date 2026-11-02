import { Link } from "react-router-dom";
import { ExternalLink, ArrowUpRight } from "lucide-react";
import { Panel, Empty, Tag } from "@/features/clients/ui";
import useOutreach from "./useOutreach";
import ApprovalInbox from "./ApprovalInbox";
import { KpiTiles, PipelineBoard, ActivityFeed } from "./Views";
import { CriteriaPanel } from "./Setup";
import { KIND_LABEL, HUMAN_METHODS } from "./lib";

// ClientCockpit → "Citations & PR": this client's targets, won links, approvals and criteria.
export default function ClientOutreachTab({ client }) {
  const d = useOutreach(client.id);
  if (d.loading) return <p className="text-[13px] text-ink/50">Loading…</p>;
  const won = d.targets.filter((t) => t.status === "won");
  const manual = d.targets.filter((t) => HUMAN_METHODS.includes(t.submission_method) && ["qualified", "drafted", "approved"].includes(t.status)).length;
  const awaiting = d.messages.filter((m) => m.status === "needs_approval").length;
  const base = `/backlinks?client=${client.id}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="label-cross">(Backlinks, citations & PR)</p>
        <div className="flex flex-wrap gap-3 text-[12px]">
          {manual > 0 && <Link to={`${base}&tab=manual`} className="text-[#ff3c00] hover:underline">{manual} web forms need you</Link>}
          <Link to={base} className="inline-flex items-center gap-1 text-ink/60 hover:text-[#ff3c00]">Open full dashboard <ArrowUpRight className="h-3 w-3" /></Link>
        </div>
      </div>

      <KpiTiles targets={d.targets} messages={d.messages} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel label="Live links" title={`${won.length} won`}>
          {won.length === 0 ? (
            <Empty>No live links yet. Won listings and articles land here with their URL.</Empty>
          ) : (
            <ul className="divide-y divide-hair">
              {won.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-medium">{t.name} <span className="text-[11px] font-normal text-ink/45">{KIND_LABEL[t.kind]}</span></p>
                    {t.live_url && <a href={t.live_url} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 truncate text-[11.5px] text-[#ff3c00] hover:underline">{t.live_url.replace(/^https?:\/\/(www\.)?/, "")} <ExternalLink className="h-3 w-3 shrink-0" /></a>}
                  </div>
                  {t.live_ok === false ? <Tag tone="red">missing</Tag> : t.live_checked_at ? <Tag tone="green">verified</Tag> : <Tag>unchecked</Tag>}
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <div className="space-y-2">
          <p className="label-cross">Activity</p>
          <ActivityFeed runs={d.runs} targets={d.targets} messages={d.messages} limit={10} />
        </div>
      </div>

      {awaiting > 0 && (
        <div>
          <p className="label-cross mb-3">Awaiting approval</p>
          <ApprovalInbox messages={d.messages} targets={d.targets} rules={d.rules} onPatch={d.patch} />
        </div>
      )}

      <CriteriaPanel clients={d.clients} criteria={d.criteria} single />

      <div>
        <p className="label-cross mb-3">Pipeline</p>
        <PipelineBoard targets={d.targets} onPatch={d.patch} showClient={false} />
      </div>
    </div>
  );
}
