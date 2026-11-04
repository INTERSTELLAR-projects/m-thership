// Runs the approval-policy sweep for admins: shortly after load, then hourly while Møthership is open.
// Throttled inside runPolicySweep (at most every 20 minutes across tabs). Silent: results land in Live Ops.
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { runPolicySweep } from "./policySweep";

export function usePolicySweep() {
  const qc = useQueryClient();
  useEffect(() => {
    let alive = true;
    const go = async () => {
      const me = await base44.auth.me().catch(() => null);
      if (!alive || !me || me.role !== "admin") return;
      const res = await runPolicySweep({ by: me.email || "justin" }).catch(() => null);
      if (alive && res && ((res.cleared || []).length || (res.engines || []).length)) {
        ["ClaudeJob", "launchWaiting", "EngineStart", "AutomationRun", "approvalPolicy"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      }
    };
    const t = setTimeout(go, 8000);
    const iv = setInterval(go, 60 * 60 * 1000);
    return () => { alive = false; clearTimeout(t); clearInterval(iv); };
  }, [qc]);
}
