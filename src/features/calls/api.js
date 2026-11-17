// Structure call: data helpers shared by the Calls pages and the client Calls tab.
import { base44 } from "@/api/base44Client";

export const E = base44.entities;

export async function agent(body) {
  try {
    const res = await base44.functions.invoke("callPrepAgent", body);
    return res.data;
  } catch (e) {
    return e?.response?.data || { ok: false, error: e?.message || "Request failed" };
  }
}

export const PURPOSE = {
  decide: { label: "Decide", cls: "border-[rgba(255,106,0,.6)] text-[#ffb27a] bg-[rgba(255,60,0,.12)]" },
  show: { label: "Show", cls: "border-[rgba(46,230,197,.45)] text-[#9ff3df] bg-[rgba(46,230,197,.08)]" },
  ask: { label: "Ask", cls: "border-[rgba(140,175,255,.45)] text-[#b9ccff] bg-[rgba(80,120,255,.1)]" },
  inform: { label: "Inform", cls: "border-[var(--hair-d2)] text-[var(--ink-m)] bg-white/[0.03]" },
};

export const CALL_TYPES = [
  ["client", "Client", "A call with a current client"],
  ["sales_discovery", "Sales: discovery", "Their business and pains first, ask before showing, one next step"],
  ["sales_close", "Sales: close", "Replay their pains, one offer, ask for the decision"],
  ["investor", "Investor", "The 2-minute story first, depth only where they ask"],
  ["partner", "Partner", "The 2-minute story, then how a partnership would work"],
  ["win_back", "Win back", "What changed, the gift or offer, one ask"],
  ["internal", "Internal", "A meeting about Interstellar itself"],
];
export const typeLabel = (t) => (CALL_TYPES.find(([k]) => k === (t || "client")) || CALL_TYPES[0])[1];
export const whoOf = (cp) => cp.client_name || cp.company || cp.contact_name || (cp.call_type === "internal" ? "Interstellar" : "Call");

export const totalMinutes = (agenda) => (agenda || []).reduce((n, a) => n + (Number(a.minutes) || 0), 0);

// Same layout as the agent writes, rebuilt in the browser after edits so "Copy for call" always matches the screen.
export function toMarkdown(cp) {
  const s = (v) => (v == null ? "" : String(v)).trim();
  const arr = (v) => (Array.isArray(v) ? v : []);
  const out = [];
  const total = totalMinutes(cp.agenda);
  const who = s(cp.client_name) || s(cp.company);
  out.push(`# ${s(cp.title) || "Call"}${who ? ` · ${who}` : ""}${cp.contact_name ? ` (${s(cp.contact_name)})` : ""}`);
  out.push(cp.scheduled_for ? `_${new Date(cp.scheduled_for).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })} · ${total} min_` : `_${total} min_`);
  if (cp.goal) out.push(`\n**Goal:** ${s(cp.goal)}`);
  if (arr(cp.prep_checklist).length) out.push(`\n**Have open**\n${arr(cp.prep_checklist).map((x) => `- [ ] ${s(x)}`).join("\n")}`);
  out.push("\n## Agenda");
  arr(cp.agenda).forEach((a, i) => {
    out.push(`\n### ${i + 1}. ${s(a.topic)} (${Number(a.minutes) || 0} min · ${s(a.purpose)})`);
    if (a.decision_needed) out.push(`**Decision:** ${s(a.decision_needed)}`);
    arr(a.talking_points).forEach((t) => out.push(`- ${s(t)}`));
    arr(a.questions).forEach((q) => out.push(`- Ask: ${s(q)}`));
  });
  if (arr(cp.follow_ups).length) out.push(`\n**Open from last call**\n${arr(cp.follow_ups).map((x) => `- ${s(x)}`).join("\n")}`);
  if (arr(cp.asks_from_client).length) out.push(`\n## Get from ${s(cp.contact_name) || who || "them"}\n${arr(cp.asks_from_client).map((x) => `- ${s(x)}`).join("\n")}`);
  if (arr(cp.risks).length) out.push(`\n## Watch for\n${arr(cp.risks).map((x) => `- ${s(x)}`).join("\n")}`);
  if (arr(cp.conflicts).length) out.push(`\n## Check before the call (conflicts with what we have on file)\n${arr(cp.conflicts).map((x) => `- ${s(x)}`).join("\n")}`);
  return out.join("\n");
}

export const fmtWhen = (iso) => (iso ? new Date(iso).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "");

export function bucket(cp) {
  if (cp.status === "done") return "done";
  if (cp.scheduled_for && new Date(cp.scheduled_for).getTime() > Date.now() - 2 * 3600e3) return "upcoming";
  return cp.status === "ready" ? "ready" : "draft";
}
