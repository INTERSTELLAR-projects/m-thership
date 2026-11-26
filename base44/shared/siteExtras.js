// Identical copy of src/lib/siteExtras.js for backend functions. tests/unit/unlocks.test.js checks they match.
// Self-serve seasons + offers (Build Engine, Nov 19 2026). Identical copy in base44/shared/siteExtras.js.
// The client flips a season/holiday on in their portal and their website's banner, accent and featured section
// switch; turning it off reverts the site. Offers: the client enters what, % or $ off and dates; the site shows it
// while it runs. A matching checkout discount (Stripe coupon or Shopify code) touches money, so it is a HARD GATE:
// it is queued for Justin's one-tap approval and never created automatically.
// The website reads its config from the public site-config function (only the fields below, by its site_key).

export const SEASON_PRESETS = [
  { key: "holiday", label: "Holiday season", banner: "Happy holidays from all of us", accent: "#b3261e" },
  { key: "black_friday", label: "Black Friday", banner: "Black Friday deals are here", accent: "#111111" },
  { key: "spring", label: "Spring", banner: "Spring is here: book your spring work now", accent: "#3f8f4f" },
  { key: "summer", label: "Summer", banner: "Summer hours and summer specials", accent: "#e08a1e" },
  { key: "fall", label: "Fall", banner: "Get ready for fall", accent: "#b5541c" },
  { key: "custom", label: "Custom", banner: "", accent: "" },
];
export const presetFor = (key) => SEASON_PRESETS.find((p) => p.key === key) || null;

const HEX = /^#[0-9a-f]{6}$/i;
const clip = (v, n) => String(v == null ? "" : v).trim().slice(0, n);
const isDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ""));

// What the client may set on a season (everything else is ignored).
export function cleanSeason(input) {
  const p = presetFor(input && input.key);
  if (!p) return { error: "Pick a season" };
  const accent = clip(input.accent, 7);
  return {
    key: p.key,
    label: p.key === "custom" ? clip(input.label, 40) || "Special" : p.label,
    banner_text: clip(input.banner_text, 140) || p.banner,
    accent: HEX.test(accent) ? accent : p.accent,
    featured_title: clip(input.featured_title, 80),
    featured_text: clip(input.featured_text, 280),
  };
}

// An offer as the client enters it.
export function cleanOffer(input) {
  const o = input || {};
  const title = clip(o.title, 80);
  const kind = o.kind === "amount" ? "amount" : "percent";
  const value = Math.round(Number(o.value) * 100) / 100;
  if (!title) return { error: "Say what the offer is" };
  if (!(value > 0)) return { error: "Enter how much off" };
  if (kind === "percent" && value > 90) return { error: "Percent off must be 90 or less" };
  if (kind === "amount" && value > 100000) return { error: "That amount is too large" };
  if (!isDate(o.starts_on) || !isDate(o.ends_on)) return { error: "Pick a start and end date" };
  if (o.ends_on < o.starts_on) return { error: "The end date is before the start date" };
  return { title, description: clip(o.description, 280), kind, value, starts_on: o.starts_on, ends_on: o.ends_on };
}

export const offerLabel = (o) => (o.kind === "amount" ? `$${Number(o.value).toLocaleString("en-US")} off` : `${Number(o.value)}% off`);
export const offerLive = (o, today) => !!o && o.status !== "ended" && isDate(today) && o.starts_on <= today && today <= o.ends_on;

// The ONLY data the public site-config function returns: no ids, no discount codes until created, no client data.
// Automatic seasons (Workspace, Nov 25 2026): every connected site follows the calendar with no toggle. A season the
// client (or we) switched on by hand wins over the calendar. Dates are Pacific, "YYYY-MM-DD".
//   Spring Mar 20–May 31 · Summer Jun 1–Aug 31 · Fall Sep 1–Nov 30 · Black Friday (day after Thanksgiving → Cyber
//   Monday, overrides Fall) · Holiday Dec 1–31 · Jan 1–Mar 19: none (the site's normal look).
export function blackFridayRange(year) {
  const nov1 = new Date(Date.UTC(year, 10, 1)).getUTCDay();
  const thanksgiving = 1 + ((4 - nov1 + 7) % 7) + 21; // 4th Thursday of November
  const d = (n) => new Date(Date.UTC(year, 10, n)).toISOString().slice(0, 10);
  return [d(thanksgiving + 1), d(thanksgiving + 4)];
}
export function autoSeasonKey(today) {
  const t = String(today || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
  const [from, to] = blackFridayRange(Number(t.slice(0, 4)));
  if (t >= from && t <= to) return "black_friday";
  const md = t.slice(5);
  if (md >= "12-01") return "holiday";
  if (md >= "09-01") return "fall";
  if (md >= "06-01") return "summer";
  if (md >= "03-20") return "spring";
  return null;
}
export function autoSeason(today) {
  const p = presetFor(autoSeasonKey(today));
  return p ? { key: p.key, label: p.label, banner_text: p.banner, accent: p.accent, active: true, auto: true } : null;
}

export function publicConfig(seasons, offers, today, auto = true) {
  const s = (seasons || []).filter((x) => x.active).sort((a, b) => String(b.activated_at || "").localeCompare(String(a.activated_at || "")))[0] || (auto ? autoSeason(today) : null);
  const live = (offers || []).filter((o) => offerLive(o, today));
  return {
    season: s ? { key: s.key, label: s.label, banner: s.banner_text || "", accent: HEX.test(s.accent || "") ? s.accent : "", featured: s.featured_title ? { title: s.featured_title, text: s.featured_text || "" } : null } : null,
    offers: live.map((o) => ({ title: o.title, description: o.description || "", label: offerLabel(o), ends_on: o.ends_on, code: o.discount_status === "created" ? o.discount_code || "" : "" })),
  };
}

export const todayPacific = (d = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
