import { applyResults, dayKey, dueWords, isLearned, summarise, WordBook } from '../vocab';
import { DICTIONARY, packPassage, WORD_PACKS } from '../../content/wordpacks';
import { preparePassage } from '../align';

const DAY = 86_400_000;
const T0 = new Date('2026-10-20T09:00:00').getTime();

describe('word book', () => {
  it('learns a word after three clean days', () => {
    let b: WordBook = {};
    b = applyResults(b, [{ word: 'Reconciliation', clean: true }], T0);
    b = applyResults(b, [{ word: 'reconciliation', clean: true }], T0 + 1000); // same day, no double count
    expect(b.reconciliation.cleanDays).toHaveLength(1);
    b = applyResults(b, [{ word: 'reconciliation', clean: true }], T0 + DAY);
    expect(isLearned(b.reconciliation)).toBe(false);
    b = applyResults(b, [{ word: 'reconciliation', clean: true }], T0 + 3 * DAY);
    expect(isLearned(b.reconciliation)).toBe(true);
  });

  it('a stumble today cancels a clean read today', () => {
    let b = applyResults({}, [{ word: 'fiduciary', clean: true }], T0);
    b = applyResults(b, [{ word: 'fiduciary', clean: false }], T0 + 1000);
    expect(b.fiduciary.cleanDays).toEqual([]);
    expect(b.fiduciary.stumbles).toBe(1);
  });

  it('treats clean-then-stumbled in one session as a stumble', () => {
    const b = applyResults({}, [{ word: 'latency', clean: true }, { word: 'latency', clean: false }], T0);
    expect(b.latency.cleanDays).toEqual([]);
  });

  it('sorts learning words by stumbles and lists due words', () => {
    let b = applyResults({}, [{ word: 'liquidity', clean: false }, { word: 'custodian', clean: false }], T0);
    b = applyResults(b, [{ word: 'custodian', clean: false }], T0 + 1000);
    expect(summarise(b).learning.map((e) => e.word)).toEqual(['custodian', 'liquidity']);
    b = applyResults(b, [{ word: 'liquidity', clean: true }], T0 + DAY);
    expect(dueWords(b, T0 + DAY)).toEqual(['custodian']);
  });

  it('formats local day keys', () => {
    expect(dayKey(T0)).toBe('2026-10-20');
  });
});

describe('word packs content', () => {
  it('uses every pack word in the pack passages so Glide can check it', () => {
    for (const pack of WORD_PACKS) {
      const keys = new Set(pack.passages.flatMap((p) => preparePassage(p.text).map((w) => w.key)));
      for (const w of pack.words) expect(keys.has(w.word.toLowerCase())).toBe(true);
    }
  });

  it('resolves pack passage ids and builds the dictionary', () => {
    expect(packPassage('w.finance.0')?.title).toBe('Morning Update · Finance Floor');
    expect(packPassage('w.finance.9')).toBeUndefined();
    expect(DICTIONARY.get('fiduciary')?.packId).toBe('finance');
    expect(DICTIONARY.size).toBe(48);
  });
});
