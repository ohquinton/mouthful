// Shapes saved sessions into what the Progress screen draws. Pure, so it's testable.

export type SessionLike = {
  id: string;
  passageId: string;
  at: number;
  wpm: number;
  fillersPerMin: number;
  accuracy: number | null;
  score: number;
  context?: 'reading' | 'presenting' | 'talking';
};

export type SpeakingContext = 'reading' | 'presenting' | 'talking';

/** Older sessions didn't store a context: Free talk was talking, everything else reading. */
export function contextOf(s: Pick<SessionLike, 'context' | 'passageId'>): SpeakingContext {
  return s.context ?? (s.passageId === 'talk' ? 'talking' : 'reading');
}

/**
 * Pace only compares like with like: each context has its own suggested range,
 * so the chart shows one context at a time. Returns the contexts that have sessions
 * (most recent first) and the one to show by default.
 */
export function paceContexts(sessions: SessionLike[]): { available: SpeakingContext[]; initial: SpeakingContext } {
  const byRecent = [...sessions].sort((a, b) => b.at - a.at);
  const available: SpeakingContext[] = [];
  for (const s of byRecent) {
    const c = contextOf(s);
    if (!available.includes(c)) available.push(c);
  }
  // Default to the most recent context that already has a trend (2+ sessions).
  const withTrend = available.find((c) => sessions.filter((s) => contextOf(s) === c).length >= 2);
  return { available, initial: withTrend ?? available[0] ?? 'reading' };
}

const DAY = 86_400_000;

function startOfDay(t: number): number {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Last `n` sessions, oldest first, for the pace and filler charts. */
export function recent<T extends SessionLike>(sessions: T[], n: number): T[] {
  return [...sessions].sort((a, b) => a.at - b.at).slice(-n);
}

/**
 * 12 weeks of practice as a Monday-first grid: weeks[w][d] = sessions that day.
 * Days after today are -1 so the screen can leave them blank.
 */
export function heatStrip(sessions: SessionLike[], weeks = 12, now = Date.now()): number[][] {
  const today = startOfDay(now);
  const dow = (new Date(today).getDay() + 6) % 7;
  const firstMonday = today - dow * DAY - (weeks - 1) * 7 * DAY;
  const counts = new Map<number, number>();
  for (const s of sessions) {
    const k = startOfDay(s.at);
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return Array.from({ length: weeks }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      // Round, because DST days are 23 or 25 hours long.
      const day = startOfDay(firstMonday + (w * 7 + d) * DAY + 12 * 3_600_000);
      return day > today ? -1 : counts.get(day) ?? 0;
    }),
  );
}

export type Bests = {
  bestScore?: number;
  cleanest?: number; // lowest fillers per minute
  mostAccurate?: number;
  totalSessions: number;
  totalDays: number;
};

export function personalBests(sessions: SessionLike[]): Bests {
  const scored = sessions.filter((s) => s.passageId !== 'talk');
  return {
    bestScore: sessions.length ? Math.max(...sessions.map((s) => s.score)) : undefined,
    cleanest: sessions.length ? Math.min(...sessions.map((s) => s.fillersPerMin)) : undefined,
    mostAccurate: scored.length ? Math.max(...scored.map((s) => s.accuracy ?? 0)) : undefined,
    totalSessions: sessions.length,
    totalDays: new Set(sessions.map((s) => startOfDay(s.at))).size,
  };
}

export type Comparison = { day1: SessionLike; latest: SessionLike; daysBetween: number };

/** Day 1 baseline against the most recent re-read of the same passage, else the latest session. */
export function day1VsNow(sessions: SessionLike[], baselineId?: string): Comparison | undefined {
  const day1 = sessions.find((s) => s.id === baselineId);
  if (!day1) return undefined;
  const later = sessions.filter((s) => s.at > day1.at);
  // Best: the same passage (a re-test). Otherwise the latest session in the same context,
  // so Day 1 reading pace is never compared with free talk pace.
  const newestFirst = [...later].reverse();
  const latest =
    newestFirst.find((s) => s.passageId === day1.passageId) ?? newestFirst.find((s) => contextOf(s) === contextOf(day1));
  if (!latest) return undefined;
  return { day1, latest, daysBetween: Math.max(1, Math.round((latest.at - day1.at) / DAY)) };
}

/** Day 7, 30 and 100 re-tests of the baseline passage. Returns the milestone that's due, if any. */
export function retestDue(sessions: SessionLike[], baselineId?: string, now = Date.now()): number | undefined {
  const day1 = sessions.find((s) => s.id === baselineId);
  if (!day1) return undefined;
  const age = Math.floor((startOfDay(now) - startOfDay(day1.at)) / DAY);
  const retests = sessions.filter((s) => s.passageId === day1.passageId && s.id !== day1.id);
  for (const m of [100, 30, 7]) {
    if (age >= m) {
      const done = retests.some((s) => s.at >= day1.at + m * DAY);
      return done ? undefined : m;
    }
  }
  return undefined;
}
