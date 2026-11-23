# Field inbox (Nov 23 2026)

Hands-free capture for Justin's Meta Ray-Ban Display glasses, plus site-visit videos.

- "Hey Meta, send a WhatsApp to Møthership: <anything>" -> WhatsApp Cloud API -> `whatsapp-inbound` -> FieldInbox row -> routed to a Task, Idea, client note, Claude job or site-visit Claude job -> one-line WhatsApp reply.
- Record video in a business -> it syncs to the Meta AI app and the camera roll -> `/field` (Claude › Field inbox, or the camera icon in the top bar, or "Site visit" on Command) -> pick the business, add the videos, say what you want -> FieldInbox (upload, site_visit) + ClaudeJob kind `site_visit` (queued, priority 2).
- iPhone SMS is not supported by the glasses for this; WhatsApp is the channel.

## Files

| What | Where |
|---|---|
| Entity | `base44/entities/FieldInbox.jsonc` (admin-only RLS); `ClaudeJob.kind` gains `site_visit` |
| Pure logic (signature, allowlist, dedupe, routing rules, client match, replies, site_visit brief) | `base44/shared/fieldInbox.js` |
| Writes (route, media store, transcribe, WhatsApp send, site visit queue) | `base44/shared/fieldInboxServer.ts` |
| Webhook (public, signature-checked) | `base44/functions/whatsapp-inbound/entry.ts` |
| Admin function (status, save numbers, quick capture, site visit) | `base44/functions/field-inbox/entry.ts` |
| Page `/field` | `src/features/field/FieldPage.jsx` (+ `FieldItemRow.jsx`, `fieldClient.js`) |
| Command card | `src/features/field/FieldInboxCard.jsx` |
| Settings › Field inbox | `src/features/field/FieldInboxSettings.jsx` |
| Tests | `tests/unit/fieldInbox.test.js` |

## Webhook URL

`https://base44.app/api/apps/69d80bb06c5ad07a795df54e/functions/whatsapp-inbound`

GET answers Meta's verification handshake; POST takes messages. With no secrets it returns 503 and does nothing.

## Secrets (names only)

- `WHATSAPP_VERIFY_TOKEN` any long random string; type the same one into Meta's webhook form.
- `WHATSAPP_APP_SECRET` Meta app > App settings > Basic > App secret (X-Hub-Signature-256 check).
- `WHATSAPP_TOKEN` permanent System User token with `whatsapp_business_messaging` (and `whatsapp_business_management`).
- `WHATSAPP_PHONE_NUMBER_ID` the Møthership number's Phone number ID.
- `JUSTIN_WHATSAPP_NUMBERS` Justin's own WhatsApp number(s), comma separated, full international digits (or set them in Settings › Field inbox).
- Optional `OPENAI_API_KEY` (already used by Voice Core) transcribes voice notes on arrival; without it the queue runner transcribes them.

## Routing rules (WhatsApp and the web quick capture)

1. `task:` / `to-do:` / "add a task" -> Task (status `next` when a client is matched, else `inbox`).
2. `idea:` / "I have an idea" -> Idea (Idea Vault).
3. `note:` / "note for <client>" -> appended to the client's notes and to their BusinessBrain `pending_updates` (Interstellar Brain when no client).
4. A video -> site_visit ClaudeJob (a video with no words -> Task in Inbox: say who and what).
5. build / fix / redo / make / research / write -> ClaudeJob kind `task`, queued, the text is the brief.
6. Nothing matched -> Base44 InvokeLLM classifies (task / idea / note / claude_job, plus a client from CRMClient). Confidence under 0.6 or unclear -> Task in Inbox.

Client match: business name, the name without suffixes, its first two words, domain stem, owner's full name, bundle (e.g. "Chase package"). Ties are not matched. Every row records `routed_to`. Routing never publishes or sends; the only outbound message is the WhatsApp reply to Justin's own number.

Only numbers in `JUSTIN_WHATSAPP_NUMBERS` or Settings are accepted; everyone else gets no row and no reply. Retries are deduped on the WhatsApp message id (`external_id`).

## Upload limits

Base44 storage (Core UploadFile): 100 MB per video or audio file, 40 MB per photo, 10 MB for other types. `/field` uploads each file with byte progress; a video over 100 MB is split into 95 MB byte chunks (one storage file each, up to 12 parts, about 1.1 GB) and the runner joins them with `cat`. WhatsApp itself caps media at 16 MB, so long glasses clips go through `/field`.

## WhatsApp Cloud API setup (Justin)

1. business.facebook.com: use (or create) the Interstellar Strategies Meta Business account; verify the business if asked.
2. developers.facebook.com > My Apps > Create app > type Business > connect it to that Business account.
3. In the app: Add product > WhatsApp > Set up. This creates a WhatsApp Business Account and a free test number.
4. WhatsApp > API setup > Add phone number: add a number that is NOT on a WhatsApp app (a new SIM or a Google Voice/virtual number that can receive an SMS or call), verify it with the code, set the display name (e.g. "Møthership"). Copy its Phone number ID -> secret `WHATSAPP_PHONE_NUMBER_ID`.
5. Business settings > Users > System users > Add (Admin). Add assets: the app (full control) and the WhatsApp account (full control). Generate token: choose the app, expiry Never, permissions `whatsapp_business_messaging` and `whatsapp_business_management` -> secret `WHATSAPP_TOKEN`.
6. App settings > Basic > App secret > Show -> secret `WHATSAPP_APP_SECRET`.
7. Make up a long random verify token -> secret `WHATSAPP_VERIFY_TOKEN`.
8. Your own number -> secret `JUSTIN_WHATSAPP_NUMBERS` (e.g. 15035550100), or Settings › Field inbox › Allowed numbers.
9. Add the five secrets in Base44 (app > Settings > Secrets). Settings › Field inbox shows each one as Set or Missing.
10. WhatsApp > Configuration > Webhook > Edit: Callback URL = the webhook URL above, Verify token = the same string. Verify and save. Then Webhook fields > `messages` > Subscribe.
11. Switch the app to Live (App mode) so real numbers can message it (needs a privacy policy URL in App settings > Basic).
12. On the phone: save the Møthership number as a contact named "Møthership". In the Meta AI app, make sure WhatsApp is connected to the glasses.
13. Send the first message yourself ("task: test the field inbox"). That opens the 24-hour window; replies are free-form text inside it.

## Runner section for kind site_visit (paste into the queue runner's scheduled-task prompt)

KIND site_visit (Field inbox site visits). The ClaudeJob instructions hold the full brief: media URLs, Justin's prompt, the business, what to produce and the FieldInbox id. Work it like this:
1. Set the job to running, started_at now.
2. Download every media URL into a fresh folder with curl -L. A media item listed with parts is one large video split into byte chunks: download every part, join them in order with cat into one .mp4, and check it with ffprobe.
3. Frames: for each video, ffmpeg -i in.mp4 -vf fps=0.4,scale=1280:-2 f_%04d.jpg (one frame every 2.5 s) and ffmpeg -i in.mp4 -vf "select='gt(scene,0.35)',scale=1280:-2" -vsync vfr s_%04d.jpg (scene changes). Keep each frame's timestamp. Look at the frames yourself. Photos are looked at directly.
4. Narration: pip install faster-whisper if it is missing; transcribe each video with base.en (tiny.en for clips over 10 minutes), compute_type int8, keeping segment timestamps. A silent or tone-only track gives an empty transcript: say so and do not invent narration.
5. If a website URL is given, fetch the home, main service, contact and booking pages. Never log in anywhere.
6. Read the client's BusinessBrain.context_md (when there is a client) and the BuildChecklistTemplate for the client's niche_key (else other).
7. result_body (markdown), every claim tied to a frame timestamp, a transcript line or a fetched page: What the business is and does (as seen); Current website review (only with a URL); Website improvement plan (prioritised, taste items marked for Justin); Operations map (lead in, booking, job or sale, payment, follow-up, and where the cracks are); Command System plan (modules mapped to the niche BuildChecklistTemplate item keys, plus gaps); Content clips (3 to 8, start and end timestamps, what is in the shot, hook line, platform); Facts not confirmed.
8. If Justin's prompt asks to build: find the business in CRMClient by name, domain or Google place and never create a duplicate; if it is missing create it with status Lead, pipeline_stage new, business, websites, domain, city, one_liner, niche_key, lead_source in_person. Then queue one ClaudeJob kind lead_build the Build Engine way (title "Build: <business>", status queued, priority 2, client_id, client_name, brand interstellar, instructions = the lead brief plus this job's findings, references = this job's media, complete_task_on_approve false, context { niche_key, source site_visit, site_visit_job_id }). Do not start the build in this job. [TEST] jobs never create a lead or a build.
9. Content library: when a client_id exists, cut each suggested clip with ffmpeg, upload the clips and the 3 to 6 best frames to Base44 storage, and create ClientFile rows (category video or social, description with timestamp and hook, portal_visible false).
10. Write back result_summary, result_body, result_links, result_data { frames_reviewed, transcript_chars, clips, niche_key, build_queued_job_id }, needs_from_justin, status needs_approval, finished_at now. Set the FieldInbox row to done with processed_at and ai_summary.
Rules: analysis and drafts only; nothing is published, deployed, posted or sent and nobody at the business is contacted; real facts only (missing facts go to needs_from_justin); never read or store secret values.

Also: a ClaudeJob routed from the field inbox (kind task, context.source field_inbox) whose brief says "voice note: not transcribed yet" means download the audio, transcribe it with faster-whisper base.en, write the transcript into the FieldInbox row's text, then file it with the routing rules above (task / idea / note / Claude job). Set that FieldInbox row to done when finished.
