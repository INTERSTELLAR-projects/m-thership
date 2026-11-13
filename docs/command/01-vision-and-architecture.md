# Møthership Command: vision and architecture

Status: Phase 1 built on 2026-11-12. Everything marked **real** runs on Møthership's live data today.

## 1. The bet

Dashboards answer "what is going on?" and leave the owner to work out "so what do I do?". Every SaaS dashboard has the
same anatomy (sidebar, KPI cards, charts, an AI chat bolted to the corner) because it is built for browsing. An owner
walking a job site does not browse. He needs three things, in this order:

1. **What matters today**, already decided, with the reason.
2. **What needs my yes**, one item at a time, in plain words, with the exact text that will go out.
3. **A way to tell the system something** (a fact, an interruption, a request) without finding the right page.

So Command is a **stream, not a grid**. One column, top to bottom in the order a person thinks in the morning: the
brief → the decisions → the shape of the business → what the system still doesn't know. Everything else (the 50+
existing pages) is one keystroke or one sentence away through ⌘K and the Ask bar, not on screen competing for attention.

Why this beats a sidebar dashboard:
- **Decisions, not data.** Each card on Today is either a decision (approve / edit / skip / snooze) or a plan block.
  Numbers appear only as the reason for a decision ("2 bills overdue, $201.99").
- **One thing at a time.** The Needs-you stack shows one card. Working memory holds ~4 items; a grid shows 30.
- **The owner answers to the CEO.** The agent proposes; Justin verifies. The default action is cheap (A = approve),
  and anything external needs a second explicit confirm.
- **Same model for voice.** A stream can be read aloud. A grid cannot. Walk Mode is the same stream, spoken.
- **Every number is traceable.** Pillar scores show their inputs and rules; outcomes link to the records they came from.

## 2. Modes (screens)

| Mode | Route | What it is |
|---|---|---|
| **Today** (home) | `/` | Mission Brief (greeting, since yesterday, top 3 outcomes, time-blocked plan with life buffers, tomorrow, day after) + the Needs-you stack + a pillar strip. Replaces Mission Control. |
| **Pillars** | `/pillars` | 8 pillars on a constellation compass, each 0-100 with "why this score", inputs, confidence, to-dos. |
| **Teach the Brain** | `/brain` | One question at a time, voice or text. Answers become `BrainFact`s. Shows what the Brain knows per pillar. |
| **Walk Mode** | `/walk` | Full-screen, audio-first. Chime → spoken brief → Needs-you items one by one → yes / no / skip / next / repeat. |
| **Ask bar** | every page | Bottom bar with a big mic. Ask a question, give an order, say "something came up". Replies in text, optionally aloud. |
| **⌘K palette** | every page | Pages, clients, projects, and actions (Ask, Re-plan, Something came up, Teach, Walk, Classic). Primary navigation. |
| **All pages drawer** | every page | The old sidebar, now a drawer (pin it open on desktop if you want it back). |
| **Classic** | `/classic` | The old Mission Control dashboard, unchanged. |

Keyboard: `⌘K` palette · `/` Ask · on Today `A` approve, `E` edit, `S` skip, `Z` snooze, `←/→` move through the stack ·
`G` then `P/B/W/T` jump to Pillars / Brain / Walk / Today. Mobile: swipe right = approve, left = skip, up = snooze.

## 3. The agent loop

```
observe  →  plan  →  propose  →  approve  →  act  →  learn
```

- **Observe** (`base44/shared/command.js › loadSources + buildSnapshot`): reads CRMClient (leads, MRR), Task,
  ClientFinancing, Expense, WorkEntry, LaunchItem, Project, ClaudeJob, ClientRequest, ResearchNote, Automation,
  BusinessBrain (Constellations scores), RevenueGoal, HiringPlan, TrainingAssignment, BrainFact, ProposedAction,
  CeoBrief, and today's Google Calendar events when the connector is authorised. Every fact keeps its record id.
- **Plan** (`command-brief`): rules first, LLM second.
  1. `scorePillars` scores the 8 pillars from metrics (section 5).
  2. `candidates` turns facts into ranked work items (calls today, late payments, overdue follow-ups, owner launch
     moves due this week, overdue P1 tasks, bills, stale approvals…), each with a pillar, a reason and a record link.
  3. `ruleBrief` picks 3 outcomes (one per pillar where possible, weaker pillars weighted up) and lays out the day:
     work hours from the Brain (default 8:00-17:30 PT), calendar events as fixed blocks, ≥20% of the day as
     "Life / unplanned" buffers, lunch, a shutdown block. Leftovers roll to tomorrow and the day after.
  4. The LLM (`Core.InvokeLLM`, JSON schema) may rewrite the wording and re-order the plan, but may only reference
     candidate ids it was given. Output that names an unknown id, has bad times, or drops the buffers is discarded
     field by field and the rule version stays. The brief records `source: "llm" | "rules"`.
  5. Cached per day in `DailyBrief`. "Re-plan my day" and "Something came up" regenerate (version + 1).
- **Propose** (`ruleProposals` + `command-ask`): drafts become `ProposedAction` rows (draft email, draft text,
  confirm a record change, choose an option, answer a question). Dedupe keys stop the same card twice a day.
- **Approve** (Today / Walk / Ask): one tap or a spoken "yes". External sends need a second, on-screen confirm showing
  the exact recipient and text.
- **Act** (`command-execute`): executes only `approved` actions, writes `AgentAuditLog` with before/after and an undo
  recipe.
- **Learn** (`command-brain`): answers become `BrainFact`s; skips/snoozes are logged so a later phase can learn which
  proposal types Justin ignores. BrainFacts feed the next brief and every Ask.

## 4. Data model (new entities, all admin-only RLS)

| Entity | Purpose | Key fields |
|---|---|---|
| `DailyBrief` | One row per day (PT) | `date`, `version`, `source` (llm/rules), `greeting`, `since_yesterday[]`, `outcomes[]` {title, why, pillar, ref}, `plan_today[]` {start, end, title, kind, pillar, ref}, `tomorrow[]`, `day_after[]`, `gaps[]`, `pillar_scores`, `interruptions[]`, `facts` (snapshot counts), `llm_error`, `generated_at` |
| `ProposedAction` | The Needs-you stream | `kind` (send_email, send_sms, record_change, create_task, log_expense, client_note, choice, question), `status` (pending, approved, executed, skipped, snoozed, failed, answered), `pillar`, `title`, `rationale`, `payload`, `risk` (internal/external/money), `priority`, `snooze_until`, `source`, `source_ref`, `dedupe_key`, `approved_by`, `approved_at`, `executed_at`, `result`, `error` |
| `AgentAuditLog` | Every agent action | `at`, `actor`, `action`, `entity`, `record_id`, `summary`, `before`, `after`, `proposed_action_id`, `undo`, `undone_at`, `ok` |
| `BrainFact` | What the Brain knows | `pillar`, `statement`, `question_key`, `question`, `source` (interview, seed, ask), `confidence`, `date`, `status` (active/superseded) |

Existing data is mapped, never copied: tasks map by category (sales→Sales, marketing/content→Marketing,
finance/admin→Finance, strategy→Owner, design/development/ops with a client→Delivery, internal ops→Systems);
launch items by workstream; research notes by department; Constellations scores feed Marketing, Clients, Systems and
Owner as one input each. Pillar definitions live in code (`PILLARS` in `command.js`) and can be overridden later from
`AppSettings` key `command_pillars` (phase 2 editor).

## 5. Pillar scoring (transparent rules)

Each pillar is a weighted average of metrics. Each metric yields a sub-score 0..1, or **null when there is no data**.
Null metrics are left out of the score and lower the confidence. A pillar with no data shows "no data" and the Brain
asks about it first.

| Pillar | Metrics (weight) |
|---|---|
| Sales | follow-ups on time (3), open pipeline vs 5 leads (2), new leads in 30 days vs 4 (2), sales tasks not overdue (1) |
| Marketing | Constellations: Signal, Beacon, Shield, Insignia avg (2), marketing tasks not overdue (1), high-relevance marketing research reviewed (1) |
| Delivery & Ops | client tasks not overdue (3), work ledger approvals ≤ 10 waiting (2), Claude jobs waiting ≤ 3 days (1), launch items on pace for the week (2), no urgent client requests (1) |
| Finance | financing plans not late (3), bills paid on time (2), MRR vs the $ goal's monthly pace (2), finance tasks not overdue (1) |
| Clients & Retention | clients with work in the last 14 days (3), clients on a continuity plan (2), Constellations Orbit (1), open requests answered (1) |
| Team | hiring plan exists (1), training assignments current (1), team questions answered in the Brain (2) |
| Systems & Tech | automations healthy (2), Constellations Engine (1), systems/security launch items on pace (2), voice inbox clear (1) |
| Owner & Strategy | revenue goal set (1), owner launch moves due this week done (3), ≤ 5 focus tasks (1), Constellations Command (1) |

Confidence (0-100) = 60% × share of metrics with data + 40% × min(1, BrainFacts for the pillar / 5).
"Why this score" lists every metric, its value, its target and its sub-score.

## 6. Safety and approval model

Autonomy level: **draft + one-tap approve**.

| Action | Approval | Undo |
|---|---|---|
| Re-plan, move its own plan blocks, draft text, save a BrainFact, create an internal task from a spoken order | none (logged) | task: mark done + `undone` label; fact: superseded |
| Record change (task status/priority/date, ledger entry approve, lead next step, mark a bill paid, client note) | one tap / "yes" | restore the before-values |
| Send email | tap + final on-screen confirm with recipient and full text | not possible after send (logged) |
| Text message | never sent by the system: draft + "copy & open Messages" (`sms:` link) | n/a |
| Log an expense | one tap | edit it in Financial (no auto-delete) |
| Move money, delete records, publish, DNS | **never** | n/a |

Rules enforced in `command-execute`, not just in the UI: only `approved` actions run; email recipients must be the
approved address (no CC/BCC); test sends go only to `justin@interstellar-strategies.com`; record changes go through an
entity + field allowlist; nothing is ever deleted. Every run writes `AgentAuditLog`. The research note "approval
prompts get rubber-stamped (~93%)" is why external sends need a second confirm that shows the actual text, and why
internal low-risk work needs none: approvals are kept rare so they keep meaning something.

## 7. Voice and earpiece roadmap

- **Phase 1 (real now):** browser SpeechRecognition (Chrome, Edge, Safari 14.5+) with typing fallback; speechSynthesis
  replies (toggle); Web Audio chime; Walk Mode with Screen Wake Lock; spoken yes/no/skip/next/repeat.
  Limits: the browser stops listening when the screen locks or the tab is backgrounded (iOS especially), so Walk Mode
  keeps the screen awake; recognition needs a network on Chrome; Bluetooth earbuds work as mic and speaker through the OS.
- **Phase 2:** server-side transcription + natural voice (OpenAI key already on the launch list as `s:openai-key`),
  push notification chime when a new Needs-you card lands, a PWA install so Walk Mode runs from the home screen,
  "Hey Møthership" push-to-talk via a Bluetooth media button (Media Session API).
- **Phase 3:** native companion (iOS/watchOS) for background audio and lock-screen approvals; an earpiece that wakes on
  a phrase; estimator flow: walk a job, talk, the agent drafts a personalised estimate from the client's Brain and
  pricing rules, then reads it back for a yes.

## 8. Client command systems → the fleet

Each client Command System (Palm Shore Operations, North Woods, PowerLift Ops, Arcane Ink Studio…) gets the same
four entities and the same loop, scoped to that business. Møthership becomes the **fleet view**:
- Each client app exposes one read-only `command-status` function (pillar scores, open Needs-you count, last brief
  time) signed with a per-client key stored as a secret, never in code.
- Møthership polls nightly into a `FleetStatus` entity; the agency's own Delivery and Clients pillars then include
  "clients whose command score dropped" as a metric, and the Commander brief names them.
- Proposals that need Interstellar (not the client) flow up as Needs-you cards on Justin's Today, tagged with the client.
- Clients approve their own cards in their own app; Interstellar never approves on a client's behalf.

## 9. Real now vs later

**Real (Phase 1):** Today with a rule + LLM brief cached per day; re-plan and interruptions; Needs-you stack with
keyboard + swipe; email sending via the app mail domain after approve + confirm; record changes with undo; SMS drafts
with `sms:` hand-off; pillar compass with transparent scores; Ask bar with voice and typed input; ⌘K actions; Brain
interview with seeding from Agency knowledge and the Interstellar brain; Walk Mode with chime, speech and wake lock;
`/classic` dashboard; audit log.

**Phase 2:** pillar editor (AppSettings), learning from skip/snooze patterns, nightly pre-generation at 6:00 PT via a
workflow, push notifications, server-side voice, SMS via a provider once Justin picks one, estimate builder with
pricing rules, calendar write-back of the plan (needs Justin's consent on the connector).

**Phase 3:** the client fleet, native earpiece companion, multi-user (team members get their own Today).

## 10. Files

| What | Where |
|---|---|
| Engine (snapshot, scores, candidates, plan, proposals, Brain bank, LLM prompts + validation) | `base44/shared/command.js` (browser copy `src/features/command/engine.js`, `npm run sync:command`, guarded by `tests/unit/command.test.js`) |
| Server helpers (brief generation, calendar, allowlisted record changes, undo, email HTML) | `base44/shared/commandServer.ts` |
| Functions | `command-brief`, `command-execute`, `command-ask`, `command-brain` in `base44/functions/` |
| Entities | `DailyBrief`, `ProposedAction`, `AgentAuditLog`, `BrainFact` |
| UI | `src/features/command/` (CommandHome, MissionBrief, NeedsYou, PillarsView, Constellation, BrainView, WalkMode, AskBar, api, voice, ui) |
| Shell changes | `src/App.jsx` (`/`, `/classic`, `/pillars`, `/brain`, `/walk`), `src/components/Layout.jsx` (drawer, Ask bar, G-shortcuts), `Sidebar.jsx` (pin), `CommandPalette.jsx` (actions), `src/lib/nav.js` (Today tabs) |

## 11. Verification (2026-11-12)

- `vite build`, `eslint --quiet`, `deno check` on the 4 functions: pass. `vitest`: 78/78 (12 new Command tests).
- Playwright, QA fake data and Justin's real data (sandbox preview, signed in), 390 and 1440: Today, Needs you, Ask, ⌘K, Pillars,
  Brain, Walk (start + brief), Classic, All-pages drawer. No page errors, no horizontal scroll.
- Real run: brief in 6-10 s with LLM wording accepted; re-plan 4 s; Ask answered from live numbers; email card → confirm sheet →
  test send to justin@interstellar-strategies.com delivered; card skipped. No client email sent, no record approved.
- Found and fixed while testing: DailyBrief `tomorrow` / `day_after` schema type; the LLM restating a stale countdown
  (greeting, date and since-yesterday are now locked to rule text); Ask bar covering the send sheet on phones (portal);
  the empty toast layer swallowing taps on the phone top bar (pre-existing, `pointer-events-none` on the viewport);
  interruption over a booked call now flagged as a clash; accounting notice moved off the Ask bar.

## 12. Why Ask is a backend function, not a Base44 agent

The Ask bar runs through `command-ask` (InvokeLLM with a JSON intent schema + deterministic executors) rather than a
`base44/agents/mothership_ceo` agent:
- **Approval is enforced in code.** The function decides what is internal (runs) and what becomes a ProposedAction.
  An agent with entity tools could write a record directly; tool permissions are per entity, not per field or risk.
- **Graceful failure.** If the LLM fails, a regex intent parser still captures tasks, interruptions and facts. An agent
  conversation has no fallback path.
- **One round trip, one snapshot.** Ask reads the same snapshot as the brief, so answers match what Today shows.
- **Cheaper and faster** than a multi-turn agent run for short spoken commands.
An agent is the right tool for long, multi-step work (phase 2: "plan my week" conversations), and can call these same
functions as tools.
