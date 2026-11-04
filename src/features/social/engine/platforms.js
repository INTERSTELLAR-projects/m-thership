// Content engine: the 13 platforms, their formats, ratios, limits, register, search rules, default posting windows
// and the real publishing path for each. Mirrors base44/shared/channels.ts (adapters) — keep the two in sync.
// Posting windows and daily limits are STARTING POINTS to test, editable in Schedule settings; not data.

export const RATIOS = {
  square: { w: 1080, h: 1080, label: "1:1", name: "Square" },
  ig_feed: { w: 1080, h: 1350, label: "4:5", name: "Feed portrait" },
  story: { w: 1080, h: 1920, label: "9:16", name: "Story / Reel / Short" },
  yt_thumb: { w: 1280, h: 720, label: "16:9", name: "YouTube thumbnail" },
  wide: { w: 1600, h: 900, label: "16:9", name: "Landscape" },
  pin: { w: 1000, h: 1500, label: "2:3", name: "Pin" },
  gbp: { w: 1200, h: 900, label: "4:3", name: "Google Business Profile" },
  doc: { w: 1080, h: 1350, label: "4:5 PDF", name: "LinkedIn document" },
};

const S = (k) => `SOCIAL_${k}`;

export const PLATFORMS = [
  {
    key: "instagram", label: "Instagram", short: "IG", text_max: 2200, hashtags: [3, 5],
    formats: [
      { key: "feed", label: "Feed 4:5", ratio: "ig_feed" },
      { key: "carousel", label: "Carousel 4:5", ratio: "ig_feed", slides: true },
      { key: "story", label: "Story 9:16", ratio: "story" },
      { key: "reel", label: "Reel cover + script", ratio: "story", video: true, manual: true },
    ],
    default_formats: ["feed"],
    register: "Casual and warm. Keyword-first hook line, 2-4 short lines, a clear CTA, then 3-5 specific hashtags.",
    search: "First caption line = the search phrase. Alt text names what's in the image + the keyword. Max 5 hashtags.",
    windows: ["09:00", "12:00", "18:00"], limit: 2,
    path: { mode: "auto", how: "Instagram Business connector (shared, Interstellar). Clients: their IG through Facebook partner access once instagram_content_publish is added to the Facebook Pages connector.", connector: "instagram", scopes: ["instagram_business_basic", "instagram_business_content_publish", "instagram_business_manage_insights", "instagram_business_manage_comments"] },
    open: "https://www.instagram.com/",
    notes: "Reels need a real video: render the cover, film it, post in the app, then Mark posted.",
  },
  {
    key: "facebook", label: "Facebook", short: "FB", text_max: 63206, hashtags: [0, 5],
    formats: [{ key: "feed", label: "Post 4:5", ratio: "ig_feed" }, { key: "carousel", label: "Multi-photo", ratio: "ig_feed", slides: true }, { key: "story", label: "Story 9:16", ratio: "story", manual: true }],
    default_formats: ["feed"],
    register: "Conversational and neighbourly. No links in the copy body for reach, minimal caps, at most 5 hashtags.",
    search: "Keyword early in the first line. No engagement bait. Original images only.",
    windows: ["08:30", "13:00"], limit: 2,
    path: { mode: "auto", how: "Facebook Pages connector (shared). Client Pages work once the client gives Interstellar Page access (partner).", connector: "facebook_pages", scopes: ["pages_show_list", "pages_manage_posts", "pages_read_engagement", "read_insights", "business_management"] },
    open: "https://www.facebook.com/",
  },
  {
    key: "youtube", label: "YouTube", short: "YT", text_max: 5000, title_max: 100, hashtags: [0, 3],
    formats: [{ key: "video", label: "Long video: thumbnail + script", ratio: "yt_thumb", video: true }, { key: "short", label: "Short: cover + script", ratio: "story", video: true }],
    default_formats: ["short"],
    register: "Scripted. Title = the search phrase. Spoken hook in the first 3 seconds, then the payoff, then one CTA.",
    search: "Search phrase in the title and first line of the description; say it in the first 3 seconds; up to 3 hashtags.",
    windows: ["15:00"], limit: 1,
    path: { mode: "manual", how: "Upload in YouTube Studio (needs the real video). Connect the YouTube connector so views/likes come back.", connector: "youtube", scopes: ["https://www.googleapis.com/auth/youtube.readonly"] },
    open: "https://studio.youtube.com/",
  },
  {
    key: "linkedin", label: "LinkedIn", short: "IN", text_max: 3000, hashtags: [0, 3],
    formats: [{ key: "post", label: "Post 1:1", ratio: "square" }, { key: "document", label: "Document (PDF carousel)", ratio: "doc", slides: true, pdf: true }],
    default_formats: ["post"],
    register: "Professional and reflective. Hook that stands alone above the fold, short paragraphs, one takeaway, soft CTA. 0-3 hashtags.",
    search: "Keyword in the hook line. Expertise over hype.",
    windows: ["08:00", "12:00"], limit: 1,
    path: { mode: "auto", how: "LinkedIn connector (shared, Interstellar). Personal: w_member_social. Company page: w_organization_social (Community Management API approval). Clients: manual.", connector: "linkedin", scopes: ["openid", "profile", "email", "w_member_social", "w_organization_social", "r_organization_social"] },
    open: "https://www.linkedin.com/feed/",
  },
  {
    key: "tiktok", label: "TikTok", short: "TT", text_max: 4000, title_max: 90, hashtags: [3, 5],
    formats: [{ key: "video", label: "Video cover + script", ratio: "story", video: true }],
    default_formats: ["video"],
    register: "Fast and native. Say the keyword in the first 3 seconds, on-screen text, captions on, one idea.",
    search: "Keyword in the caption, on-screen title and first spoken line.",
    windows: ["11:00", "19:00"], limit: 1,
    path: { mode: "manual", how: "Post in the TikTok app. The TikTok connector reads profile + video stats (and can send videos to the inbox); photo posts need a verified media domain and an audited app.", connector: "tiktok", scopes: ["user.info.basic", "user.info.stats", "video.list", "video.upload"] },
    open: "https://www.tiktok.com/upload",
  },
  {
    key: "threads", label: "Threads", short: "TH", text_max: 500, hashtags: [0, 1],
    formats: [{ key: "post", label: "Post 4:5", ratio: "ig_feed" }],
    default_formats: ["post"],
    register: "Punchy and conversational. One thought, a question or a take. 500 characters max, one topic tag at most.",
    search: "Keyword early; one topic tag.",
    windows: ["10:00", "17:00"], limit: 3,
    path: { mode: "auto", how: "Meta Threads API with a long-lived token in a Base44 Secret (refresh every ~60 days).", secrets: [S("THREADS_TOKEN_<BRAND>")], scopes: ["threads_basic", "threads_content_publish", "threads_manage_insights"] },
    open: "https://www.threads.net/",
  },
  {
    key: "x", label: "X", short: "X", text_max: 280, hashtags: [0, 2],
    formats: [{ key: "post", label: "Post 16:9", ratio: "wide" }],
    default_formats: ["post"],
    register: "Punchy. One sharp line or a short list. 280 characters. 0-2 hashtags.",
    search: "Lead with the keyword or the take.",
    windows: ["09:00", "13:00", "17:30"], limit: 3,
    path: { mode: "auto", how: "X connector (shared-only, Interstellar; every API call uses Base44 integration credits). Clients: manual.", connector: "x", scopes: ["tweet.read", "tweet.write", "users.read", "media.write", "offline.access"] },
    open: "https://x.com/compose/post",
  },
  {
    key: "pinterest", label: "Pinterest", short: "PI", text_max: 500, title_max: 100, hashtags: [0, 0],
    formats: [{ key: "pin", label: "Pin 2:3", ratio: "pin" }],
    default_formats: ["pin"],
    register: "Search-first and evergreen. Title = what someone would search; description with 2-3 natural keywords; link to the page.",
    search: "Keyword-first title and description; no hashtags needed.",
    windows: ["20:00"], limit: 3,
    path: { mode: "auto", how: "Pinterest API v5 with a token in a Base44 Secret + board id. Trial-tier apps create sandbox pins only you can see: apply for Standard access.", secrets: [S("PINTEREST_TOKEN_<BRAND>")], scopes: ["boards:read", "pins:read", "pins:write", "user_accounts:read"] },
    open: "https://www.pinterest.com/pin-creation-tool/",
  },
  {
    key: "gbp", label: "Google Business Profile", short: "GBP", text_max: 1500, hashtags: [0, 0],
    formats: [{ key: "update", label: "Update 4:3", ratio: "gbp" }],
    default_formats: ["update"],
    register: "Local and helpful. Service + city keyword, what's new, one CTA. No phone number, no street address, no bare URL in the copy: the Learn more button carries the plain link (no UTM).",
    search: "Service + city keyword in the first sentence.",
    windows: ["10:00"], limit: 1,
    path: { mode: "manual", how: "Business Profile API access is pending Google's approval. Post from the profile, then Mark posted." },
    open: "https://business.google.com/",
  },
  {
    key: "discord", label: "Discord", short: "DC", text_max: 2000, hashtags: [0, 0],
    formats: [{ key: "message", label: "Message + image 16:9", ratio: "wide" }],
    default_formats: ["message"],
    register: "Community voice. Talk to members directly, no hashtags, invite replies.",
    search: "Not searchable outside the server: skip keywords and hashtags.",
    windows: ["17:00"], limit: 2,
    path: { mode: "auto", how: "Channel webhook URL stored in a Base44 Secret (Server Settings → Integrations → Webhooks).", secrets: [S("DISCORD_WEBHOOK_<BRAND>")] },
    open: "https://discord.com/app",
  },
  {
    key: "telegram", label: "Telegram", short: "TG", text_max: 4096, hashtags: [0, 2],
    formats: [{ key: "post", label: "Channel post 1:1", ratio: "square" }],
    default_formats: ["post"],
    register: "Direct and newsy. Short paragraphs; captions under 1,024 characters when there's an image.",
    search: "Telegram search reads channel names more than posts: keep the brand name exact.",
    windows: ["08:00"], limit: 2,
    path: { mode: "auto", how: "One Interstellar bot token in a Base44 Secret; add the bot as admin (Post messages) of each channel; channel @name on the account.", secrets: [S("TELEGRAM_BOT_TOKEN")] },
    open: "https://web.telegram.org/",
  },
  {
    key: "reddit", label: "Reddit", short: "RD", text_max: 40000, title_max: 300, hashtags: [0, 0],
    formats: [{ key: "post", label: "Text post (+ image 1:1)", ratio: "square" }],
    default_formats: ["post"],
    register: "Genuinely useful, no marketing tone. Title as a question or a clear claim; value first; disclose who you are. No hashtags.",
    search: "Title = the question people search on Google + Reddit.",
    windows: ["07:30"], limit: 1,
    path: { mode: "manual", how: "Self-promotion is restricted in most subreddits: post by hand, following that sub's rules. Auto only in a subreddit you own, with an approved Reddit app (Responsible Builder Policy, Nov 2025).", secrets: [S("REDDIT_CLIENT_ID"), S("REDDIT_CLIENT_SECRET"), S("REDDIT_USERNAME"), S("REDDIT_PASSWORD")], scopes: ["submit", "read", "identity"] },
    open: "https://www.reddit.com/submit",
  },
  {
    key: "whatsapp", label: "WhatsApp Channel", short: "WA", text_max: 1024, hashtags: [0, 0],
    formats: [{ key: "update", label: "Channel update 1:1", ratio: "square" }],
    default_formats: ["update"],
    register: "Short and personal, like a note to followers. One idea, one link at most.",
    search: "Not searchable: skip keywords.",
    windows: ["12:30"], limit: 1,
    path: { mode: "manual", how: "WhatsApp Channels have no official posting API (the Cloud API messages people, not Channels). Post from the app, then Mark posted." },
    open: "https://web.whatsapp.com/",
  },
];

export const PLATFORM = Object.fromEntries(PLATFORMS.map((p) => [p.key, p]));
export const platformLabel = (k) => PLATFORM[k]?.label || k;
export const formatOf = (platform, format) => PLATFORM[platform]?.formats.find((f) => f.key === format) || PLATFORM[platform]?.formats[0];

export const MODE_LABEL = { auto: "Auto", needs_connection: "Needs connection", manual: "Manual" };
export const MODE_TONE = {
  auto: "border-ink bg-ink text-white",
  needs_connection: "border-[#ff6a00]/60 bg-[#ff6a00]/10 text-[#c44a00]",
  manual: "border-hair text-ink/60",
};

/** Default secret name for a brand, e.g. SOCIAL_DISCORD_WEBHOOK_SUMMIT_ROOFING. */
export function defaultSecretName(platform, brandSlug) {
  const slug = String(brandSlug || "INTERSTELLAR").toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 30) || "BRAND";
  if (platform === "discord") return `SOCIAL_DISCORD_WEBHOOK_${slug}`;
  if (platform === "threads") return `SOCIAL_THREADS_TOKEN_${slug}`;
  if (platform === "pinterest") return `SOCIAL_PINTEREST_TOKEN_${slug}`;
  if (platform === "telegram") return "SOCIAL_TELEGRAM_BOT_TOKEN";
  if (platform === "reddit") return "SOCIAL_REDDIT";
  return "";
}
