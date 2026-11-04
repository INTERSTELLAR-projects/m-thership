import { useEffect, useState, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { invokeAI } from "@/lib/aiGateway";
import { scoreIdea } from "@/features/ideas/scoring";
import { TOPIC_BY_KEY } from "@/features/oracle/topics";

const safe = async (fn, fb) => { try { return await fn(); } catch { return fb; } };

export function useOracle() {
  const [data, setData] = useState({ topics: [], findings: [], predictions: [], briefs: [], theses: [], opportunities: [] });
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const E = base44.entities;
    const [topics, findings, predictions, briefs, theses, opportunities] = await Promise.all([
      safe(() => E.OracleTopic.list("order", 50), []),
      safe(() => E.OracleFinding.list("-date", 500), []),
      safe(() => E.OraclePrediction.list("-created_date", 200), []),
      safe(() => E.OracleBrief.list("-date", 30), []),
      safe(() => E.OracleThesis.list("order", 50), []),
      safe(() => E.OracleOpportunity.list("rank", 100), []),
    ]);
    setData({ topics, findings: findings.filter((f) => f.status !== "superseded"), predictions, briefs, theses, opportunities });
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  return { ...data, loading, reload: load, setData };
}

// Prediction accuracy: hit rate (right = 1, partial = 0.5) and Brier score on resolved predictions.
export function accuracyOf(predictions) {
  const resolved = predictions.filter((p) => ["right", "wrong", "partial"].includes(p.outcome));
  const val = (o) => (o === "right" ? 1 : o === "partial" ? 0.5 : 0);
  const hits = resolved.reduce((s, p) => s + val(p.outcome), 0);
  const withP = resolved.filter((p) => typeof p.probability === "number");
  const brier = withP.length ? withP.reduce((s, p) => s + (p.probability - val(p.outcome)) ** 2, 0) / withP.length : null;
  return {
    resolved: resolved.length,
    pending: predictions.filter((p) => !p.outcome || p.outcome === "pending").length,
    right: resolved.filter((p) => p.outcome === "right").length,
    wrong: resolved.filter((p) => p.outcome === "wrong").length,
    partial: resolved.filter((p) => p.outcome === "partial").length,
    hit_rate: resolved.length ? hits / resolved.length : null,
    brier,
  };
}

// Group sourced stats into chartable series: only metrics with >= 2 dated, numeric, sourced points.
export function seriesFor(findings) {
  const by = {};
  for (const f of findings) {
    for (const s of f.key_stats || []) {
      if (!s.metric || typeof s.value !== "number" || !s.date || !s.source_url) continue;
      (by[s.metric] ||= { metric: s.metric, label: s.label, unit: s.unit, points: [] }).points.push({ date: s.date, value: s.value, display: s.display, source_url: s.source_url, source_title: s.source_title });
    }
  }
  return Object.values(by)
    .map((x) => {
      const seen = new Set();
      const points = x.points.filter((p) => (seen.has(p.date) ? false : seen.add(p.date))).sort((a, b) => String(a.date).localeCompare(String(b.date)));
      return { ...x, points };
    })
    .filter((x) => x.points.length >= 2);
}

export async function askOracle(question, findings, history = []) {
  const pool = [...findings].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 120);
  const ctx = pool.map((f, i) => {
    const stats = (f.key_stats || []).map((s) => `${s.label}: ${s.display || s.value}${s.unit && !s.display ? ` ${s.unit}` : ""} (${s.date})`).join("; ");
    return `[F${i + 1}] (${TOPIC_BY_KEY[f.topic_key]?.name || f.topic_key}, ${f.date || "undated"}) ${f.headline} — ${String(f.whats_happening || "").slice(0, 400)}${stats ? ` | Stats: ${stats}` : ""}`;
  }).join("\n");
  const system = `You are the Future Oracle inside Møthership, the agency OS for Interstellar Strategies (Justin Cowell, Molalla OR: websites, SEO incl. AI search, automation, Base44 apps for home-service and local businesses; goal $1M in 2027).
Answer ONLY from the stored findings below. Every factual sentence must cite one or more finding ids like [F3]. If the findings do not cover the question, say so plainly and suggest what the Oracle should research next; never fill gaps from memory and never invent numbers.
Politics: describe what policies do and who they affect, no opinions, no party framing. Markets: informational only, never buy/sell advice; add "Not financial advice." when you discuss markets.
Be concise: a direct answer first, then 2-5 bullets, then "What this means for you" in one or two lines.

STORED FINDINGS
${ctx || "(none yet)"}`;
  const convo = history.slice(-6).map((m) => `${m.role === "user" ? "Justin" : "Oracle"}: ${m.text}`).join("\n");
  const prompt = `${convo ? `Conversation so far:\n${convo}\n\n` : ""}Justin asks: ${question}`;
  const out = await invokeAI({
    prompt, system, tier: "long", feature: "oracle_ask",
    response_json_schema: { type: "object", properties: { answer: { type: "string", description: "Markdown answer with [F#] citations" }, cited: { type: "array", items: { type: "string" } } }, required: ["answer"] },
  });
  const map = Object.fromEntries(pool.map((f, i) => [`F${i + 1}`, f]));
  return { answer: out?.answer || String(out || ""), map };
}

export async function sendToVault(opp) {
  const lines = [opp.summary, opp.why_now ? `Why now: ${opp.why_now}` : "", opp.revenue_band_estimate ? `Revenue (estimate): ${opp.revenue_band_estimate}` : "",
    (opp.sources || []).length ? `Sources:\n${opp.sources.map((s) => `- ${s.title}: ${s.url}`).join("\n")}` : ""].filter(Boolean).join("\n\n");
  const idea = await base44.entities.Idea.create({
    title: opp.title, description: lines, category: "Oracle", status: "New", stage: "idea", source: "oracle", oracle_opportunity_id: opp.id,
    date: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
  });
  await base44.entities.OracleOpportunity.update(opp.id, { status: "sent_to_vault", idea_id: idea.id });
  scoreIdea(idea).catch(() => null); // scored in the background; the Vault re-ranks on open
  return idea;
}

export const ago = (iso) => {
  if (!iso) return "never";
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 3600) return `${Math.max(1, Math.round(d / 60))}m ago`;
  if (d < 86400) return `${Math.round(d / 3600)}h ago`;
  return `${Math.round(d / 86400)}d ago`;
};

export const host = (url) => { try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "source"; } };
