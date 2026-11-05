// Applies the saved approval policy: everything waiting at an "auto" or "notify" gate is cleared with the gate's
// own approval code (approveJob / the same status flip its page uses), and every clear is logged to AutomationRun
// (automation_name "Approval policy", message starting "auto:" or "notify:") so it shows in Live Ops and the
// Commander digest and can be reversed. "approve" gates are never touched. Also presses Start engine for clients
// whose four lights are green (gate engine.start). Runs from the admin layout (on load, then hourly while open,
// at most every 20 minutes) and from Road to Dec 31 > Approval policy > Run now.
import { base44 } from "@/api/base44Client";
import { approveJob } from "@/features/claude/jobs";
import { proposalsFromJob } from "@/features/clients/enrich";
import { loadClientContext } from "@/features/clients/clientContext";
import { GATES, gateMode, loadPolicy, loadWaiting, approveRow, rowTitle, POLICY_KEY } from "./gates";
import { engineChecklist, loadFacts, startEngine } from "./engine";
import { loadHold } from "./engineHold";

const THROTTLE_KEY = "mothership.policySweep.lastRun";
const MIN_GAP_MS = 20 * 60 * 1000;
const ENGINE_GAP_MS = 6 * 60 * 60 * 1000;
let running = null;

const readTs = (k) => { try { return Number(localStorage.getItem(k)) || 0; } catch { return 0; } };
const writeTs = (k) => { try { localStorage.setItem(k, String(Date.now())); } catch { /* storage blocked */ } };

async function log(mode, g, r, message) {
  const now = new Date().toISOString();
  await base44.entities.AutomationRun.create({
    automation_name: "Approval policy", kind: "other", title: `${g.label}: ${rowTitle(g, r)}`.slice(0, 200),
    client_id: r.client_id || "", client_name: r.client_name || "", status: "success", started_at: now, finished_at: now, processed: true,
    message: `${mode}: ${message || `${g.label} cleared by policy`} (gate ${g.key}, record ${g.entity} ${r.id})`,
  }).catch(() => null);
}

// Profile enrichment clears only when every proposal is high-confidence and fills an empty field.
function enrichAccepted(job) {
  const props = proposalsFromJob(job) || [];
  if (!props.length) return null;
  const conflict = props.some((p) => p.confidence !== "high" || /differs|disagree|mismatch|conflict/i.test(String(p.note || "")));
  return conflict ? null : props.map((p) => p.key);
}

async function clearRow(g, r) {
  if (g.entity === "ClaudeJob") {
    if (r.kind === "enrich_profile") {
      const keys = enrichAccepted(r);
      if (!keys) return { skipped: "has low-confidence or conflicting proposals" };
      await approveJob(r, { accepted: keys });
      return { message: `applied ${keys.length} sourced field${keys.length === 1 ? "" : "s"}` };
    }
    await approveJob(r);
    return { message: r.result_summary ? String(r.result_summary).slice(0, 160) : "" };
  }
  if (g.key === "ledger.review") {
    await base44.entities.LedgerTransaction.update(r.id, { review_status: "approved", notes: [r.notes, "Category accepted by approval policy (rule match or high-confidence suggestion)."].filter(Boolean).join(" ") });
    return { message: `categorized as ${r.category}` };
  }
  if (g.key === "inbox.item") {
    await base44.entities.Task.create({
      title: String(r.suggested_title).trim(), category: r.suggested_category || "ops", priority: Number(r.suggested_priority) || 3, status: "next", source: "voice",
      due_date: r.suggested_due_date || null, estimated_days: Number(r.suggested_estimated_days) || 0, notes: `Captured by voice: ${r.raw_text || ""}`,
    });
    await base44.entities.InboxItem.update(r.id, { status: "filed" });
    return { message: "filed as a task" };
  }
  if (g.bulk === "job" || g.bulk === "status") { await approveRow(g, r); return { message: "" }; }
  return { skipped: "no automatic path" };
}

async function autoStartEngines(by, out) {
  // Global hold (Justin): no engine auto-press until every client is launched.
  if ((await loadHold()).on) { out.engines_held = true; return; }
  const [clients, starts, facts] = await Promise.all([
    base44.entities.CRMClient.filter({ status: "Active" }, "business", 100).catch(() => []),
    base44.entities.EngineStart.list("-started_at", 300).catch(() => []),
    loadFacts(),
  ]);
  const started = new Set((starts || []).filter((s) => s.status !== "stopped").map((s) => s.client_id));
  for (const c of clients || []) {
    if (started.has(c.id) || c.plan_status === "inactive") continue;
    try {
      const ctx = await loadClientContext(c);
      const list = engineChecklist(ctx, facts);
      if (!list.length || !list.every((x) => x.ok)) continue;
      await startEngine(c, list, by, { auto: true });
      out.engines.push(c.business);
    } catch (e) { out.errors.push(`${c.business}: ${e?.message || e}`); }
  }
}

export async function runPolicySweep({ by = "claude", force = false } = {}) {
  if (running) return running;
  if (!force && Date.now() - readTs(THROTTLE_KEY) < MIN_GAP_MS) return { skipped: "ran recently" };
  writeTs(THROTTLE_KEY);
  running = (async () => {
    const out = { cleared: [], skipped: [], engines: [], errors: [], at: new Date().toISOString() };
    const policy = await loadPolicy();
    if (!policy?.pageSettings?.saved_at) return { ...out, note: "No saved policy yet." };
    const waiting = await loadWaiting();
    for (const g of GATES) {
      const mode = gateMode(policy, g.key);
      if (mode === "approve" || !g.query) continue;
      const rows = (waiting[g.key] || []).filter((r) => (g.autoIf ? g.autoIf(r) : true));
      for (const r of rows) {
        try {
          const res = await clearRow(g, r);
          if (res.skipped) { out.skipped.push({ gate: g.key, title: rowTitle(g, r), why: res.skipped }); continue; }
          await log(mode, g, r, res.message);
          out.cleared.push({ gate: g.key, mode, title: rowTitle(g, r), client: r.client_name || "" });
        } catch (e) { out.errors.push(`${g.label} · ${rowTitle(g, r)}: ${e?.message || e}`); }
      }
    }
    if (gateMode(policy, "engine.start") !== "approve" && (force || Date.now() - readTs(`${THROTTLE_KEY}.engines`) > ENGINE_GAP_MS)) {
      writeTs(`${THROTTLE_KEY}.engines`);
      await autoStartEngines(by, out);
    }
    const rows = (await base44.entities.AppSettings.filter({ key: POLICY_KEY }, "-updated_date", 1).catch(() => [])) || [];
    if (rows[0]) {
      await base44.entities.AppSettings.update(rows[0].id, { pageSettings: { ...(rows[0].pageSettings || {}), last_sweep: { at: out.at, by, cleared: out.cleared.length, engines: out.engines, errors: out.errors.length } } }).catch(() => null);
    }
    return out;
  })();
  try { return await running; } finally { running = null; }
}
