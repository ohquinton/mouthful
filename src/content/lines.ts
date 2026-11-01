// The two train lines on the home map (DECISIONS 2026-11-01, docs/briefs/remodel-screens.md §0.1, §2).
//
// One stop = one day's practice, and every stop ends with a topic talk, so "beat yourself tomorrow"
// always has a talk to beat. Some stops start with a short lesson first: a word pack drill, a cold
// read or a Glide passage. A stop is done when a saved session carries its `stopId` (talk.tsx saves
// it when it was opened with the `stop` param). Nothing else is stored: progress is worked out from
// saved sessions, so it survives updates and goes away with Reset all data.
//
// Stop ids are what sessions keep, so never rename or reuse one. Add new stops at the end.

import { MINUTE_PROMPTS, Prompt } from './prompts';
import { getPack, packPassage } from './wordpacks';
import { getPassage } from './passages';
import { calendarDay } from '../engine/days';
import type { WordBook } from '../engine/vocab';

export type LineId = 'sharp' | 'clear';

export const LINE_NAME: Record<LineId, string> = { sharp: 'Sharp Talk', clear: 'Clear English' };

/** What comes before the talk. Passage ids are built-in ids or `w.<pack>.<n>`. */
export type Lesson = { kind: 'pack'; packId: string } | { kind: 'cold'; passageId: string } | { kind: 'glide'; passageId: string };

export type Stop = { id: string; line: LineId; promptId: string; lesson?: Lesson };

const talk = (line: LineId, n: number, promptId: string, lesson?: Lesson): Stop => ({
  id: `${line}-${String(n).padStart(2, '0')}`,
  line,
  promptId,
  lesson,
});
const pack = (packId: string): Lesson => ({ kind: 'pack', packId });
const cold = (passageId: string): Lesson => ({ kind: 'cold', passageId });
const glide = (passageId: string): Lesson => ({ kind: 'glide', passageId });

/**
 * Sharp Talk: precise words (Make your point is free), cold reads, ideas and topics (level 2–3).
 * Clear English: everyday things (level 1), the free packs, short steady Glide passages.
 * Stop 1 on both lines is the first talk from onboarding (Coffee).
 */
export const LINES: Record<LineId, readonly Stop[]> = {
  sharp: [
    talk('sharp', 1, 'p01'), // Coffee: the first talk
    talk('sharp', 2, 'p13', pack('precision')), // Trust
    talk('sharp', 3, 'p25'), // Explain what you do for work to a ten-year-old
    talk('sharp', 4, 'p15', cold('signal-noise')), // Risk
    talk('sharp', 5, 'p27'), // An opinion most people disagree with
    talk('sharp', 6, 'p20', glide('w.precision.0')), // Success
    talk('sharp', 7, 'p29'), // Teach me something
    talk('sharp', 8, 'p18', pack('raise')), // Change
    talk('sharp', 9, 'p31'), // A project update
    talk('sharp', 10, 'p22', cold('first-snow')), // Freedom
    talk('sharp', 11, 'p32'), // A plan that went wrong
    talk('sharp', 12, 'p17', glide('w.precision.1')), // Patience
    talk('sharp', 13, 'p34'), // Convince me to visit your city
    talk('sharp', 14, 'p36', pack('tech')), // Advice to yourself
  ],
  clear: [
    talk('clear', 1, 'p01'), // Coffee: the first talk
    talk('clear', 2, 'p02', pack('meetings')), // Rain
    talk('clear', 3, 'p03'), // Your phone
    talk('clear', 4, 'p04', glide('night-shift')), // Bread
    talk('clear', 5, 'p05'), // The bus
    talk('clear', 6, 'p06', glide('w.meetings.0')), // Shoes
    talk('clear', 7, 'p07'), // A window
    talk('clear', 8, 'p08', pack('precision')), // Your kitchen
    talk('clear', 9, 'p09'), // A clock
    talk('clear', 10, 'p10', glide('standup')), // A bicycle
    talk('clear', 11, 'p11'), // Keys
    talk('clear', 12, 'p12', glide('w.meetings.1')), // A river
    talk('clear', 13, 'p19'), // Home
    talk('clear', 14, 'p14', glide('first-snow')), // Time
  ],
};

export function lineOf(line: LineId | undefined): LineId {
  return line === 'clear' ? 'clear' : 'sharp'; // Sharp Talk is pre-selected for everyone
}

export function getStop(id: string | undefined): Stop | undefined {
  if (!id) return undefined;
  return [...LINES.sharp, ...LINES.clear].find((s) => s.id === id);
}

export function promptFor(stop: Stop): Prompt | undefined {
  return MINUTE_PROMPTS.find((p) => p.id === stop.promptId);
}

type HasStop = { stopId?: string; at: number };

/** Ids of every stop a saved session completed. */
export function doneStopIds(sessions: readonly HasStop[]): Set<string> {
  return new Set(sessions.flatMap((s) => (s.stopId ? [s.stopId] : [])));
}

/**
 * Where you are on a line: the first stop not done yet. Stops done out of order (the other
 * line's tag, a deep link) still count, so this is the first gap, never "how many are done".
 * Returns the line's length when every stop is done (the "More stops soon" sign).
 */
export function currentStopIndex(line: LineId, sessions: readonly HasStop[]): number {
  const done = doneStopIds(sessions);
  const i = LINES[line].findIndex((s) => !done.has(s.id));
  return i < 0 ? LINES[line].length : i;
}

/** The stop to do next on a line, or undefined past the end. */
export function nextStop(line: LineId, sessions: readonly HasStop[]): Stop | undefined {
  return LINES[line][currentStopIndex(line, sessions)];
}

/** Has a stop on this line been finished today (local calendar day)? One stop per day. */
export function stopDoneToday(line: LineId, sessions: readonly HasStop[], now: Date | number = Date.now()): boolean {
  const ids = new Set(LINES[line].map((s) => s.id));
  const today = calendarDay(now);
  return sessions.some((s) => !!s.stopId && ids.has(s.stopId) && calendarDay(s.at) === today);
}

/** Has anything on this line been done? (The other line shows its station until it has.) */
export function lineStarted(line: LineId, sessions: readonly HasStop[]): boolean {
  return LINES[line].some((s) => doneStopIds(sessions).has(s.id));
}

/** The session that completed a stop (the latest, if a stop was somehow done twice). */
export function sessionForStop<T extends HasStop>(stopId: string, sessions: readonly T[]): T | undefined {
  let found: T | undefined;
  for (const s of sessions) if (s.stopId === stopId && (!found || s.at > found.at)) found = s;
  return found;
}

/**
 * Free readers skip lessons that are Pro today (cold reads, Pro packs) and go straight to the
 * talk, which is always free. The map shows a ProBadge on the card, never a lock.
 */
export function lessonIsPro(lesson: Lesson): boolean {
  if (lesson.kind === 'cold') return true; // pro.ts canColdRead: only a moment's retest is free
  if (lesson.kind === 'pack') return !getPack(lesson.packId)?.free;
  return false; // built-in and pack passages are free to Glide
}

/**
 * Was this stop's lesson done today? Pack drills save no session, but every drilled word lands
 * in the word book with `lastSeen`; passages save a session with their passage id.
 */
export function lessonDoneToday(
  lesson: Lesson,
  data: { sessions: readonly { passageId: string; at: number }[]; book: WordBook },
  now: Date | number = Date.now(),
): boolean {
  const today = calendarDay(now);
  if (lesson.kind === 'pack') {
    const words = getPack(lesson.packId)?.words ?? [];
    return words.some((w) => {
      const e = data.book[w.word.toLowerCase()];
      return !!e && calendarDay(e.lastSeen) === today;
    });
  }
  return data.sessions.some((s) => s.passageId === lesson.passageId && calendarDay(s.at) === today);
}

/** Stop 1 is the 30-second first talk; every stop after it is a full minute. */
export function talkSeconds(stopIndex: number): '30' | '60' {
  return stopIndex === 0 ? '30' : '60';
}

export type StartRoute =
  | { pathname: '/talk'; params: { prompt: string; stop: string; seconds: '30' | '60'; from: 'home' } }
  | { pathname: '/fixit'; params: { words: string; title: string } }
  | { pathname: '/session/[id]'; params: { id: string; cold?: '1' } };

/**
 * Where "Start today's stop" goes: the lesson first if it hasn't been done today (and the reader
 * can open it), otherwise the talk. talk.tsx saves `stopId` and `promptId` on the session.
 */
export function startRoute(stop: Stop, opts: { pro: boolean; lessonDone: boolean }): StartRoute {
  const l = stop.lesson;
  if (l && !opts.lessonDone && (opts.pro || !lessonIsPro(l))) {
    if (l.kind === 'pack') {
      const p = getPack(l.packId);
      if (p) return { pathname: '/fixit', params: { words: p.words.map((w) => w.word).join(','), title: p.title } };
    } else if (l.kind === 'cold') {
      return { pathname: '/session/[id]', params: { id: l.passageId, cold: '1' } };
    } else {
      return { pathname: '/session/[id]', params: { id: l.passageId } };
    }
  }
  const index = LINES[stop.line].findIndex((s) => s.id === stop.id);
  return { pathname: '/talk', params: { prompt: stop.promptId, stop: stop.id, seconds: talkSeconds(index), from: 'home' } };
}

/** The lesson's display name ("Make your point", "Signal and Noise"). */
export function lessonTitle(lesson: Lesson): string {
  if (lesson.kind === 'pack') return getPack(lesson.packId)?.title ?? 'Word pack';
  const p = getPassage(lesson.passageId) ?? packPassage(lesson.passageId);
  // Pack passages are titled "A useful disagreement · Make your point": the passage part is enough here.
  return p ? p.title.split(' · ')[0] : 'A short passage';
}

export const LESSON_KIND: Record<Lesson['kind'] | 'talk', string> = {
  talk: 'Topic talk',
  pack: 'Word pack',
  cold: 'Cold read',
  glide: 'Glide rehearsal',
};

/** What kind of stop this is, by what comes first. */
export function stopKind(stop: Stop): Lesson['kind'] | 'talk' {
  return stop.lesson?.kind ?? 'talk';
}

/** The best Flow among talks of the same Flow version (trends never compare across versions). */
export function bestFlow(sessions: readonly { flow?: number; flowVersion?: string }[], flowVersion: string): number | undefined {
  let best: number | undefined;
  for (const s of sessions) if (typeof s.flow === 'number' && s.flowVersion === flowVersion && (best === undefined || s.flow > best)) best = s.flow;
  return best;
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * When a stop ahead comes up, if you do one a day: "Tomorrow", then the weekday for the rest of
 * this week, then just its number. `daysAhead` is 1 for tomorrow.
 */
export function aheadLabel(daysAhead: number, stopNumber: number, now = new Date()): string {
  if (daysAhead <= 0) return 'Today';
  if (daysAhead === 1) return 'Tomorrow';
  if (daysAhead < 7) {
    const d = new Date(now);
    d.setDate(d.getDate() + daysAhead);
    return WEEKDAYS[d.getDay()];
  }
  return `Stop ${stopNumber}`;
}

export type HeaderTitle = { title: string; streakDays: number };

/**
 * The home header's big line: "6 days in a row" once there's a streak worth naming, "Day 2" in
 * your first days, "Welcome back" after a gap (never red, never a loss).
 */
export function headerTitle(
  sessions: readonly { at: number }[],
  streakDays: number,
  now: Date | number = Date.now(),
): string {
  if (!sessions.length) return 'Day 1';
  if (streakDays >= 2) return `${streakDays} days in a row`;
  const first = Math.min(...sessions.map((s) => s.at));
  const sinceFirst = calendarDay(now) - calendarDay(first);
  if (streakDays === 1 && sinceFirst <= 1) return `Day ${sinceFirst + 1}`;
  return 'Welcome back';
}
