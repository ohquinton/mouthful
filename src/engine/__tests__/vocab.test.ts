import { applyResults, dayKey, dueWords, isLearned, readingResults, stageLabel, stageOf, summarise, WordBook } from '../vocab';
import { DICTIONARY, packPassage, WORD_PACKS } from '../../content/wordpacks';
import { preparePassage, WordStatus } from '../align';

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

describe('your words from readings', () => {
  // A word you missed in a reading joins "your words". The passage it sits in is a real sentence,
  // so reading it cleanly there later is an in-context read, the same as a pack word in a pack passage.
  const TEXT = 'The quarterly procurement was late again, so the auditors asked for the ledger.';
  const words = preparePassage(TEXT);
  const isPack = (k: string) => DICTIONARY.has(k);
  const at = (key: string) => words.findIndex((w) => w.key === key);
  const statuses = (over: Record<string, WordStatus>): WordStatus[] =>
    words.map((w) => over[w.key] ?? 'read');
  const read = (b: WordBook, st: WordStatus[], t: number) => applyResults(b, readingResults(words, st, isPack), t);

  it('a word missed in a reading becomes comfortable after clean in-passage reads on 3 days', () => {
    let b = read({}, statuses({ procurement: 'skipped' }), T0);
    expect(stageLabel(b.procurement)).toBe('To practise');
    b = read(b, statuses({}), T0 + DAY);
    expect(stageOf(b.procurement)).toBe('in-context');
    b = read(b, statuses({}), T0 + 2 * DAY);
    b = read(b, statuses({}), T0 + 3 * DAY);
    expect(stageOf(b.procurement)).toBe('comfortable');
  });

  it('a word that stays red in the reading never counts as a clean day', () => {
    let b = read({}, statuses({ procurement: 'skipped' }), T0);
    for (let d = 1; d <= 4; d++) b = read(b, statuses({ procurement: 'skipped' }), T0 + d * DAY);
    expect(b.procurement.cleanDays).toEqual([]);
    expect(b.procurement.stumbles).toBe(5);
    expect(stageOf(b.procurement)).toBe('new');
  });

  it('read once and missed once in the same passage counts as a stumble, not a clean day', () => {
    const twice = preparePassage('Procurement took all week. The procurement still failed.');
    const st = twice.map((w, i) => (w.key === 'procurement' && i > 0 ? 'skipped' : 'read') as WordStatus);
    let b = applyResults({}, [{ word: 'procurement', clean: false }], T0 - DAY);
    b = applyResults(b, readingResults(twice, st, isPack), T0);
    expect(b.procurement.cleanDays).toEqual([]);
    expect(b.procurement.stumbles).toBe(2);
  });

  it('words never reached in the reading count neither way', () => {
    let b = read({}, statuses({ procurement: 'skipped' }), T0);
    const notReached = words.map((_, i) => (i < at('procurement') ? 'read' : 'pending') as WordStatus);
    b = read(b, notReached, T0 + DAY);
    expect(b.procurement.cleanDays).toEqual([]);
    expect(b.procurement.stumbles).toBe(1);
  });

  it('a short saved word that goes red in a reading is a stumble there, not ignored', () => {
    // "late" has 4 letters, so a miss alone wouldn't add it; once saved, a miss must still count against it.
    let b = applyResults({}, [{ word: 'late', clean: true }], T0 - DAY);
    b = read(b, statuses({ late: 'skipped' }), T0);
    expect(b.late.cleanDays).toEqual([dayKey(T0 - DAY)]);
    expect(b.late.stumbles).toBe(1);
    b = read(b, statuses({}), T0 + DAY);
    expect(b.late.cleanDays).toEqual([dayKey(T0 - DAY), dayKey(T0 + DAY)]);
  });

  it('reading a word cleanly never adds it to the book on its own (a script stays private)', () => {
    const b = read({}, statuses({}), T0);
    expect(Object.keys(b)).toEqual([]);
  });

  it('pack words and long missed words are recorded as before', () => {
    const pack = preparePassage('Our fiduciary duty came first, but the paperwork was overwhelming.');
    const st = pack.map((w) => (w.key === 'overwhelming' ? 'skipped' : 'read') as WordStatus);
    const b = applyResults({}, readingResults(pack, st, isPack), T0);
    expect(b.fiduciary.cleanDays).toEqual([dayKey(T0)]);
    expect(b.overwhelming.stumbles).toBe(1);
    expect(b.paperwork).toBeUndefined();
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
    expect(DICTIONARY.size).toBe(56);
    expect(packPassage('w.precision.0')?.title).toBe('A useful disagreement · Make your point');
    expect(DICTIONARY.get('premise')?.packId).toBe('precision');
  });
});
