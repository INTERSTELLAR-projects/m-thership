import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpen, Plus } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { E, KEYS, inScope, listLearnings, listLog } from "../lib/adsApi";
import { Btn, Empty, Panel, Pill, Select, TextInput, fmtDate } from "../ui";

const KINDS = ["hook", "format", "audience", "offer", "placement", "budget", "creative", "other"];

export default function Learnings({ clientId = "", readOnly = false }) {
  const qc = useQueryClient();
  const lQ = useQuery({ queryKey: KEYS.learnings, queryFn: listLearnings });
  const gQ = useQuery({ queryKey: KEYS.log, queryFn: listLog });
  const learnings = useMemo(() => (lQ.data || []).filter(inScope(clientId)), [lQ.data, clientId]);
  const log = useMemo(() => (gQ.data || []).filter(inScope(clientId)), [gQ.data, clientId]);
  const [n, setN] = useState({ kind: "hook", insight: "", evidence: "" });

  const add = async () => {
    try {
      await E().AdLearning.create({ ...n, source: "justin", active: true, confidence: "medium", client_id: clientId });
      setN({ kind: "hook", insight: "", evidence: "" });
      qc.invalidateQueries({ queryKey: KEYS.learnings });
    } catch (e) {
      toast({ title: "Couldn't add", description: e.message, variant: "destructive" });
    }
  };
  const toggle = async (l) => { await E().AdLearning.update(l.id, { active: l.active === false }); qc.invalidateQueries({ queryKey: KEYS.learnings }); };

  return (
    <div className="grid gap-3 xl:grid-cols-[1fr_1.2fr]">
      <Panel label="Learnings" title="What the agent reads every day" bodyClass="space-y-2 p-3.5">
        <p className="text-[12px] text-ink/55">Durable lessons from real results (hooks, formats, audiences, offers). The agent adds them when the numbers support it; you can add your own or switch one off.</p>
        {!readOnly && (
          <div className="grid gap-2 border border-dashed border-hair p-2.5 sm:grid-cols-[110px_1fr]">
            <Select value={n.kind} onChange={(v) => setN((x) => ({ ...x, kind: v }))} options={KINDS} />
            <TextInput value={n.insight} onChange={(v) => setN((x) => ({ ...x, insight: v }))} placeholder="Insight, e.g. Process-proof hooks beat pain hooks on CTR" />
            <TextInput className="sm:col-span-2" value={n.evidence} onChange={(v) => setN((x) => ({ ...x, evidence: v }))} placeholder="Evidence (real numbers)" />
            <Btn className="sm:col-span-2" onClick={add} disabled={!n.insight.trim()}><Plus className="h-3.5 w-3.5" />Add learning</Btn>
          </div>
        )}
        {!learnings.length ? <Empty icon={BookOpen} title="No learnings yet">They appear once there is enough real performance data to learn from.</Empty> : learnings.map((l) => (
          <div key={l.id} className={`border border-hair bg-paper p-2.5 ${l.active === false ? "opacity-50" : ""}`}>
            <div className="flex items-center gap-1.5"><Pill tone="info">{l.kind}</Pill><Pill>{l.source}</Pill><span className="mono-label text-[8.5px] text-ink/40">{l.confidence}</span>
              {!readOnly && <button type="button" onClick={() => toggle(l)} className="ml-auto text-[11px] text-ink/50 hover:text-[#ff3c00]">{l.active === false ? "Turn on" : "Turn off"}</button>}
            </div>
            <p className="mt-1 text-[12.5px] font-medium">{l.insight}</p>
            {l.evidence && <p className="text-[11.5px] text-ink/55">{l.evidence}</p>}
          </div>
        ))}
      </Panel>

      <Panel label="Audit" title="Change log" bodyClass="">
        {!log.length ? <div className="p-3.5"><Empty title="No changes yet">Every sync, approval, budget change, pause, push and launch is recorded here with before/after values.</Empty></div> : (
          <div className="max-h-[640px] overflow-y-auto">
            {log.map((r) => (
              <div key={r.id} className="border-b border-hair px-3.5 py-2 last:border-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill tone={r.result}>{r.result}</Pill><Pill tone="info">{r.action?.replace(/_/g, " ")}</Pill>
                  <span className="truncate text-[12.5px] font-medium">{r.target_name || r.platform || ""}</span>
                  <span className="ml-auto text-[11px] text-ink/45">{fmtDate(r.created_date)} · {r.actor}</span>
                </div>
                {(r.before && Object.keys(r.before).length > 0) && <p className="mt-0.5 break-all font-mono text-[10.5px] text-ink/55">before {JSON.stringify(r.before)} → after {JSON.stringify(r.after)}</p>}
                {r.message && <p className="mt-0.5 line-clamp-2 break-all text-[11.5px] text-ink/55">{r.message}</p>}
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
