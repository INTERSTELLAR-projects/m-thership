// Content pipeline: the client websites it may publish to (docs/content-pipeline.md).
// One entry per client WEBSITE app. A site is only used when it is listed here with enabled: true AND the client's
// CRMClient.site_app_id is this app id. Every request to a site is signed with that site's OWN key: the Møthership secret
// named in key_secret (e.g. CONTENT_PUBLISH_KEY_REDLINE) holds the same value as CONTENT_PUBLISH_KEY on that website.
// One key per client, so a leaked key can only ever reach one site.
// Nothing here is a secret: the IndexNow key is public by design (it is served as a file on the site).
// deno-lint-ignore-file no-explicit-any

export type KindConfig = {
  entity: string;            // entity on the website
  path: (slug: string) => string; // live path for a record
  min_words: number;         // minimum words in the main text (overview / quote)
  min_photos?: number;
  max_photos?: number;
  needs_feature_ok?: boolean; // projects: the client ticked "OK to feature on the website"
  needs_consent?: boolean;    // testimonials: the customer agreed to be published
  verify_ld?: string;         // JSON-LD @type the live page must carry
};

export type SiteConfig = {
  app_id: string;
  name: string;              // brand name as shown on the site
  origin: string;            // https://domain (no trailing slash)
  host: string;              // bare host sent in every signed body
  endpoint: string;          // the site's content-publish function on its live domain
  key_secret: string;        // NAME of the Møthership secret holding this site's publish key (never the value)
  sitemap: string;           // the live sitemap function
  enabled: boolean;
  footprint: "local" | "regional" | "national" | "hybrid";
  owner_name: string;        // who made the work (photographer, contractor)
  indexnow: { key: string; key_location: string } | null;
  daily_limit: number;
  weekly_limit: number;
  kinds: Record<string, KindConfig>;
  // Fallback lists when the site's catalog call can't be made. The live catalog always wins.
  default_categories: string[];
  default_project_types: string[];
  writer_rules: string[];    // site-specific writing rules added to the writer prompt
};

export const CONTENT_SITES: Record<string, SiteConfig> = {
  // Redline Visuals (pilot). Albums at /portfolio/:slug, testimonials on /reviews.
  "6adffa88adfd08887c3645c7": {
    app_id: "6adffa88adfd08887c3645c7",
    name: "Redline Visuals",
    origin: "https://redline-visuals.com",
    host: "redline-visuals.com",
    endpoint: "https://redline-visuals.com/functions/content-publish",
    key_secret: "CONTENT_PUBLISH_KEY_REDLINE",
    sitemap: "https://redline-visuals.com/functions/sitemap",
    enabled: true,
    footprint: "national",
    owner_name: "Jacob Mercer",
    indexnow: null, // no IndexNow key file on the site yet: reported as not_supported
    daily_limit: 5,
    weekly_limit: 20,
    kinds: {
      project: { entity: "Album", path: (slug) => `/portfolio/${slug}`, min_words: 12, min_photos: 3, max_photos: 150, needs_feature_ok: true, verify_ld: "ImageGallery" },
      testimonial: { entity: "Review", path: () => "/reviews", min_words: 8, needs_consent: true },
    },
    default_categories: ["Automotive", "Motorsport", "Aviation", "Events", "Landscape & Travel", "Documentary & Photojournalism", "Design & Concept"],
    default_project_types: ["Build Documentation", "Brand Activation", "Event Coverage", "Race Coverage", "Commercial Campaign", "Editorial Feature"],
    writer_rules: [
      "Redline Visuals is Jacob Mercer's photo and video brand, based in Savannah, GA and positioned as a national and global brand. Angle the copy on the subject (the car, aircraft, event or brand) and the venue, not on 'near me' local wording.",
      "Write in a confident, cinematic, plain-spoken voice. No hype words like 'stunning', 'breathtaking', 'epic' or 'world-class'.",
      "Never state what is visible in the photos (colors, poses, weather, scenery) unless the submission says it: you cannot see the photos.",
    ],
  },
};

export const siteFor = (appId: string) => CONTENT_SITES[String(appId || "").trim()] || null;
