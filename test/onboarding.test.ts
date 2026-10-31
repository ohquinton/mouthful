// Onboarding rules (src/onboarding.ts). The S0 first: saying no to the mic during onboarding must
// lead out of onboarding, never back to the mic step (which leads straight back to the gate).
import {
  clock,
  daysUntilDate,
  heardClearly,
  micGateExit,
  momentDate,
  paceRangeLine,
  previousStep,
  remindersShown,
  streakPillShown,
  WHEN_CHIPS,
} from '../src/onboarding';
import { countdownLabel, getMoment } from '../src/content/moments';

const noon = (month: number, day: number) => new Date(2026, month - 1, day, 12, 0);
const lateNight = (month: number, day: number) => new Date(2026, month - 1, day, 23, 50);

describe('micGateExit: no trap when the mic is refused', () => {
  it('finishes onboarding and opens Today while onboarding', () => {
    expect(micGateExit(false)).toBe('today');
  });

  it('goes back as before once onboarded (practice screens)', () => {
    expect(micGateExit(true)).toBe('back');
  });
});

describe('previousStep', () => {
  it('walks back one step at a time and stops at the hook', () => {
    expect(previousStep('mic')).toBe('moment');
    expect(previousStep('moment')).toBe('hook');
    expect(previousStep('hook')).toBeNull();
  });
});

describe('momentDate: the date chips', () => {
  it('offers the six chips, with Not sure meaning no date', () => {
    expect(WHEN_CHIPS.map((c) => c.label)).toEqual(['Today', 'Tomorrow', 'In 3 days', 'Next week', 'In 2 weeks', 'Not sure']);
    expect(momentDate(null, noon(10, 30))).toBeUndefined();
  });

  it('counts calendar days from today', () => {
    expect(momentDate(0, noon(10, 30))).toBe('2026-10-30');
    expect(momentDate(1, noon(10, 30))).toBe('2026-10-31');
    expect(momentDate(3, noon(10, 30))).toBe('2026-11-02');
    expect(momentDate(14, noon(12, 25))).toBe('2027-01-08');
  });

  it('lands on the right day across a clock change, late at night', () => {
    // 1 Nov (fall back) and 8 Mar (spring forward) 2026 in Toronto. The date comes from the
    // calendar, not now + n × 24 h, so it holds in any zone.
    expect(momentDate(7, lateNight(10, 30))).toBe('2026-11-06');
    expect(momentDate(7, lateNight(3, 5))).toBe('2026-03-12');
  });

  it('makes Today say "Your interview is in 3 days"', () => {
    const now = noon(10, 30);
    const interview = getMoment('interview')!;
    expect(countdownLabel(interview, momentDate(3, now), now)).toBe('Your interview is in 3 days');
    expect(countdownLabel(interview, momentDate(null, now), now)).toBe('Preparing for your interview');
  });
});

describe('remindersShown', () => {
  const now = noon(10, 30);
  it('hides the daily reminder when the moment is today or tomorrow', () => {
    expect(remindersShown(momentDate(0, now), now)).toBe(false);
    expect(remindersShown(momentDate(1, now), now)).toBe(false);
  });
  it('shows it from 2 days out, and with no date', () => {
    expect(remindersShown(momentDate(3, now), now)).toBe(true);
    expect(remindersShown(undefined, now)).toBe(true);
  });
  it('counts days on the calendar, not in 24-hour steps', () => {
    expect(daysUntilDate('2026-10-31', lateNight(10, 30))).toBe(1);
  });
});

describe('heardClearly', () => {
  it('is words heard out of words reached', () => {
    expect(heardClearly({ readCount: 71, skippedWords: ['café', 'espresso', 'a', 'b', 'c', 'd', 'e'] })).toEqual({ heard: 71, of: 78 });
    expect(heardClearly({ readCount: 40 })).toEqual({ heard: 40, of: 40 });
  });
  it('is null for older sessions without readCount', () => {
    expect(heardClearly({})).toBeNull();
  });
});

describe('starting point copy', () => {
  it('formats time as m:ss', () => {
    expect(clock(34)).toBe('0:34');
    expect(clock(75)).toBe('1:15');
    expect(clock(0)).toBe('0:00');
  });
  it('gives a range, never a verdict', () => {
    const band: [number, number] = [130, 165];
    expect(paceRangeLine(142, band)).toBe('That’s inside 130–165, a comfortable range for reading aloud.');
    for (const w of [100, 142, 190]) {
      expect(paceRangeLine(w, band)).toContain('130–165');
      expect(paceRangeLine(w, band)).not.toMatch(/correct|wrong|bad/i);
    }
  });
});

describe('streakPillShown', () => {
  it('waits until day 2', () => {
    expect(streakPillShown(0)).toBe(false);
    expect(streakPillShown(1)).toBe(false);
    expect(streakPillShown(2)).toBe(true);
  });
});
