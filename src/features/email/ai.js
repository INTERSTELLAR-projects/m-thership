import { invokeAI } from "@/lib/aiGateway";
import { loadClientContext, contextToBrief } from "@/features/clients/clientContext";
import { loadAgencyKnowledge, agencyBlock } from "@/features/agency/knowledge";
import { AI_EMAIL_SCHEMA, BLOCK_TYPES, TAG_STYLES, MERGE_FIELDS, normalizeBlocks } from "./emailBlocks";

// Compose / revise an email with InvokeLLM. The model returns typed blocks (strict JSON schema), never HTML;
// the block engine renders them. Facts come only from the client context (loadClientContext/contextToBrief)
// and Agency knowledge; anything missing stays a [bracketed placeholder] and is listed in notes.

const clip = (s, n) => (String(s || "").length > n ? `${String(s).slice(0, n - 1)}…` : String(s || ""));

function recentWork(ctx) {
  const work = (ctx.work || []).slice(0, 15).map((w) => `- ${String(w.date || "").slice(0, 10)} · ${w.kind || "work"} · ${w.title}${w.status ? ` (${w.status})` : ""}${w.url ? ` · ${w.url}` : ""}`);
  const open = (ctx.tasks || []).filter((t) => !["done", "archived", "cancelled"].includes(t.status)).slice(0, 12).map((t) => `- ${t.title} [${t.status || "next"}]${t.due_date ? ` due ${t.due_date}` : ""}`);
  const projects = (ctx.projects || []).slice(0, 10).map((p) => `- ${p.title} [${p.status || "?"}]${p.description ? `: ${clip(p.description, 160)}` : ""}`);
  return [
    work.length ? `Recent work (WorkLog):\n${work.join("\n")}` : "Recent work: none logged.",
    open.length ? `Open tasks:\n${open.join("\n")}` : "",
    projects.length ? `Projects:\n${projects.join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
}

async function clientBriefs(clients) {
  const picked = (clients || []).slice(0, 4);
  const max = picked.length > 1 ? 2500 : 7000;
  const out = await Promise.all(picked.map(async (c) => {
    try {
      const ctx = await loadClientContext(c);
      const brief = contextToBrief(ctx, { sections: ["profile", "services", "goals", "health"], level: 3 });
      return `## Client: ${c.business}\n${clip(`${brief}\n\n### Work\n${recentWork(ctx)}`, max)}`;
    } catch {
      return `## Client: ${c.business}\n(Client context could not be loaded. Contact: ${c.contact || "not on file"}.)`;
    }
  }));
  return out.join("\n\n");
}

const STYLE = `
# House style (Interstellar Strategies client emails)
- Written by Justin Cowell, founder of Interstellar Strategies, in first person: direct, warm, confident, plain English. No emojis. No hype words.
- Structure (use what fits): header (eyebrow like CLIENT UPDATE / ANNOUNCEMENT / INTEL BRIEFING, 1-3 words) -> hero ("Title /accent": title 1-4 words, accent 1-3 words shown in orange after a slash) -> intro (2-3 sentences, starts with {{first_name}}) -> optional stats (2-4 REAL numbers only) -> band ("The short version": one sentence) -> light body: section labels, status cards (tag_style in_progress / coming_up / done / needs_you / info), steps ("What we need from you"), table (billing card: label/value rows + total), callout -> optional darkband (e.g. eyebrow "2027", big statement) -> button -> signoff.
- No preheader. Never write HTML or markdown headings. Plain text in every field; you may use **bold** and [label](https://real-url). Email addresses and URLs are written plainly (the renderer turns them into orange links).
- Signoff name: "Justin Cowell, Interstellar Strategies". Contact address: justin@interstellar-strategies.com.

# Block types
${Object.entries(BLOCK_TYPES).map(([k, v]) => `- ${k}: ${v.hint}`).join("\n")}
Card tag styles: ${Object.keys(TAG_STYLES).join(", ")}.

# Merge fields (replaced per recipient)
${MERGE_FIELDS.map((m) => `{{${m.key}}}`).join(" ")}
Use {{first_name}} in the intro. When the email goes to several recipients, NEVER hard-code one client's name, business or numbers: use merge fields and keep the copy true for everyone.

# Facts
- Use ONLY facts, prices, numbers, dates and URLs that appear in the client context or agency knowledge below, or that Justin states in his direction.
- Never invent a number, price, result, date, deliverable or link. If the email needs something you do not have, write a short [bracketed placeholder] in its place and add a line to notes.
- Button URLs: only {{portal_url}}, {{website}}, or a URL given below. Otherwise leave url empty and say so in notes.`;

async function callModel(prompt) {
  // Anthropic via ai-gateway (metered, Sonnet-class for full emails); falls back to InvokeLLM on any gateway error.
  const out = await invokeAI({ prompt, response_json_schema: AI_EMAIL_SCHEMA, tier: "long", feature: "email.compose" });
  const data = typeof out === "string" ? JSON.parse(out) : out;
  if (!data || !Array.isArray(data.blocks)) throw new Error("The AI did not return an email. Try again.");
  return { subject: String(data.subject || "").slice(0, 250), blocks: normalizeBlocks(data.blocks), notes: Array.isArray(data.notes) ? data.notes.map(String).slice(0, 12) : [] };
}

async function context({ clients, kind }) {
  const [sections, briefs] = await Promise.all([loadAgencyKnowledge().catch(() => []), clientBriefs(clients)]);
  const who = !clients || !clients.length
    ? (kind === "mass" ? "Audience: a list of subscribers and/or clients (mass email). Keep it general and use merge fields; an unsubscribe line is added automatically." : "Audience: not chosen yet. Use merge fields.")
    : clients.length === 1
      ? `Audience: one client, ${clients[0].business}. A 1:1 email.`
      : `Audience: ${clients.length} clients (${clients.map((c) => c.business).join(", ")}). Each gets their own copy, so use merge fields and keep the copy true for all of them.`;
  return `${agencyBlock(sections, ["about", "offers", "rules", "voice"], { maxChars: 5000 })}\n# ${who}\n\n${briefs ? `# Client context (facts on file)\n${briefs}` : ""}`;
}

export async function composeEmail({ direction, clients, kind }) {
  const prompt = `You write emails for Interstellar Strategies in its house template. Return the email as typed blocks.
${STYLE}

${await context({ clients, kind })}

# Justin's direction (may be dictated, so read past filler words)
${direction}`;
  return callModel(prompt);
}

export async function reviseEmail({ direction, doc, clients, kind }) {
  const current = JSON.stringify({ subject: doc.subject, blocks: (doc.blocks || []).map(({ id, ...b }) => b) });
  const prompt = `You are editing an existing Interstellar Strategies email (typed blocks). Apply Justin's change and return the WHOLE email. Keep every block and sentence he did not ask to change exactly as it is.
${STYLE}

${await context({ clients, kind })}

# Current email (JSON)
${current}

# Justin's change
${direction}`;
  return callModel(prompt);
}
