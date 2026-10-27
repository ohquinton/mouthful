import { UNSTEADY_BELOW } from './steadiness';

// Pace targets depend on what you're doing. Reading aloud, presenting and talking
// have different natural speeds, so there's no single "correct" pace.
export type PaceContext = 'reading' | 'presenting' | 'talking';

export const PACE_BANDS: Record<PaceContext, [number, number]> = {
  reading: [130, 165],
  presenting: [120, 155], // slower: audiences need time to follow
  talking: [120, 170],
};

/** Kept for older call sites: the reading band. */
export const TARGET_WPM = PACE_BANDS.reading;

export type SessionStats = {
  wpm: number;
  fillersPerMin: number;
  accuracy: number | null; // null in free talk
  midSentencePauses: number;
  seconds: number;
  /** 0–100 from engine/steadiness.ts. Undefined when there weren't enough stretches to tell. */
  steadiness?: number;
};

export function wordsPerMinute(spoken: number, seconds: number): number {
  if (seconds < 3) return 0;
  return Math.round(spoken / (seconds / 60));
}

export function paceScore(wpm: number, ctx: PaceContext = 'reading'): number {
  const [lo, hi] = PACE_BANDS[ctx];
  if (wpm >= lo && wpm <= hi) return 100;
  const off = wpm < lo ? lo - wpm : wpm - hi;
  return Math.max(0, 100 - off * 1.5);
}

export function fluencyScore(fillersPerMin: number, pauses: number): number {
  return Math.max(0, 100 - fillersPerMin * 15 - pauses * 5);
}

/** Score = 35% pace + 35% fluency + 30% accuracy. Free talk uses fluency in place of accuracy. */
export function sessionScore(s: SessionStats, ctx: PaceContext = 'reading'): number {
  const pace = paceScore(s.wpm, ctx);
  const fluency = fluencyScore(s.fillersPerMin, s.midSentencePauses);
  const accuracy = s.accuracy ?? fluency;
  return Math.round(pace * 0.35 + fluency * 0.35 + accuracy * 0.3);
}

export type PaceZone = 'idle' | 'slow' | 'good' | 'fast';

export function paceZone(wpm: number, ctx: PaceContext = 'reading'): PaceZone {
  const [lo, hi] = PACE_BANDS[ctx];
  if (!wpm) return 'idle';
  if (wpm < lo) return 'slow';
  if (wpm > hi) return 'fast';
  return 'good';
}

/** One sentence of coaching about the single biggest issue. Never a list. */
export function coachingLine(s: SessionStats, topFiller?: string, ctx: PaceContext = 'reading'): string {
  const [lo, hi] = PACE_BANDS[ctx];
  if (s.wpm > hi + 15) return `You ran at ${s.wpm}. Breathe at every full stop.`;
  if (s.accuracy !== null && s.accuracy < 85) return 'A few words slipped past. Slow down on the long ones.';
  if (s.fillersPerMin >= 3) return `Lots of "${topFiller ?? 'um'}". Swap each one for a silent beat.`;
  if (s.steadiness !== undefined && s.steadiness < UNSTEADY_BELOW) return 'Your pace drifted between sentences. Give every sentence the same speed, like the pacer.';
  if (s.midSentencePauses >= 3) return 'You paused mid-sentence a few times. Look one phrase ahead.';
  if (s.wpm > hi) return `Slightly quick at ${s.wpm}. Let the commas breathe.`;
  if (s.wpm && s.wpm < lo - 20) return `Steady but slow at ${s.wpm}. Try reading a phrase ahead with your eyes.`;
  if (s.fillersPerMin === 0) return `Clean read. ${s.wpm} wpm, no fillers.`;
  return `Solid read at ${s.wpm} wpm. Keep the fillers this low.`;
}

/** The pacer reads at the middle of the suggested range, so it rewards steadiness, not speed. */
export function pacerWpm(ctx: PaceContext = 'reading'): number {
  const [lo, hi] = PACE_BANDS[ctx];
  return Math.round((lo + hi) / 2);
}

/** Which word a steady reader would be on after `seconds`. */
export function pacerIndex(seconds: number, wpm: number, passageLength: number): number | null {
  if (seconds <= 0 || passageLength === 0) return null;
  return Math.min(passageLength - 1, Math.floor((seconds / 60) * wpm));
}

/** @deprecated Racing your best rewards speed over clarity. Use pacerIndex. */
export function ghostIndex(seconds: number, bestWpm: number | undefined, passageLength: number): number | null {
  if (!bestWpm) return null;
  return pacerIndex(seconds, bestWpm, passageLength);
}

/** Recompute stats after "I said it" corrections. */
export function correctedAccuracy(read: number, skipped: number): number {
  const attempted = read + skipped;
  return attempted ? Math.round((read / attempted) * 100) : 0;
}

/** What a Day 1 number means, in one plain sentence. */
export function day1Line(wpm: number): string {
  const [lo, hi] = TARGET_WPM;
  if (wpm > hi) return `You read at ${wpm} words a minute. A comfortable range for reading aloud is about ${lo} to ${hi}, so the first job is slowing down.`;
  if (wpm < lo) return `You read at ${wpm} words a minute. A comfortable range for reading aloud is about ${lo} to ${hi}, so we’ll build a steadier flow.`;
  return `You read at ${wpm} words a minute, inside the ${lo}–${hi} range that’s comfortable for listeners. Now we work on fillers and tricky words.`;
}
