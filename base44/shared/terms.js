// Portal terms gate (clickwrap) core: docs/portal-terms.md. Pure functions shared by the portal and portal-terms
// backend functions and the unit tests (tests/unit/terms.test.js). No secrets, no I/O.
//
// Proof model: a TermsAcceptance row is written once, by the portal-terms function only (append-only: no update or
// delete path exists in code, and the entity RLS refuses both). It stores who (login email + name + typed signature),
// for which client, which exact text (version + SHA-256 of the body as shown), when (server clock), from where
// (IP + user agent from the request), what they ticked, and a PDF snapshot of the terms plus the signature block.

export const REQUIRED_CHECKS = [
  { key: "agree_tos", label: "I have read and agree to the Interstellar Terms of Service." },
  { key: "agree_cancellation", label: "I understand the cancellation terms (30 days' written notice) and, if my plan includes a Command System, the one-time $750 migration fee when I cancel." },
];

const s = (v) => (v == null ? "" : String(v));

// The exact text that is hashed and shown: line endings normalized, trailing spaces trimmed, outer blank lines removed.
export function normalizeBody(text) {
  return s(text).replace(/\r\n?/g, "\n").split("\n").map((l) => l.replace(/[ \t]+$/, "")).join("\n").trim();
}

export async function sha256Hex(text) {
  const buf = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(normalizeBody(text)));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// A version is only trustworthy when its stored hash still matches its body (nobody edited it after publishing).
export async function hashMatches(version) {
  if (!version || !version.sha256) return false;
  return (await sha256Hex(version.body_markdown)) === s(version.sha256).toLowerCase();
}

const lc = (v) => s(v).trim().toLowerCase();

// Has this login accepted this exact version for this client?
export function hasAccepted(acceptances, { clientId, email, version, sha256 }) {
  return (acceptances || []).some((a) => a.client_id === clientId && lc(a.user_email) === lc(email) && s(a.version) === s(version) && lc(a.terms_sha256) === lc(sha256));
}

// The newest earlier version this login accepted for this client (for the "What changed" note).
export function previousAccepted(acceptances, { clientId, email, version }) {
  return (acceptances || [])
    .filter((a) => a.client_id === clientId && lc(a.user_email) === lc(email) && s(a.version) !== s(version))
    .sort((a, b) => s(b.accepted_at).localeCompare(s(a.accepted_at)))[0] || null;
}

// Is the portal blocked for this user? Admins (Justin previewing) and lead-tier logins are never gated; with no
// active version there is nothing to accept.
export function gateDecision({ user, client, active, acceptances }) {
  if (!user || user.role === "admin") return { required: false, reason: "admin" };
  if (!client) return { required: false, reason: "no_client" };
  if (client.portal_tier === "lead") return { required: false, reason: "lead_tier" };
  if (!active) return { required: false, reason: "no_active_version" };
  if (hasAccepted(acceptances, { clientId: client.id, email: user.email, version: active.version, sha256: active.sha256 })) return { required: false, reason: "accepted" };
  return { required: true, reason: previousAccepted(acceptances, { clientId: client.id, email: user.email, version: active.version }) ? "new_version" : "never_signed" };
}

// What the browser sent, checked against the active version. Returns a list of problems (empty = OK).
export function acceptanceErrors({ active, sentVersionId, sentSha, checks = {}, signature = "", scrolledToEnd = false }) {
  const errs = [];
  if (!active) errs.push("There is no active version of the terms to accept.");
  else {
    if (s(sentVersionId) !== s(active.id)) errs.push("The terms changed while this page was open. Reload to read the current version.");
    if (lc(sentSha) !== lc(active.sha256)) errs.push("The terms you read are not the current version. Reload to read the current version.");
  }
  for (const c of REQUIRED_CHECKS) if (checks[c.key] !== true) errs.push(`Tick: ${c.label}`);
  const sig = s(signature).trim().replace(/\s+/g, " ");
  if (sig.length < 3 || !/[A-Za-zÀ-ÿ]/.test(sig)) errs.push("Type your full legal name to sign.");
  if (sig.length > 120) errs.push("That name is too long.");
  if (scrolledToEnd !== true) errs.push("Scroll to the end of the terms first.");
  return errs;
}

// First address in X-Forwarded-For (the client), else the other proxy headers.
export function clientIp(headers) {
  const get = (k) => s(headers && (typeof headers.get === "function" ? headers.get(k) : headers[k]));
  const xff = get("x-forwarded-for").split(",")[0].trim();
  return (xff || get("cf-connecting-ip") || get("x-real-ip") || "unknown").slice(0, 64);
}

// The one record written per acceptance. accepted_at, ip and user_agent come from the server, never the browser.
export function buildAcceptance({ client, user, active, signature, checks, scrolledToEnd, ip, userAgent, acceptedAt, pdfUrl = "", isTest = false }) {
  return {
    client_id: client.id,
    client_name: s(client.business),
    user_email: lc(user.email),
    user_name: s(user.full_name),
    typed_signature: s(signature).trim().replace(/\s+/g, " "),
    version: s(active.version),
    terms_version_id: s(active.id),
    terms_title: s(active.title),
    terms_sha256: lc(active.sha256),
    accepted_at: acceptedAt,
    ip: s(ip),
    user_agent: s(userAgent).slice(0, 400),
    checkbox_confirmations: REQUIRED_CHECKS.map((c) => ({ key: c.key, label: c.label, checked: checks[c.key] === true })),
    scrolled_to_end: scrolledToEnd === true,
    pdf_url: pdfUrl,
    is_test: !!isTest,
  };
}

// Publishing a draft: it becomes the only active version; the previous active one is retired.
export function planPublish(versions, draftId) {
  const draft = (versions || []).find((v) => v.id === draftId);
  if (!draft) return { error: "Draft not found." };
  if (draft.status !== "draft") return { error: "Only a draft can be published." };
  if (!s(draft.version).trim()) return { error: "Give the draft a version (e.g. 2026-11-23)." };
  if ((versions || []).some((v) => v.id !== draftId && s(v.version) === s(draft.version))) return { error: `Version ${draft.version} already exists. Use a new version label.` };
  return { activate: draftId, retire: (versions || []).filter((v) => v.status === "active").map((v) => v.id) };
}

// Status chip for a client: signed the active version (any of its logins) / signed an older one / not signed.
export function clientTermsStatus(acceptances, { clientId, active }) {
  const mine = (acceptances || []).filter((a) => a.client_id === clientId).sort((a, b) => s(b.accepted_at).localeCompare(s(a.accepted_at)));
  if (!active) return { state: mine.length ? "signed_old" : "none", label: mine.length ? `Signed v${mine[0].version}` : "No active terms", last: mine[0] || null };
  const cur = mine.find((a) => s(a.version) === s(active.version) && lc(a.terms_sha256) === lc(active.sha256));
  if (cur) return { state: "signed", label: `Signed v${active.version}`, last: cur };
  if (mine.length) return { state: "signed_old", label: `Needs v${active.version} (signed v${mine[0].version})`, last: mine[0] };
  return { state: "not_signed", label: "Not signed", last: null };
}
