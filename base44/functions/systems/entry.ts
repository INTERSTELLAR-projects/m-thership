import { createClientFromRequest } from "npm:@base44/sdk@0.8.57";
import { requireAdmin } from "../../shared/commandServer.ts";
import { SYSTEMS_SOURCE, MOTHERSHIP_APP_ID, KEY_DESIGN_DECISION, factKey, factStatement, scrub } from "../../shared/systemsBrain.ts";

// Systems brain (Møthership > Agents > Systems). Admin only.
//   overview {}  apps, keys, links, the last re-scan and the planned key design. Names only, never values.
//   rescan   {}  refreshes the inventory and flags new or missing secrets:
//                - with the optional BASE44_READONLY_TOKEN secret (a read-only Base44 personal access token), lists
//                  every app in the workspace, its secret NAMES (the API only ever returns masked values, which are
//                  dropped) and its workflow names, then compares them with SystemKey / SystemApp;
//                - without it, checks only Møthership's own keys, by presence (Deno.env.has), never reading a value.
//                New names become SystemKey rows with status unknown (purpose to be traced in the code); names that
//                disappeared are flagged missing. The matching BrainFacts (pillar systems, source "systems inventory")
//                are created or refreshed so the Ask bar can answer about them.
// Never reads, logs, stores or returns a secret value. Never changes another app.
// deno-lint-ignore-file no-explicit-any

const API = "https://app.base44.com/api";
const TOKEN_SECRET = "BASE44_READONLY_TOKEN";
const SCAN_KEY = "systems_scan";
const arr = (v: any) => (Array.isArray(v) ? v : (v && v.items) || []);
const s = (v: unknown) => (v == null ? "" : String(v));
const now = () => new Date().toISOString();
const NAME_RE = /^[A-Za-z0-9_.\-]{1,120}$/;

async function all(ent: any, sort = "-updated_date", n = 500) { return arr(await ent.list(sort, n).catch(() => [])); }

async function api(path: string, token: string) {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/json" }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${path.split("?")[0]}: HTTP ${res.status}`);
  return await res.json();
}

async function upsertFact(db: any, k: any) {
  const qk = factKey(k.app_id, k.name);
  const doc = {
    pillar: "systems", source: SYSTEMS_SOURCE, status: "active", confidence: k.status === "active" ? "high" : "medium",
    date: now().slice(0, 10), question_key: qk, statement: factStatement(k),
    data: { kind: "system_key", system_key_id: k.id, app_id: k.app_id, name: k.name },
  };
  const old = arr(await db.BrainFact.filter({ question_key: qk, status: "active" }, "-updated_date", 1).catch(() => []))[0];
  if (old) await db.BrainFact.update(old.id, { statement: doc.statement, confidence: doc.confidence, date: doc.date, data: doc.data }).catch(() => null);
  else await db.BrainFact.create(doc).catch(() => null);
}

async function overview(db: any) {
  const [apps, keys, links, scanRows, decision] = await Promise.all([
    all(db.SystemApp, "name", 300),
    all(db.SystemKey, "app_name", 600),
    all(db.SystemLink, "from_app", 400),
    db.AppSettings.filter({ key: SCAN_KEY }, "-updated_date", 1).then(arr).catch(() => []),
    db.BrainFact.filter({ question_key: "systems.decision.key_design", status: "active" }, "-updated_date", 1).then(arr).catch(() => []),
  ]);
  return {
    ok: true, apps, keys: keys.map((k: any) => ({ ...k, purpose: scrub(k.purpose) })), links,
    scan: scanRows[0]?.pageSettings || null,
    token_configured: Deno.env.has(TOKEN_SECRET),
    decision: decision[0]?.statement || KEY_DESIGN_DECISION,
  };
}

async function rescan(db: any) {
  const at = now();
  const keys = await all(db.SystemKey, "-updated_date", 600);
  const apps = await all(db.SystemApp, "name", 300);
  const token = Deno.env.has(TOKEN_SECRET) ? (Deno.env.get(TOKEN_SECRET) || "") : ""; // the token is only sent to Base44, never stored or returned
  const result: any = { at, mode: token ? "workspace" : "mothership_only", apps_scanned: 0, new_keys: [], missing_keys: [], new_apps: [], gone_apps: [], errors: [] };

  // app_id -> set of secret NAMES currently on that app
  const current = new Map<string, Set<string>>();
  const appNames = new Map<string, string>(apps.map((a: any) => [a.app_id, a.name]));

  if (token) {
    let list: any[] = [];
    try { list = arr(await api("/apps?fields=id,name,last_deployed_at,app_type", token)); } catch (e) { result.errors.push(s((e as Error).message)); }
    for (const a of list) {
      if (!a?.id) continue;
      appNames.set(a.id, s(a.name));
      try {
        const sec = await api(`/apps/${a.id}/secrets`, token);
        // Only the keys (names) are kept. The masked placeholder values are discarded here.
        current.set(a.id, new Set(Object.keys(sec || {}).filter((n) => NAME_RE.test(n))));
        result.apps_scanned++;
      } catch (e) { result.errors.push(`${a.name}: ${s((e as Error).message)}`); continue; }
      let wfNames: string[] | null = null;
      try { wfNames = arr(await api(`/apps/${a.id}/workflows?limit=200`, token)).map((w: any) => s(w.name)).filter(Boolean); } catch { wfNames = null; }
      const row = apps.find((x: any) => x.app_id === a.id);
      const patch: any = { name: s(a.name), last_deployed_at: a.last_deployed_at || null, secret_names: [...current.get(a.id)!].sort(), last_scan_at: at };
      if (wfNames) patch.workflows = wfNames.sort();
      if (row) await db.SystemApp.update(row.id, patch).catch(() => null);
      else {
        await db.SystemApp.create({ app_id: a.id, role: a.app_type === "user_agent" ? "agent" : "other", functions: [], connectors: [], referenced_not_set: [], notes: "New since the last inventory: role and wiring not traced yet.", ...patch }).catch(() => null);
        result.new_apps.push(s(a.name));
      }
    }
    const listed = new Set(list.map((a: any) => a.id));
    if (list.length) for (const a of apps) if (!listed.has(a.app_id)) result.gone_apps.push(a.name);
  } else {
    // Møthership only: presence check of the names already on record. Values are never read.
    const names = new Set<string>();
    for (const k of keys) if (k.app_id === MOTHERSHIP_APP_ID) { try { if (Deno.env.has(k.name)) names.add(k.name); } catch { /* not readable */ } }
    current.set(MOTHERSHIP_APP_ID, names);
    result.apps_scanned = 1;
  }

  // Compare with the records.
  for (const [appId, names] of current) {
    const onRecord = keys.filter((k: any) => k.app_id === appId);
    for (const name of names) {
      const row = onRecord.find((k: any) => k.name === name);
      if (!row) {
        const created = await db.SystemKey.create({
          name, app_id: appId, app_name: appNames.get(appId) || appId, status: "unknown", presence: "set", kind: "shared_key",
          purpose: "New since the last inventory: purpose not traced yet. Ask Claude to trace where the code uses it.",
          used_by: [], checked_by: [], what_breaks_without_it: "Unknown, ask Justin.", pair_with: "Unknown", rotate_how: "Unknown",
          scan_flag: "new", last_seen_at: at, source_files: [],
        }).catch(() => null);
        result.new_keys.push(`${appNames.get(appId) || appId}: ${name}`);
        if (created) await upsertFact(db, created);
      } else {
        const patch: any = { last_seen_at: at };
        if (row.presence === "referenced_not_set") { patch.presence = "set"; patch.scan_flag = "new"; result.new_keys.push(`${row.app_name}: ${name} (now set)`); }
        else if (row.scan_flag === "missing") patch.scan_flag = "ok";
        await db.SystemKey.update(row.id, patch).catch(() => null);
        if (patch.presence) await upsertFact(db, { ...row, ...patch });
      }
    }
    for (const row of onRecord) {
      if (row.presence !== "set" || names.has(row.name)) continue;
      await db.SystemKey.update(row.id, { scan_flag: "missing" }).catch(() => null);
      result.missing_keys.push(`${row.app_name}: ${row.name}`);
      await upsertFact(db, { ...row, notes: `No longer set on the app (re-scan ${at.slice(0, 10)}). ${s(row.notes)}`.trim(), purpose: `${s(row.purpose)} (Re-scan ${at.slice(0, 10)}: no longer set on ${row.app_name}.)` });
    }
  }
  // Any key without its BrainFact yet gets one, so the Ask bar can always find it.
  const facts = arr(await db.BrainFact.filter({ source: SYSTEMS_SOURCE, status: "active" }, "-updated_date", 600).catch(() => []));
  const have = new Set(facts.map((f: any) => f.question_key));
  const haveIds = new Set(facts.map((f: any) => f.data?.system_key_id).filter(Boolean));
  for (const k of await all(db.SystemKey, "-updated_date", 600)) {
    if (!have.has(factKey(k.app_id, k.name)) && !haveIds.has(k.id)) await upsertFact(db, k);
  }

  const summary = { ...result, new_count: result.new_keys.length, missing_count: result.missing_keys.length, errors: result.errors.slice(0, 20) };
  const prev = arr(await db.AppSettings.filter({ key: SCAN_KEY }, "-updated_date", 1).catch(() => []))[0];
  if (prev) await db.AppSettings.update(prev.id, { pageSettings: summary }).catch(() => null);
  else await db.AppSettings.create({ key: SCAN_KEY, pageSettings: summary }).catch(() => null);
  return summary;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { denied } = await requireAdmin(base44);
    if (denied) return denied;
    const body = await req.json().catch(() => ({}));
    const action = s(body?.action || "overview");
    const db = base44.asServiceRole.entities;
    if (action === "overview") return Response.json(await overview(db));
    if (action === "rescan") return Response.json({ ok: true, scan: await rescan(db) });
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    console.error("systems", (e as Error)?.message);
    return Response.json({ error: (e as Error)?.message || "Systems failed" }, { status: 500 });
  }
});
