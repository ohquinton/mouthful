// One Minute, the app side: turning a finished minute into a saved session, and "I meant that"
// on the Tape. Pure functions (no React, no storage), tested in test/minute.test.ts.
// The maths itself is engine/minute.ts; this file only feeds it and stores what it says.

import { FLOW_SLOTS, FLOW_VERSION, flowScore, MIN_RATE_SECONDS, minuteLine, type FlowSlots, type MinuteSummary, type MinuteTrend } from '../engine/minute';
import type { HabitWord } from '../engine/habits';
import type { SavedSession } from './sessions';

/** A time away from the minute: the error card was up (a call, Siri) and then "Carry on" resumed it. */
export type MinuteBreak = {
  /** How many words had been stamped when listening came back. Words from here on came after the break. */
  index: number;
  /** How long the card was up, in ms. */
  awayMs: number;
};

/**
 * Takes time away out of the heard times, so a call is never a long pause and never talking time
 * (the "main integration trap" in engine/minute.ts).
 *
 * `heardTimes` are wall-clock stamps (stampHeard with Date.now()). For each break, every stamp after
 * it moves back by the time away. Then the gap across the break (the last word before it to the first
 * word after it: the recogniser restarting, the reader finding their place) is closed too, the same
 * way thinking time before the very first word never counts. A break before any word was heard just
 * moves the start forward, so the call isn't counted as thinking time either.
 */
export function withoutBreaks(
  heardTimes: readonly number[],
  startedAt: number,
  breaks: readonly MinuteBreak[],
): { heardTimes: number[]; startedAt: number } {
  const out = heardTimes.slice();
  let start = startedAt;
  for (const b of breaks) {
    if (b.index <= 0) {
      start += b.awayMs;
      continue;
    }
    if (b.index >= out.length) continue; // nothing heard after this break
    for (let j = b.index; j < out.length; j++) out[j] -= b.awayMs;
    const gap = out[b.index] - out[b.index - 1];
    if (gap > 0) for (let j = b.index; j < out.length; j++) out[j] -= gap;
  }
  return { heardTimes: out, startedAt: start };
}

/** What a minute saves beyond the usual session fields. Numbers and habit-word codes only, never what was said. */
export type MinuteRecord = NonNullable<SavedSession['minute']>;

/** The `minute` block of a saved session, from minuteSummary(). */
export function minuteRecord(m: MinuteSummary): MinuteRecord {
  return {
    longPauses: m.longPauses,
    longestPauseSeconds: m.longestPauseSeconds,
    talkSeconds: m.talkSeconds,
    wpm: m.wpm,
    words: m.words,
    umCount: m.umCount,
    umPerMin: m.umPerMin,
    // Before any overrule (none yet at Finish): the token index and which habit word, nothing else.
    habitFillers: m.habitResults.filter((r) => r.label === 'filler').map((r) => ({ index: r.index, word: r.word })),
    habitUnsure: m.habits.unsure,
    input: { ...m.input },
  };
}

/** The likely fillers still standing (not marked "I meant that"). */
export function standingFillers(s: Pick<SavedSession, 'minute' | 'overruled'>): { index: number; word: HabitWord }[] {
  const meant = new Set(s.overruled ?? []);
  return (s.minute?.habitFillers ?? []).filter((f) => !meant.has(f.index));
}

/** "like ×3, you know ×1": standing fillers grouped by word, most first (ties in first-heard order). */
export function fillerChips(s: Pick<SavedSession, 'minute' | 'overruled'>): { word: HabitWord; count: number; next: number }[] {
  const chips: { word: HabitWord; count: number; next: number }[] = [];
  for (const f of standingFillers(s)) {
    const c = chips.find((x) => x.word === f.word);
    if (c) c.count++;
    else chips.push({ word: f.word, count: 1, next: f.index });
  }
  return chips.sort((a, b) => b.count - a.count);
}

/**
 * "I meant that" on a likely filler. Tapping a chip ("like ×3") overrules its earliest standing
 * occurrence (`index`). Saves the index only. Flow is recomputed from the stored inputs, which only
 * moves it once the habit slot is scored (FLOW_SCORED). A session from another Flow version keeps
 * its Flow, so it still compares with the sessions of its own version.
 * Returns the session unchanged if the index isn't a standing filler.
 */
export function overruleFiller(s: SavedSession, index: number, slots: FlowSlots = FLOW_SLOTS, version = FLOW_VERSION): SavedSession {
  if (!s.minute || !standingFillers(s).some((f) => f.index === index)) return s;
  const overruled = [...(s.overruled ?? []), index];
  const next: SavedSession = { ...s, overruled };
  if (s.flowVersion !== version) return next;
  const left = s.minute.habitFillers.length - overruled.length;
  const rateMinutes = Math.max(s.minute.talkSeconds, MIN_RATE_SECONDS) / 60; // as minuteSummary
  const input = { ...s.minute.input, habitFillersPerMin: Math.max(0, left) / rateMinutes };
  return { ...next, flow: flowScore(input, slots), minute: { ...s.minute, input } };
}

/** The coaching line for a saved minute (minuteLine from its stored numbers). */
export function savedMinuteLine(s: SavedSession, slots: FlowSlots = FLOW_SLOTS): string {
  const m = s.minute;
  if (!m) return '';
  const top = fillerChips(s)[0]?.word;
  return minuteLine({ talkSeconds: m.talkSeconds, longPauses: m.longPauses, wpm: m.wpm, habitFillersPerMin: m.input.habitFillersPerMin, topHabit: top }, slots);
}

/** Habit words as analytics codes: "you know" → "you_know" (sanitise drops spaces). */
export function habitCode(word: HabitWord): string {
  return word.replace(/ /g, '_');
}

/**
 * session_complete for a minute (brief, Decision 5 and Revision 2). Numbers and short codes only:
 * the prompt goes as its id (p07), never its text, and nothing the reader said.
 */
export function minuteCompleteProps(m: MinuteSummary, prompt: { id: string; level: number }, seconds: number) {
  return {
    kind: 'minute',
    pace: 'talking',
    which: prompt.id,
    level: prompt.level,
    flow: m.flow,
    long_pauses: m.longPauses,
    longest_pause_s: m.longestPauseSeconds,
    talk_seconds: m.talkSeconds,
    wpm: m.wpm,
    fillers_per_min: m.umPerMin,
    habit_fillers: m.habits.filler,
    habit_unsure: m.habits.unsure,
    habit_overruled: m.habits.overruled, // 0 at Finish; taps on the Tape log recognition_correction
    flow_version: m.flowVersion,
    seconds: Math.round(seconds),
  };
}

/** Saved minutes before `index` with this Flow version: what minuteTrend compares against. */
export function pastMinutes(sessions: readonly SavedSession[], index: number, version: string): SavedSession[] {
  return sessions.slice(0, Math.max(0, index)).filter((x) => x.kind === 'minute' && x.flowVersion === version && typeof x.flow === 'number');
}

/**
 * The Tape's line comparing this minute with your own recent ones (engine minuteTrend). With
 * fewer than 3 to compare against, it says how many more minutes until it can.
 */
export function trendText(t: MinuteTrend | null, pastCount: number): string {
  if (!t || t.delta === undefined) {
    const more = Math.max(1, 3 - pastCount);
    return `After ${more} more ${more === 1 ? 'minute' : 'minutes'}, you’ll see how you compare with your own recent ones.`;
  }
  const usual = `your usual (${Math.round(t.median)} over your last ${t.count} minutes)`;
  if (t.direction === 'same') return `About the same as ${usual}.`;
  return `${Math.round(Math.abs(t.delta))} ${t.direction === 'up' ? 'above' : 'below'} ${usual}.`;
}
