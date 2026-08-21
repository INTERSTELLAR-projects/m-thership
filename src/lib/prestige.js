export const TIERS = [
  { tier: "Prestige I", threshold: 3, credit: "$1,000" },
  { tier: "Prestige II", threshold: 5, credit: "$2,500" },
  { tier: "Prestige III", threshold: 8, credit: "$3,500" },
  { tier: "Prestige Master", threshold: 15, credit: "$10,000" },
];

// Determine which prestige tier a member has EARNED based on confirmed referral count.
export function earnedTier(count) {
  const c = Math.max(0, count || 0);
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (c >= TIERS[i].threshold) return TIERS[i].tier;
  }
  return "Prestige I";
}

// Compute gamified progress info toward the next tier.
export function getProgress(count) {
  const c = Math.max(0, count || 0);
  let idx = -1;
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (c >= TIERS[i].threshold) { idx = i; break; }
  }
  if (idx === -1) {
    return {
      tier: "Prestige I", nextTier: "Prestige I", base: 0, target: 3, count: c,
      pct: Math.min(100, (c / 3) * 100), remaining: 3 - c, maxed: false, ascending: true,
      label: "Ascending to Prestige I",
    };
  }
  if (idx === TIERS.length - 1) {
    return {
      tier: "Prestige Master", nextTier: null, base: 15, target: 15, count: c,
      pct: 100, remaining: 0, maxed: true, ascending: false,
      label: "Maximum Prestige Achieved",
    };
  }
  const cur = TIERS[idx], next = TIERS[idx + 1];
  return {
    tier: cur.tier, nextTier: next.tier, base: cur.threshold, target: next.threshold, count: c,
    pct: ((c - cur.threshold) / (next.threshold - cur.threshold)) * 100,
    remaining: next.threshold - c, maxed: false, ascending: false,
    label: `${cur.tier} → ${next.tier}`,
  };
}