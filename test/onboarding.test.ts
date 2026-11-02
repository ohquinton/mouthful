// Onboarding rules (src/onboarding.ts). The S0 first: saying no to the mic during onboarding must
// lead out of onboarding, never back to the talk step (which leads straight back to the gate).
import {
  clock,
  dashIndex,
  daysUntilDate,
  DEFAULT_LINE,
  FIRST_TALK,
  firstTalkRoute,
  LINE_CARDS,
  lineButtonLabel,
  lineOrDefault,
  micGateExit,
  momentDate,
  ONBOARDING_DASHES,
  parseStep,
  previousStep,
  privacyLine,
  startingPoint,
  STOPPED_EARLY_SECONDS,
  streakPillShown,
  UM_NOTE,
  WHEN_CHIPS,
} from '../src/onboarding';
import { STOPPED_SHARE, stoppedEarlyAt, wholeSeconds } from '../src/store/minute';
import { countdownLabel, getMoment } from '../src/content/moments';
import { MINUTE_PROMPTS } from '../src/content/prompts';

const noon = (month: number, day: number) => new Date(2026, month - 1, day, 12, 0);
const lateNight = (month: number, day: number) => new Date(2026, month - 1, day, 23, 50);

describe('micGateExit: no trap when the mic is refused', () => {
  it('finishes onboarding and opens Home while onboarding', () => {
    expect(micGateExit(false)).toBe('today');
  });

  it('goes back as before once onboarded (practice screens)', () => {
    expect(micGateExit(true)).toBe('back');
  });
});

describe('steps', () => {
  it('walks back one step at a time and stops at the hook', () => {
    expect(previousStep('talk')).toBe('line');
    expect(previousStep('line')).toBe('hook');
    expect(previousStep('hook')).toBeNull();
  });

  it('goes back from mic denied to the talk intro, never further into a loop', () => {
    expect(previousStep('denied')).toBe('talk');
  });

  it('lights four dashes, with mic denied on the talk dash and the starting point last', () => {
    expect(ONBOARDING_DASHES).toBe(4);
    expect([dashIndex('hook'), dashIndex('line'), dashIndex('talk'), dashIndex('denied'), dashIndex('start')]).toEqual([0, 1, 2, 2, 3]);
  });

  it('parses the step param and falls back to the hook for anything else', () => {
    expect(parseStep('line')).toBe('line');
    expect(parseStep('denied')).toBe('denied');
    for (const bad of [undefined, '', 'moment', 'mic', ['line'], 3, 'LINE']) expect(parseStep(bad)).toBe('hook');
  });
});

describe('which train?', () => {
  it('pre-selects Sharp Talk for everyone', () => {
    expect(DEFAULT_LINE).toBe('sharp');
    expect(lineOrDefault(undefined)).toBe('sharp');
  });

  it('keeps a saved pick and ignores anything else', () => {
    expect(lineOrDefault('clear')).toBe('clear');
    expect(lineOrDefault('sharp')).toBe('sharp');
    expect(lineOrDefault('esl')).toBe('sharp');
    expect(lineOrDefault(null)).toBe('sharp');
  });

  it('offers two cards, Sharp Talk first, each with three things to practise', () => {
    expect(LINE_CARDS.map((c) => c.id)).toEqual(['sharp', 'clear']);
    expect(LINE_CARDS.map((c) => c.name)).toEqual(['Sharp Talk', 'Clear English']);
    for (const c of LINE_CARDS) expect(c.practise).toHaveLength(3);
  });

  it('labels the button after the selection', () => {
    expect(lineButtonLabel('sharp')).toBe('Get on Sharp Talk');
    expect(lineButtonLabel('clear')).toBe('Get on Clear English');
  });

  it('never leads with presentations or interviews, and never talks down', () => {
    const copy = LINE_CARDS.flatMap((c) => [c.name, c.who, ...c.practise]).join(' ');
    expect(copy).not.toMatch(/presentation|interview|accent|native|fix your|bad English/i);
  });
});

describe('the first topic talk', () => {
  it('is Coffee for 30 seconds', () => {
    const prompt = MINUTE_PROMPTS.find((p) => p.id === FIRST_TALK.promptId);
    expect(prompt?.text).toBe('Coffee');
    expect(FIRST_TALK.seconds).toBe(30);
    expect(FIRST_TALK.ideas).toHaveLength(3);
  });

  it('follows the route contract with talk.tsx (string params)', () => {
    expect(firstTalkRoute()).toEqual({ pathname: '/talk', params: { prompt: 'p01', seconds: '30', from: 'onboarding' } });
  });

  it('says plainly where the speech goes', () => {
    expect(privacyLine(true)).toBe('It listens only while you talk. Your speech is turned into text on this phone.');
    expect(privacyLine(false)).toMatch(/ask before using a speech service/);
    expect(privacyLine(false)).not.toMatch(/on this phone\./);
  });
});

describe('startingPoint', () => {
  const talk = (talkSeconds: number, extra: Partial<{ flow: number; longPauses: number; umCount: number }> = {}) => ({
    kind: 'minute' as const,
    flow: extra.flow ?? 74,
    minute: { talkSeconds, longPauses: extra.longPauses ?? 0, umCount: extra.umCount ?? 1 },
  });

  it('shows Flow, a short honest table and the number to beat', () => {
    const p = startingPoint(talk(29.4))!;
    expect(p.flow).toBe(74);
    expect(p.rows).toEqual([
      { label: 'Talked for', value: '29 of 30 s' },
      { label: 'Long pauses', value: 'None' },
      { label: 'um/uh the phone heard', value: '1' },
    ]);
    expect(p.keptGoing).toBe(true);
    // No number to beat: tomorrow's full minute isn't comparable with 30 seconds.
    expect(p.tomorrow).toBe('Tomorrow: a new topic and a full minute.');
    expect(p.tomorrow).not.toMatch(/\d/);
  });

  it('uses the store’s one stopped-early threshold and one rounding rule', () => {
    expect(STOPPED_EARLY_SECONDS).toBe(STOPPED_SHARE * 30);
    // 22.4 s: stopped early here and on the results screen alike, and the seconds round down.
    const p = startingPoint(talk(22.4))!;
    expect(p.keptGoing).toBe(false);
    expect(p.keptGoing).toBe(!stoppedEarlyAt(22.4, 30));
    expect(p.tomorrow).toBe('You stopped at 22 s. Tomorrow, try to keep going for the whole minute.');
    expect(p.rows[0].value).toBe(`${wholeSeconds(22.4)} of 30 s`);
    expect(startingPoint(talk(22.6))!.keptGoing).toBe(true);
    expect(startingPoint(talk(29.8))!.rows[0].value).toBe('29 of 30 s');
  });

  it('counts long pauses and never shows more talk than the 30 seconds', () => {
    const p = startingPoint(talk(31.2, { longPauses: 2, umCount: 0 }))!;
    expect(p.rows[0].value).toBe('30 of 30 s');
    expect(p.rows[1].value).toBe('2');
    expect(p.rows[2].value).toBe('0');
  });

  it('is gentler when the talk stopped early (no happy eyes)', () => {
    const p = startingPoint(talk(18.2, { flow: 41 }))!;
    expect(p.keptGoing).toBe(false);
    expect(p.tomorrow).toBe('You stopped at 18 s. Tomorrow, try to keep going for the whole minute.');
    expect(startingPoint(talk(STOPPED_EARLY_SECONDS))!.keptGoing).toBe(true);
  });

  it('rounds Flow and is null for anything that is not a finished topic talk', () => {
    expect(startingPoint(talk(29, { flow: 73.6 }))!.flow).toBe(74);
    expect(startingPoint(undefined)).toBeNull();
    expect(startingPoint({})).toBeNull();
    expect(startingPoint({ kind: 'minute', minute: { talkSeconds: 29, longPauses: 0, umCount: 0 } })).toBeNull();
    expect(startingPoint({ kind: 'minute', flow: 60 })).toBeNull();
  });

  it('never grades: no verdict words, and the um count comes with its limit', () => {
    const p = startingPoint(talk(29))!;
    const copy = [p.tomorrow, ...p.rows.map((r) => r.label), UM_NOTE].join(' ');
    expect(copy).not.toMatch(/great|good|bad|perfect|correct|wrong|accent/i);
    expect(UM_NOTE).toMatch(/miss/);
  });
});

describe('momentDate: the date chips (Plan for it)', () => {
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

  it('makes Home say "Your interview is in 3 days"', () => {
    const now = noon(10, 30);
    const interview = getMoment('interview')!;
    expect(countdownLabel(interview, momentDate(3, now), now)).toBe('Your interview is in 3 days');
    expect(countdownLabel(interview, momentDate(null, now), now)).toBe('Preparing for your interview');
  });

  it('counts days on the calendar, not in 24-hour steps', () => {
    expect(daysUntilDate('2026-10-31', lateNight(10, 30))).toBe(1);
  });
});

describe('clock', () => {
  it('formats time as m:ss', () => {
    expect(clock(34)).toBe('0:34');
    expect(clock(75)).toBe('1:15');
    expect(clock(0)).toBe('0:00');
  });
});

describe('streakPillShown', () => {
  it('waits until day 2', () => {
    expect(streakPillShown(0)).toBe(false);
    expect(streakPillShown(1)).toBe(false);
    expect(streakPillShown(2)).toBe(true);
  });
});
