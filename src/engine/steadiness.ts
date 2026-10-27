// Pace steadiness: does the reader hold one speed, or rush some sentences and drag others?
// An average wpm hides this, so we time each stretch of the passage on its own.
import type { PassageWord } from './align';

/** One measured stretch of the passage: word indices (inclusive) and its pace. */
export type PaceSegment = { start: number; end: number; wpm: number };

export type Steadiness = {
  score: number; // 0–100, higher is steadier
  low: number; // slowest stretch, wpm
  high: number; // fastest stretch, wpm
  fastest: number; // index into the segments
  slowest: number;
};

// A stretch closes at a full stop once it has this many words, so one-word sentences
// ("Yes.") join the next one. Short stretches are mostly recogniser timing noise.
const MIN_WORDS = 8;
// A very long sentence also closes at a comma, so one run-on doesn't hide a rush.
const LONG_WORDS = 20;
// Recognisers deliver words in bursts. A stretch that "took" under this long arrived
// in one burst, so its timing says nothing about the reader.
const MIN_SECONDS = 1.5;

/**
 * Splits the passage into stretches and times each one using when Glide reached each word
 * (`reachedAt`, ms). Breaths at commas and full stops are left out on purpose: pausing
 * there is good, not slow. So this is speaking speed between breaths.
 */
export function paceSegments(passage: PassageWord[], reachedAt: (number | undefined)[]): PaceSegment[] {
  const out: PaceSegment[] = [];
  let start = 0;
  for (let i = 0; i < passage.length; i++) {
    const count = i - start + 1;
    const w = passage[i];
    const close = (w.sentenceEnd && count >= MIN_WORDS) || (w.breathAfter && count >= LONG_WORDS);
    if (!close) continue;
    // Only stretches the reader got all the way through: a half-read sentence isn't a pace.
    if (reachedAt[start] === undefined || reachedAt[i] === undefined) {
      start = i + 1;
      continue;
    }
    // Time each word-to-word step inside a phrase. Steps after a comma or full stop are
    // breaths, which the Pauses tile already covers, so they don't make the speaking "slow".
    let ms = 0;
    let steps = 0;
    for (let k = start; k < i; k++) {
      const a = reachedAt[k];
      const b = reachedAt[k + 1];
      if (a === undefined || b === undefined || passage[k].breathAfter) continue;
      ms += b - a;
      steps++;
    }
    if (ms / 1000 >= MIN_SECONDS) out.push({ start, end: i, wpm: Math.round((steps / (ms / 1000)) * 60) });
    start = i + 1;
  }
  return out;
}

/**
 * How even the pace was across stretches. Score = 100 × (1 − 2 × coefficient of variation):
 * stretches all within ~2.5% of each other score about 95; one sentence rushed 30% faster
 * than the rest lands in the 60s. Needs three stretches, because two points aren't a pattern.
 */
export function paceSteadiness(segments: PaceSegment[]): Steadiness | undefined {
  if (segments.length < 3) return undefined;
  const w = segments.map((s) => s.wpm);
  const mean = w.reduce((a, b) => a + b, 0) / w.length;
  const sd = Math.sqrt(w.reduce((a, b) => a + (b - mean) ** 2, 0) / w.length);
  const score = Math.max(0, Math.min(100, Math.round(100 * (1 - (2 * sd) / mean))));
  const high = Math.max(...w);
  const low = Math.min(...w);
  return { score, low, high, fastest: w.indexOf(high), slowest: w.indexOf(low) };
}

/** Below this, steadiness is the coaching line (when nothing bigger is wrong). */
export const UNSTEADY_BELOW = 75;
