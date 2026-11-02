import { useCallback, useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { goalDefaults } from "./metrics";

// Loads the primary RevenueGoal; seeds Justin's stated $1M goal the first time.
export default function useRevenueGoal(enabled = true) {
  const [goal, setGoal] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) return undefined;
    let alive = true;
    (async () => {
      const list = await base44.entities.RevenueGoal.list("-created_date", 20).catch(() => []);
      let g = list.find((x) => x.is_primary) || list[0];
      if (!g) g = await base44.entities.RevenueGoal.create(goalDefaults()).catch(() => null);
      if (alive) { setGoal(g || { ...goalDefaults(), id: null }); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [enabled]);

  const save = useCallback(async (fields) => {
    if (!goal) return null;
    const next = goal.id ? await base44.entities.RevenueGoal.update(goal.id, fields) : await base44.entities.RevenueGoal.create({ ...goal, ...fields });
    const merged = { ...goal, ...fields, ...(next || {}) };
    setGoal(merged);
    return merged;
  }, [goal]);

  return { goal, loading, save };
}
