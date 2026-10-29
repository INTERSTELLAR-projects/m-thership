// Turns reported automation runs into Møthership state:
// AutomationRun (raw report) -> Automation health + WorkLog (what the client sees) + live check.
// A run only counts as "live" when its URL actually loads (and shows the title when one is given).

const WORK_FROM_KIND: Record<string, string> = {
  blog: "blog", gbp_post: "gbp_post", project_page: "project_page", citations: "citation",
  schema_check: "schema", rich_results: "schema", search_console: "search_console", bing: "bing",
};

const norm = (s: string) => s.toLowerCase().replace(/&amp;/g, "&").replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const bareDomain = (s = "") => s.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0].trim();

export async function checkLive(url?: string, title?: string): Promise<boolean> {
  if (!url || !/^https?:\/\//.test(url)) return false;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12000);
    const res = await fetch(url, { signal: ctrl.signal, redirect: "follow", headers: { "user-agent": "MothershipLiveCheck/1.0" } });
    clearTimeout(t);
    if (!res.ok) return false;
    if (!title) return true;
    const html = norm(await res.text());
    const words = norm(title).split(" ").filter((w) => w.length > 3).slice(0, 6);
    if (!words.length) return true;
    const hits = words.filter((w) => html.includes(w)).length;
    return hits >= Math.ceil(words.length * 0.6);
  } catch {
    return false;
  }
}

// deno-lint-ignore no-explicit-any
export async function processPendingRuns(db: any, limit = 40) {
  const pending = ((await db.AutomationRun.filter({ processed: false }, "created_date", limit)) || [])
    .concat(((await db.AutomationRun.filter({ processed: null }, "created_date", limit)) || []));
  const seen = new Set<string>();
  const out: Record<string, unknown>[] = [];
  let clients: Record<string, unknown>[] | null = null;

  for (const run of pending) {
    if (seen.has(run.id) || run.processed === true) continue;
    seen.add(run.id);

    // Resolve the automation and client.
    let auto = run.automation_id ? await db.Automation.get(run.automation_id).catch(() => null) : null;
    let clientId = run.client_id || auto?.client_id;
    let clientName = run.client_name || auto?.client_name;
    if (!clientId && run.domain) {
      clients ||= await db.CRMClient.list("business", 500);
      const d = bareDomain(run.domain);
      const c = (clients || []).find((x: Record<string, unknown>) => bareDomain(String(x.domain || "")) === d || ((x.websites as string[]) || []).some((w) => bareDomain(w) === d));
      if (c) { clientId = c.id; clientName = c.business; }
    }
    if (clientId && !clientName) {
      const c = await db.CRMClient.get(clientId).catch(() => null);
      clientName = c?.business || "";
    }
    if (!auto && clientId) {
      const list = (await db.Automation.filter({ client_id: clientId }, "-created_date", 100)) || [];
      auto = list.find((a: Record<string, unknown>) => run.automation_name && String(a.name).toLowerCase() === String(run.automation_name).toLowerCase())
        || list.find((a: Record<string, unknown>) => a.kind === run.kind && a.status !== "paused") || null;
      if (!auto && run.automation_name) {
        auto = await db.Automation.create({ client_id: clientId, client_name: clientName, name: run.automation_name, kind: run.kind || "other", runner: "claude_scheduled", status: "active" });
      }
    }
    const kind = run.kind || auto?.kind;

    // Live check + work log.
    let verified = false;
    let workId: string | null = null;
    if (run.status === "success" && run.output_url) verified = await checkLive(run.output_url, run.title);
    const workKind = kind ? WORK_FROM_KIND[kind] : null;
    if (clientId && workKind && run.status === "success") {
      const w = await db.WorkLog.create({
        client_id: clientId, client_name: clientName, kind: workKind,
        title: run.title || run.message || `${workKind.replace("_", " ")} published`,
        url: run.output_url || "", date: String(run.started_at || run.created_date || new Date().toISOString()).slice(0, 10),
        status: verified || !run.output_url ? "live" : "generated", verified_live: verified,
        source: "automation", automation_id: auto?.id || "", portal_visible: true,
      });
      workId = w.id;
    }

    // Automation health.
    if (auto) {
      await db.Automation.update(auto.id, {
        last_run_at: run.started_at || run.created_date || new Date().toISOString(),
        last_result: run.status === "running" ? auto.last_result : run.status,
        last_message: run.message || (run.status === "success" ? (verified ? "Published and verified live" : run.output_url ? "Published, not verified live yet" : "Ran") : ""),
        runs_count: (Number(auto.runs_count) || 0) + 1,
        status: run.status === "failed" ? "error" : auto.status === "paused" ? "paused" : "active",
      });
    }

    await db.AutomationRun.update(run.id, {
      processed: true, verified_live: verified, work_log_id: workId || "", finished_at: new Date().toISOString(),
      client_id: clientId || "", client_name: clientName || "", automation_id: auto?.id || "", kind: kind || "",
    });
    out.push({ id: run.id, client: clientName, kind, status: run.status, verified, work_log_id: workId });
  }
  return out;
}
