// One Minute, the app side: turning a finished minute into a saved session, and "I meant that"
// on the Tape. Pure functions (no React, no storage), tested in test/minute.test.ts.
// The maths itself is engine/minute.ts; this file only feeds it and stores what it says.

import { FLOW_SLOTS, FLOW_VERSION, flowScore, MIN_RATE_SECONDS, minuteLine, minuteTrend, type FlowSlots, type MinuteSummary, type MinuteTrend } from '../engine/minute';
import type { RepeatedWord, VocabularyVariety } from '../engine/wording';
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
 *
 * Two breaks with no word between them share an index: their time away is taken out first, then
 * the one gap across both is closed once (closing it per break would take the second call out twice).
 * talk.tsx moves its clock by the same amounts (time away at Carry on, gapAfterBreak at the first
 * word after), so a full minute on the clock is a full minute of Kept going.
 */
export function withoutBreaks(
  heardTimes: readonly number[],
  startedAt: number,
  breaks: readonly MinuteBreak[],
): { heardTimes: number[]; startedAt: number } {
  const out = heardTimes.slice();
  let start = startedAt;
  for (const b of breaks) {
    if (b.index <= 0) start += b.awayMs;
    else if (b.index < out.length) for (let j = b.index; j < out.length; j++) out[j] -= b.awayMs;
    // else: nothing heard after this break
  }
  for (const index of new Set(breaks.map((b) => b.index))) {
    if (index <= 0 || index >= out.length) continue;
    const gap = out[index] - out[index - 1];
    if (gap > 0) for (let j = index; j < out.length; j++) out[j] -= gap;
  }
  return { heardTimes: out, startedAt: start };
}

/**
 * The gap withoutBreaks() closes at `index`, in ms: from the last word before a break to the first
 * word after it, less the time away. 0 when no break sits at `index` or that word isn't heard yet.
 * talk.tsx calls it as the first word after a Carry on is stamped and moves its clock forward by it,
 * so the minute on screen and Kept going on the Tape agree (otherwise a full minute ended at ~58 s).
 * Works on the raw wall-clock stamps, as talk.tsx holds them.
 */
export function gapAfterBreak(heardTimes: readonly number[], breaks: readonly MinuteBreak[], index: number): number {
  if (index <= 0 || index >= heardTimes.length) return 0;
  const here = breaks.filter((b) => b.index === index);
  if (!here.length) return 0;
  const away = here.reduce((sum, b) => sum + b.awayMs, 0);
  return Math.max(0, heardTimes[index] - heardTimes[index - 1] - away);
}

/**
 * Optional derived detail beyond the original minute shape. Repeated words stay on the phone;
 * the transcript and surrounding sentences are never saved. Analytics uses a separate allowlist.
 */
export type MinuteRecord = NonNullable<SavedSession['minute']> & {
  /** Seconds from Start to the first heard word, one decimal (engine timeToFirstWordSeconds). */
  timeToFirstWordSeconds?: number;
  /** Derived word counts stay on this phone; no transcript or surrounding sentences. */
  repeated?: RepeatedWord[];
  /** Stored for a pooled weekly view only, never shown as a per-talk grade. */
  variety?: VocabularyVariety;
};

/** The `minute` block of a saved session, from minuteSummary(). */
export function minuteRecord(m: MinuteSummary): MinuteRecord {
  return {
    longPauses: m.longPauses,
    longestPauseSeconds: m.longestPauseSeconds,
    talkSeconds: m.talkSeconds,
    timeToFirstWordSeconds: m.timeToFirstWordSeconds,
    repeated: m.repeated,
    variety: m.variety,
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
  return minuteLine({ talkSeconds: m.talkSeconds, longPauses: m.longPauses, wpm: m.wpm, habitFillersPerMin: m.input.habitFillersPerMin, topHabit: top, timeToFirstWordSeconds: firstWordSeconds(s) }, slots);
}

/** Route input is untrusted. Only a real calendar day on a known railway can mark a stop. */
export function talkStopId(value: unknown): string | undefined {
  if (typeof value !== 'string' || !/^(sharp|clear):\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const day = value.slice(value.indexOf(':') + 1);
  const date = new Date(`${day}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === day ? value : undefined;
}

/** Unwrap the stored first-word times before asking the engine for the same-version trend. */
export function savedMinuteTrend(s: SavedSession, all: readonly SavedSession[]): MinuteTrend | null {
  const version = s.flowVersion ?? '';
  const past = pastMinutes(all, all.findIndex((x) => x.id === s.id), version);
  return minuteTrend(past.map((x) => ({ flow: x.flow, flowVersion: x.flowVersion, timeToFirstWordSeconds: firstWordSeconds(x) })), version, s.flow, firstWordSeconds(s));
}

/** A saved minute's time to first word, or undefined for a minute saved before it was kept. */
export function firstWordSeconds(s: Pick<SavedSession, 'minute'>): number | undefined {
  const t = (s.minute as MinuteRecord | undefined)?.timeToFirstWordSeconds;
  return typeof t === 'number' && Number.isFinite(t) && t >= 0 ? t : undefined;
}

/**
 * "You started after 6 seconds." on the One Minute Tape. Whole seconds, singular for 1, and
 * "straight away" under half a second. Null when the minute didn't save it (older sessions).
 */
export function firstWordText(seconds: number | undefined): string | null {
  if (seconds === undefined) return null;
  const n = Math.round(seconds);
  if (n === 0) return 'You started straight away.';
  return `You started after ${n} ${n === 1 ? 'second' : 'seconds'}.`;
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

/** "1 One Minute talk", "3 One Minute talks": the mode's name, so "minute" is never read as 60 seconds. */
function talks(n: number): string {
  return `${n} One Minute ${n === 1 ? 'talk' : 'talks'}`;
}

/**
 * The Tape's line comparing this minute with your own recent ones (engine minuteTrend). With
 * fewer than 3 to compare against, it says how many more talks until it can. Plain sentences,
 * no brackets (plain English for ESL readers).
 */
export function trendText(t: MinuteTrend | null, pastCount: number): string {
  if (!t || t.delta === undefined) {
    const more = Math.max(1, 3 - pastCount);
    return `After ${more} more One Minute ${more === 1 ? 'talk' : 'talks'}, you’ll see how this one compares with your recent ones.`;
  }
  const usual = `Your usual is ${Math.round(t.median)}, from your last ${talks(t.count)}.`;
  if (t.direction === 'same') return `About the same as your usual. ${usual}`;
  return `${Math.round(Math.abs(t.delta))} ${t.direction === 'up' ? 'above' : 'below'} your usual. ${usual}`;
}
