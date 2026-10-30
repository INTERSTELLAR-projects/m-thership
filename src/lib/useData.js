import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";

// Small helpers around base44.entities so feature pages stay readable.
export function useList(entity, { sort = "-created_date", limit = 200, filter = null, enabled = true } = {}) {
  return useQuery({
    queryKey: [entity, "list", sort, limit, filter ? JSON.stringify(filter) : null],
    queryFn: async () => {
      const api = base44.entities[entity];
      const rows = filter ? await api.filter(filter, sort, limit) : await api.list(sort, limit);
      return Array.isArray(rows) ? rows : [];
    },
    enabled,
    staleTime: 20_000,
  });
}

export function useRecord(entity, id) {
  return useQuery({
    queryKey: [entity, "get", id],
    queryFn: () => base44.entities[entity].get(id),
    enabled: !!id,
  });
}

export function useInvalidate() {
  const qc = useQueryClient();
  return (...entities) => entities.forEach((e) => qc.invalidateQueries({ queryKey: [e] }));
}

export const fmtDate = (d) => {
  if (!d) return "—";
  const dt = new Date(d.length === 10 ? `${d}T12:00:00` : d);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

export const timeAgo = (d) => {
  if (!d) return "";
  const t = new Date(d.length === 10 ? `${d}T12:00:00` : d).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.round(s / 86400)}d ago`;
  return fmtDate(d);
};

export const WORK_KINDS = {
  blog: "Blog post",
  gbp_post: "GBP post",
  site_edit: "Site edit",
  project_page: "Project page",
  new_page: "New page",
  citation: "Citation",
  press: "Press / news",
  mention: "Mention",
  backlink: "Backlink",
  schema: "Schema",
  search_console: "Search Console",
  bing: "Bing",
  analytics: "Analytics",
  report: "Report",
  presentation: "Presentation",
  deliverable: "Deliverable",
  design: "Design",
  automation_setup: "Automation setup",
  other: "Other",
};

export const SERVICE_LABELS = {
  website: "Website",
  system: "System",
  orbit_seo: "HyperCare+",
  brand: "Brand",
  starship_care: "GravïtyCare",
};
