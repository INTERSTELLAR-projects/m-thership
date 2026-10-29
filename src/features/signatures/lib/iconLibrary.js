// Animated-style social icon library for email signatures.
// Icons are served from the Simple Icons CDN (cdn.simpleicons.org) as hosted,
// email-compatible images. Three visual "styles" the user can pick from.

export const SOCIAL_PLATFORMS = [
  { id: "website", label: "Website", slug: "googlechrome", brand: "#4285F4" },
  { id: "instagram", label: "Instagram", slug: "instagram", brand: "#E4405F" },
  { id: "linkedin", label: "LinkedIn", slug: "linkedin", brand: "#0A66C2" },
  { id: "facebook", label: "Facebook", slug: "facebook", brand: "#1877F2" },
  { id: "x", label: "X", slug: "x", brand: "#000000" },
  { id: "tiktok", label: "TikTok", slug: "tiktok", brand: "#000000" },
  { id: "youtube", label: "YouTube", slug: "youtube", brand: "#FF0000" },
];

export const ICON_STYLES = [
  { id: "color", label: "Brand Colors", description: "Full-color brand icons" },
  { id: "mono", label: "Monochrome", description: "Single accent color" },
  { id: "badge", label: "Rounded Badges", description: "White icon on brand-color circle" },
];

const brandColor = (platformId) => {
  const p = SOCIAL_PLATFORMS.find((s) => s.id === platformId);
  return p ? p.brand.replace("#", "") : "000000";
};

// Returns a hosted image URL for a platform icon given the chosen style + accent color.
export function getIconUrl(platformId, styleId, accentColor) {
  const platform = SOCIAL_PLATFORMS.find((s) => s.id === platformId);
  if (!platform) return "";
  const accent = (accentColor || "#ff6a00").replace("#", "");
  const slug = platform.slug;
  if (styleId === "color") {
    return `https://cdn.simpleicons.org/${slug}`;
  }
  if (styleId === "mono") {
    return `https://cdn.simpleicons.org/${slug}/${accent}`;
  }
  // badge: white icon, brand background applied via cell in template
  return `https://cdn.simpleicons.org/${slug}/ffffff`;
}

export function getBadgeBg(platformId) {
  return "#" + brandColor(platformId);
}

// CTA button "library" — rendered as styled table buttons (email-safe).
export const CTA_STYLES = [
  { id: "solid", label: "Solid Accent" },
  { id: "gradient", label: "Brand Gradient" },
  { id: "outline", label: "Outlined" },
];

export const DEFAULT_CTA = { label: "Book a Call", url: "", style: "gradient" };