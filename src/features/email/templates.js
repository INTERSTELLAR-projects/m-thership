// Built-in Email Studio templates (seeded once into EmailTemplate, keyed by seed_key). They are layouts, not
// facts: anything that needs a real number or detail is a [bracketed placeholder] or a {{content_token}}
// ({{headline}}, {{intro}}…), and Email Studio warns before sending while any is left. Recipient fields
// ({{first_name}}, {{business}}…) fill per recipient. Copy for the portal template mirrors the onboarding email.
// Every template renders in the "Interstellar · Mission brief" design (emailBlocks.js); that template is the default.

import { SIGNATURE } from "./emailBlocks";

const SIGNOFF = { type: "signoff", text: "Questions? Reply to this email or write to hello@interstellar-strategies.com and it comes straight to our team.", name: "The Interstellar Strategies team" };

export const MISSION_BRIEF = {
  seed_key: "mission_brief",
  name: "Interstellar · Mission brief",
  category: "client",
  sort: 0,
  description: "The house design (default). Headline, greeting, up to 3 video cards, read links, offer rows, investment band, guarantee, button and signature.",
  subject: "{{business}} \u00d7 Interstellar: {{headline}}",
  blocks: [
    { type: "header", eyebrow: "{{business}} \u00d7 Interstellar", show_date: true },
    { type: "hero", title: "{{headline}}", accent: "{{headline_accent}}" },
    { type: "intro", text: "{{subline}}" },
    { type: "paragraph", text: "Hi {{first_name}},\n\n{{intro}}" },
    { type: "section", title: "Watch" },
    { type: "videos", items: [
      { thumb: "", title: "[Video 1 title]", text: "[One line on what it shows.]", url: "" },
      { thumb: "", title: "[Video 2 title]", text: "[One line on what it shows.]", url: "" },
      { thumb: "", title: "[Video 3 title]", text: "[One line on what it shows.]", url: "" },
    ] },
    { type: "section", title: "Read" },
    { type: "links", items: [
      { icon: "deck", title: "The proposal", text: "[Every pillar: where it is today, the gap, and how we fill it.]", url: "", cta: "Open" },
      { icon: "doc", title: "Call summary", text: "[What we covered, in about five minutes of reading.]", url: "", cta: "Read" },
    ] },
    { type: "section", title: "[Mission], what you get" },
    { type: "paragraph", text: "[One line on the package and what it replaces.]" },
    { type: "checklist", items: [
      { title: "A luxury website", text: "that ranks on Google, the map pack and AI answers" },
      { title: "Your own Command System,", text: "with logins for the office, crew, customers and partners" },
      { title: "A Business Brain", text: "that learns how {{business}} works, so the agents draft the work and you approve it" },
      { title: "One real brand, everywhere,", text: "online and in person" },
      { title: "M\u00f8thership:", text: "watch every task we finish for you, live" },
    ] },
    { type: "paragraph", text: "It's as custom as it gets. Anything you want added, changed or edited, we do it. That holds now and for as long as we work together." },
    { type: "offer", eyebrow: "Investment", rows: [
      { label: "[Package]", value: "[$ price]", accent: true },
      { label: "Pricing", value: "[Pricing note]" },
      { label: "Financing", value: "Custom terms that fit you" },
      { label: "HyperCare+ (we run it with you)", value: "[$ / mo], starts after launch" },
      { label: "Build time", value: "[30\u201345 days]" },
    ] },
    { type: "guarantee", label: "Our guarantee", title: "You will save money working with Interstellar, and you will be more productive.", text: "We'll lower your costs and at least double your productivity and efficiency. To-do lists that would take months take days. Tasks that take hours take minutes. Some tasks get fully automated and drop off your plate. Every task is tracked in your portal, so you'll see it for yourself." },
    { type: "paragraph", text: "Our goal is to work with {{business}} for the long haul. We'll keep strengthening every pillar of the business, month after month, as you grow.\n\nTalk it over, and tell me what you're thinking. If something doesn't fit, whether it's the terms, the timing or the scope, please tell me before you decide. We can always work something out." },
    { type: "button", label: "Reply to Justin", url: "mailto:justin@interstellar-strategies.com" },
    { type: "signature", ...SIGNATURE },
  ],
};

export const SEED_TEMPLATES = [
  MISSION_BRIEF,
  {
    seed_key: "portal_invite",
    name: "Portal invite",
    category: "client",
    sort: 1,
    description: "The onboarding layout: portal is ready, what's inside, three steps, log-in button.",
    subject: "Your {{business}} portal is ready",
    blocks: [
      { type: "header", eyebrow: "Portal access" },
      { type: "hero", title: "Your portal", accent: "is ready" },
      { type: "intro", text: "{{first_name}}, welcome aboard. Everything we do for {{business}} now lives in one place, built just for you: your work, your results, your requests and a direct line to our team." },
      { type: "band", label: "The short version", text: "Sign in with {{email}}. Continue with Google, or choose Sign up the first time to set your own password." },
      { type: "section", title: "What's inside" },
      { type: "cards", items: [
        { tag: "Work feed", tag_style: "info", title: "Everything we publish for you", text: "Every blog, Google post and website update shows up the moment it goes live." },
        { tag: "Results", tag_style: "info", title: "Your numbers and your reviews", text: "Site health, Google reviews and the results we track, in one view." },
        { tag: "Requests", tag_style: "info", title: "Ask for anything", text: "Website edits, content, Google posts or design: send a request or a message and track it to done." },
      ] },
      { type: "section", title: "What we need from you", text: "Three quick things when you log in:" },
      { type: "steps", items: [
        { title: "Log in", text: "Use the button below and sign in with {{email}}.", foot: "Takes a minute" },
        { title: "Tell us about your business", text: "Fill in the short business audit on Your Brain. It saves as you go.", foot: "On Your Brain" },
        { title: "Send your first request", text: "Pick a form under Requests, or just message us.", foot: "Whenever you're ready" },
      ] },
      { type: "button", label: "Log in to your portal", url: "{{portal_url}}/login" },
      { ...SIGNOFF, text: "We will never ask for a password by email. Questions? Write to justin@interstellar-strategies.com and it comes straight to me." },
    ],
  },
  {
    seed_key: "client_update",
    name: "Client update",
    category: "client",
    sort: 2,
    description: "Stat strip, status cards (in progress / coming up), billing card, what we need from you, 2027 band.",
    subject: "{{business}}: where everything stands",
    blocks: [
      { type: "header", eyebrow: "Client update" },
      { type: "hero", title: "Here's where", accent: "we stand" },
      { type: "intro", text: "{{first_name}}, here's the latest on everything we're doing for {{business}}." },
      { type: "stats", items: [{ value: "[#]", label: "[Metric]" }, { value: "[#]", label: "[Metric]", accent: true }, { value: "[#]", label: "[Metric]" }] },
      { type: "band", label: "The short version", text: "[One sentence: the most important thing that happened and what's next.]" },
      { type: "section", title: "Where things stand" },
      { type: "cards", items: [
        { tag: "In progress", tag_style: "in_progress", title: "[What we're building]", text: "[Where it is and when it lands.]" },
        { tag: "Coming up", tag_style: "coming_up", title: "[What's next]", text: "[What it is and when it starts.]" },
      ] },
      { type: "table", title: "Your plan", rows: [{ label: "[Service]", value: "[$ / mo]" }], total_label: "Monthly total", total_value: "[$ / mo]" },
      { type: "section", title: "What we need from you" },
      { type: "steps", items: [{ title: "[What you need]", text: "[Why, and how to send it.]", foot: "[When]" }] },
      { type: "darkband", eyebrow: "2027", title: "Where we're", accent: "headed", text: "[The plan for next year.]" },
      { type: "button", label: "Open your portal", url: "{{portal_url}}" },
      SIGNOFF,
    ],
  },
  {
    seed_key: "monthly_report",
    name: "Monthly report",
    category: "client",
    sort: 3,
    description: "Numbers for the month, what we did, what's next.",
    subject: "{{business}}: your [Month] report",
    blocks: [
      { type: "header", eyebrow: "Monthly report" },
      { type: "hero", title: "[Month]", accent: "in review" },
      { type: "intro", text: "{{first_name}}, here's how {{business}} did this month and what we worked on." },
      { type: "stats", items: [{ value: "[#]", label: "[Metric]" }, { value: "[#]", label: "[Metric]", accent: true }, { value: "[#]", label: "[Metric]" }] },
      { type: "band", label: "The short version", text: "[The headline result in one sentence.]" },
      { type: "section", title: "The numbers" },
      { type: "table", title: "This month vs last month", rows: [{ label: "[Metric]", value: "[value]" }] },
      { type: "section", title: "What we did" },
      { type: "cards", items: [{ tag: "Done", tag_style: "done", title: "[Work delivered]", text: "[What it does for you.]" }] },
      { type: "section", title: "Next month" },
      { type: "cards", items: [{ tag: "Coming up", tag_style: "coming_up", title: "[Planned work]", text: "[Why it matters.]" }] },
      { type: "button", label: "See it in your portal", url: "{{portal_url}}" },
      SIGNOFF,
    ],
  },
  {
    seed_key: "offer",
    name: "Offer / announcement",
    category: "marketing",
    sort: 4,
    description: "One big idea, what you get, the terms, one button.",
    subject: "[Announcement headline]",
    blocks: [
      { type: "header", eyebrow: "Announcement" },
      { type: "hero", title: "[Big idea]", accent: "[accent]" },
      { type: "intro", text: "{{first_name}}, [why this matters to you, in two sentences]." },
      { type: "band", label: "The short version", text: "[The offer in one sentence.]" },
      { type: "section", title: "What you get" },
      { type: "cards", items: [
        { tag: "Included", tag_style: "info", title: "[Benefit]", text: "[What it means for the business.]" },
        { tag: "Included", tag_style: "info", title: "[Benefit]", text: "[What it means for the business.]" },
      ] },
      { type: "callout", title: "[Terms or deadline]", text: "[Price, dates and anything they need to know, from Agency knowledge.]" },
      { type: "button", label: "[Call to action]", url: "" },
      SIGNOFF,
    ],
  },
  {
    seed_key: "newsletter",
    name: "Newsletter briefing",
    category: "newsletter",
    sort: 5,
    description: "Intel briefing for subscribers: signals, what it means, one button. Sent as a mass email with unsubscribe.",
    subject: "The Interstellar briefing: [topic]",
    blocks: [
      { type: "header", eyebrow: "Intel briefing" },
      { type: "hero", title: "The", accent: "briefing" },
      { type: "intro", text: "{{first_name}}, here's what's moving in search, AI and local marketing, and what to do about it." },
      { type: "band", label: "The short version", text: "[The one change worth acting on this month.]" },
      { type: "section", title: "This month's signals" },
      { type: "cards", items: [
        { tag: "Signal", tag_style: "info", title: "[What changed]", text: "[What it means for a local business.]" },
        { tag: "Signal", tag_style: "info", title: "[What changed]", text: "[What it means for a local business.]" },
        { tag: "Signal", tag_style: "info", title: "[What changed]", text: "[What it means for a local business.]" },
      ] },
      { type: "callout", title: "What to do this week", text: "[One concrete action.]" },
      { type: "button", label: "[Call to action]", url: "" },
      SIGNOFF,
    ],
  },
];

// "New email" starts in the Mission brief shape: header, headline, greeting, button, signature.
export const BLANK_DOC = {
  subject: "",
  blocks: [
    { type: "header", eyebrow: "Update" },
    { type: "hero", title: "", accent: "" },
    { type: "paragraph", text: "Hi {{first_name}},\n\n" },
    { type: "button", label: "Reply to Justin", url: "mailto:justin@interstellar-strategies.com" },
    { type: "signature", ...SIGNATURE },
  ],
};
