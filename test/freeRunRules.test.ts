// The free run's newer rules (qa-critic's review of aha before paywall): how far a read must get
// to count, the part 2+ wall, cold-read deep links, the paywall's feature param, step 3 with a
// script already saved, and the aha paywall after the app was killed on the Tape.

import {
  ahaPaywallDue,
  ahaPaywallRoute,
  ahaPending,
  canColdRead,
  partReached,
  rehearseWall,
  scriptStepOptions,
  upsellFeature,
  UPSELL,
} from '../src/pro';

// pro.ts imports the router for requirePro(); the real one needs React Native.
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));

const run = (passageId: string, id = passageId) => ({ id, passageId });

describe('partReached: how far a read must get to count as a run', () => {
  // 10 words; sentences end at index 3 and 9, so the last sentence starts at index 4.
  const ends = [false, false, false, true, false, false, false, false, false, true];

  it('counts at 80% of the words', () => {
    expect(partReached(8, ends)).toBe(true);
    expect(partReached(10, ends)).toBe(true);
  });

  it('counts once Glide is into the last sentence, even under 80%', () => {
    expect(partReached(5, ends)).toBe(true);
  });

  it('does not count an early Finish', () => {
    expect(partReached(0, ends)).toBe(false);
    expect(partReached(4, ends)).toBe(false); // first sentence done, the last not started
  });

  it('has only the 80% rule for a one-sentence part, and nothing for an empty one', () => {
    const one = [false, false, false, false, true];
    expect(partReached(1, one)).toBe(false);
    expect(partReached(3, one)).toBe(false);
    expect(partReached(4, one)).toBe(true);
    expect(partReached(0, [])).toBe(false);
  });

  it('answers the qa-critic case: 15 words into a 150-word part is not a run', () => {
    const part = Array.from({ length: 150 }, (_, i) => (i + 1) % 15 === 0);
    expect(partReached(15, part)).toBe(false);
    expect(partReached(120, part)).toBe(true);
  });
});

describe('rehearseWall', () => {
  it('says "your free run is part 1" for part 2+ while the run is unused', () => {
    expect(rehearseWall({ sessions: [], passageId: 's.1.1' })).toBe('parts');
    expect(rehearseWall({ sessions: [{ passageId: 's.1.0', partReached: false }], passageId: 's.1.2' })).toBe('parts');
    expect(UPSELL.parts.line).toBe('Your free run is part 1. Rehearse every part with Pro.');
  });

  it('says the free run is done once it is', () => {
    expect(rehearseWall({ sessions: [run('s.1.0')], passageId: 's.1.1' })).toBe('rehearse');
    expect(rehearseWall({ sessions: [run('s.1.0')], passageId: 's.2.0' })).toBe('rehearse');
  });
});

describe('canColdRead', () => {
  it('is Pro, except the moment’s own final run-through', () => {
    expect(canColdRead({ pro: true, passageId: 'night-shift' })).toBe(true);
    expect(canColdRead({ pro: false, passageId: 'night-shift' })).toBe(false);
    expect(canColdRead({ pro: false, passageId: 'w.interview.1', retestPassageId: 'w.interview.1' })).toBe(true);
  });

  it('does not let a deep link with cold=1 ride on the moment’s free step', () => {
    expect(canColdRead({ pro: false, passageId: 'night-shift', retestPassageId: 'w.interview.1' })).toBe(false);
    expect(canColdRead({ pro: false, passageId: 'w.raise.1', retestPassageId: 'w.interview.1' })).toBe(false);
  });
});

describe('upsellFeature (the paywall’s feature param)', () => {
  it('knows our soft walls', () => {
    expect(upsellFeature('scripts')).toBe('scripts');
    expect(upsellFeature('parts')).toBe('parts');
  });

  it('ignores names UPSELL only inherits, and junk', () => {
    for (const p of ['toString', 'constructor', '__proto__', 'hasOwnProperty', 'valueOf', '', 'nope', undefined]) {
      expect(upsellFeature(p)).toBeUndefined();
    }
  });
});

describe('plan step 3 with a script already saved', () => {
  it('lets a free reader use the script they added from the Scripts tile, without a second one', () => {
    // Added from the Scripts tile with no moment, then started a moment: pick yes, add no.
    expect(scriptStepOptions({ pro: false, scriptCount: 1 })).toEqual({ pick: true, add: false });
  });

  it('offers only a new script when none is saved, and both to Pro', () => {
    expect(scriptStepOptions({ pro: false, scriptCount: 0 })).toEqual({ pick: false, add: true });
    expect(scriptStepOptions({ pro: true, scriptCount: 3 })).toEqual({ pick: true, add: true });
    expect(scriptStepOptions({ pro: true, scriptCount: 0 })).toEqual({ pick: false, add: true });
  });

  it('never lets a free reader add a second script through it', () => {
    for (const n of [1, 2, 5]) expect(scriptStepOptions({ pro: false, scriptCount: n }).add).toBe(false);
  });
});

describe('the aha paywall after the app was killed on the Tape', () => {
  const sessions = [run('baseline', 'day1'), { id: 'early', passageId: 's.7.0', partReached: false }, run('s.7.0', 'firstRun')];

  it('is pending for the free run until it has been shown', () => {
    expect(ahaPending({ profile: { pro: false }, sessions })?.id).toBe('firstRun');
    expect(ahaPending({ profile: { pro: false, ahaPaywallShown: true }, sessions })).toBeUndefined();
  });

  it('skips an early finish: the free run is the first session that counts', () => {
    expect(ahaPaywallDue({ profile: { pro: false }, sessions, sessionId: 'early' })).toBe(false);
    expect(ahaPaywallDue({ profile: { pro: false }, sessions, sessionId: 'firstRun' })).toBe(true);
  });

  it('is never pending for Pro, or with no script run', () => {
    expect(ahaPending({ profile: { pro: true }, sessions })).toBeUndefined();
    expect(ahaPending({ profile: { pro: false }, sessions: [run('baseline')] })).toBeUndefined();
  });

  // A lapsed subscriber: session/[id].tsx sets ahaPaywallShown when a Pro reader saves a script
  // run, so once Pro ends, their old runs don't bring up "you just rehearsed".
  it('stays quiet for a lapsed Pro reader whose script runs set the flag', () => {
    expect(ahaPending({ profile: { pro: false, ahaPaywallShown: true }, sessions: [run('s.3.0'), run('s.3.1')] })).toBeUndefined();
  });

  it('opens once per launch, whoever asks first (the Tape or Today)', () => {
    jest.isolateModules(() => {
      // A fresh copy of pro.ts: a new launch.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const fresh = require('../src/pro') as typeof import('../src/pro');
      expect(fresh.claimAhaPaywall()).toBe(true);
      expect(fresh.claimAhaPaywall()).toBe(false);
      expect(fresh.claimAhaPaywall()).toBe(false);
    });
  });

  it('builds the route with numbers only, and the moment only for its own script', () => {
    const s = { passageId: 's.7.0', wpm: 140, readCount: 98, skippedWords: ['quarterly', 'quarterly'], stumbled: ['quarterly'] };
    expect(ahaPaywallRoute(s, { id: 'interview', startedAt: 0, scriptId: '7' })).toEqual({
      pathname: '/paywall',
      params: { from: 'aha', wpm: '140', words: '100', heard: '98', moment: 'interview' },
    });
    expect(ahaPaywallRoute(s, { id: 'interview', startedAt: 0, scriptId: '8' }).params).not.toHaveProperty('moment');
    expect(ahaPaywallRoute(s, null).params).not.toHaveProperty('moment');
  });
});
