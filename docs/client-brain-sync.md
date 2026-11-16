# Client-app Business Brain → Møthership

A client's own app (Palm Shore Ops first) asks the owner questions about how the business runs and stores his
answers as `BrainFact` rows in that app. Each change is pushed to Møthership, which:

1. keeps every answer as a client-tagged `BrainFact` (`source: "client_app"`, `client_id`, `client_name`), with
   history: older answers stay as `superseded`, nothing is ever deleted;
2. records the app's question counts on `ClientDossier.client_brain` (summed across a client's apps);
3. counts Brain completeness toward the client's health score (Constellation ship, client cockpit, dashboards);
4. rebuilds the client's shared context block (`BusinessBrain.context_md`) so every agent drafting for that client
   (estimates, posts, emails) reads the owner's own answers.

Where it shows: Constellation (`/agents`) client node → detail panel "Business Brain: X/Y answered" with the latest
answers; client cockpit → Constellations tab → Business Brain card. Interstellar's own Brain (Command, `/brain`, the
main brain node) leaves client-app facts out so its numbers stay about the agency.

## Wiring

| Piece | Where |
| --- | --- |
| Endpoint | `POST https://interstellar-mothership.com/functions/client-brain` (`base44/functions/client-brain`) |
| Auth | header `x-mothership-key` = secret `COMMAND_SYSTEM_SYNC_KEY` (one key shared by every client command system), or an admin session. `MOTHERSHIP_INGEST_KEY` is accepted as a temporary fallback only; it belongs to other incoming data and is never set in a client app |
| Anti-spoofing | the sending app's `app_id` must equal `CRMClient.command_app_id` of the client it writes to; anything else gets 403 and an `AgentAuditLog` row (`action: client_brain_rejected`) |
| Logic | `base44/shared/clientBrain.js` (mapping, upsert plan, counts, `getClientBrain`, context lines) |
| Health | `src/features/constellations/pillars.js` `brainComponent` + `blendHealth` (backend copy `base44/shared/constellations.js`, keep identical) |
| Agents | `base44/shared/clientContext.ts` loads `getClientBrain(db, clientId)` into the context block ("The owner's own answers") |
| Tests | `tests/unit/clientBrain.test.js` |

Palm Shore Ops side: function `mothershipBrainSync` plus three workflows: "Business Brain → Møthership (answers)"
(BrainFact create/update), "(questions)" (BusinessBrainQuestion create/update) and "(hourly)" (reconcile at :37).
Every push sends the full list, so a missed push is repaired by the next one.

## Payload contract (`action: "ingest"`)

```json
{
  "action": "ingest",
  "app_id": "6abb58e697456bf5c1066b00",
  "app_name": "Palm Shore Ops",
  "client_id": "optional CRMClient id",
  "domain": "optional, e.g. palmshorehardscapes.com",
  "mode": "full",
  "stats": { "total": 46, "answered": 2, "open": 44, "skipped": 0 },
  "facts": [
    {
      "source_fact_id": "the fact's id in the app (required)",
      "question_key": "suppliers (empty for a free-form fact)",
      "question_id": "optional",
      "area": "materials | pricing | labor | terms | wording | builders | leads | scheduling | comms | approvals | other",
      "question": "question text at the time of capture",
      "answer": "the owner's answer (required)",
      "source": "where it was captured, e.g. owner call",
      "captured_by_name": "who typed it",
      "status": "active | superseded",
      "answered_at": "ISO date-time",
      "test": false
    }
  ]
}
```

- Client match (key calls): the `CRMClient` whose `command_app_id` is `app_id`. A `client_id`, if sent, must be that
  same client. A shared key alone can never write into another client's brain: an unregistered app, a client with no
  `command_app_id`, or a mismatch is rejected with 403 and logged. (Admin calls may also match by `client_id`,
  `ops_app_id`, `site_app_id` or `domain`.)
- `stats.total` excludes skipped questions. Send real counts only.
- `mode: "full"` = the facts list is everything the app has: stored active facts it no longer contains become
  `superseded`. `"delta"` = only the facts sent are touched.
- Idempotent: one row per `app_id + source_fact_id`, updated in place when its content changes; at most one active
  row per `app_id + question_key` (newest `answered_at` wins, older ones become `superseded`).
- Stored `question_key` is namespaced `client:<app_id>:<key>` (never collides with Teach-the-Brain keys); the app's
  own key is in `source_question_key`.
- Answers are scrubbed of anything that looks like a credential and ® becomes ™. Never send passwords.
- `test: true` facts are stored but never shown or counted.
- Response: `{ ok, client_id, created, updated, unchanged, superseded, rejected[], facts_active, brain: { answered,
  total, score }, health_before, health_after, context }`.

Area → Brain pillar: materials, labor, scheduling → delivery · pricing, terms → finance · wording, leads → sales ·
builders, other → clients · comms → marketing · approvals → systems.

## Health formula

```
brain  = round(100 × answered / total)                      (only when an app reports total > 0)
health = round((Σ scored pillar scores + brain) / (scored pillars + 1))   with a client-app brain
health = round( Σ scored pillar scores          /  scored pillars     )   without one (unchanged)
```

Brain completeness is one more equal-weight component next to the nine pillars, so each answered question raises
health by 100 / (total × 10) points (about 0.2 with 46 questions; about 10 points once all are answered). The ingest
re-blends the stored `health_score` from the stored `pillar_scores` right away; the nightly brain refresh and the
cockpit re-score with the same code. Example (Palm Shore, Nov 16 2026): pillars sum 293 over 9 → 33 before;
with 2/46 answered (4) → round(297 / 10) = 30.

## The standard for every command system (Palm Shore, Muscle Mentor, DIALD, Arcane, Redline, …)

Same secret name everywhere, one registration per client, done:

1. **Secret (once, Justin):** create one key value yourself and set it as `COMMAND_SYSTEM_SYNC_KEY` in Møthership.
   Then set the same value as `COMMAND_SYSTEM_SYNC_KEY` in each client command system app. Never paste it into code,
   chat, records or docs. Do not reuse or change `MOTHERSHIP_INGEST_KEY`.
2. **Register the app on the client:** set `CRMClient.command_app_id` to the command system's app id
   (Palm Shore: `6abb58e697456bf5c1066b00`). This is what lets that app, and only that app, write that client's brain.
3. **Copy the sender:** Palm Shore's `base44/functions/mothershipBrainSync/entry.ts`. Change `APP_ID` and `APP_NAME`,
   map the app's own fact / question entities into the payload above (keep `mode: "full"`), read the key with
   `Deno.env.get("COMMAND_SYSTEM_SYNC_KEY")`. With no key it logs one line and returns 200 (skips quietly); a rejected
   push also returns 200 so the workflows are never switched off by failures.
4. **Workflows:** on create/update of the fact entity, on create/update of the question entity, and hourly.
5. **First run:** `action: "backfill"` (or let the hourly run), then check the client's node in the Constellation.

Nothing goes live until both apps are published.

## House of Brands: three levels (client app → brand → Møthership)

Interstellar Strategies is the root brand (any industry, mostly referrals). Each niche brand (DIALD first: competition
bodybuilding coaches) sells the same 45-day rebuild into one industry, and each of its clients gets their own app built
from the brand's template app. Brains flow upward:

```
client's own app  --(client-brain ingest, client level)-->  client brain   (BrainFact source client_app, ClientDossier.client_brain)
                                                                 |  CRMClient.brand_id
brand template app --(client-brain ingest, brand level)-->  brand brain    (BrandBrainFact source brand_app, Brand.brain_stats)
                                                                 |  Brand.parent_brand_id (empty = root)
                                                            Møthership    (/brands roll-up; Interstellar's own brain stays BrainFact)
```

- Data: `Brand` (name, slug, tagline, niche, parent_brand_id, status, website_url, template_app_id, brand_app_ids,
  colors {primary, accent, background}, logo_url, offer_summary, sort_order, notes, brain_stats),
  `CRMClient.brand_id` (empty = Interstellar direct), `BrandBrainFact`, `AppFeature`, `ClientAppFeature`.
- Same endpoint, same secret: `COMMAND_SYSTEM_SYNC_KEY`. The target is always the record the sending app id is
  registered on (`base44/shared/brandBrain.js` `resolveIngestTarget`):
  - app id = `Brand.template_app_id` or in `Brand.brand_app_ids` → that brand's brain;
  - app id = `CRMClient.command_app_id` → that client's brain (unchanged);
  - anything else, a `brand_id` that is not the app's brand, `target: "brand"` from a client app or a `client_id` from a
    brand app → 403 + `AgentAuditLog` row (`action: client_brain_rejected`, entity `Brand` or `CRMClient`).
- Response for a brand push: `{ ok, level: "brand", brand_id, brand_name, created, updated, unchanged, superseded,
  rejected[], facts_active, brain: { answered, total, score } }`. Same payload contract as above; optional
  `target: "brand"` and `brand_id` must match the registration.
- Why a separate `BrandBrainFact` entity instead of a `brand_id` on `BrainFact`: `BrainFact` is read in ~16 places
  (Command, `/brain`, agents' context, the ship) as "Interstellar's own brain, minus `source: client_app`". A third kind
  of row in it would leak brand facts into the agency brain everywhere. A separate entity keeps the three levels apart
  by construction, reuses the same upsert code (`planUpsert` + `toBrandRow`) and keeps history the same way
  (superseded, never deleted).
- Roll-up (`src/features/brands/graph.js`): a brand's brain view shows its own facts and `brain_stats`, plus a summary of
  its clients' brain completeness (`ClientDossier.client_brain`). The Interstellar root rolls up everything: its own
  brain (BrainFact + BusinessBrain completeness), every brand brain and every client brain.
- Privacy: brand apps send **business** facts only (for DIALD: the coach business, never athlete records, weights,
  photos, health samples or check-ins). Møthership never reads a brand or client app directly.

### Register a brand app (brand brain)

1. In Møthership: `/brands` → Add brand (or open the brand) and set `template_app_id` to the brand template app id
   (DIALD: `6af56796b57036c616f5fd2d`, already set). Extra brand-owned apps go in `brand_app_ids`.
2. In the brand app: set the secret `COMMAND_SYSTEM_SYNC_KEY` to the same value as Møthership's.
3. In the brand app: a sender function posting the payload above to the endpoint with `x-mothership-key`, `app_id` =
   the template app id, `mode: "full"`, the coach-business facts and real `stats`. Optional `target: "brand"`.
4. Publish the brand app. Check `/brands/<slug>` → Brand brain.

### Register a client app (client brain), for a brand's client

1. Create or edit the client in Møthership and set its **Brand** (client form) so it rolls up to that brand.
2. Set `CRMClient.command_app_id` to that client's own app id (an app built from the brand template).
3. Same secret `COMMAND_SYSTEM_SYNC_KEY` in the client's app; same sender, with `app_id` = the client app id.
4. Publish. The client shows under its brand on `/brands` with its brain completeness.

A template app id and a client app id must never be the same app: register each app once, on one record.

## Feature intelligence (scaffold)

Goal: see which features clients keep, add, remove, request and use across every app, so each brand template improves.

- `AppFeature`: the features in a brand template (`in_template: true`). DIALD's 31 are seeded from the template app's
  routes and pages (read-only). Nothing invented.
- `ClientAppFeature`: one row per client + feature: `state` enabled | added | removed | requested, optional
  `usage_count` / `last_used_at`, `source` manual | sync. No rows until a client app reports; the panels on
  `/brands/<slug>` (most added / removed / requested / used) show an empty state until then. The root rolls up every brand.
- How a client app reports (later; no senders are built yet): `POST /functions/client-brain` with the same
  `x-mothership-key` and

```json
{
  "action": "features",
  "app_id": "the client app id (= CRMClient.command_app_id)",
  "features": [
    { "key": "peak_week", "state": "enabled", "usage_count": 42, "last_used_at": "2026-11-16T20:00:00Z" },
    { "key": "posing_log", "name": "Posing log", "state": "added" },
    { "key": "community", "state": "removed" },
    { "key": "stripe_billing", "name": "Stripe billing", "state": "requested" }
  ]
}
```

  Same anti-spoofing as ingest (only the client's registered command app; brand apps get 400). Upserts one row per
  client + `key` (idempotent); rows Justin set by hand (`source: manual`) are never overwritten. Use the template's
  `AppFeature.key` for template features; any other key is a client-specific addition. Usage counts are optional and
  must be real counts from the app. Response: `{ ok, client_id, created, updated, unchanged, skipped_manual, rejected[] }`.
- Tests: `tests/unit/brandsGraph.test.js`.
