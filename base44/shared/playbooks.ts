// Shared helpers for the Playbooks prompt agent (functions promptAgent + logPrompt).
// Nothing here ever stores or returns a secret: scrubSecrets() runs on every PromptLog text before it is saved.

export const arr = (v: unknown): any[] => (Array.isArray(v) ? v : (v && (v as any).items) || []);
export const cut = (v: unknown, n: number) => (v == null ? "" : String(v)).slice(0, n);
export const nowIso = () => new Date().toISOString();

// Industry group = the part of CRMClient.industry before " · " (e.g. "Home services · Luxury hardscape" -> "Home services").
export const industryGroup = (s: unknown) => String(s || "").split("·")[0].trim();

// Which matrix a standard's kind lands in.
export const checkKindFor = (kind: string) => (kind === "app" ? "app" : kind === "website" || kind === "mappack" ? "site" : "business");

const SECRET_PATTERNS: [RegExp, string][] = [
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [removed]"],
  [/\b(?:sk|pk|rk)[-_](?:live|test|proj|ant)?[-_]?[A-Za-z0-9_-]{12,}/g, "[removed key]"],
  [/\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "[removed token]"],
  [/\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g, "[removed key]"],
  [/\bgh[pousr]_[A-Za-z0-9]{20,}/g, "[removed token]"],
  [/\bxox[abprs]-[A-Za-z0-9-]{10,}/g, "[removed token]"],
  [/\bAIza[A-Za-z0-9_-]{30,}/g, "[removed key]"],
  // "password: x", "api key = x" ...
  [/(\b(?:password|passwd|pwd|passcode|secret|api[ _-]?key|token|access[ _-]?key|private[ _-]?key|client[ _-]?secret|sync[ _-]?key)\s*(?:=|:|->)\s*)("[^"]*"|'[^']*'|\S+)/gi, "$1[removed]"],
  // "the password is Hunter22": only when the value looks like a credential (has a digit or symbol, 6+ chars)
  [/(\b(?:password|passwd|passcode|pin|login|api[ _-]?key|token|sync[ _-]?key)\s+is\s+)(?=\S*[0-9!@#$%^&*])(\S{6,})/gi, "$1[removed]"],
];

// Strips anything that looks like a credential. Long opaque strings that mix letters and digits (32+ chars) go too.
export function scrubSecrets(text: unknown): { text: string; removed: number } {
  let s = String(text || "");
  let removed = 0;
  for (const [re, rep] of SECRET_PATTERNS) s = s.replace(re, (...m: any[]) => { removed++; return rep.replace("$1", m[1] || ""); });
  s = s.replace(/\b[A-Za-z0-9+_-]{32,}={0,2}/g, (m) => (/[0-9]/.test(m) && /[A-Za-z]/.test(m) ? (removed++, "[removed]") : m));
  return { text: s.trim(), removed };
}

export async function listAll(E: any, q: Record<string, unknown> = {}, sort = "-created_date", n = 2000) {
  try { return arr(await E.filter(q, sort, n)); } catch { return []; }
}

export async function createMany(E: any, rows: any[]) {
  let made = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    try { await E.bulkCreate(chunk); made += chunk.length; } catch {
      for (const r of chunk) { try { await E.create(r); made++; } catch { /* skip */ } }
    }
  }
  return made;
}
