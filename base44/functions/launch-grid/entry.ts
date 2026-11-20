import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';
import { directoriesFor, napMatch, napChecklist } from "../../shared/launchGrid.js";
import { isNational } from "../../shared/unlocks.js";

/*
 * Launch grid (Build Engine, Nov 19 2026). Tracks where a client is listed; never submits anything.
 *   { action: "check", offset, limit }  monthly, read-only: for every listing with a URL, fetch the page and check it
 *                                        resolves and shows the client's NAP. live = resolves + NAP matches; pending =
 *                                        resolves but NAP differs, or doesn't resolve. Workflow "Launch grid — monthly check".
 *   { action: "check_client", client_id }  admin: the same for one client now.
 *   { action: "seed", client_id }        admin: add any missing directory rows for the niche (status missing).
 *   { action: "set", id, status, url, notes }  admin: manual status update.
 *   { action: "missing_checklist", client_id }  admin: ONE task with the client's NAP ready to copy and every missing
 *                                        listing, plus one portal request asking the client for verification codes.
 * Citation submissions stay OFF. The submission service setting (AppSettings "launch_grid") stays unset until Justin picks.
 */
const s = (v: unknown) => (v == null ? "" : String(v));
const arr = (r: any) => (Array.isArray(r) ? r : (r && r.items) || []);
const nowIso = () => new Date().toISOString();

async function napOf(db: any, client: any) {
  const op = (await db.OutreachProfile.filter({ client_id: client.id }, "-updated_date", 1).then(arr).catch(() => []))[0] || {};
  const d = (await db.ClientDossier.filter({ client_id: client.id }, "-updated_date", 1).then(arr).catch(() => []))[0] || {};
  return {
    name: s(op.nap_name || client.business), address: s(op.nap_address), phone: s(op.nap_phone || (client.phones || [])[0]),
    website: s(op.website || client.domain || (client.websites || [])[0]), hours: s(op.hours), description: s(op.description || d.elevator_pitch).slice(0, 750),
  };
}

async function checkOne(db: any, row: any, nap: any) {
  const url = s(row.url);
  if (!/^https?:\/\//i.test(url)) return null;
  let status = "pending", result = "";
  try {
    const res = await fetch(url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (compatible; listing-check)" }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) result = `URL answered ${res.status}`;
    else {
      const html = (await res.text()).slice(0, 1_500_000);
      const m = napMatch(html, nap, row.check || "nap");
      status = m.ok ? "live" : "pending";
      result = m.ok ? "Resolves; NAP matches" : `Resolves; NAP differs (name ${m.name ? "ok" : "missing"}, phone ${m.phone ? "ok" : "missing"}, street ${m.street ? "ok" : "missing"})`;
    }
  } catch (e) {
    result = `Could not load: ${s((e as Error)?.message).slice(0, 80)}`;
  }
  await db.LaunchListing.update(row.id, { status, nap_ok: status === "live", last_checked_at: nowIso(), check_result: result, set_by: "monthly_check" });
  return { id: row.id, status, result };
}

async function checkClient(db: any, client: any) {
  const nap = await napOf(db, client);
  const rows = await db.LaunchListing.filter({ client_id: client.id }, "name", 100).then(arr).catch(() => []);
  const out = [];
  for (const r of rows) { const x = await checkOne(db, r, nap); if (x) out.push(x); }
  return out;
}

async function seed(db: any, client: any) {
  const have = new Set((await db.LaunchListing.filter({ client_id: client.id }, "name", 200).then(arr).catch(() => [])).map((r: any) => r.directory_key));
  let n = 0;
  for (const dir of directoriesFor(client.niche_key || "other", isNational(client))) {
    if (have.has(dir.key)) continue;
    await db.LaunchListing.create({ client_id: client.id, client_name: client.business, directory_key: dir.key, name: dir.name, group: dir.group, check: dir.check, status: "missing", set_by: "seed" });
    n++;
  }
  return n;
}

export default async function (req: Request) {
  try {
    const base44 = createClientFromRequest(req);
    const db = base44.asServiceRole.entities;
    const body = await req.json().catch(() => ({}));
    if (body?.action === "check") {
      const offset = Math.max(0, Number(body.offset) || 0), limit = Math.min(40, Math.max(1, Number(body.limit) || 20));
      const ids = [...new Set((await db.LaunchListing.list("client_id", 2000).then(arr).catch(() => [])).filter((r: any) => s(r.url)).map((r: any) => r.client_id))].slice(offset, offset + limit);
      let checked = 0;
      const t0 = Date.now();
      for (const id of ids) {
        if (Date.now() - t0 > 45000) break;
        const c = await db.CRMClient.get(id).catch(() => null);
        if (c) checked += (await checkClient(db, c)).length;
      }
      return Response.json({ ok: true, clients: ids.length, checked });
    }
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== "admin") return Response.json({ error: "Admins only" }, { status: 403 });
    const client = body?.client_id ? await db.CRMClient.get(s(body.client_id)).catch(() => null) : null;
    if (body?.action === "check_client") {
      if (!client) return Response.json({ error: "Client not found" }, { status: 404 });
      return Response.json({ ok: true, results: await checkClient(db, client) });
    }
    if (body?.action === "seed") {
      if (!client) return Response.json({ error: "Client not found" }, { status: 404 });
      return Response.json({ ok: true, created: await seed(db, client) });
    }
    if (body?.action === "set") {
      const row = await db.LaunchListing.get(s(body.id)).catch(() => null);
      if (!row) return Response.json({ error: "Listing not found" }, { status: 404 });
      const patch: Record<string, unknown> = { set_by: "manual", last_checked_at: nowIso() };
      if (["live", "pending", "missing"].includes(s(body.status))) { patch.status = body.status; patch.nap_ok = body.status === "live"; }
      if (body.url !== undefined) { const u = s(body.url).trim(); if (u && !/^https?:\/\//i.test(u)) return Response.json({ error: "URL must start with https://" }, { status: 400 }); patch.url = u.slice(0, 500); }
      if (body.notes !== undefined) patch.notes = s(body.notes).slice(0, 500);
      return Response.json({ ok: true, listing: await db.LaunchListing.update(row.id, patch) });
    }
    if (body?.action === "missing_checklist") {
      if (!client) return Response.json({ error: "Client not found" }, { status: 404 });
      const rows = await db.LaunchListing.filter({ client_id: client.id, status: "missing" }, "name", 100).then(arr).catch(() => []);
      if (!rows.length) return Response.json({ ok: true, note: "Nothing missing" });
      const dirs = directoriesFor(client.niche_key || "other", isNational(client));
      const missing = rows.map((r: any) => dirs.find((d: any) => d.key === r.directory_key) || { key: r.directory_key, name: r.name, home: "" });
      const nap = await napOf(db, client);
      const text = napChecklist(client, nap, missing);
      const title = `Launch grid checklist: ${client.business}`;
      const open = (await db.Task.filter({ client_id: client.id, title }, "-created_date", 1).then(arr).catch(() => [])).find((t: any) => t.status !== "done");
      const task = open
        ? await db.Task.update(open.id, { notes: text })
        : await db.Task.create({ title, client_id: client.id, client_name: client.business, notes: text, status: "next", source: "automation", priority: 2, portal_visible: false });
      const reqTitle = "Verification codes for your listings";
      const openReq = (await db.ClientRequest.filter({ client_id: client.id, title: reqTitle }, "-created_date", 1).then(arr).catch(() => [])).find((r: any) => !["complete", "declined"].includes(r.status));
      const note = `We're setting up your business listings (${missing.map((m: any) => m.name).join(", ")}). Some of them send a verification code by postcard, phone call, text or email. When one arrives, reply here with the code and which listing it's for.`;
      const request = openReq || await db.ClientRequest.create({
        client_id: client.id, client_name: client.business, kind: "question", title: reqTitle, details: note, client_note: note,
        status: "needs_info", priority: "normal", source: "admin",
      });
      return Response.json({ ok: true, task_id: task.id, request_id: request.id, missing: missing.length });
    }
    return Response.json({ error: "Unknown action" }, { status: 400 });
  } catch (e) {
    return Response.json({ error: s((e as Error)?.message).slice(0, 300) }, { status: 500 });
  }
}
