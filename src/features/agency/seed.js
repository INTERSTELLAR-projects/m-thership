// Starting content for AgencyKnowledge. Facts only from Justin's Claude Project knowledge
// (Interstellar offers / rebrand / preferences notes) and the prices already in the app
// (start-service catalog, flight catalog, Social Studio brand rules). Nothing invented.
// Used once to seed the entity and by Settings > Agency knowledge > "Add missing sections".

export const SEED_SOURCE = "Claude Project knowledge (Interstellar) + in-app catalog prices, Nov 2026";

export const SEED_OFFERS = [
  { key: "mission_alpha", name: "Mission ALPHA", price: 11997, billing: "one_time", terms: "Paid in full or financed as a subscription. Must be on HyperCare+ or GravïtyCare. Fully done within 45 days with HyperCare+ running. Bonus: the first 45 days of HyperCare+ are free, starting the day Mission ALPHA is purchased; the HyperCare+ subscription starts on day 46. Mission ALPHA only.", architecture: "", includes: ["Custom Website", "Command System", "Ops Command", "Brand Arsenal", "Launch Grid", "Transmission", "Intel Briefing (free)"], notes: "Main offer to sell." },
  { key: "mission_bravo", name: "Mission BRAVO", price: 9997, billing: "one_time", terms: "Paid in full or financed as a subscription. Must be on HyperCare+ or GravïtyCare.", architecture: "", includes: ["Custom Website", "Command System", "Intel Briefing (free)"], notes: "Main offer to sell." },
  { key: "custom_website", name: "Custom Website", price: 4997, billing: "one_time", terms: "Website only. Buyer must go on HyperCare+ or GravïtyCare.", architecture: "Architect 2.1", includes: ["Intel Briefing (free)"], notes: "" },
  { key: "command_system", name: "Command System", price: 5997, billing: "one_time", terms: "App only. Buyer must go on HyperCare+ or GravïtyCare.", architecture: "Ørigin 1.0", includes: ["Intel Briefing (free)"], notes: "Lead product. Keep \"Command System\" as the searchable name; introduce Ørigin 1.0 as our newest architecture." },
  { key: "ops_command", name: "Ops Command", price: 3000, billing: "one_time", terms: "Add-on package, paid up front.", architecture: "Protocol 3.6", includes: ["SOPs for the whole company", "Automation, email and notification stacks", "AI Email Agent (inbox organized with labels and tabs, triage, drafted replies with approval)", "Chrome Workspace (custom browser tab groups and bookmark bar for the business)"], notes: "AI Email Agent and Chrome Workspace added Nov 2026; price unchanged." },
  { key: "brand_arsenal", name: "Brand Arsenal", price: 2500, billing: "one_time", terms: "Add-on package, paid up front.", architecture: "Tesseract 2.3", includes: [], notes: "" },
  { key: "launch_grid", name: "Launch Grid", price: 1400, billing: "one_time", terms: "Add-on package, paid up front.", architecture: "NETWORX 8.6", includes: [], notes: "NETWORX is spelled with an X." },
  { key: "transmission", name: "Transmission", price: 1500, billing: "one_time", terms: "Sold alone at $1,500.", architecture: "FPS 1.1", includes: [], notes: "" },
  { key: "intel_briefing", name: "Intel Briefing", price: 0, billing: "included", terms: "Free with every build (ALPHA, BRAVO, website only, app only): an audit before the build and a final sweep at the end. Never sold as an add-on.", architecture: "Inspector 10.9", includes: [], notes: "" },
  { key: "orbit_local", name: "HyperCare+ Local", price: 750, billing: "monthly", terms: "Subscription. HyperCare+ from $750/mo is the whole management package.", architecture: "Neptune 5.5", includes: [], notes: "Formerly Ørbit SEO (renamed 2026-10-30)." },
  { key: "orbit_multi", name: "HyperCare+ Multi-Location", price: 350, billing: "monthly", terms: "Added per extra location (+$350/mo).", architecture: "Neptune 5.5", includes: [], notes: "" },
  { key: "orbit_national", name: "HyperCare+ National", price: 1750, billing: "monthly", terms: "Subscription tier.", architecture: "Neptune 5.5", includes: [], notes: "" },
  { key: "orbit_global", name: "HyperCare+ Global", price: 3000, billing: "monthly", terms: "Subscription tier.", architecture: "Neptune 5.5", includes: [], notes: "" },
  { key: "starship_care", name: "GravïtyCare", price: 197, billing: "monthly", terms: "Subscription: small edits and keeping the site live (no SEO). Its own package and sign-up, separate from HyperCare+.", architecture: "Neptune 5.5", includes: [], notes: "Formerly Starshïp Care. Means \"we're just keeping you afloat\"." },
];

const money = (n) => `$${Number(n).toLocaleString("en-US")}`;
export const offerLine = (o) => `- **${o.name}** — ${o.billing === "included" ? "free with every build" : `${money(o.price)}${o.billing === "monthly" ? "/mo" : ""}`}${o.architecture ? ` · architecture ${o.architecture}` : ""}${o.includes && o.includes.length ? ` · includes ${o.includes.join(", ")}` : ""}. ${o.terms}`;

export const SEED_SECTIONS = [
  {
    key: "about", sort: 10, title: "Who we are",
    body: [
      "Interstellar Strategies is Justin Cowell's full-stack digital agency in Molalla, OR: web design and development, SEO (AIO / GEO / AEO, local SEO, Google Business Profiles), automation and custom software (Base44).",
      "- Tagline: \"The Future of Business\" (sign-off: \"Interstellar. The Future of Business.\").",
      "- Main market: home service businesses; positioning global rather than local.",
      "- 2027 goal: $1,000,000 revenue, with offers built on Alex Hormozi's frameworks.",
      "- In 2027 Justin acts more as a business advisor: each client gets a custom e-signature, a brand kit and a 2027 playbook after a goals call.",
      "- Møthership is the internal agency OS (to-dos, SOP library, client portal).",
    ].join("\n"),
    data: { tagline: "The Future of Business", founder: "Justin Cowell", location: "Molalla, OR", market: "Home service businesses" },
  },
  {
    key: "offers", sort: 20, title: "Offers & prices",
    body: [
      "HyperCare+ and GravïtyCare are the only two subscriptions (a client is on one or the other). The other packages are paid up front. Every build requires a HyperCare+ or GravïtyCare plan. Customized packages are quoted on the call.",
      "",
      ...SEED_OFFERS.map(offerLine),
    ].join("\n"),
    data: { offers: SEED_OFFERS },
  },
  {
    key: "pricing_rules", sort: 30, title: "Pricing rules",
    body: [
      "- Prices must be identical everywhere (website, funnel, docs, app). Never contradict them.",
      "- 10% off for military, police and first responders.",
      "- When an existing client's subscription price changes, their card is not charged that day; the new amount starts at their next regular billing date.",
      "- Client-requested system changes over $250 of work use the \"Interstellar Command System Upgrade\" product; anything under $250 is done free.",
      "- Cancelling hosting takes the site/app offline unless the client pays a $1,000 buy-out for full access, plus 90 days of free help managing it.",
      "- Interstellar buys and holds new client domains (~$20/yr) and transfers them if the client cancels.",
      "- Dropping from HyperCare+ to GravïtyCare is a downgrade, not a cancellation.",
      "- Clients from before the Nov 2026 rebrand get HyperCare+ at their grandfathered price; older add-ons merge into one HyperCare+ subscription with no price change.",
      "- Pricing decisions are made the way Hormozi would.",
    ].join("\n"),
  },
  {
    key: "delivery_rules", sort: 40, title: "Delivery rules (every client deliverable)",
    body: [
      "- Never invent client facts, results, reviews, prices or numbers. Missing facts are listed for Justin.",
      "- Search / SEO changes are recommendations until Justin approves them.",
      "- Client blogs and GBP posts: Justin approves each draft before it goes live. Images from the client's own photo library or matching Envato stock; generated images only if they don't look AI-generated.",
      "- GBP post copy never contains a phone number, street address or bare URL; the Learn more button is the only link, the plain blog URL with no UTM parameters.",
      "- Client delivery emails: subject + HTML body as a code block, no preheader. Never create or send Gmail drafts for client deliverables.",
      "- Client email brand gradient #ff3c00 → #ff6a00 → #ffaa00 (never gold or yellow); divider and button #ff3c00 → #ff6a00.",
      "- The Interstellar gradient is ours: never use it in a client's brand unless it is genuinely their color.",
      "- Do not store client logins or passwords anywhere; record only that access was granted.",
    ].join("\n"),
  },
  {
    key: "voice", sort: 50, title: "Interstellar voice (our own marketing)",
    body: [
      "- Confident, plain and specific. Talk like an operator, not a marketer.",
      "- Short sentences. One idea per post. Name the pain in the owner's words before naming the fix.",
      "- Product names are allowed (Command System, Møthership, HyperCare+) but never lead with jargon.",
      "- Slogan is exactly \"The Future of Business\". No emoji strings.",
      "- Avoid: synergy, game-changer, revolutionary, unlock, skyrocket, guaranteed results, 10x.",
      "- Presentations use the SOP-deck branding (light canvas #ebe8e4, ink, orange flame gradient, Geist + JetBrains Mono, \"Title /accent\" headings).",
    ].join("\n"),
  },
  {
    key: "bonuses", sort: 60, title: "Bonuses & programs",
    body: [
      "- Every build includes a free Intel Briefing: an audit before the build and a final sweep at the end.",
      "- Mission ALPHA only: the first 45 days of HyperCare+ free. The 45 days start the day Mission ALPHA is purchased (matching the 45-day build) and the HyperCare+ subscription starts on day 46. Separate from the Launch Guarantee (first 3 months of HyperCare+ free if the build is not live in 45 days).",
      "- Clients get the portal tools for life: email signatures and QR codes (Wørmhole). The AI presentation creator is \"coming soon\".",
      "- Prestige referral program: when a referral books a call the referrer gets a Priority Pass (their next request jumps to the front of the build queue, no dollar value). When a referral pays their first invoice the referrer gets $500 in Interstellar credit added to their account (never a subscription discount, invoice credit or free month). Credits bank and stack with no cap for builds (automations, app upgrades / new features, interactive website features, add-on packages); merch, marketing materials, social posts, videos and ad spend are capped at $500 per redemption, redeemed through Interstellar. Clients request spends from the portal (Referrals > Use my credits) and Justin approves each one. Tier ladder Prestige I to Master unlocks by signed referrals. Referrals are logged by hand.",
    ].join("\n"),
  },
  {
    key: "operations", sort: 70, title: "Operations",
    body: [
      "- Justin's real hands-on time: Custom Website 3 days tops, Command System 5 days tops, Ops Command 1 day, Brand Arsenal 1 day, Launch Grid 1 day, Client Onboarding 1 day, Intel Briefing 1 day, Transmission 1 day, HyperCare+ setup 1 day per tier, GravïtyCare under a day. Never invent other timelines.",
      "- HyperCare+ scope: full management of the online presence — weekly GBP posts and long-form local blogs, replying to every review, fixing citations so every listing is identical, frequent site edits and new project pages, monitoring GSC / GA / Bing / Apple Maps / Yelp / citations / indexing / schema / page speed, and automatic review requests after every sale.",
      "- Lead flow: website contact form (3 steps) and the booking funnel feed Møthership as leads; referral and cold leads are entered by hand; the onboarding intake comes after payment, in the client portal.",
      "- Client calls are recorded with Google Meet; Gemini notes live in the Drive folder of past client meetings.",
    ].join("\n"),
  },
];
