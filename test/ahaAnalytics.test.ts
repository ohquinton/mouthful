// Aha before paywall, criterion 8: the new events carry counts and short codes only.
// A script's title is the reader's own text, so it must never survive sanitise().
import { sanitise, track } from '../src/analytics';
import { paywallFrom, trackFreeRunComplete, trackPaywallClose, trackPaywallView, upsellFeature } from '../src/pro';

// The real sanitise, a recorded track: the tests below call the same functions the screens call
// (session/[id].tsx, paywall.tsx) and check exactly what they hand to track().
jest.mock('../src/analytics', () => ({ ...jest.requireActual('../src/analytics'), track: jest.fn() }));
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
const tracked = track as jest.MockedFunction<typeof track>;

/** The one call since the last clear, and proof that sanitise keeps every property of it. */
function onlyCall() {
  expect(tracked).toHaveBeenCalledTimes(1);
  const [name, props = {}] = tracked.mock.calls[0];
  expect(sanitise(props)).toEqual(props);
  return { name, props };
}

beforeEach(() => tracked.mockClear());

describe('aha-before-paywall analytics', () => {
  it('drops a script title passed as a property, on any key', () => {
    const title = 'My interview: why I left Acme';
    const out = sanitise({ moment: 'interview', title, script: title, feature: title, from: 'aha', words: 123 });
    expect(out).toEqual({ moment: 'interview', from: 'aha', words: 123 });
    expect(JSON.stringify(out)).not.toContain('Acme');
  });

  it('drops a title even when it looks like a code, if the key is not allowlisted', () => {
    expect(sanitise({ title: 'standup' })).toEqual({});
  });

  it('keeps script_saved’s free flag', () => {
    expect(sanitise({ words: 140, parts: 1, moment: null, free: true })).toEqual({ words: 140, parts: 1, moment: null, free: true });
  });
});

describe('the track() calls themselves', () => {
  it('free_run_complete: numbers and the moment code, minutes since Day 1', () => {
    const day1At = 1_000_000;
    trackFreeRunComplete({ moment: 'interview', words: 148, parts: 3, wpm: 142, stumbled: 2, day1At, now: day1At + 37 * 60_000 });
    expect(onlyCall()).toEqual({
      name: 'free_run_complete',
      props: { moment: 'interview', words: 148, parts: 3, wpm: 142, stumbled: 2, minutes_since_day1: 37 },
    });
  });

  it('free_run_complete without a Day 1 or a moment', () => {
    trackFreeRunComplete({ moment: null, words: 80, parts: null, wpm: 130, stumbled: 0 });
    expect(onlyCall().props).toEqual({ moment: null, words: 80, parts: null, wpm: 130, stumbled: 0, minutes_since_day1: null });
  });

  it('paywall_view: from aha, from a soft wall, from You', () => {
    trackPaywallView(paywallFrom('aha', upsellFeature(undefined)), undefined, false);
    expect(onlyCall()).toEqual({ name: 'paywall_view', props: { from: 'aha', feature: 'main', has_day1: false } });

    tracked.mockClear();
    const feature = upsellFeature('parts');
    trackPaywallView(paywallFrom(undefined, feature), feature, true);
    expect(onlyCall()).toEqual({ name: 'paywall_view', props: { from: 'soft', feature: 'parts', has_day1: true } });

    tracked.mockClear();
    trackPaywallView(paywallFrom(undefined, upsellFeature('toString')), upsellFeature('toString'), false);
    expect(onlyCall()).toEqual({ name: 'paywall_view', props: { from: 'you', feature: 'main', has_day1: false } });
  });

  it('paywall_close: the same codes and whole seconds', () => {
    trackPaywallClose('aha', undefined, 10_000, 22_400);
    expect(onlyCall()).toEqual({ name: 'paywall_close', props: { from: 'aha', feature: 'main', seconds: 12 } });

    tracked.mockClear();
    trackPaywallClose('soft', 'rehearse', 0, 499);
    expect(onlyCall()).toEqual({ name: 'paywall_close', props: { from: 'soft', feature: 'rehearse', seconds: 0 } });
  });

  it('a from param that is not "aha" never becomes aha', () => {
    expect(paywallFrom('AHA', undefined)).toBe('you');
    expect(paywallFrom('aha ', 'scripts')).toBe('soft');
  });
});
