// @ts-nocheck
// Client Email Studio core: PURE helpers (no Deno, no database), shared by the email functions and unit-tested in
// tests/unit/emailCore.test.js. Keys are always passed in, never read here.
//   tokens     signed opaque tokens for open / click tracking, double opt-in confirm links (no PII in URLs)
//   tracking   link extraction + rewrite to the click redirect, open pixel
//   personalize merge tags ({{first_name}} ...)
//   time zones wall-clock time in a zone -> UTC instant (scheduling, send-in-their-time-zone)
//   segments   rule evaluation over contacts
//   import     column mapping + row validation
//   webhook    HMAC-SHA256 signature check for the Command System -> automation trigger hook

const enc = new TextEncoder();
export const b64url = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
export const fromB64url = (s) => {
  const b = atob(String(s).replace(/-/g, "+").replace(/_/g, "/") + "===".slice((String(s).length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
const hex = (b) => Array.from(new Uint8Array(b)).map((x) => x.toString(16).padStart(2, "0")).join("");

export async function hmacBytes(key, msg) {
  const raw = typeof key === "string" ? enc.encode(key) : key;
  const k = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, enc.encode(msg)));
}
const sameBytes = (a, b) => {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
};

// token = base64url(payload) + "." + base64url(HMAC(key, purpose + ":" + payload))[0..15]
export async function signToken(key, purpose, payload) {
  const sig = (await hmacBytes(key, `${purpose}:${payload}`)).slice(0, 16);
  return `${b64url(enc.encode(payload))}.${b64url(sig)}`;
}
export async function verifyToken(key, purpose, token) {
  try {
    const [p, s] = String(token || "").split(".");
    if (!p || !s || p.length > 400) return null;
    const payload = new TextDecoder().decode(fromB64url(p));
    const expected = (await hmacBytes(key, `${purpose}:${payload}`)).slice(0, 16);
    return sameBytes(fromB64url(s), expected) ? payload : null;
  } catch {
    return null;
  }
}

// Opaque recipient id: the contact id when there is one, else "h" + keyed hash of the address (never the address).
export async function ridFor(key, contactId, email) {
  if (contactId && /^[A-Za-z0-9_-]{4,64}$/.test(String(contactId))) return String(contactId);
  return `h${hex((await hmacBytes(key, `rid:${String(email || "").trim().toLowerCase()}`)).slice(0, 10))}`;
}

// Tracking payload: src (c = campaign, a = automation step) | id | step | rid | link index (-1 = open)
export const trackPayload = ({ src = "c", id, step = "", rid, link = -1 }) => [src, id, step, rid, link].map((x) => String(x ?? "").replace(/\|/g, "")).join("|");
export function parseTrackPayload(p) {
  const [src, id, step, rid, link] = String(p || "").split("|");
  if (!["c", "a"].includes(src) || !id || !rid) return null;
  return { src, id, step: step || "", rid, link: Number.isFinite(Number(link)) ? Number(link) : -1 };
}

/* ---------------- tracking injection ---------------- */

const HREF = /href\s*=\s*"([^"]*)"/gi;
// Links we never wrap: unsubscribe, mailto/tel, anchors, merge tags, the tracking endpoints themselves.
export const untrackable = (href) => !/^https?:\/\//i.test(href) || /\{\{|email-unsubscribe|email-optout|email-track|email-signup/i.test(href);
export const decodeAmp = (s) => String(s).replace(/&amp;/g, "&");

export function extractLinks(html) {
  const out = [];
  for (const m of String(html || "").matchAll(HREF)) {
    const u = decodeAmp(m[1]).trim();
    if (!untrackable(u) && !out.includes(u) && out.length < 100) out.push(u);
  }
  return out;
}

// makeUrl(index) -> tracked URL (already escaped for an attribute). Links not in `links` are left alone.
export function rewriteLinks(html, links, makeUrl) {
  return String(html || "").replace(HREF, (all, raw) => {
    const i = links.indexOf(decodeAmp(raw).trim());
    return i < 0 ? all : `href="${makeUrl(i)}"`;
  });
}

export function addPixel(html, url) {
  const px = `<img src="${url}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0" />`;
  return /<\/body>/i.test(html) ? html.replace(/<\/body>/i, `${px}</body>`) : `${html}${px}`;
}

/* ---------------- merge tags ---------------- */

export const escHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const FALLBACK = { first_name: "there" };
// Values are HTML-escaped in html mode except URL-ish keys, which are produced by us (unsubscribe_url, review_link).
const RAW_KEYS = new Set(["unsubscribe_url", "review_link", "confirm_url"]);
export function personalize(tpl, vars, html) {
  return String(tpl ?? "").replace(/\{\{\s*([a-z0-9_]+)\s*\}\}/gi, (m, k) => {
    const key = k.toLowerCase();
    let v = vars?.[key];
    if (v === undefined || v === null || String(v).trim() === "") v = FALLBACK[key] ?? "";
    v = String(v);
    return html && !RAW_KEYS.has(key) ? escHtml(v) : v;
  });
}
export function recipientVars(r, extra = {}) {
  const first = r.first_name || String(r.name || "").split(/\s+/)[0] || "";
  const vars = { ...extra, ...(r.vars || {}), first_name: first, last_name: r.last_name || "", name: r.name || [r.first_name, r.last_name].filter(Boolean).join(" ") || first, email: r.email || "" };
  return vars;
}

/* ---------------- time zones ---------------- */

export function validTz(tz) {
  if (!tz || typeof tz !== "string") return false;
  try { new Intl.DateTimeFormat("en-US", { timeZone: tz }); return true; } catch { return false; }
}
// Offset (ms) of `tz` at instant `d`: local wall clock minus UTC.
export function tzOffset(d, tz) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(d).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return asUtc - Math.floor(d.getTime() / 1000) * 1000;
}
// "2026-11-20T09:00" in "America/New_York" -> Date (UTC instant). DST-safe (two passes).
export function zonedToUtc(local, tz) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(String(local || ""));
  if (!m) return null;
  const zone = validTz(tz) ? tz : "UTC";
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let t = guess - tzOffset(new Date(guess), zone);
  t = guess - tzOffset(new Date(t), zone);
  return new Date(t);
}
// Calendar date (YYYY-MM-DD) and MM-DD of an instant in a zone.
export function dayIn(d, tz) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: validTz(tz) ? tz : "UTC" }).format(d);
}

/* ---------------- segments ---------------- */

// field: what the rule looks at. op: comparison. value: string / number (days).
export const SEGMENT_FIELDS = [
  { key: "tag", label: "Tag", ops: ["has", "not_has"] },
  { key: "list", label: "List", ops: ["in", "not_in"] },
  { key: "city", label: "City", ops: ["is", "is_not", "contains"] },
  { key: "state", label: "State", ops: ["is", "is_not"] },
  { key: "zip", label: "ZIP", ops: ["is", "starts_with"] },
  { key: "country", label: "Country", ops: ["is", "is_not"] },
  { key: "created", label: "Added", ops: ["within_days", "before_days"] },
  { key: "last_sent", label: "Last emailed", ops: ["within_days", "not_within_days"] },
  { key: "last_opened", label: "Last opened", ops: ["within_days", "not_within_days"] },
  { key: "last_clicked", label: "Last clicked", ops: ["within_days", "not_within_days"] },
  { key: "field", label: "Custom field", ops: ["is", "contains", "exists", "not_exists"] },
  { key: "source", label: "Source", ops: ["is"] },
];
const norm = (v) => String(v ?? "").trim().toLowerCase();
const TS = { created: "created_at", last_sent: "last_sent_at", last_opened: "last_opened_at", last_clicked: "last_clicked_at" };

export function matchesRule(c, r, now = Date.now()) {
  const op = r?.op;
  const val = norm(r?.value);
  switch (r?.field) {
    case "tag": { const has = (c.tags || []).map(norm).includes(val); return op === "not_has" ? !has : has; }
    case "list": { const has = (c.list_ids || []).includes(String(r.value)); return op === "not_in" ? !has : has; }
    case "city": case "state": case "zip": case "country": case "source": {
      const v = norm(c[r.field]);
      if (op === "is") return v === val;
      if (op === "is_not") return v !== val;
      if (op === "contains") return !!val && v.includes(val);
      if (op === "starts_with") return !!val && v.startsWith(val);
      return false;
    }
    case "created": case "last_sent": case "last_opened": case "last_clicked": {
      const days = Number(r.value);
      if (!Number.isFinite(days) || days < 0) return false;
      const raw = c[TS[r.field]] || (r.field === "created" ? c.created_date : "");
      const t = raw ? Date.parse(raw) : NaN;
      const within = Number.isFinite(t) && now - t <= days * 864e5;
      if (op === "within_days") return within;
      if (op === "not_within_days") return !within;
      if (op === "before_days") return Number.isFinite(t) && now - t > days * 864e5;
      return false;
    }
    case "field": {
      const key = String(r.key || "").trim();
      const v = norm((c.fields || {})[key]);
      if (op === "exists") return !!v;
      if (op === "not_exists") return !v;
      if (op === "is") return v === val;
      if (op === "contains") return !!val && v.includes(val);
      return false;
    }
    default: return false;
  }
}

export function matchSegment(c, seg, now = Date.now()) {
  const rules = (seg?.rules || []).filter((r) => r && r.field);
  if (!rules.length) return true;
  return seg.match === "any" ? rules.some((r) => matchesRule(c, r, now)) : rules.every((r) => matchesRule(c, r, now));
}

export function cleanRules(rules) {
  const keys = new Set(SEGMENT_FIELDS.map((f) => f.key));
  return (Array.isArray(rules) ? rules : []).slice(0, 20).filter((r) => r && keys.has(r.field)).map((r) => {
    const f = SEGMENT_FIELDS.find((x) => x.key === r.field);
    return { field: r.field, op: f.ops.includes(r.op) ? r.op : f.ops[0], value: String(r.value ?? "").slice(0, 120), ...(r.field === "field" ? { key: String(r.key || "").replace(/[^a-z0-9_]/gi, "_").slice(0, 40) } : {}) };
  });
}

/* ---------------- import ---------------- */

export const isEmail = (e) => /^[^\s@<>"',;]+@[^\s@<>"',;]+\.[a-z]{2,}$/i.test(String(e || ""));
export const normEmail = (e) => String(e || "").trim().toLowerCase();
export const IMPORT_TARGETS = ["email", "first_name", "last_name", "name", "phone", "tags", "city", "state", "zip", "country", "timezone", "birthday", "anniversary"];
export const normTags = (v) => (Array.isArray(v) ? v : String(v || "").split(/[;,|]/)).map((t) => norm(t).replace(/\s+/g, "-").slice(0, 40)).filter(Boolean).slice(0, 30);

// Guess a column mapping from header names. Unmapped headers can become custom fields ("field:<key>").
export function guessMapping(headers) {
  const h = headers.map((x) => norm(x).replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""));
  const pick = (names) => h.findIndex((x) => names.includes(x));
  const map = {};
  const guesses = {
    email: ["email", "email_address", "e_mail", "mail"], first_name: ["first_name", "first", "firstname", "given_name"], last_name: ["last_name", "last", "lastname", "surname", "family_name"],
    name: ["name", "full_name", "fullname", "customer", "customer_name"], phone: ["phone", "phone_number", "mobile", "cell"], tags: ["tags", "tag", "labels"],
    city: ["city", "town"], state: ["state", "province", "region"], zip: ["zip", "zipcode", "zip_code", "postal_code", "postcode"], country: ["country"],
    timezone: ["timezone", "time_zone", "tz"], birthday: ["birthday", "birth_date", "dob", "date_of_birth"], anniversary: ["anniversary", "customer_since", "first_job_date"],
  };
  for (const [k, names] of Object.entries(guesses)) { const i = pick(names); if (i >= 0 && !Object.values(map).includes(i)) map[k] = i; }
  return map; // target -> column index
}

const DATE_MD = /^(\d{1,2})[/-](\d{1,2})$/;
const DATE_YMD = /^(\d{4})-(\d{1,2})-(\d{1,2})/;
const DATE_US = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;
export function normDate(v, monthDayOk = false) {
  const s = String(v || "").trim();
  if (!s) return "";
  let m = DATE_YMD.exec(s);
  if (m) return `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`;
  m = DATE_US.exec(s);
  if (m) { const y = m[3].length === 2 ? `19${m[3]}` : m[3]; return `${y}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`; }
  m = DATE_MD.exec(s);
  if (m && monthDayOk) return `${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  return "";
}
export const monthDay = (v) => { const s = String(v || ""); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s.slice(5) : /^\d{2}-\d{2}$/.test(s) ? s : ""; };

// One raw row (array of cells) + mapping {target: colIndex} + custom {key: colIndex} -> contact fields or { error }.
export function rowToContact(cells, mapping, custom = {}) {
  const get = (i) => (i === undefined || i === null || i < 0 ? "" : String(cells[i] ?? "").trim());
  const email = normEmail(get(mapping.email));
  if (!isEmail(email)) return { error: "invalid_email", email };
  const out = { email };
  for (const k of ["first_name", "last_name", "name", "phone", "city", "state", "zip", "country"]) { const v = get(mapping[k]).slice(0, 120); if (v) out[k] = v; }
  const tz = get(mapping.timezone); if (validTz(tz)) out.timezone = tz;
  const bd = normDate(get(mapping.birthday), true); if (bd) out.birthday = bd;
  const an = normDate(get(mapping.anniversary)); if (an) out.anniversary = an;
  const tags = normTags(get(mapping.tags)); if (tags.length) out.tags = tags;
  const fields = {};
  for (const [k, i] of Object.entries(custom || {})) { const key = String(k).replace(/[^a-z0-9_]/gi, "_").toLowerCase().slice(0, 40); const v = get(i).slice(0, 300); if (key && v) fields[key] = v; }
  if (Object.keys(fields).length) out.fields = fields;
  if (!out.name && (out.first_name || out.last_name)) out.name = [out.first_name, out.last_name].filter(Boolean).join(" ");
  if (!out.first_name && out.name) out.first_name = out.name.split(/\s+/)[0];
  return out;
}

export const CONSENT_BASES = { express: "They signed up or asked to hear from us", existing_customer: "Existing customers who bought from us (they can unsubscribe anytime)", double_opt_in: "Confirmed by email (double opt-in)" };

/* ---------------- webhook signature ---------------- */

export async function hookSignature(secret, ts, body) {
  return `v1=${hex(await hmacBytes(secret, `${ts}.${body}`))}`;
}
// ts = unix seconds; tolerance 5 minutes (replay window). Constant-time compare.
export async function verifyHookSignature(secret, ts, body, sig, now = Date.now()) {
  if (!secret) return { ok: false, reason: "key_not_configured" };
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(now / 1000 - t) > 300) return { ok: false, reason: "stale_timestamp" };
  const want = await hookSignature(secret, String(ts), body);
  const got = String(sig || "").trim();
  if (got.length !== want.length) return { ok: false, reason: "bad_signature" };
  let d = 0;
  for (let i = 0; i < got.length; i++) d |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return d === 0 ? { ok: true } : { ok: false, reason: "bad_signature" };
}

// Default secret NAME for a client's trigger key: EMAIL_TRIGGER_KEY_<SLUG> (slug of the business name).
export const triggerSecretName = (business, id = "") => {
  const slug = String(business || "").normalize("NFKD").replace(/[^A-Za-z0-9]+/g, "_").replace(/^_|_$/g, "").toUpperCase().slice(0, 28) || String(id).slice(-8).toUpperCase();
  return `EMAIL_TRIGGER_KEY_${slug}`;
};

/* ---------------- automations ---------------- */

export const WAIT_MS = { hours: 3600e3, days: 864e5 };
export const waitMs = (step) => Math.max(0, Math.min(365, Number(step?.wait_value) || 0)) * (WAIT_MS[step?.wait_unit] || WAIT_MS.days);
// Contact's last sign of life (opened, clicked, or a job/purchase date custom field from the Command System).
export function lastActivity(c) {
  const ts = [c.last_opened_at, c.last_clicked_at, c.fields?.last_job_at, c.fields?.last_purchase_at, c.confirmed_at, c.created_at || c.created_date].map((x) => (x ? Date.parse(x) : NaN)).filter(Number.isFinite);
  return ts.length ? Math.max(...ts) : NaN;
}
