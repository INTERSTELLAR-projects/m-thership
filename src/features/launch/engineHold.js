// Global "Engines on hold until all clients are launched" switch (Justin, Nov 4, 2026): no client blog schedule and
// no recurring engine work of any kind starts until EVERY client site is cut over and every profile is complete.
// Stored in AppSettings key "engines_hold" (pageSettings.on). Missing record = ON (fail closed).
// Respected by: startEngine (manual + Claude's auto-press), queueMonth, queueTopicCalendar, saveApprovedTopicCalendar,
// the policy sweep, the server re-queue (functions/launch requeue_engines) and the queue-runner scheduled task.
// Only Justin turns it off (HOLD_OWNER); Claude never does.
import { base44 } from "@/api/base44Client";

export const HOLD_KEY = "engines_hold";
export const HOLD_OWNER = "justin@interstellar-strategies.com";
export const HOLD_CONDITION = "All client sites cut over to the new stack + every client profile complete";
export const HOLD_MESSAGE = "Engines are on hold until every client is launched (all sites cut over + profiles complete). Only Justin can release them on Road to Dec 31.";

export async function loadHold() {
  const row = ((await base44.entities.AppSettings.filter({ key: HOLD_KEY }, "-updated_date", 1).catch(() => [])) || [])[0] || null;
  const on = !row || row.pageSettings?.on !== false;
  return { on, row, ...(row?.pageSettings || {}) };
}

export async function assertEnginesReleased() {
  const h = await loadHold();
  if (h.on) throw new Error(HOLD_MESSAGE);
}

// Gate progress from LaunchItem: every c:<client>:cutover and c:<client>:profile item done (deferred ones excluded).
export function holdProgress(items = []) {
  const live = items.filter((i) => i.status !== "deferred" && /^c:[A-Z]+:(cutover|profile)$/.test(String(i.key || "")));
  const cut = live.filter((i) => i.key.endsWith(":cutover"));
  const prof = live.filter((i) => i.key.endsWith(":profile"));
  const done = (rows) => rows.filter((i) => i.status === "done").length;
  return { cutover: { done: done(cut), total: cut.length }, profile: { done: done(prof), total: prof.length }, met: live.length > 0 && live.every((i) => i.status === "done"), open: live.filter((i) => i.status !== "done") };
}

export async function setHold(on, me) {
  if (!on && String(me?.email || "").toLowerCase() !== HOLD_OWNER) throw new Error("Only Justin can release the engines.");
  const h = await loadHold();
  const pageSettings = { ...(h.row?.pageSettings || {}), on, condition: HOLD_CONDITION, changed_at: new Date().toISOString(), changed_by: me?.email || "" };
  if (h.row) await base44.entities.AppSettings.update(h.row.id, { pageSettings });
  else await base44.entities.AppSettings.create({ key: HOLD_KEY, pageSettings });
  await base44.entities.AutomationRun.create({ automation_name: "Engines hold", kind: "other", status: "success", processed: true, started_at: pageSettings.changed_at, finished_at: pageSettings.changed_at, message: `${on ? "Hold ON" : "Engines RELEASED"} by ${me?.email || "unknown"}` }).catch(() => null);
}
