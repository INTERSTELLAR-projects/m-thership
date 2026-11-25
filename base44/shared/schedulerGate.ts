// Scheduler gate (Security Foundation v1, Nov 24 2026).
// Scheduled and record-triggered workflow actions run without an admin session, so anyone who knows a function's
// URL could call them. Admins always pass. Every other caller (the scheduler itself, record triggers, or an outsider)
// shares ONE small global budget per action, sized a little above what the schedule needs. An outside caller can
// therefore never run a job more often than its schedule does, burn paid AI or research runs, or send extra email.
// Budgets live in RateLimitBucket (admin-only RLS; only the service role writes it). Fails open on storage errors
// so a storage hiccup never stalls a real schedule.
// deno-lint-ignore-file no-explicit-any
export async function schedulerGate(base44: any, user: any, name: string, perHour: number, perDay: number): Promise<Response | null> {
  if (user?.role === "admin") return null;
  const key = `sched:${name}`;
  const hour = new Date(Math.floor(Date.now() / 3600000) * 3600000).toISOString();
  const day = hour.slice(0, 10);
  try {
    const rl = base44.asServiceRole.entities.RateLimitBucket;
    const row = ((await rl.filter({ key }, "-updated_date", 1)) || [])[0];
    if (!row) { await rl.create({ key, window_start: hour, count: 1, day, day_count: 1 }); return null; }
    const count = row.window_start === hour ? (Number(row.count) || 0) + 1 : 1;
    const dayCount = row.day === day ? (Number(row.day_count) || 0) + 1 : 1;
    if (count > perHour || dayCount > perDay) {
      return Response.json({ error: "Too many requests" }, { status: 429, headers: { "Retry-After": count > perHour ? "3600" : "86400" } });
    }
    await rl.update(row.id, { window_start: hour, count, day, day_count: dayCount });
  } catch (_e) { /* fail open */ }
  return null;
}
