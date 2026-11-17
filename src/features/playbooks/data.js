// Playbooks data: foundation prompts, patterns, standards and the per-client standards matrix. Admin-only entities.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Globe, Rocket, Cpu, ShieldCheck, Palette, KeyRound, MapPin, Megaphone, PenLine, Zap, Radar, Mail, BookOpenCheck,
} from "lucide-react";

const arr = (v) => (Array.isArray(v) ? v : (v && v.items) || []);
const safe = (p) => Promise.resolve(p).then(arr).catch(() => []);

export const PLAYBOOKS_KEY = ["playbooks"];
export const ICONS = { Globe, Rocket, Cpu, ShieldCheck, Palette, KeyRound, MapPin, Megaphone, PenLine, Zap, Radar, Mail };
export const iconFor = (name) => ICONS[name] || BookOpenCheck;

export const industryGroup = (s) => String(s || "").split("·")[0].trim();
export const checkKindFor = (kind) => (kind === "app" ? "app" : kind === "website" || kind === "mappack" ? "site" : "business");

async function loadAll() {
  const E = base44.entities;
  const [areas, prompts, logs, patterns, standards, checks, profiles, clients, state] = await Promise.all([
    safe(E.PlaybookArea.list("order", 200)),
    safe(E.FoundationPrompt.list("-version", 1000)),
    safe(E.PromptLog.list("-said_at", 1000)),
    safe(E.PromptPattern.list("-last_seen", 1000)),
    safe(E.FoundationStandard.list("order", 1000)),
    safe(E.StandardCheck.list("-created_date", 8000)),
    safe(E.ClientAppProfile.list("client_name", 500)),
    safe(E.CRMClient.filter({ status: "Active" }, "business", 300)),
    safe(E.AppSettings.filter({ key: "playbooks_agent" }, "-updated_date", 1)),
  ]);
  return { areas, prompts, logs, patterns, standards, checks, profiles, clients, state: state[0]?.pageSettings || {} };
}

export function usePlaybooks() {
  return useQuery({ queryKey: PLAYBOOKS_KEY, queryFn: loadAll, staleTime: 20_000, refetchInterval: 120_000 });
}
export function useRefreshPlaybooks() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: PLAYBOOKS_KEY });
}

export async function agentCall(action, args = {}) {
  try {
    const res = await base44.functions.invoke("promptAgent", { action, ...args });
    const d = res?.data || {};
    if (d.error) throw new Error(d.error);
    return d;
  } catch (e) {
    throw new Error(e?.response?.data?.error || e?.message || "Request failed");
  }
}

export async function logPrompts(rows) {
  try {
    const res = await base44.functions.invoke("logPrompt", { rows });
    const d = res?.data || {};
    if (d.error) throw new Error(d.error);
    return d;
  } catch (e) {
    throw new Error(e?.response?.data?.error || e?.message || "Request failed");
  }
}

export const updateEntity = (name, id, patch) => base44.entities[name].update(id, patch);

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

// Line diff (LCS). Returns [{ t: "same" | "add" | "del", s }].
export function lineDiff(a, b) {
  const A = String(a || "").split("\n");
  const B = String(b || "").split("\n");
  const n = A.length, m = B.length;
  if (n * m > 900_000) return [...A.map((s) => ({ t: "del", s })), ...B.map((s) => ({ t: "add", s }))];
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ t: "same", s: A[i] }); i++; j++; }
    else if (dp[i + 1][j] >= dp[i][j + 1]) { out.push({ t: "del", s: A[i] }); i++; }
    else { out.push({ t: "add", s: B[j] }); j++; }
  }
  while (i < n) out.push({ t: "del", s: A[i++] });
  while (j < m) out.push({ t: "add", s: B[j++] });
  return out;
}

export const WEEK_MS = 7 * 864e5;
export const inWeek = (iso) => !!iso && Date.now() - new Date(iso).getTime() < WEEK_MS;
export const shortDate = (iso) => (iso ? new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—");

// The live prompt for an area + industry: an approved variant for that industry, else the all-industries one.
export function livePrompt(prompts, areaId, industry = "") {
  const mine = prompts.filter((p) => p.area_id === areaId && p.status === "approved");
  return (industry && mine.find((p) => p.industry === industry)) || mine.find((p) => !p.industry) || null;
}

// The prompt Justin copies for one client site/app: every standard it is still missing, ready to paste into a builder.
export function sweepPrompt({ target, items }) {
  const lines = items.map((it, i) => `${i + 1}. **${it.s.title}**${it.c?.status === "fail" ? " (failing)" : ""}: ${it.s.rule}${it.s.how_to_check ? `\n   Check: ${it.s.how_to_check}` : ""}${it.c?.note ? `\n   Note: ${it.c.note}` : ""}`);
  return `# Interstellar standards sweep: ${target.app_name || target.client_name}\n\nRun the Interstellar foundation sweep on **${target.client_name}**'s ${target.app_kind === "app" ? "Command System" : target.app_kind === "site" ? "website" : "business setup"}${target.app_name && target.app_name !== target.client_name ? ` (${target.app_name})` : ""}. These standards are done on other clients but not confirmed here. Check each one, fix what fails, and report every line as pass / fixed / needs Justin.\n\n${lines.join("\n")}\n\nRules: do not publish, deploy, connect domains or change DNS (Justin does). Never delete anything permanently. Never sign in as Justin; use a labeled test user. No secrets in code or data (names only). Trademarks use ™, never ®. Never show the hosting platform's name to clients or visitors.`;
}
