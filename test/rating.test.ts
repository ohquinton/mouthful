// When to ask for an App Store rating (DILEMMAS #12): after the second good run or the day after
// the moment, never after a rough patch, never within 120 days, never more than 3 times a year.
import { maybeAskForRating, noteRoughPatch, ratingReason, resetRoughPatch, shouldAskForRating } from '../src/rating';
import { sanitise } from '../src/analytics';
import type { Profile } from '../src/store/profile';

// pro.ts imports the router for requirePro(); the real one needs React Native.
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const DAY = 86_400_000;
const now = new Date(2026, 9, 30, 12, 0).getTime();
const run = (id: string, part = 0, partReached?: boolean) => ({ id, passageId: `s.111.${part}`, partReached });
const read = (id: string) => ({ id, passageId: 'night-shift' });
// A Pro reader whose free-run paywall is behind them.
const pro: Profile = { onboarded: true, pro: true, paywallSeen: true, ahaPaywallShown: true };

beforeEach(() => resetRoughPatch());

describe('ratingReason: second finished run', () => {
  it('asks on the Tape of the second run that reached its part', () => {
    expect(ratingReason([run('a'), run('b', 1)], pro, now, { sessionId: 'b' })).toBe('second_run');
  });

  it('not after the first run', () => {
    expect(ratingReason([run('a')], pro, now, { sessionId: 'a' })).toBeNull();
  });

  it('an early Finish (part not reached) is not a run, and its Tape never asks', () => {
    expect(ratingReason([run('a'), run('b', 0, false)], pro, now, { sessionId: 'b' })).toBeNull();
    expect(ratingReason([run('a'), run('b', 0, false), run('c')], pro, now, { sessionId: 'c' })).toBe('second_run');
  });

  it('not on the Tape of something else (a built-in read) even with two runs saved', () => {
    expect(ratingReason([run('a'), run('b'), read('c')], pro, now, { sessionId: 'c' })).toBeNull();
  });
});

describe('ratingReason: the day after the moment', () => {
  const withDate = (date: string): Profile => ({ ...pro, moment: { id: 'interview', date, startedAt: now - 10 * DAY } });

  it('asks from the day after the date', () => {
    expect(ratingReason([read('a')], withDate('2026-10-29'), now, { sessionId: 'a' })).toBe('after_moment');
    expect(ratingReason([read('a')], withDate('2026-10-01'), now, { sessionId: 'a' })).toBe('after_moment');
  });

  it('not on the day itself or before', () => {
    expect(ratingReason([read('a')], withDate('2026-10-30'), now, { sessionId: 'a' })).toBeNull();
    expect(ratingReason([read('a')], withDate('2026-11-02'), now, { sessionId: 'a' })).toBeNull();
  });

  it('ignores a date that isn’t one', () => {
    expect(ratingReason([read('a')], withDate('soon'), now, { sessionId: 'a' })).toBeNull();
  });
});

describe('ratingReason: never', () => {
  const two = [run('a'), run('b')];

  it('in a launch with a too-short read or an error', () => {
    noteRoughPatch();
    expect(ratingReason(two, pro, now, { sessionId: 'b' })).toBeNull();
    expect(shouldAskForRating(two, pro, now, { sessionId: 'b', rough: false })).toBe(true);
  });

  it('within 120 days of the last ask', () => {
    expect(ratingReason(two, { ...pro, ratingAsks: [now - 119 * DAY] }, now, { sessionId: 'b' })).toBeNull();
    expect(ratingReason(two, { ...pro, ratingAsks: [now - 121 * DAY] }, now, { sessionId: 'b' })).toBe('second_run');
  });

  it('more than 3 times in a year', () => {
    // Three asks in the last 365 days, each 120+ days apart: the cap, not the cooldown, says no.
    const asks = [now - 364 * DAY, now - 243 * DAY, now - 122 * DAY];
    expect(ratingReason(two, { ...pro, ratingAsks: asks }, now, { sessionId: 'b' })).toBeNull();
    expect(ratingReason(two, { ...pro, ratingAsks: asks.slice(1) }, now, { sessionId: 'b' })).toBe('second_run');
  });

  it('while the free run’s paywall is still due', () => {
    const free: Profile = { onboarded: true, pro: false, paywallSeen: false, moment: { id: 'interview', date: '2026-10-01', startedAt: 0 } };
    expect(ratingReason([run('a')], free, now, { sessionId: 'a' })).toBeNull();
    expect(ratingReason([run('a')], { ...free, ahaPaywallShown: true }, now, { sessionId: 'a' })).toBe('after_moment');
  });

  it('without a saved session to stand on', () => {
    expect(ratingReason(two, pro, now, { sessionId: 'missing' })).toBeNull();
  });
});

describe('maybeAskForRating', () => {
  it('records and tracks nothing until the store prompt is really shown (expo-store-review not installed)', async () => {
    const update = jest.fn(async () => {});
    expect(await maybeAskForRating({ sessions: [run('a'), run('b')], profile: pro, update, sessionId: 'b', now })).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it('the reason survives sanitise() as a short code', () => {
    expect(sanitise({ reason: 'second_run' })).toEqual({ reason: 'second_run' });
    expect(sanitise({ reason: 'after_moment' })).toEqual({ reason: 'after_moment' });
    expect(sanitise({ reason: 'Tell me about yourself' })).toEqual({});
  });
});
