import { base44 } from "@/api/base44Client";
import { agencyBlock, loadAgencyKnowledge, offerByKey, offerPriceLabel } from "@/features/agency/knowledge";
import { VOICE } from "@/features/social/brand";

// Hook Lab generation (Hormozi "how to run ads"). Hooks = the first ~5 seconds. Meat = the body
// (education, belief-breaking, demonstration). CTA = what to do next. Facts and prices come only from
// Agency Knowledge, and the same ad-policy rules as copyGen.js apply, so nothing here can be pushed
// that the policy guard would reject.

export const HOOK_STYLES = [
  "call-out", "question", "if-then", "command", "bold claim", "contrarian", "story open", "number/list", "result-first", "curiosity gap",
];

export const MEAT_KINDS = [
  { key: "education", label: "Education", hint: "Teach one useful thing. Value first, then the offer." },
  { key: "belief", label: "Belief-breaking", hint: "Name the belief that stops them buying and break it." },
  { key: "demo", label: "Demonstration", hint: "Show it working: screen recording, before/after, the product in action." },
];

const POLICY = `Hard ad-policy rules (an ad that breaks one is rejected):
- Never assert or imply the viewer's personal attributes, finances, health or struggles ("Are you broke…", "You're losing money…", "Struggling to…"). Calling out a trade or role is fine ("Roofers:", "If you run a cleaning company…") as long as it does not claim something about them.
- No guarantees (rankings, leads, revenue, ROI), no invented statistics, results, testimonials or client names, no "#1"/"best".
- No fake urgency or scarcity. No credit/financing, hiring or housing wording.
- Prices ONLY exactly as listed in Agency Knowledge, otherwise no prices.
- No ALL-CAPS words, no emoji strings. Banned words: ${VOICE.banned_words.join(", ")}.
- Interstellar and Møthership are not registered: never use ®.`;

async function context(lab) {
  const sections = await loadAgencyKnowledge();
  const offer = lab.offer_key ? offerByKey(lab.offer_key, sections) : null;
  return `${agencyBlock(sections, ["about", "offers", "rules", "voice"], { maxChars: 4000 })}
Goal of these ads: ${lab.goal || "(not set)"}
Audience: ${lab.audience || "home-service business owners"}
Platform: ${lab.platform || "meta"} (short-form vertical video, spoken to camera)
${offer ? `Offer: ${offer.name} — ${offerPriceLabel(offer)}${offer.terms ? ` (${offer.terms})` : ""}` : "No specific offer: no prices."}
Voice: ${VOICE.tone.join(" ")}
${POLICY}`;
}

const uid = (p) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** count new hooks. `beat` = { control, winners[], losers[] } to write hooks that try to beat the control. */
export async function generateHooks(lab, { count = 50, beat = null, round = 1 } = {}) {
  const existing = (lab.hooks || []).map((h) => h.text);
  const prompt = `You write scroll-stopping video ad HOOKS for Interstellar Strategies. A hook is the first 3-5 seconds, spoken to camera, max ~15 words, one sentence (two short ones at most).
${await context(lab)}

Write ${count} hooks. Spread them across these styles: ${HOOK_STYLES.join(", ")}. Every hook must be meaningfully different (not rewordings). Each must make the target viewer feel "this is for me" and want the next 5 seconds.
${beat ? `This is round ${round}: BEAT THE CONTROL.
Current control (best performer): "${beat.control}"
Other winners: ${beat.winners.map((w) => `"${w}"`).join("; ") || "none"}
Losers to avoid sounding like: ${beat.losers.map((w) => `"${w}"`).join("; ") || "none"}
Write new hooks that keep what makes the control work (its angle, specificity, rhythm) but push harder: new angles on the same idea, sharper specifics, different openings. Do not copy the control.` : ""}
${existing.length ? `Do NOT repeat any of these existing hooks:\n- ${existing.slice(-80).join("\n- ")}` : ""}`;
  const out = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: { hooks: { type: "array", items: { type: "object", properties: { text: { type: "string" }, style: { type: "string" } }, required: ["text"] } } },
      required: ["hooks"],
    },
  });
  return (out?.hooks || []).slice(0, count).filter((h) => h.text?.trim()).map((h) => ({
    id: uid("h"), text: h.text.trim(), style: h.style || "", round, status: "draft", shot: false,
  }));
}

/** Three meats (education, belief-breaking, demonstration), 30-45 seconds each when spoken. */
export async function generateMeats(lab) {
  const prompt = `Write the MEAT (body) of a short-form video ad for Interstellar Strategies, in three versions. Each version must work after ANY hook (do not reference a specific hook) and run 30-45 seconds spoken (about 80-110 words), to camera, plain spoken English.
${await context(lab)}

1. kind "education": teach one genuinely useful thing tied to the goal, then show how Interstellar does it for them.
2. kind "belief": name the belief that stops this audience from buying (e.g. "websites don't bring jobs", "software is too complicated") and break it with reasoning, not invented stats.
3. kind "demo": a script to read over a screen recording / phone mockup showing the product working. Include [SHOW: ...] cues for what's on screen.
Do not include a call to action; the CTA is recorded separately.`;
  const out = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: { meats: { type: "array", items: { type: "object", properties: { kind: { type: "string", enum: ["education", "belief", "demo"] }, title: { type: "string" }, script: { type: "string" } }, required: ["kind", "script"] } } },
      required: ["meats"],
    },
  });
  return (out?.meats || []).slice(0, 3).map((m) => ({ id: uid("m"), kind: m.kind, title: m.title || "", script: m.script, shot: false }));
}

/** Three CTAs, 5-10 seconds each. */
export async function generateCtas(lab) {
  const prompt = `Write 3 different closing CALLS TO ACTION for a short-form video ad for Interstellar Strategies. 5-10 seconds spoken each, one clear next step that matches the goal, no fake urgency.
${await context(lab)}
Make them different: one direct ("Tap Book now and…"), one low-friction ("…see what it would look like for you"), one that reframes the value.`;
  const out = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: { type: "object", properties: { ctas: { type: "array", items: { type: "object", properties: { text: { type: "string" } }, required: ["text"] } } }, required: ["ctas"] },
  });
  return (out?.ctas || []).slice(0, 3).map((c) => ({ id: uid("c"), text: c.text, shot: false }));
}

/* ---------------- numbers ---------------- */

const pad = (n) => String(n).padStart(2, "0");
export const hookCode = (lab, i) => `${lab.code || "HL"}-H${pad(i + 1)}`;
export const comboCode = (lab, hi, mi, ci) => `${hookCode(lab, hi)}-M${mi + 1}-C${ci + 1}`;

export function hookStats(h) {
  const imp = Number(h.impressions) || 0;
  const spend = Number(h.spend) || 0;
  const leads = Number(h.leads) || 0;
  return {
    hookRate: imp && h.views3s ? Number(h.views3s) / imp : null,
    ctr: imp && h.clicks ? Number(h.clicks) / imp : null,
    cpl: leads ? spend / leads : null,
    spend, imp, leads,
  };
}

/** Rank: cost per lead when there are leads, then hook rate, then CTR. */
export function rankHooks(hooks) {
  const live = hooks.filter((h) => (Number(h.impressions) || 0) > 0);
  return [...live].sort((a, b) => {
    const A = hookStats(a); const B = hookStats(b);
    if (A.cpl != null || B.cpl != null) return (A.cpl ?? Infinity) - (B.cpl ?? Infinity);
    if (A.hookRate != null || B.hookRate != null) return (B.hookRate ?? -1) - (A.hookRate ?? -1);
    return (B.ctr ?? -1) - (A.ctr ?? -1);
  });
}

const csvCell = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;

/** All hook x meat x CTA combinations as CSV: ad name code + full script, for editing and upload. */
export function combosCsv(lab) {
  const hooks = (lab.hooks || []).filter((h) => h.status !== "cut");
  const rows = [["ad_name", "hook", "meat_kind", "cta", "full_script"]];
  hooks.forEach((h) => {
    const hi = (lab.hooks || []).indexOf(h);
    (lab.meats || []).forEach((m, mi) => (lab.ctas || []).forEach((c, ci) => {
      rows.push([comboCode(lab, hi, mi, ci), h.text, m.kind, c.text, `${h.text}\n\n${m.script}\n\n${c.text}`]);
    }));
  });
  return rows.map((r) => r.map(csvCell).join(",")).join("\n");
}

/** Shot list: everything to record in one session (hooks, meats, CTAs), with clip names. */
export function shotList(lab) {
  const hooks = (lab.hooks || []).map((h, i) => ({ h, i })).filter(({ h }) => h.status !== "cut");
  return [
    `SHOT LIST · ${lab.name}`,
    "",
    `HOOKS (${hooks.length}) · record each 2-3 times, energy up, look straight into the lens`,
    ...hooks.map(({ h, i }) => `${hookCode(lab, i)}  ${h.text}`),
    "",
    "MEAT (3)",
    ...(lab.meats || []).map((m, i) => `M${i + 1} · ${m.kind}\n${m.script}\n`),
    "CTA (3)",
    ...(lab.ctas || []).map((c, i) => `C${i + 1}  ${c.text}`),
  ].join("\n");
}

export function download(name, text, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export const newId = uid;
