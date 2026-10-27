import { preparePassage, WordStatus } from '../align';
import { coachingLine } from '../score';
import { paceSegments, paceSteadiness, PaceSegment } from '../steadiness';

// Four 10-word sentences.
const TEXT = [
  'One two three four five six seven eight nine ten.',
  'One two three four five six seven eight nine ten.',
  'One two three four five six seven eight nine ten.',
  'One two three four five six seven eight nine ten.',
].join(' ');
const words = preparePassage(TEXT);

/** When each word was reached, reading each sentence at its own pace (wpm), with a 1 s breath between. */
function readAt(paces: number[]): number[] {
  const at: number[] = [];
  let t = 0;
  paces.forEach((wpm, s) => {
    for (let k = 0; k < 10; k++) {
      at[s * 10 + k] = t;
      if (k < 9) t += 60_000 / wpm;
    }
    t += 1000;
  });
  return at;
}

const seg = (wpm: number[]): PaceSegment[] => wpm.map((w, i) => ({ start: i * 10, end: i * 10 + 9, wpm: w }));

describe('paceSegments', () => {
  it('measures each sentence on its own, leaving out the breath between them', () => {
    const s = paceSegments(words, readAt([150, 150, 150, 150]));
    expect(s.map((x) => x.wpm)).toEqual([150, 150, 150, 150]);
    expect(s[1]).toMatchObject({ start: 10, end: 19 });
  });

  it('shows where the reader sped up', () => {
    const s = paceSegments(words, readAt([140, 140, 200, 140]));
    expect(s.map((x) => x.wpm)).toEqual([140, 140, 200, 140]);
  });

  it('skips a sentence the reader never reached', () => {
    const at = readAt([150, 150, 150, 150]).slice(0, 25);
    expect(paceSegments(words, at)).toHaveLength(2);
  });

  it('skips a sentence that arrived in one burst, because its timing is the recogniser’s, not the reader’s', () => {
    const at = readAt([150, 150, 150, 150]);
    for (let k = 20; k < 30; k++) at[k] = at[20];
    expect(paceSegments(words, at).map((x) => x.start)).toEqual([0, 10, 30]);
  });

  it('joins short sentences so each measured stretch has enough words', () => {
    const short = preparePassage('Yes. We can. One two three four five six seven eight nine ten.');
    const at = short.map((_, i) => i * 400);
    const s = paceSegments(short, at);
    expect(s).toHaveLength(1);
    expect(s[0]).toMatchObject({ start: 0, end: short.length - 1 });
  });

  it('doesn’t count a breath inside a joined stretch as slow speaking', () => {
    // "Nobody panicked." joins the next sentence; the reader breathes for a full second between them.
    const short = preparePassage('Nobody panicked. One two three four five six seven eight nine ten.');
    const at = short.map((_, i) => i * 400 + (i >= 2 ? 1000 : 0));
    expect(paceSegments(short, at)[0].wpm).toBe(150);
  });

  it('doesn’t count comma pauses as slow speaking either', () => {
    const commas = preparePassage('One two three, four five six, seven eight nine ten.');
    const at = commas.map((_, i) => i * 400 + (i >= 3 ? 700 : 0) + (i >= 6 ? 700 : 0));
    expect(paceSegments(commas, at)[0].wpm).toBe(150);
  });

  it('breaks a very long sentence at a comma', () => {
    const long = preparePassage(
      'One two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen seventeen eighteen nineteen twenty, one two three four five six seven eight nine ten.',
    );
    const s = paceSegments(long, long.map((_, i) => i * 400));
    expect(s.map((x) => x.end)).toEqual([19, 29]);
  });
});

/** All read, except these indices. */
function statuses(n: number, skipped: number[]): WordStatus[] {
  return Array.from({ length: n }, (_, i) => (skipped.includes(i) ? 'skipped' : 'read'));
}

describe('paceSegments: skips and long stops', () => {
  it('doesn’t call a sentence rushed when most of it was skipped', () => {
    // Sentence 3: the reader says words 20, 23, 26 and 29, half a second apart. Glide stamps each
    // skipped word with the time it lands on the next heard one, so those steps take 0 ms.
    const at = readAt([150, 150, 150, 150]);
    const T = at[20];
    [20, 21, 22, 23].forEach((k) => (at[k] = T + (k === 20 ? 0 : 500)));
    [24, 25, 26].forEach((k) => (at[k] = T + 1000));
    [27, 28, 29].forEach((k) => (at[k] = T + 1500));
    const skipped = [21, 22, 24, 25, 27, 28];
    // Without the statuses this looks like 360 wpm.
    expect(paceSegments(words, at).find((x) => x.start === 20)!.wpm).toBeGreaterThan(300);

    const s = paceSegments(words, at, statuses(40, skipped));
    expect(s.every((x) => x.wpm <= 160)).toBe(true);
    expect(paceSteadiness(s)!.score).toBeGreaterThanOrEqual(95);
  });

  it('leaves out a stretch with only a couple of measurable steps left', () => {
    // Words 21–26 skipped; the reader found their place two seconds later and read slowly to the end.
    const at = readAt([150, 150, 150, 150]);
    const T = at[20];
    for (let k = 21; k <= 27; k++) at[k] = T + 2000;
    at[28] = T + 3000;
    at[29] = T + 4000;
    const s = paceSegments(words, at, statuses(40, [21, 22, 23, 24, 25, 26]));
    expect(s.map((x) => x.start)).toEqual([0, 10, 30]);
  });

  it('keeps a stretch with one skipped word, timing the steps either side of it out', () => {
    const at = readAt([150, 150, 150, 150]);
    at[25] = at[26]; // skipped word 25 is stamped when Glide lands on 26
    const s = paceSegments(words, at, statuses(40, [25]));
    expect(s.map((x) => x.wpm)).toEqual([150, 150, 150, 150]);
  });

  it('doesn’t let one long stop mid-sentence tank steadiness: that’s the Pauses tile’s job', () => {
    const at = readAt([150, 150, 150, 150]);
    for (let k = 15; k < 40; k++) at[k] += 20_000; // a 20 s stop between words 14 and 15
    const s = paceSegments(words, at);
    expect(s.map((x) => x.wpm)).toEqual([150, 150, 150, 150]);
    expect(paceSteadiness(s)!.score).toBeGreaterThanOrEqual(95);
  });

  it('still sees a reader who drags a whole sentence word by word', () => {
    const s = paceSegments(words, readAt([150, 150, 60, 150]));
    expect(s.map((x) => x.wpm)).toEqual([150, 150, 60, 150]);
  });

  it('works without statuses, as before', () => {
    const at = readAt([150, 150, 150, 150]);
    expect(paceSegments(words, at, undefined)).toEqual(paceSegments(words, at));
  });
});

describe('paceSegments: passages without full stops', () => {
  it('closes a final run of enough words even without a full stop', () => {
    const tail = preparePassage(`${TEXT} One two three four five six seven eight nine`);
    const s = paceSegments(tail, tail.map((_, i) => i * 400 + Math.floor(i / 10) * 1000));
    expect(s.map((x) => x.end)).toEqual([9, 19, 29, 39, 48]);
  });

  it('still leaves out a short tail: a few words aren’t a pace', () => {
    const tail = preparePassage(`${TEXT} Thanks, everyone.`);
    const s = paceSegments(tail, tail.map((_, i) => i * 400));
    expect(s.map((x) => x.end)).toEqual([9, 19, 29, 39]);
  });

  it('breaks an unpunctuated script into stretches', () => {
    const bare = preparePassage(Array.from({ length: 60 }, (_, i) => `w${i}`).join(' '));
    const s = paceSegments(bare, bare.map((_, i) => i * 400));
    expect(s.length).toBeGreaterThanOrEqual(3);
    expect(s.every((x) => x.wpm === 150)).toBe(true);
    expect(s[s.length - 1].end).toBe(59);
  });
});

describe('paceSteadiness', () => {
  it('gives an even reader a high score', () => {
    expect(paceSteadiness(seg([150, 148, 152, 150]))!.score).toBeGreaterThanOrEqual(95);
  });

  it('gives a reader who rushes one sentence a clearly lower score', () => {
    const even = paceSteadiness(seg([150, 150, 150, 150]))!.score;
    const rushed = paceSteadiness(seg([140, 140, 200, 140]))!.score;
    expect(rushed).toBeLessThan(85);
    expect(rushed).toBeLessThan(even);
  });

  it('names the fastest and slowest stretches and the range', () => {
    const s = paceSteadiness(seg([140, 130, 200, 150]))!;
    expect(s.fastest).toBe(2);
    expect(s.slowest).toBe(1);
    expect([s.low, s.high]).toEqual([130, 200]);
  });

  it('stays quiet with fewer than three stretches: two points are not a pattern', () => {
    expect(paceSteadiness(seg([150, 190]))).toBeUndefined();
  });

  it('never goes below zero', () => {
    expect(paceSteadiness(seg([60, 300, 60, 300]))!.score).toBe(0);
  });
});

describe('coaching on steadiness', () => {
  const base = { wpm: 150, fillersPerMin: 0, accuracy: 98, midSentencePauses: 0, seconds: 40 };

  it('talks about steadiness when the pace wandered and nothing bigger is wrong', () => {
    expect(coachingLine({ ...base, steadiness: 60 })).toMatch(/pace/i);
  });

  it('keeps the old advice when steadiness is fine or unknown', () => {
    expect(coachingLine({ ...base, steadiness: 92 })).toBe(coachingLine(base));
    expect(coachingLine(base)).toBe('Clean read. 150 wpm, no fillers.');
  });

  it('still puts a big overall rush first', () => {
    expect(coachingLine({ ...base, wpm: 200, steadiness: 50 })).toMatch(/^You ran at 200/);
  });
});
