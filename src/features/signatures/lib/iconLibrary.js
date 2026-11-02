// Social icon + CTA libraries for email signatures.
// Icons are served from the Simple Icons CDN (cdn.simpleicons.org) as hosted,
// email-compatible images, wrapped in table-based bubbles for the styled looks.

export const SOCIAL_PLATFORMS = [
  { id: "website", label: "Website", slug: "googlechrome", brand: "#4285F4" },
  { id: "instagram", label: "Instagram", slug: "instagram", brand: "#E4405F" },
  { id: "linkedin", label: "LinkedIn", slug: "linkedin", brand: "#0A66C2" },
  { id: "facebook", label: "Facebook", slug: "facebook", brand: "#1877F2" },
  { id: "x", label: "X", slug: "x", brand: "#111111" },
  { id: "tiktok", label: "TikTok", slug: "tiktok", brand: "#111111" },
  { id: "youtube", label: "YouTube", slug: "youtube", brand: "#FF0033" },
];

export const ICON_STYLES = [
  { id: "badge", label: "Brand" },
  { id: "tint", label: "Accent" },
  { id: "dark", label: "Ink" },
  { id: "outline", label: "Outline" },
  { id: "color", label: "Full color" },
  { id: "mono", label: "Mono" },
];

export const ICON_SHAPES = [
  { id: "circle", label: "Circle" },
  { id: "rounded", label: "Rounded" },
  { id: "square", label: "Square" },
];

export const ICON_LAYOUTS = [
  { id: "row", label: "Row" },
  { id: "column", label: "Column" },
  { id: "grid", label: "Grid" },
];

export const ICON_SIZES = [20, 24, 28, 32];

// Everything the renderer needs for one platform icon.
export function getIconSpec(platformId, theme = {}) {
  const platform = SOCIAL_PLATFORMS.find((s) => s.id === platformId);
  if (!platform) return { bubble: false, url: "", img: 20 };

  const accent = theme.accent_color || "#ff6a00";
  const accentHex = accent.replace("#", "");
  const style = theme.icon_style || "badge";
  const shape = theme.icon_shape || "circle";
  const size = Number(theme.icon_size) || 26;
  const radius = shape === "circle" ? "50%" : shape === "square" ? "2px" : "8px";
  const slug = platform.slug;

  if (style === "color") {
    return { bubble: false, url: `https://cdn.simpleicons.org/${slug}`, img: Math.round(size * 0.85) };
  }
  if (style === "mono") {
    return { bubble: false, url: `https://cdn.simpleicons.org/${slug}/${accentHex}`, img: Math.round(size * 0.85) };
  }

  const img = Math.max(10, Math.round(size * 0.5));
  const isOutline = style === "outline";
  return {
    bubble: true,
    url: isOutline
      ? `https://cdn.simpleicons.org/${slug}/${accentHex}`
      : `https://cdn.simpleicons.org/${slug}/ffffff`,
    img,
    box: size,
    radius,
    bg: isOutline
      ? theme.surface_color || "#ffffff"
      : style === "badge"
      ? platform.brand
      : style === "tint"
      ? accent
      : "#1a1a1a",
    border: isOutline ? `1px solid ${accent}` : "none",
    pad: Math.max(3, Math.round((size - img) / 2)),
  };
}

// CTA button library — rendered as table-based buttons (email-safe).
export const CTA_STYLES = [
  { id: "gradient", label: "Gradient" },
  { id: "solid", label: "Solid" },
  { id: "outline", label: "Outline" },
  { id: "tint", label: "Soft" },
  { id: "pill", label: "Pill" },
  { id: "dark", label: "Ink" },
  { id: "link", label: "Text link" },
];

export const DEFAULT_CTA = { label: "Book a Call", url: "", style: "gradient" };