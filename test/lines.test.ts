// The home map's two lines (src/content/lines.ts): where you are, whether today's stop is done,
// and where "Start today's stop" goes. Days are local calendar days (test/globalSetup.js sets the
// zone; CI also runs Asia/Kolkata).
import {
  aheadLabel,
  bestFlow,
  currentStopIndex,
  dailyTalkDoneToday,
  doneLabel,
  getStop,
  headerTitle,
  isLastStop,
  lessonDoneOn,
  lessonDoneToday,
  shortTopic,
  stopNumber,
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
  withFirstTalk,
} from '../src/content/lines';
import { MINUTE_PROMPTS } from '../src/content/prompts';
import { getPack } from '../src/content/wordpacks';
import { getPassage } from '../src/content/passages';
import { packPassage } from '../src/content/wordpacks';
import { dayKey } from '../src/engine/vocab';

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

  it('every stop from Home is a full minute, stop 1 included (only onboarding’s talk is 30 s)', () => {
    expect(talkSeconds()).toBe('60');
    expect(startRoute(sharp(1), { pro: false, lessonDone: false }).params).toMatchObject({ seconds: '60', prompt: 'p01', stop: 'sharp-01' });
  });

  it('"Start this line" on the other line: its stop 1 as a normal minute on its own prompt', () => {
    // Someone on Sharp Talk with stops done opens Clear English for the first time.
    const sessions = [done('sharp-01', at(10, 30)), done('sharp-02', at(10, 31))];
    const first = nextStop('clear', sessions)!;
    expect(first.id).toBe('clear-01');
    expect(startRoute(first, { pro: false, lessonDone: false })).toEqual({
      pathname: '/talk',
      params: { prompt: first.promptId, stop: 'clear-01', seconds: '60', from: 'home' },
    });
  });

  it('an upgraded reader with no line and no first talk starts Sharp Talk stop 1 as a minute', () => {
    const line = lineOf(undefined);
    const sessions = withFirstTalk([{ at: at(10, 1), passageId: 'night-shift' }], line);
    const stop = nextStop(line, sessions)!;
    expect(stop.id).toBe('sharp-01');
    expect(startRoute(stop, { pro: false, lessonDone: false }).params).toMatchObject({ seconds: '60', stop: 'sharp-01' });
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

describe('stop numbers and short labels', () => {
  it('numbers a stop by its place on its own line', () => {
    expect(stopNumber('sharp-01')).toBe(1);
    expect(stopNumber('clear-12')).toBe(12);
    expect(stopNumber(LINES.sharp[LINES.sharp.length - 1].id)).toBe(LINES.sharp.length);
    expect(stopNumber('sharp-6')).toBeUndefined(); // digits alone don't make a stop
    expect(stopNumber('sharp-15')).toBeUndefined();
    expect(stopNumber(undefined)).toBeUndefined();
  });

  it('knows the last stop of each line', () => {
    expect(isLastStop(LINES.sharp[LINES.sharp.length - 1].id)).toBe(true);
    expect(isLastStop(LINES.clear[LINES.clear.length - 1].id)).toBe(true);
    expect(isLastStop('sharp-01')).toBe(false);
    expect(isLastStop(undefined)).toBe(false);
  });

  it('every topic has a short name that fits a map label (long questions get one written for them)', () => {
    for (const p of MINUTE_PROMPTS) {
      const name = shortTopic(p.id);
      expect(name.length).toBeLessThanOrEqual(24);
      expect(name).not.toMatch(/[.?!]$/);
    }
    expect(shortTopic('p27')).toBe('An opinion');
    expect(shortTopic('p01')).toBe('Coffee');
    expect(shortTopic('nope')).toBe('Topic talk');
  });

  it('every done label on both lines fits the map’s two lines, never a cut-off question', () => {
    // ~30 characters a line at 17 pt in the label column on a 375–390 pt phone; titles clamp at 2.
    for (const stop of [...LINES.sharp, ...LINES.clear]) {
      expect(doneLabel(stop, { at: at(11, 1), promptId: stop.promptId, flow: 70 }, false).title.length).toBeLessThanOrEqual(36);
      expect(doneLabel(stop, { at: at(11, 1), promptId: stop.promptId, flow: 70 }, true).title.length).toBeLessThanOrEqual(46);
    }
    expect(doneLabel(LINES.sharp[4], { at: at(11, 1), promptId: 'p27', flow: 70 }, false).title).toBe('Topic talk · An opinion');
  });
});

describe('done labels say what was done', () => {
  const t = at(10, 30);

  it('a talk on a different topic is labelled by the topic actually talked about', () => {
    // Stop 3 is "Explain what you do for work…"; the reader tapped Different topic and talked about bread.
    expect(doneLabel(LINES.sharp[2], { at: t, promptId: 'p04', flow: 66 }, false)).toEqual({ title: 'Topic talk · Bread', sub: 'Flow 66' });
  });

  it('a skipped lesson (a free reader, a Pro cold read) shows the talk only', () => {
    const coldStop = LINES.sharp[3]; // Risk, after a cold read of Signal and Noise
    expect(doneLabel(coldStop, { at: t, promptId: 'p15', flow: 71 }, false)).toEqual({ title: 'Topic talk · Risk', sub: 'Flow 71' });
  });

  it('a lesson done that day leads, with the talk under it', () => {
    expect(doneLabel(LINES.sharp[1], { at: t, promptId: 'p13', flow: 71 }, true)).toEqual({ title: 'Word pack · Make your point', sub: 'Trust · Flow 71' });
  });

  it('"Your first talk" only for onboarding’s 30 seconds; a full-minute stop 1 is a topic talk', () => {
    const first = { at: t, promptId: 'p01', flow: 74, flowVersion: '2-k40p35w25-s30' };
    expect(doneLabel(LINES.sharp[0], first, false)).toEqual({ title: 'Your first talk · Coffee', sub: 'Flow 74 · your starting point' });
    expect(doneLabel(LINES.clear[0], { at: t, promptId: 'p01', flow: 69, flowVersion: '2-k40p35w25' }, false)).toEqual({ title: 'Topic talk · Coffee', sub: 'Flow 69' });
  });

  it('a stop done without a saved talk just says done', () => {
    expect(doneLabel(LINES.sharp[4], undefined, false)).toEqual({ title: 'Topic talk · An opinion', sub: 'Done' });
  });

  it('a pack lesson counts as done on an old day by the word book’s day keys', () => {
    const word = getPack('precision')!.words[0].word.toLowerCase();
    const entry = { word, heardDays: [dayKey(t)], cleanDays: [], stumbles: 0, firstSeen: t, lastSeen: at(11, 1) };
    const lesson = { kind: 'pack', packId: 'precision' } as const;
    expect(lessonDoneOn(lesson, { sessions: [], book: { [word]: entry } }, t)).toBe(true);
    expect(lessonDoneOn(lesson, { sessions: [], book: { [word]: entry } }, at(10, 29))).toBe(false);
    expect(lessonDoneOn({ kind: 'cold', passageId: 'signal-noise' }, { sessions: [{ passageId: 'signal-noise', at: at(10, 30, 8) }], book: {} }, t)).toBe(true);
  });
});

describe('past the last stop', () => {
  const now = at(11, 1, 18);
  const talk = (extra: Record<string, unknown>) => ({ at: at(11, 1, 9), passageId: 'talk', kind: 'minute', flowVersion: '2-k40p35w25', ...extra });

  it('a full-minute talk today on the topic of the day is today’s stop done', () => {
    expect(dailyTalkDoneToday([talk({ promptId: 'p20' })], 'p20', now)).toBe(true);
    // Different topic, no stop: still today's talk.
    expect(dailyTalkDoneToday([talk({ promptId: 'p05' })], 'p20', now)).toBe(true);
  });

  it('not yesterday’s talk, not 30 seconds, not a stop on the other line', () => {
    expect(dailyTalkDoneToday([talk({ promptId: 'p20', at: at(10, 31, 22) })], 'p20', now)).toBe(false);
    expect(dailyTalkDoneToday([talk({ promptId: 'p20', flowVersion: '2-k40p35w25-s30' })], 'p20', now)).toBe(false);
    expect(dailyTalkDoneToday([talk({ promptId: 'p03', stopId: 'clear-03' })], 'p20', now)).toBe(false);
    const reading = { at: at(11, 1, 9), passageId: 'night-shift' };
    expect(dailyTalkDoneToday([reading], 'p20', now)).toBe(false);
  });
});

describe('onboarding’s first talk', () => {
  const firstTalk = (t: number, extra: Record<string, unknown> = {}) => ({
    at: t,
    passageId: 'talk',
    kind: 'minute',
    promptId: 'p01',
    flowVersion: '2-k40p35w25-s30',
    flow: 74,
    ...extra,
  });

  it('counts as stop 1 of the chosen line, so Home starts on stop 2', () => {
    const s = withFirstTalk([firstTalk(at(10, 31))], 'clear');
    expect(s[0]).toMatchObject({ stopId: 'clear-01', flow: 74 });
    expect(currentStopIndex('clear', s)).toBe(1);
    expect(currentStopIndex('sharp', s)).toBe(0);
    expect(lineStarted('sharp', s)).toBe(false);
  });

  it('is found by its 30-second length too, and only the earliest one counts', () => {
    const s = withFirstTalk([firstTalk(at(10, 31), { flowVersion: 'x', minute: { limitSeconds: 30 } }), firstTalk(at(11, 1))], 'sharp');
    expect(s.map((x) => (x as { stopId?: string }).stopId)).toEqual(['sharp-01', undefined]);
  });

  it('leaves full minutes, other prompts and stops already saved alone', () => {
    expect(withFirstTalk([firstTalk(at(10, 31), { flowVersion: '2-k40p35w25' })], 'sharp')[0]).not.toHaveProperty('stopId');
    expect(withFirstTalk([firstTalk(at(10, 31), { promptId: 'p02' })], 'sharp')[0]).not.toHaveProperty('stopId');
    const saved = [{ ...firstTalk(at(10, 30)), stopId: 'sharp-01' }, firstTalk(at(10, 31))];
    expect(withFirstTalk(saved, 'sharp')[1]).not.toHaveProperty('stopId');
  });

  it('makes today’s stop done on day 1 after onboarding', () => {
    const now = at(11, 1, 18);
    expect(stopDoneToday('sharp', withFirstTalk([firstTalk(at(11, 1, 9))], 'sharp'), now)).toBe(true);
  });
});
