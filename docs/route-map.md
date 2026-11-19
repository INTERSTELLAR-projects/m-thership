# Møthership route map (Build Engine round, Nov 19 2026)

Page → the process it serves → its new home → clicks from the sidebar to get there, before → after.
Clicks count from a fresh load with the sidebar visible. "More ▸" is one click to open (it remembers itself open
while you are inside one of its pages). Every old URL still works; nothing was removed, only re-homed.

## Counts

| | Before | After |
|---|---|---|
| Top-level sidebar groups shown | 7 hubs + More | 3 hubs (Command, Clients, Claude) + More |
| Links visible without opening anything | 49 | 18 |
| Pages reachable from the sidebar | 56 | 58 (+ How you use it, + Classic kept) |
| Client page: sections · tabs · default | 5 · 25 · Agents › Live view | 6 · 26 · **Build** (same layout for every client) |
| Clients page (/crm) sections | 3 (list, 02 Leads pipeline, 03 Client numbers) | 1 (client list only) |
| Client portal: header pages · Everything groups · tiles | 3 (Home, Requests, Messages) · 5 · 27 | **4 (Glance, Requests & self-serve, Brand & assets, Billing)** · 4 · 26 + Brand & assets hub |
| Things that reach Command for approval | every open item (1,617 incl. 1,362 bank txns) | Taste + Hard gate only (logic auto-approved) |

## Command (always open)

| Page | Process | New home | Clicks before → after |
|---|---|---|---|
| Command `/` | Daily: add a lead, see what needs Justin, watch builds | Command › Command (quick-add bar, Needs you today, Builds in progress, Decided for you) | 1 → 1 |
| Classic `/classic` | Old widget dashboard (quick-add on top) | Command › Classic | 1 → 1 |
| Approvals `/launch?tab=approvals` | Taste + hard gate items only | Command › Approvals | 1 → 1 |
| Road to Dec 31 `/launch` | Launch moves, publish/DNS gates | Command › Road to Dec 31 | 1 → 1 |
| Brain `/brain`, Pillars `/pillars`, Commander brief, Output | Agency brain and scores | Command | 1 → 1 |

## Clients (always open)

| Page | Process | New home | Clicks before → after |
|---|---|---|---|
| Clients `/crm` | Find a client: plan + live MRR + committed, build, Brain %, weakest pillar, attention | Clients › Clients (list only) | 1 → 1 |
| Client page `/clients/:id` | Everything about one client; opens on **Build** (pillars, lead card, build checklist, Brain + unlocks, launch grid, growth feed, requests) | Clients › Clients › row | 2 → 2 (was 3 to reach build-ish info across tabs) |
| Pipeline `/pipeline` | Lead stages, deal value, moves with undo | Clients › Pipeline (was Sales, and also embedded in /crm) | 2 → 1 |
| Requests `/requests` | Client asks | Clients › Requests | 1 → 1 |
| Service Process `/flight-plan` (was Onboarding) | One process per offer, steps, owner, auto/manual, where, client positions | Clients › Service Process | 1 → 1 |
| House of Brands `/brands` (+ `?view=numbers`) | Brands, their clients/MRR/builds/leads/health/apps, brand filter | Clients › Brands; header switcher filters Møthership | 1 → 1 |
| Messages `/comms` | Client chats (scoped to one client inside a client page) | Clients › Messages | 1 → 1 |
| Client posts `/client-posts` | Audit + undo for client-sent projects/testimonials; live ones also show in each client's growth feed | Clients › Client posts | 1 → 1 |
| Portal `/settings?tab=portal` | Portal settings (scoped preview inside a client page) | Clients › Portal | 1 → 1 |
| Client numbers `/financial?tab=clients` | Per-client numbers (moved off /crm) | More › Money › Financial › Client numbers | 1 (scroll on /crm) → 3 |

## Claude (always open)

| Page | Process | New home | Clicks before → after |
|---|---|---|---|
| Claude `/claude` (was Claude Queue) | Pick client, type instruction, send; every job and status | Claude › Claude | 2 → 1 |
| Playbooks `/playbooks` | Foundation prompts and standards | Claude › Playbooks | 2 → 1 |

## More ▸ (one click to open)

| Group | Pages | Clicks before → after |
|---|---|---|
| Work | Tasks, Projects, Packages, SOPs, Patterns, Share images (from Clients) | 1 → 2 |
| Marketing | Search, Content plans, Backlinks, Reviews, Site security, Social, Email, Ads | 1 → 2 |
| Sales | Calls, Financing, Prestige, Upgrade Store, Decks, SMPL. Studio (from More) | 1 → 2 |
| Money | Financial (+ Client numbers tab), Client usage, Fuel economics, Hiring plan, Usage & cost | 1 → 2 |
| Agents | Universe, Constellation, Systems, Intelligence, Idea Vault, Automations | 1 → 2 |
| Tools | All pages, **How you use it** (new, private), Documents, Legal, Training, Signatures, QR codes, Chrome Workspace | 2 → 2 |

The pages that moved one click deeper are the ones the Build Engine plan says Justin rarely opens day to day;
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
