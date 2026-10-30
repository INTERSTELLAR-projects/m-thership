// Prestige referral-program ladder logic. Single source of truth for tier
// thresholds, credit amounts, descriptions, and example builds.
//
// Referral requirements are PER TIER (new referrals to climb from the
// previous tier) but a member unlocks a tier when their LIFETIME (cumulative)
// confirmed referrals reach that tier's `lifetime` mark. Both numbers are
// surfaced on the tier cards; `perTier` is the denominator for progress bars.
export const TIERS = [
  {
    tier: "Prestige I",
    lifetime: 3,
    perTier: 3,
    credit: "$1,000",
    amount: 1000,
    description:
      "Your first $1,000 in Interstellar credit. Spend it on a focused build that solves one problem well — a single-page application, a lead-capture system, or an automation that takes a recurring task off your plate for good.",
    builds: [
      "Single-page application",
      "Automation setup — lead capture, follow-up, or intake",
      "Landing page with conversion tracking",
      "Google Business Profile buildout + local SEO foundation",
    ],
  },
  {
    tier: "Prestige II",
    lifetime: 7,
    perTier: 4,
    credit: "$2,500",
    amount: 2500,
    description:
      "Enough credit to build something with real surface area. A multi-page site, a connected automation suite, or a custom internal tool your team actually uses every day.",
    builds: [
      "Multi-page website build",
      "Automation suite — multiple workflows, connected end to end",
      "Custom internal dashboard or admin tool",
      "HyperCare+ onboarding + technical SEO foundation",
    ],
  },
  {
    tier: "Prestige III",
    lifetime: 12,
    perTier: 5,
    credit: "$5,000",
    amount: 5000,
    description:
      "Serious build territory. A full custom web application, a complete site with SEO infrastructure, or a system architected around how your business actually operates.",
    builds: [
      "Full custom web application",
      "Complete website build with schema, GBP, and SEO infrastructure",
      "Multi-system automation buildout with integrations",
      "Client portal or customer-facing platform",
    ],
  },
  {
    tier: "Prestige Master",
    lifetime: 19,
    perTier: 7,
    credit: "$10,000",
    amount: 10000,
    description:
      "The top of the ladder. Ten thousand in credit toward a platform-level build — the kind of custom software most agencies quote as a project and Interstellar delivers as a partnership. You've sent nineteen people our way. This is what that's worth.",
    builds: [
      "Full platform or SaaS build",
      "Custom software with backend, database, and integrations",
      "Complete digital infrastructure — site, app, automations, SEO",
      "Ongoing build partnership, credit applied across multiple projects",
    ],
  },
];

// Determine which prestige tier a member has EARNED based on confirmed
// (lifetime) referral count. Uses cumulative `lifetime` thresholds.
export function earnedTier(count) {
  const c = Math.max(0, count || 0);
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (c >= TIERS[i].lifetime) return TIERS[i].tier;
  }
  return "Prestige I";
}

// Compute progress toward the NEXT tier. The denominator (`target`) is the
// per-tier number of new referrals required to climb, and `within` is how
// many new referrals have been made since reaching the current tier.
export function getProgress(count) {
  const c = Math.max(0, count || 0);
  let idx = -1;
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (c >= TIERS[i].lifetime) { idx = i; break; }
  }
  if (idx === -1) {
    const first = TIERS[0];
    const within = Math.min(first.perTier, c);
    return {
      tier: first.tier, nextTier: first.tier, base: 0, target: first.perTier,
      count: c, within,
      pct: (within / first.perTier) * 100,
      remaining: first.perTier - within, maxed: false, ascending: true,
      label: "Ascending to Prestige I",
    };
  }
  if (idx === TIERS.length - 1) {
    const cur = TIERS[idx];
    return {
      tier: cur.tier, nextTier: null, base: cur.lifetime, target: cur.perTier,
      count: c, within: cur.perTier,
      pct: 100, remaining: 0, maxed: true, ascending: false,
      label: "Maximum Prestige Achieved",
    };
  }
  const cur = TIERS[idx];
  const next = TIERS[idx + 1];
  const within = Math.min(next.perTier, c - cur.lifetime);
  return {
    tier: cur.tier, nextTier: next.tier, base: cur.lifetime, target: next.perTier,
    count: c, within,
    pct: (within / next.perTier) * 100,
    remaining: next.perTier - within, maxed: false, ascending: false,
    label: `${cur.tier} → ${next.tier}`,
  };
}