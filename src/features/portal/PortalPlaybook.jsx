import { useQuery } from "@tanstack/react-query";
import { Panel, Empty, Tag } from "@/features/clients/ui";
import { PlaybookView } from "@/features/clients/PlaybookTab";

// Read-only playbook in the client portal. The portal function only returns this client's newest
// approved playbook, and only when Justin has made it visible.
export default function PortalPlaybook({ call, previewId, business }) {
  const q = useQuery({ queryKey: ["portal", previewId, "playbook"], queryFn: () => call("playbook"), retry: false });
  const p = q.data?.playbook;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-cross">(Playbook)</p>
          <h2 className="mt-2 text-[32px] font-semibold tracking-[-0.04em]">{business}&apos;s 2027 playbook</h2>
          <p className="mt-1 max-w-2xl text-[14px] text-ink/60">Where you are, where you&apos;re going, and how we get there together: what we&apos;re doing, what you do, and the milestones to watch.</p>
        </div>
        {p?.version != null && <Tag tone="muted">Version {p.version}</Tag>}
      </div>
      {q.isLoading ? <p className="text-[13px] text-ink/50">Loading…</p> : !p ? (
        <Panel><Empty>Your playbook isn&apos;t published yet.</Empty></Panel>
      ) : (
        <div className="rounded-md border border-hair bg-card p-5 md:p-7">
          {p.playbook?.headline && <p className="mb-1 text-[22px] font-semibold tracking-[-0.03em]">{p.playbook.headline}</p>}
          {p.summary && <p className="mb-5 max-w-3xl text-[14.5px] leading-relaxed text-ink/75">{p.summary}</p>}
          <PlaybookView playbook={p.playbook} body={p.body_md} done={p.quick_wins_done || []} />
        </div>
      )}
    </div>
  );
}
