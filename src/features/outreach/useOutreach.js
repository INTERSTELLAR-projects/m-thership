import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { base44 } from "@/api/base44Client";
import { loadRules, mergedCriteria, criteriaCheck } from "./lib";

const arr = (p) => p.then((r) => (Array.isArray(r) ? r : [])).catch(() => []);
const LIVE = ["OutreachTarget", "OutreachMessage", "OutreachRun", "OutreachProfile"];

// Everything the Backlinks & Citations views need, kept live with entity subscriptions.
// Pass clientId to scope targets/messages/runs to one client (ClientCockpit tab).
export default function useOutreach(clientId = null) {
  const [state, setState] = useState({ clients: [], dossiers: [], profiles: [], targets: [], messages: [], runs: [], rules: null, rulesId: null });
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState(null);
  const timer = useRef(null);

  const load = useCallback(async () => {
    const scope = clientId ? { client_id: clientId } : null;
    const list = (name, sort, limit) => (scope ? arr(base44.entities[name].filter(scope, sort, limit)) : arr(base44.entities[name].list(sort, limit)));
    const [clients, dossiers, profiles, targets, messages, runs, rules] = await Promise.all([
      clientId ? arr(base44.entities.CRMClient.filter({ id: clientId }, "business", 1)) : arr(base44.entities.CRMClient.list("business", 300)),
      list("ClientDossier", "-updated_date", 300),
      list("OutreachProfile", "-updated_date", 300),
      list("OutreachTarget", "-updated_date", 2000),
      list("OutreachMessage", "-updated_date", 1000),
      list("OutreachRun", "-created_date", 60),
      loadRules().catch(() => ({ id: null, rules: null })),
    ]);
    setState({ clients, dossiers, profiles, targets, messages, runs, rules: rules.rules, rulesId: rules.id });
    setUpdatedAt(new Date());
    setLoading(false);
  }, [clientId]);

  useEffect(() => {
    load();
    const bump = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(load, 500);
    };
    const unsubs = LIVE.map((n) => {
      try { return base44.entities[n].subscribe(bump); } catch { return null; }
    });
    const poll = window.setInterval(load, 120000);
    return () => {
      unsubs.forEach((u) => typeof u === "function" && u());
      window.clearInterval(poll);
      window.clearTimeout(timer.current);
    };
  }, [load]);

  // Per-client criteria (CRM + Constellations dossier + OutreachProfile overrides).
  const criteria = useMemo(() => {
    const byClient = {};
    for (const c of state.clients) {
      const dossier = state.dossiers.find((d) => d.client_id === c.id) || {};
      const profile = state.profiles.find((p) => p.client_id === c.id) || null;
      const merged = mergedCriteria(c, dossier, profile || {});
      byClient[c.id] = { client: c, dossier, profile, merged, ...criteriaCheck(merged) };
    }
    return byClient;
  }, [state.clients, state.dossiers, state.profiles]);

  // Optimistic local patch so edits feel instant before the subscription reload lands.
  const patch = useCallback((entity, id, fields) => {
    const key = { OutreachTarget: "targets", OutreachMessage: "messages", OutreachProfile: "profiles" }[entity];
    if (!key) return;
    setState((s) => ({ ...s, [key]: s[key].map((r) => (r.id === id ? { ...r, ...fields } : r)) }));
  }, []);

  return { ...state, criteria, loading, updatedAt, reload: load, patch };
}
