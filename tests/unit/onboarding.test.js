// VSRL onboarding pieces: client prep steps, client to-dos, task visibility defaults, the page guide,
// Usage & cost math and the co-branded email header.
import { describe, it, expect } from 'vitest';
import { PREP_STEPS, newPrep, stepsOf, progressOf, toggleStep, linkFor } from '@/features/prep/steps';
import { defaultPortalVisible, resolvePortalVisible, groupTodos } from '@/features/tasks/lib/clientVisibility';
import { guideEntries, searchGuide, SUB_TABS } from '@/lib/navGuide';
import { emailCost, smsCost, scenario, burn, PRESETS, withRates } from '@/features/usage/costModel';
import { renderEmail } from '@/features/email/emailBlocks';

describe('new client prep', () => {
  it('has the 15 steps in order, research to launch', () => {
    expect(PREP_STEPS).toHaveLength(15);
    expect(PREP_STEPS[0].key).toBe('research');
    expect(PREP_STEPS[14].key).toBe('launch');
    expect(new Set(PREP_STEPS.map((s) => s.key)).size).toBe(15);
  });
  it('starts with the given steps done and reports progress and the next step', () => {
    const p = newPrep({ id: 'c1', business: 'Acme' }, ['research', 'spec_site']);
    expect(p.client_name).toBe('Acme');
    const pr = progressOf(p);
    expect(pr.done).toBe(2);
    expect(pr.total).toBe(15);
    expect(pr.next.key).toBe('spec_cmd');
  });
  it('toggles a step and completes when all are done', () => {
    let p = newPrep({ id: 'c1', business: 'Acme' }, PREP_STEPS.slice(0, 14).map((s) => s.key));
    const r = toggleStep(p, 'launch');
    expect(r.complete).toBe(true);
    p = { ...p, steps: r.steps };
    expect(stepsOf(p).every((s) => s.done)).toBe(true);
    expect(toggleStep(p, 'launch').complete).toBe(false);
  });
  it('links client steps to that client', () => {
    const s = PREP_STEPS.find((x) => x.key === 'research');
    expect(linkFor(s, 'abc')).toContain('/clients/abc');
  });
});

describe('client to-dos', () => {
  it('splits open to-dos into needed from client, working on and up next', () => {
    const g = groupTodos([
      { id: 1, title: 'A', status: 'doing' },
      { id: 2, title: 'B', status: 'next', client_action: true },
      { id: 3, title: 'C', status: 'next' },
      { id: 4, title: 'D', status: 'done' },
    ]);
    expect(g.needs.map((t) => t.id)).toEqual([2]);
    expect(g.doing.map((t) => t.id)).toEqual([1]);
    expect(g.next.map((t) => t.id)).toEqual([3]);
  });
  it('shows client-facing tasks by default and hides internal ones', () => {
    expect(defaultPortalVisible({ client_id: 'c', category: 'development' })).toBe(true);
    expect(defaultPortalVisible({ client_id: 'c', category: 'finance' })).toBe(false);
    expect(defaultPortalVisible({ client_id: 'c', task_type: 'internal' })).toBe(false);
    expect(defaultPortalVisible({ category: 'development' })).toBe(false);
    expect(resolvePortalVisible({ client_id: 'c', category: 'finance', portal_visible: true })).toBe(true);
    expect(resolvePortalVisible({ client_id: 'c', category: 'development', portal_visible: false })).toBe(false);
  });
});

describe('page guide', () => {
  const all = guideEntries();
  it('lists pages, tabs and client sections with a hint each', () => {
    expect(all.length).toBeGreaterThan(60);
    expect(all.every((e) => e.label && e.path)).toBe(true);
    expect(SUB_TABS.some((t) => t.path === '/usage-cost')).toBe(true);
  });
  it('finds tabs and sub-tabs by any word', () => {
    expect(searchGuide(all, 'stripe').some((e) => e.path === '/financial?tab=stripe')).toBe(true);
    expect(searchGuide(all, 'codes app').some((e) => e.path === '/qr?tab=codes-app')).toBe(true);
    expect(searchGuide(all, 'zzzzqqq')).toHaveLength(0);
  });
});

describe('usage & cost', () => {
  it('prices email and texts with the default rates', () => {
    expect(emailCost(1000)).toBeCloseTo(0.16);
    expect(emailCost(1000, { ses_dedicated_ip: true })).toBeCloseTo(0.16 + 15 + 0.08);
    expect(smsCost(1000)).toBeCloseTo(12.8);
    expect(withRates({ ses_per_1000: 0.2 }).ses_per_1000).toBe(0.2);
  });
  it('500,000 emails a month costs $80 on SES', () => {
    const r = scenario(PRESETS.find((p) => p.key === '500k').input);
    expect(r.emails).toBe(500000);
    expect(r.vendors.find((v) => v.key === 'ses').cost).toBeCloseTo(80);
  });
  it('the VSRL preset is about 850K emails a year', () => {
    const r = scenario(PRESETS.find((p) => p.key === 'vsrl').input);
    expect(r.emails * 12).toBeGreaterThan(800000);
    expect(r.emails * 12).toBeLessThan(900000);
    expect(r.shareOfSub).toBeLessThan(0.1);
  });
  it('projects when the weekly Claude plan runs out', () => {
    const reset = new Date('2026-11-23T00:00:00Z').getTime();
    const start = reset - 7 * 864e5;
    const now = start + 3 * 864e5;
    const b = burn([{ pct_used: 60, recorded_at: new Date(now - 1000).toISOString() }], reset, now);
    expect(b.rate).toBeGreaterThan(0);
    expect(b.beforeReset).toBe(true);
    expect(burn([], reset, now).rate).toBeNull();
    expect(burn([], null, now)).toBeNull();
  });
});

describe('co-branded email header', () => {
  const doc = { subject: 'Hi', blocks: [{ type: 'header', eyebrow: 'Update' }, { type: 'paragraph', text: 'Hello' }] };
  it('adds "×" and the round client logo when one is on file', () => {
    const html = renderEmail(doc, { vars: {}, clientLogo: 'https://example.com/logo.png', clientName: 'Acme' });
    expect(html).toContain('&times;');
    expect(html).toContain('src="https://example.com/logo.png"');
    expect(html).toContain('border-radius:50%');
  });
  it('shows only the Interstellar lockup without a logo', () => {
    const html = renderEmail(doc, { vars: {} });
    expect(html).not.toContain('&times;');
    expect(html).toContain('INTERSTELLAR');
  });
  it('ignores a logo that is not https', () => {
    expect(renderEmail(doc, { vars: {}, clientLogo: 'javascript:alert(1)' })).not.toContain('&times;');
  });
});
