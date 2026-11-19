import { useMemo } from "react";
import { useList } from "@/lib/useData";
import { KIND_CHANNEL, RUNNER_LABEL, nextCronRun } from "./meta";

const ts = (d) => (d ? new Date(d).getTime() || 0 : 0);
const runTime = (r) => r.finished_at || r.started_at || r.created_date;
const norm = (s) => String(s || "").trim().toLowerCase();

// One list of every automation:
//  - AutomationCatalog (Claude scheduled tasks + Base44 workflows / functions / webhooks / endpoints)
//  - Automation (per-client automation records, incl. ones still being set up)
// Last run = the newer of the catalog snapshot and the live AutomationRun log.
export function useAutomationHub() {
  const catalog = useList("AutomationCatalog", { sort: "name", limit: 500 });
  const registry = useList("Automation", { sort: "-updated_date", limit: 500 });
  const runs = useList("AutomationRun", { sort: "-created_date", limit: 400 });
  const clients = useList("CRMClient", { sort: "business", limit: 500 });
  const meta = useList("AppSettings", { filter: { key: "automation_catalog" }, limit: 1 });

  const rows = useMemo(() => {
    const now = Date.now();
    const runList = runs.data || [];
    const latestBy = (pred) => runList.filter(pred).sort((a, b) => ts(runTime(b)) - ts(runTime(a)))[0] || null;
    const clientName = Object.fromEntries((clients.data || []).map((c) => [c.id, c.business]));

    const fromCatalog = (catalog.data || []).map((e) => {
      const match = new Set((e.run_match || []).map(norm));
      const live = match.size ? latestBy((r) => match.has(norm(r.automation_name))) : null;
      let lastAt = e.last_run_at || null;
      let lastStatus = e.last_status || (lastAt ? "unknown" : "never");
      if (live && ts(runTime(live)) > ts(lastAt)) { lastAt = runTime(live); lastStatus = live.status || "success"; }
      const cronNext = e.enabled !== false && e.cron ? nextCronRun(e.cron) : null;
      const snapNext = e.enabled !== false && e.next_run_at && ts(e.next_run_at) > now ? new Date(e.next_run_at) : null;
      const enabled = e.enabled !== false;
      return {
        id: e.id, key: e.key, origin: "catalog", source: e.source, name: e.name,
        description: e.description || "", how: e.how_it_works || "", schedule: e.schedule_human || (e.cron ? e.cron : "On event"),
        cron: e.cron || "", scope: e.scope || (e.client_ids?.length ? "client" : "agency"),
        clientIds: e.client_ids || [], clientNames: (e.client_names?.length ? e.client_names : (e.client_ids || []).map((id) => clientName[id]).filter(Boolean)),
        channels: e.channels || [], enabled,
        status: !enabled ? "paused" : lastStatus === "failed" ? "failing" : "on",
        lastAt, lastStatus, nextAt: cronNext || snapNext, externalId: e.external_id || "", notes: e.notes || "",
        snapshotAt: e.snapshot_at || e.updated_date,
        liveRuns: match.size ? runList.filter((r) => match.has(norm(r.automation_name))).length : null,
        lastRun: live, kind: e.kind || "",
      };
    });

    const fromRegistry = (registry.data || []).map((a) => {
      const live = latestBy((r) => (r.automation_id && r.automation_id === a.id) || (r.client_id === a.client_id && norm(r.automation_name) === norm(a.name)));
      let lastAt = a.last_run_at || null;
      let lastStatus = a.last_result || (lastAt ? "unknown" : "never");
      if (live && ts(runTime(live)) > ts(lastAt)) { lastAt = runTime(live); lastStatus = live.status || "success"; }
      const status = a.status === "paused" ? "paused" : a.status === "error" || lastStatus === "failed" ? "failing" : a.status === "setup" ? "setup" : "on";
      return {
        id: a.id, key: `registry:${a.id}`, origin: "registry", source: "client_registry", name: a.name,
        description: a.notes || "Per-client automation tracked on the client's Automations tab.",
        how: [RUNNER_LABEL[a.runner] || a.runner, a.schedule, a.target_url ? `writes to ${a.target_url}` : "", a.portal_visible === false ? "hidden from the client portal" : "shown in the client portal"].filter(Boolean).join(" · "),
        schedule: a.schedule || "—", cron: "", scope: "client",
        clientIds: a.client_id ? [a.client_id] : [], clientNames: [a.client_name || clientName[a.client_id] || ""].filter(Boolean),
        channels: [...new Set([KIND_CHANNEL[a.kind] || "mothership_records", ...(a.portal_visible === false ? [] : ["portal"])])],
        enabled: a.status !== "paused", status, lastAt, lastStatus,
        nextAt: a.next_run_at && ts(a.next_run_at) > now ? new Date(a.next_run_at) : null,
        externalId: a.target_app_id ? `app ${a.target_app_id}` : "", notes: a.last_message || "", snapshotAt: a.updated_date,
        liveRuns: a.runs_count ?? null, kind: a.kind, lastRun: live,
      };
    });

    return [...fromCatalog, ...fromRegistry];
  }, [catalog.data, registry.data, runs.data, clients.data]);

  return {
    rows,
    runs: runs.data || [],
    clients: (clients.data || []).filter((c) => c.status !== "Inactive"),
    meta: meta.data?.[0]?.catalogMeta || null,
    isLoading: catalog.isLoading || registry.isLoading,
    error: catalog.error || registry.error,
    refetch: () => { catalog.refetch(); registry.refetch(); runs.refetch(); meta.refetch(); },
  };
}

export const appliesToClient = (row, clientId) => row.clientIds.includes(clientId) || row.scope === "all_clients";
