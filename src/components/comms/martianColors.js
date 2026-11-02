// Martian avatar colors. Each color is a small palette so the SVG can shade the body.
// Resolution order for a client: martian_color override -> name match -> accent -> hashed palette.

export const MARTIAN_PALETTES = {
  orange: { body: "#ff6a00", shade: "#ff3c00", light: "#ffaa00", label: "Orange" },
  purple: { body: "#8b5cf6", shade: "#6d28d9", light: "#c4b5fd", label: "Purple" },
  red: { body: "#ef4444", shade: "#b91c1c", light: "#fca5a5", label: "Red" },
  gold: { body: "#eab308", shade: "#a16207", light: "#fde68a", label: "Gold" },
  green: { body: "#22c55e", shade: "#15803d", light: "#86efac", label: "Green" },
  yellow: { body: "#facc15", shade: "#ca8a04", light: "#fef08a", label: "Yellow" },
  lagoon: { body: "#14b8a6", shade: "#0f766e", light: "#5eead4", label: "Lagoon" },
  blue: { body: "#3b82f6", shade: "#1d4ed8", light: "#93c5fd", label: "Blue" },
  purpleblue: { body: "#7c6cf6", shade: "#4f46e5", light: "#a5b4fc", gradient: ["#8b5cf6", "#3b82f6"], label: "Purple → Blue" },
  pink: { body: "#ec4899", shade: "#be185d", light: "#f9a8d4", label: "Pink" },
  cyan: { body: "#06b6d4", shade: "#0e7490", light: "#67e8f9", label: "Cyan" },
  lime: { body: "#84cc16", shade: "#4d7c0f", light: "#bef264", label: "Lime" },
};

// Name fragments (lower-case, partial match) -> palette key.
const NAME_MAP = [
  [["interstellar"], "orange"],
  [["arcane ink"], "purple"],
  [["bobablastic", "bobasaur"], "red"],
  [["chasing gains"], "gold"],
  [["mow masters"], "green"],
  [["muscle mentor"], "orange"],
  [["north woods"], "yellow"],
  [["palm shore"], "lagoon"],
  [["powerlift"], "blue"],
  [["redline"], "red"],
  [["rein nutrition"], "gold"],
  [["royalz", "royal barberz"], "gold"],
  [["simple social", "smpl"], "purpleblue"],
  [["bulba bros"], "green"],
  [["velocity"], "red"],
];

const HASH_KEYS = ["purple", "blue", "green", "lagoon", "pink", "cyan", "lime", "red", "yellow"];

const isHex = (v) => typeof v === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v.trim());

function shadeHex(hex, amt) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  const ch = (s) => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) + amt * 255)));
  return `#${[16, 8, 0].map((s) => ch(s).toString(16).padStart(2, "0")).join("")}`;
}

export function paletteFromHex(hex) {
  return { body: hex, shade: shadeHex(hex, -0.18), light: shadeHex(hex, 0.25), label: hex };
}

function hashKey(str) {
  let h = 0;
  for (const c of String(str || "")) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return HASH_KEYS[h % HASH_KEYS.length];
}

export function nameMatchKey(name) {
  const n = String(name || "").toLowerCase();
  const hit = NAME_MAP.find(([frags]) => frags.some((f) => n.includes(f)));
  return hit ? hit[1] : null;
}

// value can be a palette key ("lagoon") or a hex ("#14b8a6").
export function resolvePaletteValue(value) {
  if (!value) return null;
  if (MARTIAN_PALETTES[value]) return MARTIAN_PALETTES[value];
  if (isHex(value)) return paletteFromHex(value.trim());
  return null;
}

/** Palette for a client-like object: { business, martian_color, accent }. */
export function martianPalette(client) {
  if (!client) return MARTIAN_PALETTES.orange;
  return (
    resolvePaletteValue(client.martian_color) ||
    (nameMatchKey(client.business) && MARTIAN_PALETTES[nameMatchKey(client.business)]) ||
    resolvePaletteValue(client.accent) ||
    MARTIAN_PALETTES[hashKey(client.id || client.business)]
  );
}

export const KING = { name: "Interstellar Strategies", palette: MARTIAN_PALETTES.orange, king: true };
