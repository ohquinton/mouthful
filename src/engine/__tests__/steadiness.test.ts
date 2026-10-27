import { preparePassage } from '../align';
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
