import AsyncStorage from '@react-native-async-storage/async-storage';
import { correctedAccuracy, sessionScore } from '../engine/score';
import type { ReviewMarks } from '../engine/review';
import type { PaceSegment } from '../engine/steadiness';

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
  /** Tester mode only (supervised beta). Stays on the phone; never sent anywhere. */
  review?: {
    statuses: string; // see engine/review.ts
    transcript: string; // what the phone heard
    marks: ReviewMarks;
    firstWordLagMs?: number; // voice detected → first word inked
    reviewed?: boolean;
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
  const days = new Set(sessions.map((s) => dayKey(s.at)));
  let count = 0;
  let freezeUsed = false;
  let sinceFreeze = 7;
  let cursor = new Date(now);
  if (!days.has(dayKey(cursor.getTime()))) cursor = new Date(now - 86_400_000);
  for (let guard = 0; guard < 3650; guard++) {
    if (days.has(dayKey(cursor.getTime()))) {
      count++;
      sinceFreeze++;
    } else if (sinceFreeze >= 7 && count > 0 && days.has(dayKey(cursor.getTime() - 86_400_000))) {
      freezeUsed = true;
      sinceFreeze = 0;
    } else break;
    cursor = new Date(cursor.getTime() - 86_400_000);
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

/** Forget recordings on every session (after the files themselves are deleted). */
export async function clearSessionRecordings(): Promise<void> {
  try {
    const all = await loadSessions();
    await AsyncStorage.setItem(KEY, JSON.stringify(all.map(({ recordings: _r, ...rest }) => rest)));
  } catch {}
}
