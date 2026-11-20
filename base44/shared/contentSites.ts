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
  // Which writer + record shape the site takes: "album" (Redline Album, the default) or "door_project" (PowerLift
  // ContentProject: door specs, city/state, story, optional verbatim testimonial).
  profile?: "album" | "door_project";
  // Default for automatic posting. Justin can override it per site on Møthership → Client posts (ContentSiteSetting).
  // Off, or any failed publish, puts the submission in the manual queue ("Build page manually") and emails Justin.
  auto_publish: boolean;
  live_check_note?: string;  // shown on Client posts next to the site
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
    // Key file public/09a575c685c0237ac17c7170b6455054.txt ships in the site checkpoint of 2026-11-19; IndexNow accepts
    // pings once that checkpoint is published (before that a ping is just refused and logged on the ContentPost).
    indexnow: { key: "09a575c685c0237ac17c7170b6455054", key_location: "https://redline-visuals.com/09a575c685c0237ac17c7170b6455054.txt" },
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
    auto_publish: true,
  },
  // PowerLift Doors of Oregon. Door install projects at /projects/:slug (ContentProject, merged with the built-in
  // projects). Projects only: /reviews shows Google Business Profile reviews only, so a customer's quote (verbatim,
  // consent required) travels with its project and shows on that project page.
  // Endpoint: the function's platform URL works as soon as the function is saved; the custom-domain URL
  // (https://oregonpowerlift.com/functions/content-publish) works after the site is published.
  "6a88eef3dc9768005ce14d52": {
    app_id: "6a88eef3dc9768005ce14d52",
    name: "PowerLift Doors of Oregon",
    origin: "https://oregonpowerlift.com",
    host: "oregonpowerlift.com",
    endpoint: "https://base44.app/api/apps/6a88eef3dc9768005ce14d52/functions/content-publish",
    key_secret: "CONTENT_PUBLISH_KEY_POWERLIFT",
    sitemap: "https://oregonpowerlift.com/functions/sitemap",
    enabled: true,
    footprint: "regional",
    owner_name: "PowerLift Doors of Oregon",
    // Key file public/181cc819022b4b5eb681b0e0f729c525.txt ships in the site checkpoint of 2026-11-19; IndexNow accepts
    // pings once that checkpoint is published (before that a ping is just refused and logged on the ContentPost).
    indexnow: { key: "181cc819022b4b5eb681b0e0f729c525", key_location: "https://oregonpowerlift.com/181cc819022b4b5eb681b0e0f729c525.txt" },
    daily_limit: 5,
    weekly_limit: 20,
    profile: "door_project",
    auto_publish: true,
    live_check_note: "Project pages and /functions/sitemap need one site publish before the live check can pass",
    kinds: {
      project: { entity: "ContentProject", path: (slug) => `/projects/${slug}`, min_words: 12, min_photos: 3, max_photos: 40, needs_feature_ok: true, verify_ld: "CreativeWork" },
    },
    default_categories: ["Aircraft Hangar", "Agricultural", "Architectural", "Commercial", "Concealed Cylinder", "Shop & Garage"],
    default_project_types: ["aviation", "agricultural", "commercial", "residential", "architectural"],
    writer_rules: [
      "PowerLift Doors of Oregon designs, builds and installs PowerLift hydraulic doors from its shop in Beavercreek, OR, serving Oregon, Western Idaho and SW Washington. Angle the copy on the door (size, system, use) and the city it was installed in.",
      "Facts come ONLY from the submission: never invent or estimate door sizes, weights, prices, timelines, install days, wind ratings, building details or results. If the submission doesn't say it, leave it out.",
      "Never name the customer or describe their property beyond what the story says. Never give a street address.",
      "Plain, confident, practical voice for hangar, shop and farm owners. No hype words like 'stunning', 'game-changer' or 'world-class'.",
      "Never state what is visible in the photos unless the submission says it: you cannot see the photos.",
    ],
  },
};

export const siteFor = (appId: string) => CONTENT_SITES[String(appId || "").trim()] || null;
