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
// Words sharing one stamp are judged as a possible jump from this many (see jumpedSteps).
const RUN_WORDS = 3;
// A run that implies more than this many times the reader's own pace was a jump, not speech.
const JUMP_FACTOR = 2;

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
  // Can the step from word k to k + 1 be timed at all? Breaths, long stops and skips can't.
  const timeable = (k: number) => {
    const a = reachedAt[k];
    const b = reachedAt[k + 1];
    return a !== undefined && b !== undefined && !passage[k].breathAfter && !skipped(k) && !skipped(k + 1) && b - a <= MAX_STEP_MS;
  };
  const jumped = jumpedSteps(passage, reachedAt, status, timeable);
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
    // Nor are steps across a jump (see jumpedSteps), even if a re-read later inked the gap.
    let ms = 0;
    let steps = 0;
    for (let k = start; k < i; k++) {
      if (!timeable(k) || jumped[k]) continue;
      ms += reachedAt[k + 1]! - reachedAt[k]!;
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
 * Steps (k → k + 1) that crossed a jump of the pointer rather than the reader's speech.
 *
 * Glide stamps every word the pointer passes in one go with the same time. Usually that's a
 * recogniser burst: the words were said during the step into the burst, so that step plus the
 * 0 ms steps inside it add up to the right pace. But when Glide skips words (a lookahead skip, or
 * a resync over a dropped clause), the gap words share the anchor's stamp though they weren't
 * said then. If the reader later goes back and says them, align inks them (backfill), the raw
 * status says 'read', and the skip rule above no longer catches them: the gap shows as a burst
 * of far more words than the time allowed, a falsely fast sentence.
 *
 * A run is a jump when:
 *   - a word in it, or the word before it, is still 'skipped' (a skip that stayed red), or
 *   - it has RUN_WORDS or more words and the step into it is too short for them at JUMP_FACTOR ×
 *     the reader's own pace (from every timeable step in the session): a skip later backfilled.
 * Pairs aren't judged on time: recognisers often send two words close together, and dropping
 * only the quick ones would make a jittery recogniser look slow. A plain burst after a breath is
 * not a jump and is timed as before.
 *
 * A jump's step in and the 0 ms steps inside it are left out. So is the re-read that usually
 * follows: the reader sees red and goes back, the pointer waits, and the whole re-read lands on
 * one step. A long re-read is over MAX_STEP_MS and already dropped; a short one isn't. So the
 * first step after the jump that is over JUMP_FACTOR × the reader's pace is left out too, looking
 * only up to the next breath, stop or skip (a re-read there has already been dropped with it).
 *
 * Needs `status`: without it, nothing is treated as a jump (the old behaviour).
 */
function jumpedSteps(
  passage: PassageWord[],
  reachedAt: (number | undefined)[],
  status: readonly WordStatus[] | undefined,
  timeable: (k: number) => boolean,
): boolean[] {
  const out = new Array<boolean>(passage.length).fill(false);
  if (!status) return out;
  const skipped = (k: number) => status[k] === 'skipped';
  let total = 0;
  let count = 0;
  // The 0 ms steps inside a long shared-stamp run are a jump, not speech: they'd drag the reader's
  // pace down and hide the jump itself. Bursts (up to RUN_WORDS words) still count.
  const runLen = new Array<number>(passage.length).fill(1);
  for (let r0 = 0; r0 < passage.length; ) {
    let r1 = r0;
    while (reachedAt[r0] !== undefined && r1 + 1 < passage.length && reachedAt[r1 + 1] === reachedAt[r0]) r1++;
    for (let k = r0; k <= r1; k++) runLen[k] = r1 - r0 + 1;
    r0 = r1 + 1;
  }
  for (let k = 0; k + 1 < passage.length; k++) {
    if (timeable(k) && !(runLen[k] > RUN_WORDS && reachedAt[k + 1] === reachedAt[k])) {
      total += reachedAt[k + 1]! - reachedAt[k]!;
      count++;
    }
  }
  const perWord = count ? total / count : 0;
  for (let r0 = 0; r0 < passage.length; ) {
    const t = reachedAt[r0];
    let r1 = r0;
    while (t !== undefined && r1 + 1 < passage.length && reachedAt[r1 + 1] === t) r1++;
    const words = r1 - r0 + 1;
    if (words >= 2) {
      let skip = r0 > 0 && skipped(r0 - 1);
      for (let k = r0; k <= r1 && !skip; k++) skip = skipped(k);
      const stepIn = r0 > 0 && timeable(r0 - 1) ? t! - reachedAt[r0 - 1]! : undefined;
      const tooFast = words >= RUN_WORDS && stepIn !== undefined && stepIn * JUMP_FACTOR < words * perWord;
      if (skip || tooFast) {
        if (r0 > 0) out[r0 - 1] = true;
        for (let k = r0; k < r1; k++) out[k] = true;
        // The re-read, if it landed on a timeable step.
        for (let k = r1; k + 1 < passage.length && timeable(k); k++) {
          if (reachedAt[k + 1]! - reachedAt[k]! > JUMP_FACTOR * perWord) {
            out[k] = true;
            break;
          }
        }
      }
    }
    r0 = r1 + 1;
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
