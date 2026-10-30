import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import usePackageData from "@/features/packages/usePackageData";
import { allSummaries } from "@/features/packages/engine";
import { ORB_STATES, SUBSCRIPTIONS, packagePath } from "@/features/packages/registry";
import OrbRail from "@/features/packages/components/OrbRail";

// Mission Control: the eight pillars at a glance — fulfilled / in flight / needs you per package.
export default function PackagesStrip() {
  const { data, loading } = usePackageData();
  const sums = useMemo(() => {
    const all = allSummaries(data);
    const subs = all.filter((s) => s.pkg.kind === "recurring"), pk = all.filter((s) => s.pkg.kind !== "recurring");
    return [...subs, ...pk];
  }, [data]);
  const needs = sums.flatMap((s) => s.rails.filter((r) => r.rail.overall === "attention").map((r) => ({ pkg: s.pkg, ...r })));

  return (
    <div className="px-5 pt-6 md:px-8">
      <div className="mb-3 flex items-center justify-between">
        <p className="label-cross text-[10.5px] text-ink/60">(Subscriptions + packages · {sums.reduce((n, s) => n + s.clients, 0)} client seats)</p>
        <span className="mono-label text-[9px] text-ink/40">{loading ? "reading" : "live"}</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {sums.map((s) => {
          const tone = s.attention ? ORB_STATES.attention.color : s.working ? ORB_STATES.working.color : s.done ? ORB_STATES.done.color : ORB_STATES.off.color;
          return (
            <Link key={s.pkg.key} to={packagePath(s.pkg.key)} className="card-hover group relative overflow-hidden rounded-md border border-hair bg-card px-4 py-3">
              <span className="absolute inset-x-0 top-0 h-[2px]" style={{ background: s.pkg.color }} />
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <s.pkg.icon className="h-3.5 w-3.5" style={{ color: s.pkg.color }} />
                  <p className="text-[13px] font-semibold tracking-[-0.02em]">{s.pkg.label}</p>
                </div>
                <ArrowUpRight className="h-3.5 w-3.5 text-ink/30 transition-colors group-hover:text-[#ff3c00]" />
              </div>
              <p className="mono-label mt-0.5 text-[8px] text-ink/40">{s.pkg.kind === "recurring" ? "Subscription · " : ""}{s.pkg.arch} {s.pkg.version}</p>
              <div className="mt-2.5 flex items-end justify-between">
                <p className="text-[24px] font-semibold leading-none tracking-[-0.04em]" style={{ color: s.clients ? tone : undefined }}>
                  {s.clients}
                  <span className="ml-1 text-[10px] font-normal tracking-normal text-ink/45">clients</span>
                </p>
                <div className="flex items-center gap-2 font-mono text-[9.5px] tabular-nums">
                  <span style={{ color: ORB_STATES.done.color }}>{s.done}✓</span>
                  <span style={{ color: ORB_STATES.working.color }}>{s.working}▸</span>
                  <span style={{ color: ORB_STATES.attention.color }}>{s.attention}!</span>
                </div>
              </div>
              <div className="mt-2 flex h-1 w-full overflow-hidden rounded-sm bg-ink/[0.06]">
                {s.clients ? (
                  <>
                    <span style={{ width: (s.done / s.clients) * 100 + "%", background: ORB_STATES.done.color }} />
                    <span style={{ width: (s.working / s.clients) * 100 + "%", background: ORB_STATES.working.color }} />
                    <span style={{ width: (s.attention / s.clients) * 100 + "%", background: ORB_STATES.attention.color }} />
                  </>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>

      {needs.length ? (
        <div className="mt-3 overflow-hidden rounded-md border border-[#b91c1c]/30 bg-card">
          <p className="border-b border-hair px-4 py-2 text-[11px] font-medium text-[#b91c1c]">Needs you · {needs.length}</p>
          <div className="divide-y divide-hair">
            {needs.slice(0, 6).map((n) => (
              <Link key={n.pkg.key + n.client.id} to={packagePath(n.pkg.key) + "/" + n.client.id} className="grid grid-cols-[minmax(0,200px)_minmax(0,1fr)] items-center gap-4 px-4 py-2 hover:bg-[#ff3c00]/[0.035]">
                <div className="min-w-0">
                  <p className="truncate text-[12.5px] font-medium">{n.client.business}</p>
                  <p className="mono-label text-[8.5px] text-ink/45">{n.pkg.label}</p>
                </div>
                <div className="overflow-x-auto"><OrbRail orbs={n.rail.orbs} size="sm" /></div>
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
