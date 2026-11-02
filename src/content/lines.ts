// The two train lines on the home map (DECISIONS 2026-11-01, docs/briefs/remodel-screens.md §0.1, §2).
//
// One stop = one day's practice, and every stop ends with a topic talk, so "beat yourself tomorrow"
// always has a talk to beat. Some stops start with a short lesson first: a word pack drill, a cold
// read or a Glide passage. A stop is done when a saved session carries its `stopId` (talk.tsx saves
// it when it was opened with the `stop` param). Nothing else is stored: progress is worked out from
// saved sessions, so it survives updates and goes away with Reset all data.
//
// Stop ids are what sessions keep, so never rename or reuse one. Add new stops at the end.

import { MINUTE_PROMPTS, Prompt, promptById } from './prompts';
import { getPack, packPassage } from './wordpacks';
import { getPassage } from './passages';
import { calendarDay } from '../engine/days';
import { dayKey, type WordBook } from '../engine/vocab';

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

/**
 * A stop's number on its own line (1-based), from the line's list, never parsed out of the id.
 * Undefined for an unknown id (an old or odd session, a talk that wasn't a stop).
 */
export function stopNumber(id: string | undefined): number | undefined {
  const stop = getStop(id);
  return stop ? LINES[stop.line].indexOf(stop) + 1 : undefined;
}

/** Is this the last stop of its line? (The results then say "Line complete", never "Stop 15".) */
export function isLastStop(id: string | undefined): boolean {
  const stop = getStop(id);
  return !!stop && LINES[stop.line].indexOf(stop) === LINES[stop.line].length - 1;
}

/**
 * Short names for the long (level 3) topics, so a done stop on the map reads in one line
 * ("Topic talk · An opinion"). The full question shows on the talk screen. Keyed by prompt id, so
 * a talk on a different topic ("Different topic") is labelled by what was really talked about.
 */
const SHORT_TOPIC: Record<string, string> = {
  p25: 'Your work, simply',
  p26: 'A restaurant you like',
  p27: 'An opinion',
  p28: 'The best meal',
  p29: 'Something you learned',
  p30: 'An extra hour',
  p31: 'A project update',
  p32: 'A plan that went wrong',
  p33: 'Your first day',
  p34: 'Your city',
  p35: 'A hobby',
  p36: 'Advice to yourself',
};

/** A topic's short name: "Coffee", "Trust", "An opinion". Short topics are already their own name. */
export function shortTopic(promptId: string | undefined): string {
  if (promptId && SHORT_TOPIC[promptId]) return SHORT_TOPIC[promptId];
  return (promptById(promptId)?.text ?? 'Topic talk').replace(/[.?!]$/, '');
}

type HasStop = { stopId?: string; at: number };

type MaybeFirstTalk = HasStop & { kind?: string; promptId?: string; flowVersion?: string; minute?: unknown };

/** A 30-second talk (onboarding's first), by its record or its Flow version (as store/minute.ts isShortTalk). */
function thirty(s: { minute?: unknown; flowVersion?: string }): boolean {
  return (s.minute as { limitSeconds?: number } | undefined)?.limitSeconds === 30 || (s.flowVersion ?? '').endsWith('-s30');
}

/**
 * Onboarding's first talk (30 seconds on Coffee, src/onboarding.ts firstTalkRoute) is stop 1 of
 * the line you picked, but it's saved without a stopId. Give the earliest such talk that stop, so
 * Home starts you on stop 2 rather than asking for Coffee again. A copy; storage is untouched.
 * Harmless once onboarding passes `stop` itself: a line that already has stop 1 is left alone.
 */
export function withFirstTalk<T extends MaybeFirstTalk>(sessions: readonly T[], line: LineId): T[] {
  const first = LINES[line][0];
  if (sessions.some((s) => s.stopId === first.id)) return [...sessions];
  let pick: T | undefined;
  for (const s of sessions) {
    if (!s.stopId && s.kind === 'minute' && s.promptId === first.promptId && thirty(s) && (!pick || s.at < pick.at)) pick = s;
  }
  return sessions.map((s) => (s === pick ? { ...s, stopId: first.id } : s));
}

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

/**
 * Past the last stop, today's stop is a full-minute topic talk on the topic of the day
 * (`promptId`), or any full-minute talk today that wasn't a stop on a line ("Different topic").
 * Onboarding's 30 seconds and stops on the other line don't count.
 */
export function dailyTalkDoneToday(sessions: readonly MaybeFirstTalk[], promptId: string, now: Date | number = Date.now()): boolean {
  const today = calendarDay(now);
  return sessions.some((s) => s.kind === 'minute' && !thirty(s) && calendarDay(s.at) === today && (s.promptId === promptId || !s.stopId));
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

type LessonData = { sessions: readonly { passageId: string; at: number }[]; book: WordBook };

/**
 * Was this lesson done on the calendar day of `when`? Pack drills save no session, but every
 * drilled word lands in the word book (`heardDays` as day keys, and `lastSeen`); passages save a
 * session with their passage id. Home asks about today; the map asks about an old stop's day, so
 * its label only names a lesson that was really done.
 */
export function lessonDoneOn(lesson: Lesson, data: LessonData, when: Date | number): boolean {
  const day = calendarDay(when);
  if (lesson.kind === 'pack') {
    const key = dayKey(typeof when === 'number' ? when : when.getTime());
    const words = getPack(lesson.packId)?.words ?? [];
    return words.some((w) => {
      const e = data.book[w.word.toLowerCase()];
      return !!e && (calendarDay(e.lastSeen) === day || (e.heardDays ?? []).includes(key) || (e.cleanDays ?? []).includes(key));
    });
  }
  return data.sessions.some((s) => s.passageId === lesson.passageId && calendarDay(s.at) === day);
}

/** Was this stop's lesson done today? */
export function lessonDoneToday(lesson: Lesson, data: LessonData, now: Date | number = Date.now()): boolean {
  return lessonDoneOn(lesson, data, now);
}

/**
 * Every stop opened from Home is a full minute, stop 1 included (the other line's stop 1, or your
 * own after a mic-denied skip, or an upgraded reader with no first talk). Only onboarding's first
 * talk is 30 seconds (src/onboarding.ts firstTalkRoute).
 */
export function talkSeconds(): '30' | '60' {
  return '60';
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
  return { pathname: '/talk', params: { prompt: stop.promptId, stop: stop.id, seconds: talkSeconds(), from: 'home' } };
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

type DoneSession = { at: number; promptId?: string; flow?: number; minute?: unknown; flowVersion?: string };

/**
 * A done stop's two lines on the map, saying what was really done:
 * - the talk, named by the topic actually talked about ("Different topic" may have changed it);
 * - the lesson only when it was done that day (a free reader skips a Pro lesson: the talk only);
 * - "Your first talk" only for onboarding's 30 seconds, never for a full-minute stop 1.
 */
export function doneLabel(stop: Stop, session: DoneSession | undefined, lessonDone: boolean): { title: string; sub: string } {
  const topic = shortTopic(session?.promptId ?? stop.promptId);
  const flow = typeof session?.flow === 'number' ? `Flow ${session.flow}` : 'Done';
  if (session && thirty(session)) {
    return { title: `Your first talk · ${topic}`, sub: typeof session.flow === 'number' ? `${flow} · your starting point` : flow };
  }
  if (stop.lesson && lessonDone) return { title: `${LESSON_KIND[stop.lesson.kind]} · ${lessonTitle(stop.lesson)}`, sub: `${topic} · ${flow}` };
  return { title: `${LESSON_KIND.talk} · ${topic}`, sub: flow };
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
