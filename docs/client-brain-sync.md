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
| Auth | header `x-mothership-key` = secret `MOTHERSHIP_INGEST_KEY` (same key as `log-activity` and `work-ledger` `log`), or an admin session |
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

- Client match: `client_id`, else the `CRMClient` whose `ops_app_id` or `site_app_id` is `app_id`, else `domain`.
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

## Add another client app (Muscle Mentor, Arcane Studio, Redline, a DIALD-style app…)

1. In Møthership, make sure the client's `CRMClient.ops_app_id` (or `site_app_id`) is the app's id, or plan to send
   `client_id`.
2. In the client app, set the secret `MOTHERSHIP_INGEST_KEY` to the same value as Møthership's.
3. Copy Palm Shore's `base44/functions/mothershipBrainSync/entry.ts`; change `APP_ID`, `APP_NAME`, `DOMAIN`, and
   map the app's own fact / question entities into the payload above (keep `mode: "full"`).
4. Add the workflows: on create/update of the fact entity, on create/update of the question entity, and hourly.
   Return 200 from the function even when not configured or rejected (failing runs switch a workflow off).
5. Call it once (`action: "backfill"`) and check the client's node in the Constellation.

Nothing goes live until both apps are published.
