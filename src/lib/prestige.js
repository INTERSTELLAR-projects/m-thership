// Prestige referral program: offer config + ladder math.
//
// Everything Justin can change (instant rewards, tier thresholds, unlock names, values,
// referral link) lives in ONE config record: AppSettings { key: "prestige_offer", prestigeOffer }.
// DEFAULT_OFFER below is only the starting point shown until he saves his own; the UI labels
// these values as defaults. The portal backend function (base44/functions/portal/entry.ts)
// mirrors the same defaults, so keep the two in sync if you change them here.

export const OFFER_KEY = "prestige_offer";
export const ROMAN = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export const DEFAULT_OFFER = {
  referral_base_url: "https://interstellar-strategies.com/contact",
  share_message: "I've been working with Interstellar Strategies on my website and marketing. If you want the same for your business, book a free call here: {link}",
  // Instant rewards: paid every single time the behavior happens.
  booked: {
    title: "Bonus Google post pack",
    detail: "4 extra Google Business Profile posts written and published for your business.",
    value: 200,
  },
  signed: {
    title: "$500 account credit",
    detail: "Applied to your next invoice, or swapped for a free month of care. Your pick.",
    value: 500,
  },
  // Tier unlocks by number of SIGNED referrals (lifetime).
  tiers: [
    { name: "Prestige I", threshold: 1, unlock: "Custom landing page", detail: "A conversion-built landing page for an offer, a service or a campaign.", value: 1500 },
    { name: "Prestige II", threshold: 3, unlock: "Automation build", detail: "An automation that takes a recurring task off your plate: lead capture, follow-up, review requests or intake.", value: 3000 },
    { name: "Prestige III", threshold: 5, unlock: "Mini app", detail: "A focused custom app: a calculator, booking tool, internal dashboard or client tool.", value: 5000 },
    { name: "Prestige IV", threshold: 10, unlock: "Full custom app", detail: "A full custom application with backend, database and integrations, built around how you run.", value: 10000 },
    { name: "Prestige Master", threshold: 25, unlock: "VIP partner status", detail: "Partner status: priority build queue, first access to every new system, and your name on the Prestige wall.", value: 0 },
  ],
  terms: "Rewards are earned per referral: one when they book a call, one when they sign. Tier unlocks are counted on signed referrals and stack. A referral counts as signed once their first invoice is paid. Credits apply to Interstellar work, have no cash value and are non-transferable.",
};

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v, d = "") => (typeof v === "string" ? v : d);

// Merge a saved offer over the defaults and normalise it (tiers sorted by threshold).
export function mergeOffer(saved) {
  const s = saved && typeof saved === "object" ? saved : {};
  const reward = (k) => ({
    title: str(s[k]?.title, DEFAULT_OFFER[k].title),
    detail: str(s[k]?.detail, DEFAULT_OFFER[k].detail),
    value: num(s[k]?.value, DEFAULT_OFFER[k].value),
  });
  const rawTiers = Array.isArray(s.tiers) && s.tiers.length ? s.tiers : DEFAULT_OFFER.tiers;
  const tiers = rawTiers
    .map((t, i) => ({
      name: str(t?.name, `Prestige ${ROMAN[i + 1] || i + 1}`).trim() || `Prestige ${ROMAN[i + 1] || i + 1}`,
      threshold: Math.max(1, Math.round(num(t?.threshold, i + 1))),
      unlock: str(t?.unlock, ""),
      detail: str(t?.detail, ""),
      value: num(t?.value, 0),
    }))
    .sort((a, b) => a.threshold - b.threshold)
    .slice(0, 10);
  return {
    referral_base_url: str(s.referral_base_url, DEFAULT_OFFER.referral_base_url),
    share_message: str(s.share_message, DEFAULT_OFFER.share_message),
    booked: reward("booked"),
    signed: reward("signed"),
    tiers,
    terms: str(s.terms, DEFAULT_OFFER.terms),
    is_default: !saved,
  };
}

// ---- Referral statuses ----
export const STATUSES = ["Pending", "Booked", "Confirmed", "Paid Out", "Lost"];
export const STATUS_LABEL = { Pending: "Lead sent", Booked: "Call booked", Confirmed: "Signed", "Paid Out": "Signed · paid out", Lost: "Lost" };
export const STATUS_TONE = {
  Pending: "bg-ink/[0.06] text-ink/60",
  Booked: "bg-[#ffaa00]/15 text-[#a35a00]",
  Confirmed: "bg-[#ff3c00]/12 text-[#ff3c00]",
  "Paid Out": "bg-green-600/10 text-green-700",
  Lost: "bg-ink/[0.04] text-ink/35 line-through",
};
export const isSigned = (r) => r?.status === "Confirmed" || r?.status === "Paid Out";
export const isBooked = (r) => r?.status === "Booked" || isSigned(r);

// ---- Ladder math (tier index is 1-based; 0 = not on the ladder yet) ----
export function tierIndex(signed, offer) {
  let idx = 0;
  offer.tiers.forEach((t, i) => { if (signed >= t.threshold) idx = i + 1; });
  return idx;
}
export const tierAt = (idx, offer) => (idx > 0 ? offer.tiers[idx - 1] : null);
export const tierLabel = (idx, offer) => tierAt(idx, offer)?.name || "Recruit";
export const numeralFor = (idx) => ROMAN[idx] || String(idx);
// Headline for the unlock screen: "PRESTIGE III" (custom names like "Prestige Master" become the subtitle).
export const unlockHeadline = (idx, offer) => {
  const name = tierAt(idx, offer)?.name || "";
  const numeral = numeralFor(idx);
  const plain = `Prestige ${numeral}`;
  return { title: plain.toUpperCase(), subtitle: name && name.toLowerCase() !== plain.toLowerCase() ? name : "" };
};

// Value stored on PrestigeMember.prestige (enum-safe, regardless of custom tier names).
const ENUM_TIERS = ["Recruit", "Prestige I", "Prestige II", "Prestige III", "Prestige IV", "Prestige V"];
export const enumTier = (idx) => ENUM_TIERS[idx] || "Prestige Master";

export function progressFor(signed, offer) {
  const c = Math.max(0, signed || 0);
  const idx = tierIndex(c, offer);
  const cur = tierAt(idx, offer);
  const next = offer.tiers[idx] || null;
  if (!next) return { idx, tier: cur, next: null, count: c, pct: 100, remaining: 0, maxed: true, from: cur?.threshold || 0, to: cur?.threshold || 0 };
  const from = cur?.threshold || 0;
  const span = Math.max(1, next.threshold - from);
  return { idx, tier: cur, next, count: c, pct: Math.min(100, ((c - from) / span) * 100), remaining: next.threshold - c, maxed: false, from, to: next.threshold };
}

// ---- Referral link + share ----
export const slugify = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 32) || "friend";
export const referralCode = (m) => m?.referral_code || slugify(m?.name);
export function referralLink(m, offer) {
  const base = offer.referral_base_url || DEFAULT_OFFER.referral_base_url;
  return `${base}${base.includes("?") ? "&" : "?"}ref=${encodeURIComponent(referralCode(m))}`;
}
export const shareText = (m, offer) => (offer.share_message || "").replace(/\{link\}/g, referralLink(m, offer)).replace(/\{name\}/g, m?.name || "");
export const smsHref = (text) => `sms:?&body=${encodeURIComponent(text)}`;
export const mailHref = (text) => `mailto:?subject=${encodeURIComponent("You should talk to Interstellar")}&body=${encodeURIComponent(text)}`;

export const money = (n) => (n ? `$${Math.round(n).toLocaleString()}` : "");

// Props for <PrestigeUnlock> for a given tier.
export function unlockProps(idx, offer, memberName = "") {
  const t = tierAt(idx, offer);
  const head = unlockHeadline(idx, offer);
  const next = offer.tiers[idx];
  const rewards = [];
  if (t) rewards.push({ title: t.unlock || `${t.name} unlock`, detail: t.detail, value: t.value ? `${money(t.value)} value` : "" });
  rewards.push({ title: `Every booked call: ${offer.booked.title}`, detail: offer.booked.detail, value: offer.booked.value ? `${money(offer.booked.value)} value` : "" });
  rewards.push({ title: `Every signed referral: ${offer.signed.title}`, detail: offer.signed.detail, value: offer.signed.value ? `${money(offer.signed.value)} value` : "" });
  if (next) rewards.push({ title: `Next: ${next.name} at ${next.threshold} signed`, detail: next.unlock ? `Unlocks ${next.unlock}.` : "", value: "" });
  return { tierIndex: idx, title: head.title, subtitle: head.subtitle, memberName, rewards };
}

// ---- Rewards engine ----
// Returns the PrestigeReward payloads a referral status change earns. Rewards are only created
// for the transition that just happened (never retroactively), de-duplicated against `existing`.
export function rewardsForTransition({ member, referral, prevStatus, nextStatus, prevSigned, nextSigned, offer, existing = [] }) {
  const out = [];
  const now = new Date().toISOString();
  const has = (kind, key) => existing.some((x) => x.memberId === member.id && x.kind === kind && (kind === "tier" ? x.tier_index === key : x.referralId === key));
  const base = { memberId: member.id, memberName: member.name, status: "owed", earned_at: now };
  if (referral) {
    const ref = { referralId: referral.id, referredClientName: referral.referredClientName };
    if (!isBooked({ status: prevStatus }) && isBooked({ status: nextStatus }) && !has("booked", referral.id)) {
      out.push({ ...base, ...ref, kind: "booked", title: offer.booked.title, value: offer.booked.value, notes: offer.booked.detail });
    }
    if (!isSigned({ status: prevStatus }) && isSigned({ status: nextStatus }) && !has("signed", referral.id)) {
      out.push({ ...base, ...ref, kind: "signed", title: offer.signed.title, value: offer.signed.value, notes: offer.signed.detail });
    }
  }
  const from = tierIndex(prevSigned, offer);
  const to = tierIndex(nextSigned, offer);
  for (let i = from + 1; i <= to; i++) {
    if (has("tier", i)) continue;
    const t = offer.tiers[i - 1];
    out.push({ ...base, kind: "tier", tier_index: i, title: `${t.name}: ${t.unlock || "Tier unlock"}`, value: t.value, notes: t.detail });
  }
  return out;
}

// Every reward a member should have under the current offer that isn't recorded yet (manual backfill).
export function missingRewards({ member, referrals, offer, existing = [] }) {
  const mine = referrals.filter((r) => r.memberId === member.id);
  let out = [];
  mine.forEach((r) => { out = out.concat(rewardsForTransition({ member, referral: r, prevStatus: "Pending", nextStatus: r.status, prevSigned: 0, nextSigned: 0, offer, existing })); });
  const signed = mine.filter(isSigned).length;
  out = out.concat(rewardsForTransition({ member, referral: null, prevSigned: 0, nextSigned: signed, offer, existing }));
  return out;
}
