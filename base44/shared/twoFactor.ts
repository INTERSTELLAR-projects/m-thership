// Opt-in two-step verification for client-portal logins.
//
// What it protects and how:
// - Portal users never read entities directly (every table is admin-only); all their data comes from backend
//   functions (portal, portal-assistant, the Nøva assistant* tools). Each of those calls requireSecondFactor(),
//   so once a login turns 2-step on, a password (or Google) sign-in alone gets nothing back until that same
//   session passes a second check.
// - A passed check is bound to a SHA-256 hash of the session's access token (TwoFactorSession). The token itself
//   is never stored. A new sign-in is a new token, so it has to pass again.
// - Authenticator app: RFC 6238 TOTP (SHA-1, 6 digits, 30 s, +/-1 step), replay of a used step is refused.
//   The secret is AES-GCM encrypted with the MFA_ENCRYPTION_KEY secret and never leaves the server after setup.
// - Email code: 6 digits, 10 minutes, single use, stored only as a keyed hash; sends are rate limited.
// - Recovery codes: 10 single-use codes, stored only as keyed hashes, shown once.
// - 5 wrong codes lock the check for 15 minutes.
// - Admin logins are not covered: the admin app reads entities directly with the platform session, so an
//   app-level check could not be enforced there. Admin sign-in is protected by Google's own 2-Step Verification.
// deno-lint-ignore-file no-explicit-any

const te = new TextEncoder();
const STEP = 30;
const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
export const EMAIL_TTL_MS = 10 * 60 * 1000;
const SESSION_MAX_MS = 30 * 24 * 60 * 60 * 1000;
const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export const json = (b: unknown, status = 200) => Response.json(b, { status });
const nowIso = () => new Date().toISOString();

function keyMaterial(): string | null {
  const k = Deno.env.get("MFA_ENCRYPTION_KEY") || "";
  return k.length >= 32 ? k : null;
}
export const isConfigured = () => !!keyMaterial();

const hex = (buf: ArrayBuffer) => Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i += 1) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function sha256Hex(s: string) {
  return hex(await crypto.subtle.digest("SHA-256", te.encode(s)));
}

// Keyed hash (HMAC-SHA-256 with the server key) for codes, so a leaked table can't be brute-forced offline.
export async function keyedHash(value: string, purpose: string) {
  const km = keyMaterial();
  if (!km) throw new Error("2-step verification is not configured");
  const key = await crypto.subtle.importKey("raw", te.encode(km), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, te.encode(`${purpose}|${value}`)));
}

async function aesKey() {
  const km = keyMaterial();
  if (!km) throw new Error("2-step verification is not configured");
  const raw = await crypto.subtle.digest("SHA-256", te.encode(`aes-gcm|${km}`));
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}
export async function encryptBytes(plain: Uint8Array) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await aesKey(), plain));
  return `v1.${b64(iv)}.${b64(ct)}`;
}
export async function decryptBytes(blob: string) {
  const [v, iv, ct] = String(blob || "").split(".");
  if (v !== "v1" || !iv || !ct) throw new Error("Bad secret");
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(iv) }, await aesKey(), unb64(ct)));
}

export function base32(bytes: Uint8Array) {
  let bits = 0, val = 0, out = "";
  for (const b of bytes) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += B32[(val << (5 - bits)) & 31];
  return out;
}

async function hotp(secret: Uint8Array, counter: number) {
  const msg = new Uint8Array(8);
  let c = counter;
  for (let i = 7; i >= 0; i -= 1) { msg[i] = c & 0xff; c = Math.floor(c / 256); }
  const key = await crypto.subtle.importKey("raw", secret, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const h = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg));
  const o = h[h.length - 1] & 0x0f;
  const bin = ((h[o] & 0x7f) << 24) | (h[o + 1] << 16) | (h[o + 2] << 8) | h[o + 3];
  return String(bin % 1_000_000).padStart(6, "0");
}

// Returns the accepted time step, or null. Steps at or before lastStep are refused (no replay).
export async function verifyTotp(secret: Uint8Array, code: string, lastStep = -1) {
  const c = String(code || "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const now = Math.floor(Date.now() / 1000 / STEP);
  let hit: number | null = null;
  for (const w of [-1, 0, 1]) {
    const step = now + w;
    const ok = safeEqual(await hotp(secret, step), c);
    if (ok && step > lastStep && hit === null) hit = step;
  }
  return hit;
}

export function newRecoveryCodes(n = 10) {
  const alpha = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: n }, () => {
    const r = crypto.getRandomValues(new Uint8Array(8));
    const s = Array.from(r, (b) => alpha[b % alpha.length]).join("");
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}
export const normRecovery = (c: string) => String(c || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
export const hashRecovery = (c: string) => keyedHash(normRecovery(c), "recovery");

export function sixDigits() {
  const r = crypto.getRandomValues(new Uint32Array(1))[0];
  return String(r % 1_000_000).padStart(6, "0");
}

export function bearerOf(req: Request) {
  const h = req.headers.get("authorization") || req.headers.get("Authorization") || "";
  const m = /^Bearer\s+(.+)$/i.exec(h.trim());
  return m ? m[1].trim() : "";
}
function tokenExpiryMs(token: string) {
  try {
    const p = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return Number(p?.exp) > 0 ? Number(p.exp) * 1000 : 0;
  } catch { return 0; }
}

export const maskEmail = (e: string) => {
  const [u, d] = String(e || "").split("@");
  return d ? `${u.slice(0, 2)}${"•".repeat(Math.max(1, Math.min(6, u.length - 2)))}@${d}` : "";
};

export async function securityRow(db: any, user: any) {
  const rows = (await db.AccountSecurity.filter({ user_id: String(user.id) }, "-created_date", 1)) || [];
  return rows[0] || null;
}
export const isEnabled = (s: any) => !!s && (s.totp_enabled === true || s.email_enabled === true);
export const isLocked = (s: any) => !!s?.locked_until && Date.parse(s.locked_until) > Date.now();

export async function sessionVerified(db: any, user: any, req: Request) {
  const token = bearerOf(req);
  if (!token) return false;
  const h = await sha256Hex(token);
  const rows = (await db.TwoFactorSession.filter({ user_id: String(user.id), token_hash: h }, "-created_date", 5).catch(() => [])) || [];
  return rows.some((r: any) => Date.parse(r.expires_at) > Date.now());
}

export async function markSessionVerified(db: any, user: any, req: Request, method: string) {
  const token = bearerOf(req);
  if (!token) return false;
  const exp = tokenExpiryMs(token);
  const until = Math.min(exp || Date.now() + 12 * 60 * 60 * 1000, Date.now() + SESSION_MAX_MS);
  await db.TwoFactorSession.create({ user_id: String(user.id), token_hash: await sha256Hex(token), method, expires_at: new Date(until).toISOString() });
  // Tidy this user's expired sessions.
  const old = (await db.TwoFactorSession.filter({ user_id: String(user.id) }, "expires_at", 50).catch(() => [])) || [];
  for (const r of old) if (Date.parse(r.expires_at) <= Date.now()) await db.TwoFactorSession.delete(r.id).catch(() => null);
  return true;
}

export async function clearSessions(db: any, userId: string) {
  const rows = (await db.TwoFactorSession.filter({ user_id: String(userId) }, "-created_date", 200).catch(() => [])) || [];
  for (const r of rows) await db.TwoFactorSession.delete(r.id).catch(() => null);
}

export async function recordFailure(db: any, s: any) {
  const n = (Number(s.failed_attempts) || 0) + 1;
  const patch: Record<string, unknown> = { failed_attempts: n };
  if (n >= MAX_FAILS) { patch.locked_until = new Date(Date.now() + LOCK_MS).toISOString(); patch.failed_attempts = 0; }
  await db.AccountSecurity.update(s.id, patch);
  return patch.locked_until ? String(patch.locked_until) : null;
}
export const clearFailures = (db: any, s: any, extra: Record<string, unknown> = {}) =>
  db.AccountSecurity.update(s.id, { failed_attempts: 0, locked_until: null, last_verified_at: nowIso(), ...extra });

// Gate for every backend function that returns portal data. Returns a Response to send back when the caller's
// session still needs its second step, or null to carry on. Admins pass (see the note at the top).
export async function requireSecondFactor(base44: any, req: Request, user: any): Promise<Response | null> {
  if (!user || user.role === "admin") return null;
  const db = base44.asServiceRole.entities;
  let s: any = null;
  try {
    s = await securityRow(db, user);
  } catch {
    return json({ error: "Security check is unavailable. Try again in a moment.", code: "2fa_unavailable" }, 503);
  }
  if (!isEnabled(s)) return null;
  if (await sessionVerified(db, user, req)) return null;
  return json({
    error: "Two-step verification required.",
    code: "2fa_required",
    methods: { totp: s.totp_enabled === true, email: s.email_enabled === true },
    email_hint: maskEmail(user.email),
  }, 428);
}
