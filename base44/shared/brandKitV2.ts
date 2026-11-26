// Brand kits v2 (Nov 25 2026): the website launch is the trigger. When a client's site is live on their own domain,
// Claude builds their brand kit from what we built (website code first, then the Command System) into the shared
// Interstellar template ("interstellar-v2", rendered by src/features/brandkit/brandKitHtml.js). Same structure for
// every client, themed by the client's own colors, fonts, corners, grid and logo. Justin approves it in Møthership
// (Clients > Brand kit), which saves it and shows it in the client's Workspace.
export const BRAND_KIT_TEMPLATE = "interstellar-v2";
export const BRAND_KIT_V2_CONTEXT = "brand_kit_v2";

export const KIT_V2_SHAPE = `{
 "template": "interstellar-v2",
 "identity": {"name": "", "tagline": "exact tagline from the site", "one_liner": "one sentence from site copy", "industry": "", "location": "", "service_area": "", "domain": ""},
 "logo": {"primary_url": "absolute https URL", "mark_url": "", "on_dark_url": "", "on_light_url": "", "designed_for": "dark|light", "wordmark_text": "", "notes": ""},
 "theme": {"mode": "dark|light", "bg": "#hex", "surface": "#hex", "ink": "#hex", "muted": "#hex", "hairline": "#hex", "accent": "#hex", "accent_2": "#hex", "gradient": "css gradient if the site uses one"},
 "palette": [{"name": "", "hex": "#RRGGBB", "role": "primary|accent|ink|surface|muted|support", "usage": ""}],
 "typography": {"display": {"family": "", "weights": [700], "google_css_url": "https://fonts.googleapis.com/css2?...", "case": "upper|title|normal", "tracking": "-0.03em", "fallback": "sans-serif"}, "body": {}, "utility": {}, "headings": "same object as display (older readers use it)"},
 "shape": {"radius_px": 0, "button_radius_px": 0, "card_radius_px": 0, "border": "hairline|bold|none", "motif": "corner-brackets|grid|crosshair|none", "motif_notes": "", "texture": ""},
 "components": {"button_primary": {"bg": "", "fg": "", "radius_px": 0, "case": "upper|normal", "notes": ""}, "button_secondary": {"bg": "", "fg": "", "border": ""}, "eyebrow": {"style": ""}, "card": {"bg": "", "border": "", "radius_px": 0}},
 "voice": {"traits": [{"name": "", "desc": ""}], "we_say": [], "we_avoid": [], "sample_lines": []},
 "messaging": {"elevator_pitch": "", "services": [{"name": "", "line": ""}], "ctas": [], "proof": ["only real items shown on the site"], "headlines": []},
 "imagery": {"style": [], "photos": [{"url": "absolute https URL used on the site", "caption": ""}]},
 "contact": {"phone": "", "email": "", "address": "", "hours": ""}
}`;

export function brandKitV2Brief(client: Record<string, any>) {
  const domain = client.website_domain || client.domain || "";
  return `# Brand kit (website launched): ${client.business}

${client.business}'s website is live${domain ? ` on ${domain}` : ""}. Build their brand kit from what we built, in the Interstellar brand kit template.

## Where the brand lives
- Website app: ${client.site_app_id || "find it with list_user_apps by the business name"} (read only)
- Command System app: ${client.command_app_id || "none on file"} (read only)
Read the website source first: tailwind config, index.css/globals.css (CSS variables, fonts), index.html (Google Fonts), header/nav, home page hero, footer, logo files. Then the Command System for anything missing. Match it exactly: colors, fonts, letter-spacing, corner radius, borders, grid backgrounds, corner brackets, button shapes, label style. The kit must look like their site.

## Produce
result_data = { "brand_kit": <JSON below> } with template "interstellar-v2". Real values only: hex from the code, real Google Fonts URLs, logo and photo URLs actually used on the site (absolute https), copy taken from the site. Never invent stats, reviews, awards, prices or testimonials; leave a field empty instead and list it in needs_from_justin.
\`\`\`json
${KIT_V2_SHAPE}
\`\`\`
result_summary = one sentence on the look (base, accent, type pairing).
Do NOT write a BrandKit record; approving this job in Møthership saves it and shows it in the client's Workspace.
When finished: status = needs_approval, finished_at = now.`;
}
