import { describe, expect, it } from 'vitest';
import {
  CREDIT_CAP, CREDIT_PER_SIGNED, DEFAULT_OFFER, creditSummary, mergeOffer, missingRewards, progressFor,
  redemptionError, referralLink, rewardsForTransition, shareText, slugify, tierIndex, unlockHeadline,
} from '@/lib/prestige';

const offer = mergeOffer(DEFAULT_OFFER);

describe('credits', () => {
  it('balance = earned − approved/fulfilled; pending is reserved, void ignored', () => {
    const rewards = [
      { reward_type: 'credit_500', value: 500, status: 'delivered' },
      { kind: 'signed', value: 500, status: 'owed' }, // pre-migration row still counts
      { reward_type: 'credit_500', value: 500, status: 'void' },
      { reward_type: 'priority_pass', value: 0 },
    ];
    const redemptions = [
      { status: 'approved', amount: 300 },
      { status: 'fulfilled', amount: 100 },
      { status: 'requested', amount: 400 },
      { status: 'declined', amount: 999 },
    ];
    expect(creditSummary(rewards, redemptions)).toEqual({ earned: 1000, redeemed: 400, pending: 400, balance: 600, available: 200 });
    expect(creditSummary().available).toBe(0);
  });

  it('available never goes negative', () => {
    expect(creditSummary([], [{ status: 'requested', amount: 50 }]).available).toBe(0);
  });

  it('redemptionError validates category, whole dollars, cap and balance', () => {
    expect(redemptionError({ category: 'nope', amount: 10, available: 100 })).toMatch(/Pick/);
    expect(redemptionError({ category: 'merch', amount: 0, available: 100 })).toMatch(/Enter/);
    expect(redemptionError({ category: 'merch', amount: 10.5, available: 100 })).toMatch(/whole/);
    expect(redemptionError({ category: 'merch', amount: CREDIT_CAP + 1, available: 5000 })).toMatch(/capped/);
    expect(redemptionError({ category: 'automation', amount: 1500, available: 5000 })).toBe('');
    expect(redemptionError({ category: 'automation', amount: 600, available: 500 })).toMatch(/more than/);
    expect(redemptionError({ category: 'merch', amount: 500, available: 500 })).toBe('');
  });
});

describe('mergeOffer', () => {
  it('fixes reward values, sorts tiers and caps them at 10', () => {
    const tiers = Array.from({ length: 12 }, (_, i) => ({ name: `T${i}`, threshold: 12 - i }));
    const o = mergeOffer({ tiers, signed: { title: 'x', value: 99999 }, booked: { value: 5 } });
    expect(o.signed.value).toBe(CREDIT_PER_SIGNED);
    expect(o.booked.value).toBe(0);
    expect(o.tiers).toHaveLength(10);
    expect(o.tiers.map((t) => t.threshold)).toEqual([...o.tiers.map((t) => t.threshold)].sort((a, b) => a - b));
    expect(o.is_default).toBe(false);
  });

  it('replaces legacy rewards/terms with the current defaults', () => {
    const o = mergeOffer({ booked: { title: 'Free month of service' }, terms: 'Credit on your next invoice.' });
    expect(o.booked.title).toBe(DEFAULT_OFFER.booked.title);
    expect(o.terms).toBe(DEFAULT_OFFER.terms);
    expect(mergeOffer(null).is_default).toBe(true);
  });

  it('coerces bad tier input', () => {
    const o = mergeOffer({ tiers: [{ name: '  ', threshold: -4 }] });
    expect(o.tiers[0]).toMatchObject({ name: 'Prestige I', threshold: 1 });
  });
});

describe('ladder', () => {
  it('tierIndex / progressFor', () => {
    expect(tierIndex(0, offer)).toBe(0);
    expect(tierIndex(3, offer)).toBe(2);
    expect(tierIndex(100, offer)).toBe(5);
    const p = progressFor(4, offer);
    expect(p).toMatchObject({ idx: 2, from: 3, to: 5, remaining: 1, maxed: false, pct: 50 });
    expect(progressFor(25, offer)).toMatchObject({ maxed: true, pct: 100, remaining: 0 });
    expect(progressFor(-3, offer).count).toBe(0);
  });

  it('unlockHeadline puts custom names in the subtitle', () => {
    expect(unlockHeadline(3, offer)).toEqual({ title: 'PRESTIGE III', subtitle: '' });
    expect(unlockHeadline(5, offer)).toEqual({ title: 'PRESTIGE V', subtitle: 'Prestige Master' });
  });
});

describe('referral links', () => {
  it('slugify and link building', () => {
    expect(slugify('  José O\'Brien & Co. ')).toBe('jose-o-brien-co');
    expect(slugify('')).toBe('friend');
    expect(referralLink({ name: 'Ann Lee' }, offer)).toBe('https://interstellar-strategies.com/contact?ref=ann-lee');
    expect(referralLink({ referral_code: 'a b' }, { referral_base_url: 'https://x.com/?a=1' })).toBe('https://x.com/?a=1&ref=a%20b');
    expect(shareText({ name: 'Ann' }, { ...offer, share_message: 'Hi {name}: {link}' })).toBe(`Hi Ann: ${referralLink({ name: 'Ann' }, offer)}`);
  });
});

describe('rewards engine', () => {
  const member = { id: 'm1', name: 'Ann' };
  const referral = { id: 'r1', referredClientName: 'Bob' };

  it('Pending → Confirmed earns booked + signed + tier I once', () => {
    const out = rewardsForTransition({ member, referral, prevStatus: 'Pending', nextStatus: 'Confirmed', prevSigned: 0, nextSigned: 1, offer });
    expect(out.map((r) => r.reward_type)).toEqual(['priority_pass', 'credit_500', 'tier_unlock']);
    expect(out[1]).toMatchObject({ value: 500, status: 'delivered' });
    // de-duplicated against existing rows
    const again = rewardsForTransition({ member, referral, prevStatus: 'Pending', nextStatus: 'Confirmed', prevSigned: 0, nextSigned: 1, offer, existing: out });
    expect(again).toEqual([]);
  });

  it('Confirmed → Paid Out earns nothing new', () => {
    expect(rewardsForTransition({ member, referral, prevStatus: 'Confirmed', nextStatus: 'Paid Out', prevSigned: 1, nextSigned: 1, offer })).toEqual([]);
  });

  it('jumping several tiers unlocks each skipped tier', () => {
    const out = rewardsForTransition({ member, referral: null, prevSigned: 0, nextSigned: 5, offer });
    expect(out.map((r) => r.tier_index)).toEqual([1, 2, 3]);
  });

  it('missingRewards backfills everything for a member', () => {
    const referrals = [
      { id: 'a', memberId: 'm1', status: 'Booked' },
      { id: 'b', memberId: 'm1', status: 'Confirmed' },
      { id: 'c', memberId: 'other', status: 'Confirmed' },
    ];
    const out = missingRewards({ member, referrals, offer });
    expect(out.filter((r) => r.kind === 'booked')).toHaveLength(2);
    expect(out.filter((r) => r.kind === 'signed')).toHaveLength(1);
    expect(out.filter((r) => r.kind === 'tier').map((r) => r.tier_index)).toEqual([1]);
  });
});
