// One Minute, the app side: turning a finished minute into a saved session, and "I meant that"
// on the Tape. Pure functions (no React, no storage), tested in test/minute.test.ts.
// The maths itself is engine/minute.ts; this file only feeds it and stores what it says.

import { FLOW_SLOTS, FLOW_VERSION, flowScore, MIN_RATE_SECONDS, MINUTE_SECONDS, minuteLine, minuteTrend, type FlowSlots, type MinuteSummary, type MinuteTrend } from '../engine/minute';
import { pooledVariety, type VocabularyVariety } from '../engine/wording';
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
 * What a minute saves beyond the usual session fields. Numbers and habit-word codes only, never what was said.
 * `timeToFirstWordSeconds` is new (2026-10-31), so it's optional: older minutes don't have it. It lives
 * here, not in sessions.ts, only because that file wasn't in this change; move it there when it next opens.
 */
export type MinuteRecord = NonNullable<SavedSession['minute']> & {
  /** Seconds from Start to the first heard word, one decimal (engine timeToFirstWordSeconds). */
  timeToFirstWordSeconds?: number;
  /**
   * How long the talk was meant to be: 30 (onboarding's first talk) or 60. Unset on older minutes,
   * which were all 60. A 30 also has its own flowVersion (versionFor), so it never joins a 60 s trend.
   */
  limitSeconds?: TalkLength;
  /**
   * Content words leaned on (engine wording.ts repeatedWords), most used first: the word and its
   * count only. Stays on the phone and is never sent anywhere (minuteCompleteProps never reads it).
   */
  repeated?: { word: string; count: number }[];
  /** This talk's variety record, for pooledVariety only. Never shown on its own (too noisy per talk). */
  variety?: Pick<VocabularyVariety, 'mattr' | 'windows' | 'words'>;
};

// ---------------------------------------------------------------------------------------------
// Talk length: a full minute, or onboarding's 30-second first talk

export type TalkLength = 30 | 60;

/** The `seconds` route param: '30' gives a 30-second talk, anything else (or nothing) a minute. */
export function talkLength(param: string | string[] | undefined): TalkLength {
  return param === '30' ? 30 : 60;
}

/**
 * The Flow version a talk of this length saves. A 30-second talk gets its own ("2-k40p35w25-s30"),
 * so pastMinutes, minuteTrend and anything else that compares by version never mixes it with full
 * minutes. Still a short code, so it passes analytics' sanitise as `flow_version`.
 */
export function versionFor(limit: TalkLength, version: string = FLOW_VERSION): string {
  return limit === 30 ? `${version}-s30` : version;
}

/** A 30-second talk (onboarding's first). Leave these out of 60-second trends and "your usual". */
export function isShortTalk(s: Pick<SavedSession, 'minute' | 'flowVersion'>): boolean {
  return (s.minute as MinuteRecord | undefined)?.limitSeconds === 30 || (s.flowVersion ?? '').endsWith('-s30');
}

/** Stopping before this share of the talk is "stopped early" (45 s of a minute, as engine/minute.ts). */
const STOPPED_SHARE = 0.75;

/** Did the talk stop before 45 s of a minute (or 22.5 s of a 30-second talk)? Gentle, never a failure. */
export function stoppedEarly(s: Pick<SavedSession, 'minute'>): boolean {
  const m = s.minute as MinuteRecord | undefined;
  if (!m) return false;
  return m.talkSeconds < STOPPED_SHARE * (m.limitSeconds ?? 60);
}

const KEPT_GOING_LINE = 'You kept going the whole minute.';

/**
 * The engine's coaching line, for a talk of either length. engine/minute.ts measures everything out
 * of a minute (MINUTE_SECONDS), so for a 30-second talk the time is put on the minute's scale to
 * pick the issue, and "the whole minute" says "the whole 30 seconds". A talk that stopped early keeps
 * its real seconds ("You stopped at 18 s"): under the stop line both scales pick the same issue.
 */
function lineFor(stats: Parameters<typeof minuteLine>[0], limit: TalkLength, slots: FlowSlots): string {
  if (limit === MINUTE_SECONDS) return minuteLine(stats, slots);
  const scaled = stats.talkSeconds * (MINUTE_SECONDS / limit);
  const line = minuteLine(scaled < STOPPED_SHARE * MINUTE_SECONDS ? stats : { ...stats, talkSeconds: scaled }, slots);
  return line === KEPT_GOING_LINE ? `You kept going the whole ${limit} seconds.` : line;
}

/**
 * A summary for a talk of `limit` seconds. A minute is returned as is. For 30 seconds, kept going is
 * scored out of 30 (the engine's slot is out of 60, so it is doubled; the engine caps it), the
 * version is versionFor(30), and the line is lineFor's. Every other number is the engine's.
 * Interim until speech-engine makes the talk's length an engine parameter (remodel-screens §6).
 */
export function forLength(m: MinuteSummary, limit: TalkLength, slots: FlowSlots = FLOW_SLOTS): MinuteSummary {
  if (limit === MINUTE_SECONDS) return m;
  const scored = { ...m.input, keptGoingSeconds: m.input.keptGoingSeconds * (MINUTE_SECONDS / limit) };
  return {
    ...m,
    flow: flowScore(scored, slots),
    flowVersion: versionFor(limit, m.flowVersion),
    line: lineFor(
      { talkSeconds: m.talkSeconds, longPauses: m.longPauses, wpm: m.wpm, habitFillersPerMin: m.input.habitFillersPerMin, timeToFirstWordSeconds: m.timeToFirstWordSeconds },
      limit,
      slots,
    ),
  };
}

/** The `minute` block of a saved session, from minuteSummary() (or forLength()). */
export function minuteRecord(m: MinuteSummary, limit: TalkLength = 60): MinuteRecord {
  return {
    longPauses: m.longPauses,
    longestPauseSeconds: m.longestPauseSeconds,
    talkSeconds: m.talkSeconds,
    timeToFirstWordSeconds: m.timeToFirstWordSeconds,
    wpm: m.wpm,
    words: m.words,
    umCount: m.umCount,
    umPerMin: m.umPerMin,
    // Before any overrule (none yet at Finish): the token index and which habit word, nothing else.
    habitFillers: m.habitResults.filter((r) => r.label === 'filler').map((r) => ({ index: r.index, word: r.word })),
    habitUnsure: m.habits.unsure,
    input: { ...m.input },
    limitSeconds: limit,
    // Word and count only (not every form heard): enough for the tile and the finding.
    ...(m.repeated && { repeated: m.repeated.map((r) => ({ word: r.word, count: r.count })) }),
    ...(m.variety && { variety: { mattr: m.variety.mattr, windows: m.variety.windows, words: m.variety.words } }),
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

/** The coaching line for a saved minute (minuteLine from its stored numbers, for its length). */
export function savedMinuteLine(s: SavedSession, slots: FlowSlots = FLOW_SLOTS): string {
  const m = s.minute as MinuteRecord | undefined;
  if (!m) return '';
  const top = fillerChips(s)[0]?.word;
  return lineFor(
    { talkSeconds: m.talkSeconds, longPauses: m.longPauses, wpm: m.wpm, habitFillersPerMin: m.input.habitFillersPerMin, topHabit: top, timeToFirstWordSeconds: m.timeToFirstWordSeconds },
    m.limitSeconds ?? 60,
    slots,
  );
}

/** A content word said this often in one talk earns the finding, if nothing else does (remodel-screens §4). */
export const REPEATED_FINDING_AT = 6;

/** The saved talk's most used word, if the engine flagged one (4+ uses). */
export function topRepeated(s: Pick<SavedSession, 'minute'>): { word: string; count: number } | undefined {
  return (s.minute as MinuteRecord | undefined)?.repeated?.[0];
}

/**
 * The one most useful finding on the results: the engine's coaching line (stopped early, long
 * pauses, too fast, a slow start) and, only when none of those fired, a word said 6+ times:
 * "You said “really” 9 times. Tomorrow, try a different word, or leave it out." Never a list.
 */
export function mainFinding(s: SavedSession, slots: FlowSlots = FLOW_SLOTS): string {
  const line = savedMinuteLine(s, slots);
  const kept = line === KEPT_GOING_LINE || /^You kept going the whole \d+ seconds\.$/.test(line);
  const top = topRepeated(s);
  if (kept && top && top.count >= REPEATED_FINDING_AT) {
    return `You said “${top.word}” ${top.count} times. Tomorrow, try a different word, or leave it out.`;
  }
  return line;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Vocabulary variety for the 7 days up to `at`: pooledVariety over the full-minute talks that kept
 * a record. Undefined until there are 3+ such talks and 250+ words: no number rather than a noisy
 * one. Never per talk (DECISIONS 2026-11-01).
 */
export function weeklyVariety(sessions: readonly SavedSession[], at: number): number | undefined {
  const records = sessions
    .filter((x) => x.kind === 'minute' && !isShortTalk(x) && x.at <= at && at - x.at < WEEK_MS)
    .map((x) => (x.minute as MinuteRecord | undefined)?.variety);
  return pooledVariety(records)?.per50;
}

/** "Different words this week: about 41 in every 50". */
export function varietyText(per50: number): string {
  return `Different words this week: about ${per50} in every 50`;
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

/**
 * Saved minutes before `index` with this Flow version: what minuteTrend compares against. A 30-second
 * talk has its own version (versionFor), and is also left out of a full minute's version explicitly.
 */
export function pastMinutes(sessions: readonly SavedSession[], index: number, version: string): SavedSession[] {
  const short = version.endsWith('-s30');
  return sessions
    .slice(0, Math.max(0, index))
    .filter((x) => x.kind === 'minute' && x.flowVersion === version && typeof x.flow === 'number' && isShortTalk(x) === short);
}

/** "Your usual" for a saved minute: its own version's earlier talks only, plus whether it's a best. */
export function usualFor(s: SavedSession, all: readonly SavedSession[]): { trend: MinuteTrend | null; past: number; best: boolean } {
  const version = s.flowVersion ?? '';
  const past = pastMinutes(all, all.findIndex((x) => x.id === s.id), version);
  const rows = past.map((x) => ({ flow: x.flow, flowVersion: x.flowVersion, timeToFirstWordSeconds: firstWordSeconds(x) }));
  const trend = minuteTrend(rows, version, s.flow, firstWordSeconds(s));
  // A best only means something once there's a usual (3+ talks), and only when it beats every one.
  const best = !!trend && past.every((x) => (x.flow ?? 0) < (s.flow ?? 0));
  return { trend, past: past.length, best };
}

/**
 * The line under the Flow number. Up: "↑ 6 on your usual 72" (good colour). A best: "↑ Your best so
 * far". Stopped early, down or about the same: "Your usual is 72", quiet, never a down arrow. Under 3
 * earlier talks: how many more until there's a usual.
 */
export function usualText(u: { trend: MinuteTrend | null; past: number; best: boolean }, early: boolean): { text: string; good: boolean } {
  const t = u.trend;
  if (!t || t.delta === undefined) {
    const more = Math.max(1, 3 - u.past);
    return { text: `${more} more ${more === 1 ? 'talk' : 'talks'} and you’ll see your usual.`, good: false };
  }
  const usual = Math.round(t.median);
  if (!early && t.direction === 'up') {
    return u.best ? { text: '↑ Your best so far', good: true } : { text: `↑ ${Math.round(t.delta)} on your usual ${usual}`, good: true };
  }
  return { text: `Your usual is ${usual}`, good: false };
}

/**
 * The stop's number for the results strip, from the end of its id ("sharp-6" → 6), until
 * content/lines.ts can say. Undefined when the talk wasn't a stop or the id ends in no number.
 */
export function stopNumber(stopId: string | undefined): number | undefined {
  const n = stopId?.match(/(\d+)$/)?.[1];
  return n ? Number(n) : undefined;
}

/** "Stop 6 done" / "Stop 7 tomorrow: beat 78". Stopped early: no "beat" (the stop still counts). */
export function stripText(stop: number | undefined, flow: number, early: boolean): { done: string; next: string } {
  const beat = early ? '' : `: beat ${flow}`;
  if (stop === undefined) return { done: 'Today’s talk done', next: early ? 'Talk again tomorrow' : `Tomorrow${beat}` };
  return { done: `Stop ${stop} done`, next: `Stop ${stop + 1} tomorrow${beat}` };
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
