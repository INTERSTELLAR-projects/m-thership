// QA / Presentation fixtures for the portal terms gate (fictional, in memory only). Loaded on demand by src/lib/qa.js.
import { DRAFT_V1 } from "./draftV1";
import { REQUIRED_CHECKS, clientTermsStatus } from "@/lib/terms";

const SHA = "3f6c1b0e9a7d4c2b8e5f1a0d6c9b2e7f4a1d8c5b2e9f6a3d0c7b4e1f8a5d2c9b";
const ago = (d) => new Date(Date.now() - d * 864e5).toISOString();
const ACTIVE = { id: "tv-active", ...DRAFT_V1, version: "2026-11-01", status: "active", sha256: SHA, published_at: ago(22), lawyer_reviewed: true, change_note: "" };
const DRAFT = { id: "tv-draft", ...DRAFT_V1, status: "draft", sha256: "9a1e7c3b5d2f8e4a6c0b9d1f3e5a7c2b4d6f8e0a1c3b5d7f9e2a4c6b8d0f1e3a", lawyer_reviewed: false, change_note: "Added the $750 Command System migration fee and 30-day notice wording." };
const ACC = [
  { id: "ta1", client_id: "c1", client_name: "Summit Roofing Co", user_email: "dana@summit.test", user_name: "Dana Reyes", typed_signature: "Dana M. Reyes", version: "2026-11-01", terms_version_id: "tv-active", terms_sha256: SHA, accepted_at: ago(9), ip: "203.0.113.24", user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) Safari/604.1", pdf_url: "private:qa", checkbox_confirmations: REQUIRED_CHECKS.map((c) => ({ ...c, checked: true })), scrolled_to_end: true },
];

export function qaTermsInvoke(args = {}) {
  if (args.action === "versions") return { versions: [{ ...DRAFT, acceptances: 0 }, { ...ACTIVE, acceptances: ACC.length }] };
  if (args.action === "client_status") {
    const acc = ACC.filter((a) => a.client_id === args.client_id);
    return { active: ACTIVE, status: clientTermsStatus(acc, { clientId: args.client_id, active: ACTIVE }), acceptances: acc };
  }
  if (args.action === "summary") return { active: { id: ACTIVE.id, version: ACTIVE.version }, signed_client_ids: ["c1"], ever_signed_client_ids: ["c1"] };
  if (args.action === "pdf_link") return { url: "" };
  if (args.action === "accept") return { ok: true };
  return { ok: true };
}

// ?terms=1 on the QA preview: the portal answers like a login that has not signed yet (gate screenshots).
export function qaTermsGateError() {
  const data = { code: "terms_required", error: "Please review and accept the Interstellar Terms of Service to open your portal.", reason: "never_signed", client: { id: "c2", business: "Harbor Coffee" }, terms: { id: DRAFT.id, version: DRAFT.version, title: DRAFT.title, body_markdown: DRAFT.body_markdown, summary_points: DRAFT.summary_points, change_note: DRAFT.change_note, sha256: DRAFT.sha256 }, previous_version: "", checks: REQUIRED_CHECKS, user: { email: "lee@harbor.test", name: "Lee Park" } };
  const e = new Error("terms_required");
  e.response = { status: 428, data };
  return e;
}
