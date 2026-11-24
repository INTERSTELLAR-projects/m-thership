# Møthership route map (Build Engine round, Nov 19 2026)

Page → the process it serves → its new home → clicks from the sidebar to get there, before → after.
Clicks count from a fresh load with the sidebar visible. A hub row opens its first page (1 click); any other page in
that hub is a second click. "More ▸" is one extra click to open (it stays open while you are inside one of its pages).
Every old URL still works; nothing was removed, only re-homed.

## Counts

| | Before | After |
|---|---|---|
| Sidebar rows shown before you open anything | 9 (7 hubs + More + Settings) | 5 (Command, Clients, Claude + More + Settings) |
| Hubs (groups) | 8 | 3 up top + 6 inside More |
| Pages reachable from the sidebar | 56 | 58 (+ How you use it, + Classic kept) |
| Client page: sections · tabs · default | 5 · 25 · Agents › Live view | 6 · 26 · **Build** (same layout for every client) |
| Clients page (/crm) sections | 3 (list, 02 Leads pipeline, 03 Client numbers) | 1 (client list only) |
| Client portal: header pages · Everything groups · tiles | 3 (Home, Requests, Messages) · 5 · 27 | **4 (Glance, Requests & self-serve, Brand & assets, Billing)** · 4 · 26 + Brand & assets hub |
| Things that reach Command for approval | every open item (1,617 incl. 1,362 bank txns) | Taste + Hard gate only (logic auto-approved) |

## Command (always open)

| Page | Process | New home | Clicks before → after |
|---|---|---|---|
| Command `/` | Daily: add a lead, see what needs Justin, watch builds | Command › Command (quick-add bar, Needs you today, Builds in progress, Decided for you) | 1 → 1 |
| Classic `/classic` | Old widget dashboard (quick-add on top) | Command › Classic | 2 → 2 |
| Approvals `/launch?tab=approvals` | Taste + hard gate items only | Command › Approvals | 2 → 2 |
| Road to Dec 31 `/launch` | Launch moves, publish/DNS gates | Command › Road to Dec 31 | 2 → 2 |
| Brain `/brain`, Pillars `/pillars`, Commander brief, Output | Agency brain and scores | Command | 2 → 2 |

## Clients (always open)

| Page | Process | New home | Clicks before → after |
|---|---|---|---|
| Clients `/crm` | Find a client: plan + live MRR + committed, build, Brain %, weakest pillar, attention | Clients › Clients (list only) | 1 → 1 |
| Client page `/clients/:id` | Everything about one client; opens on **Build** (pillars, lead card, build checklist, Brain + unlocks, launch grid, growth feed, requests) | Clients › Clients › row | 2 → 2 (build status, Brain and requests were 3–4 clicks across tabs; now on the first screen) |
| Pipeline `/pipeline` | Lead stages, deal value, moves with undo | Clients › Pipeline (was Sales › first tab, and also embedded in /crm) | 1 → 2 (or the quick-add bar on Command) |
| Requests `/requests` | Client asks | Clients › Requests | 2 → 2 |
| Service Process `/flight-plan` (was Onboarding) | One process per offer, steps, owner, auto/manual, where, client positions | Clients › Service Process | 2 → 2 |
| House of Brands `/brands` (+ `?view=numbers`) | Brands, their clients/MRR/builds/leads/health/apps, brand filter | Clients › Brands; header switcher filters Møthership | 2 → 2 (brand filter: 1 click from any page) |
| Messages `/comms` | Client chats (scoped to one client inside a client page) | Clients › Messages | 2 → 2 |
| Client posts `/client-posts` | Audit + undo for client-sent projects/testimonials; live ones also show in each client's growth feed | Clients › Client posts | 2 → 2 |
| Portal `/settings?tab=portal` | Portal settings (scoped preview inside a client page) | Clients › Portal | 2 → 2 |
| Client numbers `/financial?tab=clients` | Per-client numbers (moved off /crm) | More › Money › Financial › Client numbers | 1 (scroll on /crm) → 3 |

## Claude (always open)

| Page | Process | New home | Clicks before → after |
|---|---|---|---|
| Claude `/claude` (was Work › Claude Queue) | Pick client, type instruction, send; every job and status | Claude › Claude | 2 → 1 |
| Field inbox `/field` (Nov 23) | WhatsApp from the glasses + site-visit videos, filed as tasks, ideas, notes or Claude jobs (docs/field-inbox.md) | Claude › Field inbox; camera icon in the top bar; Site visit on Command | new → 1–2 |
| Playbooks `/playbooks` | Foundation prompts and standards | Claude › Playbooks (was Agents) | 2 → 2 |

## More ▸ (one click to open)

| Group | Pages | Clicks before → after |
|---|---|---|
| Work | Tasks, Projects, Packages, SOPs, Patterns, Share images (from Clients) | 1–2 → 2–3 |
| Marketing | Search, Content plans, Backlinks, Reviews, Site security, Social, Email, Ads | 1–2 → 2–3 |
| Sales | Calls, Marketing Command (`/marketing-command`, Nov 23; `?wall=1` TV mode), Financing, Prestige, Upgrade Store, Decks, SMPL. Studio (from More) | 2 → 2–3 |
| Money | Financial (+ Client numbers tab), Client usage, Fuel economics, Hiring plan, Usage & cost | 1–2 → 2–3 |
| Agents | Universe, Constellation, Systems, Intelligence, Idea Vault, Automations | 1–2 → 2–3 |
| Tools | All pages, **How you use it** (new, private), Documents, Legal, Training, Signatures, QR codes, Chrome Workspace | 1–2 → 2–3 |

Every page Justin uses daily (Command, Clients, a client, Claude) is 1–2 clicks. The pages that moved one click deeper are the ones the Build Engine plan says Justin rarely opens day to day;
the "How you use it" panel (More › Tools) will show from real sessions whether any of them should come back up.

## Client page tabs (Clients › client)

Build (new, default) · Agents (Live view, Claude jobs, Automations: now "Needs attention" + groups by job) ·
Work (Summary, Tasks, Requests, Work log, Calls, Messages: scoped to this client) · Growth (Performance, Goals & gaps,
Google Business, Map pack, Citations & PR, Content plan, Social plan) · Brain & brand (Profile, Dossier, Brand kit,
Playbook, Intake audit, Files) · Setup & billing (Billing & notes, Systems, Portal resources). Inside a client page the
hub links Messages, Requests and Portal open that client's thread, requests and portal preview, not the global ones.

## Client portal

| Page | What's on it | Old tabs that now live here (keys unchanged) |
|---|---|---|
| Glance (home) | Build progress (Build it / Run it / Grow it), done this month, what's next, to-dos, numbers, pillars | goals, results, gbp, mentions |
| Requests & self-serve | Requests + Messages; self-serve stubs: add a project, announce a drop, add a product, season toggle, offers; Studios | requests, messages, studio_* (social, email, presentations, accounting, ads, SMPL) |
| Brand & assets | Brain, brand kit, files, signatures, QR, playbook, SOPs, Transmission (coming soon), hiring, training | brain, brand, files, signatures, qr, playbook, resources, studio_hiring, studio_training |
| Billing | Plan, payments, fuel; referrals, upgrades, account | billing, referrals, upgrades, account |

The header keeps the logo + business name, Schedule a call, Everything and Account; the Nøva launcher stays on every page.
