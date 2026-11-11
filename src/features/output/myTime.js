// My time: where Justin's own minutes go, per client, per day and per week, computed from the work ledger (WorkEntry).
// Pure functions only (no SDK imports) so tests/unit/myTime.test.js can run them in Node.
// Every date is a calendar day in America/Los_Angeles, written as "YYYY-MM-DD"; weeks run Monday to Sunday.

export const TZ = "America/Los_Angeles";
export const AGENCY = "agency";
export const AGENCY_NAME = "Interstellar";
const DAY_MS = 864e5;
const EXCLUDED = new Set(["duplicate", "cancelled"]);
const INVOLVED = new Set(["claude_session", "justin_manual", "team"]);
// Appended to notes when Justin confirms or corrects his minutes. Takes the row off "Needs your minutes".
export const CONFIRM_MARK = "Minutes confirmed by Justin";

const partsFmt = new Intl.DateTimeFormat("en-US", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

// ---- calendar days (Pacific) ----
export function dayKey(v) {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  const p = Object.fromEntries(partsFmt.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
const toUTC = (k) => { const [y, m, d] = k.split("-").map(Number); return Date.UTC(y, m - 1, d); };
const fromUTC = (t) => new Date(t).toISOString().slice(0, 10);
export const addDays = (k, n) => fromUTC(toUTC(k) + n * DAY_MS);
export const weekStart = (k) => addDays(k, -((new Date(toUTC(k)).getUTCDay() + 6) % 7));
export const monthStart = (k) => `${k.slice(0, 8)}01`;
export const monthEnd = (k) => { const [y, m] = k.split("-").map(Number); return fromUTC(Date.UTC(y, m, 0)); };
export const dayLabel = (k, opts = { weekday: "short", month: "short", day: "numeric" }) => new Date(toUTC(k)).toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
export const timeLabel = (iso) => (iso ? new Date(iso).toLocaleTimeString("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit" }) : "");

export const RANGES = [
  { id: "today", label: "Today" }, { id: "week", label: "This week" }, { id: "last_week", label: "Last week" },
  { id: "month", label: "This month" }, { id: "last_30", label: "Last 30 days" }, { id: "custom", label: "Custom" },
];

// { from, to } as inclusive Pacific day keys.
export function rangeFor(id, now = new Date(), custom = {}) {
  const t = dayKey(now);
  const ws = weekStart(t);
  switch (id) {
    case "today": return { from: t, to: t };
    case "yesterday": return { from: addDays(t, -1), to: addDays(t, -1) };
    case "week": return { from: ws, to: addDays(ws, 6) };
    case "last_week": return { from: addDays(ws, -7), to: addDays(ws, -1) };
    case "month": return { from: monthStart(t), to: monthEnd(t) };
    case "last_30": return { from: addDays(t, -29), to: t };
    case "custom": {
      const ok = (s) => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ""));
      const a = ok(custom.from) ? custom.from : ws;
      const b = ok(custom.to) ? custom.to : t;
      return a <= b ? { from: a, to: b } : { from: b, to: a };
    }
    default: return { from: ws, to: addDays(ws, 6) };
  }
}

// ---- entries ----
export const included = (e) => !!e && !EXCLUDED.has(e.status);
export const isDone = (e) => e.status === "done";
export const myMinutes = (e) => Math.max(0, Number(e.manual_minutes) || 0);
// Undated rows mirrored from the old work log stay undated (no date is invented); other rows fall back to when they were logged.
export const entryAt = (e) => e.completed_at || (e.source_type !== "work_log" ? e.created_date : null) || null;
export const entryDay = (e) => dayKey(entryAt(e));

const norm = (s) => String(s || "").trim().toLowerCase();
const isAgencyName = (s) => { const n = norm(s); return !n || n === "agency" || n.startsWith("interstellar"); };

// Returns e -> { key, name }. "agency" and Interstellar names group together; rows with no client_id are matched to a
// client by name (so they join that client's row), otherwise they get their own row under that name.
export function clientResolver(rows = []) {
  const idByName = new Map();
  const nameById = new Map();
  for (const e of rows) {
    if (!e.client_id || e.client_id === AGENCY || !e.client_name) continue;
    if (!nameById.has(e.client_id)) nameById.set(e.client_id, String(e.client_name).trim()); // rows arrive newest first
    if (!idByName.has(norm(e.client_name))) idByName.set(norm(e.client_name), e.client_id);
  }
  return (e) => {
    if (e.client_id === AGENCY) return { key: AGENCY, name: AGENCY_NAME };
    if (e.client_id) return { key: e.client_id, name: nameById.get(e.client_id) || String(e.client_name || "").trim() || "Client" };
    if (isAgencyName(e.client_name)) return { key: AGENCY, name: AGENCY_NAME };
    const id = idByName.get(norm(e.client_name));
    if (id) return { key: id, name: nameById.get(id) };
    return { key: `name:${norm(e.client_name)}`, name: String(e.client_name).trim() };
  };
}

// Rows that count (not duplicate / cancelled) with their Pacific day and client attached.
export function prepare(rows = []) {
  const who = clientResolver(rows);
  const out = [];
  for (const e of rows) {
    if (!included(e)) continue;
    const day = entryDay(e);
    if (!day) continue;
    const c = who(e);
    out.push({ ...e, _day: day, _at: entryAt(e), _key: c.key, _client: c.name, _min: myMinutes(e) });
  }
  return out;
}
export const inRange = (prepared, { from, to }) => prepared.filter((e) => e._day >= from && e._day <= to);

export function summarize(prepared) {
  const s = { minutes: 0, clientMinutes: 0, agencyMinutes: 0, done: 0, clientDone: 0, agencyDone: 0, entries: prepared.length, clients: 0, hasAgency: false, top: null };
  const per = new Map();
  for (const e of prepared) {
    const agency = e._key === AGENCY;
    s.minutes += e._min;
    if (agency) { s.agencyMinutes += e._min; s.hasAgency = true; } else s.clientMinutes += e._min;
    if (isDone(e)) { s.done += 1; if (agency) s.agencyDone += 1; else s.clientDone += 1; }
    const r = per.get(e._key) || { key: e._key, name: e._client, minutes: 0 };
    r.minutes += e._min;
    per.set(e._key, r);
  }
  s.clients = [...per.keys()].filter((k) => k !== AGENCY).length;
  s.top = [...per.values()].filter((r) => r.minutes > 0).sort((a, b) => b.minutes - a.minutes || a.name.localeCompare(b.name))[0] || null;
  return s;
}

// One row per client plus Interstellar, sorted by Justin's time. baselineOf(e) = estimated minutes by hand.
export function byClientTime(prepared, baselineOf = (e) => Number(e.minutes_baseline) || 0) {
  const m = new Map();
  let total = 0;
  for (const e of prepared) {
    const r = m.get(e._key) || { key: e._key, name: e._client, minutes: 0, done: 0, open: 0, baselineMinutes: 0 };
    r.minutes += e._min; total += e._min;
    if (isDone(e)) { r.done += 1; r.baselineMinutes += Math.max(0, Number(baselineOf(e)) || 0); } else r.open += 1;
    m.set(e._key, r);
  }
  const rows = [...m.values()].map((r) => ({ ...r, share: total ? r.minutes / total : 0 }))
    .sort((a, b) => b.minutes - a.minutes || b.done - a.done || a.name.localeCompare(b.name));
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  return { rows, total: { minutes: total, done: sum("done"), open: sum("open"), baselineMinutes: sum("baselineMinutes") } };
}

// Newest day first; each day has its total, the split by client (largest first) and its entries (latest first).
export function byDay(prepared) {
  const m = new Map();
  for (const e of prepared) {
    const d = m.get(e._day) || { day: e._day, minutes: 0, done: 0, segs: new Map(), entries: [] };
    d.minutes += e._min;
    if (isDone(e)) d.done += 1;
    const s = d.segs.get(e._key) || { key: e._key, name: e._client, minutes: 0 };
    s.minutes += e._min;
    d.segs.set(e._key, s);
    d.entries.push(e);
    m.set(e._day, d);
  }
  return [...m.values()].sort((a, b) => b.day.localeCompare(a.day)).map((d) => ({
    day: d.day, minutes: d.minutes, done: d.done,
    segments: [...d.segs.values()].filter((s) => s.minutes > 0).sort((a, b) => b.minutes - a.minutes),
    entries: d.entries.sort((a, b) => String(b._at).localeCompare(String(a._at))),
  }));
}

// ---- "Needs your minutes" ----
export const isConfirmed = (e) => String(e.notes || "").includes(CONFIRM_MARK);
export const isEstimated = (e) => /estimate/i.test(String(e.notes || ""));
export const isMissing = (e) => INVOLVED.has(e.done_by) && !(Number(e.manual_minutes) > 0);
export function needsMinutes(prepared, now = new Date(), days = 14) {
  const from = addDays(dayKey(now), -(days - 1));
  return prepared.filter((e) => e._day >= from && !isConfirmed(e) && (isMissing(e) || isEstimated(e)))
    .sort((a, b) => String(b._at).localeCompare(String(a._at)));
}
export function confirmedNotes(notes, now = new Date()) {
  const n = String(notes || "").trim();
  if (n.includes(CONFIRM_MARK)) return n;
  return `${n ? `${n} ` : ""}${CONFIRM_MARK} ${dayKey(now)}.`;
}
// "Looks right": keeps the minutes, marks them confirmed in notes. Nothing else changes.
export const confirmPatch = (e, now = new Date()) => ({ notes: confirmedNotes(e.notes, now) });
// Typing the real minutes: the same fields the ledger's edit form writes (minutes, baseline from the estimates table
// unless overridden, recomputed saved minutes, row locked, visibility lock left exactly as it was) plus the confirm mark.
export function minutesPatch(e, minutes, baselines = [], now = new Date()) {
  const b = baselines.find((r) => r.key === e.task_type);
  const minutes_baseline = e.baseline_override ? Number(e.minutes_baseline) || 0 : b ? b.minutes : Number(e.minutes_baseline) || 0;
  const manual = Math.max(0, Math.round(Number(minutes) || 0));
  return {
    manual_minutes: manual, minutes_baseline, locked: true,
    minutes_saved_estimate: e.done_by === "justin_manual" ? 0 : Math.max(0, minutes_baseline - manual),
    visibility_locked: e.visibility_locked || false,
    notes: confirmedNotes(e.notes, now),
  };
}

// ---- words ----
export function fmtHM(min) {
  const m = Math.max(0, Math.round(Number(min) || 0));
  const h = Math.floor(m / 60);
  return h ? `${h.toLocaleString("en-US")}h ${String(m % 60).padStart(2, "0")}m` : `${m}m`;
}
export function summaryLine(label, s) {
  if (!s.entries) return `${label}: nothing logged yet.`;
  if (!s.minutes) return `${label}: ${s.done} ${s.done === 1 ? "piece" : "pieces"} of work finished, none of your own time logged yet.`;
  const c = s.clients ? `${s.clients} ${s.clients === 1 ? "client" : "clients"}` : "";
  const across = c && s.hasAgency ? `${c} and Interstellar` : c || "Interstellar";
  return `${label}: ${fmtHM(s.minutes)} across ${across}.${s.top ? ` Most time: ${s.top.name} (${fmtHM(s.top.minutes)}).` : ""}`;
}
