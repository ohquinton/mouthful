// Target length lights (docs/MARKET-RESEARCH.md steal 3, like the green/yellow/red lights
// Toastmasters clubs use). Your own scripts only: built-in reading passages, Word Packs, the
// Day 1 read and Free talk have no target, because there's no slot to fit them into.
import { PACE_BANDS, type PaceContext } from '../engine/score';
import type { Moment } from './moments';
import { loadScripts, wordCount, type Script } from './scripts';

/** Under 80% of the target: neutral. 80–110%: amber, time to wrap up. Past 110%: soft red. */
export type LengthZone = 'under' | 'near' | 'over';

export const NEAR_SHARE = 0.8;
export const OVER_SHARE = 1.1;

export function lengthZone(seconds: number, target: number): LengthZone {
  if (target <= 0 || seconds < target * NEAR_SHARE) return 'under';
  return seconds > target * OVER_SHARE ? 'over' : 'near';
}

/** The words that go with the colour, so it never relies on colour alone. */
export const LENGTH_LABEL: Record<LengthZone, string | undefined> = {
  under: undefined,
  near: 'wrap up',
  over: 'over time',
};

/** 134 → "2:14". Whole seconds, rounded down, so the clock never shows a second early. */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 134 → "2 minutes 14 seconds", for screen readers. */
export function spokenClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  const mins = m ? `${m} ${m === 1 ? 'minute' : 'minutes'}` : '';
  const secs = r || !m ? `${r} ${r === 1 ? 'second' : 'seconds'}` : '';
  return [mins, secs].filter(Boolean).join(' ');
}

/**
 * Target for one part of a script, in whole seconds. Sessions are one part at a time, so a
 * moment's slot (2 minutes for an interview answer) is shared out by each part's words. Without
 * a slot: the part's words at the middle of the pace band (e.g. 150 words presenting ≈ 1:05).
 */
export function partTargetSeconds({
  partWords,
  scriptWords,
  momentSeconds,
  pace,
}: {
  partWords: number;
  scriptWords: number;
  momentSeconds?: number;
  pace: PaceContext;
}): number | undefined {
  if (partWords <= 0) return undefined;
  if (momentSeconds && scriptWords > 0) return Math.max(1, Math.round((momentSeconds * partWords) / scriptWords));
  const [lo, hi] = PACE_BANDS[pace];
  return Math.max(1, Math.round((partWords / ((lo + hi) / 2)) * 60));
}

/**
 * The target for a Glide session on `passageId`, or undefined when it has none (anything that
 * isn't a part of your own script). The moment's slot only applies to the moment's own script.
 */
export function targetForScriptPart(
  script: Pick<Script, 'id' | 'chunks'> | undefined,
  part: number,
  moment: { def?: Pick<Moment, 'targetSeconds'>; scriptId?: string } | undefined,
  pace: PaceContext,
): number | undefined {
  const text = script?.chunks[part];
  if (!script || !text) return undefined;
  const own = !!moment?.scriptId && moment.scriptId === script.id;
  return partTargetSeconds({
    partWords: wordCount(text),
    scriptWords: script.chunks.reduce((n, c) => n + wordCount(c), 0),
    momentSeconds: own ? moment?.def?.targetSeconds : undefined,
    pace,
  });
}

/** Loads the script for a `s.<scriptId>.<part>` passage and works out its target. */
export async function targetForPassage(
  passageId: string,
  moment: { def?: Pick<Moment, 'targetSeconds'>; scriptId?: string } | undefined,
  pace: PaceContext,
): Promise<number | undefined> {
  const m = /^s\.(\d+)\.(\d+)$/.exec(passageId);
  if (!m) return undefined;
  try {
    const script = (await loadScripts()).find((s) => s.id === m[1]);
    return targetForScriptPart(script, Number(m[2]), moment, pace);
  } catch {
    return undefined; // no target is better than no session
  }
}
