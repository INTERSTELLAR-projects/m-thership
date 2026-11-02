// Official brand glyphs (Simple Icons, CC0) for email-signature social icons.
// Each platform: 24×24 SVG path, brand color, and optional full-color gradient.
import {
  siInstagram,
  siFacebook,
  siX,
  siTiktok,
  siYoutube,
  siThreads,
  siPinterest,
  siLinkedin,
  siWhatsapp,
  siYelp,
  siGooglemaps,
  siGoogle,
} from "simple-icons";

const IG_GRADIENT = ["#FEDA75", "#FA7E1E", "#D62976", "#962FBF", "#4F5BD5"];

export const PLATFORMS = [
  { id: "website", label: "Website", brand: "#111111", glyph: "globe" },
  { id: "instagram", label: "Instagram", brand: "#E1306C", path: siInstagram.path, gradient: IG_GRADIENT },
  { id: "facebook", label: "Facebook", brand: "#" + siFacebook.hex, path: siFacebook.path },
  { id: "linkedin", label: "LinkedIn", brand: "#" + siLinkedin.hex, path: siLinkedin.path },
  { id: "x", label: "X", brand: "#000000", path: siX.path },
  { id: "tiktok", label: "TikTok", brand: "#000000", path: siTiktok.path },
  { id: "youtube", label: "YouTube", brand: "#" + siYoutube.hex, path: siYoutube.path },
  { id: "threads", label: "Threads", brand: "#000000", path: siThreads.path },
  { id: "pinterest", label: "Pinterest", brand: "#" + siPinterest.hex, path: siPinterest.path },
  { id: "google", label: "Google reviews", brand: "#" + siGoogle.hex, path: siGoogle.path },
  { id: "maps", label: "Google Maps", brand: "#" + siGooglemaps.hex, path: siGooglemaps.path },
  { id: "yelp", label: "Yelp", brand: "#" + siYelp.hex, path: siYelp.path },
  { id: "whatsapp", label: "WhatsApp", brand: "#" + siWhatsapp.hex, path: siWhatsapp.path },
];

export const PLATFORM_BY_ID = Object.fromEntries(PLATFORMS.map((p) => [p.id, p]));

const pathCache = new Map();
function path2d(d) {
  if (!pathCache.has(d)) pathCache.set(d, new Path2D(d));
  return pathCache.get(d);
}

// Draws a platform glyph centered at (cx, cy), `size` px wide, filled with `fill`
// (a color string or a CanvasGradient).
export function drawGlyph(ctx, platform, cx, cy, size, fill) {
  const s = size / 24;
  ctx.save();
  ctx.translate(cx - size / 2, cy - size / 2);
  ctx.scale(s, s);
  if (platform.glyph === "globe") {
    ctx.strokeStyle = fill;
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(12, 12, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(12, 12, 4.2, 10, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2.4, 9);
    ctx.lineTo(21.6, 9);
    ctx.moveTo(2.4, 15);
    ctx.lineTo(21.6, 15);
    ctx.stroke();
  } else {
    ctx.fillStyle = fill;
    ctx.fill(path2d(platform.path));
  }
  ctx.restore();
}

// Instagram-style radial gradient over a box.
export function brandGradient(ctx, platform, x, y, w, h) {
  if (!platform.gradient) return platform.brand;
  const g = ctx.createRadialGradient(x + w * 0.3, y + h * 1.07, 0, x + w * 0.3, y + h * 1.07, w * 1.35);
  const stops = platform.gradient;
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c));
  return g;
}
