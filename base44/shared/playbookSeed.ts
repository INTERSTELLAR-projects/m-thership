// Seed knowledge for the Playbooks prompt agent's one-time "seed_variants" run (Nov 17, 2026, Justin's request):
// a generic v1 draft for every area without a prompt, then an industry version of every area for 7 industries.
// Everything lands as status "draft" in the Approve queue. Nothing here is a secret.

export const SEED_INDUSTRIES: { key: string; clients: string[]; brief: string }[] = [
  {
    key: "Automotive & aviation photo/video",
    clients: ["Redline Visuals"],
    brief: `Creative studio shooting cars, aircraft, dealerships and events (photo + video).
- Design: cinematic / HUD feel: dark canvas, film grain, motion-blur and light-streak transitions, telemetry-style stat counters, full-bleed video hero with a strong scrim. Portfolio-first; the work is the hero.
- Pages: Portfolio by category (automotive, aviation, motorsport, dealership/commercial, events), project/case pages with their own share image, Services + packages, Client Gallery (external gallery host, e.g. Pixieset, linked as a real button), Client Login (Command System), Book a shoot, About, FAQ, service-area / travel pages for cities and airports or tracks served.
- Schema: LocalBusiness or ProfessionalService, Service, CreativeWork / ImageObject / VideoObject (with thumbnails and duration), Offer for packages, FAQPage, BreadcrumbList.
- Footprint: home metro + travel regions; map pack for "automotive photographer [city]"; GBP category Photographer / Videographer (+ Commercial photographer).
- Tone: confident, technical, few words, big imagery. Image style: real shoots only, high-contrast, motion, never stock.
- App: bookings/inquiries pipeline, shoot calendar, galleries + prints locked "coming soon" until ready, client portal for deliverables.
- Social: Instagram Reels / TikTok / YouTube Shorts behind-the-scenes, searchable captions with car model + location keywords.`,
  },
  {
    key: "Fitness & bodybuilding coaching",
    clients: ["Muscle Mentor Coaching", "Chasing Gains Coaching", "DIALD"],
    brief: `Online and in-person coaches, including competition bodybuilding / physique prep.
- Design: bold athletic: high-contrast type, transformation before/afters (with written consent), progress counters, gritty texture or clean premium depending on the coach's brand.
- Pages: Coaching programs (online, in-person, contest prep, peak week), Transformations / results (real clients only, consent noted), Apply / consultation funnel, About the coach (credentials, competition history), FAQ, Blog, Client login (coaching app), city page for in-person training.
- Schema: Person (the coach) + Organization/ProfessionalService or HealthClub where in-person, Service, Offer, Review only for real reviews, FAQPage, Article/BlogPosting, VideoObject.
- Footprint: national online audience + local map pack for in-person ("personal trainer [city]").
- Compliance: no medical claims, no guaranteed results; testimonials must be real and typical-results-disclaimed; health data (check-ins, bloodwork, body metrics) stays inside the client app and never syncs out.
- App: check-ins, macros/meal plans, training programs, peak week tools, contest/show directory, coach approve queue, athlete app view. Units exactly as the coach uses them (e.g. sodium in mg / packets).
- Tone: direct, motivating, evidence-based. Image style: real athletes, gym and stage photos.
- Social: Reels/TikTok/YouTube education + transformations, keyword-rich captions ("contest prep coach", "peak week").`,
  },
  {
    key: "Home services & outdoor trades",
    clients: ["Palm Shore Hardscapes & Design", "PowerLift Doors of Oregon", "North Woods Tree Service", "Mow Masters of Ascension"],
    brief: `Hardscape / pool decks / outdoor kitchens, landscaping & grounds maintenance, tree removal & land clearing, custom hydraulic / garage doors.
- Design: clean premium, trust-first: big project photography, before/after sliders, process timelines, financing and warranty callouts, sticky call + quote CTAs on mobile.
- Pages: one page per core service, one page per city / service area (unique copy, local photos, projects nearby), Projects / gallery with project detail pages, Process, Financing (only if offered), Reviews, Request a quote / estimate, FAQ, Careers optional.
- Schema: HomeAndConstructionBusiness (or the specific LocalBusiness subtype: Landscaper, GeneralContractor, etc.) with areaServed, Service per service, FAQPage, BreadcrumbList, ImageObject for projects, Review/AggregateRating only from real platform reviews.
- Footprint: map pack is the main growth lever: GBP primary category matching the money service, secondary categories per service, service areas listed, weekly GBP posts and project photos, review requests after every job, citations on Yelp, BBB, Angi, HomeAdvisor, Houzz, Nextdoor, Thumbtack plus industry/manufacturer dealer directories, NAP identical everywhere.
- App: CRM/ERP: leads, estimates/quotes, price lists, jobs/crews schedule, invoices (QuickBooks CSV export), material orders, photo uploads per job, review requests.
- Tone: straightforward, craftsman, local. Image style: their own job photos (drone shots where available), never stock people.`,
  },
  {
    key: "Food, beverage & retail",
    clients: ["Smallcakes Baton Rouge", "Bobablastic (Molalla)", "The Bulba Bros", "Clarkes General Store & Eatery"],
    brief: `Cupcakery / king cakes, boba & smoothie shop (franchise location), Pokémon TCG / hobby shop, general store & eatery.
- Design: warm editorial or playful brand color, menu-first: big product photography, hours + "open now" state, order / visit CTAs, events.
- Pages: Menu (structured, with prices from the client), Order online / catering / pre-orders (link to the real ordering system), Events (tournaments, launches, seasonal), Visit / location with hours and map, About / story, Gallery, FAQ, Rewards if offered, Careers optional. Franchise locations follow franchise brand rules and only claim their own location.
- Schema: the specific LocalBusiness subtype (Bakery, CafeOrCoffeeShop, Restaurant, Store / HobbyShop), openingHoursSpecification, Menu / MenuItem, hasMenu, Event for events, Product + Offer for retail items, FAQPage.
- Footprint: map pack + "near me": GBP with menu, products, photos weekly, hours kept exact (holiday hours), posts for specials/events; citations: Yelp, TripAdvisor, Apple Maps, Bing Places, delivery apps, local chamber; reviews asked at the counter (QR).
- App: inventory / ordering / pre-orders, specials scheduler, events + tournament signups, loyalty, staff schedule, daily sales log.
- Tone: friendly, local, fun. Image style: real products and the shop, appetizing light; seasonal refreshes.
- Social: Instagram/TikTok/Facebook with location and product keywords; events and new drops.`,
  },
  {
    key: "Tattoo & personal services",
    clients: ["Arcane Ink", "Royalz Barbers"],
    brief: `Tattoo & piercing studios, barbershops (single or multi-location).
- Design: gritty / dark editorial or classic barber depending on brand; artist-first portfolio grids, style filters, booking CTA always visible.
- Pages: Artists / barbers (one page each with portfolio, styles, booking link), Services + starting prices (from the client), Book (real booking system, e.g. Fresha), Aftercare (tattoo/piercing), Healed work / gallery, Locations (one page per shop), Policies (deposits, age/ID, cancellations), FAQ, Shop/merch if any.
- Schema: TattooParlor / HairSalon / BarberShop (BeautySalon/HealthAndBeautyBusiness fallback) per location, Person for artists, Service + Offer, FAQPage, ImageObject for portfolio, BreadcrumbList.
- Footprint: map pack per location: separate GBP per shop, categories Tattoo shop / Piercing shop / Barber shop, photos of work weekly, review requests after every appointment, citations Yelp, Booksy/Fresha, Apple Maps, Bing Places, Instagram. GBP posts never contain phone numbers, addresses or bare URLs; the Learn more button is the only link.
- App: bookings + deposits overview, artist schedules, consent/waiver records (stored privately), aftercare follow-ups, client history.
- Tone: authentic, artist voice. Image style: real healed work and chair shots, consented.`,
  },
  {
    key: "Supplements, e-commerce & streetwear",
    clients: ["Rein Nutrition", "Survivor Fuel", "VSRL"],
    brief: `Supplement brands (pre-workout, electrolytes), e-commerce DTC, streetwear for lifters.
- Design: product-led: hero product renders, drop countdowns, bold brand accent (e.g. tan for streetwear), gritty or premium per brand, fast product grids, sticky add-to-cart.
- Pages: Shop / collections, product detail pages (ingredients/sizing, reviews, FAQ), Drops / launches, Lookbook, About / story, Athletes / ambassadors, Wholesale (optional), Shipping & returns, FAQ, Blog (education), account / order tracking via the store platform.
- Schema: Product + Offer (price, availability), AggregateRating/Review only from real reviews, Organization (national), Brand, FAQPage, BreadcrumbList, Article. Merchant Center feed and Google Shopping listings.
- Footprint: national; no map pack unless there is a storefront. Search focus: product and ingredient queries, AI answers for "best [product] for [goal]".
- Compliance: supplements carry the FDA disclaimer ("These statements have not been evaluated by the Food and Drug Administration..."), no disease claims, ingredient amounts exactly as on the label; Prop 65 where it applies.
- App: orders/inventory overview, drops calendar, ambassador/affiliate tracking, email/SMS campaigns, customer service inbox.
- Tone: energetic, community. Image style: real product shots, athletes in the gear.`,
  },
  {
    key: "Agency & B2B services",
    clients: ["Velocity Business Solutions", "SMPL Social"],
    brief: `B2B services: merchant services / payment processing, AI content / SaaS, agencies.
- Design: modern SaaS / corporate: crisp grid, product UI shots or diagrams, animated metrics, logos of partners (only real ones), demo/consult CTAs.
- Pages: Solutions / services, industries served, pricing or "get a quote", case studies (real only), integrations/partners, about/team, resources/blog, careers, contact/demo booking, legal (privacy, terms, and the client's own service terms written by the client).
- Schema: Organization / ProfessionalService, Service, SoftwareApplication (for SaaS), Offer, FAQPage, Article, BreadcrumbList, Person for leadership.
- Footprint: national; AI answer engines and comparison queries matter most; LinkedIn presence; review sites (G2, Capterra, Clutch, Trustpilot) as citations.
- Compliance: financial services claims accurate, no guaranteed savings; data-handling language exact.
- App: lead pipeline, onboarding/implementation tracker, client success, partner/referral tracking, project communication.
- Tone: clear, credible, outcome-focused. Image style: product UI, real team, diagrams; no generic stock handshakes.`,
  },
];

// What every area covers. Used to write the generic v1 for areas with no prompt yet, and as context for variants.
export const AREA_BRIEFS: Record<string, string> = {
  "website-build": "New client website from one prompt + optional reference.",
  "website-polish-launch": "Finishing pass and go-live checklist for a website.",
  "app-build": "New client Command System (private business app).",
  "app-polish-launch": "Security/aliveness sweep and launch of a client app.",
  "brand-kit": `Same brand kit structure for every client (Brand Arsenal). Deliverables: logo set (primary, secondary/stacked, icon/mark, wordmark; full-color, black, white; SVG + PNG + transparent), favicon set (SVG with light/dark, ICO, 16/32/180/192/512 PNG, legible at 16px), color system (primary, accent, neutrals, with hex/RGB, contrast-checked for WCAG AA, light + dark usage), typography (display + body, web-safe fallbacks, scale), voice & tone (3-5 traits, do/don't, sample lines), photography/image style, iconography, social templates (profile picture, cover/banner sizes per platform, post + story templates), 1200x630 share-image template, email header lockup, business card / signature, usage rules (clear space, minimum size, don'ts). Use real logo files only, never redraw; trademarks use ™. Output a one-page brand sheet + organized asset folder list. Store the kit in the client's Møthership profile.`,
  "account-setup": `Set up every account the same way, owned by the client with Interstellar as manager/admin: Google Business Profile (verification, primary + secondary categories, services, hours, attributes, description, photos), Google Search Console (domain property, sitemap), GA4 (production hosts only, Signals and ad personalization off), Bing Webmaster Tools (import from GSC), Bing Places, Apple Business Connect, Meta Business Suite (Facebook Page + Instagram), TikTok/YouTube/LinkedIn as relevant, Google Merchant Center for e-commerce, email authentication (SPF, DKIM, DMARC; BIMI later), review platforms per industry. Rules: NAP comes from the GBP and is identical everywhere; record only where each login lives, never passwords or codes; two-factor on with the client's device or a shared vault the client controls; add Justin's business account (justin@interstellar-strategies.com) as manager, not personal accounts; log every account in the client's Møthership profile with status and owner.`,
  "map-pack": `Map pack and citations, faster: GBP fully optimized (primary category = money keyword, secondary categories per service, services with descriptions, products, service areas, hours incl. holiday hours, attributes, Q&A seeded with real FAQs, weekly geo-relevant photos, weekly posts), review engine (ask after every job, reply within 1 hour, keyword-natural replies, never incentivized), citations in tiers (data aggregators, Apple Maps, Bing Places, Yelp, Facebook, BBB, industry and local directories, chamber), NAP identical to the GBP everywhere (GBP phone is the correct number), city/service landing pages on the site linked from the GBP, LocalBusiness schema matching the GBP, embedded map on Contact, local backlinks (sponsorships, partners, local press). GBP posts never contain a phone number, street address or bare URL; the Learn more button is the only link and it is the plain page URL with no UTM. Track rankings by grid where available; report changes monthly.`,
  "social-posts": `Social posts built like a social-search strategist: each post targets something people search on that platform (keyword in the first line, on-screen text, spoken words, caption and alt text), platform-native format (Reels/TikTok/Shorts vertical 9:16 with hook in the first 1-2 seconds, carousels for education, stories for engagement), 3-5 relevant hashtags not 30, location tags for local businesses, captions in the client's voice, a clear call to action, images from the client's own photo library or matching licensed stock (never images that look AI-generated). Monthly plan with pillars (proof/results, education, behind the scenes, offers, community), posting times from the account's insights, and a repurposing map (one shoot → many posts). Nothing is posted without approval unless the client's engine is running on auto.`,
  blogs: `Client blog packages that rank in Google and get cited by AI answers: topic calendar approved by Justin once a month, each post targets one primary query + close variants with search intent matched, answer-first intro (2-3 sentence direct answer), skimmable H2/H3 questions, original specifics from the client (prices, process, local details, real photos), FAQ block, internal links to service/city pages and older posts (and older posts updated to link to the new one), Article/BlogPosting + FAQPage + BreadcrumbList schema, author/byline, share image, meta title <=60 and description <=155, a GBP post companion (no phone, address or bare URL; Learn more = plain post URL, no UTM). Never mark a generated post as published until it is confirmed live on the blog index.`,
  automations: `The full stack of automations per client so the subscription runs itself: website inquiry → Command System inbox + instant auto-reply + owner alert; review requests after every job/visit; blog + GBP post engine (monthly calendar approval, scheduled drafts); social engine; client request forms → Møthership requests; add-on purchase flows; coach transformations / check-in reminders (fitness); appointment reminders (services); monthly report to the client; Business Brain question generator weekly and brain sync to Møthership; work logged to Møthership WorkEntries. Rules: built-in platform AI only; every automation logs runs to Møthership (AutomationRun) with success/failure; test sends go to justin@interstellar-strategies.com first; nothing customer-facing goes out without an approval step until Justin switches it to auto; no secrets in code or data.`,
  "seo-sweep": `The polish sweep across every live site, one site at a time: design and info accuracy (NAP, hours, prices, staff), technical SEO (indexing in GSC, coverage errors, canonical, redirects, Core Web Vitals, mobile, broken links, sitemap + robots, llms.txt), on-page (titles <=60, descriptions <=155, H1s, internal links, image alt text), schema validated (Organization/LocalBusiness, Service, FAQPage, BlogPosting, BreadcrumbList, Product where relevant), AI search readiness (answer-first copy, clear facts and numbers, FAQ sections, crawler access for GPTBot, ClaudeBot, PerplexityBot, Google-Extended unless the client opts out), Bing Webmaster + Bing Places, map pack (GBP and citations consistent), share images, analytics + privacy compliance. Search/SEO changes are recommendations until Justin approves them; report pass / fixed / needs Justin per item.`,
  "client-emails": `Interstellar client emails, the same structure every time: black/dark header with the orbit icon + "INTERSTELLAR" with an orange ™ (no second line), then a "+ <label> · <date>" eyebrow row, then the content sections; brand gradient #ff3c00 → #ff6a00 → #ffaa00 (dividers and buttons #ff3c00 → #ff6a00, top bar deep→light, bottom bar light→deep), every link bright orange (never blue), table-based HTML that works in Gmail/Outlook/Apple Mail, dark-mode safe, mobile-first single column at 600px max, no preheader line (subject + HTML body only), plain-text fallback, Justin's sign-off. Never mention the hosting/builder platform. Deliver the HTML as a copy-paste code block; never create Gmail drafts or send to the client; test sends go to justin@interstellar-strategies.com first. Subscription-start emails follow the approved Palm Shore template (dark hero with price stats, flame callout, two-column plan cards, payment button) with only price and plan details changed.`,
};

export const SEED_HOUSE = `Interstellar house standards that apply everywhere:
- Trademarks use ™, never ®. Never name the hosting/builder platform to clients or visitors (say "the platform" in prompts).
- Real facts only: never invent stats, testimonials, reviews, prices or claims. Mark placeholders [LIKE THIS].
- The client's Google Business Profile phone number is the correct one everywhere.
- Never store passwords, keys or codes anywhere; record where a login lives. Secrets are set by Justin; code reads names only.
- Never publish, deploy, connect domains or change DNS (Justin does). Never delete anything permanently. Never sign in as Justin; use labeled test users.
- Alive, modern, professional; motion that respects prefers-reduced-motion; styles switch by company type at the same quality bar.
- Footer credit on every site: "Web design by Interstellar Strategies" → https://interstellar-strategies.com.
- Work done is logged to Møthership so it shows in the client's work feed.`;
