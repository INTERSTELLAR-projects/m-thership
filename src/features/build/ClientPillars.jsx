// Pillars on every client page, near the top: the Brain's 8 pillars, each scored from real Brain data and system
// signals (automation health and lateness, open cracks, requests, content cadence), as a radial of segments
// (green / amber / red, grey = not enough info), a one-line verdict and the top fix with "Send to Claude".
// The portal shows a client-friendly version of the same visual (PillarRadial with portal data).
import { useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Send, Check, Loader2 } from "lucide-react";
import { useList } from "@/lib/useData";
import { scorePillars } from "@/lib/clientPillars";
import { sendCommand } from "./engine";

export const TONE = { green: "#15803d", amber: "#d97706", red: "#dc2626", none: "rgba(0,0,0,0.12)" };

export function useClientPillars(client) {
  const f = { client_id: client?.id };
  const on = !!client?.id;
  const brain = useList("BusinessBrain", { filter: f, limit: 1, sort: "-updated_date", enabled: on });
  const autos = useList("Automation", { filter: f, limit: 200, enabled: on });
  const gaps = useList("ClientGap", { filter: f, limit: 200, enabled: on });
  const reqs = useList("ClientRequest", { filter: f, limit: 200, enabled: on });
  const work = useList("WorkLog", { filter: f, limit: 200, sort: "-date", enabled: on });
  const loading = brain.isLoading || autos.isLoading;
  const pillars = useMemo(() => scorePillars({ brain: (brain.data || [])[0], automations: autos.data, gaps: gaps.data, requests: reqs.data, work: work.data }), [brain.data, autos.data, gaps.data, reqs.data, work.data]);
  return { pillars, loading, brain: (brain.data || [])[0] || null };
}

// Radial of 8 segments; each segment's length is its score, its color its health.
export function PillarRadial({ pillars, size = 168, labels = false }) {
  const r = size / 2 - 10, cx = size / 2, cy = size / 2, n = pillars.length || 8, gap = 0.05;
  const arc = (i, frac) => {
    const a0 = (i / n) * 2 * Math.PI - Math.PI / 2 + gap, a1 = ((i + 1) / n) * 2 * Math.PI - Math.PI / 2 - gap;
    const rr = 18 + (r - 18) * Math.max(0.08, frac);
    const p = (a, R) => `${cx + R * Math.cos(a)},${cy + R * Math.sin(a)}`;
    return `M ${p(a0, 18)} L ${p(a0, rr)} A ${rr} ${rr} 0 0 1 ${p(a1, rr)} L ${p(a1, 18)} A 18 18 0 0 0 ${p(a0, 18)} Z`;
  };
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={pillars.map((p) => `${p.name || p.label}: ${p.score == null ? "not enough info" : p.score}`).join(", ")}>
      {pillars.map((p, i) => <path key={`bg${p.id}`} d={arc(i, 1)} fill="rgba(0,0,0,0.04)" />)}
      {pillars.map((p, i) => <path key={p.id} d={arc(i, p.score == null ? 0.12 : p.score / 100)} fill={TONE[p.tone] || TONE.none} opacity={p.score == null ? 1 : 0.85}><title>{`${p.name || p.label}: ${p.score == null ? "not enough info" : p.score}`}</title></path>)}
      {labels ? null : null}
    </svg>
  );
}

export default function ClientPillars({ client }) {
  const { pillars, loading } = useClientPillars(client);
  const [sent, setSent] = useState({});
  const qc = useQueryClient();
  const send = async (p) => {
    setSent((x) => ({ ...x, [p.id]: "busy" }));
    try { await sendCommand({ client, instruction: `${p.fix} (${p.verdict})`, kind: "command" }); setSent((x) => ({ ...x, [p.id]: "done" })); qc.invalidateQueries({ queryKey: ["ClaudeJob"] }); } catch { setSent((x) => ({ ...x, [p.id]: "" })); }
  };
  if (loading) return <div className="h-[200px] animate-pulse border border-hair bg-paper/60" aria-busy="true" />;
  return (
    <section className="border border-hair bg-paper/80" aria-label="Business pillars" data-testid="client-pillars">
      <div className="grid gap-4 p-4 md:grid-cols-[180px_1fr]">
        <div className="mx-auto"><PillarRadial pillars={pillars} /></div>
        <ul className="grid gap-x-5 gap-y-1.5 sm:grid-cols-2">
          {pillars.map((p) => (
            <li key={p.id} className="min-w-0 border-b border-hair/60 pb-1.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="flex items-center gap-1.5 text-[12.5px] font-medium"><i className="inline-block h-2 w-2 rounded-full" style={{ background: TONE[p.tone] }} />{p.name}</span>
                <span className="font-mono text-[12px] tabular-nums" style={{ color: p.score == null ? "rgba(0,0,0,0.4)" : TONE[p.tone] }}>{p.score == null ? "not enough info" : p.score}</span>
              </div>
              <p className="truncate text-[11.5px] text-ink/55" title={p.verdict}>{p.verdict.replace(`${p.name}: `, "")}</p>
              {p.fix ? (
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[11px] text-ink/45" title={p.fix}>Fix: {p.fix}</p>
                  <button type="button" onClick={() => send(p)} disabled={!!sent[p.id]} className="inline-flex shrink-0 items-center gap-1 text-[11px] text-ink/55 hover:text-[#ff3c00] disabled:opacity-60" aria-label={`Send the ${p.name} fix to Claude`}>
                    {sent[p.id] === "busy" ? <Loader2 className="h-3 w-3 animate-spin" /> : sent[p.id] === "done" ? <Check className="h-3 w-3" /> : <Send className="h-3 w-3" />}{sent[p.id] === "done" ? "Queued" : "Send to Claude"}
                  </button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
