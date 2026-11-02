// Where QR codes, templates and scan stats come from.
// adminStore: Møthership admins, straight to entities (all QR entities are admin-only).
// portalStore(call): client portal users, through the `portal` backend function, which scopes
// every action to the signed-in client (qr_list, qr_get, qr_save, qr_delete, qr_stats, qr_tpl_save, qr_tpl_delete).
import { base44 } from "@/api/base44Client";
import { httpUrl, redirectUrl } from "./content";

const E = () => base44.entities;
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ";
export function randomCode(len = 7) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

// Fields the editor never writes: the short link is permanent once minted, and counters belong to the redirect.
const SERVER_OWNED = ["id", "short_code", "encoded_url", "scans", "last_scan_at", "created_date", "updated_date", "created_by", "created_by_id"];
const strip = (payload) => Object.fromEntries(Object.entries(payload || {}).filter(([k]) => !SERVER_OWNED.includes(k)));

export function summarizeScans(scans, days = 30) {
  const list = (scans || []).filter((s) => s.at || s.created_date);
  const dayOf = (s) => String(s.at || s.created_date).slice(0, 10);
  const counts = {};
  const devices = {};
  const os = {};
  let last = null;
  for (const s of list) {
    const d = dayOf(s);
    counts[d] = (counts[d] || 0) + 1;
    devices[s.device || "other"] = (devices[s.device || "other"] || 0) + 1;
    os[s.os || "Other"] = (os[s.os || "Other"] || 0) + 1;
    const at = s.at || s.created_date;
    if (!last || at > last) last = at;
  }
  const series = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000).toISOString().slice(0, 10);
    series.push({ date: d, scans: counts[d] || 0 });
  }
  const sumLast = (n) => series.slice(-n).reduce((a, b) => a + b.scans, 0);
  return { total: list.length, today: sumLast(1), last7: sumLast(7), last30: sumLast(30), series, devices, os, last_scan_at: last };
}

async function mint() {
  for (let i = 0; i < 8; i++) {
    const code = randomCode(7);
    const taken = await E().QrCode.filter({ short_code: code }, "-created_date", 1).catch(() => []);
    if (!(taken || []).length) return { short_code: code, encoded_url: redirectUrl(code) };
  }
  throw new Error("Couldn't mint a short link. Try again.");
}

function validate(data) {
  if (data.mode === "dynamic") {
    data.content_type = "link";
    const dest = httpUrl(data.destination);
    if (!dest) throw new Error("Add a valid destination link (http or https).");
    data.destination = dest;
  } else if ((data.content_type || "link") === "link" && data.url) {
    const u = httpUrl(data.url);
    if (!u) throw new Error("That link isn't a valid web address.");
    data.url = u;
  }
  return data;
}

export async function brandFor(client) {
  if (!client) return null;
  let d = null;
  try {
    [d] = await E().ClientDossier.filter({ client_id: client.id });
  } catch {
    /* none */
  }
  return {
    company: client.business,
    website: client.domain || (client.websites || [])[0] || "",
    logo_url: client.logo_url || d?.brand_identity?.logo_url || "",
    accent: client.accent || "",
    martian_color: client.martian_color || "",
    colors: d?.brand_identity?.colors || [],
  };
}

export const adminStore = {
  kind: "admin",
  async listAll() {
    const [codes, templates] = await Promise.all([adminStore.listCodes(), adminStore.listTemplates().catch(() => [])]);
    return { codes: codes || [], templates: templates || [] };
  },
  listCodes: () => E().QrCode.list("-updated_date", 500),
  listTemplates: () => E().QrTemplate.list("-updated_date", 300),
  listClients: () => E().CRMClient.list("business", 300).then((l) => (l || []).filter((c) => c.business)),
  getCode: (id) => E().QrCode.get(id),
  async saveCode(id, payload) {
    const data = validate(strip(payload));
    if (id) {
      const cur = await E().QrCode.get(id);
      if (data.mode === "dynamic" && !cur.short_code) Object.assign(data, await mint());
      return E().QrCode.update(id, data);
    }
    if (data.mode === "dynamic") Object.assign(data, await mint());
    return E().QrCode.create({ scans: 0, active: true, source: "admin", ...data });
  },
  deleteCode: (id) => E().QrCode.delete(id),
  async stats(id) {
    const scans = await E().QrScan.filter({ qr_id: id }, "-at", 5000).catch(() => []);
    return summarizeScans(scans);
  },
  saveTemplate: (id, payload) => (id ? E().QrTemplate.update(id, strip(payload)) : E().QrTemplate.create(strip(payload))),
  deleteTemplate: (id) => E().QrTemplate.delete(id),
  async brand(clientId) {
    if (!clientId) return null;
    const c = await E().CRMClient.get(clientId).catch(() => null);
    return brandFor(c);
  },
};

export function portalStore(call) {
  const cache = {};
  const list = async () => {
    const r = await call("qr_list");
    cache.brand = r.brand || null;
    return r;
  };
  return {
    kind: "portal",
    async listAll() {
      const r = await list();
      return { codes: r.codes || [], templates: r.templates || [] };
    },
    listCodes: async () => (await list()).codes || [],
    listTemplates: async () => (await list()).templates || [],
    listClients: async () => [],
    getCode: async (id) => (await call("qr_get", { id })).code,
    saveCode: async (id, payload) => (await call("qr_save", { id, ...validate(strip(payload)) })).code,
    deleteCode: (id) => call("qr_delete", { id }),
    stats: async (id) => (await call("qr_stats", { id })).stats,
    saveTemplate: async (id, payload) => (await call("qr_tpl_save", { id, ...strip(payload) })).template,
    deleteTemplate: (id) => call("qr_tpl_delete", { id }),
    async brand() {
      if (!cache.brand) await list();
      return cache.brand;
    },
  };
}
