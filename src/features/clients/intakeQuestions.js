// The Interstellar Intake Audit. One questionnaire that gives Justin everything needed to
// (1) see every offer that fits, and (2) prompt the website and system builds.
// Used in the admin cockpit and (later) in the client portal.

export const INTAKE_SECTIONS = [
  {
    id: "basics",
    title: "Business basics",
    questions: [
      { id: "legal_name", label: "Legal business name (and DBA if different)", type: "text" },
      { id: "industry", label: "Industry / trade", type: "text" },
      { id: "years", label: "Years in business", type: "number" },
      { id: "owners", label: "Owner(s) and decision makers", type: "text" },
      { id: "team_size", label: "Team size (include part-time and subs)", type: "text" },
      { id: "locations", label: "Locations and service areas", type: "textarea", help: "Every city/county you serve. Multiple locations? List each address." },
      { id: "hours", label: "Business hours", type: "text" },
      { id: "contact", label: "Main phone, email and address customers should use", type: "textarea" },
      { id: "licenses", label: "Licenses, certifications, insurance, awards", type: "textarea" },
    ],
  },
  {
    id: "offer",
    title: "Offer & revenue",
    questions: [
      { id: "services", label: "Every service / product you sell", type: "textarea" },
      { id: "top_earners", label: "Your top 3 money-makers", type: "textarea" },
      { id: "avg_ticket", label: "Average job / order value ($)", type: "text" },
      { id: "pricing_model", label: "How you price", type: "select", options: ["Per job / quote", "Hourly", "Packages", "Subscription / membership", "Retail / per item", "Mixed"] },
      { id: "revenue_now", label: "Current monthly revenue (range)", type: "select", options: ["Under $10k", "$10k–$25k", "$25k–$50k", "$50k–$100k", "$100k–$250k", "$250k+"] },
      { id: "revenue_goal", label: "Monthly revenue you want 12 months from now", type: "text" },
      { id: "seasons", label: "Busiest and slowest months", type: "text" },
      { id: "capacity", label: "How many more jobs/customers a month could you handle today?", type: "text" },
    ],
  },
  {
    id: "customers",
    title: "Customers & competition",
    questions: [
      { id: "ideal_customer", label: "Describe your best customer", type: "textarea" },
      { id: "lead_sources", label: "Where new customers come from today", type: "multi", options: ["Google search", "Google Maps", "Referrals", "Repeat", "Facebook / Instagram", "TikTok", "Nextdoor", "Yelp", "Angi / Thumbtack", "Paid ads", "Walk-ins", "Other"] },
      { id: "why_choose", label: "Why customers choose you over others", type: "textarea" },
      { id: "objections", label: "Most common objections or reasons people don't buy", type: "textarea" },
      { id: "competitors", label: "Top competitors (names or websites)", type: "textarea" },
    ],
  },
  {
    id: "sales",
    title: "Sales process",
    questions: [
      { id: "lead_handling", label: "When a lead comes in, what happens step by step?", type: "textarea" },
      { id: "response_time", label: "How fast do leads get a reply?", type: "select", options: ["Under 5 minutes", "Within an hour", "Same day", "Next day", "It varies / leads slip"] },
      { id: "quoting", label: "How you quote / estimate", type: "textarea" },
      { id: "follow_up", label: "How you follow up on quotes that don't close", type: "textarea" },
      { id: "close_rate", label: "Rough close rate (%)", type: "text" },
      { id: "booking_payments", label: "How customers book and pay", type: "textarea" },
    ],
  },
  {
    id: "ops",
    title: "Operations & tools",
    questions: [
      { id: "software", label: "Every app/software you use (CRM, scheduling, invoicing, accounting, phone, forms…)", type: "textarea" },
      { id: "monthly_software_cost", label: "Roughly what you pay for software each month", type: "text" },
      { id: "manual_work", label: "What do you or your team do by hand over and over?", type: "textarea" },
      { id: "bottleneck", label: "Biggest bottleneck in the business right now", type: "textarea" },
      { id: "roles", label: "Who does what on the team", type: "textarea" },
      { id: "sops", label: "Do you have written SOPs?", type: "select", options: ["Yes, up to date", "Some, outdated", "No"] },
      { id: "automate_first", label: "If one thing ran itself tomorrow, what would it be?", type: "textarea" },
    ],
  },
  {
    id: "website",
    title: "Website",
    questions: [
      { id: "site_url", label: "Current website", type: "text" },
      { id: "site_platform", label: "Platform / who built it / who manages it", type: "text" },
      { id: "domain_access", label: "Who owns the domain, and do you have the logins?", type: "textarea" },
      { id: "site_likes", label: "What you like and hate about the current site", type: "textarea" },
      { id: "must_have_pages", label: "Must-have pages and features (quote form, booking, gallery, menu, store…)", type: "textarea" },
      { id: "media", label: "Photos/videos of your work you can share", type: "select", options: ["Lots, ready to go", "Some", "Very few", "None"] },
      { id: "sites_admired", label: "Websites you admire (any industry)", type: "textarea" },
    ],
  },
  {
    id: "search",
    title: "Search, listings & reviews",
    questions: [
      { id: "gbp", label: "Google Business Profile status", type: "select", options: ["Have it + access", "Have it, no access", "Not sure", "Don't have one"] },
      { id: "listings", label: "Other listings you're on", type: "multi", options: ["Bing Places", "Apple Business Connect", "Yelp", "Nextdoor", "Angi", "BBB", "Facebook page", "Instagram", "LinkedIn", "Yellow Pages"] },
      { id: "reviews", label: "Google reviews count and rating", type: "text" },
      { id: "review_process", label: "How you ask for reviews today", type: "textarea" },
      { id: "keywords", label: "What you want to show up for on Google / in AI answers", type: "textarea" },
      { id: "past_seo", label: "Any past SEO or ads work (who, results, still paying?)", type: "textarea" },
    ],
  },
  {
    id: "brand",
    title: "Brand",
    questions: [
      { id: "logo_files", label: "Logo files available?", type: "select", options: ["Vector files (AI/SVG/PDF)", "PNG/JPG only", "No good files", "Want a new logo"] },
      { id: "colors_fonts", label: "Brand colors and fonts (if known)", type: "textarea" },
      { id: "tagline_voice", label: "Tagline and how your brand should sound", type: "textarea" },
      { id: "socials", label: "Social handles", type: "textarea" },
      { id: "brand_admired", label: "Brands you admire", type: "textarea" },
    ],
  },
  {
    id: "system",
    title: "System wishlist",
    questions: [
      { id: "system_needs", label: "What should your custom system do?", type: "multi", options: ["CRM / leads", "Quotes & estimates", "Scheduling / dispatch", "Job tracking", "Invoicing & payments", "Client portal", "Rewards / loyalty", "Inventory", "Team time & payroll", "Supplier / builder portal", "Reporting dashboard", "AI assistant"] },
      { id: "system_detail", label: "Walk me through a perfect week if the system ran your business", type: "textarea" },
      { id: "users", label: "Who will log in (owner, office, crew, customers)?", type: "textarea" },
    ],
  },
  {
    id: "goals",
    title: "Goals",
    questions: [
      { id: "goal_12mo", label: "Where you want the business in 12 months", type: "textarea" },
      { id: "goal_3yr", label: "Where you want it in 3 years", type: "textarea" },
      { id: "success_with_us", label: "What would make working with Interstellar a no-brainer win?", type: "textarea" },
      { id: "timeline", label: "When do you want this live?", type: "select", options: ["ASAP", "Within 45 days", "This quarter", "Just planning"] },
      { id: "budget", label: "Investment comfort for the build", type: "select", options: ["Under $3k", "$3k–$7k", "$7k–$10k", "$10k+", "Show me the options"] },
    ],
  },
];

export const ALL_QUESTIONS = INTAKE_SECTIONS.flatMap((s) => s.questions.map((q) => ({ ...q, section: s.id, sectionTitle: s.title })));

export function intakeProgress(answers = {}) {
  const answered = ALL_QUESTIONS.filter((q) => {
    const v = answers[q.id];
    return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && String(v).trim() !== "";
  }).length;
  return { answered, total: ALL_QUESTIONS.length, pct: Math.round((answered / ALL_QUESTIONS.length) * 100) };
}

export function intakeAsText(answers = {}) {
  return INTAKE_SECTIONS.map((s) => {
    const lines = s.questions
      .map((q) => {
        const v = answers[q.id];
        const val = Array.isArray(v) ? v.join(", ") : v;
        return val ? `- ${q.label}: ${val}` : null;
      })
      .filter(Boolean);
    return lines.length ? `## ${s.title}\n${lines.join("\n")}` : null;
  })
    .filter(Boolean)
    .join("\n\n");
}
