// Live counts for the sidebar: only things that truly need Justin.
//   approvals     = rows waiting at gates whose policy mode is "approve" (auto/notify gates clear themselves)
//   justinMoves   = open Road to Dec 31 launch items owned by Justin
//   financingLate = client payment plans with an installment past due + grace days
// Shares its react-query caches with the Approvals inbox, Road to Dec 31 and Financing pages, so it adds no extra reads there.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { GATES, loadWaiting, loadPolicy, gateMode } from "@/features/launch/gates";
import { useLaunchItems, isLaunchGap } from "@/features/launch/data";
import { lateCount } from "@/features/financing/schedule";

const loadFinancing = () => base44.entities.ClientFinancing.list("-created_date", 500).then((r) => (Array.isArray(r) ? r : [])).catch(() => []);

export function useNavBadges() {
  const waiting = useQuery({ queryKey: ["launchWaiting"], queryFn: loadWaiting, staleTime: 120_000, refetchOnWindowFocus: false });
  const policy = useQuery({ queryKey: ["approvalPolicy"], queryFn: loadPolicy, staleTime: 120_000, refetchOnWindowFocus: false });
  const financing = useQuery({ queryKey: ["clientFinancing"], queryFn: loadFinancing, staleTime: 120_000, refetchOnWindowFocus: false });
  const launch = useLaunchItems();
  return useMemo(() => {
    const approvals = waiting.data
      ? GATES.filter((g) => gateMode(policy.data, g.key) === "approve").reduce((n, g) => n + ((waiting.data[g.key] || []).length), 0)
      : 0;
    const justinMoves = (launch.data || []).filter((i) => isLaunchGap(i) && i.owner === "justin" && !["done", "deferred"].includes(i.status)).length;
    const financingLate = lateCount(financing.data || []);
    return { approvals, justinMoves, financingLate };
  }, [waiting.data, policy.data, launch.data, financing.data]);
}
