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

export const totalMinutes = (agenda) => (agenda || []).reduce((n, a) => n + (Number(a.minutes) || 0), 0);

// Same layout as the agent writes, rebuilt in the browser after edits so "Copy for call" always matches the screen.
export function toMarkdown(cp) {
  const s = (v) => (v == null ? "" : String(v)).trim();
  const arr = (v) => (Array.isArray(v) ? v : []);
  const out = [];
  const total = totalMinutes(cp.agenda);
  out.push(`# ${s(cp.title) || "Call"}${cp.client_name ? ` · ${s(cp.client_name)}` : ""}`);
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
  if (arr(cp.asks_from_client).length) out.push(`\n## Get from ${s(cp.client_name) || "the client"}\n${arr(cp.asks_from_client).map((x) => `- ${s(x)}`).join("\n")}`);
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
