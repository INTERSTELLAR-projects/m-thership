# Content pipeline (client submissions → live website pages)

A client sends a project or a testimonial from their Command System. Møthership checks it, writes it up for search
(SEO / AIO / GEO / AEO) from the client's own words and Business Brain, and puts it on the client's website. There is
no approval or review step (Justin, 2026-11-17): automatic checks replace review, and every post can be unpublished
or edited with one click. Nothing is ever hard-deleted.

**Deliberate exception to docs/client-brain-sync.md:** that doc says Møthership never writes into a client app. This
pipeline does write to client WEBSITES, only through each site's keyed `content-publish` function, which accepts only
its content entities and allowlisted fields and never deletes.

## Flow

1. Command app → `content-intake` (`x-mothership-key` = `COMMAND_SYSTEM_SYNC_KEY`; `app_id` must be the client's
   `CRMClient.command_app_id` or `other_app_ids`, same anti-spoofing as client-brain). Upserts a `ContentSubmission`
   (key: app id + record id), status `queued`, and starts `content-writer`.
2. `content-writer` (shared/contentProcessor.ts), time-boxed steps, resumable:
   - **Checks:** client active, site registered (shared/contentSites.ts) and enabled, required fields and minimum
     length, "OK to feature" (projects) / customer consent (testimonials), profanity, spam, no links / emails /
     phone numbers, duplicate hash, daily/weekly limits, AI moderation. Fail → `needs_info` or `rejected`, nothing
     published, the client is told what to fix.
   - **Photos:** only files uploaded in the sending app; JPEG/PNG/WebP (HEIC refused with a message), ≤ 25 MB, cover
     ≥ 1200 px; large JPEGs re-encoded at q92 with the long edge capped at 6000 px; EXIF/XMP (incl. GPS) removed;
     re-hosted in Møthership storage; width/height stored.
   - **Writer:** InvokeLLM only (no Anthropic/OpenAI keys). Polishes title, answer-first overview, SEO title and
     description, category, project type and 0-3 service links chosen from the LIVE site's catalog (the site's signed
     `catalog` call, else its sitemap). Facts (camera, lenses, place, time, client) are copied from the submission,
     never from the AI. Alt text follows the site's existing pattern and never describes photo contents.
   - **Claim check:** a second AI pass lists every claim and marks unsupported ones; numbers, prices, ® and the
     platform name are also checked without AI. One rewrite with the feedback, then `needs_info`.
   - **Testimonials:** the quote is posted in the customer's exact words (whitespace / quote marks normalized only).
   - **Publish:** signed upsert to the site → fetch the live URL as Googlebot (200, title, JSON-LD) → sitemap contains
     it → IndexNow if the site has a key file (else `not_supported`) → `ContentPost` log row → `WorkEntry` (done,
     visibility client, auto-approved, notes "Auto-posted from client submission") → notification email.
   - A brand-new project URL that fails the live check is unpublished again and marked `failed`.
3. Undo: Møthership → Clients → Client posts (`/client-posts`, function `content-admin`) and the client's Command app
   (`content-intake` unpublish / republish / resubmit) can Unpublish, Republish, Edit and Retry.

## Signing (Møthership → website)

Secret `CONTENT_PUBLISH_KEY`, held only by Møthership and the client WEBSITE apps (never a Command app).
Headers: `x-content-timestamp` (unix ms, ±5 min), `x-content-nonce` (hex, single use, stored in the site's
`ContentPublishLog`), `x-content-signature` = hex HMAC-SHA256(key, `${timestamp}.${nonce}.${rawBody}`).
Body carries `app_id` and `host`, which the site checks against its own. No key on either side → `not_configured`,
nothing is written.

## Testing mode

All notification emails go to the house test address (`emailBlocks.ts TEST_EMAIL`) with a line naming who would have
received them. `is_test` submissions run every step except the publish and end at `test_passed`.

## Bot render cache (measured 2026-11-17 on redline-visuals.com)

A new URL renders for Googlebot within seconds of the record being written. An edit or unpublish of a URL a bot
already fetched shows to bots after about 13 minutes (the platform caches bot renders per URL); browsers see the
change at once. The live check therefore only rolls back brand-new URLs.

## Adding a client

1. The website must read the content entity at runtime and list it in a `/functions/sitemap`.
2. Add the site's `content-publish` function (copy Redline's, change `SELF_APP_ID`, `SITE`, `HOSTS`, entities,
   field allowlist), set `CONTENT_PUBLISH_KEY` on the site, publish the site once.
3. Add the site to `base44/shared/contentSites.ts`.
4. Add the submission page + sender to the client's Command app (see the Redline plan in the content-pipeline folder).

## Manual fallback (Justin, 2026-11-17)

Every submission, for any client, has **Build page manually** on Clients → Client posts: every submitted field and
the AI draft (title, summary/overview, SEO title and description, alt text) with a copy button each, the photo grid
(prepared copies with location data removed when they exist, else the originals) with a one-click download-all
(.zip, built in the browser), and **Mark as posted manually** with the live URL (`content-admin mark_posted`). That
records it like an automatic post: status `live` + `posted_manually`, a `ContentPost` (target_entity `manual`), the
`WorkEntry` and the client notice. It needs no site endpoint and no key.

A submission lands in the manual queue (status `manual`, tab **Build manually**, Justin emailed) when:
- the site's automatic posting is off: `CONTENT_SITES[x].auto_publish` is the default, the **Auto-publish on/off**
  switch on Client posts overrides it per site (`ContentSiteSetting`);
- the client's website isn't in `CONTENT_SITES` (the checks still run first);
- a first publish fails: key not set, endpoint unreachable, the site refuses it, or the live check fails (the row is
  unpublished on the site again first).
Command apps see a manual row as `queued` ("Interstellar is building the page"). **Retry automatic publish** sends a
manual row that already has a draft straight to publishing. Unpublish / Republish don't apply to pages built by hand.

## Profiles

`SiteConfig.profile` picks the writer and record shape: `album` (Redline `Album`, default) or `door_project`
(PowerLift `ContentProject`: door sizes, system, cladding, use, city/state, month/year copied from the submission;
the AI writes only title, summary, 1-3 body sections and search fields; an optional customer quote travels verbatim
with consent and shows on that project page). PowerLift takes projects only: its /reviews page is Google reviews only.

## App change requests

`content-intake` `app_request` (same key + app_id rule): a Command System's "Request an app change" becomes a
`ClientRequest` (kind `app_edit`, source `client_app`) on the client's record, and Justin is emailed.
