// Plain-English explanation + step-by-step manual fix for every audit issue.
// Keyed by Lighthouse audit id or our own on-page check key. Anything not listed falls back to
// Lighthouse's own description and a generic set of steps, so every issue always has guidance.

const G = {
  // ---------- Indexing (critical) ----------
  "noindex": {
    fix: "indexing",
    why: "The page tells Google not to list it. Until this is removed, it cannot rank for anything.",
    steps: ["Open the page's SEO settings in the site builder (Base44: the page component's <head> / meta tags).", "Remove the robots meta tag that contains \"noindex\" (or the X-Robots-Tag header in hosting settings).", "Publish, then use Search Console → URL Inspection → Request indexing.", "Re-run this audit to confirm it's gone."],
  },
  "is-crawlable": {
    fix: "indexing",
    why: "Search engines are being blocked from indexing this page, so it can't appear in results.",
    steps: ["Check the page's robots meta tag and the X-Robots-Tag response header for \"noindex\".", "Check robots.txt for a Disallow rule that covers this URL.", "Remove the block, publish, and request indexing in Search Console.", "Re-run the audit."],
  },
  "http-status-code": {
    fix: "indexing",
    why: "The page answers with an error code. Google treats it as missing and drops it from search.",
    steps: ["Open the URL in a private window and confirm the error.", "Fix the route, restore the page, or add a 301 redirect to the right page.", "Re-run the audit and check Search Console → Pages for the error clearing."],
  },
  "http-error": { alias: "http-status-code" },
  "robots-blocks-all": {
    fix: "indexing",
    why: "robots.txt tells every search engine to stay out of the whole site. Nothing new will be crawled.",
    steps: ["Open /robots.txt on the site.", "Under \"User-agent: *\", delete \"Disallow: /\" (keep any narrower rules you need).", "Add a line \"Sitemap: https://<domain>/sitemap.xml\".", "Publish, then test in Search Console → Settings → robots.txt."],
  },
  "robots-txt": {
    fix: "indexing",
    why: "robots.txt has errors, so crawlers may misread which pages they're allowed to visit.",
    steps: ["Open /robots.txt and fix the lines Lighthouse flags (every rule needs a User-agent group).", "Keep it short: a User-agent line, any Disallow rules, and a Sitemap line.", "Publish and re-run the audit."],
  },
  "robots-txt-missing": {
    fix: "indexing",
    why: "There is no robots.txt. Not fatal, but it's the standard place to point crawlers at your sitemap.",
    steps: ["Create /robots.txt in the site (Base44: a public static file).", "Add:\nUser-agent: *\nAllow: /\nSitemap: https://<domain>/sitemap.xml", "Publish and re-run the audit."],
  },
  "sitemap-missing": {
    fix: "indexing",
    why: "No XML sitemap was found. A sitemap helps Google find every page, especially new blog posts.",
    steps: ["Generate /sitemap.xml listing every public page and blog post (Base44: a static file or a route that builds it).", "Reference it in robots.txt with a Sitemap: line.", "Submit it in Google Search Console → Sitemaps and in Bing Webmaster Tools.", "Re-run the audit."],
  },
  "not-https": { alias: "is-on-https" },
  "is-on-https": {
    fix: "generic",
    why: "Some or all of the site loads over insecure HTTP. Browsers warn visitors and Google ranks HTTPS higher.",
    steps: ["Make sure the domain's SSL certificate is active in the host / domain settings.", "Force HTTPS redirects for every URL.", "Update any http:// links to images or scripts to https://.", "Re-run the audit."],
  },

  // ---------- On-page SEO ----------
  "document-title": {
    fix: "title",
    why: "The page has no <title>. The title is the blue link in Google, so without it Google guesses one.",
    steps: ["Write a title of 30–60 characters: main service + city + brand (e.g. \"Tree Removal in Molalla, OR | North Woods\").", "Set it in the page's SEO / head settings.", "Publish and re-run the audit."],
  },
  "title-length": {
    fix: "title",
    why: "The title is too short to describe the page or too long and gets cut off in Google.",
    steps: ["Rewrite it to 30–60 characters, leading with the main service and city.", "End with the brand name after a separator.", "Update it in the page's SEO settings and publish."],
  },
  "meta-description": {
    fix: "meta",
    why: "There's no meta description, so Google pulls random text for the snippet under your link.",
    steps: ["Write 140–160 characters that say what you do, where, and why to click (include the main service + city).", "Add it in the page's SEO settings as the meta description.", "Publish and re-run the audit."],
  },
  "meta-description-length": {
    fix: "meta",
    why: "The meta description is either too thin to persuade or long enough to be cut off.",
    steps: ["Rewrite to roughly 140–160 characters with the service, city and a reason to click.", "Update it in the page's SEO settings and publish."],
  },
  "h1-missing": {
    fix: "headings",
    why: "There's no main H1 heading. The H1 tells Google and visitors what the page is about.",
    steps: ["Pick the page's main heading (usually the hero headline).", "Make it an <h1> containing the main service and city.", "Keep every other heading as H2/H3.", "Publish and re-run."],
  },
  "h1-multiple": {
    fix: "headings",
    why: "More than one H1 muddies which topic the page is about.",
    steps: ["Keep one H1 (the hero headline).", "Change the other H1s to H2 without changing how they look (keep the CSS classes).", "Publish and re-run."],
  },
  "heading-order": {
    fix: "headings",
    why: "Headings skip levels (e.g. H2 straight to H4), which confuses screen readers and page structure.",
    steps: ["List the headings top to bottom.", "Make them step down one level at a time (H1 → H2 → H3).", "Change the tag only; keep the styling.", "Publish and re-run."],
  },
  "image-alt": {
    fix: "alt_text",
    why: "Images have no alt text. Google can't understand them and screen-reader users hear nothing.",
    steps: ["Find each image flagged below.", "Write a short, literal description (under 125 characters) — mention the service or place when it's genuinely in the photo.", "Leave alt=\"\" only on purely decorative images.", "Publish and re-run."],
  },
  "link-text": {
    fix: "content",
    why: "Links say things like \"click here\" or \"learn more\", which tells Google nothing about where they go.",
    steps: ["Find each flagged link.", "Rewrite the link text to describe the destination (\"See our stump grinding service\").", "Publish and re-run."],
  },
  "crawlable-anchors": {
    fix: "generic",
    why: "Some links aren't real links (no href, or JavaScript-only), so Google can't follow them.",
    steps: ["Find each flagged element.", "Use a real <a href=\"/path\"> link (React Router <Link to> renders one).", "Publish and re-run."],
  },
  "canonical": {
    fix: "canonical",
    why: "The canonical tag is invalid or conflicting, so Google may index the wrong version of the page.",
    steps: ["Set one <link rel=\"canonical\"> per page pointing at its own clean https URL.", "Make sure it isn't pointing at another domain or a redirect.", "Publish and re-run."],
  },
  "canonical-missing": {
    fix: "canonical",
    why: "No canonical tag, so duplicates (with ?utm, trailing slashes, www vs non-www) can split ranking signals.",
    steps: ["Add <link rel=\"canonical\" href=\"https://<domain>/<path>\"> to each page's head.", "Use the final https, preferred-host URL.", "Publish and re-run."],
  },
  "hreflang": {
    fix: "generic",
    why: "Language/region alternate tags are invalid, so Google may show the wrong version to searchers.",
    steps: ["Remove hreflang tags if the site is one language.", "Otherwise make each a valid language code with absolute URLs.", "Publish and re-run."],
  },
  "schema-missing": {
    fix: "schema",
    why: "No structured data. Schema tells Google (and AI answers) exactly who the business is, where, and what it offers — key for the map pack and AI Overviews.",
    steps: ["Build a LocalBusiness (or the closest subtype) JSON-LD block with the exact name, address and phone from the Google Business Profile.", "Add url, logo, openingHours, areaServed and sameAs (GBP, Facebook, Yelp).", "Paste it into the site's <head> as <script type=\"application/ld+json\">.", "Validate at validator.schema.org and Google's Rich Results Test, then re-run."],
  },
  "schema-business-missing": { alias: "schema-missing" },
  "schema-invalid": {
    fix: "schema",
    why: "A JSON-LD block has a syntax error, so Google ignores all of it.",
    steps: ["Copy each JSON-LD script into validator.schema.org.", "Fix the reported error (usually a trailing comma or unescaped quote).", "Publish and re-run."],
  },
  "structured-data": { alias: "schema-missing" },
  "open-graph-missing": {
    fix: "open_graph",
    why: "Missing Open Graph tags mean links shared on Facebook, iMessage or Slack show no image or a bad title.",
    steps: ["Add og:title, og:description, og:image (1200×630) and og:url meta tags to the head.", "Test with the Facebook Sharing Debugger.", "Publish and re-run."],
  },
  "font-size": {
    fix: "generic",
    why: "Text is too small to read on phones, which hurts mobile usability.",
    steps: ["Set body text to at least 16px on mobile.", "Check legal/footer text is at least 12px.", "Publish and re-run."],
  },
  "tap-targets": {
    fix: "generic",
    why: "Buttons and links are too small or too close together for fingers on a phone.",
    steps: ["Make tappable elements at least 48×48px.", "Add spacing between neighbouring links.", "Publish and re-run."],
  },
  "viewport": {
    fix: "generic",
    why: "The page has no mobile viewport tag, so phones render it like a zoomed-out desktop page.",
    steps: ["Add <meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"> to the head.", "Publish and re-run."],
  },

  // ---------- Performance ----------
  "largest-contentful-paint": {
    fix: "performance",
    why: "The main content (usually the hero image or headline) takes too long to appear. Google's target is under 2.5 seconds.",
    steps: ["Identify the LCP element (Lighthouse names it below).", "If it's an image: compress it, serve WebP/AVIF, size it to the display size, and add fetchpriority=\"high\" (never lazy-load it).", "Preload the hero image and the main font.", "Cut render-blocking scripts/CSS above the fold.", "Re-run the audit."],
  },
  "cumulative-layout-shift": {
    fix: "performance",
    why: "Things jump around while the page loads, which annoys visitors and counts against Core Web Vitals. Target is under 0.1.",
    steps: ["Give every image and video explicit width/height (or an aspect-ratio).", "Reserve space for banners, embeds and fonts before they load.", "Use font-display: swap with a size-matched fallback.", "Re-run the audit."],
  },
  "total-blocking-time": {
    fix: "performance",
    why: "Heavy JavaScript freezes the page so taps don't respond. This is the lab stand-in for INP.",
    steps: ["Remove unused third-party scripts (chat widgets, extra trackers).", "Lazy-load below-the-fold components and code-split big pages.", "Defer non-critical scripts.", "Re-run the audit."],
  },
  "render-blocking-resources": {
    fix: "performance",
    why: "CSS or scripts in the head stop the page from drawing until they download.",
    steps: ["Add defer/async to non-critical scripts.", "Inline the small critical CSS and load the rest later.", "Load Google Fonts with display=swap and preconnect.", "Re-run the audit."],
  },
  "unused-javascript": {
    fix: "performance",
    why: "The page downloads JavaScript it never uses, which slows every visit on mobile.",
    steps: ["Check which bundles/third parties are flagged below.", "Remove unused libraries and code-split routes.", "Re-run the audit."],
  },
  "unused-css-rules": {
    fix: "performance",
    why: "Large amounts of CSS go unused on this page.",
    steps: ["Remove unused CSS frameworks/themes.", "Make sure Tailwind purge/content paths are set.", "Re-run the audit."],
  },
  "uses-optimized-images": { alias: "modern-image-formats" },
  "uses-webp-images": { alias: "modern-image-formats" },
  "modern-image-formats": {
    fix: "performance",
    why: "Images are bigger than they need to be. Modern formats are 25–50% smaller with no visible loss.",
    steps: ["Convert the flagged images to WebP or AVIF.", "Compress to ~80% quality.", "Re-upload and update the image URLs.", "Re-run the audit."],
  },
  "uses-responsive-images": {
    fix: "performance",
    why: "Phones download desktop-sized images.",
    steps: ["Resize flagged images to the largest size they're shown at.", "Use srcset/sizes so phones get smaller files.", "Re-run the audit."],
  },
  "offscreen-images": {
    fix: "performance",
    why: "Images below the fold load immediately, competing with what the visitor actually sees first.",
    steps: ["Add loading=\"lazy\" to images below the first screen.", "Keep the hero image eager.", "Re-run the audit."],
  },
  "server-response-time": {
    fix: "performance",
    why: "The server is slow to send the first byte of the page.",
    steps: ["Check hosting region and caching (CDN in front of the site).", "Avoid redirects chains on the home URL.", "Re-run at a different time to rule out a one-off spike."],
  },
  "uses-text-compression": {
    fix: "performance",
    why: "Text files are sent uncompressed.",
    steps: ["Turn on gzip/brotli in the host or CDN.", "Re-run the audit."],
  },
  "uses-long-cache-ttl": {
    fix: "performance",
    why: "Static files aren't cached for long, so repeat visitors re-download them.",
    steps: ["Set long Cache-Control (1 year) on hashed static assets in the host/CDN.", "Re-run the audit."],
  },
  "redirects": {
    fix: "performance",
    why: "The page goes through extra redirects before loading.",
    steps: ["Link directly to the final https URL (with or without www — whichever is canonical).", "Collapse redirect chains to a single hop.", "Re-run the audit."],
  },
  "third-party-summary": { alias: "total-blocking-time" },
  "bootup-time": { alias: "total-blocking-time" },
  "mainthread-work-breakdown": { alias: "total-blocking-time" },
  "dom-size": {
    fix: "performance",
    why: "The page has a very large number of elements, which slows rendering on phones.",
    steps: ["Remove hidden/duplicate sections (e.g. separate mobile and desktop copies).", "Paginate or lazy-render long lists.", "Re-run the audit."],
  },

  // ---------- Accessibility / best practices ----------
  "color-contrast": {
    fix: "accessibility",
    why: "Some text doesn't have enough contrast against its background to be readable.",
    steps: ["Check each flagged element's text and background colours.", "Darken the text or lighten the background until it passes WCAG AA (4.5:1 for body text).", "Re-run the audit."],
  },
  "button-name": {
    fix: "accessibility",
    why: "Some buttons have no accessible name, so screen readers announce just \"button\".",
    steps: ["Add visible text or an aria-label to each flagged button (icon buttons especially).", "Re-run the audit."],
  },
  "link-name": { alias: "button-name" },
  "label": {
    fix: "accessibility",
    why: "Form fields have no label, so people using screen readers don't know what to type.",
    steps: ["Add a <label for> or aria-label to each flagged field.", "Re-run the audit."],
  },
  "html-has-lang": {
    fix: "accessibility",
    why: "The page doesn't declare its language.",
    steps: ["Add lang=\"en\" to the <html> tag.", "Re-run the audit."],
  },
  "errors-in-console": {
    fix: "generic",
    why: "The page logs JavaScript errors, which can mean something visibly broken.",
    steps: ["Open DevTools → Console on the page.", "Fix or remove the code throwing the errors.", "Re-run the audit."],
  },
  "image-aspect-ratio": {
    fix: "generic",
    why: "Some images are shown stretched or squashed.",
    steps: ["Set object-fit: cover or match the container's aspect ratio.", "Re-run the audit."],
  },
};

const GENERIC_STEPS = [
  "Open the issue details below to see the affected elements.",
  "Make the change in the site builder (Base44 sites: the page's component or head settings).",
  "Publish, then re-run the audit to confirm it cleared.",
];

const GAP_FIX = { seo: "content", website: "generic", gbp: "content", reviews: "content", brand: "content" };

export function guideFor(issue) {
  // Findings from an Intel audit (ClientGap): their own impact + recommendation are the guidance.
  if (issue.source === "intel") {
    const rec = String(issue.recommendation || "").split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
    return {
      fix: GAP_FIX[issue.area] || "generic",
      why: issue.description || issue.title,
      steps: [...(rec.length ? rec : ["Review the evidence below and decide the change."]), "Make the change, then set this finding to fixed on the client's page so it shows as done in their portal."],
    };
  }
  let g = G[issue.key];
  if (g?.alias) g = G[g.alias];
  if (g) return { ...g, why: g.why, steps: g.steps };
  return {
    fix: issue.category === "performance" ? "performance" : issue.category === "accessibility" ? "accessibility" : "generic",
    why: issue.description || "Lighthouse flagged this check as failing.",
    steps: GENERIC_STEPS,
  };
}

export const FIX_LABELS = {
  title: "New title tag",
  meta: "New meta description",
  alt_text: "Alt text for images",
  schema: "JSON-LD schema",
  headings: "Heading structure",
  content: "Rewritten copy",
  open_graph: "Open Graph tags",
  canonical: "Canonical tag",
  indexing: "Indexing fix",
  performance: "Performance fix",
  accessibility: "Accessibility fix",
  generic: "Code fix",
};
