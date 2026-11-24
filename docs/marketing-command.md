# Marketing Command (Nov 23 2026)

Interstellar's whole marketing plan on one screen, volume first ("that's who we are"): a season plan, a weekly target per pillar, daily actuals, pace, and the revenue line. Page: `/marketing-command` (More › Sales › Marketing Command). TV wall: `/marketing-command?wall=1` (full screen, refreshes every minute).

## Data
| Entity | What | Key fields |
|---|---|---|
| `MarketingPlan` | One season plan | season, year, start_date, end_date, offer_ids, daily_revenue_target (3000), days_per_week (5), deal_mix [{count, amount, label}], holiday_windows, summary, pricing_context, status draft/active/archived, source |
| `PillarTarget` | Weekly target for one pillar of a plan | plan_id, pillar (posts, content, outreach, calls, in_person, ad_spend), weekly_target, unit, owner, channel_notes, reasoning, status draft/approved |
| `PillarLog` | Daily actual | date, pillar, actual, plan_id, note, source |

All three are admin-only and carry `scope` (`interstellar` | `client`), `client_id` and `portal_visible`.

Pace: week = Monday–Sunday, selling days Mon–Fri. "By today" = target × days elapsed / 5. Ahead ≥ 100% of that, on pace ≥ 85%, behind below. Revenue line = daily target × days ($15,000/week); the deal mix is a plan, and its total is shown against the target with the gap (Justin's example 6×$500 + 3×$1,000 + 2×$1,500 = $9,000 leaves $6,000/week uncovered). No revenue actuals are invented.

## Generate season plan
`marketing-command` function, `{ action: "generate", season?, year? }` (admin): reads the Interstellar BusinessBrain (`context_md` or its sections), active OfferCatalog missions/builds/plans, the season's dates and US holiday windows, and Justin's stated pricing; Base44 InvokeLLM returns one weekly target per pillar with owner, channel notes and reasoning. The result is validated (known pillars, one each, non-negative, capped) and saved as a DRAFT plan. `{ action: "approve", plan_id }` makes it active and archives the previous active plan. Approving spends and sends nothing: ad budgets still go through Ads Studio.

Justin's stated pricing (context only): website + Command System urgency offer about $11.5–12K "before it goes back up"; monthly management $500–$750 local, higher national/global; ads drive calls booked 24h+ out, and every prospect is shown a pre-built site/platform on the call.

## Interstellar vs clients (built later)
- The Brain stays in Interstellar. Generation always runs here, in Møthership, where the Brain, offers and approvals live.
- A client plan is the same three entities with `scope: "client"` and `client_id`, generated from that client's BusinessBrain and their own offers.
- Clients receive their plan, never their Brain: when Justin sets `portal_visible`, the `portal` function returns the plan, targets and this week's actuals (scoped to the login's client, like every portal action) and the portal shows the same pillar rows read-only.
- A client's Command System gets it the same way it already talks to Møthership (`command_app_id` + `COMMAND_SYSTEM_SYNC_KEY`): pull the plan, push `PillarLog` actuals back (source `automation`). No Brain text is ever sent.
- Not built yet: the portal action, the portal view and the Command System sync.

## Files
`base44/entities/MarketingPlan.jsonc`, `PillarTarget.jsonc`, `PillarLog.jsonc` · `base44/shared/marketingCommand.js` (copy: `src/lib/marketingCommand.js`) · `base44/functions/marketing-command/entry.ts` · `src/features/marketing/MarketingCommandPage.jsx` · `tests/unit/marketingCommand.test.js`.

Sample data: `[SAMPLE] Fall 2026 plan (draft)` with six placeholder targets and no actuals. Safe to delete.
