import { align, contextualHints, normalise, preparePassage, stumbledWords, tokenise, wordsMatch } from '../align';
import { coachingLine, ghostIndex, paceZone, sessionScore, wordsPerMinute } from '../score';

const passage = preparePassage('The bakery opens at four, long before the street wakes up. Flour hangs in the air.');

describe('preparePassage', () => {
  it('keeps display text and marks breath points', () => {
    expect(passage[0]).toMatchObject({ display: 'The', key: 'the', breathAfter: false });
    const four = passage.find((w) => w.key === 'four')!;
    expect(four.breathAfter).toBe(true);
    expect(four.sentenceEnd).toBe(false);
    const up = passage.find((w) => w.key === 'up')!;
    expect(up.sentenceEnd).toBe(true);
  });

  it('splits hyphenated words so both halves can be matched', () => {
    const p = preparePassage('a well-known fact');
    expect(p.map((w) => w.key)).toEqual(['a', 'well', 'known', 'fact']);
  });
});

describe('normalise and tokenise', () => {
  it('strips punctuation, lowercases and maps digits', () => {
    expect(normalise('Street,')).toBe('street');
    expect(normalise('4')).toBe('four');
    expect(tokenise("Don’t stop — it's 4")).toEqual(["don't", 'stop', "it's", 'four']);
  });
});

describe('wordsMatch', () => {
  it('forgives one letter on long words only', () => {
    expect(wordsMatch('bakary', 'bakery')).toBe(true);
    expect(wordsMatch('cat', 'cut')).toBe(false);
    expect(wordsMatch('colour', 'color')).toBe(true);
  });
});

describe('align', () => {
  it('reads a clean run in order', () => {
    const a = align(passage, tokenise('the bakery opens at four long before'));
    expect(a.read).toBe(7);
    expect(a.skipped).toBe(0);
    expect(a.next).toBe(7);
    expect(a.status.slice(0, 7).every((s) => s === 'read')).toBe(true);
  });

  it('marks skipped words when the reader jumps ahead', () => {
    const a = align(passage, tokenise('the bakery at four'));
    expect(a.status[2]).toBe('skipped'); // "opens"
    expect(a.skipped).toBe(1);
    expect(a.next).toBe(5);
  });

  it('counts fillers without moving the pointer', () => {
    const a = align(passage, tokenise('the um bakery you know opens uh at'));
    expect(a.fillerCount).toBe(2);
    expect(a.fillers).toEqual({ um: 1, uh: 1 });
    expect(a.habits).toEqual({ 'you know': 1 });
    expect(a.next).toBe(4);
  });

  it('treats a passage word that looks like a filler as reading, not a filler', () => {
    const p = preparePassage('I like it so much');
    const a = align(p, tokenise('I like it so much'));
    expect(a.fillerCount).toBe(0);
    expect(a.done).toBe(true);
  });

  it('ignores a repeated word instead of counting it as progress', () => {
    const a = align(passage, tokenise('the the bakery'));
    expect(a.spoken).toBe(2);
  });

  it('does not jump further than the lookahead window', () => {
    const a = align(passage, tokenise('the air'));
    expect(a.next).toBe(1);
  });

  it('finishes on the last word', () => {
    const a = align(passage, tokenise(passage.map((w) => w.key).join(' ')));
    expect(a.done).toBe(true);
  });
});

describe('stumbledWords and hints', () => {
  it('returns skipped words, longest first', () => {
    const a = align(passage, tokenise('the at four long before the street wakes up flour in the air'));
    expect(stumbledWords(passage, a)).toEqual(['bakery', 'opens', 'hangs']);
  });

  it('hands long words to the recogniser', () => {
    expect(contextualHints(preparePassage('Statistically, the anonymous survey was particularly short.'))).toEqual([
      'Statistically',
      'anonymous',
      'particularly',
    ]);
  });
});

describe('scoring', () => {
  it('computes pace and zones', () => {
    expect(wordsPerMinute(75, 30)).toBe(150);
    expect(wordsPerMinute(10, 2)).toBe(0);
    expect(paceZone(150)).toBe('good');
    expect(paceZone(190)).toBe('fast');
  });

  it('gives a perfect read 100', () => {
    expect(sessionScore({ wpm: 150, fillersPerMin: 0, accuracy: 100, midSentencePauses: 0, seconds: 40 })).toBe(100);
  });

  it('penalises rushing and fillers', () => {
    const s = sessionScore({ wpm: 190, fillersPerMin: 4, accuracy: 90, midSentencePauses: 1, seconds: 40 });
    expect(s).toBeLessThan(70);
  });

  it('coaches on the single biggest issue', () => {
    expect(coachingLine({ wpm: 192, fillersPerMin: 5, accuracy: 95, midSentencePauses: 0, seconds: 30 })).toMatch(/192/);
  });

  it('places the ghost at the best pace', () => {
    expect(ghostIndex(30, 150, 100)).toBe(75);
    expect(ghostIndex(30, undefined, 100)).toBeNull();
    expect(ghostIndex(100, 150, 100)).toBe(99);
  });
});
