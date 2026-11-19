import { isEmail, normEmail } from "./store";
import { contentTokensLeft, missingMerge } from "./emailBlocks";

// Audience -> recipients with merge values. Every recipient gets their own email at send time.
// audience = { mode: "clients" | "list" | "subscribers" | "manual", client_ids, list_id, tag, emails_text, overrides: { [client_id]: email }, excluded: [email] }
// kind: clients / manual = "direct" (1:1, no unsubscribe link); list / subscribers = "mass" (unsubscribe link, unsubscribes skipped).

export const AUDIENCE_MODES = [
  { key: "clients", label: "Clients", hint: "One or more clients, each gets their own email" },
  { key: "list", label: "Saved list", hint: "A saved mix of clients and subscribers" },
  { key: "subscribers", label: "Subscribers", hint: "Everyone subscribed (or one tag)" },
  { key: "manual", label: "Addresses", hint: "Type addresses" },
];
export const kindFor = (mode) => (mode === "list" || mode === "subscribers" ? "mass" : "direct");

export function clientEmails(c) {
  return [...new Set([...(c.emails || []), ...(c.portal_emails || [])].map(normEmail).filter(isEmail))];
}

const firstOf = (name) => String(name || "").trim().split(/[\s&,]+/)[0] || "";

export function clientVars(c, portalUrl, email) {
  const contact = String(c.contact || "").trim();
  return {
    first_name: firstOf(contact),
    contact_name: contact,
    business: c.business || "",
    email: email || "",
    website: (c.websites || [])[0] || (c.domain ? `https://${c.domain}` : ""),
    portal_url: portalUrl,
    plan: c.plan || "",
  };
}

export function subscriberVars(s, portalUrl) {
  return { first_name: firstOf(s.name), contact_name: s.name || "", business: s.business || "", email: normEmail(s.email), website: "", portal_url: portalUrl, plan: "" };
}

const fromClient = (c, portalUrl, overrides) => {
  const options = clientEmails(c);
  const chosen = normEmail(overrides && overrides[c.id]);
  const email = options.includes(chosen) ? chosen : options[0] || "";
  return { key: `c:${c.id}`, source: "client", client_id: c.id, name: c.business, email, options, vars: clientVars(c, portalUrl, email) };
};
const fromSub = (s, portalUrl) => ({ key: `s:${s.id}`, source: "subscriber", subscriber_id: s.id, name: s.name || s.email, email: normEmail(s.email), options: [], vars: subscriberVars(s, portalUrl), status: s.status });
const fromAddress = (e, portalUrl) => ({ key: `m:${e}`, source: "manual", name: e, email: e, options: [], vars: { email: e, portal_url: portalUrl } });

export function parseAddresses(text) {
  return [...new Set(String(text || "").split(/[\s,;]+/).map(normEmail).filter(isEmail))];
}

export function resolveAudience(audience, { clients = [], subscribers = [], lists = [], portalUrl }) {
  const a = audience || {};
  const byClient = new Map(clients.map((c) => [c.id, c]));
  const subscribed = subscribers.filter((s) => s.status !== "unsubscribed");
  let out = [];
  if (a.mode === "clients") out = (a.client_ids || []).map((id) => byClient.get(id)).filter(Boolean).map((c) => fromClient(c, portalUrl, a.overrides));
  if (a.mode === "subscribers") out = subscribed.filter((s) => !a.tag || (s.tags || []).includes(a.tag)).map((s) => fromSub(s, portalUrl));
  if (a.mode === "manual") out = parseAddresses(a.emails_text).map((e) => fromAddress(e, portalUrl));
  if (a.mode === "list") {
    const list = lists.find((l) => l.id === a.list_id);
    if (list) {
      const subIds = new Set(list.subscriber_ids || []);
      out = [
        ...(list.client_ids || []).map((id) => byClient.get(id)).filter(Boolean).map((c) => fromClient(c, portalUrl, a.overrides)),
        ...subscribed.filter((s) => subIds.has(s.id) || (list.subscriber_tag && (s.tags || []).includes(list.subscriber_tag))).map((s) => fromSub(s, portalUrl)),
        ...(list.emails || []).map(normEmail).filter(isEmail).map((e) => fromAddress(e, portalUrl)),
      ];
    }
  }
  // One email per address: a client also on the subscriber list keeps the client's merge data.
  const seen = new Set();
  const excluded = new Set((a.excluded || []).map(normEmail));
  return out.filter((r) => {
    if (!r.email || seen.has(r.email)) return !r.email; // keep clients with no email so the picker can flag them
    seen.add(r.email);
    return true;
  }).map((r) => ({ ...r, excluded: excluded.has(r.email) }));
}

// Per-recipient problems for the send check.
export function recipientIssues(doc, r) {
  const issues = [];
  if (!r.email) issues.push("No email on file");
  const missing = missingMerge(doc, r.vars);
  if (missing.length) issues.push(`Missing ${missing.join(", ")}`);
  return issues;
}

// Email-level warnings (placeholders left, empty button URL, etc.).
export function docWarnings(doc) {
  const w = [];
  if (!String(doc.subject || "").trim()) w.push("The subject line is empty.");
  const text = JSON.stringify([doc.subject, doc.blocks]);
  const holes = [...new Set((text.match(/\[[^\]\[\n"]{1,80}\](?!\()/g) || []))];
  if (holes.length) w.push(`Unfilled placeholders: ${holes.slice(0, 6).join(" ")}${holes.length > 6 ? " …" : ""}`);
  const tokens = contentTokensLeft(doc);
  if (tokens.length) w.push(`Write these before sending: ${tokens.map((k) => `{{${k}}}`).join(" ")}`);
  (doc.blocks || []).forEach((b) => {
    if (b.type === "button" && !String(b.url || "").trim()) w.push(`The "${b.label || "button"}" button has no link.`);
    if (b.type === "image" && !String(b.url || "").trim()) w.push("An image block has no image URL.");
    if (b.type === "videos" && (b.items || []).some((x) => !String(x.url || "").trim())) w.push("A video card has no link.");
    if (b.type === "links" && (b.items || []).some((x) => !String(x.url || "").trim())) w.push(`A read link has no URL.`);
  });
  return w;
}
