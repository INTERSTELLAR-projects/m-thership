// Where each client's blog lives on its Base44 website, and exactly how an approved post is written there.
// Audited Nov 4, 2026 from each site app's entity schemas and code. The queue runner (a Claude scheduled task with
// the Base44 tools) does the writing; the browser never writes into another app.
//   mode "entity": create one record in the site app's blog entity (live the moment it is saved as published).
//   mode "file":   the site keeps posts in a JSON file and must be checkpointed + deployed (Mow Masters).
// live:false = the new site isn't serving the domain yet; the engine does not publish there until it is.
// A post is only ever recorded as published after Claude sees it on the live blog index (verify step).

export const BLOG_SITES = {
  // Palm Shore Hardscapes · BlogPost { title, slug, cover_image, cover_alt, date, read_time, featured, excerpt,
  // content (HTML), seo_title, seo_description, faqs[{question, answer}], faq_schema, published }
  "6a7e0ed45a3ed5aeb6868401": {
    live: true, app_id: "6ad6656739d901d4b84d43bb", mode: "entity", entity: "BlogPost", domain: "palmshorehardscapes.com", blog_index: "https://palmshorehardscapes.com/blog",
    fields: "title, slug, excerpt, content (HTML), cover_image, cover_alt, date (YYYY-MM-DD), read_time ('6 min read'), seo_title, seo_description, faqs [{question, answer}], faq_schema (FAQPage JSON-LD string), featured false, published true",
  },
  // Velocity Business Solutions · BlogPost { title, slug, excerpt, body (HTML), category enum, author, published_date,
  // cover_image, read_time, tags, featured, related_posts, faqs, seo_title, meta_description, og_image, indexable, schema_jsonld }
  "6a6c13fd03bab4ff324fce0a": {
    live: true, app_id: "6a9f090a5efd129c938b4139", mode: "entity", entity: "BlogPost", domain: "govelocity.com", blog_index: "https://govelocity.com/blog",
    fields: "title, slug, excerpt, body (HTML), category (one of: Industry News, Payments, POS & Hardware, Pricing & Savings, Guides, Company), author 'Velocity Business Solutions', published_date (YYYY-MM-DD; this is what makes it visible), cover_image, read_time, tags, faqs [{question, answer}], seo_title, meta_description, indexable true, schema_jsonld",
  },
  // Arcane Ink · Post { title, slug, excerpt, body (HTML), cover_image, cover_alt, published_date, content_updated,
  // category, tags, service, city, faqs, author, published, meta_title, meta_description }
  "69d884d3aa7b854da8a12614": {
    live: true, app_id: "6ad812b1497f8aa46878f75c", mode: "entity", entity: "Post", domain: "arcaneinkriverside.com", blog_index: "https://arcaneinkriverside.com/blog",
    fields: "title, slug, excerpt, body (HTML), cover_image, cover_alt, published_date, content_updated, category, tags, service, city, faqs [{question, answer}], author, meta_title, meta_description, published true. Phone in any copy: (951) 224-9177 only.",
  },
  // Mow Masters of Ascension · src/lib/posts.json + scripts (npm run blog), checkpoint, deploy.
  "69d884d3501897bd1df0794c": {
    live: true, app_id: "6ad15b374013f4b32c9e0dbf", mode: "file", entity: "src/lib/posts.json", domain: "mowmastersofascension.com", blog_index: "https://quixotic-mow-master-pro.base44.app/blog",
    fields: "Follow the mowmasters-blog skill (posts.json schema, npm run blog linker + checks, eslint + vite build, checkpoint 'Blog: <title>', deploy that checkpoint, IndexNow). Never skip the checks.",
  },
  // Sites still moving to Base44 (engine publishes here once live: true via AppSettings launch_facts).
  "6a39ca29c61bf8a49ef76324": { live: false, app_id: "6adffb06ba5d498a8bc187ef", mode: "entity", entity: "BlogPost", domain: "royalzbarbers.com" },
  "69d884d3dd31b39b6a77c7cd": { live: false, app_id: "6adff7f3ca971053f1a61299", mode: "entity", entity: "BlogPost", domain: "chasinggains.net" },
  "69d884d30f93ad2e14bbbeb3": { live: false, app_id: "6adffa88adfd08887c3645c7", mode: "entity", entity: "BlogPost", domain: "redline-visuals.com" },
  "6a39e2026c54d9a15b5caf25": { live: false, app_id: "6ad91de66b7d845b8d9f61b6", mode: "entity", entity: "Post", domain: "takerein.com" },
  "69d884d38fe4bacbc82853ac": { live: false, app_id: "6ada89d4b43ce0a3b309bdd4", mode: "file", entity: "", domain: "nwtreeremoval.com" },
  "6a6c13548653b2e1e6c3de46": { live: false, app_id: "6a88eef3dc9768005ce14d52", mode: "file", entity: "", domain: "oregonpowerlift.com" },
  "69d884d3049d808969e477d1": { live: false, app_id: "6adff6c67611f68976c4f3ad", mode: "file", entity: "", domain: "musclementorcoaching.com" },
  "6a28bfea1bde8e3ea488f04d": { live: false, app_id: "6ae00354a339c9f27e784852", mode: "file", entity: "", domain: "bobablasticmolalla.com" },
  "6a3c9320b05f612c08347d74": { live: false, app_id: "6ae00af8af9f9124ad5c0b14", mode: "", entity: "", domain: "thebulbabros.com" },
  "69d884d4293101b78d2939cf": { live: false, app_id: "6ae012f4d4a8b795dcc349bf", mode: "", entity: "", domain: "smplsocial.io" },
};

export const blogSiteOf = (clientId, facts) => {
  const base = BLOG_SITES[clientId] || null;
  const f = facts && facts[clientId];
  if (!base) return null;
  // launch_facts can flip a site live (and override the entity) after a cutover without a code change.
  return f && typeof f.live === "boolean" ? { ...base, live: f.live && base.live !== undefined ? f.live : base.live } : base;
};

// The publish + verify instructions every scheduled blog job carries.
export function publishSteps(site) {
  if (!site || !site.app_id) return ["This client's site has no blog collection yet: draft only and put \"Blog collection missing\" in needs_from_justin."];
  const common = [
    `After publishing, VERIFY: open ${site.blog_index || `https://${site.domain}/blog`} (WebFetch; use a headless browser if the page is a JavaScript shell) and confirm the new post's title or /blog/<slug> link is on the index, then open the post URL itself.`,
    "Only when you saw it live: set context.publish_state \"verified_live\", context.live_url and context.verified_live_at, and update the matching TopicCalendar topic (state verified_live, live_url, verified_live_at). Then create one WorkLog {client_id, client_name, kind \"blog\", title, url, date today, status \"live\", source \"claude\", portal_visible true, verified_live true}.",
    "If it is not visible yet: set context.publish_state \"published_unverified\" and leave the WorkLog for the next run (the queue runner re-checks unverified posts every run). Never write a WorkLog, a calendar row or a report that calls an unverified post published.",
  ];
  if (site.mode === "file") {
    return [
      `Publish into Base44 app ${site.app_id} (${site.domain}): ${site.fields || "follow the site's blog procedure (its README / scripts), then lint, vite build, create_checkpoint 'Blog: <title>' and deploy that checkpoint with POST /api/apps/{app_id}/deploy."}`,
      ...common,
    ];
  }
  return [
    `Publish into Base44 app ${site.app_id} (${site.domain}) with create_entities on entity ${site.entity}. Fields: ${site.fields || "match the existing records exactly (query 3 recent ones first)"}.`,
    "Before writing, query the 3 newest records of that entity and match their format (HTML vs markdown, image hosts, category values). The slug must not exist yet.",
    ...common,
  ];
}
