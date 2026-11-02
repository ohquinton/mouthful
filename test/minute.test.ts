// One Minute, app side (src/store/minute.ts): the clock breaks talk.tsx takes out of the heard
// times, the session it saves, "I meant that" on the Tape, and the trend line.
import { tokenise } from '../src/engine/align';
import { FLOW_SCORED, FLOW_VERSION, flowScore, flowSlotsFrom, flowVersionOf, minuteSummary, stampHeard } from '../src/engine/minute';
import type { SavedSession } from '../src/store/sessions';
import { fillerChips, firstWordSeconds, firstWordText, gapAfterBreak, habitCode, minuteRecord, overruleFiller, pastMinutes, savedMinuteLine, usualFor, standingFillers, trendText, withoutBreaks } from '../src/store/minute';

/** n plain words, one every `stepMs` from `from`. */
function talk(n: number, from: number, stepMs = 400): { tokens: string[]; times: number[] } {
  const words = 'we should keep the plan simple and test it with real people before the end of the month'.split(' ');
  const tokens: string[] = [];
  const times: number[] = [];
  for (let k = 0; k < n; k++) {
    tokens.push(words[k % words.length]);
    times.push(from + k * stepMs);
  }
  return { tokens, times };
}

describe('withoutBreaks: a call is never a long pause or talking time', () => {
  // Talk from 1 s to ~20 s, a 60 s call (error card up), Carry on, talk again until the minute ends.
  const before = talk(48, 1000); // last word at 19.8 s
  const pausedAt = 20_500;
  const resumedAt = 80_500;
  const after = talk(80, resumedAt + 1500); // the reader finds their place 1.5 s after Carry on
  const tokens = [...before.tokens, ...after.tokens];
  const wall = [...before.times, ...after.times];
  const brk = { index: before.times.length, awayMs: resumedAt - pausedAt };

  it('without it, the call would be a long pause (the integration trap)', () => {
    const raw = minuteSummary({ tokens, heardTimes: wall, startedAt: 0 })!;
    expect(raw.longPauses).toBe(1);
    expect(raw.longestPauseSeconds).toBeGreaterThan(60);
  });

  it('with it, no long pause and the call is not talk time', () => {
    const t = withoutBreaks(wall, 0, [brk]);
    const m = minuteSummary({ tokens, heardTimes: t.heardTimes, startedAt: t.startedAt })!;
    expect(m.longPauses).toBe(0);
    expect(m.longestPauseSeconds).toBeLessThan(2.5);
    // 19.8 s before + 31.6 s after, with the gap across the break closed.
    expect(m.talkSeconds).toBeCloseTo(51.4, 1);
  });

  it('closes the gap across the break even when the restart took a few seconds', () => {
    const slow = talk(30, resumedAt + 4000); // 4 s after Carry on: still not a pause
    const t = withoutBreaks([...before.times, ...slow.times], 0, [brk]);
    expect(t.heardTimes[brk.index] - t.heardTimes[brk.index - 1]).toBe(0);
    const m = minuteSummary({ tokens: [...before.tokens, ...slow.tokens], heardTimes: t.heardTimes, startedAt: 0 })!;
    expect(m.longPauses).toBe(0);
  });

  it('keeps a real long pause when there was no break', () => {
    const gap = talk(20, 30_000); // 10 s of silence after the last word at 19.8 s, no error card
    const t = withoutBreaks([...before.times, ...gap.times], 0, []);
    expect(minuteSummary({ tokens: [...before.tokens, ...gap.tokens], heardTimes: t.heardTimes, startedAt: 0 })!.longPauses).toBe(1);
  });

  it('a break before the first word moves the start, so the call is not thinking time either', () => {
    const late = talk(40, 70_000);
    const t = withoutBreaks(late.times, 0, [{ index: 0, awayMs: 60_000 }]);
    expect(t.startedAt).toBe(60_000);
    expect(t.heardTimes).toEqual(late.times);
    const m = minuteSummary({ tokens: late.tokens, heardTimes: t.heardTimes, startedAt: t.startedAt })!;
    expect(m.talkSeconds).toBeCloseTo(10 + 39 * 0.4, 1);
  });

  it('two breaks are both taken out; a break with nothing after it changes nothing', () => {
    const a = talk(20, 1000); // to 8.6 s
    const b = talk(20, 40_000); // card up 9 s → 39 s
    const c = talk(20, 80_000); // card up 17 s → 79 s
    const wall2 = [...a.times, ...b.times, ...c.times];
    const t = withoutBreaks(wall2, 0, [
      { index: 20, awayMs: 30_000 },
      { index: 40, awayMs: 32_000 },
      { index: 60, awayMs: 5_000 },
    ]);
    const m = minuteSummary({ tokens: [...a.tokens, ...b.tokens, ...c.tokens], heardTimes: t.heardTimes, startedAt: 0 })!;
    expect(m.longPauses).toBe(0);
    expect(t.heardTimes[59]).toBeCloseTo(1000 + 59 * 400 - 2 * 400, 0); // continuous, minus the two closed steps
  });

  it('two breaks with no word between them: both calls come out once, stamps never go backwards', () => {
    const a = talk(20, 1000); // to 8.6 s
    const b = talk(20, 9000 + 10_000 + 20_000 + 1000); // card up 10 s, Carry on, card up again 20 s, Carry on
    const wall2 = [...a.times, ...b.times];
    const breaks = [{ index: 20, awayMs: 10_000 }, { index: 20, awayMs: 20_000 }];
    const t = withoutBreaks(wall2, 0, breaks);
    for (let k = 1; k < t.heardTimes.length; k++) expect(t.heardTimes[k]).toBeGreaterThanOrEqual(t.heardTimes[k - 1]);
    expect(t.heardTimes[20]).toBe(t.heardTimes[19]);
    expect(gapAfterBreak(wall2, breaks, 20)).toBe(wall2[20] - wall2[19] - 30_000);
  });

  it('does not change the stamps it was given (talk.tsx keeps them for a retry check)', () => {
    const copy = wall.slice();
    withoutBreaks(wall, 0, [brk]);
    expect(wall).toEqual(copy);
  });

  it('stampHeard + a frozen clock while the card is up: words that land during the break do not jump', () => {
    // talk.tsx stamps with `pausedAt || Date.now()`, so a late result during the card gets the pause time.
    let times: number[] = [];
    times = stampHeard(times, 5, 1000);
    times = stampHeard(times, 6, pausedAt); // arrived while the card was up
    expect(times).toEqual([1000, 1000, 1000, 1000, 1000, pausedAt]);
  });
});

/** A finished minute as talk.tsx would save it. */
function savedMinute(transcript: string, over: Partial<SavedSession> = {}): SavedSession {
  const tokens = tokenise(transcript);
  const times = tokens.map((_, k) => 2000 + k * 450);
  const m = minuteSummary({ tokens, heardTimes: times, startedAt: 0 })!;
  return {
    id: 'm1',
    passageId: 'talk',
    title: 'One Minute',
    at: 0,
    wpm: m.wpm,
    fillers: m.umCount,
    fillersPerMin: m.umPerMin,
    accuracy: null,
    pauses: m.longPauses,
    seconds: 60,
    score: 70,
    stumbled: [],
    context: 'talking',
    kind: 'minute',
    flow: m.flow,
    flowVersion: m.flowVersion,
    promptId: 'p07',
    level: 1,
    overruled: [],
    minute: minuteRecord(m),
    ...over,
  };
}

const FILLERS =
  'the meeting like went for two hours and like the client said no and it was like huge so we tried again and you know like it was a mess but we fixed it in the end';

describe('the saved minute', () => {
  const s = savedMinute(FILLERS);

  it('keeps numbers and habit-word codes only, never the words around them', () => {
    const json = JSON.stringify(s.minute);
    for (const w of ['meeting', 'client', 'huge', 'mess', 'fixed']) expect(json).not.toContain(w);
    expect(s.minute!.habitFillers.length).toBeGreaterThanOrEqual(3);
    for (const f of s.minute!.habitFillers) expect(Number.isInteger(f.index)).toBe(true);
  });

  it('has Flow, its version and the summary numbers; old sessions without them still read', () => {
    expect(typeof s.flow).toBe('number');
    expect(s.flowVersion).toBe(FLOW_VERSION);
    const old: SavedSession = { ...s, kind: undefined, flow: undefined, minute: undefined, overruled: undefined };
    expect(standingFillers(old)).toEqual([]);
    expect(fillerChips(old)).toEqual([]);
    expect(savedMinuteLine(old)).toBe('');
    expect(overruleFiller(old, 3)).toBe(old);
  });

  it('chips group by word, most first, each pointing at its earliest standing occurrence', () => {
    const chips = fillerChips(s);
    const like = chips.find((c) => c.word === 'like')!;
    expect(like.count).toBeGreaterThanOrEqual(3);
    expect(like.next).toBe(Math.min(...s.minute!.habitFillers.filter((f) => f.word === 'like').map((f) => f.index)));
    for (let k = 1; k < chips.length; k++) expect(chips[k - 1].count).toBeGreaterThanOrEqual(chips[k].count);
  });
});

describe('"I meant that" (overruleFiller)', () => {
  // Brief criterion 2b: 3 likely fillers + 1 overrule → shown count 2; a scored Flow equals Flow computed with 2.
  const base = savedMinute('it was like huge and like we had no time to plan it and the meeting like went for two hours in the end');

  it('needs a fixture with exactly 3 likely fillers', () => {
    expect(base.minute!.habitFillers.map((f) => f.word)).toEqual(['like', 'like', 'like']);
  });

  it('3 fillers, 1 meant → shows 2; saves the index, not the word', () => {
    const first = base.minute!.habitFillers[0].index;
    const next = overruleFiller(base, first);
    expect(next.overruled).toEqual([first]);
    expect(fillerChips(next)).toEqual([{ word: 'like', count: 2, next: base.minute!.habitFillers[1].index }]);
  });

  it('while the habit slot is shown, Flow does not move', () => {
    const next = overruleFiller(base, base.minute!.habitFillers[0].index);
    expect(next.flow).toBe(base.flow);
  });

  it('once the habit slot is scored, Flow equals Flow computed with 2 fillers', () => {
    const scored = flowSlotsFrom([...FLOW_SCORED, 'habit']);
    const version = flowVersionOf(scored);
    const s = { ...base, flowVersion: version };
    const next = overruleFiller(s, s.minute!.habitFillers[0].index, scored, version);
    const rate = Math.max(s.minute!.talkSeconds, 30) / 60;
    expect(next.flow).toBe(flowScore({ ...s.minute!.input, habitFillersPerMin: 2 / rate }, scored));
    expect(next.flow).toBeGreaterThan(flowScore({ ...s.minute!.input, habitFillersPerMin: 3 / rate }, scored));
  });

  it('a session from another Flow version saves the tap but keeps its Flow', () => {
    const scored = flowSlotsFrom([...FLOW_SCORED, 'habit']);
    const s = { ...base, flowVersion: '0-old', flow: 55 };
    const next = overruleFiller(s, s.minute!.habitFillers[0].index, scored, flowVersionOf(scored));
    expect(next.overruled).toHaveLength(1);
    expect(next.flow).toBe(55);
  });

  it('ignores a tap on an index already meant, or one that was never a filler', () => {
    const i = base.minute!.habitFillers[0].index;
    const once = overruleFiller(base, i);
    expect(overruleFiller(once, i)).toBe(once);
    expect(overruleFiller(base, 0)).toBe(base); // "it" is not a filler
  });

  it('all three meant → no chips left', () => {
    let s = base;
    for (const f of base.minute!.habitFillers) s = overruleFiller(s, f.index);
    expect(fillerChips(s)).toEqual([]);
    expect(s.overruled).toHaveLength(3);
  });

  it('survives a restart: the saved JSON round-trips to the same chips', () => {
    const next = overruleFiller(base, base.minute!.habitFillers[1].index);
    const reloaded = JSON.parse(JSON.stringify(next)) as SavedSession;
    expect(fillerChips(reloaded)).toEqual(fillerChips(next));
  });

  it('analytics codes for two-word habits have no spaces', () => {
    expect(habitCode('you know')).toBe('you_know');
    expect(habitCode('like')).toBe('like');
  });
});

describe('the clock after Carry on matches Kept going (talk.tsx)', () => {
  // Plays the minute the way talk.tsx runs it: words every 400 ms, a 30 s call, Carry on, the reader
  // picks up 2 s later and talks until the clock on screen reaches 60. The clock is `now - start`,
  // where start moves on by the time away at Carry on and, with this fix, by gapAfterBreak() when
  // the first word after the break is stamped.
  function playMinute(closeGapOnClock: boolean) {
    const stepMs = 400;
    let start = 0;
    let times: number[] = [];
    const breaks: { index: number; awayMs: number }[] = [];
    const clock = (now: number) => (now - start) / 1000;
    let now = 1000;
    while (now <= 20_000) times = stampHeard(times, times.length + 1, (now += stepMs));
    const pausedAt = now + 1000; // call comes in 1 s after the last word
    const resumedAt = pausedAt + 30_000;
    breaks.push({ index: times.length, awayMs: resumedAt - pausedAt });
    start += resumedAt - pausedAt;
    now = resumedAt + 2000; // the recogniser restarts and the reader finds their place
    for (;;) {
      if (clock(now) >= 60) break;
      const before = times.length;
      times = stampHeard(times, before + 1, now);
      if (closeGapOnClock) start += gapAfterBreak(times, breaks, before);
      now += stepMs;
    }
    const t = withoutBreaks(times, 0, breaks);
    const tokens = times.map(() => 'word');
    return minuteSummary({ tokens, heardTimes: t.heardTimes, startedAt: t.startedAt })!;
  }

  it('before the fix, a full minute on the clock ended at Kept going ~57', () => {
    expect(playMinute(false).talkSeconds).toBeLessThan(58);
  });

  it('with the clock moved by the closed gap, a full minute is a full minute', () => {
    expect(playMinute(true).talkSeconds).toBeGreaterThanOrEqual(59.5);
    expect(playMinute(true).longPauses).toBe(0);
  });

  it('gapAfterBreak is 0 when there is no break at that word, or the word is not heard yet', () => {
    expect(gapAfterBreak([0, 400, 800], [{ index: 2, awayMs: 100 }], 1)).toBe(0);
    expect(gapAfterBreak([0, 400], [{ index: 2, awayMs: 100 }], 2)).toBe(0);
    expect(gapAfterBreak([0, 400, 900], [{ index: 0, awayMs: 100 }], 0)).toBe(0);
    expect(gapAfterBreak([0, 400, 900], [{ index: 2, awayMs: 1000 }], 2)).toBe(0); // never negative
  });
});

describe('time to first word on the Tape', () => {
  it('is saved with the minute (savedMinute talks from 2 s)', () => {
    expect(firstWordSeconds(savedMinute(FILLERS))).toBe(2);
  });

  it('older minutes without it show nothing', () => {
    const old = savedMinute(FILLERS);
    const { timeToFirstWordSeconds: _drop, ...minute } = old.minute as NonNullable<SavedSession['minute']> & { timeToFirstWordSeconds?: number };
    expect(firstWordSeconds({ minute })).toBeUndefined();
    expect(firstWordSeconds({ minute: undefined })).toBeUndefined();
    expect(firstWordText(undefined)).toBeNull();
  });

  it('whole seconds, singular for 1, straight away under half a second', () => {
    expect(firstWordText(0.3)).toBe('You started straight away.');
    expect(firstWordText(1.2)).toBe('You started after 1 second.');
    expect(firstWordText(6.5)).toBe('You started after 7 seconds.');
    expect(firstWordText(12)).toBe('You started after 12 seconds.');
  });
});

describe('trend line', () => {
  const m = (id: string, flow: number, flowVersion = FLOW_VERSION): SavedSession => ({ ...savedMinute(FILLERS), id, flow, flowVersion });

  it('counts down to the first comparison, with a singular', () => {
    expect(trendText(null, 0)).toBe('After 3 more One Minute talks, you’ll see how this one compares with your recent ones.');
    expect(trendText(null, 2)).toBe('After 1 more One Minute talk, you’ll see how this one compares with your recent ones.');
  });

  it('says above, below or about the same as your usual', () => {
    expect(trendText({ median: 70, count: 5, delta: 12, direction: 'up' }, 5)).toBe('12 above your usual. Your usual is 70, from your last 5 One Minute talks.');
    expect(trendText({ median: 70, count: 3, delta: -8, direction: 'down' }, 3)).toBe('8 below your usual. Your usual is 70, from your last 3 One Minute talks.');
    expect(trendText({ median: 70, count: 4, delta: 2, direction: 'same' }, 4)).toBe('About the same as your usual. Your usual is 70, from your last 4 One Minute talks.');
    expect(trendText(null, 0)).not.toMatch(/[()]/);
    expect(trendText({ median: 70, count: 4, delta: 2, direction: 'same' }, 4)).not.toMatch(/[()]/);
  });

  it('compares only earlier minutes of the same Flow version', () => {
    const all = [m('a', 60), m('b', 70, '0-old'), { ...m('c', 80), kind: undefined }, m('d', 75), m('e', 90)];
    expect(pastMinutes(all, 4, FLOW_VERSION).map((x) => x.id)).toEqual(['a', 'd']);
    expect(pastMinutes(all, 0, FLOW_VERSION)).toEqual([]);
  });
});


describe('remodel topic talk integration', () => {
  it('retains derived wording after JSON storage and leaves prompt words out', () => {
    const tokens = tokenise('coffee tastes really warm and coffee smells really rich while coffee feels really comforting because coffee makes really simple mornings feel special and really peaceful for everyone around the table');
    const m = minuteSummary({ tokens, heardTimes: tokens.map((_, i) => 1000 + i * 400), startedAt: 0, prompt: 'Coffee' })!;
    const record = JSON.parse(JSON.stringify(minuteRecord(m)));
    expect(record.repeated.map((r: { word: string }) => r.word)).toContain('really');
    expect(record.repeated.map((r: { word: string }) => r.word)).not.toContain('coffee');
    expect(record).not.toHaveProperty('tokens');
    expect(record).not.toHaveProperty('transcript');
    expect(record).not.toHaveProperty('heardTimes');
    expect(record).not.toHaveProperty('prompt');
  });

  it('retains only numeric variety data without an approved precise-word list', () => {
    const { tokens, times } = talk(150, 1000);
    const m = minuteSummary({ tokens, heardTimes: times, startedAt: 0, prompt: 'Coffee' })!;
    const record = minuteRecord(m);
    expect(record.variety).toBeDefined();
    expect(record.variety).not.toHaveProperty('precise');
    expect(Object.values(record.variety!)).toEqual(expect.arrayContaining([expect.any(Number)]));
  });

  it('unwraps saved first-word times for the same-version trend, excluding current and later talks', () => {
    const make = (id: string, first: number, version = FLOW_VERSION): SavedSession => {
      const s = savedMinute(FILLERS, { id, flow: 70, flowVersion: version });
      return { ...s, minute: { ...s.minute!, timeToFirstWordSeconds: first } };
    };
    const current = make('now', 2);
    const { trend } = usualFor(current, [make('a', 4), make('b', 6), make('old', 99, 'old'), make('c', 5), current, make('later', 90)]);
    expect(trend?.firstWord).toEqual({ median: 5, count: 3, delta: -3, direction: 'faster' });
    expect(usualFor(current, [current]).trend).toBeNull();
  });

  it('keeps the late-start coaching signal when rebuilding a saved result', () => {
    const s = savedMinute(FILLERS);
    const late = { ...s, minute: { ...s.minute!, talkSeconds: 55, longPauses: 0, wpm: 140, timeToFirstWordSeconds: 30 } };
    expect(savedMinuteLine(late)).toMatch(/Start within/);
  });
});
