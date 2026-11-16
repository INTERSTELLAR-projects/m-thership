// QA MODE ONLY: fictional Launch Week audit files (same shape as the real per-client JSON) for the design preview.
export const QA_LAUNCH_FILES = [
  {
    slug: "qa-summit",
    json: {
      client_name: "Summit Roofing Co", app_id: "qa-site-1", preview_url: "https://summitroofing.test", launch_readiness_pct: 82, order: 0,
      status_summary: "All core pages are built and responsive. Service-area pages and the quote form need final copy and a routing decision.",
      done: ["Home, About, Services and Contact pages built", "Mobile layout checked at 390px", "LocalBusiness schema on every page"],
      blocking: ["Quote form has no destination email", "Service-area list not confirmed", "Hero photo is a placeholder"],
      questions: [
        { id: "q1", question: "Where should quote-form submissions go?", default_answer: "Email dana@summit.test and save to the CRM", options: ["Email only", "CRM only", "Email and CRM"], blocks_launch: true, category: "forms", apply_to: "Contact page quote form" },
        { id: "q2", question: "Which cities should get their own service-area page?", default_answer: "Portland, Lake Oswego, Beaverton and Tigard", options: ["Portland metro only", "Add Salem too"], blocks_launch: true, category: "seo", apply_to: "/service-areas" },
        { id: "q3", question: "Which hero photo should we use?", default_answer: "The crew-on-roof shot from the brand folder", options: ["Crew on roof", "Finished home exterior", "Drone shot"], blocks_launch: true, category: "design", apply_to: "Home hero" },
        { id: "q4", question: "Show the financing banner on the home page?", default_answer: "Yes, below the hero", options: ["Yes", "No"], blocks_launch: false, category: "offers", apply_to: "Home page" },
        { id: "q5", question: "Do you offer emergency tarping after storms?", default_answer: "", options: [], blocks_launch: false, category: "services", apply_to: "Services page" },
      ],
    },
  },
  {
    slug: "qa-harbor",
    json: {
      client_name: "Harbor Coffee", app_id: "qa-site-2", preview_url: "https://harborcoffee.test", launch_readiness_pct: 64, order: 1,
      status_summary: "Menu and location pages are live in preview. Online ordering link and holiday hours are still open.",
      done: ["Menu page with prices", "Location page with map"],
      blocking: ["Online ordering link missing", "Holiday hours unknown"],
      questions: [
        { id: "q1", question: "Which online ordering link should the Order button use?", default_answer: "Hide the Order button until the link is ready", options: ["Toast link", "Square link"], blocks_launch: true, category: "ordering", apply_to: "Header Order button" },
        { id: "q2", question: "What are the holiday hours for Thanksgiving week?", default_answer: "", options: [], blocks_launch: true, category: "hours", apply_to: "Location page and footer" },
        { id: "q3", question: "Add an Instagram feed to the home page?", default_answer: "No, link the profile in the footer", options: ["Add the feed", "Footer link only"], blocks_launch: false, category: "social", apply_to: "Home page" },
      ],
    },
  },
  {
    slug: "qa-peak",
    json: {
      client_name: "Peak Fitness Lab", app_id: "qa-site-3", preview_url: "https://peakfit.test", launch_readiness_pct: 91, order: 2,
      status_summary: "Ready apart from one pricing decision.",
      done: ["All pages built", "Booking widget connected", "Speed score 96"],
      blocking: ["Membership price on the pricing page"],
      questions: [
        { id: "q1", question: "Show membership prices on the site or 'Book a consult'?", default_answer: "Show prices", options: ["Show prices", "Book a consult"], blocks_launch: true, category: "pricing", apply_to: "/pricing" },
      ],
    },
  },
];
