// The home map's two lines (src/content/lines.ts): where you are, whether today's stop is done,
// and where "Start today's stop" goes. Days are local calendar days (test/globalSetup.js sets the
// zone; CI also runs Asia/Kolkata).
import {
  aheadLabel,
  bestFlow,
  currentStopIndex,
  getStop,
  headerTitle,
  lessonDoneToday,
  lessonIsPro,
  lessonTitle,
  lineOf,
  LINES,
  lineStarted,
  nextStop,
  promptFor,
  sessionForStop,
  startRoute,
  stopDoneToday,
  talkSeconds,
} from '../src/content/lines';
import { MINUTE_PROMPTS } from '../src/content/prompts';
import { getPack } from '../src/content/wordpacks';
import { getPassage } from '../src/content/passages';
import { packPassage } from '../src/content/wordpacks';

const at = (month: number, day: number, h = 12, m = 0) => new Date(2026, month - 1, day, h, m).getTime();
const done = (stopId: string, t: number, extra: { flow?: number } = {}) => ({ stopId, at: t, passageId: 'talk', ...extra });

describe('line content', () => {
  it('has about 14 stops per line, unique ids, real prompts and real lessons', () => {
    const ids = new Set<string>();
    for (const line of ['sharp', 'clear'] as const) {
      expect(LINES[line].length).toBeGreaterThanOrEqual(14);
      for (const s of LINES[line]) {
        expect(ids.has(s.id)).toBe(false);
        ids.add(s.id);
        expect(s.line).toBe(line);
        expect(MINUTE_PROMPTS.some((p) => p.id === s.promptId)).toBe(true);
        const l = s.lesson;
        if (l?.kind === 'pack') expect(getPack(l.packId)).toBeDefined();
        if (l && l.kind !== 'pack') expect(getPassage(l.passageId) ?? packPassage(l.passageId)).toBeDefined();
      }
    }
  });

  it('stop 1 on both lines is the first talk, with no lesson', () => {
    expect(LINES.sharp[0]).toEqual({ id: 'sharp-01', line: 'sharp', promptId: 'p01', lesson: undefined });
    expect(LINES.clear[0].lesson).toBeUndefined();
  });

  it('Sharp Talk leans on ideas and topics, Clear English on everyday things', () => {
    const level = (id: string) => MINUTE_PROMPTS.find((p) => p.id === id)!.level;
    const sharpHigh = LINES.sharp.slice(1).filter((s) => level(s.promptId) >= 2).length;
    const clearLow = LINES.clear.slice(1).filter((s) => level(s.promptId) === 1).length;
    expect(sharpHigh).toBe(LINES.sharp.length - 1);
    expect(clearLow).toBeGreaterThanOrEqual(10);
  });

  it('defaults to Sharp Talk and finds stops by id', () => {
    expect(lineOf(undefined)).toBe('sharp');
    expect(lineOf('clear')).toBe('clear');
    expect(getStop('clear-04')?.lesson).toEqual({ kind: 'glide', passageId: 'night-shift' });
    expect(getStop('nope')).toBeUndefined();
    expect(getStop(undefined)).toBeUndefined();
    expect(promptFor(LINES.sharp[0])?.text).toBe('Coffee');
  });
});

describe('where you are on a line', () => {
  it('starts at stop 1 with no sessions', () => {
    expect(currentStopIndex('sharp', [])).toBe(0);
    expect(nextStop('sharp', [])?.id).toBe('sharp-01');
    expect(lineStarted('sharp', [])).toBe(false);
  });

  it('a stop is done when a session carries its stopId; sessions without one are ignored', () => {
    const sessions = [done('sharp-01', at(10, 30)), done('sharp-02', at(10, 31)), { at: at(10, 31), passageId: 'night-shift' }];
    expect(currentStopIndex('sharp', sessions)).toBe(2);
    expect(nextStop('sharp', sessions)?.id).toBe('sharp-03');
    expect(currentStopIndex('clear', sessions)).toBe(0);
    expect(lineStarted('sharp', sessions)).toBe(true);
    expect(lineStarted('clear', sessions)).toBe(false);
  });

  it('is the first gap, not a count, when stops were done out of order', () => {
    const sessions = [done('sharp-01', at(10, 30)), done('sharp-03', at(10, 31))];
    expect(currentStopIndex('sharp', sessions)).toBe(1);
  });

  it('runs past the end when every stop is done', () => {
    const sessions = LINES.clear.map((s, i) => done(s.id, at(10, 1) + i * 86_400_000));
    expect(currentStopIndex('clear', sessions)).toBe(LINES.clear.length);
    expect(nextStop('clear', sessions)).toBeUndefined();
  });

  it('finds the latest session for a stop', () => {
    const sessions = [done('sharp-01', at(10, 30), { flow: 60 }), done('sharp-01', at(10, 31), { flow: 70 })];
    expect(sessionForStop('sharp-01', sessions)?.flow).toBe(70);
    expect(sessionForStop('sharp-02', sessions)).toBeUndefined();
  });
});

describe('today’s stop', () => {
  it('is done when a stop on this line was finished today, by the local calendar', () => {
    const now = at(11, 1, 9);
    expect(stopDoneToday('sharp', [done('sharp-01', at(11, 1, 0, 5))], now)).toBe(true);
    expect(stopDoneToday('sharp', [done('sharp-01', at(10, 31, 23, 55))], now)).toBe(false);
  });

  it('counts only this line', () => {
    const now = at(11, 1, 9);
    expect(stopDoneToday('clear', [done('sharp-01', at(11, 1, 8))], now)).toBe(false);
    expect(stopDoneToday('sharp', [{ at: at(11, 1, 8) }], now)).toBe(false);
  });
});

describe('lessons', () => {
  const book = (word: string, lastSeen: number) => ({ [word]: { word, heardDays: [], cleanDays: [], stumbles: 0, firstSeen: lastSeen, lastSeen } });

  it('knows which lessons are Pro today', () => {
    expect(lessonIsPro({ kind: 'cold', passageId: 'signal-noise' })).toBe(true);
    expect(lessonIsPro({ kind: 'pack', packId: 'precision' })).toBe(false);
    expect(lessonIsPro({ kind: 'pack', packId: 'tech' })).toBe(true);
    expect(lessonIsPro({ kind: 'glide', passageId: 'night-shift' })).toBe(false);
  });

  it('a pack drill is done today when one of its words was seen today', () => {
    const word = getPack('precision')!.words[0].word.toLowerCase();
    const lesson = { kind: 'pack', packId: 'precision' } as const;
    const now = at(11, 1, 15);
    expect(lessonDoneToday(lesson, { sessions: [], book: book(word, at(11, 1, 9)) }, now)).toBe(true);
    expect(lessonDoneToday(lesson, { sessions: [], book: book(word, at(10, 31, 22)) }, now)).toBe(false);
    expect(lessonDoneToday(lesson, { sessions: [], book: book('unrelated', at(11, 1, 9)) }, now)).toBe(false);
  });

  it('a passage lesson is done today when that passage was read today', () => {
    const lesson = { kind: 'glide', passageId: 'night-shift' } as const;
    const now = at(11, 1, 15);
    expect(lessonDoneToday(lesson, { sessions: [{ passageId: 'night-shift', at: at(11, 1, 10) }], book: {} }, now)).toBe(true);
    expect(lessonDoneToday(lesson, { sessions: [{ passageId: 'night-shift', at: at(10, 30, 10) }], book: {} }, now)).toBe(false);
    expect(lessonDoneToday(lesson, { sessions: [{ passageId: 'standup', at: at(11, 1, 10) }], book: {} }, now)).toBe(false);
  });

  it('titles lessons by their pack or passage', () => {
    expect(lessonTitle({ kind: 'pack', packId: 'precision' })).toBe('Make your point');
    expect(lessonTitle({ kind: 'cold', passageId: 'signal-noise' })).toBe('Signal and Noise');
    expect(lessonTitle({ kind: 'glide', passageId: 'w.precision.0' })).toBe('A useful disagreement');
  });
});

describe('starting a stop', () => {
  const sharp = (n: number) => LINES.sharp[n - 1];

  it('opens the talk with the talk.tsx contract params', () => {
    expect(startRoute(sharp(3), { pro: false, lessonDone: false })).toEqual({
      pathname: '/talk',
      params: { prompt: 'p25', stop: 'sharp-03', seconds: '60', from: 'home' },
    });
  });

  it('stop 1 is the 30-second first talk', () => {
    expect(talkSeconds(0)).toBe('30');
    expect(talkSeconds(1)).toBe('60');
    expect(startRoute(sharp(1), { pro: false, lessonDone: false }).params).toMatchObject({ seconds: '30' });
  });

  it('opens the lesson first, then the talk once the lesson is done today', () => {
    const r = startRoute(sharp(2), { pro: false, lessonDone: false });
    expect(r.pathname).toBe('/fixit');
    expect(r.params).toMatchObject({ title: 'Make your point' });
    expect(startRoute(sharp(2), { pro: false, lessonDone: true }).pathname).toBe('/talk');
  });

  it('cold reads open as cold reads for Pro, and free readers go straight to the free talk', () => {
    expect(startRoute(sharp(4), { pro: true, lessonDone: false })).toEqual({ pathname: '/session/[id]', params: { id: 'signal-noise', cold: '1' } });
    expect(startRoute(sharp(4), { pro: false, lessonDone: false }).pathname).toBe('/talk');
    // A Pro pack's words never reach a free reader through Fix-it.
    expect(startRoute(sharp(14), { pro: false, lessonDone: false }).pathname).toBe('/talk');
  });

  it('Glide passages are free', () => {
    expect(startRoute(LINES.clear[3], { pro: false, lessonDone: false })).toEqual({ pathname: '/session/[id]', params: { id: 'night-shift' } });
  });
});

describe('labels', () => {
  it('names the days ahead', () => {
    const sunday = new Date(2026, 10, 1, 9); // Sunday 1 November 2026
    expect(aheadLabel(1, 7, sunday)).toBe('Tomorrow');
    expect(aheadLabel(2, 8, sunday)).toBe('Tuesday');
    expect(aheadLabel(6, 12, sunday)).toBe('Saturday');
    expect(aheadLabel(7, 13, sunday)).toBe('Stop 13');
  });

  it('best Flow compares one Flow version only', () => {
    const s = [{ flow: 80, flowVersion: 'old' }, { flow: 71, flowVersion: 'v2' }, { flow: 76, flowVersion: 'v2' }, {}];
    expect(bestFlow(s, 'v2')).toBe(76);
    expect(bestFlow([], 'v2')).toBeUndefined();
  });

  it('header: Day 1, Day 2, a streak, and Welcome back after a gap', () => {
    const now = at(11, 2, 9);
    expect(headerTitle([], 0, now)).toBe('Day 1');
    expect(headerTitle([{ at: at(11, 2, 8) }], 1, now)).toBe('Day 1');
    expect(headerTitle([{ at: at(11, 1, 8) }], 1, now)).toBe('Day 2');
    expect(headerTitle([{ at: at(10, 27) }], 6, now)).toBe('6 days in a row');
    expect(headerTitle([{ at: at(10, 20) }], 0, now)).toBe('Welcome back');
    expect(headerTitle([{ at: at(10, 1) }, { at: at(11, 1) }], 1, now)).toBe('Welcome back');
  });
});
