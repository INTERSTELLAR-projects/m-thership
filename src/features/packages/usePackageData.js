import { useCallback, useEffect, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { itemsOf, TASKS_CHANGED } from "@/features/tasks/lib/clients";
import { TIMER_CHANGED } from "@/features/tasks/lib/timer";

const EMPTY = { clients: [], projects: [], tasks: [], templates: [], worklog: [], automations: [], intel: [], orbit: [] };
const LIVE = ["Task", "WorkLog", "Automation", "SeoIntel", "Project", "OrbitSEOClient", "CRMClient"];

const safe = (p) => p.then(itemsOf).catch(() => []);

// Everything the package pages need, loaded once and kept live. Any entity change reloads (debounced).
export default function usePackageData() {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const timer = useRef(null);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);
    const [clients, projects, tasks, templates, worklog, automations, intel, orbit] = await Promise.all([
      safe(base44.entities.CRMClient.list({ sort: "business", limit: 200 })),
      safe(base44.entities.Project.list({ sort: "-updated_date", limit: 300 })),
      safe(base44.entities.Task.list({ sort: "-updated_date", limit: 500 })),
      safe(base44.entities.TaskTemplate.list({ sort: "sort_order", limit: 50 })),
      safe(base44.entities.WorkLog.filter({ date: { $gte: since } }, { sort: "-date", limit: 500 })),
      safe(base44.entities.Automation.list({ sort: "-updated_date", limit: 300 })),
      safe(base44.entities.SeoIntel.list({ sort: "-brief_date", limit: 100 })),
      safe(base44.entities.OrbitSEOClient.list({ sort: "businessName", limit: 200 }))
    ]);
    setData({ clients, projects, tasks, templates, worklog, automations, intel, orbit });
    setUpdatedAt(new Date());
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    const bump = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(load, 600);
    };
    const unsubs = LIVE.map((name) => {
      try {
        return base44.entities[name].subscribe(bump);
      } catch {
        return null;
      }
    });
    window.addEventListener(TASKS_CHANGED, bump);
    window.addEventListener(TIMER_CHANGED, bump);
    const poll = window.setInterval(load, 120000);
    return () => {
      unsubs.forEach((u) => typeof u === "function" && u());
      window.removeEventListener(TASKS_CHANGED, bump);
      window.removeEventListener(TIMER_CHANGED, bump);
      window.clearInterval(poll);
      window.clearTimeout(timer.current);
    };
  }, [load]);

  return { data, loading, updatedAt, reload: load };
}
