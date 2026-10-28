// The free run (docs/briefs/aha-before-paywall.md): a free reader gets one script and one
// completed Glide of its part 1. These are the rules session/[id].tsx, the Tape, PlanCard and
// the scripts screens all call, so there's one answer and no way round it.

import * as pro from '../src/pro';
import {
  ahaCopy,
  ahaNumbers,
  ahaPaywallDue,
  canAddScript,
  canRehearse,
  freeRunUsed,
  isFreeRun,
  isScriptPassage,
  requirePro,
  scriptPart,
  UPSELL,
} from '../src/pro';
import type { Profile } from '../src/store/profile';

// pro.ts imports the router for requirePro(); the real one needs React Native. (jest.mock is
// hoisted above the imports; the `mock` prefix lets the factory use mockPush.)
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

const run = (passageId: string, id = passageId) => ({ id, passageId });
const free = { pro: false };

describe('which passages are script parts', () => {
  it('reads s.<script>.<part> ids', () => {
    expect(isScriptPassage('s.1730000000000.0')).toBe(true);
    expect(scriptPart('s.1730000000000.2')).toBe(2);
    for (const id of ['baseline', 'night-shift', 'w.interview.0', 'talk', 's.', 's.abc.0']) {
      expect(isScriptPassage(id)).toBe(false);
      expect(scriptPart(id)).toBeUndefined();
    }
  });
});

describe('freeRunUsed', () => {
  it('is free with no sessions', () => {
    expect(freeRunUsed([])).toBe(false);
  });

  it('is used by a saved script session, on any part', () => {
    expect(freeRunUsed([run('s.1.0')])).toBe(true);
    expect(freeRunUsed([run('baseline'), run('s.1.3')])).toBe(true);
  });

  it('is not used by sessions that are not scripts', () => {
    expect(freeRunUsed([run('baseline'), run('night-shift'), run('w.interview.0'), run('w.interview.1'), run('talk')])).toBe(false);
  });

  // Too short, Try again and Carry on: session/[id].tsx returns before saveSession when fewer
  // than MIN_WORDS_TO_SCORE words came through, so those attempts never reach the saved list.
  // The rule only looks at saved sessions, so an attempt that wasn't saved can't use the run up.
  it('ignores attempts that were never saved (too short, Try again)', () => {
    const saved = [run('baseline')]; // the too-short script attempt isn't in here
    expect(freeRunUsed(saved)).toBe(false);
    expect(canRehearse({ ...free, sessions: saved, passageId: 's.1.0' })).toBe(true);
  });

  it('stays used after the script is deleted (its sessions stay)', () => {
    // Deleting a script removes it from mouthful.scripts.v1 only; the session list is untouched.
    expect(freeRunUsed([run('s.99.0')])).toBe(true);
    expect(canRehearse({ ...free, sessions: [run('s.99.0')], passageId: 's.100.0' })).toBe(false);
  });
});

describe('canRehearse', () => {
  it('lets a free reader run part 1 once', () => {
    expect(canRehearse({ ...free, sessions: [], passageId: 's.1.0' })).toBe(true);
    expect(canRehearse({ ...free, sessions: [run('s.1.0')], passageId: 's.1.0' })).toBe(false);
  });

  it('never lets a free reader start on part 2 or later', () => {
    expect(canRehearse({ ...free, sessions: [], passageId: 's.1.1' })).toBe(false);
    expect(canRehearse({ ...free, sessions: [], passageId: 's.1.4' })).toBe(false);
  });

  it('always lets Pro rehearse, however many runs', () => {
    const many = [run('s.1.0', 'a'), run('s.1.1', 'b'), run('s.2.0', 'c')];
    expect(canRehearse({ pro: true, sessions: many, passageId: 's.1.0' })).toBe(true);
    expect(canRehearse({ pro: true, sessions: many, passageId: 's.1.3' })).toBe(true);
  });

  it('leaves passages that are not scripts alone (they are gated where they are offered)', () => {
    const used = [run('s.1.0')];
    for (const id of ['baseline', 'night-shift', 'w.interview.1', 'talk']) {
      expect(canRehearse({ ...free, sessions: used, passageId: id })).toBe(true);
    }
  });

  it('knows when a read is the free run', () => {
    expect(isFreeRun({ ...free, sessions: [run('baseline')], passageId: 's.1.0' })).toBe(true);
    expect(isFreeRun({ ...free, sessions: [run('s.1.0')], passageId: 's.1.0' })).toBe(false);
    expect(isFreeRun({ pro: true, sessions: [], passageId: 's.1.0' })).toBe(false);
    expect(isFreeRun({ ...free, sessions: [], passageId: 'night-shift' })).toBe(false);
  });
});

describe('canAddScript', () => {
  it('gives a free reader one script and Pro any number', () => {
    expect(canAddScript({ pro: false, scriptCount: 0 })).toBe(true);
    expect(canAddScript({ pro: false, scriptCount: 1 })).toBe(false);
    expect(canAddScript({ pro: true, scriptCount: 5 })).toBe(true);
  });
});

describe('ahaPaywallDue', () => {
  const sessions = [run('baseline', 'day1'), run('w.interview.0', 'ctx'), run('s.7.0', 'firstRun'), run('s.7.0', 'later')];

  it('is due on the Tape of the free run only', () => {
    expect(ahaPaywallDue({ profile: { pro: false }, sessions, sessionId: 'firstRun' })).toBe(true);
    expect(ahaPaywallDue({ profile: { pro: false }, sessions, sessionId: 'ctx' })).toBe(false);
    expect(ahaPaywallDue({ profile: { pro: false }, sessions, sessionId: 'later' })).toBe(false);
  });

  it('opens once: not again after it has been shown', () => {
    expect(ahaPaywallDue({ profile: { pro: false, ahaPaywallShown: true }, sessions, sessionId: 'firstRun' })).toBe(false);
  });

  it('never for Pro, or when there is no script session', () => {
    expect(ahaPaywallDue({ profile: { pro: true }, sessions, sessionId: 'firstRun' })).toBe(false);
    expect(ahaPaywallDue({ profile: { pro: false }, sessions: [run('baseline', 'day1')], sessionId: 'day1' })).toBe(false);
  });
});

describe('the post-run paywall copy', () => {
  it('counts what they read through, and "I said it" moves words into heard clearly', () => {
    const before = { wpm: 142, readCount: 120, skippedWords: ['quarterly', 'stakeholders', 'quarterly'], stumbled: ['quarterly', 'stakeholders'] };
    expect(ahaNumbers(before)).toEqual({ wpm: 142, words: 123, heard: 120 });
    // What correctSessionWord does for "quarterly" (store/sessions.ts): both skips become reads.
    const after = { ...before, readCount: 122, skippedWords: ['stakeholders'], stumbled: ['stakeholders'] };
    expect(ahaNumbers(after)).toEqual({ wpm: 142, words: 123, heard: 122 });
  });

  it('uses the brief’s headline and lead, with and without a date', () => {
    expect(ahaCopy({ wpm: 142, words: 123, heard: 120, momentShort: 'interview', daysToGo: 3 })).toEqual({
      headline: 'You just rehearsed your own interview at 142 wpm.',
      lead: '123 words, 120 heard clearly. 3 days to go. Rehearse every part until it’s yours.',
    });
    expect(ahaCopy({ wpm: 150, words: 80, heard: 80 })).toEqual({
      headline: 'You just rehearsed your own script at 150 wpm.',
      lead: '80 words, 80 heard clearly. Rehearse every part until it’s yours.',
    });
  });

  it('handles one day, today and a date that has passed', () => {
    expect(ahaCopy({ wpm: 1, words: 1, heard: 1, daysToGo: 1 }).lead).toBe('1 word, 1 heard clearly. 1 day to go. Rehearse every part until it’s yours.');
    expect(ahaCopy({ wpm: 1, words: 2, heard: 1, daysToGo: 0 }).lead).toContain('It’s today.');
    expect(ahaCopy({ wpm: 1, words: 2, heard: 1, daysToGo: -2 }).lead).toBe('2 words, 1 heard clearly. Rehearse every part until it’s yours.');
  });

  it('has the rehearse and scripts soft-wall lines', () => {
    expect(UPSELL.rehearse).toEqual({
      title: 'Rehearse it again',
      line: 'Your free run is done. Rehearse every part as often as you need before the day.',
    });
    expect(UPSELL.scripts.line).toBe('Your first script is free. Add every answer you’re preparing.');
  });
});

describe('requirePro', () => {
  const profile = (pro: boolean): Profile => ({ onboarded: true, pro, paywallSeen: true });
  beforeEach(() => mockPush.mockClear());

  it('lets Pro straight through (cold read goes straight in)', () => {
    expect(requirePro(profile(true), 'cold')).toBe(true);
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('opens the soft wall for a free reader, whatever their streak (no streak lock any more)', () => {
    expect(requirePro(profile(false), 'cold')).toBe(false);
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/paywall', params: { feature: 'cold' } });
  });

  it('no longer exports the cold-read streak', () => {
    expect('COLD_READ_STREAK' in pro).toBe(false);
  });
});
