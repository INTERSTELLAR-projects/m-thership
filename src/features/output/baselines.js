// Time-saved estimates (minutes by hand per task type). Mirrors base44/shared/workLedger.ts DEFAULT_BASELINES;
// the saved table in Settings > Time-saved estimates overrides it. No imports: qa.js loads this before the SDK client.
export const DEFAULT_BASELINES = [
  ["blog_post", "Long-form blog post (research, write, publish)", "content", 180], ["gbp_post", "Google Business Profile post", "gbp", 20],
  ["gbp_update", "Google Business Profile update", "gbp", 20], ["social_post", "Social post (copy + design)", "social", 30],
  ["social_plan", "Monthly social plan", "social", 180], ["email_campaign", "Email campaign", "email", 120],
  ["site_fix", "Website fix or small edit", "website", 45], ["site_page", "New website page", "website", 120],
  ["site_feature", "Website feature or section rebuild", "website", 240], ["site_migration", "Site migration made cutover-ready", "website", 720],
  ["site_build", "New website build", "website", 1440], ["site_qa", "Website QA pass", "website", 180],
  ["translation", "Full-site translation", "content", 960], ["copy_edit", "Copy or wording cleanup", "content", 60],
  ["content_plan", "Content plan or topic calendar", "content", 120], ["seo_setup", "SEO setup (sitemap, schema, redirects, llms.txt)", "seo", 180],
  ["keyword_dossier", "Keyword + service-area map", "seo", 120], ["site_audit", "Site / SEO audit", "seo", 120], ["map_pack_plan", "Map pack plan", "seo", 120],
  ["audit", "Intel audit (business briefing)", "research", 480], ["citation", "Citation or directory listing", "citations", 20],
  ["outreach", "Backlink / citation outreach (per target)", "citations", 30], ["app_feature", "App feature or fix", "app_build", 240],
  ["app_build_stage", "Command System build stage", "app_build", 600], ["app_qa", "App QA test round", "app_build", 360],
  ["integration", "Integration or API endpoint", "app_build", 240], ["automation_setup", "Automation or workflow setup", "ops", 180],
  ["brand_asset", "Brand asset or deck", "brand", 180], ["brand_kit", "Brand kit", "brand", 480], ["brain_fill", "Business Brain / profile fill", "research", 90],
  ["research_brief", "Research brief", "research", 120], ["report", "Report", "research", 90], ["security_fix", "Security fix", "security", 90],
  ["data_cleanup", "Data cleanup", "ops", 45], ["client_request", "Client request completed", "website", 45],
  ["agent_run", "Agent routine run (brief, sync, refresh)", "ops", 30], ["ops_task", "Ops / admin task", "ops", 30],
  ["training_track", "Training track built (lessons, checklists, quiz)", "ops", 240], ["training_complete", "Trainee completed a training track", "ops", 0],
  ["billing_task", "Billing task", "billing", 20], ["decision", "Decision or answer (Justin)", "ops", 10], ["other", "Other", "ops", 30],
].map(([key, label, category, minutes]) => ({ key, label, category, minutes }));
export const DEFAULT_RATE = 75;
