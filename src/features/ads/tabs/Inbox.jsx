import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Inbox as InboxIcon, Loader2, Sparkles, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { E, KEYS, adsExecute, adsOptimizer, inScope, listRecs, loadSettings } from "../lib/adsApi";
import { money, pct, ratio } from "../lib/metrics";
import { ApproveDialog, Btn, Empty, Notice, Pill, TextArea, fmtDate } from "../ui";

const TYPE_LABEL = {
  budget_increase: "Budget +", budget_decrease: "Budget −", budget_shift: "Budget shift", pause: "Pause", unpause: "Unpause",
  creative_refresh: "Creative fatigue", new_variant: "New variant", audience: "Audience", push_draft: "Push draft", launch: "Launch", other: "Idea",
};
const FILTERS = [
  { key: "proposed", label: "Waiting" },
  { key: "done", label: "Executed / approved" },
  { key: "closed", label: "Rejected / expired / failed" },
];

function changeLines(r) {
  const c = r.proposed_change || {};
  if (r.type === "budget_increase" || r.type === "budget_decrease") {
    const d = c.from ? ((c.to - c.from) / c.from) * 100 : 0;
    return [`Set the daily budget of ad set "${r.target_name}" from ${money(c.from)} to ${money(c.to)} (${d > 0 ? "+" : ""}${Math.round(d)}%) on Meta now.`, `Cap: ${c.max_change_pct}% per ad set per 24h, re-checked against the live budget before applying.`];
  }
  if (r.type === "budget_shift") return [`Lower "${r.target_name}" from ${money(c.from_before)} to ${money(c.from_after)}.`, `Raise "${r.secondary_name}" from ${money(c.to_before)} to ${money(c.to_after)}.`, `Moves ${money(c.amount)}/day; total daily spend stays the same.`];
  if (r.type === "pause") return [`Pause ${r.target_level} "${r.target_name}" on Meta now (stops its spend).`];
  return [`Mark this idea approved. Nothing is changed on Meta.${r.type === "new_variant" ? " A draft creative with this copy is added to Creatives for you to finish and policy-check." : ""}`];
}

function Snapshot({ s }) {
  const w = s?.last_7d || s;
  if (!w || typeof w !== "object" || w.spend === undefined) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {[["7d spend", money(w.spend)], ["conv.", w.conversions ?? "—"], ["CPA", money(w.cpa)], ["ROAS", ratio(w.roas)], ["CTR", pct(w.ctr)], ["freq.", w.frequency ?? "—"]].map(([k, v]) => (
        <span key={k} className="border border-hair bg-paper px-1.5 py-0.5 text-[11px] tabular-nums text-ink/70"><span className="mono-label mr-1 text-[8.5px] text-ink/40">{k}</span>{v}</span>
      ))}
      {s?.prior_7d && <span className="border border-hair px-1.5 py-0.5 text-[11px] text-ink/50">prior 7d CTR {pct(s.prior_7d.ctr)} · ROAS {ratio(s.prior_7d.roas)}</span>}
    </div>
  );
}

export default function Inbox({ clientId = "", readOnly = false }) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState("proposed");
  const [dlg, setDlg] = useState(null); // { rec, decision, clamp? }
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [running, setRunning] = useState(false);
  const q = useQuery({ queryKey: KEYS.recs, queryFn: listRecs });
  const sQ = useQuery({ queryKey: KEYS.settings, queryFn: () => loadSettings() });
  const all = useMemo(() => (q.data || []).filter(inScope(clientId)), [q.data, clientId]);
  const list = all.filter((r) => (filter === "proposed" ? r.status === "proposed" : filter === "done" ? ["executed", "approved"].includes(r.status) : ["rejected", "expired", "failed"].includes(r.status)));

  const refresh = () => { qc.invalidateQueries({ queryKey: KEYS.recs }); qc.invalidateQueries({ queryKey: KEYS.log }); qc.invalidateQueries({ queryKey: KEYS.adsets }); };

  const runNow = async () => {
    setRunning(true);
    try {
      const out = await adsOptimizer({ action: "run" });
      toast({ title: out.skipped ? "Nothing to analyse yet" : `Analysis done: ${out.proposed} proposal${out.proposed === 1 ? "" : "s"}`, description: out.reason || out.summary || "" });
      refresh();
      qc.invalidateQueries({ queryKey: KEYS.learnings });
    } catch (e) {
      toast({ title: "Analysis failed", description: e.message, variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  const decide = async (acceptClamped = false) => {
    const { rec, decision } = dlg;
    setBusy(true);
    try {
      const out = await adsExecute({ action: "decide", recommendation_id: rec.id, decision, note, accept_clamped: acceptClamped });
      if (decision === "approve" && rec.type === "new_variant" && rec.proposed_change?.headline) {
        await E().AdCreative.create({ name: `Variant — ${rec.title}`.slice(0, 120), platform: "meta", source_type: "template", headline: rec.proposed_change.headline, primary_text: rec.proposed_change.primary_text, status: "draft", policy_status: "unchecked", ai_generated: true, client_id: clientId, notes: `From recommendation ${rec.id}` });
        qc.invalidateQueries({ queryKey: KEYS.creatives });
      }
      toast({ title: decision === "reject" ? "Rejected" : out.status === "executed" ? "Applied on Meta" : "Approved" });
      setDlg(null);
      setNote("");
      refresh();
    } catch (e) {
      if (e.body?.clamp) setDlg((d) => ({ ...d, clamp: e.body.clamp, error: e.message }));
      else { toast({ title: "Not applied", description: e.message, variant: "destructive" }); refresh(); }
    } finally {
      setBusy(false);
    }
  };

  const s = sQ.data || {};
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex border border-hair bg-card">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => setFilter(f.key)} className={`h-8 px-3 text-[12px] ${filter === f.key ? "bg-ink text-white" : "text-ink/60 hover:text-ink"}`}>{f.label}</button>
          ))}
        </div>
        <span className="mono-label text-[9.5px] text-ink/45">
          Budget changes capped at {s.max_budget_change_pct || 20}%/day · auto-pause {s.auto_pause?.enabled ? `ON (ROAS < ${s.auto_pause.roas_below})` : "off"}
          {s.last_optimizer_run ? ` · last run ${fmtDate(s.last_optimizer_run)}` : ""}
        </span>
        {!readOnly && <Btn className="ml-auto" onClick={runNow} disabled={running}>{running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}Run analysis now</Btn>}
      </div>

      {q.isLoading ? (
        <p className="py-16 text-center text-[13px] text-ink/50"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Loading…</p>
      ) : !list.length ? (
        <Empty icon={InboxIcon} title={filter === "proposed" ? "Nothing waiting for approval" : "Nothing here yet"}>
          The agent runs daily after the Meta sync and only proposes changes grounded in real numbers. With no data it proposes nothing.
        </Empty>
      ) : (
        <div className="space-y-2">
          {list.map((r) => (
            <div key={r.id} className="border border-hair bg-card p-3.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Pill tone={r.status === "proposed" ? "proposed" : r.status}>{r.status}</Pill>
                <Pill tone="info">{TYPE_LABEL[r.type] || r.type}</Pill>
                {r.source === "rule" && <Pill tone="warn">auto rule</Pill>}
                {r.confidence && <span className="mono-label text-[9px] text-ink/45">{r.confidence} confidence</span>}
                <span className="ml-auto text-[11px] text-ink/45">{fmtDate(r.created_date)}</span>
              </div>
              <h3 className="mt-1.5 text-[14px] font-semibold tracking-[-0.01em]">{r.title}</h3>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink/75">{r.rationale}</p>
              {r.expected_impact && <p className="mt-1 text-[12px] text-ink/55"><span className="mono-label mr-1 text-[8.5px] text-ink/40">Expected</span>{r.expected_impact}</p>}
              {r.type === "new_variant" && r.proposed_change?.headline && (
                <div className="mt-2 border-l-2 border-[#ff6a00] bg-paper px-3 py-2 text-[12.5px]"><strong>{r.proposed_change.headline}</strong><br />{r.proposed_change.primary_text}</div>
              )}
              <Snapshot s={r.metrics_snapshot} />
              {(r.before && Object.keys(r.before).length > 0) && <p className="mt-2 text-[11.5px] text-ink/55">Before {JSON.stringify(r.before)} → after {JSON.stringify(r.after)}</p>}
              {r.error && <p className="mt-2 text-[11.5px] text-[#d83300]">{r.error}</p>}
              {r.status === "proposed" && !readOnly && (
                <div className="mt-3 flex gap-2">
                  <Btn variant="flame" onClick={() => setDlg({ rec: r, decision: "approve" })}><Check className="h-3.5 w-3.5" />{r.executable ? "Approve & apply" : "Approve"}</Btn>
                  <Btn onClick={() => setDlg({ rec: r, decision: "reject" })}><X className="h-3.5 w-3.5" />Reject</Btn>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <ApproveDialog
        open={!!dlg}
        busy={busy}
        title={dlg?.decision === "reject" ? `Reject: ${dlg?.rec?.title}` : dlg?.rec?.title || ""}
        lines={dlg ? (dlg.decision === "reject" ? ["Mark this recommendation rejected. Nothing changes on Meta."] : changeLines(dlg.rec)) : []}
        warning={dlg?.error}
        confirmLabel={dlg?.decision === "reject" ? "Reject" : dlg?.rec?.executable ? "Approve & apply" : "Approve"}
        onClose={() => { setDlg(null); setNote(""); }}
        onConfirm={() => decide(false)}
      >
        <TextArea value={note} onChange={setNote} rows={2} placeholder="Optional note (why) — the agent reads outcomes and notes when it learns" />
        {dlg?.clamp && (
          <Notice tone="warn">
            Allowed today: {money(dlg.clamp.lo)}–{money(dlg.clamp.hi)} (±{dlg.clamp.pct}% from {money(dlg.clamp.baseline)}).
            <div className="mt-2"><Btn variant="ink" disabled={busy} onClick={() => decide(true)}>Apply the capped value {money(dlg.clamp.clamped)} instead</Btn></div>
          </Notice>
        )}
      </ApproveDialog>
    </div>
  );
}
