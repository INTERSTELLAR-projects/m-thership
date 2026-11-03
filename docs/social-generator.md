# Social Studio: weekly Claude generator

Møthership's Social Studio (`/social`, admin only) renders on-brand 1080×1080 posts for
Interstellar Strategies from **structured specs**. Claude never makes images. A scheduled
Claude task writes `SocialPost` records (template key + spec + captions) once a week; Justin
reviews them in `/social`, edits inline or with "Edit with AI", downloads the PNGs, posts them
by hand and marks them posted. Nothing in this pipeline posts to social media.

## Files the task reads

| File | What it holds |
| --- | --- |
| `src/features/social/brand.js` | Voice, hard rules, pain points (with fixes), pillars, real offer prices, CTA examples, hashtag bank, banned words |
| `src/features/social/templates.schema.json` | `spec_common` field rules + every template: label, description, `best_for` pillars, `mock` shape, and a full `example` spec |
| `base44/entities/SocialPost.jsonc` | The record shape |

## Recommended schedule

Weekly, **Sunday ~6pm Pacific**, producing **5 posts for Monday–Friday** of the coming week.

## Scheduled-task prompt (copy exactly)

```text
You are generating next week's social media batch for Interstellar Strategies in Justin Cowell's
Base44 app "Møthership" (app id 69d80bb06c5ad07a795df54e). Use the Base44 MCP tools
(read_file, query_entities, create_entities). Do NOT create checkpoints, do NOT edit any code,
and NEVER post, schedule or send anything to any social network or person.

1. Work out the dates. MONDAY = the next Monday after today (YYYY-MM-DD). The batch covers
   MONDAY..FRIDAY. BATCH_ID = "wk-<MONDAY>". FOLDER = "Week of <MONDAY>".

2. Read the rules. read_file these and follow them exactly:
   - src/features/social/brand.js            (voice, hard rules, pain points, pillars, offers)
   - src/features/social/templates.schema.json (template keys, spec_common limits, mock shapes, examples)
   Then query_entities AgencyKnowledge (sort "sort"): the "offers" section's data.offers is the ONE
   source for prices, and "voice" / "delivery_rules" add to brand.js. If a price there differs from
   brand.js BRAND.offers, use AgencyKnowledge and mention the mismatch in your final report.

3. Avoid repeats. query_entities SocialPost, sort "-created_date", limit 60. Keep the ones
   created in the last 28 days. Note their spec.headline, template, pillar and the pain point
   they used. If any record already has generation_batch == BATCH_ID, STOP and report
   "batch already exists" (do not create duplicates).

4. Plan 5 posts, one per weekday:
   - Pillars: use 5 different pillars from brand.js PILLARS. Include at most one "offer" post,
     and only every other week (skip "offer" if one was created in the last 7 days).
   - Templates: 5 different template keys from templates.schema.json, each a good fit for its
     pillar (see best_for). Don't reuse a template that appeared in last week's batch on the
     same weekday. Mix light and dark themes (a 3/2 split either way).
   - Hooks: every headline must be new. No headline, accent_word or pain point angle that
     repeats or closely paraphrases anything from the last 28 days.
   - At least 2 posts must be product showcases of the real UI templates (dashboard,
     command_briefing, portal_preview, pipeline_board, toast_stack, review_qr, stack_collapse).

5. Write each spec. Start from the template's `example` in templates.schema.json and replace
   the copy and mock data. Rules:
   - Respect every max length in spec_common and the template's mock. If text is long, shorten it.
   - accent_word must appear verbatim in headline.
   - theme: "light" | "dark"; lockup: "mothership" for product UI posts, otherwise "interstellar".
   - Mock UI uses FICTIONAL service businesses only (e.g. Ridgeline Plumbing, Summit Air HVAC,
     Cedar & Stone Landscaping, Bayview Roofing, Lakeside Electric, or new invented ones that
     don't match a real Interstellar client). Never real client names, numbers or reviews.
   - Never invent client results, statistics, testimonials or reviews. big_stat: hypothetical
     must be true unless note cites a real, verifiable source. Mock numbers are fine because the
     templates label them "Sample data".
   - offer_stack prices come ONLY from AgencyKnowledge offers (brand.js BRAND.offers is the fallback; identical figures, no discounts,
     no deadlines, no scarcity).
   - Slogan is exactly "The Future of Business". No emoji anywhere. Avoid brand.js banned_words.

6. Write captions for each post:
   - caption (Instagram/Facebook/X/TikTok): hook line, 2-4 short lines, clear CTA, then 3-6
     relevant hashtags (from brand.js hashtag_bank or close variants) on the last line. Under 600 chars.
   - caption_linkedin: same idea, a little longer and reflective, first person as Justin is fine
     for founder_story, 3-5 hashtags at the end. Under 1200 chars.
   - alt_text: plain description of the image, under 250 chars, mention "sample data" when the
     image shows mock UI.

7. create_entities SocialPost with all 5 records in ONE call. Each record:
   {
     "title": "<Mon|Tue|Wed|Thu|Fri> · <Template label>: <short topic>",
     "status": "draft",
     "folder": FOLDER,
     "pillar": "<pillar key>",
     "platforms": ["instagram","facebook","linkedin"] (+ "x" for short text-led posts),
     "template": "<template key>",
     "spec": { eyebrow, headline, accent_word, subhead, body?, cta, theme, lockup, mock: {...} },
     "caption": "...", "caption_linkedin": "...", "alt_text": "...",
     "generation_batch": BATCH_ID,
     "generated_by": "claude",
     "planned_for": "<that weekday's date YYYY-MM-DD>",
     "revision_history": []
   }

8. Report back in 6 lines max: batch id, folder, and for each post the weekday, template,
   pillar and headline. Remind Justin the drafts are in Møthership > Studio > Social Studio.
   Do not say anything was posted or scheduled.
```

## How Justin works the batch

1. Open **Studio → Social Studio**, filter by batch or folder.
2. Open a post: edit any field inline (live preview), switch template, or type an instruction in
   **Edit with AI** ("make the headline punchier, keep the rest"). A diff appears with Apply /
   Discard; every applied change is in Revision history with Undo / Restore.
3. **Variations** gives 3 alternative hooks; **Write with AI** rewrites captions and alt text.
4. **Download PNG** (exactly 1080×1080, brand fonts embedded) or, on the list, select posts /
   filter a batch and **Download (.zip)** for all PNGs plus a caption .txt per post.
5. Post manually, paste the post URL and click **Mark posted** (or drag the card to Posted).
   "Scheduled" is only a reminder status; nothing auto-posts.

## Later (not built yet)

- Direct scheduling to Instagram / Facebook / LinkedIn via a connector.
- Per-client brand kits (swap colors, fonts and lockup per CRMClient) to offer this to clients.
- Carousels: multi-slide posts (carousel_cover exists as the cover template).
