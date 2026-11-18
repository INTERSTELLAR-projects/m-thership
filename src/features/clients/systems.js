// Digital footprint helpers: a client's registered apps, and whether those apps are really connected.
// "brain_connected" is computed, never stored: it is true only once BrainFact rows pushed by one of the
// client's own registered apps (source "client_app") exist in Møthership. Nothing is faked from config.

const arr = (v) => (Array.isArray(v) ? v : []);
const str = (v) => String(v || "").trim();

// Mirror of registeredAppIds in base44/shared/clientBrain.js (keep in sync). Inlined Nov 18 2026: the preview dev
// server refuses imports from base44/ ("outside of Vite serving allow list"), which blanked the whole preview.
function registeredAppIds(client) {
  if (!client) return [];
  const ids = [client.command_app_id, ...(Array.isArray(client.other_app_ids) ? client.other_app_ids : [])]
    .map((v) => String(v || "").trim())
    .filter(Boolean);
  return [...new Set(ids)];
}

export const CLIENT_APP_SOURCE = "client_app";

// Every app id that belongs to this client: command app, extra ops apps, the site app and the legacy ops field.
export function clientAppIds(client) {
  if (!client) return [];
  return [...new Set([...registeredAppIds(client), str(client.site_app_id), str(client.ops_app_id)].filter(Boolean))];
}

// Brain facts that arrived from one of this client's registered apps.
export function appBrainFacts(client, facts) {
  if (!client) return [];
  const ids = new Set(clientAppIds(client));
  return arr(facts).filter((f) => f && f.source === CLIENT_APP_SOURCE && str(f.client_id) === str(client.id)
    && (!str(f.source_app_id) || ids.has(str(f.source_app_id))));
}

export function brainConnected(client, facts) {
  return appBrainFacts(client, facts).length > 0;
}

// Sync status across the client's app profiles: "yes" if any app syncs fully, "partial" if any partly, else "no".
export function syncStatus(profiles) {
  const states = arr(profiles).map((p) => p && p.has_sync);
  if (states.includes("yes")) return "yes";
  if (states.includes("partial")) return "partial";
  return "no";
}

export function connectionSummary(client, facts, profiles) {
  const mine = arr(profiles).filter((p) => p && str(p.client_id) === str(client && client.id));
  return { brain: brainConnected(client, facts), sync: syncStatus(mine), apps: mine.length };
}
