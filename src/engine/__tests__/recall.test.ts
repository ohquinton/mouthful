import {
  applyResults, correctWord, daysToNextRecall, dueForRecall, heardWordIn, isDueForRecall, MIN_OWN_SENTENCE_WORDS,
  ownSentenceCheck, recallDueDay, recallLabels, recordOwnSentence, recordRecall, stageOf, summarise, WordBook,
} from '../vocab';
import { calendarDay } from '../days';
import { sanitise } from '../../analytics';

// Local dates at noon: the calendar is the point, so these work in any zone the suite runs in.
const on = (day: number, hour = 12) => new Date(2026, 9, day, hour).getTime();
const all = () => true;
const met = (word = 'premise', at = on(1)): WordBook => applyResults({}, [{ word, clean: true }], at);

describe('recall schedule', () => {
  it('a new word is not due the day it is met, and is due the next calendar day', () => {
    const b = met();
    expect(isDueForRecall(b.premise, on(1, 23))).toBe(false);
    expect(isDueForRecall(b.premise, on(2, 0))).toBe(true);
  });

  it('walks 1, 3, 7 days while remembered, then stops coming back', () => {
    let b = recordRecall(met(), 'premise', true, on(2));
    expect(recallDueDay(b.premise)).toBe(calendarDay(on(2)) + 3);
    b = recordRecall(b, 'premise', true, on(5));
    expect(recallDueDay(b.premise)).toBe(calendarDay(on(5)) + 7);
    expect(isDueForRecall(b.premise, on(11))).toBe(false);
    expect(isDueForRecall(b.premise, on(12))).toBe(true);
    b = recordRecall(b, 'premise', true, on(12));
    expect(recallDueDay(b.premise)).toBeNull();
    expect(dueForRecall(b, all, on(30))).toEqual([]);
    expect(daysToNextRecall(b, all, on(30))).toBeNull();
  });

  it('Not yet comes back tomorrow and starts the gaps again', () => {
    let b = recordRecall(met(), 'premise', true, on(2));
    b = recordRecall(b, 'premise', false, on(5));
    expect(recallDueDay(b.premise)).toBe(calendarDay(on(5)) + 1);
    expect(b.premise.recall?.step).toBe(0);
    b = recordRecall(b, 'premise', true, on(6));
    expect(recallDueDay(b.premise)).toBe(calendarDay(on(6)) + 3);
  });

  it('the first answer of a calendar day stands', () => {
    const first = recordRecall(met(), 'premise', false, on(2, 9));
    expect(recordRecall(first, 'premise', true, on(2, 21))).toBe(first);
  });

  it('counts calendar days, not 24-hour gaps, across a clock change', () => {
    // A week across US spring-forward (or none in a zone without DST): 7 either way.
    const start = new Date(2026, 2, 5, 23, 30).getTime();
    const b = applyResults({}, [{ word: 'premise', clean: true }], start);
    const r = recordRecall(recordRecall(b, 'premise', true, start), 'premise', true, new Date(2026, 2, 6, 0, 5).getTime());
    expect(recallDueDay(r.premise)).toBe(calendarDay(new Date(2026, 2, 13, 0, 5)));
    expect(isDueForRecall(r.premise, new Date(2026, 2, 12, 23, 59).getTime())).toBe(false);
    expect(isDueForRecall(r.premise, new Date(2026, 2, 13, 0, 1).getTime())).toBe(true);
  });

  it('a due day far in the future, from a wrong clock, counts as due', () => {
    const b = recordRecall(met(), 'premise', true, new Date(2030, 0, 1).getTime());
    expect(isDueForRecall(b.premise, on(10))).toBe(true);
  });
});

describe('due list', () => {
  it('leaves out words with no meaning, puts the longest overdue first, and respects the limit', () => {
    let b = met('candid', on(3));
    b = applyResults(b, [{ word: 'nuance', clean: true }], on(1));
    b = applyResults(b, [{ word: 'readingword', clean: false }], on(1));
    const known = (w: string) => w !== 'readingword';
    expect(dueForRecall(b, known, on(10))).toEqual(['nuance', 'candid']);
    expect(dueForRecall(b, known, on(10), 1)).toEqual(['nuance']);
  });

  it('says how long until the next word', () => {
    expect(daysToNextRecall(recordRecall(met(), 'premise', true, on(2)), all, on(2))).toBe(3);
    expect(daysToNextRecall({}, all, on(2))).toBeNull();
  });
});

describe('older saved books', () => {
  const old = { premise: { word: 'premise', heardDays: [], cleanDays: ['2026-10-01'], stumbles: 0, firstSeen: on(1), lastSeen: on(1) } } as WordBook;

  it('load without recall fields and are due from when the word was first seen', () => {
    expect(isDueForRecall(old.premise, on(2))).toBe(true);
    expect(recallLabels(old.premise)).toEqual([]);
    expect(recordRecall(old, 'premise', true, on(2)).premise.recall?.step).toBe(1);
  });

  it('a damaged recall record cannot crash and counts as due', () => {
    const bad = { premise: { ...old.premise, recall: { step: 'x' } } } as unknown as WordBook;
    expect(isDueForRecall(bad.premise, on(2))).toBe(true);
    expect(recordRecall(bad, 'premise', false, on(2)).premise.recall?.rememberedDays).toEqual([]);
  });

  it('ignores a word that is not in the book', () => {
    expect(recordRecall({}, 'premise', true, on(2))).toEqual({});
    expect(recordOwnSentence({}, 'premise', on(2))).toEqual({});
  });
});

describe('recall stays separate from reading', () => {
  it('remembering never moves a reading stage, and reading never earns a recall mark', () => {
    let b = met();
    const stage = stageOf(b.premise);
    b = recordRecall(b, 'premise', true, on(2));
    b = recordOwnSentence(b, 'premise', on(2));
    expect(stageOf(b.premise)).toBe(stage);
    expect(b.premise.cleanDays).toHaveLength(1);

    let reader = met();
    reader = applyResults(reader, [{ word: 'premise', clean: true }], on(2));
    reader = applyResults(reader, [{ word: 'premise', clean: true }], on(3));
    expect(summarise(reader).comfortable).toHaveLength(1);
    expect(recallLabels(reader.premise)).toEqual([]);
  });

  it('later reading and corrections keep the recall record', () => {
    let b = recordRecall(met(), 'premise', true, on(2));
    b = applyResults(b, [{ word: 'premise', clean: false }], on(3));
    b = correctWord(b, 'premise', on(3));
    expect(b.premise.recall?.step).toBe(1);
  });

  it('own sentence is a dated tick that does not move the schedule', () => {
    const fresh = met();
    const before = recallDueDay(fresh.premise);
    const ticked = recordOwnSentence(recordOwnSentence(fresh, 'premise', on(1)), 'premise', on(1));
    expect(recallDueDay(ticked.premise)).toBe(before);
    expect(ticked.premise.recall?.ownSentenceDays).toHaveLength(1);
    expect(ticked.premise.recall?.lastDay).toBe(Number.NEGATIVE_INFINITY);
  });

  it('labels say these are the reader’s marks', () => {
    let b = recordRecall(met(), 'premise', true, on(2));
    expect(recallLabels(b.premise)).toEqual(['You marked: remembered']);
    b = recordOwnSentence(b, 'premise', on(2));
    expect(recallLabels(b.premise)).toEqual(['You marked: remembered', 'You marked: used in your own sentence']);
    expect(recallLabels(recordRecall(met(), 'premise', false, on(2)).premise)).toEqual([]);
  });

  it('stores ticks and dates only, so nothing the reader said can be in the book', () => {
    const b = recordOwnSentence(recordRecall(met(), 'premise', true, on(2)), 'premise', on(2));
    expect(Object.keys(b.premise.recall ?? {}).sort()).toEqual(['dueDay', 'lastDay', 'ownSentenceDays', 'rememberedDays', 'step']);
  });
});

describe('heard in what was said', () => {
  it('finds the word and everyday endings, whatever the case or punctuation', () => {
    expect(heardWordIn('premise', 'The Premise, I think, is wrong')).toBe(true);
    expect(heardWordIn('premise', 'both premises fail')).toBe(true);
    expect(heardWordIn('reconcile', 'we are reconciling it')).toBe(true);
    expect(heardWordIn('candid', 'I was candid’s friend')).toBe(true);
  });

  it('does not count a different word containing it', () => {
    expect(heardWordIn('premise', 'on the premises')).toBe(true);
    expect(heardWordIn('premise', 'they made a promise')).toBe(false);
    expect(heardWordIn('candid', 'the candidate spoke')).toBe(false);
    expect(heardWordIn('premise', '')).toBe(false);
  });

  it('a too-short attempt gets Try again, even when it holds the word', () => {
    expect(ownSentenceCheck('premise', 'premise')).toEqual({ spoken: 1, tooShort: true, heard: true });
    expect(ownSentenceCheck('premise', '').tooShort).toBe(true);
    const words = Array(MIN_OWN_SENTENCE_WORDS).fill('premise').join(' ');
    expect(ownSentenceCheck('premise', words).tooShort).toBe(false);
  });
});

describe('recall analytics', () => {
  it('a word slipped into a string property never gets sent as free text', () => {
    expect(sanitise({ word: 'premise', sentence: 'the premise is wrong', remembered: true, count: 2 })).toEqual({ remembered: true, count: 2 });
  });
});
