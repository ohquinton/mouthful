// Calendar days on the reader's own clock. Dividing a gap by 24 hours is wrong twice a year:
// a week that crosses spring-forward is 167 hours, which floors to 6 days.

const DAY_MS = 86_400_000;

/**
 * Days since 1970 on the local calendar (the same idea as `localDay` in content/passages.ts).
 * Built from the local year/month/date, so it rolls over at local midnight, not UTC, and
 * clock changes don't move it.
 */
export function calendarDay(t: Date | number): number {
  const d = typeof t === 'number' ? new Date(t) : t;
  return Math.round(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY_MS);
}

/**
 * Whole local calendar days from `a` to `b`: 23:55 tonight → 00:05 tomorrow is 1, and a week
 * across a clock change is 7. Negative when `b` is earlier. Use this for streaks, re-test
 * timing and "N days since", never `(b - a) / 86_400_000`.
 */
export function daysBetween(a: Date | number, b: Date | number): number {
  return calendarDay(b) - calendarDay(a);
}
