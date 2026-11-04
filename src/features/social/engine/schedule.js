import { addDays, isoToZoned, todayIn, weekdayOf, zonedToIso } from "../lib/publish";
import { PLATFORMS } from "./platforms";

// SCHEDULE: per-platform best-time auto-queue. Each platform has editable default windows (starting points to test)
// and a daily limit per account; posts from the same brand are spread at least `spread_minutes` apart so platforms
// don't collide; nothing lands in the past or within 15 minutes.

const OCCUPYING = ["approved", "publishing", "posted"];
const ORDER = Object.fromEntries(PLATFORMS.map((p, i) => [p.key, i]));

function occupancy(existing, tz) {
  const times = []; // ms of every taken slot for the brand
  const perDay = new Map(); // `${account or platform}|${date}` -> count
  for (const v of existing) {
    if (!OCCUPYING.includes(v.status)) continue;
    const when = v.scheduled_at || v.published_at;
    if (!when) continue;
    times.push(Date.parse(when));
    const k = `${v.account_id || v.platform}|${isoToZoned(when, tz).date}`;
    perDay.set(k, (perDay.get(k) || 0) + 1);
  }
  return { times, perDay };
}

/**
 * Assign scheduled_at to `queue` (variants), honouring windows, limits, spread and already-scheduled posts.
 * existing = every scheduled/posted variant of the brand (+ legacy SocialPosts mapped to { platform, status, scheduled_at }).
 * Returns [{ id, iso }] (iso null when nothing fits in 60 days).
 */
export function autoQueue(queue, existing, settings, { fromDate } = {}) {
  const tz = settings.timezone || "America/Los_Angeles";
  const spread = Math.max(0, Number(settings.spread_minutes) || 0) * 60000;
  const occ = occupancy(existing, tz);
  const start = fromDate && fromDate > todayIn(tz) ? fromDate : todayIn(tz);
  const soonest = Date.now() + 15 * 60000;
  const sorted = [...queue].sort((a, b) => String(a.idea_id).localeCompare(String(b.idea_id)) || (ORDER[a.platform] ?? 99) - (ORDER[b.platform] ?? 99));
  const out = [];
  for (const v of sorted) {
    const windows = [...(settings.windows?.[v.platform] || ["09:00"])].sort();
    const limit = Number(v.daily_limit || settings.limits?.[v.platform] || 1);
    let iso = null;
    for (let d = 0; d < 60 && !iso; d++) {
      const day = addDays(start, d);
      const wd = weekdayOf(day);
      if (!settings.weekends && (wd === 0 || wd === 6)) continue;
      const key = `${v.account_id || v.platform}|${day}`;
      if ((occ.perDay.get(key) || 0) >= limit) continue;
      for (const w of windows) {
        // Try the window, then nudge forward in spread-sized steps (up to ~2h) to avoid a same-brand collision.
        for (let k = 0; k <= 6 && !iso; k++) {
          const t = Date.parse(zonedToIso(day, w, tz)) + k * Math.max(spread, 5 * 60000);
          if (t < soonest) continue;
          if (spread && occ.times.some((x) => Math.abs(x - t) < spread)) continue;
          iso = new Date(t).toISOString();
        }
        if (iso) break;
      }
      if (iso) {
        occ.times.push(Date.parse(iso));
        occ.perDay.set(key, (occ.perDay.get(key) || 0) + 1);
      }
    }
    out.push({ id: v.id, iso });
  }
  return out;
}

/** Days [from, from+n) as YYYY-MM-DD. */
export const daysFrom = (from, n) => Array.from({ length: n }, (_, i) => addDays(from, i));
