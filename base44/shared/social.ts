// Social Studio publishing helpers shared by social-publish and social-instagram.
// Instagram API with Instagram Login (graph.instagram.com) via the shared "instagram" connector;
// Facebook Pages via the shared "facebook_pages" connector (graph.facebook.com).

export const IG_GRAPH = "https://graph.instagram.com/v23.0";
export const FB_GRAPH = "https://graph.facebook.com/v23.0";
export const SETTINGS_KEY = "social_studio";

// deno-lint-ignore no-explicit-any
export type Any = any;

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

/** Stable hash of what the image is rendered from. Mirrors specHash() in src/features/social/lib/publish.js exactly. */
export function stableStringify(v: unknown): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(stableStringify).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${stableStringify(o[k])}`).join(",")}}`;
}
export function specHash(template: unknown, spec: unknown): string {
  const s = stableStringify({ template: template || "", spec: spec || {} });
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

export async function settingsRow(db: Any) {
  const rows = (await db.AppSettings.filter({ key: SETTINGS_KEY }, "-created_date", 1).catch(() => [])) || [];
  return rows[0] || null;
}
export async function publishSettings(db: Any) {
  const row = await settingsRow(db);
  return { ...DEFAULT_PUBLISH, ...((row?.pageSettings || {}).publish || {}) };
}
export async function savePublishSettings(db: Any, patch: Record<string, unknown>) {
  const row = await settingsRow(db);
  const allowed = Object.keys(DEFAULT_PUBLISH);
  const clean = Object.fromEntries(Object.entries(patch || {}).filter(([k]) => allowed.includes(k)));
  if (clean.max_per_day !== undefined) clean.max_per_day = Math.max(1, Math.min(4, Number(clean.max_per_day) || 1));
  for (const k of ["post_weekends", "auto_facebook", "paused"]) if (clean[k] !== undefined) clean[k] = clean[k] === true;
  for (const k of ["timezone", "facebook_page_id", "facebook_page_name", "ig_app_user_connector_id"]) if (clean[k] !== undefined) clean[k] = String(clean[k] || "").trim().slice(0, 120);
  if (Array.isArray(clean.default_times)) clean.default_times = (clean.default_times as unknown[]).map(String).filter((t) => /^\d{2}:\d{2}$/.test(t)).slice(0, 6);
  const next = { ...DEFAULT_PUBLISH, ...((row?.pageSettings || {}).publish || {}), ...clean };
  if (row) await db.AppSettings.update(row.id, { pageSettings: { ...(row.pageSettings || {}), publish: next } });
  else await db.AppSettings.create({ key: SETTINGS_KEY, pageSettings: { publish: next } });
  return next;
}

export class GraphError extends Error {
  status: number;
  code: number | null;
  subcode: number | null;
  transient: boolean;
  constructor(message: string, status: number, err: Any) {
    super(message);
    this.status = status;
    this.code = err?.code ?? null;
    this.subcode = err?.error_subcode ?? null;
    const transientCodes = [1, 2, 4, 17, 32, 341, 368, -1, -2];
    this.transient = status >= 500 || status === 0 || err?.is_transient === true || transientCodes.includes(Number(err?.code));
  }
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One Graph call. GET params go in the query string; POST params are form-encoded. Token never logged. */
export async function graph(base: string, path: string, token: string, opts: { method?: string; params?: Record<string, unknown> } = {}) {
  const method = opts.method || "GET";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(opts.params || {})) if (v !== undefined && v !== null && v !== "") params.set(k, String(v));
  params.set("access_token", token);
  const url = `${base}/${path.replace(/^\//, "")}`;
  let res: Response;
  try {
    res = method === "GET"
      ? await fetch(`${url}?${params}`)
      : await fetch(url, { method, headers: { "content-type": "application/x-www-form-urlencoded" }, body: params });
  } catch (e) {
    throw new GraphError(`Network error: ${(e as Error).message}`, 0, null);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body?.error) {
    const err = body?.error || {};
    throw new GraphError(err.error_user_msg || err.message || `HTTP ${res.status}`, res.status, err);
  }
  return body;
}

/** Same call, retried once after a short pause when the error looks transient. */
export async function graphRetry(base: string, path: string, token: string, opts: { method?: string; params?: Record<string, unknown> } = {}) {
  try {
    return await graph(base, path, token, opts);
  } catch (e) {
    if (e instanceof GraphError && e.transient) {
      await pause(3000);
      return await graph(base, path, token, opts);
    }
    throw e;
  }
}

export async function igToken(base44: Any) {
  const { accessToken } = await base44.asServiceRole.connectors.getConnection("instagram");
  if (!accessToken) throw new Error("Instagram connector has no token");
  return accessToken as string;
}

export async function fbUserToken(base44: Any): Promise<string | null> {
  try {
    const { accessToken } = await base44.asServiceRole.connectors.getConnection("facebook_pages");
    return accessToken || null;
  } catch {
    return null;
  }
}

/** The Instagram professional account behind a token. */
export async function igMe(token: string) {
  const me = await graphRetry(IG_GRAPH, "me", token, { params: { fields: "user_id,username,name,account_type,profile_picture_url,followers_count,follows_count,media_count" } });
  return { ...me, ig_id: String(me.user_id || me.id) };
}

export async function fbPages(userToken: string) {
  const r = await graphRetry(FB_GRAPH, "me/accounts", userToken, { params: { fields: "id,name,access_token,category,instagram_business_account{id,username}", limit: 50 } });
  return (r?.data || []) as Any[];
}

export const errText = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 600);
