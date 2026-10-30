// One Minute (docs/briefs/one-minute.md, Revision 2): long pauses, the Flow slots, the coaching
// line, the own-history trend and the summary the Tape shows.

import { tokenise } from '../align';
import { classifyHabits } from '../habits';
import {
  FLOW_SCORED,
  FLOW_SLOTS,
  FLOW_VERSION,
  flowParts,
  flowScore,
  flowSlotsFrom,
  flowVersionOf,
  longPauses,
  minuteLine,
  minuteSummary,
  minuteTrend,
  stampHeard,
  type FlowInput,
} from '../minute';

const S = 1000;

/** Times (ms) for `n` words spread evenly from `from` to `to` seconds. */
function even(n: number, from: number, to: number): number[] {
  return Array.from({ length: n }, (_, k) => Math.round((from + ((to - from) * k) / Math.max(1, n - 1)) * S));
}

/** A clean minute: talked to 60 s, no long pauses, 140 wpm. */
const CLEAN: FlowInput = { keptGoingSeconds: 60, longPauses: 0, wpm: 140, umPerMin: 0, habitFillersPerMin: 0 };

const BAD_WORDS = /pronounc|accent|correct/i;

describe('longPauses', () => {
  it('criterion 1: ignores the thinking time before the first word and counts two 3 s gaps', () => {
    // 4 s of thinking, then words every 0.5 s, with two 3 s gaps.
    const t = [4000, 4500, 5000, 8000, 8500, 9000, 12000, 12500];
    expect(longPauses(t)).toEqual({ count: 2, longestSeconds: 3 });
  });

  it('does not count a gap of exactly 2.5 s (strictly greater)', () => {
    expect(longPauses([0, 2500, 5000, 7500]).count).toBe(0);
    expect(longPauses([0, 2501]).count).toBe(1);
  });

  it('treats a burst of words with one timestamp as no pause, and the gap before the burst as one', () => {
    // Server recognition: 6 words arrive together at 2 s, then 5 together at 6 s.
    const t = [2000, 2000, 2000, 2000, 2000, 2000, 6000, 6000, 6000, 6000, 6000];
    expect(longPauses(t)).toEqual({ count: 1, longestSeconds: 4 });
  });

  it('never counts a negative or out-of-order stamp as a pause, and never double-counts one gap', () => {
    // A late stamp lower than the one before (clock or revision noise) is treated as "same time".
    expect(longPauses([1000, 5000, 4000, 5500]).count).toBe(1);
    expect(longPauses([1000, 5000, 4000, 5500]).longestSeconds).toBe(4);
  });

  it('returns zero for no words or one word', () => {
    expect(longPauses([])).toEqual({ count: 0, longestSeconds: 0 });
    expect(longPauses([9000])).toEqual({ count: 0, longestSeconds: 0 });
  });

  it('reports the longest gap after the first word to one decimal, even under the threshold', () => {
    expect(longPauses([0, 1240, 2000]).longestSeconds).toBe(1.2);
  });

  it('takes a custom threshold', () => {
    expect(longPauses([0, 2000, 4000], { thresholdMs: 1500 }).count).toBe(2);
  });
});

describe('stampHeard', () => {
  it('stamps new words with the result time and keeps earlier stamps through a revision', () => {
    let t = stampHeard([], 3, 1000);
    expect(t).toEqual([1000, 1000, 1000]);
    t = stampHeard(t, 2, 1500); // interim revision drops a word
    expect(t).toEqual([1000, 1000, 1000]);
    t = stampHeard(t, 5, 2000);
    expect(t).toEqual([1000, 1000, 1000, 2000, 2000]);
  });

  it('returns the same array when nothing new was heard, so React state does not churn', () => {
    const t = [1000, 1000];
    expect(stampHeard(t, 2, 5000)).toBe(t);
    expect(stampHeard(t, 1, 5000)).toBe(t);
  });
});

describe('flowScore slots', () => {
  it('launch config: kept going, long pauses and pace are scored; um/uh and habit fillers are shown', () => {
    expect([...FLOW_SCORED].sort()).toEqual(['keptGoing', 'pace', 'pauses']);
    expect(FLOW_SLOTS.um.scored).toBe(false);
    expect(FLOW_SLOTS.habit.scored).toBe(false);
    expect(FLOW_VERSION).toBe(flowVersionOf(FLOW_SLOTS));
    expect(FLOW_VERSION).toMatch(/^[a-z0-9_:-]{1,24}$/i); // an analytics-safe short code
  });

  it('criterion 2: 60 s, no long pauses, 140 wpm is 100, whatever the um/uh and habit counts while shown', () => {
    expect(flowScore(CLEAN)).toBe(100);
    expect(flowScore({ ...CLEAN, umPerMin: 6 })).toBe(100);
    expect(flowScore({ ...CLEAN, habitFillersPerMin: 9 })).toBe(100);
    expect(flowScore({ ...CLEAN, umPerMin: 8, habitFillersPerMin: 8 })).toBe(100);
  });

  it('weights kept going 40, pauses 35, pace 25 at launch', () => {
    // Stopped at 30 s: kept going 50 → 40 × 0.5 = 20 lost.
    expect(flowScore({ ...CLEAN, keptGoingSeconds: 30 })).toBe(80);
    // One long pause costs 25 of the pause slot's 100 → 35 × 0.25 ≈ 9 lost.
    expect(flowScore({ ...CLEAN, longPauses: 1 })).toBe(91);
    // Four or more long pauses empty the slot.
    expect(flowScore({ ...CLEAN, longPauses: 4 })).toBe(65);
    expect(flowScore({ ...CLEAN, longPauses: 9 })).toBe(65);
    // Pace: 190 wpm is 20 over the talking band → paceScore 70 → 25 × 0.3 = 7.5 lost.
    expect(flowScore({ ...CLEAN, wpm: 190 })).toBe(93);
  });

  it('caps kept going at the minute', () => {
    expect(flowScore({ ...CLEAN, keptGoingSeconds: 64 })).toBe(100);
  });

  it('criterion 2 (scored): with the habit slot promoted in a test config, 6 fillers/min lowers Flow', () => {
    const promoted = flowSlotsFrom(['keptGoing', 'pauses', 'pace', 'habit']);
    expect(flowScore(CLEAN, promoted)).toBe(100);
    expect(flowScore({ ...CLEAN, habitFillersPerMin: 6 }, promoted)).toBeLessThan(100);
    // um/uh is still shown in this config, so it still never moves Flow.
    expect(flowScore({ ...CLEAN, umPerMin: 6 }, promoted)).toBe(100);
    expect(flowVersionOf(promoted)).not.toBe(FLOW_VERSION);
  });

  it('a shown slot never moves Flow: renormalising over scored slots only', () => {
    const shown = flowParts({ ...CLEAN, keptGoingSeconds: 30, habitFillersPerMin: 12 });
    const habit = shown.find((p) => p.slot === 'habit')!;
    expect(habit.scored).toBe(false);
    expect(habit.weight).toBe(0);
    expect(shown.filter((p) => p.scored).reduce((a, p) => a + p.weight, 0)).toBeCloseTo(1);
  });

  it('is deterministic: the same input gives the same Flow every time', () => {
    const input: FlowInput = { keptGoingSeconds: 47.3, longPauses: 2, wpm: 112, umPerMin: 2.5, habitFillersPerMin: 1 };
    const first = flowScore(input);
    for (let k = 0; k < 20; k++) expect(flowScore({ ...input })).toBe(first);
  });

  it('never goes outside 0–100', () => {
    expect(flowScore({ keptGoingSeconds: 0, longPauses: 20, wpm: 0, umPerMin: 50, habitFillersPerMin: 50 })).toBe(0);
    const all = flowSlotsFrom(['keptGoing', 'pauses', 'pace', 'um', 'habit']);
    expect(flowScore({ keptGoingSeconds: 0, longPauses: 20, wpm: 0, umPerMin: 50, habitFillersPerMin: 50 }, all)).toBe(0);
    expect(flowScore(CLEAN, all)).toBe(100);
  });
});

describe('minuteLine', () => {
  const ok = { talkSeconds: 60, longPauses: 0, wpm: 140, habitFillersPerMin: 0 };

  it('criterion 3: stopped at 30 s gets the stopped-early line with the seconds', () => {
    expect(minuteLine({ ...ok, talkSeconds: 30 })).toBe("You stopped at 30 s. When you run out, say what you'd add with more time.");
  });

  it('never shows a number that contradicts the line (44.9 s reads as 44 s, not 45)', () => {
    expect(minuteLine({ ...ok, talkSeconds: 44.9 })).toContain('44 s');
    expect(minuteLine({ ...ok, talkSeconds: 45 })).toBe('You kept going the whole minute.');
  });

  it('then 3+ long pauses, then above 185 wpm, else kept going', () => {
    expect(minuteLine({ ...ok, longPauses: 3 })).toBe('When you lose the thread, say the word again and one thing it reminds you of.');
    expect(minuteLine({ ...ok, longPauses: 2, wpm: 186 })).toBe('Breathe between ideas.');
    expect(minuteLine({ ...ok, wpm: 185 })).toBe('You kept going the whole minute.');
    // Order: stopping early beats pauses beats speed.
    expect(minuteLine({ talkSeconds: 20, longPauses: 5, wpm: 200, habitFillersPerMin: 0 })).toMatch(/^You stopped at 20 s/);
    expect(minuteLine({ ...ok, longPauses: 5, wpm: 200 })).toMatch(/^When you lose the thread/);
  });

  it('mentions habit fillers only when that slot is scored', () => {
    const lots = { ...ok, habitFillersPerMin: 8, topHabit: 'like' };
    expect(minuteLine(lots)).toBe('You kept going the whole minute.');
    const promoted = flowSlotsFrom(['keptGoing', 'pauses', 'pace', 'habit']);
    expect(minuteLine(lots, promoted)).toMatch(/like/);
  });

  it('criterion 3: no line ever contains "pronounc", "accent" or "correct"', () => {
    const all = flowSlotsFrom(['keptGoing', 'pauses', 'pace', 'um', 'habit']);
    for (const talkSeconds of [0, 12, 30, 44, 45, 60])
      for (const longPauses of [0, 2, 3, 7])
        for (const wpm of [0, 90, 140, 186, 240])
          for (const habitFillersPerMin of [0, 3, 10])
            for (const slots of [FLOW_SLOTS, all]) {
              const line = minuteLine({ talkSeconds, longPauses, wpm, habitFillersPerMin, topHabit: 'you know' }, slots);
              expect(line).not.toMatch(BAD_WORDS);
              expect(line.length).toBeGreaterThan(0);
            }
  });
});

describe('minuteTrend', () => {
  const v = FLOW_VERSION;
  const s = (flow: number | null | undefined, flowVersion: string | undefined = v) => ({ flow, flowVersion });

  it('criterion 4: null with fewer than 3 past sessions of the same flowVersion', () => {
    expect(minuteTrend([], v)).toBeNull();
    expect(minuteTrend([s(70), s(80)], v)).toBeNull();
    // Other versions and sessions without a flow don't count toward the 3.
    expect(minuteTrend([s(70), s(80), s(90, 'other'), s(null), s(undefined)], v)).toBeNull();
    expect(minuteTrend([s(70), s(80), s(90, undefined)].map((x, k) => (k === 2 ? { flow: 90 } : x)), v)).toBeNull();
  });

  it('criterion 4: compares against the median of the last 5 of that version', () => {
    // Oldest first. The 30 and the other-version 99 must be ignored.
    const past = [s(30), s(60), s(99, 'other'), s(70), s(80), s(65), s(90)];
    const t = minuteTrend(past, v, 85)!;
    expect(t.median).toBe(70); // last 5 of this version: 60 70 80 65 90 → 70
    expect(t.count).toBe(5);
    expect(t.delta).toBe(15);
    expect(t.direction).toBe('up');
  });

  it('averages the middle two for an even count and calls small changes steady', () => {
    const t = minuteTrend([s(60), s(70), s(80), s(90)], v, 76)!;
    expect(t.median).toBe(75);
    expect(t.direction).toBe('same');
    expect(minuteTrend([s(60), s(70), s(80)], v, 60)!.direction).toBe('down');
    expect(minuteTrend([s(60), s(70), s(80)], v)!.delta).toBeUndefined();
  });
});

describe('minuteSummary', () => {
  /** A minute: thinking for `think` s, then `n` words evenly until `end` s. */
  function talk(words: string[], think: number, end: number) {
    const tokens = words;
    return { tokens, heardTimes: even(tokens.length, think, end), startedAt: 0 };
  }
  const filler = (n: number) => Array.from({ length: n }, (_, k) => `word${k}`);

  it('returns nothing under 15 words (no Flow)', () => {
    expect(minuteSummary(talk(filler(14), 1, 10))).toBeNull();
    // Hesitations don't count toward the 15.
    expect(minuteSummary(talk([...filler(14), 'um', 'uh'], 1, 10))).toBeNull();
    expect(minuteSummary(talk(filler(15), 1, 10))).not.toBeNull();
  });

  it('an ESL speaker who thinks 8 s before the first word scores the same as one who starts at once', () => {
    // Both talk at 140 wpm until the minute ends.
    const instant = minuteSummary(talk(filler(140), 0, 60))!;
    const thinker = minuteSummary(talk(filler(Math.round((140 * 52) / 60)), 8, 60))!;
    expect(instant.flow).toBe(100);
    expect(thinker.flow).toBe(instant.flow);
    expect(thinker.longPauses).toBe(0);
    expect(thinker.wpm).toBe(140);
    expect(thinker.talkSeconds).toBe(60);
  });

  it('reports um/uh per minute without letting it move Flow at launch', () => {
    const words = filler(140);
    for (let k = 0; k < 6; k++) words.splice(k * 20, 0, 'um');
    const r = minuteSummary(talk(words, 0, 60))!;
    expect(r.umCount).toBe(6);
    expect(r.umPerMin).toBe(6);
    expect(r.flow).toBe(100);
    expect(r.flowVersion).toBe(FLOW_VERSION);
  });

  it('counts long pauses, kept going and the coaching line from the times', () => {
    const tokens = filler(60);
    const times = [...even(30, 2, 15), ...even(30, 19, 40)]; // one 4 s gap, stops at 40 s
    const r = minuteSummary({ tokens, heardTimes: times, startedAt: 0 })!;
    expect(r.longPauses).toBe(1);
    expect(r.longestPauseSeconds).toBe(4);
    expect(r.talkSeconds).toBe(40);
    expect(r.line).toMatch(/^You stopped at 40 s/);
  });

  it('measures from startedAt, so the app can use any clock', () => {
    const a = minuteSummary(talk(filler(140), 0, 60))!;
    const b = minuteSummary({ ...talk(filler(140), 0, 60), heardTimes: even(140, 0, 60).map((t) => t + 1_700_000_000_000), startedAt: 1_700_000_000_000 })!;
    expect(b).toEqual(a);
  });

  describe('habit fillers', () => {
    // "like" between "was" and an adjective with a burst: the classifier calls these fillers.
    const habitText =
      'so the queue was like huge and the room was like packed and the noise was like crazy and then i went home and slept for a long time after that because it was late';
    const tokens = tokenise(habitText);
    const fillers = classifyHabits(tokens).filter((r) => r.label === 'filler');

    it('uses the classifier labels and counts only "filler"', () => {
      expect(fillers.length).toBe(3); // sanity check of the fixture against habits.ts
      const r = minuteSummary({ tokens, heardTimes: even(tokens.length, 0, 15), startedAt: 0 })!;
      expect(r.habits.filler).toBe(3);
      expect(r.habits.byWord.like?.filler).toBe(3);
      expect(r.habitFillersPerMin).toBe(6); // 3 over the 30 s floor
    });

    it('criterion 2b: 3 likely fillers + 1 "I meant that" shows 2, and scored Flow equals Flow with 2', () => {
      const promoted = flowSlotsFrom(['keptGoing', 'pauses', 'pace', 'habit']);
      const times = even(tokens.length, 0, 15);
      const r = minuteSummary({ tokens, heardTimes: times, startedAt: 0, overruled: [fillers[0].index], slots: promoted })!;
      expect(r.habits.filler).toBe(2);
      expect(r.habits.overruled).toBe(1);
      expect(r.habits.byWord.like?.filler).toBe(2);
      expect(r.flow).toBe(flowScore({ ...r.input, habitFillersPerMin: (2 / 30) * 60 }, promoted));
      const none = minuteSummary({ tokens, heardTimes: times, startedAt: 0, slots: promoted })!;
      expect(r.flow).toBeGreaterThan(none.flow);
    });

    it('an overrule on a word that was not a filler changes nothing', () => {
      const real = classifyHabits(tokens).find((r) => r.label !== 'filler');
      const times = even(tokens.length, 0, 15);
      const r = minuteSummary({ tokens, heardTimes: times, startedAt: 0, overruled: [real ? real.index : 0, 9999] })!;
      expect(r.habits.filler).toBe(3);
      expect(r.habits.overruled).toBe(0);
    });

    it('"unsure" labels never lower a promoted Flow', () => {
      const promoted = flowSlotsFrom(['keptGoing', 'pauses', 'pace', 'habit']);
      // Single, spaced "actually" / "kind of" uses: discourse or hedges, never filler.
      const words = tokenise(
        'actually i think the plan is kind of risky but we can try it and see what happens next week with the team and the budget we have',
      );
      const labels = classifyHabits(words).map((r) => r.label);
      expect(labels).not.toContain('filler');
      expect(labels).toContain('unsure');
      const r = minuteSummary({ tokens: words, heardTimes: even(words.length, 0, 60), startedAt: 0, slots: promoted })!;
      const plain = flowScore({ ...r.input, habitFillersPerMin: 0 }, promoted);
      expect(r.flow).toBe(plain);
    });
  });
});
