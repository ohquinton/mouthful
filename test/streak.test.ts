// Streaks count calendar days, not 24-hour steps. The day clocks spring forward is only
// 23 hours long, so stepping back 24 h from just after midnight jumps over a whole day.
// Run in Toronto time so 8 March 2026 (spring-forward) really is in the gap, whatever
// zone the machine running jest is set to.
import { SavedSession, streak, thisWeek } from '../src/store/sessions';

const ORIGINAL_TZ = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'America/Toronto';
});
afterAll(() => {
  if (ORIGINAL_TZ === undefined) delete process.env.TZ;
  else process.env.TZ = ORIGINAL_TZ;
});

const at = (month: number, day: number, h = 12, m = 0) => new Date(2026, month - 1, day, h, m).getTime();

const session = (t: number): SavedSession => ({
  id: String(t),
  passageId: 'night-shift',
  title: 'Night shift',
  at: t,
  wpm: 140,
  fillers: 0,
  fillersPerMin: 0,
  accuracy: 95,
  pauses: 0,
  seconds: 60,
  score: 80,
  stumbled: [],
});

describe('streak', () => {
  it('really is testing a clock change: 8 March is 23 hours long', () => {
    expect((at(3, 9, 0, 30) - at(3, 8, 0, 30)) / 3_600_000).toBe(23);
  });

  it('counts three days across spring-forward, just after midnight', () => {
    const sessions = [at(3, 7), at(3, 8), at(3, 9, 0, 10)].map(session);
    expect(streak(sessions, at(3, 9, 0, 30))).toEqual({ days: 3, freezeUsed: false });
  });

  it('keeps yesterday’s streak just after midnight on the short night', () => {
    // Nothing yet today (9 March): the streak is still the two days before.
    const sessions = [at(3, 7), at(3, 8)].map(session);
    expect(streak(sessions, at(3, 9, 0, 30))).toEqual({ days: 2, freezeUsed: false });
  });

  it('counts a week across fall-back as 7 days', () => {
    const sessions = [1, 2, 3, 4, 5, 6, 7].map((d) => session(at(11, d, 23, 30)));
    expect(streak(sessions, at(11, 7, 23, 45))).toEqual({ days: 7, freezeUsed: false });
  });

  it('is 0 with no sessions, and 0 when the last one was two days ago', () => {
    expect(streak([], at(6, 10))).toEqual({ days: 0, freezeUsed: false });
    expect(streak([session(at(6, 8))], at(6, 10))).toEqual({ days: 0, freezeUsed: false });
  });

  it('counts several sessions on one day once', () => {
    const sessions = [at(6, 9, 8), at(6, 9, 20), at(6, 10, 7)].map(session);
    expect(streak(sessions, at(6, 10, 9)).days).toBe(2);
  });

  it('forgives one missed day after a week, and only one', () => {
    // 1–7 June read, 8 June missed, 9–10 June read: 9 days with the freeze.
    const days = [1, 2, 3, 4, 5, 6, 7, 9, 10];
    expect(streak(days.map((d) => session(at(6, d))), at(6, 10, 18))).toEqual({ days: 9, freezeUsed: true });
    // Two missed days in a row break it.
    const gap = [1, 2, 3, 4, 5, 6, 7, 10];
    expect(streak(gap.map((d) => session(at(6, d))), at(6, 10, 18))).toEqual({ days: 1, freezeUsed: false });
  });
});

describe('thisWeek', () => {
  it('marks the days read, Monday first, across spring-forward', () => {
    // Monday 9 March 2026; Sunday 8 March was the short day.
    const week = thisWeek([session(at(3, 9, 0, 10)), session(at(3, 11))], new Date(at(3, 11, 9)));
    expect(week.map((d) => d.done)).toEqual([true, false, true, false, false, false, false]);
    expect(week.findIndex((d) => d.today)).toBe(2);
  });
});
