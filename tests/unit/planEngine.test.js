import { describe, expect, it } from 'vitest';
import * as FE from '@/lib/planEngine';
import * as BE from '../../base44/shared/planEngine.js';

const { computeRoute, computePlan, presetFor, round2, clamp } = FE;

describe('planEngine helpers', () => {
  it('round2 / clamp / presetFor', () => {
    expect(round2(1.005 * 1000)).toBe(1005);
    expect(round2('abc')).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(presetFor('orbit_seo_base').monthly_price).toBe(500);
    expect(presetFor('nope')).toBeNull();
  });
});

describe('computeRoute (linear subscription accumulation)', () => {
  it('months_to_goal = ceil(gap / monthlyAdd), MRR lands at or above goal', () => {
    const r = computeRoute({ name: 'HC', monthly_price: 500, clients_per_month: 1 }, 2000, 10000);
    expect(r.months_to_goal).toBe(16);
    expect(r.mrr_total_at_goal).toBe(10000);
    expect(r.new_mrr_added).toBe(8000);
    expect(r.clients_needed_raw).toBe(16);
    expect(r.reached).toBe(true);
    expect(r.mrr_at_36).toBe(2000 + 36 * 500);
  });

  it('overshoots to the next whole month when the gap does not divide evenly', () => {
    const r = computeRoute({ name: 'x', monthly_price: 650, clients_per_month: 1 }, 0, 1000);
    expect(r.months_to_goal).toBe(2);
    expect(r.mrr_total_at_goal).toBe(1300);
  });

  it('already at goal = 0 months, nothing needed', () => {
    const r = computeRoute({ name: 'x', monthly_price: 500, clients_per_month: 1 }, 12000, 10000);
    expect(r.months_to_goal).toBe(0);
    expect(r.clients_needed_raw).toBe(0);
    expect(r.reached).toBe(true);
  });

  it('a route with no velocity never reaches the goal', () => {
    const r = computeRoute({ name: 'x', monthly_price: 500, clients_per_month: 0 }, 0, 1000);
    expect(r.reached).toBe(false);
    expect(r.months_to_goal).toBeNull();
    expect(r.goal_date).toBeNull();
    expect(r.flags.never_reaches).toBe(true);
    expect(r.series).toHaveLength(24);
  });

  it('series grows linearly and is capped at 24 months', () => {
    const r = computeRoute({ name: 'x', monthly_price: 100, clients_per_month: 2 }, 0, 400);
    expect(r.months_to_goal).toBe(2);
    expect(r.series.map((p) => p.mrr)).toEqual([200, 400, 600, 800]);
    expect(r.series.map((p) => p.clients)).toEqual([2, 4, 6, 8]);
  });
});

describe('computePlan', () => {
  const plan = {
    target_mrr: 10000,
    routes: [
      { name: 'HyperCare+', monthly_price: 500, clients_per_month: 1 },
      { name: 'GravityCare', monthly_price: 150, clients_per_month: 2 },
    ],
  };

  it('builds a blended route from the two primary routes and picks the fastest as winner', () => {
    const p = computePlan(plan, 0);
    expect(p.blended.monthly_price).toBe(800);
    expect(p.blended.months_to_goal).toBe(13);
    expect(p.winner_name).toBe('Blended (auto)');
    expect(p.gap_at_run).toBe(10000);
    expect(p.achieved).toBe(false);
  });

  it('respects per-route blended velocities', () => {
    const p = computePlan({ ...plan, blended_velocities: [2, 0] }, 0);
    expect(p.blended.monthly_price).toBe(1000);
    expect(p.blended.months_to_goal).toBe(10);
  });

  it('blended is unavailable with fewer than two priced routes', () => {
    const p = computePlan({ target_mrr: 1000, routes: [{ name: 'only', monthly_price: 500, clients_per_month: 1 }] }, 0);
    expect(p.blended.reached).toBe(false);
    expect(p.winner_name).toBe('only');
  });

  it('marks achieved and falls back to goal_mrr', () => {
    const p = computePlan({ goal_mrr: 5000, routes: [] }, 5000);
    expect(p.achieved).toBe(true);
    expect(p.target_mrr).toBe(5000);
  });
});

describe('frontend copy stays in sync with base44/shared/planEngine.js', () => {
  it('exports the same API', () => {
    expect(Object.keys(FE).sort()).toEqual(Object.keys(BE).sort());
    expect(FE.ROUTE_PRESETS).toEqual(BE.ROUTE_PRESETS);
  });

  it('produces identical plans', () => {
    const cases = [
      [{ target_mrr: 10000, routes: [{ name: 'a', monthly_price: 500, clients_per_month: 1 }, { name: 'b', monthly_price: 150, clients_per_month: 2 }], blended_velocities: [1, 3] }, 1234],
      [{ goal_mrr: 3000, routes: [{ name: 'c', monthly_price: 0, clients_per_month: 4 }] }, 0],
      [{ target_mrr: 100, routes: [] }, 500],
    ];
    for (const [plan, cur] of cases) expect(FE.computePlan(plan, cur)).toEqual(BE.computePlan(plan, cur));
  });
});
