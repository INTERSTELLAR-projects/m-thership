// Playbooks: the prompt agent ("prompt CEO"). It learns how Justin builds from every request he logs, keeps a copy-paste
// foundation prompt per area of work, and checks every client site and app against the same standards.
// Nothing becomes a standard or a live prompt without Justin's approval (Approve tab).
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Brain, Grid3x3, Inbox, X } from "lucide-react";
import "@/features/agents/agents.css";
import "./playbooks.css";
import Starfield from "@/features/agents/Starfield";
import { Spinner } from "@/features/agents/ui";
import { packageByKey } from "@/features/packages/registry";
import { usePlaybooks, useRefreshPlaybooks, PLAYBOOKS_KEY, iconFor, livePrompt, shortDate } from "./data";
import { BrainVisual, RunPanel, StatTiles, Ticker, TeachForm } from "./BrainHero";
import AreaView, { CopyButton } from "./AreaView";
import StandardsMatrix from "./StandardsMatrix";
import ApproveQueue from "./ApproveQueue";

function GlideTabs({ value, onChange, options }) {
  const ref = useRef(null);
  const [g, setG] = useState({ left: 3, width: 0 });
  useLayoutEffect(() => {
    const el = ref.current?.querySelector(`[data-k="${value}"]`);
    if (el) setG({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, options]);
  return (
    <div ref={ref} className="tabs" role="tablist" aria-label="Playbooks sections">
      <span className="glide" style={{ left: g.left, width: g.width }} />
      {options.map(([k, label, Icon, badge]) => (
        <button key={k} data-k={k} type="button" role="tab" aria-selected={value === k} className={value === k ? "on" : ""} onClick={() => onChange(k)}>
          <Icon className="h-3.5 w-3.5" />{label}
          {badge ? <span className="mono grid h-[18px] min-w-[18px] place-items-center rounded-full bg-[#ff3c00] px-1 text-[10px] text-white">{badge}</span> : null}
        </button>
      ))}
    </div>
  );
}

function AreaCard({ area, data, highlight, pending, onOpen }) {
  const Icon = iconFor(area.icon);
  const live = livePrompt(data.prompts, area.id);
  const feeding = data.patterns.filter((p) => p.area_id === area.id && p.status !== "rejected" && (p.count || 0) > 0).length;
  const stds = data.standards.filter((s) => s.area_id === area.id && s.active !== false).length;
  return (
    <div className={`card flex flex-col p-4 ${highlight ? "hl" : ""}`}>
      {live ? <span className="run-border" style={{ animationDelay: `${-(area.order || 0) * 0.5}s` }} /> : null}
      <button type="button" className="flex items-start gap-3 text-left" onClick={onOpen}>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${live ? "border-[rgba(255,106,0,.45)] bg-[rgba(255,60,0,.1)]" : "border-[var(--hair-d2)] bg-white/[0.02]"}`}>
          <Icon className={`h-[18px] w-[18px] ${live ? "text-[#ff8a3d]" : "text-[var(--ink-m)]"}`} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="truncate text-[14.5px] font-medium text-white">{area.name}</span>
            {pending ? <span className="mono shrink-0 rounded-full bg-[#ff3c00] px-1.5 text-[10px] text-white">{pending}</span> : null}
          </span>
          <span className="mt-1 line-clamp-2 block text-[12px] text-[var(--ink-m)]">{area.description}</span>
        </span>
      </button>
      <div className="mt-auto flex items-end justify-between gap-2 pt-3.5">
        <p className="mono text-[10px] leading-relaxed text-[var(--ink-s)]">
          {live ? <span className="text-[#ffb27a]">v{live.version} live · {shortDate(live.approved_at)}</span> : "no prompt yet"}<br />
          {feeding} pattern{feeding === 1 ? "" : "s"} · {stds} standard{stds === 1 ? "" : "s"}
        </p>
        {live ? <CopyButton text={live.body} label="Copy" /> : <button type="button" className="btn-d" onClick={onOpen}>Open</button>}
      </div>
    </div>
  );
}

export default function PlaybooksPage() {
  const { data, isLoading, error } = usePlaybooks();
  const refresh = useRefreshPlaybooks();
  const qc = useQueryClient();
  const setData = (fn) => qc.setQueryData(PLAYBOOKS_KEY, (d) => (d ? fn(d) : d));
  const [params, setParams] = useSearchParams();
  const tab = ["brain", "standards", "approve"].includes(params.get("tab")) ? params.get("tab") : "brain";
  const areaSlug = params.get("area") || "";
  const pkgKey = params.get("package") || "";
  const [busy, setBusy] = useState(false);

  const setP = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => { if (!v) next.delete(k); else next.set(k, v); });
    setParams(next);
  };

  const d = data || { areas: [], prompts: [], logs: [], patterns: [], standards: [], checks: [], profiles: [], clients: [], state: {} };
  const pendingByArea = useMemo(() => {
    const m = {};
    d.patterns.filter((p) => p.status === "proposed").forEach((p) => { m[p.area_id] = (m[p.area_id] || 0) + 1; });
    d.prompts.filter((p) => p.status === "draft").forEach((p) => { m[p.area_id] = (m[p.area_id] || 0) + 1; });
    return m;
  }, [d.patterns, d.prompts]);
  const pendingTotal = d.patterns.filter((p) => p.status === "proposed").length + d.prompts.filter((p) => p.status === "draft").length;
  const area = d.areas.find((a) => a.slug === areaSlug) || null;
  const pkg = pkgKey ? packageByKey(pkgKey) : null;

  return (
    <div className={`agx pbk grain-d relative overflow-hidden ${busy ? "busy" : ""}`}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] opacity-70"><Starfield /></div>
      <div className="pbk-wrap">
        <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-[var(--hair-d)] pb-4 pt-5">
          <div className="min-w-0">
            <p className="eyebrow flex items-center gap-2"><span className="inline-block h-[9px] w-[9px]" style={{ background: "linear-gradient(#ff3c00,#ff3c00) center/100% 1.5px no-repeat, linear-gradient(#ff3c00,#ff3c00) center/1.5px 100% no-repeat" }} />(Agents)</p>
            <h1 className="mt-1.5 text-[30px] font-semibold leading-[0.95] tracking-[-0.045em] text-white md:text-[40px]">Playbook <span className="text-[#ff3c00]">/Brain</span></h1>
            <p className="mt-2 max-w-xl text-[13px] text-[var(--ink-m)]">Learns how you build from every request, keeps a foundation prompt ready for each kind of work, and holds every client to the same standards.</p>
          </div>
          <GlideTabs value={area ? "" : tab} onChange={(k) => setP({ tab: k === "brain" ? "" : k, area: "" })} options={[["brain", "Brain", Brain], ["standards", "Standards", Grid3x3], ["approve", "Approve", Inbox, pendingTotal]]} />
        </header>

        {isLoading ? (
          <div className="grid min-h-[50vh] place-items-center"><div className="flex items-center gap-3 text-[13px] text-[var(--ink-m)]"><Spinner size={18} />Waking the brain…</div></div>
        ) : error ? (
          <div className="grid min-h-[40vh] place-items-center text-[13px] text-[#ff8a7f]">Couldn't load playbooks: {String(error.message || error)}</div>
        ) : area ? (
          <AreaView key={area.id} area={area} data={d} refresh={refresh} onBack={() => setP({ area: "" })} />
        ) : tab === "standards" ? (
          <StandardsMatrix data={d} setData={setData} />
        ) : tab === "approve" ? (
          <ApproveQueue data={d} refresh={refresh} />
        ) : (
          <div className="space-y-5 pt-5">
            <div className="grid gap-5 lg:grid-cols-[1.55fr_1fr]">
              <div className="card overflow-hidden p-2 md:p-3">
                <BrainVisual areas={d.areas} prompts={d.prompts} pendingByArea={pendingByArea} logs={d.logs} busy={busy} onPickArea={(a) => setP({ area: a.slug })} />
              </div>
              <div className="space-y-3">
                <StatTiles logs={d.logs} patterns={d.patterns} prompts={d.prompts} standards={d.standards} checks={d.checks} />
                <RunPanel state={d.state} refresh={refresh} setBusy={setBusy} />
              </div>
            </div>

            {pkg ? (
              <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-[var(--ink-m)]">
                Highlighting the playbooks behind <span className="text-white">{pkg.label}</span>
                <button type="button" className="chip" onClick={() => setP({ package: "" })}><X className="h-3 w-3" />Show all</button>
              </div>
            ) : null}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {d.areas.map((a) => (
                <AreaCard key={a.id} area={a} data={d} pending={pendingByArea[a.id] || 0} highlight={!!pkg && (a.linked_packages || []).includes(pkg.key)} onOpen={() => setP({ area: a.slug })} />
              ))}
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <Ticker logs={d.logs} areas={d.areas} />
              <TeachForm areas={d.areas} clients={d.clients} refresh={refresh} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
