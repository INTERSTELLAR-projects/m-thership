import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowUpRight, BookOpen, Compass, ExternalLink, FileText, ListChecks, Megaphone, Palette } from "lucide-react";
import { Panel, Empty, Tag } from "@/features/clients/ui";
import { fmtDate } from "@/lib/useData";
import { SocialPlanView } from "@/features/clients/SocialPlanTab";

// Resources hub: everything Interstellar has published to this client in one place. The portal
// function only lists this client's approved + portal-visible documents, their own SOPs/guides and
// library SOPs Justin shared with them.
const TYPE = {
  brand_kit: { label: "Brand kit", icon: Palette, group: "Your brand & plans" },
  playbook: { label: "Playbook", icon: Compass, group: "Your brand & plans" },
  social_plan: { label: "Social plan", icon: Megaphone, group: "Your brand & plans" },
  sop: { label: "SOP", icon: ListChecks, group: "SOPs & guides" },
  guide: { label: "Guide", icon: BookOpen, group: "SOPs & guides" },
  shared_sop: { label: "SOP", icon: ListChecks, group: "SOPs & guides" },
};
const GROUPS = ["Your brand & plans", "SOPs & guides"];
const isPdf = (u) => /\.pdf($|\?)/i.test(u || "");
const isImg = (u) => /\.(png|jpe?g|webp|gif|svg)($|\?)/i.test(u || "");

function SocialPlanViewer({ call, previewId }) {
  const q = useQuery({ queryKey: ["portal", previewId, "social_plan"], queryFn: () => call("social_plan"), retry: false });
  const p = q.data?.social_plan;
  if (q.isLoading) return <p className="text-[13px] text-ink/50">Loading…</p>;
  if (!p) return <Panel><Empty>Your social plan isn&apos;t published yet.</Empty></Panel>;
  return (
    <div className="rounded-md border border-hair bg-card p-5 md:p-7">
      {p.plan?.headline && <p className="mb-1 text-[22px] font-semibold tracking-[-0.03em]">{p.plan.headline}</p>}
      {p.summary && <p className="mb-5 max-w-3xl text-[14.5px] leading-relaxed text-ink/75">{p.summary}</p>}
      <SocialPlanView plan={p.plan} body={p.body_md} />
    </div>
  );
}

function FileViewer({ r }) {
  const url = r.file_url || r.link_url || "";
  return (
    <div className="space-y-4 rounded-md border border-hair bg-card p-5 md:p-7">
      {r.description && <p className="max-w-3xl whitespace-pre-wrap text-[14px] leading-relaxed text-ink/75">{r.description}</p>}
      {url && isPdf(url) && <iframe title={r.title} src={url} className="h-[75vh] w-full rounded-sm border border-hair bg-white" />}
      {url && isImg(url) && <img src={url} alt={r.title} className="max-h-[75vh] max-w-full rounded-sm border border-hair" />}
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-sm bg-gradient-to-r from-[#ff3c00] to-[#ff6a00] px-4 py-2 text-[13px] font-medium text-white">
          Open {r.category === "guide" ? "guide" : "SOP"} <ExternalLink className="h-3.5 w-3.5" />
        </a>
      ) : !r.description ? <Empty>This document has no file or link attached yet.</Empty> : null}
    </div>
  );
}

function SharedSopViewer({ r }) {
  return (
    <div className="space-y-5 rounded-md border border-hair bg-card p-5 md:p-7">
      {r.summary && <p className="max-w-3xl text-[14px] leading-relaxed text-ink/75">{r.summary}</p>}
      {(r.phases || []).map((ph, i) => (
        <section key={i} className="border-t border-hair pt-4">
          <p className="label-cross mb-3">({ph.phase})</p>
          <ol className="space-y-2">
            {ph.steps.map((s, j) => (
              <li key={j} className="flex gap-3">
                <span className="mt-0.5 font-mono text-[11px] text-[#ff3c00]">{String(j + 1).padStart(2, "0")}</span>
                <div>
                  <p className="text-[13.5px] font-medium text-ink">{s.title}</p>
                  {s.notes && <p className="mt-0.5 whitespace-pre-wrap text-[12.5px] leading-relaxed text-ink/60">{s.notes}</p>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
      {!(r.phases || []).length && <Empty>No steps in this SOP yet.</Empty>}
    </div>
  );
}

function ResourceViewer({ item, call, previewId, onBack }) {
  const needsFetch = ["sop", "guide", "shared_sop"].includes(item.type);
  const q = useQuery({
    queryKey: ["portal", previewId, "resource", item.type, item.id],
    queryFn: () => call("resource", { type: item.type, id: item.id }),
    enabled: needsFetch,
    retry: false,
  });
  const meta = TYPE[item.type] || TYPE.guide;
  const r = q.data?.resource;
  return (
    <div className="space-y-4">
      <button type="button" onClick={onBack} className="mono-label inline-flex items-center gap-1.5 text-[10px] text-ink/50 hover:text-[#ff3c00]"><ArrowLeft className="h-3 w-3" /> All resources</button>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-cross">({meta.label})</p>
          <h2 className="mt-2 text-[30px] font-semibold tracking-[-0.04em]">{item.title}</h2>
        </div>
        <div className="flex items-center gap-2">
          {item.code && <Tag tone="muted">{item.code}</Tag>}
          {item.version != null && <Tag tone="muted">Version {item.version}</Tag>}
          {item.updated && <span className="font-mono text-[11px] text-ink/45">Updated {fmtDate(item.updated)}</span>}
        </div>
      </div>
      {item.type === "social_plan" ? <SocialPlanViewer call={call} previewId={previewId} />
        : q.isLoading ? <p className="text-[13px] text-ink/50">Loading…</p>
          : !r ? <Panel><Empty>This resource isn&apos;t available any more.</Empty></Panel>
            : item.type === "shared_sop" ? <SharedSopViewer r={r} /> : <FileViewer r={r} />}
    </div>
  );
}

export default function PortalResources({ call, previewId, business, go }) {
  const [open, setOpen] = useState(null);
  const q = useQuery({ queryKey: ["portal", previewId, "resources"], queryFn: () => call("resources"), retry: false });
  const items = q.data?.resources || [];

  if (open) return <ResourceViewer item={open} call={call} previewId={previewId} onBack={() => setOpen(null)} />;

  const openItem = (it) => {
    // Brand kit and playbook keep their own portal tabs.
    if (it.type === "brand_kit" && go) return go("brand");
    if (it.type === "playbook" && go) return go("playbook");
    return setOpen(it);
  };

  return (
    <div className="space-y-5">
      <div>
        <p className="label-cross">(Resources)</p>
        <h2 className="mt-2 text-[32px] font-semibold tracking-[-0.04em]">{business}&apos;s resources</h2>
        <p className="mt-1 max-w-2xl text-[14px] text-ink/60">Everything we&apos;ve published for you in one place: your brand kit, plans, SOPs and guides.</p>
      </div>
      {q.isLoading ? <p className="text-[13px] text-ink/50">Loading…</p> : !items.length ? (
        <Panel><Empty>Your brand kit, playbook, social plan, SOPs and guides will appear here as we publish them.</Empty></Panel>
      ) : (
        GROUPS.map((g) => {
          const list = items.filter((it) => (TYPE[it.type] || TYPE.guide).group === g);
          if (!list.length) return null;
          return (
            <section key={g}>
              <p className="mono-label mb-2 text-[9.5px] text-ink/50">{g}</p>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {list.map((it) => {
                  const meta = TYPE[it.type] || TYPE.guide;
                  const Icon = meta.icon || FileText;
                  return (
                    <button key={`${it.type}-${it.id}`} type="button" onClick={() => openItem(it)} className="group flex flex-col overflow-hidden rounded-md border border-hair bg-card text-left transition-colors hover:border-[#ff3c00]/60">
                      <span className="h-1 w-full bg-gradient-to-r from-[#ff3c00] via-[#ff6a00] to-[#ffaa00] opacity-70 group-hover:opacity-100" />
                      <span className="flex flex-1 flex-col gap-2 p-4">
                        <span className="flex items-center justify-between gap-2">
                          <span className="inline-flex items-center gap-2">
                            <Icon className="h-4 w-4 text-[#ff3c00]" strokeWidth={1.75} />
                            <span className="mono-label text-[8.5px] text-ink/50">{meta.label}{it.code ? ` · ${it.code}` : ""}</span>
                          </span>
                          <ArrowUpRight className="h-3.5 w-3.5 text-ink/30 group-hover:text-[#ff3c00]" />
                        </span>
                        <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink">{it.title}</span>
                        {it.summary && <span className="line-clamp-2 text-[12px] text-ink/55">{it.summary}</span>}
                        <span className="mt-auto font-mono text-[10.5px] text-ink/40">{it.version != null ? `v${it.version} · ` : ""}{it.updated ? `Updated ${fmtDate(it.updated)}` : ""}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
