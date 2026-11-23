// Portal terms gate, server side (docs/portal-terms.md): the active version, the gate check used by the portal
// function and resolveClient, the PDF snapshot and the email copies. Acceptances are only ever created here
// (no update or delete anywhere in the code).
// deno-lint-ignore-file no-explicit-any
import { REQUIRED_CHECKS, gateDecision, hashMatches, previousAccepted } from "./terms.js";

const s = (v: unknown) => (v == null ? "" : String(v));
const itemsOf = (r: any) => (Array.isArray(r) ? r : (r && r.items) || []);

// The one active version (newest published wins if a race ever left two). Cached per isolate for 30 s.
let cache: { at: number; v: any } = { at: 0, v: undefined };
export async function activeVersion(db: any, fresh = false) {
  if (!fresh && cache.v !== undefined && Date.now() - cache.at < 30_000) return cache.v;
  const rows = itemsOf(await db.TermsVersion.filter({ status: "active" }, "-published_at", 5).catch(() => []));
  const v = rows[0] || null;
  cache = { at: Date.now(), v };
  return v;
}
export const clearActiveCache = () => { cache = { at: 0, v: undefined }; };

export async function acceptancesFor(db: any, clientId: string, email = "") {
  const q: Record<string, string> = { client_id: clientId };
  if (email) q.user_email = email.toLowerCase();
  return itemsOf(await db.TermsAcceptance.filter(q, "-accepted_at", 200).catch(() => []));
}

export function publicTerms(v: any) {
  return v ? { id: v.id, version: v.version, title: v.title, body_markdown: v.body_markdown, summary_points: v.summary_points || [], change_note: v.change_note || "", effective_date: v.effective_date || "", sha256: v.sha256 } : null;
}

// null = the portal may load. Otherwise the 428 body the portal returns instead of any data.
export async function termsGate(db: any, user: any, client: any) {
  if (!user || user.role === "admin" || !client || client.portal_tier === "lead") return null;
  const active = await activeVersion(db);
  if (!active) return null;
  const mine = await acceptancesFor(db, client.id, user.email);
  const d = gateDecision({ user, client, active, acceptances: mine });
  if (!d.required) return null;
  const prev = previousAccepted(mine, { clientId: client.id, email: user.email, version: active.version });
  return {
    code: "terms_required",
    error: "Please review and accept the Interstellar Terms of Service to open your portal.",
    reason: d.reason,
    client: { id: client.id, business: client.business, logo_url: client.logo_url || client.logoUrl || "" },
    terms: publicTerms(active),
    previous_version: prev ? prev.version : "",
    checks: REQUIRED_CHECKS,
    user: { email: user.email, name: user.full_name || "" },
  };
}

export async function verifiedActive(db: any) {
  const active = await activeVersion(db, true);
  if (!active) return { active: null, ok: false };
  return { active, ok: await hashMatches(active) };
}

/* ---------------- PDF snapshot ---------------- */

const plain = (md: string) => s(md)
  .replace(/^#{1,6}\s*/gm, "")
  .replace(/\*\*(.+?)\*\*/g, "$1")
  .replace(/\*(.+?)\*/g, "$1")
  .replace(/`([^`]+)`/g, "$1");

export async function buildPdf(active: any, rec: any): Promise<Uint8Array> {
  const mod: any = await import("npm:jspdf@2.5.2");
  const JsPDF = mod.jsPDF || mod.default?.jsPDF || mod.default;
  const doc = new JsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 54;
  let y = M;
  const write = (text: string, { size = 10, bold = false, gap = 4, color = [30, 30, 30] }: any = {}) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(color[0], color[1], color[2]);
    // jsPDF's base font is Latin-1: keep text readable when a character is outside it.
    const safe = s(text).replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—]/g, "-").replace(/→/g, "->").replace(/[^\x00-\xFF]/g, "?");
    for (const line of doc.splitTextToSize(safe, W - M * 2)) {
      if (y > H - M) { doc.addPage(); y = M; }
      doc.text(line, M, y);
      y += size * 1.35;
    }
    y += gap;
  };
  doc.setFillColor(255, 60, 0); doc.rect(0, 0, W, 6, "F");
  write("INTERSTELLAR STRATEGIES", { size: 9, bold: true, color: [255, 60, 0] });
  write(`${s(active.title)} - version ${s(active.version)}`, { size: 15, bold: true, gap: 2 });
  write(`SHA-256 of the accepted text: ${rec.terms_sha256}`, { size: 7.5, color: [110, 110, 110], gap: 12 });
  for (const para of plain(active.body_markdown).split(/\n{2,}/)) write(para.replace(/\n/g, " "), { size: 9.5 });
  y += 10;
  if (y > H - 220) { doc.addPage(); y = M; }
  doc.setDrawColor(255, 60, 0); doc.line(M, y, W - M, y); y += 18;
  write("ELECTRONIC SIGNATURE", { size: 9, bold: true, color: [255, 60, 0] });
  write(`Signed: ${rec.typed_signature}`, { size: 13, bold: true });
  const rows = [
    ["Client", rec.client_name], ["Login", rec.user_email], ["Account name", rec.user_name || "-"],
    ["Version", rec.version], ["Accepted at (UTC, server time)", rec.accepted_at], ["IP address", rec.ip], ["Device", rec.user_agent],
    ...REQUIRED_CHECKS.map((c) => ["Confirmed", `[x] ${c.label}`]), ["Read to the end", rec.scrolled_to_end ? "Yes" : "No"],
  ];
  for (const [k, v] of rows) write(`${k}: ${s(v)}`, { size: 9, gap: 1 });
  write("Signed electronically under E-SIGN (15 U.S.C. 7001 et seq.) and the Oregon Uniform Electronic Transactions Act.", { size: 8, color: [110, 110, 110] });
  return new Uint8Array(doc.output("arraybuffer"));
}

export async function storePdf(base44: any, bytes: Uint8Array, name: string) {
  const up = await base44.asServiceRole.integrations.Core.UploadPrivateFile({ file: new File([bytes], name, { type: "application/pdf" }) });
  const uri = s(up && (up.file_uri || up.uri));
  if (!uri) throw new Error("storage returned no file");
  return `private:${uri}`;
}

export async function signedLink(base44: any, pdfUrl: string, seconds = 7 * 24 * 3600) {
  if (!pdfUrl) return "";
  if (!pdfUrl.startsWith("private:")) return pdfUrl;
  const r = await base44.asServiceRole.integrations.Core.CreateFileSignedUrl({ file_uri: pdfUrl.slice(8), expires_in: seconds });
  return s(r && (r.signed_url || r.url));
}

/* ---------------- email copies ---------------- */

const esc = (v: unknown) => s(v).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c] as string));

export function copyEmailHtml(rec: any, link: string, isTest: boolean) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1a1a1a">
<div style="height:4px;background:linear-gradient(90deg,#ff3c00,#ff6a00,#ffaa00)"></div>
<p style="font-size:11px;letter-spacing:2px;color:#ff3c00;margin:24px 0 4px">INTERSTELLAR STRATEGIES</p>
<h1 style="font-size:20px;margin:0 0 12px">${isTest ? "[TEST] " : ""}Your signed copy of the Interstellar Terms of Service</h1>
<p style="font-size:14px;line-height:1.5">${esc(rec.typed_signature)} accepted version ${esc(rec.version)} for ${esc(rec.client_name)} on ${esc(rec.accepted_at)} (UTC).</p>
<p style="font-size:14px;line-height:1.5">${link ? `<a href="${esc(link)}" style="color:#ff3c00">Download the signed PDF</a> (link valid for 7 days; you can download it again from your portal any time).` : "The signed PDF is kept on your account; ask us any time for a copy."}</p>
<p style="font-size:12px;color:#777;line-height:1.5">Login ${esc(rec.user_email)} · IP ${esc(rec.ip)} · terms fingerprint ${esc(String(rec.terms_sha256).slice(0, 16))}…</p>
<div style="height:4px;background:linear-gradient(90deg,#ffaa00,#ff6a00,#ff3c00);margin-top:24px"></div></div>`;
}

// Agency copy goes to the app's admin accounts (read at run time, never hard-coded).
export async function adminEmails(db: any) {
  const rows = itemsOf(await db.User.filter({ role: "admin" }, "created_date", 10).catch(() => []));
  return rows.map((u: any) => s(u.email).toLowerCase()).filter(Boolean);
}

// Real clients: a copy to the signer and to the agency admins. [TEST] clients or logins: admins only, subject
// starts with [TEST].
export async function sendCopies(base44: any, rec: any, link: string, isTest: boolean) {
  const admins = await adminEmails(base44.asServiceRole.entities);
  const to = isTest ? admins : [...new Set([rec.user_email, ...admins])];
  if (!to.length) return "skipped";
  const subject = `${isTest ? "[TEST] " : ""}Signed: Interstellar Terms of Service v${rec.version} · ${rec.client_name}`;
  let sent = 0;
  for (const addr of to) {
    try { await base44.asServiceRole.integrations.Core.SendEmail({ to: addr, subject, body: copyEmailHtml(rec, link, isTest), from_name: "Interstellar Strategies" }); sent += 1; } catch { /* recorded below */ }
  }
  return sent === to.length ? (isTest ? "test_only" : "sent") : sent ? "partial" : "failed";
}
