import SCHEMA from "../templates.schema.json";
import { CommandBriefing, Dashboard, PainFix, PortalPreview, StackCollapse } from "./layoutsProduct";
import { BeforeAfterSite, BigStat, Checklist, PipelineBoard, QuoteHook } from "./layoutsStory";
import { CarouselCover, OfferStack, ReviewQr, ToastStack } from "./layoutsSales";

// Template registry. Schema + example spec live in ../templates.schema.json (also read by the
// weekly Claude generator), the React layout lives here. Keys must match the JSON.
const COMPONENTS = {
  pain_fix: PainFix,
  dashboard: Dashboard,
  command_briefing: CommandBriefing,
  portal_preview: PortalPreview,
  stack_collapse: StackCollapse,
  before_after_site: BeforeAfterSite,
  checklist: Checklist,
  big_stat: BigStat,
  quote_hook: QuoteHook,
  pipeline_board: PipelineBoard,
  review_qr: ReviewQr,
  offer_stack: OfferStack,
  carousel_cover: CarouselCover,
  toast_stack: ToastStack,
};

export const TEMPLATE_SCHEMA = SCHEMA;

export const TEMPLATES = Object.entries(SCHEMA.templates)
  .filter(([key]) => COMPONENTS[key])
  .map(([key, t]) => ({ key, ...t, Component: COMPONENTS[key] }));

export const TEMPLATE_BY_KEY = Object.fromEntries(TEMPLATES.map((t) => [t.key, t]));

export const getTemplate = (key) => TEMPLATE_BY_KEY[key] || TEMPLATES[0];

export const exampleSpec = (key) => JSON.parse(JSON.stringify(getTemplate(key).example));

/** Switch template while keeping the shared copy; mock data resets to the new template's example. */
export function switchTemplate(spec, key) {
  const ex = exampleSpec(key);
  const keep = ["eyebrow", "headline", "accent_word", "subhead", "body", "cta", "theme", "lockup"];
  const next = { ...ex };
  for (const k of keep) if (spec?.[k] !== undefined && spec?.[k] !== null) next[k] = spec[k];
  return next;
}
