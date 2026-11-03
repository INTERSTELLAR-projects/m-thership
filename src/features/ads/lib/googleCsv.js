// Google Ads report CSV import (fallback until a Google Ads API developer token + OAuth client exist).
// Expected: a Campaign (or Ad group) report segmented by Day, exported from Google Ads as CSV.
// Google puts a title line and a date-range line above the header; we find the header row ourselves.
import { E, listAccounts } from "./adsApi";

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let q = false;
  const src = String(text || "").replace(/^﻿/, "");
  const delim = (src.split("\n").find((l) => l.includes("Campaign")) || "").includes("\t") ? "\t" : ",";
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (q) {
      if (ch === '"' && src[i + 1] === '"') { cell += '"'; i++; } else if (ch === '"') q = false; else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += ch;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim()));
}

const NUM = (v) => {
  const s = String(v ?? "").replace(/[$,%\s]/g, "").replace(/^--$/, "");
  const x = Number(s);
  return Number.isFinite(x) ? x : 0;
};

const COLS = {
  day: ["day", "date"],
  campaign: ["campaign"],
  campaign_id: ["campaign id"],
  adgroup: ["ad group"],
  adgroup_id: ["ad group id"],
  cost: ["cost"],
  impressions: ["impr.", "impressions"],
  clicks: ["clicks"],
  conversions: ["conversions"],
  value: ["conv. value", "conversion value", "all conv. value"],
  currency: ["currency code", "currency"],
};

function toIso(d) {
  const s = String(d || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString().slice(0, 10) : "";
}

/** -> { rows: AdMetricDaily-shaped (without account_ref), errors, summary } */
export function mapGoogleReport(text) {
  const grid = parseCsv(text);
  const hi = grid.findIndex((r) => r.map((c) => c.trim().toLowerCase()).includes("campaign") && r.some((c) => /^(cost|impr\.|clicks)$/i.test(c.trim())));
  if (hi < 0) return { rows: [], errors: ["Couldn't find a header row with Campaign and Cost / Impr. / Clicks columns."] };
  const head = grid[hi].map((c) => c.trim().toLowerCase());
  const idx = Object.fromEntries(Object.entries(COLS).map(([k, names]) => [k, head.findIndex((h) => names.includes(h))]));
  if (idx.day < 0) return { rows: [], errors: ["The report has no Day column. In Google Ads, segment the report by Day (Segment → Time → Day) and export again."] };
  const level = idx.adgroup >= 0 ? "adset" : "campaign";
  const out = [];
  const byCampaignDay = new Map();
  for (const r of grid.slice(hi + 1)) {
    const first = String(r[0] || "").trim().toLowerCase();
    if (!first || first.startsWith("total")) continue;
    const date = toIso(r[idx.day]);
    if (!date) continue;
    const campaign = String(r[idx.campaign] || "").trim();
    const cid = idx.campaign_id >= 0 ? String(r[idx.campaign_id]).trim() : `name:${campaign}`;
    const spend = NUM(r[idx.cost]);
    const impressions = NUM(r[idx.impressions]);
    const clicks = NUM(r[idx.clicks]);
    const conversions = idx.conversions >= 0 ? NUM(r[idx.conversions]) : 0;
    const revenue = idx.value >= 0 ? NUM(r[idx.value]) : 0;
    const currency = idx.currency >= 0 ? String(r[idx.currency]).trim() : "USD";
    const base = { date, platform: "google", spend, impressions, clicks, conversions, revenue, currency, source: "csv_import", campaign_external_id: cid };
    if (level === "adset") {
      const ag = String(r[idx.adgroup] || "").trim();
      const agid = idx.adgroup_id >= 0 ? String(r[idx.adgroup_id]).trim() : `name:${campaign}/${ag}`;
      out.push({ ...base, level: "adset", external_id: agid, adset_external_id: agid, name: ag });
    }
    const k = `${cid}|${date}`;
    const c = byCampaignDay.get(k) || { ...base, level: "campaign", external_id: cid, name: campaign, spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0 };
    c.spend += spend; c.impressions += impressions; c.clicks += clicks; c.conversions += conversions; c.revenue += revenue;
    byCampaignDay.set(k, c);
  }
  out.push(...byCampaignDay.values());
  for (const m of out) {
    m.key = `google|${m.level}|${m.external_id}|${m.date}`;
    m.ctr = m.impressions ? Math.round((m.clicks / m.impressions) * 100000) / 1000 : 0;
    m.cpc = m.clicks ? Math.round((m.spend / m.clicks) * 100) / 100 : 0;
    m.cpa = m.conversions ? Math.round((m.spend / m.conversions) * 100) / 100 : 0;
    m.roas = m.spend ? Math.round((m.revenue / m.spend) * 1000) / 1000 : 0;
  }
  const dates = out.map((m) => m.date).sort();
  return { rows: out, errors: [], level, summary: { rows: out.length, campaigns: new Set(out.filter((m) => m.level === "campaign").map((m) => m.external_id)).size, from: dates[0], to: dates[dates.length - 1], spend: [...byCampaignDay.values()].reduce((s, c) => s + c.spend, 0) } };
}

/** Upserts the mapped rows (by key) and the Google AdAccount / AdCampaign mirrors. */
export async function importGoogleRows(rows, { accountName = "Google Ads (CSV import)", clientId = "" } = {}) {
  const accounts = await listAccounts();
  let acct = accounts.find((a) => a.platform === "google" && (a.client_id || "") === clientId);
  if (!acct) acct = await E().AdAccount.create({ platform: "google", account_id: "csv", name: accountName, currency: rows[0]?.currency || "USD", connected: false, source: "csv", client_id: clientId });
  const from = rows.map((r) => r.date).sort()[0];
  const existing = await E().AdMetricDaily.filter({ platform: "google", date: { $gte: from } }, "-date", 10000);
  const byKey = new Map((Array.isArray(existing) ? existing : []).map((r) => [r.key, r]));
  const fresh = [];
  const upd = [];
  for (const r of rows) {
    const row = { ...r, account_ref: acct.id, client_id: clientId };
    const prev = byKey.get(r.key);
    if (prev) upd.push([prev.id, row]); else fresh.push(row);
  }
  for (let i = 0; i < fresh.length; i += 200) await E().AdMetricDaily.bulkCreate(fresh.slice(i, i + 200));
  for (const [id, row] of upd) await E().AdMetricDaily.update(id, row);

  const camps = new Map(rows.filter((r) => r.level === "campaign").map((r) => [r.external_id, r.name]));
  const have = await E().AdCampaign.filter({ platform: "google" }, "-updated_date", 500);
  const haveIds = new Set((Array.isArray(have) ? have : []).map((c) => c.external_id));
  const newCamps = [...camps].filter(([id]) => !haveIds.has(id)).map(([id, name]) => ({ platform: "google", external_id: id, name, account_ref: acct.id, origin: "csv", status: "unknown", client_id: clientId }));
  if (newCamps.length) await E().AdCampaign.bulkCreate(newCamps);
  await E().AdAccount.update(acct.id, { last_synced_at: new Date().toISOString() });
  await E().AdChangeLog.create({ action: "sync", platform: "google", account_ref: acct.id, result: "ok", actor: "csv import", message: `Imported ${fresh.length} new and ${upd.length} updated rows from a Google Ads CSV.` });
  return { created: fresh.length, updated: upd.length, campaigns: newCamps.length };
}
