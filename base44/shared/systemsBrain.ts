// Systems brain (Møthership > Agents > Systems): what every secret NAME in Justin's workspace is for, and how the
// apps connect. Data lives in SystemApp / SystemKey / SystemLink (admin-only) plus one BrainFact per key
// (pillar "systems", source "systems inventory", no client_id) so the Ask bar can answer "what does this key do?".
// Never reads, stores, logs or returns a secret VALUE: only names, purposes and wiring.
// deno-lint-ignore-file no-explicit-any

export const SYSTEMS_SOURCE = "systems inventory";
export const MOTHERSHIP_APP_ID = "69d80bb06c5ad07a795df54e";

// The planned key design (decided Nov 2026, NOT implemented). Shown on the Systems page and stored as a BrainFact.
export const KEY_DESIGN_DECISION =
  "At scale Interstellar uses one master secret per purpose in Møthership and derives each client's key from it " +
  "(HMAC of the master with the client app id). Each client site or app holds only its own derived key. Redline and " +
  "PowerLift currently use named per-client keys (CONTENT_PUBLISH_KEY_REDLINE / CONTENT_PUBLISH_KEY_POWERLIFT) until " +
  "the Interstellar automations phase migrates them.";

const arr = (v: any) => (Array.isArray(v) ? v : (v && v.items) || []);
const s = (v: unknown) => (v == null ? "" : String(v));
const clip = (v: unknown, n: number) => { const t = s(v).replace(/\s+/g, " ").trim(); return t.length > n ? t.slice(0, n - 1) + "…" : t; };

// Defense in depth: anything that looks like a credential value is dropped before it is stored or sent to the LLM.
const VALUEISH = /(sk_(live|test)_[A-Za-z0-9]{6,}|whsec_[A-Za-z0-9]{6,}|AKIA[0-9A-Z]{12,}|AIza[0-9A-Za-z_-]{20,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}|\b[a-f0-9]{40,}\b)/g;
export const scrub = (t: unknown) => s(t).replace(VALUEISH, "[removed]");

export const factKey = (appId: string, name: string) => `systems.key.${appId}.${name}`;

/** One BrainFact statement for a SystemKey row (names and wiring only). */
export function factStatement(k: any): string {
  const parts = [`${k.name} (${k.app_name || k.app_id}): ${s(k.purpose).trim()}`];
  if (k.what_breaks_without_it && !/^nothing/i.test(s(k.what_breaks_without_it))) parts.push(`Without it: ${s(k.what_breaks_without_it).trim()}`);
  if (k.pair_with && !/^(none|n\/a)/i.test(s(k.pair_with))) parts.push(`Pairs with ${s(k.pair_with).trim()}.`);
  if (k.delete_safe) parts.push("Leftover: safe for Justin to delete.");
  if (k.presence === "referenced_not_set") parts.push("The code reads it but it is not set on the app.");
  if (k.status === "unknown") parts.push("Some of this is unknown: ask Justin.");
  return scrub(parts.join(" ").replace(/\.\./g, ".")).slice(0, 1500);
}

const STOP = new Set(["what", "does", "this", "that", "the", "key", "keys", "do", "is", "are", "a", "an", "to", "and", "or", "of", "in", "on", "for", "it", "my", "me", "how", "which", "why", "what's", "whats", "with", "from", "app", "apps", "between", "connect", "connects", "connected", "secret", "secrets", "brain", "tell", "about", "can", "i", "we", "our", "there", "any", "all", "used", "use"]);
const norm = (t: string) => t.toLowerCase().replace(/ø/g, "o").replace(/[^a-z0-9_\- ]/g, " ");
const words = (t: string) => norm(t).split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));

/** Does the question look like it is about keys, secrets, integrations or how apps connect? */
export const SYSTEMS_RE = /\b(key|keys|secret|secrets|token|api|webhook|sync|intake|publish|connect|connects|connected|connection|link|links|integration|integrations|endpoint|rotate|leftover|unused|systems?)\b|[A-Z][A-Z0-9]+_[A-Z0-9_]+/i;

/**
 * Builds the "Systems brain" block for the Ask bar: only the keys, links and facts that match the question, so the
 * LLM answers from records instead of guessing. Returns "" when nothing matches.
 */
export async function systemsContext(db: any, text: string, opts: { maxKeys?: number; maxLinks?: number } = {}): Promise<{ block: string; keys: any[]; links: any[] }> {
  const q = s(text);
  const upperNames = (q.match(/[A-Z][A-Z0-9]+(?:[_-][A-Z0-9]+)+/g) || []).map((x) => x.toUpperCase());
  const ws = words(q);
  const asksSystems = SYSTEMS_RE.test(q) || upperNames.length > 0;
  const [keys, links, facts] = await Promise.all([
    db.SystemKey.list("-updated_date", 500).then(arr).catch(() => []),
    db.SystemLink.list("-updated_date", 300).then(arr).catch(() => []),
    db.BrainFact.filter({ source: SYSTEMS_SOURCE, status: "active" }, "-updated_date", 300).then(arr).catch(() => []),
  ]);
  if (!keys.length && !links.length) return { block: "", keys: [], links: [] };

  const hay = (o: any, fields: string[]) => norm(fields.map((f) => (Array.isArray(o[f]) ? o[f].join(" ") : s(o[f]))).join(" "));
  const score = (o: any, fields: string[], nameField?: string) => {
    let n = 0;
    const h = hay(o, fields);
    if (nameField && upperNames.includes(s(o[nameField]).toUpperCase())) n += 10;
    for (const w of ws) if (h.includes(w)) n += w.length > 4 ? 2 : 1;
    return n;
  };
  const kScored = keys.map((k: any) => ({ k, n: score(k, ["name", "app_name", "purpose", "used_by", "checked_by", "pair_with", "notes"], "name") })).filter((x: any) => x.n > 0);
  const lScored = links.map((l: any) => ({ l, n: score(l, ["from_app", "to_app", "mechanism", "secret_name", "what_flows", "endpoint"]) + (upperNames.some((u) => s(l.secret_name).toUpperCase().includes(u)) ? 10 : 0) })).filter((x: any) => x.n > 0);
  const fScored = facts.map((f: any) => ({ f, n: score(f, ["statement", "question_key"]) })).filter((x: any) => x.n > 0);
  // Two named apps ("Redline" and "Møthership"): prefer links that touch both.
  const minScore = asksSystems ? 1 : 3;
  const topK = kScored.filter((x: any) => x.n >= minScore).sort((a: any, b: any) => b.n - a.n).slice(0, opts.maxKeys ?? 14).map((x: any) => x.k);
  const topL = lScored.filter((x: any) => x.n >= minScore).sort((a: any, b: any) => b.n - a.n).slice(0, opts.maxLinks ?? 12).map((x: any) => x.l);
  const topF = fScored.filter((x: any) => x.n >= minScore).sort((a: any, b: any) => b.n - a.n).slice(0, 6).map((x: any) => x.f);
  const decision = facts.find((f: any) => f.question_key === "systems.decision.key_design");
  if (!topK.length && !topL.length && !topF.length && !asksSystems) return { block: "", keys: [], links: [] };

  const kLine = (k: any) => scrub(
    `${k.name} @ ${k.app_name} [${k.status}${k.presence === "referenced_not_set" ? ", NOT SET" : ""}${k.delete_safe ? ", leftover: safe to delete" : ""}] ` +
    `purpose: ${clip(k.purpose, 420)} | used by: ${clip((k.used_by || []).join("; "), 220)} | checked by: ${clip((k.checked_by || []).join("; "), 200)} | ` +
    `breaks without it: ${clip(k.what_breaks_without_it, 200)} | pair: ${clip(k.pair_with, 160)} | rotate: ${clip(k.rotate_how, 180)}${k.notes ? ` | note: ${clip(k.notes, 200)}` : ""}`,
  );
  const lLine = (l: any) => scrub(
    `${l.from_app} → ${l.to_app} [${l.status}] ${clip(l.mechanism, 160)}; key: ${l.secret_name || "none (public feed)"}${l.header ? ` (header ${l.header})` : ""}; ` +
    `flows: ${clip(l.what_flows, 200)}${l.notes ? `; note: ${clip(l.notes, 180)}` : ""}`,
  );
  const lines = [
    "",
    "SYSTEMS BRAIN (secret NAMES and wiring across every app Justin manages; values are never stored here, never ask for or invent one):",
    ...(topK.length ? ["Matching keys:", ...topK.map((k: any) => "- " + kLine(k))] : []),
    ...(topL.length ? ["Matching connections:", ...topL.map((l: any) => "- " + lLine(l))] : []),
    ...(topF.length ? ["Matching systems facts:", ...topF.map((f: any) => "- " + clip(scrub(f.statement), 600))] : []),
    ...(decision && /design|derive|master|scale|plan|rotate|per.client|hmac/i.test(q) ? ["Decision: " + clip(decision.statement, 700)] : []),
    `Totals: ${keys.filter((k: any) => k.presence !== "referenced_not_set").length} secrets set across ${new Set(keys.map((k: any) => k.app_id)).size} apps, ${links.length} connections.`,
    "When he asks about a key or a connection, answer from these lines: what it does, who sends it, who checks it, what breaks without it and its pair. If a line says unknown, say so and that it needs Justin. If nothing matches, say the Systems page (Agents > Systems) doesn't list it.",
  ];
  return { block: lines.join("\n"), keys: topK, links: topL };
}

/** Plain answer without the LLM (fallback when InvokeLLM fails). */
export function systemsFallback(keys: any[], links: any[]): string {
  if (keys.length) {
    const k = keys[0];
    return scrub(`${k.name} on ${k.app_name}: ${clip(k.purpose, 300)}${k.pair_with ? ` Pair: ${clip(k.pair_with, 120)}.` : ""}`);
  }
  if (links.length) return scrub(links.slice(0, 3).map((l: any) => `${l.from_app} → ${l.to_app}: ${clip(l.mechanism, 120)} (${l.secret_name || "no key"})`).join(". ") + ".");
  return "";
}
