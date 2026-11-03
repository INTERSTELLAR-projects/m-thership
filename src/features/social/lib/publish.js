import { base44 } from "@/api/base44Client";
import { dataUrlToBlob, postToJpeg, slugify } from "./exportPng";
import { updatePost } from "./socialStore";

// Approve / schedule / publish helpers for the Social Studio. The backend publisher
// (base44/functions/social-publish) posts only status "approved" posts with approved_at set,
// and only when image_spec_hash matches the current template+spec (specHash below mirrors
// base44/shared/social.ts exactly).

export const DEFAULT_PUBLISH = {
  timezone: "America/Los_Angeles",
  default_times: ["09:00", "12:00"],
  post_weekends: false,
  max_per_day: 1,
  auto_facebook: false,
  facebook_page_id: "",
  facebook_page_name: "",
  ig_app_user_connector_id: "",
  paused: false,
};

export const SOCIAL_STATUS_KEY = ["social-publish", "status"];

/* ─── Spec hash (keep in sync with base44/shared/social.ts) ─────────── */
export function stableStringify(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  return `{${Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(v[k])}`).join(",")}}`;
}
export function specHash(template, spec) {
  const s = stableStringify({ template: template || "", spec: spec || {} });
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}
export const imageIsStale = (p) => !!p?.image_url && !!p?.image_spec_hash && p.image_spec_hash !== specHash(p.template, p.spec);

/* ─── Time zone helpers (everything is scheduled in the settings zone, Pacific by default) ── */
function partsIn(date, tz) {
  const f = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "short" });
  const o = Object.fromEntries(f.formatToParts(date).map((p) => [p.type, p.value]));
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour % 24, min: +o.minute, s: +o.second, wd: o.weekday };
}
function offsetMs(date, tz) {
  const p = partsIn(date, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - (date.getTime() - date.getMilliseconds());
}
/** "2026-11-10" + "09:00" in tz -> ISO UTC */
export function zonedToIso(dateStr, timeStr, tz = DEFAULT_PUBLISH.timezone) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [hh, mm] = (timeStr || "09:00").split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let ts = guess - offsetMs(new Date(guess), tz);
  ts = guess - offsetMs(new Date(ts), tz); // second pass handles DST edges
  return new Date(ts).toISOString();
}
/** ISO -> { date: "YYYY-MM-DD", time: "HH:MM", weekday } in tz */
export function isoToZoned(iso, tz = DEFAULT_PUBLISH.timezone) {
  const p = partsIn(new Date(iso), tz);
  const pad = (n) => String(n).padStart(2, "0");
  return { date: `${p.y}-${pad(p.m)}-${pad(p.d)}`, time: `${pad(p.h)}:${pad(p.min)}`, weekday: p.wd };
}
export const todayIn = (tz = DEFAULT_PUBLISH.timezone) => isoToZoned(new Date().toISOString(), tz).date;
export function addDays(dateStr, n) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
export const weekdayOf = (dateStr) => new Date(`${dateStr}T12:00:00Z`).getUTCDay(); // 0 Sun
export const tzAbbr = (tz = DEFAULT_PUBLISH.timezone) =>
  new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date()).find((p) => p.type === "timeZoneName")?.value || "";

export function fmtWhen(iso, tz = DEFAULT_PUBLISH.timezone, { short = false } = {}) {
  if (!iso) return "";
  const d = new Date(iso);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", month: "short", day: "numeric" }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }).format(d);
  return short ? `${day} · ${time}` : `${day} · ${time} ${tzAbbr(tz)}`;
}
export const fmtTime = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

/* ─── Slots ─────────────────────────────────────────────────────────── */
const OCCUPYING = ["approved", "publishing", "posted"];
const whenOf = (p) => p.scheduled_at || p.published_at || p.posted_at;

/** Taken slots by zoned day, ignoring `exceptId`. */
function occupancy(posts, tz, exceptId) {
  const byDay = new Map();
  for (const p of posts) {
    if (p.id === exceptId || !OCCUPYING.includes(p.status) || !whenOf(p)) continue;
    const z = isoToZoned(whenOf(p), tz);
    if (!byDay.has(z.date)) byDay.set(z.date, []);
    byDay.get(z.date).push(z.time);
  }
  return byDay;
}

export function slotIsOpen(posts, settings, dateStr, timeStr, exceptId) {
  const s = { ...DEFAULT_PUBLISH, ...settings };
  const occ = occupancy(posts, s.timezone, exceptId).get(dateStr) || [];
  return occ.length < (Number(s.max_per_day) || 1) && !occ.includes(timeStr);
}

/** First open slot on/after `fromDate` (zoned) at one of the default times, at least 10 minutes out. */
export function nextOpenSlot(posts, settings, { fromDate, exceptId } = {}) {
  const s = { ...DEFAULT_PUBLISH, ...settings };
  const times = [...(s.default_times?.length ? s.default_times : DEFAULT_PUBLISH.default_times)].sort();
  const today = todayIn(s.timezone);
  let day = fromDate && fromDate > today ? fromDate : today;
  const soonest = Date.now() + 10 * 60000;
  for (let i = 0; i < 90; i++, day = addDays(day, 1)) {
    const wd = weekdayOf(day);
    if (!s.post_weekends && (wd === 0 || wd === 6)) continue;
    for (const t of times) {
      const iso = zonedToIso(day, t, s.timezone);
      if (Date.parse(iso) < soonest) continue;
      if (slotIsOpen(posts, s, day, t, exceptId)) return { date: day, time: t, iso };
    }
  }
  return null;
}

/** Default suggestion: the planned day at the first open default time, else the next open slot. */
export function suggestSlot(post, posts, settings) {
  const s = { ...DEFAULT_PUBLISH, ...settings };
  if (post?.scheduled_at && Date.parse(post.scheduled_at) > Date.now()) {
    const z = isoToZoned(post.scheduled_at, s.timezone);
    return { ...z, iso: post.scheduled_at };
  }
  if (post?.planned_for && post.planned_for >= todayIn(s.timezone)) {
    for (const t of [...s.default_times].sort()) {
      const iso = zonedToIso(post.planned_for, t, s.timezone);
      if (Date.parse(iso) > Date.now() + 10 * 60000 && slotIsOpen(posts, s, post.planned_for, t, post.id)) return { date: post.planned_for, time: t, iso };
    }
  }
  return nextOpenSlot(posts, s, { fromDate: post?.planned_for, exceptId: post?.id });
}

/* ─── Render + upload ───────────────────────────────────────────────── */
async function uploadPublic(file) {
  const Core = base44.integrations.Core;
  const fn = Core.UploadPublicFile || Core.UploadFile;
  const { file_url } = await fn({ file });
  if (!file_url) throw new Error("Upload returned no URL");
  return file_url;
}

/** Render the live 1080 node to JPEG and upload it publicly. Returns the fields to store on the post. */
export async function renderAndUpload(node, post) {
  const dataUrl = await postToJpeg(node);
  const file = new File([dataUrlToBlob(dataUrl)], `${slugify(post.title || post.spec?.headline)}-${Date.now().toString(36)}.jpg`, { type: "image/jpeg" });
  const image_url = await uploadPublic(file);
  return { image_url, image_spec_hash: specHash(post.template, post.spec), image_rendered_at: new Date().toISOString() };
}

/* ─── Workflow actions ──────────────────────────────────────────────── */
export async function approvePost(post, { iso, targets, user, imageFields }) {
  const data = {
    status: "approved",
    scheduled_at: iso,
    publish_targets: targets,
    approved_at: new Date().toISOString(),
    approved_by: user?.email || "admin",
    publish_error: "",
    declined_at: null,
    declined_reason: "",
    ...(imageFields || {}),
  };
  return updatePost(post.id, data);
}

export const reschedulePost = (id, iso) => updatePost(id, { scheduled_at: iso, publish_error: "" });

export const unschedulePost = (id) => updatePost(id, { status: "draft", approved_at: null, publish_error: "" });

export const declinePost = (id, reason) => updatePost(id, { status: "declined", declined_at: new Date().toISOString(), declined_reason: reason || "", approved_at: null });

export const restoreDraft = (id) => updatePost(id, { status: "draft", declined_at: null, declined_reason: "", publish_error: "" });

async function call(action, args = {}) {
  try {
    const res = await base44.functions.invoke("social-publish", { action, ...args });
    return res.data;
  } catch (e) {
    throw new Error(e?.response?.data?.error || e?.message || "Request failed");
  }
}
export const publishNow = (postId) => call("publish_now", { post_id: postId });
export const fetchSocialStatus = () => call("status");
export const saveSocialSettings = (settings) => call("save_settings", { settings });
export const refreshInsights = (postId) => call("refresh_insights", postId ? { post_id: postId } : {});
export const dryRun = (postId) => call("dry_run", { post_id: postId });

/** Tabs / folders of the studio. */
export const TABS = [
  { key: "draft", label: "Drafts", statuses: ["draft"] },
  { key: "scheduled", label: "Scheduled", statuses: ["approved", "publishing"] },
  { key: "posted", label: "Posted", statuses: ["posted"] },
  { key: "failed", label: "Failed", statuses: ["failed"] },
  { key: "declined", label: "Declined", statuses: ["declined"] },
];
export const tabOf = (status) => (TABS.find((t) => t.statuses.includes(status || "draft")) || TABS[0]).key;
