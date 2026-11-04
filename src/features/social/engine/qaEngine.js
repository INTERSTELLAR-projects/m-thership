// QA-mode fixtures for the content engine (preview sandbox with ?qa=1 only, via src/lib/qa.js). Fake data so the
// UI can be reviewed; nothing here is real and nothing is posted.

const at = (days, hourUtc) => { const d = new Date(); d.setUTCDate(d.getUTCDate() + days); d.setUTCHours(hourUtc, 0, 0, 0); return d.toISOString(); };
const IDEA = "qa_idea1";

const extraction = {
  summary: "Most service businesses lose leads in the hours before anyone calls back, not on the website. A faster first reply fixes more than a redesign.",
  primary_keyword: "slow lead follow-up",
  secondary_keyword: "missed calls small business",
  triple_hooks: [
    { context: "Slow lead follow-up is costing your service business jobs.", lean: "And it isn't happening where you think.", snapback: "Your website is fine. The leak is the four hours before anyone calls back.", full: "Slow lead follow-up is costing your service business jobs. And it isn't happening where you think. Your website is fine. The leak is the four hours before anyone calls back." },
    { context: "Here's how to fix slow lead follow-up without hiring.", lean: "Most owners reach for a new website first.", snapback: "But the fix is a reply that goes out while you're still on the job.", full: "Here's how to fix slow lead follow-up without hiring. Most owners reach for a new website first. But the fix is a reply that goes out while you're still on the job." },
    { context: "Missed calls are the most expensive part of a small business.", lean: "You can see them in your call log every week.", snapback: "What you can't see is who booked your competitor instead.", full: "Missed calls are the most expensive part of a small business. You can see them in your call log every week. What you can't see is who booked your competitor instead." },
  ],
  hooks: ["Slow lead follow-up is the leak nobody audits", "Why your website isn't the reason leads go cold", "The first reply wins the job", "How to answer every lead while you're on a roof", "Missed calls: where small businesses lose the week"],
  quotes: ["The leak is the four hours before anyone calls back.", "The first business to reply usually gets the job."],
  carousel: { title: "Fix slow lead follow-up", slides: [
    { heading: "Slow follow-up costs jobs", body: "Not your website. The hours before anyone calls back." },
    { heading: "Where leads go cold", body: "Forms at night, missed calls on the job, DMs nobody checks." },
    { heading: "Reply in minutes, not hours", body: "An instant text back buys you time to call properly." },
    { heading: "One pipeline for every lead", body: "Calls, forms and DMs land in one place with a next step." },
    { heading: "Book a free strategy call", body: "We map where your leads leak in 30 minutes." },
  ] },
  clips: [
    { start: "0:12", end: "0:41", label: "The 4-hour leak", hook: "Your website isn't the problem", why: "Contrarian opener, stands alone" },
    { start: "1:05", end: "1:38", label: "Instant text back", hook: "Reply while you're on the job", why: "Practical, saveable" },
  ],
  visual: { eyebrow: "Lead follow-up", headline: "Slow lead follow-up is costing you jobs", accent_word: "costing you jobs", subhead: "The leak is the hours before anyone calls back.", cta: "Book a free strategy call" },
  ideas_next: ["What an instant text-back says", "Missed-call audit in 10 minutes"],
};

const idea = {
  id: IDEA, brand_key: "interstellar", title: "Slow lead follow-up is the real leak", status: "drafted", source_type: "transcript",
  source_text: "…", transcript_segments: [{ start: 0, end: 12, text: "intro" }, { start: 12, end: 41, text: "the leak" }, { start: 65, end: 98, text: "text back" }],
  extraction, design: { template: "quote_hook", spec: { eyebrow: "Lead follow-up", headline: "Slow lead follow-up is costing you jobs", accent_word: "costing you jobs", body: "And it isn't happening where you think. The leak is the hours before anyone calls back.", theme: "dark", lockup: "interstellar", cta: "Book a free strategy call" } },
  created_date: at(0, 16),
};

const v = (id, platform, format, ratio, extra = {}) => ({ id, idea_id: IDEA, brand_key: "interstellar", platform, format, ratio, status: "draft", mode: "manual", hook_check: {}, needs_image: true, created_date: at(0, 16), ...extra });
const T = extraction.triple_hooks[0].full;

export const QA_ENGINE = {
  SocialIdea: [idea],
  SocialVariant: [
    v("qa_v1", "instagram", "feed", "ig_feed", { account_id: "qa_a_ig", account_label: "@interstellarstrategies", mode: "auto", text: `${T}\n\nAn instant text-back buys you time to call properly.\n\nBook a free strategy call. Link in bio.\n\n#smallbusiness #servicebusiness #leadfollowup #interstellarstrategies`, alt_text: "Dark card reading slow lead follow-up is costing you jobs", hook_check: { context: true, lean: true } }),
    v("qa_v2", "linkedin", "document", "doc", { account_id: "qa_a_li", account_label: "Company page", mode: "needs_connection", text: "Slow lead follow-up is costing service businesses jobs.\n\nMost owners think the fix is a new website. It usually isn't.\n\nThe leak is the hours between a form fill and the first call back.\n\nFive slides on where leads go cold and what to do about it.\n\n#smallbusiness #leadgeneration" }),
    v("qa_v3", "x", "post", "wide", { account_id: "qa_a_x", account_label: "@interstellar", mode: "needs_connection", text: "Slow lead follow-up costs more jobs than a bad website.\n\nThe leak is the 4 hours before anyone calls back." }),
    v("qa_v4", "gbp", "update", "gbp", { text: "Slow lead follow-up is the most common leak we find in local service businesses. Ask us how an instant text-back keeps new leads warm while your crew is on the job." }),
    v("qa_v5", "discord", "message", "wide", { account_id: "qa_a_dc", account_label: "Interstellar community", mode: "auto", text: "New this week: where service businesses lose leads (hint: it's not the website). What's your average time to first reply? Tell us below." }),
    v("qa_v6", "youtube", "short", "story", { title: "Slow lead follow-up: the real leak", text: "Slow lead follow-up costs more jobs than your website.\n\nFull breakdown on the channel.\n\n#shorts #smallbusiness", script: "[ON-SCREEN] Slow lead follow-up\nSlow lead follow-up is costing you jobs. And it isn't where you think. Your website is fine: the leak is the four hours before anyone calls back…" }),
    v("qa_v7", "instagram", "carousel", "ig_feed", { status: "approved", account_id: "qa_a_ig", account_label: "@interstellarstrategies", mode: "auto", scheduled_at: at(1, 17), approved_at: at(0, 17), text: "Fix slow lead follow-up in 5 slides." }),
    v("qa_v8", "telegram", "post", "square", { status: "approved", account_id: "qa_a_tg", account_label: "@interstellarstrategies", mode: "auto", scheduled_at: at(1, 16), approved_at: at(0, 17), text: "Where leads go cold." }),
    v("qa_v9", "threads", "post", "ig_feed", { status: "approved", account_id: "qa_a_th", mode: "needs_connection", scheduled_at: at(2, 18), approved_at: at(0, 17), text: "The first reply wins the job." }),
    v("qa_v10", "whatsapp", "update", "square", { status: "approved", scheduled_at: at(3, 20), approved_at: at(0, 17), text: "Quick one: how fast do you reply to a new lead?" }),
    v("qa_v11", "pinterest", "pin", "pin", { status: "posted", account_id: "qa_a_pi", mode: "auto", published_at: at(-3, 3), posted_url: "https://www.pinterest.com/", text: "How to fix slow lead follow-up", insights: { impressions: 140, saves: 6, clicks: 3 } }),
  ],
  SocialBrand: [],
  SocialDigest: [{
    id: "qa_d1", brand_key: "interstellar", week_start: at(-9, 0).slice(0, 10), week_end: at(-2, 0).slice(0, 10), posts_count: 4, data_points: 3, computed_at: at(0, 13),
    per_platform: {
      instagram: { posts: 2, with_data: 2, totals: { likes: 31, comments: 6, reach: 412, saves: 9, shares: 4 }, top: { title: "Your website might look fine and still be losing calls", url: "https://www.instagram.com/interstellarstrategies/" } },
      pinterest: { posts: 1, with_data: 1, totals: { impressions: 140, saves: 6, clicks: 3 }, top: { title: "How to fix slow lead follow-up", url: "https://www.pinterest.com/" } },
      telegram: { posts: 1, with_data: 0, totals: {}, top: null },
    },
    summary: "QA sample: the checklist-style Instagram post drew the most saves and shares this week; Pinterest's first pin picked up saves; Telegram shares no numbers.",
    double_down: ["Instagram: repeat the checklist format (most saves per reach).", "Pinterest: pin every checklist as a 2:3 with a keyword-first title."],
    ideas: [{ title: "Missed-call audit in 10 minutes", why: "Checklist format earned the saves", platforms: ["instagram", "pinterest"] }, { title: "What an instant text-back says", why: "Practical how-to angle", platforms: ["instagram", "linkedin"] }],
  }],
  SocialAccount: [
    { id: "qa_a_ig", client_id: "interstellar", platform: "instagram", display_name: "Interstellar Strategies", handle: "interstellarstrategies", enabled: true },
    { id: "qa_a_li", client_id: "interstellar", platform: "linkedin", account_kind: "company", display_name: "Interstellar Business OS", enabled: true },
    { id: "qa_a_x", client_id: "interstellar", platform: "x", display_name: "Interstellar", enabled: true },
    { id: "qa_a_dc", client_id: "interstellar", platform: "discord", display_name: "Interstellar community", secret_ref: "SOCIAL_DISCORD_WEBHOOK_INTERSTELLAR", enabled: true },
    { id: "qa_a_tg", client_id: "interstellar", platform: "telegram", display_name: "Interstellar channel", target_id: "@interstellarstrategies", secret_ref: "SOCIAL_TELEGRAM_BOT_TOKEN", enabled: true },
    { id: "qa_a_th", client_id: "interstellar", platform: "threads", display_name: "@interstellarstrategies", secret_ref: "SOCIAL_THREADS_TOKEN_INTERSTELLAR", enabled: true },
    { id: "qa_a_pi", client_id: "interstellar", platform: "pinterest", display_name: "Interstellar boards", target_id: "123", secret_ref: "SOCIAL_PINTEREST_TOKEN_INTERSTELLAR", enabled: true },
  ],
};

export const QA_CHANNELS_STATUS = {
  connectors: { instagram: true, facebook_pages: true, linkedin: false, x: false, youtube: false, tiktok: false },
  facebook_scopes: ["pages_show_list", "pages_manage_posts", "pages_read_engagement", "read_insights", "business_management"],
  secrets: { SOCIAL_TELEGRAM_BOT_TOKEN: true, SOCIAL_DISCORD_WEBHOOK_INTERSTELLAR: true, SOCIAL_THREADS_TOKEN_INTERSTELLAR: false, SOCIAL_PINTEREST_TOKEN_INTERSTELLAR: true },
  accounts: [
    { id: "qa_a_ig", platform: "instagram", mode: "auto", reason: "Instagram Business connector (shared)" },
    { id: "qa_a_li", platform: "linkedin", mode: "needs_connection", reason: "Connect the LinkedIn connector" },
    { id: "qa_a_x", platform: "x", mode: "needs_connection", reason: "Connect the X connector" },
    { id: "qa_a_dc", platform: "discord", mode: "auto", reason: "Discord channel webhook" },
    { id: "qa_a_tg", platform: "telegram", mode: "auto", reason: "Telegram bot" },
    { id: "qa_a_th", platform: "threads", mode: "needs_connection", reason: "Add the Base44 Secret SOCIAL_THREADS_TOKEN_INTERSTELLAR" },
    { id: "qa_a_pi", platform: "pinterest", mode: "auto", reason: "Pinterest API v5 (secret token). Trial access = sandbox pins only you can see" },
  ],
};
