import { describe, expect, it } from 'vitest';
import {
  AGENCY, CONFIRM_MARK, addDays, byClientTime, byDay, clientResolver, confirmPatch, dayKey, fmtHM, inRange, minutesPatch,
  monthEnd, needsMinutes, prepare, rangeFor, summarize, summaryLine, weekStart,
} from '@/features/output/myTime';
import { pacificDay, workCounts } from '../../base44/shared/workCounts.ts';

// Wed Nov 11 2026, 10:00 Pacific (PST, UTC-8).
const NOW = new Date('2026-11-11T18:00:00Z');
let n = 0;
const row = (completed_at, client_id, manual_minutes, extra = {}) => ({
  id: `w${++n}`, title: `Work ${n}`, client_id, client_name: client_id === 'agency' ? 'Interstellar' : client_id === 'c1' ? 'Redline Visuals' : client_id === 'c2' ? 'Bobablastic (Molalla)' : '',
  done_by: 'claude_session', status: 'done', completed_at, manual_minutes, minutes_baseline: 60, task_type: 'site_fix', ...extra,
});

describe('Pacific days and weeks', () => {
  it('puts an instant on its Pacific calendar day, not the UTC one', () => {
    expect(dayKey('2026-11-11T07:59:00Z')).toBe('2026-11-10'); // 11:59pm PST the night before
    expect(dayKey('2026-11-11T08:00:00Z')).toBe('2026-11-11'); // midnight PST
    expect(dayKey('2026-07-01T06:59:00Z')).toBe('2026-06-30'); // PDT is UTC-7
    expect(dayKey('2026-07-01T07:00:00Z')).toBe('2026-07-01');
    expect(dayKey(null)).toBe(null);
    expect(dayKey('not a date')).toBe(null);
  });

  it('weeks run Monday to Sunday', () => {
    expect(weekStart('2026-11-11')).toBe('2026-11-09'); // Wed -> Mon
    expect(weekStart('2026-11-09')).toBe('2026-11-09'); // Mon stays
    expect(weekStart('2026-11-15')).toBe('2026-11-09'); // Sun belongs to the week that started Mon
    expect(rangeFor('week', NOW)).toEqual({ from: '2026-11-09', to: '2026-11-15' });
    expect(rangeFor('last_week', NOW)).toEqual({ from: '2026-11-02', to: '2026-11-08' });
  });

  it('builds the other ranges from the Pacific "today"', () => {
    expect(rangeFor('today', NOW)).toEqual({ from: '2026-11-11', to: '2026-11-11' });
    expect(rangeFor('yesterday', NOW)).toEqual({ from: '2026-11-10', to: '2026-11-10' });
    expect(rangeFor('month', NOW)).toEqual({ from: '2026-11-01', to: '2026-11-30' });
    expect(rangeFor('last_30', NOW)).toEqual({ from: '2026-10-13', to: '2026-11-11' });
    expect(rangeFor('custom', NOW, { from: '2026-11-05', to: '2026-11-03' })).toEqual({ from: '2026-11-03', to: '2026-11-05' });
    // 9pm Pacific on the 11th is already the 12th in UTC: today must still be the 11th.
    expect(rangeFor('today', new Date('2026-11-12T05:00:00Z')).from).toBe('2026-11-11');
    expect(monthEnd('2028-02-10')).toBe('2028-02-29');
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31'); // across the DST change, no drift
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
  });

  it('a week boundary splits on Pacific midnight between Sunday and Monday', () => {
    const rows = prepare([
      row('2026-11-09T07:30:00Z', 'c1', 10), // Sun Nov 8, 11:30pm PST -> last week
      row('2026-11-09T08:30:00Z', 'c1', 20), // Mon Nov 9, 12:30am PST -> this week
    ]);
    expect(summarize(inRange(rows, rangeFor('week', NOW))).minutes).toBe(20);
    expect(summarize(inRange(rows, rangeFor('last_week', NOW))).minutes).toBe(10);
  });
});

describe('grouping', () => {
  const rows = [
    row('2026-11-11T17:00:00Z', 'c1', 25, { status: 'in_progress' }),
    row('2026-11-11T16:00:00Z', 'c1', 35),
    row('2026-11-11T15:00:00Z', 'agency', 5),
    row('2026-11-11T10:00:00Z', null, 0, { client_name: 'Interstellar Strategies' }), // null id, agency by name
    row('2026-11-10T20:00:00Z', null, 15, { client_name: 'redline visuals ' }), // null id, joins the client by name
    row('2026-11-10T19:00:00Z', null, 7, { client_name: 'Some Prospect' }), // null id, unknown name: its own row
    row('2026-11-10T18:00:00Z', 'c2', 3, { minutes_baseline: null, task_type: 'site_feature' }),
    row('2026-11-11T12:00:00Z', 'c2', 99, { status: 'duplicate' }),
    row('2026-11-11T12:00:00Z', 'c2', 99, { status: 'cancelled' }),
    row(null, 'c1', 50, { source_type: 'work_log' }), // undated old work-log row: no date is invented
  ];
  const all = prepare(rows);

  it('excludes duplicate, cancelled and undated rows', () => {
    expect(all).toHaveLength(7);
    expect(all.some((e) => e._min === 99 || e._min === 50)).toBe(false);
  });

  it('resolves null client_id rows by name and groups Interstellar names together', () => {
    const who = clientResolver(rows);
    expect(who({ client_id: null, client_name: 'Interstellar Strategies' }).key).toBe(AGENCY);
    expect(who({ client_id: 'agency', client_name: 'Whatever' })).toEqual({ key: AGENCY, name: 'Interstellar' });
    expect(who({ client_id: null, client_name: '' }).key).toBe(AGENCY);
    expect(who({ client_id: null, client_name: 'REDLINE VISUALS' })).toEqual({ key: 'c1', name: 'Redline Visuals' });
    expect(who({ client_id: null, client_name: 'Some Prospect' })).toEqual({ key: 'name:some prospect', name: 'Some Prospect' });
  });

  it('builds one row per client plus Interstellar, sorted by time, with a total', () => {
    const baselineOf = (e) => (e.minutes_baseline != null ? e.minutes_baseline : 240);
    const { rows: t, total } = byClientTime(all, baselineOf);
    expect(t.map((r) => [r.name, r.minutes, r.done, r.open])).toEqual([
      ['Redline Visuals', 75, 2, 1],
      ['Some Prospect', 7, 1, 0],
      ['Interstellar', 5, 2, 0],
      ['Bobablastic (Molalla)', 3, 1, 0],
    ]);
    expect(t[0].share).toBeCloseTo(75 / 90);
    expect(t[0].baselineMinutes).toBe(120); // finished work only: the in-progress row is not "delivered"
    expect(t[3].baselineMinutes).toBe(240); // missing baseline falls back to the estimates table
    expect(total).toEqual({ minutes: 90, done: 6, open: 1, baselineMinutes: 60 * 5 + 240 });
  });

  it('summarizes time, finished work and the client / Interstellar split', () => {
    const today = summarize(inRange(all, rangeFor('today', NOW)));
    expect(today).toMatchObject({ minutes: 65, clientMinutes: 60, agencyMinutes: 5, done: 3, clientDone: 1, agencyDone: 2, clients: 1, hasAgency: true });
    expect(today.top).toMatchObject({ name: 'Redline Visuals', minutes: 60 });
    const yesterday = summarize(inRange(all, rangeFor('yesterday', NOW)));
    expect(yesterday).toMatchObject({ minutes: 25, done: 3, clients: 3, hasAgency: false });
  });

  it('lays out day by day, newest first, with segments by client', () => {
    const days = byDay(all);
    expect(days.map((d) => [d.day, d.minutes, d.done])).toEqual([['2026-11-11', 65, 3], ['2026-11-10', 25, 3]]);
    expect(days[0].segments.map((s) => [s.name, s.minutes])).toEqual([['Redline Visuals', 60], ['Interstellar', 5]]);
    expect(days[0].entries.map((e) => e._min)).toEqual([25, 35, 5, 0]); // latest first
  });

  it('writes the weekly line in plain words', () => {
    expect(summaryLine('This week', summarize(inRange(all, rangeFor('week', NOW))))).toBe('This week: 1h 30m across 3 clients and Interstellar. Most time: Redline Visuals (1h 15m).');
    expect(summaryLine('This week', summarize([]))).toBe('This week: nothing logged yet.');
    expect(fmtHM(380)).toBe('6h 20m');
    expect(fmtHM(60)).toBe('1h 00m');
    expect(fmtHM(45)).toBe('45m');
    expect(fmtHM(0)).toBe('0m');
  });
});

describe('needs your minutes', () => {
  const est = "Justin's minutes are an estimate from message times.";
  const rows = prepare([
    row('2026-11-11T17:00:00Z', 'c1', 25, { notes: est }), // estimated
    row('2026-11-11T16:00:00Z', 'c1', 0), // Claude session, no minutes
    row('2026-11-11T15:00:00Z', 'c1', null, { done_by: 'team' }), // empty
    row('2026-11-11T14:00:00Z', 'agency', 0, { done_by: 'scheduled_task' }), // Justin not involved
    row('2026-11-11T13:00:00Z', 'agency', 0, { done_by: 'agent' }),
    row('2026-11-11T12:00:00Z', 'c1', 30), // has real minutes
    row('2026-11-11T11:00:00Z', 'c1', 20, { notes: `${est} ${CONFIRM_MARK} 2026-11-11.` }), // already confirmed
    row('2026-10-28T20:00:00Z', 'c1', 0), // 14 days back (Oct 28) is the last day in the window
    row('2026-10-28T06:00:00Z', 'c1', 0), // Oct 27 Pacific: too old
    row('2026-11-11T10:00:00Z', 'c1', 0, { status: 'cancelled' }),
  ]);

  it('lists missing or estimated minutes from the last 14 days only', () => {
    expect(needsMinutes(rows, NOW).map((e) => e.id)).toEqual([rows[0].id, rows[1].id, rows[2].id, rows[7].id]);
  });

  it('"Looks right" only marks the notes as confirmed, which takes the row off the list', () => {
    const patch = confirmPatch(rows[0], NOW);
    expect(patch).toEqual({ notes: `${est} ${CONFIRM_MARK} 2026-11-11.` });
    expect(needsMinutes(prepare([{ ...rows[0], ...patch }]), NOW)).toEqual([]);
    expect(confirmPatch({ notes: '' }, NOW).notes).toBe(`${CONFIRM_MARK} 2026-11-11.`);
  });

  it('saving real minutes writes what the ledger edit form writes', () => {
    const baselines = [{ key: 'site_fix', minutes: 45 }];
    expect(minutesPatch({ ...rows[1], visibility_locked: true }, '12', baselines, NOW)).toEqual({
      manual_minutes: 12, minutes_baseline: 45, locked: true, minutes_saved_estimate: 33, visibility_locked: true, notes: `${CONFIRM_MARK} 2026-11-11.`,
    });
    // An overridden baseline is kept; work Justin did by hand never counts as saved; visibility lock is never switched on.
    const byHand = minutesPatch({ ...rows[1], done_by: 'justin_manual', baseline_override: true, minutes_baseline: 200 }, 90, baselines, NOW);
    expect(byHand).toMatchObject({ manual_minutes: 90, minutes_baseline: 200, minutes_saved_estimate: 0, visibility_locked: false });
    expect(minutesPatch(rows[1], 500, baselines, NOW).minutes_saved_estimate).toBe(0);
    expect(needsMinutes(prepare([{ ...rows[0], ...minutesPatch(rows[0], 10, baselines, NOW) }]), NOW)).toEqual([]);
  });
});

describe('portal task counts (work_counts)', () => {
  it('counts by Pacific week, month, last month and all time, with categories for this month', () => {
    const c = workCounts([
      { at: '2026-11-11T17:00:00Z', category: 'website' },
      { at: '2026-11-09T08:30:00Z', category: 'seo' }, // Mon 12:30am PST: this week
      { at: '2026-11-09T07:30:00Z', category: 'website' }, // Sun 11:30pm PST: last week, still this month
      { at: '2026-11-01T07:30:00Z', category: 'content' }, // Nov 1 12:30am PDT: this month
      { at: '2026-11-01T06:30:00Z', category: 'content' }, // Oct 31 11:30pm PDT: last month
      { at: '2026-10-15', category: 'gbp' }, // date-only work-log row
      { at: '2026-09-30T12:00:00Z', category: 'website' },
      { at: null, category: 'website' }, // undated: all time only
      { at: '2026-11-10T12:00:00Z' }, // no category -> website
    ], NOW);
    expect(c).toEqual({ this_week: 3, this_month: 5, last_month: 2, all_time: 9, by_category_this_month: { website: 3, seo: 1, content: 1 } });
  });

  it('handles January (last month is December of the year before) and empty input', () => {
    const c = workCounts([{ at: '2026-12-31T20:00:00Z', category: 'seo' }, { at: '2027-01-01T20:00:00Z', category: 'seo' }], new Date('2027-01-02T20:00:00Z'));
    expect(c).toMatchObject({ this_month: 1, last_month: 1, all_time: 2 });
    expect(workCounts([], NOW)).toEqual({ this_week: 0, this_month: 0, last_month: 0, all_time: 0, by_category_this_month: {} });
    expect(pacificDay('2026-11-11T07:59:00Z')).toBe('2026-11-10');
  });
});
