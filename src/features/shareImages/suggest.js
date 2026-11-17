// "Suggest pages": the built-in LLM proposes a grouped share-image list from pasted routes or a sitemap,
// following Justin's rules. Nothing is saved until he reviews it and presses Save.
import { base44 } from "@/api/base44Client";
import { slugFile } from "./render";

const RULES = [
  "You plan Open Graph share images (1200x630) for one client website. Follow these rules exactly:",
  "- One image per standalone page (About, Contact, FAQ, Reviews, Pricing, How It Works...).",
  "- One image per GROUP of related pages: every product page shares PRODUCTS, every service-area / city page shares SERVICE AREA, every blog post shares the blog's name (e.g. BLOG or INSIGHTS), every project / portfolio item shares PROJECTS or PORTFOLIO, privacy + terms + cookies share LEGAL, careers + job pages share CAREERS.",
  "- Always include exactly one 'home' (key home, file og-home) and one 'default' fallback (key default, file og-default). They have an empty label.",
  "- Labels are short (1-3 words, max ~22 characters), Title Case, the way the site's own navigation names the page. No client name in labels.",
  "- file_name is 'og-' + a kebab-case slug of the label or section (og-how-it-works, og-legal). No extension.",
  "- kind: home | page | group | default. paths_note lists the routes that use the image (e.g. '/privacy, /terms').",
  "- Skip utility routes that are never shared (login callbacks, 404, admin, API, thank-you pages, sitemap files).",
  "- Do not invent pages that are not in the input.",
  "- Order: home first, then main navigation pages, then groups, then default last.",
].join("\n");

export async function suggestPages({ routesText, clientName, domain, current }) {
  const prompt = [
    RULES,
    `Client: ${clientName || "unknown"} (${domain || "no domain"}).`,
    current?.length ? `Current list (keep names that still fit): ${current.map((p) => `${p.file_name}=${p.label || p.kind}`).join(", ")}` : "",
    "Routes / sitemap pasted by Justin:",
    String(routesText || "").slice(0, 12000),
  ].filter(Boolean).join("\n\n");
  const res = await base44.integrations.Core.InvokeLLM({
    prompt,
    response_json_schema: {
      type: "object",
      properties: {
        pages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              key: { type: "string" }, file_name: { type: "string" }, label: { type: "string" },
              kind: { type: "string", enum: ["home", "page", "group", "default"] }, paths_note: { type: "string" },
            },
            required: ["file_name", "kind"],
          },
        },
        note: { type: "string" },
      },
      required: ["pages"],
    },
  });
  return { pages: normalizePages(res?.pages || []), note: res?.note || "" };
}

export function normalizePages(list) {
  const seen = new Set();
  const out = [];
  for (const p of list) {
    const kind = ["home", "page", "group", "default"].includes(p?.kind) ? p.kind : "page";
    let file = slugFile(p?.file_name || (kind === "home" ? "og-home" : kind === "default" ? "og-default" : `og-${p?.label || ""}`));
    if (!file.startsWith("og-")) file = `og-${file}`;
    if (file === "og-" || seen.has(file)) continue;
    seen.add(file);
    out.push({ key: slugFile(p?.key || file.replace(/^og-/, "")) || file, file_name: file, label: kind === "home" || kind === "default" ? "" : String(p?.label || "").trim(), kind, paths_note: String(p?.paths_note || "").trim() });
  }
  if (!out.some((p) => p.kind === "home")) out.unshift({ key: "home", file_name: "og-home", label: "", kind: "home", paths_note: "/" });
  if (!out.some((p) => p.kind === "default")) out.push({ key: "default", file_name: "og-default", label: "", kind: "default", paths_note: "any page without its own image" });
  return out;
}
