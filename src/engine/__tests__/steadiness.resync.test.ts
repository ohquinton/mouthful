// Steadiness after Glide resyncs. These drive the real aligner and stamp `reachedAt` the way the
// session screen does (the first time the pointer passes each word), so a jump over a gap stamps
// every gap word with the moment the anchor was heard, and a later re-read inks (backfills) them
// without stamping them again.
import { align, preparePassage } from '../align';
import { paceSegments, paceSteadiness } from '../steadiness';

const TEXT =
  'Mara steadied the lantern and walked slowly down the long hallway. ' + // 0–10
  'Nobody panicked when the generator finally coughed into life again. ' + // 11–20
  'The children counted candles while their parents carried water upstairs quietly. ' + // 21–31
  'Morning arrived grey and cold, but everyone had slept somewhere warm.'; // 32–42
const p = preparePassage(TEXT);
const keys = p.map((w) => w.key);
const range = (s: number, e: number) => Array.from({ length: e - s }, (_, i) => s + i);

/**
 * The reader says passage words in this order, one every `ms`, with a breath (`breathMs` extra)
 * after each full stop or comma they say. Returns what the session screen would pass in.
 */
function session(order: number[], ms = 400, breathMs = 600) {
  const reachedAt: (number | undefined)[] = [];
  const heard: string[] = [];
  let prev = 0;
  let t = 0;
  let a = align(p, heard);
  order.forEach((k, i) => {
    if (i > 0) t += ms + (p[order[i - 1]].breathAfter ? breathMs : 0);
    heard.push(keys[k]);
    a = align(p, heard);
    for (let j = prev; j < a.next; j++) reachedAt[j] ??= t;
    prev = a.next;
  });
  return { reachedAt, status: a.status };
}

/** Stamps words as a recogniser that sends three at a time would: each group when its last word arrives. Groups restart each sentence. */
function inThrees(at: number[]): number[] {
  const out: number[] = [];
  let s = 0;
  for (let k = 0; k < p.length; k++) {
    if (k > 0 && p[k - 1].sentenceEnd) s = k;
    let last = s + Math.floor((k - s) / 3) * 3 + 2;
    while (last > k && (last >= p.length || p.slice(k, last).some((w) => w.sentenceEnd))) last--;
    out.push(at[last]);
  }
  return out;
}

const allRead = p.map(() => 'read' as const);
const near = (wpm: number, target: number) => Math.abs(wpm - target) <= target * 0.1;

describe('steadiness after a resync', () => {
  it('reads a clean session at the reader’s pace (baseline for the cases below)', () => {
    const s = session(range(0, p.length));
    expect(paceSegments(p, s.reachedAt, s.status).map((x) => x.wpm)).toEqual([150, 150, 150, 150]);
  });

  it('doesn’t call a sentence rushed when the reader skipped words, read on, then went back and said them', () => {
    // "panicked when the generator finally" dropped, Glide resyncs on "coughed into life", the
    // reader sees red, goes back to "Nobody" and re-reads to the end. Every word ends up inked.
    const s = session([...range(0, 12), ...range(17, 22), ...range(11, p.length)]);
    expect(s.status.every((x) => x === 'read')).toBe(true); // backfilled: the raw status no longer says skipped
    const segs = paceSegments(p, s.reachedAt, s.status);
    expect(segs.every((x) => near(x.wpm, 150))).toBe(true);
    const steady = paceSteadiness(segs);
    if (steady) expect(steady.score).toBeGreaterThanOrEqual(90);
  });

  it('doesn’t call a sentence rushed when a lookahead skip is later backfilled', () => {
    // "the generator" dropped (within the lookahead), then the reader backs up two words and says them.
    const s = session([...range(0, 14), ...range(16, 19), ...range(14, p.length)]);
    const segs = paceSegments(p, s.reachedAt, s.status);
    expect(segs.every((x) => near(x.wpm, 150))).toBe(true);
  });

  it('doesn’t show a falsely fast or slow stretch when a skipped clause stays red', () => {
    const s = session([...range(0, 12), ...range(17, p.length)]);
    expect(s.status.slice(12, 17).every((x) => x === 'skipped')).toBe(true);
    const segs = paceSegments(p, s.reachedAt, s.status);
    expect(segs.every((x) => near(x.wpm, 150))).toBe(true);
  });

  it('doesn’t call a sentence rushed when Glide jumps a skipped line right after a full stop', () => {
    // The reader drops the whole start of sentence three and picks up at "carried water upstairs".
    const s = session([...range(0, 21), ...range(28, p.length)]);
    const segs = paceSegments(p, s.reachedAt, s.status);
    expect(segs.every((x) => near(x.wpm, 150))).toBe(true);
  });
});

describe('steadiness after a resync: the opposite errors', () => {
  it('still sees a reader who really rushes a sentence, even when the recogniser sends words in threes', () => {
    // Sentence three at 240 wpm, the rest at 150; each recogniser result carries three words.
    const at: number[] = [];
    let t = 0;
    for (let k = 0; k < p.length; k++) {
      if (k > 0) t += (k >= 22 && k <= 31 ? 250 : 400) + (p[k - 1].breathAfter ? 600 : 0);
      at.push(t);
    }
    const burst = inThrees(at); // stamped when the third arrives
    const segs = paceSegments(p, burst, allRead);
    const fast = segs.find((x) => x.start === 21)!;
    expect(fast.wpm).toBeGreaterThan(200);
  });

  it('doesn’t make a bursty recogniser look slow: words in groups of three, arriving on time', () => {
    const at: number[] = [];
    let t = 0;
    for (let k = 0; k < p.length; k++) {
      if (k > 0) t += 400 + (p[k - 1].breathAfter ? 600 : 0);
      at.push(t);
    }
    const burst = inThrees(at);
    const segs = paceSegments(p, burst, allRead);
    expect(segs.length).toBeGreaterThanOrEqual(3);
    expect(segs.every((x) => x.wpm >= 120)).toBe(true);
  });

  it('leaves a jittery bursty recogniser’s timing as it was: no burst is mistaken for a jump', () => {
    // Groups of three, each result early or late by up to 300 ms (fixed pattern, no randomness).
    const at: number[] = [];
    let t = 0;
    for (let k = 0; k < p.length; k++) {
      if (k > 0) t += 400 + (p[k - 1].breathAfter ? 600 : 0);
      at.push(t);
    }
    const jitter = [300, -300, 150, -150, 0, 250, -250];
    const burst = inThrees(at).map((x, k, all) => {
      const g = all.indexOf(x); // same jitter for the whole group
      return x + jitter[g % jitter.length];
    });
    // Without statuses nothing is treated as a jump, so this compares against the old timing.
    expect(paceSegments(p, burst, allRead)).toEqual(paceSegments(p, burst));
    expect(paceSegments(p, burst, allRead)).toHaveLength(4);
  });

  it('still sees a sentence the reader really dragged, after a skip that stayed red', () => {
    // "panicked when the generator finally" dropped; sentence three read at 90 wpm.
    const order = [...range(0, 12), ...range(17, p.length)];
    const reachedAt: (number | undefined)[] = [];
    const heard: string[] = [];
    let prev = 0;
    let t = 0;
    let a = align(p, heard);
    order.forEach((k, i) => {
      if (i > 0) t += (k >= 22 && k <= 31 ? 667 : 400) + (p[order[i - 1]].breathAfter ? 600 : 0);
      heard.push(keys[k]);
      a = align(p, heard);
      for (let j = prev; j < a.next; j++) reachedAt[j] ??= t;
      prev = a.next;
    });
    const slow = paceSegments(p, reachedAt, a.status).find((x) => x.start === 21)!;
    expect(slow.wpm).toBeLessThan(100);
  });
});
