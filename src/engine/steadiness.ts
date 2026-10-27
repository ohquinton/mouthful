// Pace steadiness: does the reader hold one speed, or rush some sentences and drag others?
// An average wpm hides this, so we time each stretch of the passage on its own.
import type { PassageWord, WordStatus } from './align';

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
// Text with no full stops (a pasted script, notes) still gets stretches: one closes at any
// word once it's this long.
const MAX_WORDS = 25;
// A single word-to-word step longer than this is a stop, not slow speaking. 2.5 s sits above
// the 2 s mid-sentence pause line in the session screen, so every step we drop has already
// been counted on the Pauses tile, and a hard word dragged out for 1–2 s still reads as slow.
const MAX_STEP_MS = 2500;
// After skips and stops are left out, a stretch needs this many timed steps to be a pace.
const MIN_STEPS = 4;

/**
 * Splits the passage into stretches and times each one using when Glide reached each word
 * (`reachedAt`, ms). Breaths at commas and full stops are left out on purpose: pausing
 * there is good, not slow. So this is speaking speed between breaths.
 *
 * `status` (optional) is the recogniser's alignment, `align(...).status`, before the reader's
 * corrections. Glide stamps a skipped word with the moment it lands on the next heard word, so
 * steps into or out of a skipped word take 0 ms or swallow the gap; they're left out. A word
 * the reader later tapped as said was still stamped that way, which is why it's the raw status.
 */
export function paceSegments(
  passage: PassageWord[],
  reachedAt: (number | undefined)[],
  status?: readonly WordStatus[],
): PaceSegment[] {
  const out: PaceSegment[] = [];
  const skipped = (k: number) => status?.[k] === 'skipped';
  let start = 0;
  for (let i = 0; i < passage.length; i++) {
    const count = i - start + 1;
    const w = passage[i];
    const close =
      (w.sentenceEnd && count >= MIN_WORDS) ||
      (w.breathAfter && count >= LONG_WORDS) ||
      count >= MAX_WORDS ||
      (i === passage.length - 1 && count >= MIN_WORDS);
    if (!close) continue;
    // Only stretches the reader got all the way through: a half-read sentence isn't a pace.
    if (reachedAt[start] === undefined || reachedAt[i] === undefined) {
      start = i + 1;
      continue;
    }
    // Time each word-to-word step inside a phrase. Steps after a comma or full stop are
    // breaths, which the Pauses tile already covers, so they don't make the speaking "slow".
    // Long stops mid-phrase are the Pauses tile's too, and steps touching a skipped word aren't timed.
    let ms = 0;
    let steps = 0;
    for (let k = start; k < i; k++) {
      const a = reachedAt[k];
      const b = reachedAt[k + 1];
      if (a === undefined || b === undefined || passage[k].breathAfter) continue;
      if (skipped(k) || skipped(k + 1) || b - a > MAX_STEP_MS) continue;
      ms += b - a;
      steps++;
    }
    if (steps >= MIN_STEPS && ms / 1000 >= MIN_SECONDS) {
      out.push({ start, end: i, wpm: Math.round((steps / (ms / 1000)) * 60) });
    }
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
