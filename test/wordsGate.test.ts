// Your words → Fix-it (src/app/words.tsx): free-pack words stay free to practise, every other
// word goes through requirePro('fixit'), the same wall as the Tape and Today.
import { inFreePack, practisableWords, WORD_PACKS } from '../src/content/wordpacks';

const freeWord = WORD_PACKS.find((p) => p.free)!.words[0].word;
const proWord = WORD_PACKS.find((p) => !p.free)!.words[0].word;

describe('inFreePack', () => {
  it('is true for a word in a free pack, whatever its case or spacing', () => {
    expect(inFreePack(freeWord)).toBe(true);
    expect(inFreePack(` ${freeWord.toUpperCase()} `)).toBe(true);
  });

  it('is false for a Pro pack word and for a word from your reading', () => {
    expect(inFreePack(proWord)).toBe(false);
    expect(inFreePack('photosynthesis')).toBe(false);
    expect(inFreePack('')).toBe(false);
  });

  it('a word in both a free and a Pro pack counts as free', () => {
    // Guard for the DICTIONARY trap: it keeps one entry per word, possibly the Pro one.
    for (const p of WORD_PACKS.filter((x) => x.free)) for (const w of p.words) expect(inFreePack(w.word)).toBe(true);
  });
});

describe('practisableWords', () => {
  const due = [proWord, freeWord, 'photosynthesis'];

  it('Pro practises every due word', () => {
    expect(practisableWords(due, true)).toEqual(due);
  });

  it('free practises only the free-pack words, in order', () => {
    expect(practisableWords(due, false)).toEqual([freeWord]);
  });

  it('free with no free-pack words gets nothing (the button opens the wall instead)', () => {
    expect(practisableWords([proWord, 'photosynthesis'], false)).toEqual([]);
  });
});
