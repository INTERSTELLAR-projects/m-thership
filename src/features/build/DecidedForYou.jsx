// Command > "Decided for you": everything the taste rule auto-approved (logic, research, best practice), newest
// first, collapsed by default. Override puts the item back in front of Justin (undo through command-execute).
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Undo2, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { undo } from "@/features/command/api";
import { AUTO_NOTE } from "@/lib/approvalLanes";

const KEY = ["AgentAuditLog", "auto_approved"];
const ENTITY = { ClaudeJob: "Claude job", LaunchItem: "Road to Dec 31", FoundationPrompt: "Foundation prompt", AgentLearning: "Agent learning", ProposedAction: "Command card" };

export default function DecidedForYou() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState("");
  const q = useQuery({ queryKey: KEY, queryFn: async () => { const r = await base44.entities.AgentAuditLog.filter({ action: "auto_approved" }, "-at", 200).catch(() => []); return Array.isArray(r) ? r : []; }, staleTime: 60_000 });
  const rows = q.data || [];
  if (!rows.length) return null;
  const live = rows.filter((r) => !r.undone_at);
  const override = async (r) => {
    setBusy(r.id);
    try { await undo(r.id); } catch { /* shown by the row staying */ }
    setBusy(""); qc.invalidateQueries({ queryKey: KEY });
  };
  return (
    <details className="group border border-hair bg-paper/60" data-testid="decided-for-you">
      <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3">
        <span className="text-[13.5px] font-medium">Decided for you <span className="font-mono text-[11px] text-ink/45">{live.length}</span></span>
        <span className="text-[11.5px] text-ink/45 group-open:hidden">Logic and best practice, auto-approved. Open to override.</span>
      </summary>
      <p className="border-t border-hair px-4 py-2 text-[11.5px] text-ink/50">{AUTO_NOTE}. You only approve taste; publishing, DNS, deleting, money and client sends still wait for your tap.</p>
      <ul className="max-h-[420px] divide-y divide-hair overflow-y-auto border-t border-hair">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start gap-3 px-4 py-2">
            <span className="w-[86px] shrink-0 pt-0.5 font-mono text-[10px] uppercase text-ink/40">{ENTITY[r.entity] || r.entity}</span>
            <span className={`min-w-0 flex-1 text-[12.5px] leading-snug ${r.undone_at ? "text-ink/35 line-through" : "text-ink/75"}`}>{String(r.summary || "").replace(`${AUTO_NOTE}: `, "")}</span>
            {r.undone_at ? <span className="shrink-0 font-mono text-[10px] text-ink/35">back with you</span> : r.undo ? (
              <button type="button" onClick={() => override(r)} disabled={busy === r.id} className="inline-flex shrink-0 items-center gap-1 text-[11.5px] text-ink/55 hover:text-[#ff3c00]">
                {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />}Override
              </button>
            ) : null}
          </li>
        ))}
      </ul>
    </details>
  );
}
