import { align, countFreeTalk, preparePassage, sentenceAround, skippedWords, stumbledContexts, tokenise, withCorrections } from '../align';
import { correctedAccuracy, paceZone, pacerIndex, pacerWpm, sessionScore } from '../score';
import { applyResults, correctWord, stageOf, summarise } from '../vocab';

const DAY = 86_400_000;
const T0 = new Date('2026-10-20T09:00:00').getTime();

describe('fillers vs habit words', () => {
  it('separates hesitations from habit words in a passage', () => {
    const p = preparePassage('The report is ready for review.');
    const a = align(p, tokenise('the um report is like ready for uh review'));
    expect(a.hesitationCount).toBe(2);
    expect(a.habitCount).toBe(1);
    expect(a.habits).toEqual({ like: 1 });
    expect(a.fillerCount).toBe(2); // only um and uh: an off-script "like" is reported, not scored
    expect(a.fillers).toEqual({ um: 1, uh: 1 });
    expect(a.spoken).toBe(7); // six passage words + "like"
  });

  it('never lets habit words lower a reading score', () => {
    const p = preparePassage('So the plan is simple. We ship on Friday, and right after that we review it.');
    const clean = align(p, tokenise('so the plan is simple we ship on friday and right after that we review it'));
    const chatty = align(p, tokenise('so the plan is like simple actually we ship on friday you know and right after that we review it okay'));
    expect(clean.fillerCount).toBe(0);
    expect(chatty.fillerCount).toBe(0);
    expect(chatty.habitCount).toBe(4); // like, actually, you know, okay
    expect(chatty.read).toBe(clean.read);
    expect(chatty.done).toBe(true);
  });

  it('does not score habit words in free talk', () => {
    const t = countFreeTalk(tokenise('so I really like the new design um it is basically done'));
    expect(t.fillerCount).toBe(1); // only "um"
    expect(t.habitCount).toBe(3); // so, like, basically
    expect(t.spoken).toBe(11); // habit words still count toward pace
    expect(countFreeTalk(tokenise('you know it went well')).spoken).toBe(5); // a phrase counts as its words
  });
});

describe('pace by situation', () => {
  it('uses a slower band for presenting than reading', () => {
    expect(paceZone(160, 'reading')).toBe('good');
    expect(paceZone(160, 'presenting')).toBe('fast');
    expect(paceZone(165, 'talking')).toBe('good');
  });

  it('scores the same stats differently by context', () => {
    const s = { wpm: 160, fillersPerMin: 0, accuracy: 100, midSentencePauses: 0, seconds: 40 };
    expect(sessionScore(s, 'reading')).toBe(100);
    expect(sessionScore(s, 'presenting')).toBeLessThan(100);
  });

  it('puts the pacer at a steady mid-range pace', () => {
    expect(pacerWpm('reading')).toBe(148);
    expect(pacerIndex(30, 148, 100)).toBe(74);
    expect(pacerIndex(0, 148, 100)).toBeNull();
  });
});

describe('corrections', () => {
  const p = preparePassage('Mara steadied the lantern, particularly careful with the generator.');
  const a = align(p, tokenise('mara steadied the lantern careful with the generator'));

  it('lists skipped words and the sentence they came from', () => {
    expect(skippedWords(p, a)).toEqual(['particularly']);
    expect(sentenceAround(p, 4)).toBe('Mara steadied the lantern, particularly careful with the generator.');
    expect(stumbledContexts(p, a, ['particularly']).particularly).toMatch(/^Mara steadied/);
  });

  it('turns a corrected skip into a read', () => {
    const fixed = withCorrections(a, new Set([4]));
    expect(fixed.status[4]).toBe('read');
    expect(fixed.read).toBe(a.read + 1);
    expect(fixed.skipped).toBe(0);
    expect(correctedAccuracy(fixed.read, fixed.skipped)).toBe(100);
  });
});

describe('word stages', () => {
  it('moves from heard to in context to comfortable', () => {
    let b = applyResults({}, [{ word: 'fiduciary', clean: true, where: 'alone' }], T0);
    expect(stageOf(b.fiduciary)).toBe('heard');
    b = applyResults(b, [{ word: 'fiduciary', clean: true }], T0 + 1000);
    expect(stageOf(b.fiduciary)).toBe('in-context');
    b = applyResults(b, [{ word: 'fiduciary', clean: true }], T0 + DAY);
    b = applyResults(b, [{ word: 'fiduciary', clean: true }], T0 + 2 * DAY);
    expect(stageOf(b.fiduciary)).toBe('comfortable');
    expect(summarise(b).comfortable).toHaveLength(1);
  });

  it('saying a word alone never makes it comfortable', () => {
    let b = {};
    for (let d = 0; d < 5; d++) b = applyResults(b, [{ word: 'latency', clean: true, where: 'alone' }], T0 + d * DAY);
    expect(stageOf((b as any).latency)).toBe('heard');
  });

  it('"I said it" removes the stumble and counts the read', () => {
    let b = applyResults({}, [{ word: 'custodian', clean: false }], T0);
    b = correctWord(b, 'Custodian', T0 + 1000);
    expect(b.custodian.stumbles).toBe(0);
    expect(stageOf(b.custodian)).toBe('in-context');
  });

  it('reads older saved entries without heardDays', () => {
    const old = { reconciliation: { word: 'reconciliation', cleanDays: ['2026-10-19'], stumbles: 0, firstSeen: T0, lastSeen: T0 } } as any;
    expect(stageOf(applyResults(old, [], T0).reconciliation)).toBe('in-context');
  });
});

import { countdownLabel, daysUntil, getMoment, nextStep, planSteps } from '../../content/moments';
import { getPack, WORD_PACKS } from '../../content/wordpacks';

describe('moments', () => {
  const now = new Date('2026-10-26T10:00:00');
  it('counts days to the event in local dates', () => {
    expect(daysUntil('2026-10-29', now)).toBe(3);
    expect(countdownLabel(getMoment('interview')!, '2026-10-27', now)).toBe('Your interview is tomorrow');
    expect(countdownLabel(getMoment('interview')!, undefined, now)).toBe('Preparing for your interview');
  });

  it('every moment points at a real pack and walks its plan in order', () => {
    for (const id of ['interview', 'presentation', 'raise', 'meeting']) expect(getPack(getMoment(id)!.packId)).toBeDefined();
    const steps = planSteps(getMoment('presentation')!);
    expect(nextStep(steps, [])?.id).toBe('learn');
    expect(nextStep(steps, ['learn', 'context'])?.id).toBe('script');
    expect(nextStep(steps, steps.map((s) => s.id))).toBeUndefined();
  });

  it('keeps both introductory vocabulary packs free', () => {
    expect(getPack('meetings')?.free).toBe(true);
    expect(getPack('precision')?.free).toBe(true);
    expect(new Set(WORD_PACKS.map((pack) => pack.id)).size).toBe(WORD_PACKS.length);
  });
});

import { correctSessionWord, SavedSession } from '../../store/sessions';

describe('correcting a finished session', () => {
  const s: SavedSession = {
    id: 'x', passageId: 'night-shift', title: 't', at: 0, wpm: 150, fillers: 0, fillersPerMin: 0, accuracy: 90,
    pauses: 0, seconds: 40, score: 97, stumbled: ['particularly', 'generator'], context: 'reading',
    readCount: 18, skippedWords: ['particularly', 'generator'],
  };

  it('counts the word as read and recomputes accuracy and score', () => {
    const c = correctSessionWord(s, 'Particularly');
    expect(c.stumbled).toEqual(['generator']);
    expect(c.readCount).toBe(19);
    expect(c.accuracy).toBe(95);
    expect(c.score).toBeGreaterThan(s.score);
    expect(c.corrected).toEqual(['Particularly']);
  });

  it('ignores words that were not skipped', () => {
    expect(correctSessionWord(s, 'lantern')).toBe(s);
  });
});

import { stageLabel } from '../vocab';
describe('stage labels', () => {
  it('calls a word you only missed "To practise"', () => {
    const b = applyResults({}, [{ word: 'espresso', clean: false }], T0);
    expect(stageLabel(b.espresso)).toBe('To practise');
    expect(stageLabel(undefined)).toBe('New');
  });
});

describe('pace compares like with like', () => {
  const { contextOf, day1VsNow, paceContexts } = require('../progress');
  const S = (id: string, at: number, passageId: string, context?: string, wpm = 150) => ({ id, at, passageId, context, wpm, fillersPerMin: 0, accuracy: 100, score: 70 });

  it('infers context for older sessions', () => {
    expect(contextOf(S('a', 1, 'talk'))).toBe('talking');
    expect(contextOf(S('b', 1, 'night-shift'))).toBe('reading');
    expect(contextOf(S('c', 1, 's.x.1', 'presenting'))).toBe('presenting');
  });

  it('offers only contexts with sessions, defaulting to one that has a trend', () => {
    const list = [S('1', 1, 'baseline', 'reading'), S('2', 2, 'night-shift', 'reading'), S('3', 3, 'talk', 'talking')];
    expect(paceContexts(list)).toEqual({ available: ['talking', 'reading'], initial: 'reading' });
    expect(paceContexts([])).toEqual({ available: [], initial: 'reading' });
  });

  it('never compares Day 1 reading with free talk', () => {
    const list = [S('d1', T0, 'baseline', 'reading', 140), S('t', T0 + 3 * DAY, 'talk', 'talking', 190)];
    expect(day1VsNow(list, 'd1')).toBeUndefined();
    const more = [...list, S('r', T0 + 2 * DAY, 'night-shift', 'reading', 150)].sort((a, b) => a.at - b.at);
    expect(day1VsNow(more, 'd1')?.latest.id).toBe('r');
  });
});
