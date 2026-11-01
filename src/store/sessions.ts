import AsyncStorage from '@react-native-async-storage/async-storage';
import { correctedAccuracy, sessionScore } from '../engine/score';
import type { ReviewMarks } from '../engine/review';
import type { PaceSegment } from '../engine/steadiness';
import { calendarDay } from '../engine/days';
import type { HabitWord } from '../engine/habits';
import type { FlowInput } from '../engine/minute';

export type SavedSession = {
  id: string;
  passageId: string;
  title: string;
  at: number; // epoch ms
  wpm: number;
  fillers: number;
  fillersPerMin: number;
  topFiller?: string;
  accuracy: number | null;
  pauses: number;
  seconds: number;
  score: number;
  stumbled: string[];
  /** Added after the trust review. Optional so older saved sessions still load. */
  context?: 'reading' | 'presenting' | 'talking';
  readCount?: number;
  skippedWords?: string[]; // every skipped word, duplicates kept
  stumbledContext?: Record<string, string>; // word → sentence it came from
  corrected?: string[]; // words the user marked "I said it"
  recordings?: string[]; // local file URIs (Day 1 and re-tests, with consent)
  habits?: Record<string, number>; // like, so, you know: reported on the Tape, never scored
  segments?: PaceSegment[]; // pace of each stretch of the passage (engine/steadiness.ts)
  steadiness?: number; // 0–100; shown on the Tape, not part of the score
  /**
   * Script parts only: Glide reached 80% of the part or its last sentence (pro.ts partReached).
   * false means an early Finish, which doesn't count as a run. Unset on older sessions (counts).
   */
  partReached?: boolean;
  /** Your own scripts only: the target length in seconds (content/targets.ts). Shown on the Tape. */
  targetSeconds?: number;
  /**
   * One Minute (docs/briefs/one-minute.md). Set only on a finished minute that had a Flow; Free
   * talk and older sessions leave all of these unset. passageId stays 'talk'.
   */
  kind?: 'minute';
  /** 0–100. Whether you kept talking (engine/minute.ts). Not the same scale as `score`. */
  flow?: number;
  /** Which Flow formula made `flow`. Trends compare only the same version. */
  flowVersion?: string;
  /** The prompt's id (content/prompts.ts), never its text. */
  promptId?: string;
  level?: 1 | 2 | 3;
  /** Token indices of likely fillers the reader marked "I meant that". Never the words. */
  overruled?: number[];
  /** The minute's numbers, so the Tape can redraw (and recompute) without the transcript. */
  minute?: {
    longPauses: number;
    longestPauseSeconds: number;
    talkSeconds: number;
    wpm: number;
    words: number;
    umCount: number;
    umPerMin: number;
    /** Likely fillers at Finish: token index + which habit word (a fixed list of codes). */
    habitFillers: { index: number; word: HabitWord }[];
    /** "unsure" uses: shown as a quiet count, never as fillers. */
    habitUnsure: number;
    /** What Flow was computed from (engine FlowInput). */
    input: FlowInput;
    /** Seconds from Go to the first word. Optional: minutes saved before 2026-10-31 don't have it. */
    timeToFirstWordSeconds?: number;
  };
  /** Tester mode only (supervised beta). Stays on the phone; never sent anywhere. */
  review?: {
    statuses: string; // see engine/review.ts
    transcript: string; // what the phone heard
    marks: ReviewMarks;
    firstWordLagMs?: number; // voice detected → first word inked
    reviewed?: boolean;
    /** The listener's quiet restarts and recoverable error codes (counts only). Added in Wave 4b. */
    listener?: { restarts: number; glitches: Record<string, number> };
  };
};

const KEY = 'mouthful.sessions.v1';

export async function loadSessions(): Promise<SavedSession[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as SavedSession[]) : [];
  } catch {
    return [];
  }
}

export async function saveSession(s: SavedSession): Promise<void> {
  const all = await loadSessions();
  all.push(s);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Storage full or unavailable: the session still shows on the Tape screen.
  }
}

export async function updateSession(id: string, patch: Partial<SavedSession>): Promise<SavedSession | undefined> {
  const all = await loadSessions();
  const i = all.findIndex((s) => s.id === id);
  if (i < 0) return undefined;
  all[i] = { ...all[i], ...patch };
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(all));
  } catch {}
  return all[i];
}

/**
 * "I said it": the recogniser marked a word as skipped but the reader did say it.
 * Pure: returns the session with that word counted as read and the score recomputed.
 */
export function correctSessionWord(s: SavedSession, word: string): SavedSession {
  const key = word.toLowerCase();
  const skipped = s.skippedWords ?? [];
  const n = skipped.filter((w) => w.toLowerCase() === key).length || (s.stumbled.some((w) => w.toLowerCase() === key) ? 1 : 0);
  if (!n) return s;
  const base = {
    ...s,
    stumbled: s.stumbled.filter((w) => w.toLowerCase() !== key),
    skippedWords: skipped.filter((w) => w.toLowerCase() !== key),
    corrected: [...(s.corrected ?? []), word],
  };
  if (s.readCount === undefined || s.accuracy === null) return base;
  const readCount = s.readCount + n;
  const accuracy = correctedAccuracy(readCount, base.skippedWords.length);
  const score = sessionScore(
    { wpm: s.wpm, fillersPerMin: s.fillersPerMin, accuracy, midSentencePauses: s.pauses, seconds: s.seconds },
    s.context ?? 'reading',
  );
  return { ...base, readCount, accuracy, score };
}

/**
 * Which Glide taps ("I said it" on a red word) are still corrections when the read ends.
 * `rawStatus` is the recogniser's own status for each word at Finish, before corrections.
 * A tapped word the recogniser later inked anyway (a late result, or the resync backfill) is
 * 'read' there: the recogniser got it, so logging it as a correction would make the
 * recognition_correction metric overcount its misses. One that went back to 'pending' (a
 * revision pulled the pointer back) isn't a miss either. Only words still 'skipped' count.
 * Returned in passage order.
 */
export function keptCorrections(rawStatus: readonly string[], corrected: ReadonlySet<number>): number[] {
  return [...corrected].filter((i) => rawStatus[i] === 'skipped').sort((x, y) => x - y);
}

export async function getSession(id: string): Promise<SavedSession | undefined> {
  return (await loadSessions()).find((s) => s.id === id);
}

/** Your fastest in-zone pace on this passage, used by the Pace Ghost. */
export function bestWpmFor(sessions: SavedSession[], passageId: string): number | undefined {
  const runs = sessions.filter((s) => s.passageId === passageId && s.accuracy !== null && s.accuracy >= 85);
  if (!runs.length) return undefined;
  return runs.reduce((best, s) => (s.score > best.score ? s : best)).wpm;
}

const dayKey = (t: number) => new Date(t).toDateString();

/**
 * Days in a row with at least one finished session. One missed day per 7 is forgiven
 * automatically (streak freeze), because streaks that punish cause churn.
 */
export function streak(sessions: SavedSession[], now = Date.now()): { days: number; freezeUsed: boolean } {
  // Step back one calendar day at a time (a whole number), never 24 hours: the day clocks
  // spring forward is 23 hours long and the day they fall back is 25, so 24-hour steps
  // skip a day or count one twice.
  const days = new Set(sessions.map((s) => calendarDay(s.at)));
  let count = 0;
  let freezeUsed = false;
  let sinceFreeze = 7;
  let day = calendarDay(now);
  if (!days.has(day)) day -= 1; // nothing yet today: the streak can still run to yesterday
  for (let guard = 0; guard < 3650; guard++) {
    if (days.has(day)) {
      count++;
      sinceFreeze++;
    } else if (sinceFreeze >= 7 && count > 0 && days.has(day - 1)) {
      freezeUsed = true;
      sinceFreeze = 0;
    } else break;
    day -= 1;
  }
  return { days: count, freezeUsed };
}

/** Monday-first booleans for the current week strip. */
export function thisWeek(sessions: SavedSession[], now = new Date()): { done: boolean; today: boolean; label: string }[] {
  const labels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const dow = (now.getDay() + 6) % 7;
  const monday = new Date(now);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(now.getDate() - dow);
  const days = new Set(sessions.map((s) => dayKey(s.at)));
  return labels.map((label, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return { label, done: days.has(d.toDateString()), today: i === dow };
  });
}

/** Every recording file a session points at. */
export function recordingUris(sessions: SavedSession[]): string[] {
  return sessions.flatMap((s) => s.recordings ?? []);
}

/**
 * Tester mode: the listener's restarts and glitch codes for one session, as one line for /review
 * ("2 restarts · audio-capture 3, network 1"). The beta sheet's copied row is engine/review.ts
 * and doesn't carry these, so Quinton copies them from the screen by hand.
 */
export function listenerSummary(review: SavedSession['review']): string {
  const d = review?.listener;
  if (!d) return 'Listener counts weren’t saved for this session.'; // before Wave 4b, or not tester mode
  const restarts = d.restarts === 1 ? '1 restart' : `${d.restarts} restarts`;
  const codes = Object.entries(d.glitches)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([code, n]) => `${code} ${n}`);
  return `${restarts} · ${codes.length ? codes.join(', ') : 'no glitches'}`;
}

/** How many sessions still hold tester mode's review data (what the phone heard, marks). */
export function reviewCount(sessions: SavedSession[]): number {
  return sessions.filter((s) => s.review).length;
}

/**
 * Forget what tester mode kept: transcripts, word statuses, marks, first-word lag.
 * Scores and the sessions themselves stay. Recordings are separate (store/recordings.ts).
 * Returns how many sessions had review data.
 */
export async function clearSessionReviews(): Promise<number> {
  try {
    const all = await loadSessions();
    const n = reviewCount(all);
    if (n) await AsyncStorage.setItem(KEY, JSON.stringify(all.map(({ review: _r, ...rest }) => rest)));
    return n;
  } catch {
    return 0;
  }
}

/** Forget recordings on every session (after the files themselves are deleted). */
export async function clearSessionRecordings(): Promise<void> {
  try {
    const all = await loadSessions();
    await AsyncStorage.setItem(KEY, JSON.stringify(all.map(({ recordings: _r, ...rest }) => rest)));
  } catch {}
}
