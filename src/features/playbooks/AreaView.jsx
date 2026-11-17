import { useMemo, useState } from "react";
import { ArrowLeft, Copy, Check, GitCompare, History, Sparkles, Layers, ListChecks, Clock } from "lucide-react";
import { Spinner, relTime, Empty, Md } from "@/features/agents/ui";
import { packageByKey } from "@/features/packages/registry";
import { iconFor, livePrompt, lineDiff, copyText, shortDate, agentCall, industryGroup } from "./data";

export function CopyButton({ text, label = "Copy prompt", big = false, disabled }) {
  const [ok, setOk] = useState(false);
  const go = async () => {
    const done = await copyText(text || "");
    setOk(done);
    if (done) setTimeout(() => setOk(false), 1800);
  };
  return (
    <button type="button" onClick={go} disabled={disabled || !text} className={big ? "btn-f !h-11 !px-5 !text-[14px]" : "btn-d"}>
      {ok ? <Check className={big ? "h-4 w-4" : "h-3.5 w-3.5"} /> : <Copy className={big ? "h-4 w-4" : "h-3.5 w-3.5"} />}{ok ? "Copied" : label}
    </button>
  );
}

const STATUS_CHIP = {
  approved: "border-[rgba(255,106,0,.6)] text-[#ffb27a] bg-[rgba(255,60,0,.1)]",
  draft: "border-white/20 text-[var(--ink-m)]",
  retired: "border-white/10 text-[var(--ink-s)]",
};

export function DiffView({ from, to }) {
  const rows = useMemo(() => lineDiff(from?.body || "", to?.body || ""), [from, to]);
  const changed = rows.filter((r) => r.t !== "same").length;
  return (
    <div>
      <p className="mono mb-2 text-[10.5px] text-[var(--ink-s)]">{from ? `v${from.version}` : "empty"} → v{to?.version} · {changed} line{changed === 1 ? "" : "s"} changed</p>
      <div className="prompt-box scroll-d max-h-[460px] overflow-auto rounded-lg border border-[var(--hair-d)] bg-black/30 p-3">
        {rows.map((r, i) => (r.t === "same" && !r.s.trim() ? <div key={i}>&nbsp;</div> : (
          <div key={i} className={r.t === "add" ? "diff-add" : r.t === "del" ? "diff-del" : ""}>{r.t === "add" ? "+ " : r.t === "del" ? "- " : "  "}{r.s || " "}</div>
        )))}
      </div>
    </div>
  );
}

export default function AreaView({ area, data, onBack, refresh }) {
  const { prompts, patterns, standards, logs, clients } = data;
  const Icon = iconFor(area.icon);
  const versions = useMemo(() => prompts.filter((p) => p.area_id === area.id).sort((a, b) => (b.version || 0) - (a.version || 0)), [prompts, area.id]);
  const variants = useMemo(() => [...new Set(versions.map((v) => v.industry).filter(Boolean))], [versions]);
  const allIndustries = useMemo(() => [...new Set(clients.map((c) => industryGroup(c.industry)).filter(Boolean))].sort(), [clients]);
  const [industry, setIndustry] = useState("");
  const live = livePrompt(prompts, area.id, industry);
  const fallback = industry && live && !live.industry;
  const [cmp, setCmp] = useState(null);
  const [variantState, setVariantState] = useState({ busy: false, msg: "", pick: "" });

  const feeding = patterns.filter((p) => p.area_id === area.id && p.status !== "rejected" && (p.count || 0) > 0).sort((a, b) => (b.count || 0) - (a.count || 0));
  const areaStandards = standards.filter((s) => s.area_id === area.id && s.active !== false);

  // "What changed since last client": versions approved after the most recent build started in this area.
  const lastBuild = logs.filter((l) => l.area_id === area.id && l.phase === "build" && l.client_name).sort((a, b) => String(b.said_at).localeCompare(String(a.said_at)))[0];
  const since = lastBuild ? versions.filter((v) => v.status !== "draft" && v.approved_at && v.approved_at > lastBuild.said_at && (v.industry || "") === (industry || "")) : [];

  const prevOf = (v) => versions.find((x) => (x.industry || "") === (v.industry || "") && (x.version || 0) < (v.version || 0) && x.status !== "draft") || versions.find((x) => x.id === v.based_on_id) || null;

  const draftVariant = async () => {
    if (!variantState.pick) return;
    setVariantState((s) => ({ ...s, busy: true, msg: "" }));
    try {
      const r = await agentCall("draft_variant", { area_id: area.id, industry: variantState.pick });
      setVariantState({ busy: false, pick: "", msg: `Drafted ${variantState.pick} v${r.version}. It is waiting in the Approve queue.` });
      refresh();
    } catch (e) {
      setVariantState((s) => ({ ...s, busy: false, msg: String(e.message || e) }));
    }
  };

  return (
    <div className="space-y-5 pt-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1.5 text-[12.5px] text-[var(--ink-m)] hover:text-white"><ArrowLeft className="h-3.5 w-3.5" />All playbooks</button>

      <div className="card overflow-hidden p-5 md:p-6">
        <span className="run-border" />
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[rgba(255,106,0,.4)] bg-[rgba(255,60,0,.1)]"><Icon className="h-5 w-5 text-[#ff8a3d]" /></span>
            <div className="min-w-0">
              <h2 className="text-[24px] font-semibold leading-tight tracking-[-0.03em] text-white">{area.name} <span className="text-[#ff3c00]">/Foundation</span></h2>
              <p className="mt-1 max-w-2xl text-[13px] text-[var(--ink-m)]">{area.description}</p>
              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {(area.linked_packages || []).map((k) => <span key={k} className="mono rounded-md border border-[var(--hair-d)] px-2 py-0.5 text-[10.5px] text-[var(--ink-m)]">{packageByKey(k)?.label || k}</span>)}
              </div>
            </div>
          </div>
          <CopyButton text={live?.body} big label={live ? `Copy prompt · v${live.version}` : "No live prompt yet"} />
        </div>

        {/* industry switcher */}
        <div className="mt-5 flex flex-wrap items-center gap-1.5">
          <button type="button" className={`chip ${!industry ? "on" : ""}`} onClick={() => setIndustry("")}>All industries</button>
          {variants.map((v) => <button key={v} type="button" className={`chip ${industry === v ? "on" : ""}`} onClick={() => setIndustry(v)}>{v}</button>)}
          <span className="mx-1 hidden h-4 w-px bg-white/10 sm:inline-block" />
          <select className="inp !h-7 !text-[12px]" value={variantState.pick} onChange={(e) => setVariantState((s) => ({ ...s, pick: e.target.value, msg: "" }))} aria-label="Industry for a new variant">
            <option value="">+ Draft an industry variant…</option>
            {allIndustries.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
          {variantState.pick ? <button type="button" className="btn-d !h-7" onClick={draftVariant} disabled={variantState.busy}>{variantState.busy ? <Spinner size={12} /> : <Sparkles className="h-3.5 w-3.5" />}Draft it</button> : null}
          {variantState.msg ? <span className="text-[11.5px] text-[var(--ink-m)]">{variantState.msg}</span> : null}
        </div>

        <div className="mt-4">
          {live ? (
            <>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="mono text-[10.5px] text-[var(--ink-s)]">{live.title} · approved {shortDate(live.approved_at)}{fallback ? ` · no ${industry} variant yet, showing the all-industries prompt` : ""}</p>
                <CopyButton text={live.body} />
              </div>
              <div className="prompt-box scroll-d max-h-[520px] overflow-auto rounded-xl border border-[var(--hair-d)] bg-black/35 p-4">{live.body}</div>
            </>
          ) : <Empty>No approved prompt for this area yet. Log requests for it; once you approve a pattern, the agent drafts v1 for you to approve.</Empty>}
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          <div className="card p-5">
            <p className="eyebrow mb-3 flex items-center gap-2"><Clock className="h-3.5 w-3.5" />What changed since the last client</p>
            {lastBuild ? (
              since.length ? (
                <ul className="space-y-2">{since.map((v) => <li key={v.id}><p className="text-[13px] text-white">v{v.version} · {shortDate(v.approved_at)}</p><Md>{v.changelog}</Md></li>)}</ul>
              ) : <p className="text-[13px] text-[var(--ink-m)]">Nothing yet since <span className="text-white">{lastBuild.client_name}</span> started ({shortDate(lastBuild.said_at)}). The next client gets the same foundation.</p>
            ) : <p className="text-[13px] text-[var(--ink-m)]">No client build logged in this area yet. Live version: {live ? `v${live.version}` : "none"}.</p>}
          </div>

          <div className="card p-5">
            <p className="eyebrow mb-3 flex items-center gap-2"><History className="h-3.5 w-3.5" />Version history</p>
            {versions.length ? (
              <ul className="space-y-2.5">
                {versions.map((v) => (
                  <li key={v.id} className="rounded-lg border border-[var(--hair-d)] bg-white/[0.015] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[13px] font-medium text-white">v{v.version}{v.industry ? <span className="text-[var(--ink-m)]"> · {v.industry}</span> : null}</p>
                      <div className="flex items-center gap-2">
                        <span className={`mono rounded-full border px-2 py-0.5 text-[9.5px] uppercase tracking-[.14em] ${STATUS_CHIP[v.status] || STATUS_CHIP.draft}`}>{v.status === "retired" && v.rejected_at ? "rejected" : v.status}</span>
                        <span className="mono text-[10px] text-[var(--ink-s)]">{v.approved_at ? shortDate(v.approved_at) : relTime(v.created_date)}</span>
                        <button type="button" className="btn-d !h-7 !px-2.5 !text-[11.5px]" onClick={() => setCmp(cmp?.id === v.id ? null : v)} aria-expanded={cmp?.id === v.id}><GitCompare className="h-3 w-3" />Diff</button>
                      </div>
                    </div>
                    {v.changelog ? <div className="mt-1.5"><Md>{v.changelog}</Md></div> : null}
                    {cmp?.id === v.id ? <div className="mt-2"><DiffView from={prevOf(v)} to={v} /></div> : null}
                  </li>
                ))}
              </ul>
            ) : <Empty>No versions yet.</Empty>}
          </div>
        </div>

        <div className="space-y-5">
          <div className="card p-5">
            <p className="eyebrow mb-3 flex items-center gap-2"><Layers className="h-3.5 w-3.5" />Patterns feeding it</p>
            {feeding.length ? (
              <ul className="space-y-2">
                {feeding.map((p) => (
                  <li key={p.id} className="rounded-lg border border-[var(--hair-d)] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[13px] font-medium text-white">{p.title}</p>
                      <span className="mono text-[10px] text-[#ff8a3d]">{p.count || 0}× · {p.status}</span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-[var(--ink-m)]">{p.rule}</p>
                    {(p.clients || []).length ? <p className="mono mt-1 text-[10px] text-[var(--ink-s)]">{p.clients.join(" · ")}</p> : null}
                    {p.standard_id ? <p className="mono mt-1 text-[10px] text-[#ffb27a]">Covered by: {standards.find((s) => s.id === p.standard_id)?.title || "a standard"}</p> : null}
                  </li>
                ))}
              </ul>
            ) : <Empty>No patterns yet. Run the agent to cluster your logged requests.</Empty>}
          </div>
          <div className="card p-5">
            <p className="eyebrow mb-3 flex items-center gap-2"><ListChecks className="h-3.5 w-3.5" />Standards this area guarantees</p>
            {areaStandards.length ? (
              <ul className="space-y-1.5">{areaStandards.map((s) => <li key={s.id} className="text-[12.5px] text-[var(--ink-m)]"><span className="text-white">{s.title}</span>{s.industry ? <span className="mono text-[10px] text-[#ff8a3d]"> · {s.industry}</span> : null} · {s.rule}</li>)}</ul>
            ) : <Empty>No standards in this area yet.</Empty>}
          </div>
        </div>
      </div>
    </div>
  );
}
