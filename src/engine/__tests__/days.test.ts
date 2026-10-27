// Calendar days, not 24-hour blocks: a week that crosses a clock change is still 7 days.
// The zone comes from test/globalSetup.js (MOUTHFUL_TEST_TZ, default America/Toronto); setting
// process.env.TZ in here wouldn't reach Node's clock. The clock-change tests only mean something
// in a zone with Toronto's 2026 transitions, so elsewhere (CI also runs Asia/Kolkata, no DST)
// they're skipped by name and the plain calendar tests still run.
import { daysBetween } from '../days';
import { retestDue, SessionLike } from '../progress';

const at = (month: number, day: number, h = 0, m = 0) => new Date(2026, month - 1, day, h, m).getTime();

const hours = (a: number, b: number) => (b - a) / 3_600_000;
/** Spring-forward 8 March and fall-back 1 November 2026, as in Toronto. */
const hasTorontoDst = hours(at(3, 2, 0, 30), at(3, 9, 0, 30)) === 167 && hours(at(10, 29, 23, 30), at(11, 5, 23, 30)) === 169;
const dstIt = hasTorontoDst ? it : it.skip;
const dstName = (name: string) => (hasTorontoDst ? name : `${name} (skipped: no Toronto DST in ${process.env.TZ ?? 'this zone'})`);

function session(id: string, t: number): SessionLike {
  return { id, passageId: 'baseline', at: t, wpm: 150, fillersPerMin: 0, accuracy: 95, score: 80 };
}

describe('daysBetween', () => {
  dstIt(dstName('really is testing a clock change: this week is an hour short'), () => {
    expect(hours(at(3, 2, 0, 30), at(3, 9, 0, 30))).toBe(167);
  });

  dstIt(dstName('counts a week across spring-forward as 7 days'), () => {
    expect(daysBetween(at(3, 2, 0, 30), at(3, 9, 0, 30))).toBe(7);
  });

  dstIt(dstName('counts a week across fall-back as 7 days'), () => {
    expect(daysBetween(at(10, 29, 23, 30), at(11, 5, 23, 30))).toBe(7);
  });

  it('counts by the calendar: late tonight to early tomorrow is one day', () => {
    expect(daysBetween(at(6, 1, 23, 55), at(6, 2, 0, 5))).toBe(1);
    expect(daysBetween(at(6, 1, 0, 5), at(6, 1, 23, 55))).toBe(0);
  });

  it('takes dates or timestamps, and goes negative when b is earlier', () => {
    expect(daysBetween(new Date(2026, 0, 31), new Date(2026, 1, 1))).toBe(1);
    expect(daysBetween(at(3, 9), at(3, 2))).toBe(-7);
  });
});

describe('re-tests across a clock change', () => {
  dstIt(dstName('asks for the day 7 re-test a week after Day 1, even when the clocks went forward'), () => {
    const day1 = session('day1', at(3, 2, 0, 30));
    expect(retestDue([day1], 'day1', at(3, 9, 0, 30))).toBe(7);
  });

  dstIt(dstName('counts a re-test read early on day 7 as done, though that week was an hour short'), () => {
    const day1 = session('day1', at(3, 2, 0, 30));
    const retest = session('r', at(3, 9, 0, 10)); // day 7 on the calendar, 1 h 20 m short of 7 × 24 h in Toronto
    expect(retestDue([day1, retest], 'day1', at(3, 9, 12))).toBeUndefined();
  });

  it('still doesn’t count a read on day 6 as the day 7 re-test', () => {
    const day1 = session('day1', at(3, 2, 0, 30));
    const early = session('r', at(3, 8, 23, 50));
    expect(retestDue([day1, early], 'day1', at(3, 9, 12))).toBe(7);
  });
});
