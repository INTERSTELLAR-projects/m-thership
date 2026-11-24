# Portal terms gate (clickwrap), Nov 23 2026

Every client portal login must accept the active Interstellar Terms of Service before the portal shows anything.

## How it works
- `TermsVersion` holds versions (draft / active / retired). Only one real version is active. Publishing a draft (Legal › Client Terms of Service › Publish, which requires ticking "A lawyer reviewed this version") retires the old one and re-prompts every login, with the "What changed" note.
- The `portal` function answers 428 `terms_required` (with only the terms, no portal data) until the signed-in login has an acceptance of the active version's exact hash for that client. `resolveClient` (studios, fuel, AI, email, decks, training, usage, add-ons) also refuses such logins.
- Per login, tied to the client: each login of a client accepts for itself (no shared-login pattern existed). Admins and lead-tier logins are never gated. No active version = no gate.
- The gate (`src/features/terms/TermsGate.jsx`) shows the summary points, then the full scrollable terms; accepting needs scrolling to the end, two ticks (terms; cancellation + $750 migration), and the typed full legal name. "Download a copy" saves the exact text as a PDF.

## Proof stored (TermsAcceptance, append-only)
client_id, client_name, user_email, user_name, typed_signature, version, terms_version_id, terms_title, terms_sha256 (re-checked on the server at signing), accepted_at (server clock), ip (x-base44-connecting-ip / true-client-ip / X-Forwarded-For), user_agent (x-base44-caller-user-agent), checkbox_confirmations [{key,label,checked}], scrolled_to_end, pdf_url (private PDF: full terms + signature block + fingerprint), email_status, is_test.
RLS: create/update/delete are service-only; only the `portal-terms` function creates rows and no code updates or deletes them (a unit test scans the codebase). Admins read all; a login reads its own.

Copies: the signer and the app's admin accounts get an email with a 7-day PDF link. [TEST] clients or logins: admins only, subject starts with [TEST].

## Files
`base44/entities/TermsVersion.jsonc`, `TermsAcceptance.jsonc` · `base44/shared/terms.js` (pure; copy in `src/lib/terms.js`) · `termsServer.ts` · `termsDraftV1.js` · `base44/functions/portal-terms` · `portalApi.ts` / `portalClient.ts` (gate) · `src/features/terms/*` · Legal page, client page (Setup & billing › Terms & agreements + header chip), Clients list "Terms: not signed" filter · `tests/unit/terms.test.js`.

## Test data
A `test_only` TermsVersion `TEST-2026-11-23` applies only to clients named `[TEST] ...`; client `[TEST] Terms Gate Demo Co`; one [TEST] acceptance by the labeled test login. Real clients are not gated until Justin publishes a real version.
