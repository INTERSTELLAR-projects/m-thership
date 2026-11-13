# Møthership Command: inventory (2026-11-12)

What exists before the Command build. Restore point: checkpoint **"Before Møthership Command"**.

## App shape
- Vite + React SPA, routes in `src/App.jsx`, nav map in `src/lib/nav.js` (7 hubs + More + Settings, see
  `docs/cleanup-2026-11-12.md`). Admin sees `Layout` (sidebar + hub tabs + ⌘K palette); non-admins only get the portal.
- `/` = Mission Control (`src/pages/Dashboard.jsx`): widget board with `CommandBriefing` on top (rule-based
  "one thing", `src/features/briefing/*`).
- QA mode (`src/lib/qa.js`): fake data on the preview host with `?qa=1`; every entity is proxied to fixtures.
- Tests: vitest (60 tests, `tests/unit`), `npm run build`, `npm run lint` (eslint --quiet on src/components, pages, features).
- Brand: canvas `#ebe8e4`, ink `#1a1a1a`, flame `#ff3c00 → #ff6a00 → #ffaa00`, Geist + JetBrains Mono, hairlines, mono labels.

## Data that matters to a daily plan (live counts on 2026-11-12)
| Source | Entity | Count / state | Pillar |
|---|---|---|---|
| Clients + leads | `CRMClient` | 19 rows: 14 active clients, leads via `pipeline_stage` / `next_step_at` / `booked_call_at` (0 open leads right now; 1 test lead marked lost) | Sales, Clients |
| MRR | `CRMClient.services[]` (Stripe-synced) | ~$7.9k/mo active monthly services | Finance |
| Revenue goal | `RevenueGoal` | 1: "$1M in 2027" (annual_revenue, starts 2027-01-01) | Owner, Finance |
| Tasks | `Task` | 39 open (1 overdue: Monthly books close Oct; "Get 100 reviews" due today; 6 focus) | all, by category |
| Client financing | `ClientFinancing` | 0 plans yet (tracker built today) | Finance |
| Expenses due | `Expense` | 15 recurring; 2 overdue this cycle (GB Gmail, SMPL Social Coding Management, both due the 9th) | Finance |
| Work ledger | `WorkEntry` | 67 awaiting approval (49 Claude sessions Nov 11-13, 18 scheduled-task rows from Nov 1-3) | Delivery |
| Launch plan | `LaunchItem` | 92 open owned by Justin (week 1-9, 30+ `blocking_launch`) | Owner, Delivery, Systems |
| Projects | `Project` | 19 in flight | Delivery |
| Claude jobs | `ClaudeJob` | 17 `needs_approval` (oldest Nov 1) | Delivery |
| Client requests | `ClientRequest` | 0 open | Clients |
| Voice inbox | `InboxItem` | 0 needs review | Systems |
| Research | `ResearchNote` | 32 (30 new; 15 high relevance) by department | per department |
| Already scored | `BusinessBrain` (scope interstellar) `.constellation` | Constellations 1.0 health 20/100, pillar scores (command 0, payload 57, insignia 55, signal 17, beacon 0, shield 0, intercept 23, engine 4, orbit 25), 41 unchecked items | Marketing, Clients, Systems, Owner |
| Brain | `BusinessBrain` interstellar | completeness 71%, 7 open questions | Brain |
| Agency knowledge | `AgencyKnowledge` | 23 sections (offers, pricing, delivery rules, voice, operations, standards) | Brain seed |
| CEO brief | `CeoBrief` | daily, latest 2026-11-11 | since-yesterday |
| Ideas | `Idea` | 26 (scored in Idea Vault) | Owner |
| Automations | `Automation` | per client, status + last_result | Systems |

"Research" Justin mentions = `ResearchNote` (research department output, by department) + `OracleTopic/OracleFinding/SeoIntel`
(Intelligence). "Already scored" = Constellations 1.0 (`src/features/constellations/pillars.js`, nine Hormozi sectors,
mirrored in `base44/shared/constellations.js`, written nightly into `BusinessBrain.constellation`) and the Idea Vault scores.

## Existing AI, voice and agents
- `voice-command` function: transcript → InvokeLLM intent JSON → Task/Project/Idea/CRMClient create or InboxItem park.
  Writes directly, no approval step.
- `ai-gateway`: Anthropic on our key (secret not set yet → falls back to Base44 InvokeLLM for admin).
- `CommandBriefing` + `oneThing.js`: rule-based "one thing" + optional InvokeLLM polish, spoken script.
- `MicButton`, `DictationBox`: browser SpeechRecognition (uses `alert()` when unsupported).
- Agents page (`/agents`): AgentRegistry, AgentLearning, CeoBrief ("Commander brief"). One Base44 agent file:
  `interstellar_assistant` (Nøva, client portal).
- Approvals already exist in pieces: `/launch?tab=approvals` (ApprovalsInbox + policy sweep), ClaudeJob `needs_approval`,
  Outreach drafts, Ads proposals. No single owner decision stream, no audit/undo log.

## Integrations
- Email: Base44 `Core.SendEmail` via `sendBrandedEmail()` (`base44/shared/onboardingEmail.ts`, app mail domain,
  "Interstellar Strategies"). Amazon SES for bulk only (secrets not connected yet).
- Google Calendar connector (`calendar.events` scope) used by `portal-booking`. Instagram + Facebook Pages connectors.
- Stripe sync. No SMS or calling integration.

## Gaps the Command build fills
- No day plan, no time blocks, no tomorrow/day-after view, no interruption re-plan.
- No single "Needs you" stream across sources; approvals are spread over five pages.
- No owner-level pillar scores (Constellations scores clients' marketing sectors, not Justin's 8 business pillars).
- No interview loop that turns answers into facts the planner uses.
- No audit log with undo for agent actions.
