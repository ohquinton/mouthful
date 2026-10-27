// "Your words": every pack word you've practised and every word you've tripped on.
//
// Three honest stages, because recognising a word is not the same as owning it:
//   heard        → the recogniser heard you say it clearly on its own
//   in context   → you read it cleanly inside a real sentence
//   comfortable  → read cleanly in context on 3 different days
// None of these is a pronunciation grade; they measure whether speech recognition
// heard the word clearly, which is the closest thing a phone can check on its own.

export const COMFORTABLE_AFTER_DAYS = 3;
/** @deprecated use COMFORTABLE_AFTER_DAYS */
export const LEARNED_AFTER_DAYS = COMFORTABLE_AFTER_DAYS;

export type WordEntry = {
  word: string; // lowercased
  heardDays: string[]; // said clearly on its own (drill step 1)
  cleanDays: string[]; // read cleanly in a sentence or passage
  stumbles: number;
  firstSeen: number;
  lastSeen: number;
};

export type WordBook = Record<string, WordEntry>;

export type WordResult = { word: string; clean: boolean; where?: 'alone' | 'context' };

export type WordStage = 'new' | 'heard' | 'in-context' | 'comfortable';

export function dayKey(t: number): string {
  const d = new Date(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function keyOf(word: string) {
  return word.toLowerCase().replace(/[^a-z'-]/g, '');
}

function blank(k: string, now: number): WordEntry {
  return { word: k, heardDays: [], cleanDays: [], stumbles: 0, firstSeen: now, lastSeen: now };
}

/** Older saved books had no heardDays. */
function normaliseEntry(e: WordEntry): WordEntry {
  return { ...e, heardDays: e.heardDays ?? [] };
}

const addDay = (days: string[], d: string) => (days.includes(d) ? days : [...days, d]);

/**
 * Pure update: returns a new book with today's results applied.
 * A stumble today cancels a clean in-context read today.
 */
export function applyResults(book: WordBook, results: WordResult[], now = Date.now()): WordBook {
  const today = dayKey(now);
  const next: WordBook = { ...book };
  // Group by word and place so "clean then stumbled in the same session" counts as a stumble.
  const grouped = new Map<string, { where: 'alone' | 'context'; clean: boolean }>();
  for (const r of results) {
    const k = keyOf(r.word);
    if (k.length < 3) continue;
    const where = r.where ?? 'context';
    const g = `${k}|${where}`;
    grouped.set(g, { where, clean: (grouped.get(g)?.clean ?? true) && r.clean });
  }
  for (const [g, { where, clean }] of grouped) {
    const k = g.split('|')[0];
    const prev = normaliseEntry(next[k] ?? blank(k, now));
    let { heardDays, cleanDays, stumbles } = prev;
    if (where === 'alone') {
      if (clean) heardDays = addDay(heardDays, today);
    } else if (clean) {
      cleanDays = addDay(cleanDays, today);
      heardDays = addDay(heardDays, today); // reading it cleanly implies it was heard
    } else {
      cleanDays = cleanDays.filter((d) => d !== today);
      stumbles += 1;
    }
    next[k] = { ...prev, heardDays, cleanDays, stumbles, lastSeen: now };
  }
  return next;
}

/** "I said it": the recogniser got it wrong, so take back today's stumble and count the read. */
export function correctWord(book: WordBook, word: string, now = Date.now()): WordBook {
  const k = keyOf(word);
  const prev = normaliseEntry(book[k] ?? blank(k, now));
  const today = dayKey(now);
  return {
    ...book,
    [k]: {
      ...prev,
      stumbles: Math.max(0, prev.stumbles - 1),
      cleanDays: addDay(prev.cleanDays, today),
      heardDays: addDay(prev.heardDays, today),
      lastSeen: now,
    },
  };
}

export function stageOf(e: WordEntry | undefined): WordStage {
  if (!e) return 'new';
  if (e.cleanDays.length >= COMFORTABLE_AFTER_DAYS) return 'comfortable';
  if (e.cleanDays.length > 0) return 'in-context';
  if ((e.heardDays ?? []).length > 0) return 'heard';
  return 'new';
}

export const STAGE_LABEL: Record<WordStage, string> = {
  new: 'New',
  heard: 'Heard clearly',
  'in-context': 'In context',
  comfortable: 'Comfortable',
};

/** Label for a word card: a word you only ever missed reads "To practise", not "New". */
export function stageLabel(e: WordEntry | undefined): string {
  const st = stageOf(e);
  if (st === 'new' && e && e.stumbles > 0) return 'To practise';
  return STAGE_LABEL[st];
}

export function isComfortable(e: WordEntry): boolean {
  return e.cleanDays.length >= COMFORTABLE_AFTER_DAYS;
}
/** @deprecated use isComfortable */
export const isLearned = isComfortable;

export type BookSummary = { learning: WordEntry[]; comfortable: WordEntry[]; learned: WordEntry[] };

/** Learning words first, the ones you trip on most at the top. */
export function summarise(book: WordBook): BookSummary {
  const all = Object.values(book).map(normaliseEntry);
  const comfortable = all.filter(isComfortable).sort((a, b) => b.lastSeen - a.lastSeen);
  return {
    learning: all.filter((e) => !isComfortable(e)).sort((a, b) => b.stumbles - a.stumbles || b.lastSeen - a.lastSeen),
    comfortable,
    learned: comfortable,
  };
}

/** Words due for practice: still learning, and not already read cleanly in context today. */
export function dueWords(book: WordBook, now = Date.now(), limit = 5): string[] {
  const today = dayKey(now);
  return summarise(book)
    .learning.filter((e) => !e.cleanDays.includes(today))
    .slice(0, limit)
    .map((e) => e.word);
}
