// Glide's "is the reader still going?" decisions, kept pure so they're tested without a phone.
// session/[id].tsx calls these from the effect that reacts to the pointer moving.
import { align, withCorrections, type Alignment, type PassageWord } from './engine/align';

/**
 * The alignment a session is saved from (finish, the too-short check, the free run's early-Finish
 * check, Finish after an error). Live, align() holds a jump until its words are 2 from the end of
 * what was heard, because the recogniser may still rewrite them. At the end nothing more is
 * coming, so every heard word is settled (settled = heard.length); otherwise a jump resting on the
 * last words never lands, the words it skipped never turn red, and accuracy reads 100%.
 * `raw` is the recogniser's view, `final` includes the reader's "I said it" taps.
 */
export function finalAlignment(words: PassageWord[], heard: string[], corrected: Set<number>): { raw: Alignment; final: Alignment } {
  const raw = align(words, heard, heard.length);
  return { raw, final: withCorrections(raw, corrected) };
}

/** Where the pointer is, and (only during a re-read behind it) which word was just re-read. */
export type PointerState = { next: number; rereadingAt?: number };

/**
 * What changed since the last recogniser update:
 * - 'advance': the pointer moved on.
 * - 'reread': the pointer held, but the reader is re-reading behind it (align's `rereadingAt`
 *   moved to a new word). That's still progress: they're reading, just not new words.
 * - 'none': nothing new.
 */
export function progressKind(prev: PointerState, cur: PointerState): 'advance' | 'reread' | 'none' {
  if (cur.next !== prev.next) return 'advance';
  if (cur.rereadingAt !== undefined && cur.rereadingAt !== prev.rereadingAt) return 'reread';
  return 'none';
}

export const BREATH_PAUSE_MS = 450;
export const MID_SENTENCE_PAUSE_MS = 2000;
export const LOST_AFTER_MS = 6000;

/**
 * What the gap before a step forward counts as. A breath mark fills after a short stop where the
 * passage has one; a long stop anywhere else is a mid-sentence pause, unless the reader was
 * re-reading (going back over words isn't freezing).
 */
export function pauseAfter({ gapMs, breathAfter, rereading }: { gapMs: number; breathAfter: boolean; rereading: boolean }): 'breath' | 'mid' | 'none' {
  if (breathAfter) return gapMs > BREATH_PAUSE_MS ? 'breath' : 'none';
  return gapMs > MID_SENTENCE_PAUSE_MS && !rereading ? 'mid' : 'none';
}

/**
 * Show "Pick up from …"? Only while listening, after the first word, before the end, never while
 * re-reading, and only after 6 s with no progress (a re-read step counts as progress).
 */
export function isLost({
  listening,
  started,
  done,
  rereading,
  now,
  lastProgressAt,
}: {
  listening: boolean;
  started: boolean;
  done: boolean;
  rereading: boolean;
  now: number;
  lastProgressAt: number;
}): boolean {
  return listening && started && !done && !rereading && now - lastProgressAt > LOST_AFTER_MS;
}
