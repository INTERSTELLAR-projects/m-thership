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
  // Instant rewards: earned every single time the behavior happens.
  // booked = Priority Pass (non-cash, any plan benefits). signed = $500 Interstellar credit (fixed).
  booked: {
    title: "Priority Pass",
    detail: "When they book a call, your next request jumps to the front of the build queue.",
    value: 0,
  },
  signed: {
    title: "$500 Interstellar credit",
    detail: "Added to your account when they pay their first invoice. Spend it on builds — automations, app upgrades, interactive website features, add-ons — and stack credits for something bigger. Or use up to $500 at a time on merch, marketing materials, social posts, videos or ad spend.",
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
  terms: "Every booked call earns a Priority Pass and every signed referral earns $500 in Interstellar credit. Tier unlocks are counted on signed referrals and stack. A referral counts as signed once their first invoice is paid. Credits are added to your Interstellar account, stack with no expiry unless stated, apply to Interstellar work only, have no cash value and are non-transferable. Merch, marketing materials, social posts, videos and ad spend are redeemed through Interstellar and capped at $500 per redemption.",
};

// ---- Credits: where they go ----
// Build categories have no cap (save up and stack credits for something bigger).
// Capped categories: one redemption can't exceed CREDIT_CAP. Mirrored in base44/functions/portal/entry.ts.
export const CREDIT_PER_SIGNED = 500;
export const CREDIT_CAP = 500;
export const CREDIT_GROUPS = [
  { key: "build", label: "Stack for builds", detail: "No cap. Save up and stack credits for something bigger." },
  { key: "capped", label: "Up to $500 each", detail: "Up to $500 per redemption." },
];
export const CREDIT_CATEGORIES = [
  { key: "automation", group: "build", label: "Automation", detail: "An automation that takes a task off your plate." },
  { key: "app_upgrade", group: "build", label: "App upgrade", detail: "An upgrade or new feature for your app (Command System)." },
  { key: "website_feature", group: "build", label: "Website feature", detail: "An interactive feature for your website." },
  { key: "addon_package", group: "build", label: "Add-on package", detail: "Toward Ops Command, Brand Arsenal, Launch Grid, Transmission and more." },
  { key: "merch", group: "capped", label: "Custom merch", detail: "Merch for your business." },
  { key: "marketing_materials", group: "capped", label: "Marketing materials", detail: "Print, signage, cards, flyers." },
  { key: "social_posts", group: "capped", label: "Social posts", detail: "Social media posts." },
  { key: "video", group: "capped", label: "Videos", detail: "Reels or long-form videos." },
  { key: "ad_spend", group: "capped", label: "Ad spend", detail: "Budget for your ads." },
];
export const creditCategory = (key) => CREDIT_CATEGORIES.find((c) => c.key === key) || null;
export const REDEMPTION_STATUS_LABEL = { requested: "Waiting on approval", approved: "Approved", fulfilled: "Done", declined: "Declined" };

// A reward that put credit in the member's balance (new credit_500, or a pre-migration "signed" row).
export const isCreditReward = (r) => r?.reward_type === "credit_500" || (!r?.reward_type && r?.kind === "signed");
const DEDUCTED = ["approved", "fulfilled"];
// balance = earned credits − redeemed (approved / fulfilled). Pending requests are not deducted, but they
// are reserved so the same credit can't be requested twice (available = balance − pending).
export function creditSummary(rewards = [], redemptions = []) {
  const earned = rewards.filter((r) => isCreditReward(r) && r.status !== "void").reduce((s, r) => s + (Number(r.value) || 0), 0);
  const redeemed = redemptions.filter((x) => DEDUCTED.includes(x.status)).reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const pending = redemptions.filter((x) => x.status === "requested").reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const balance = earned - redeemed;
  return { earned, redeemed, pending, balance, available: Math.max(0, balance - pending) };
}
// Returns an error message, or "" when the redemption is allowed.
export function redemptionError({ category, amount, available }) {
  const c = creditCategory(category);
  const amt = Number(amount);
  if (!c) return "Pick where the credit should go.";
  if (!Number.isFinite(amt) || amt <= 0) return "Enter an amount.";
  if (Math.round(amt) !== amt) return "Use whole dollars.";
  if (c.group === "capped" && amt > CREDIT_CAP) return `${c.label} is capped at $${CREDIT_CAP} per redemption.`;
  if (amt > (Number(available) || 0)) return `That's more than the $${Math.max(0, Number(available) || 0).toLocaleString()} available.`;
  return "";
}

// Old offers saved before the Nov 2026 rewrite (post pack, invoice credit, free month) fall back to the new defaults.
const LEGACY_REWARD = /post pack|next invoice|free month|account credit/i;
const legacy = (r) => !!r && LEGACY_REWARD.test(`${r.title || ""} ${r.detail || ""}`);

const num = (v, d = 0) => (Number.isFinite(Number(v)) ? Number(v) : d);
const str = (v, d = "") => (typeof v === "string" ? v : d);

// Merge a saved offer over the defaults and normalise it (tiers sorted by threshold).
export function mergeOffer(saved) {
  const s = saved && typeof saved === "object" ? saved : {};
  const reward = (k) => {
    const r = legacy(s[k]) ? {} : s[k] || {};
    return {
      title: str(r.title, DEFAULT_OFFER[k].title),
      detail: str(r.detail, DEFAULT_OFFER[k].detail),
      // Fixed by the program rules: Priority Pass has no dollar value; each signed referral is $500 credit.
      value: k === "signed" ? CREDIT_PER_SIGNED : 0,
    };
  };
  const savedTerms = str(s.terms, "");
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
    terms: savedTerms && !/next invoice|free month|Credits apply to Interstellar work,/i.test(savedTerms) ? savedTerms : DEFAULT_OFFER.terms,
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
  rewards.push({ title: `Every booked call: ${offer.booked.title}`, detail: offer.booked.detail, value: "" });
  rewards.push({ title: `Every signed referral: ${offer.signed.title}`, detail: offer.signed.detail, value: "" });
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
      // Priority Pass: owed until Justin uses it (marks it delivered when their request is moved up).
      out.push({ ...base, ...ref, kind: "booked", reward_type: "priority_pass", title: offer.booked.title, value: 0, notes: offer.booked.detail });
    }
    if (!isSigned({ status: prevStatus }) && isSigned({ status: nextStatus }) && !has("signed", referral.id)) {
      // Signed = first invoice paid, so the credit lands in their balance straight away.
      out.push({ ...base, ...ref, kind: "signed", reward_type: "credit_500", title: offer.signed.title, value: CREDIT_PER_SIGNED, notes: "Added to the Interstellar credit balance.", status: "delivered", delivered_at: now });
    }
  }
  const from = tierIndex(prevSigned, offer);
  const to = tierIndex(nextSigned, offer);
  for (let i = from + 1; i <= to; i++) {
    if (has("tier", i)) continue;
    const t = offer.tiers[i - 1];
    out.push({ ...base, kind: "tier", reward_type: "tier_unlock", tier_index: i, title: `${t.name}: ${t.unlock || "Tier unlock"}`, value: t.value, notes: t.detail });
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
