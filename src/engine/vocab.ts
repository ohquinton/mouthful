// "Your words": every pack word you've practised and every word you've tripped on.
//
// Three honest stages, because recognising a word is not the same as owning it:
//   heard        → the recogniser heard you say it clearly on its own
//   in context   → you read it cleanly inside a real sentence
//   comfortable  → read cleanly in context on 3 different days
// None of these is a pronunciation grade; they measure whether speech recognition
// heard the word clearly, which is the closest thing a phone can check on its own.

//
// All three are about reading aloud, so none of them shows the reader can remember or use a word.
// That evidence is separate (`recall` below) and is the reader's own mark: "remembered" and
// "used in my own sentence" never change a stage, and a stage never counts as either.

import { tokenise, type PassageWord, type WordStatus } from './align';
import { calendarDay } from './days';

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
  /** Absent on books saved before recall, and on words not yet tried from memory. */
  recall?: RecallRecord;
};

/** Ticks and dates only. What the reader said is never stored. */
export type RecallRecord = {
  rememberedDays: string[]; // the reader marked "I remembered" (self-reported)
  ownSentenceDays: string[]; // the reader marked "that was my own sentence" (self-reported)
  step: number; // recalls in a row marked remembered
  lastDay: number; // calendarDay of the last answer
  dueDay: number | null; // calendarDay it comes back; null once the full schedule is passed
};

export type WordBook = Record<string, WordEntry>;

export type WordResult = {
  word: string;
  clean: boolean;
  where?: 'alone' | 'context';
  /** Only update a word already in the book; never add it (a script's words stay out of the book). */
  ifSaved?: boolean;
};

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

/** A saved record may be from an older or damaged book, so every field is checked. */
function readRecall(r: RecallRecord | undefined): RecallRecord {
  return {
    rememberedDays: Array.isArray(r?.rememberedDays) ? r.rememberedDays : [],
    ownSentenceDays: Array.isArray(r?.ownSentenceDays) ? r.ownSentenceDays : [],
    step: typeof r?.step === 'number' && r.step >= 0 ? r.step : 0,
    lastDay: typeof r?.lastDay === 'number' ? r.lastDay : Number.NEGATIVE_INFINITY,
    dueDay: r?.dueDay === null ? null : typeof r?.dueDay === 'number' ? r.dueDay : 0,
  };
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
  const grouped = new Map<string, { where: 'alone' | 'context'; clean: boolean; ifSaved: boolean }>();
  for (const r of results) {
    const k = keyOf(r.word);
    if (k.length < 3) continue;
    const where = r.where ?? 'context';
    const g = `${k}|${where}`;
    const seen = grouped.get(g);
    grouped.set(g, {
      where,
      clean: (seen?.clean ?? true) && r.clean,
      ifSaved: (seen?.ifSaved ?? true) && !!r.ifSaved,
    });
  }
  for (const [g, { where, clean, ifSaved }] of grouped) {
    const k = g.split('|')[0];
    if (ifSaved && !next[k]) continue;
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

/**
 * What a finished reading tells the word book. Pass the final (corrected) statuses.
 * - Pack words you reached: clean if read, a stumble if red.
 * - Any other word of 6+ letters that went red: a stumble, so it joins "your words".
 * - Any other word read cleanly: a clean in-context day, but only if it's already in the book.
 *   The passage is a real sentence, so this is the same evidence a pack word gets from a pack
 *   passage. Without it, a word missed in a reading could never reach "comfortable". Words never
 *   reached ('pending') count neither way.
 */
export function readingResults(
  words: Pick<PassageWord, 'key' | 'display'>[],
  status: WordStatus[],
  isPackWord: (key: string) => boolean,
): WordResult[] {
  const out: WordResult[] = [];
  words.forEach((w, i) => {
    const s = status[i];
    if (s === 'pending' || s === undefined) return;
    const clean = w.display.replace(/[^A-Za-z'’-]/g, '');
    if (isPackWord(w.key)) out.push({ word: clean, clean: s === 'read' });
    else if (s === 'skipped') {
      if (clean.length >= 6) out.push({ word: clean, clean: false });
      // A shorter red word can still be a saved one (an older book, a Fix-it word): it's a stumble there.
      else out.push({ word: clean, clean: false, ifSaved: true });
    } else out.push({ word: clean, clean: true, ifSaved: true });
  });
  return out;
}

// ---- Recall: can the reader bring the word back from its meaning, and use it unprompted? ----

/**
 * Calendar days between tries: the first comes this long after meeting the word, each one marked
 * remembered moves along the list, and after the last the word stops coming back. "Not yet" starts
 * again from the first gap, so it returns tomorrow.
 */
export const RECALL_GAPS = [1, 3, 7] as const;
const LONGEST_GAP = RECALL_GAPS[RECALL_GAPS.length - 1];

/** Fewer words than this isn't a sentence, so it gets Try again. */
export const MIN_OWN_SENTENCE_WORDS = 3;

/** The calendar day this word is next due, or null when the schedule is finished. */
export function recallDueDay(e: WordEntry): number | null {
  if (e.recall) return readRecall(e.recall).dueDay;
  return calendarDay(e.firstSeen) + RECALL_GAPS[0];
}

/**
 * Due when its day has come. A due day further ahead than any gap can only come from a clock that
 * was wrong when it was saved, so it counts as due rather than hiding the word for months.
 */
export function isDueForRecall(e: WordEntry, now = Date.now()): boolean {
  const due = recallDueDay(e);
  if (due === null) return false;
  if (!Number.isFinite(due)) return true;
  const today = calendarDay(now);
  return due <= today || due - today > LONGEST_GAP;
}

/**
 * Words due for recall, the longest overdue first. `hasMeaning` keeps out words with no meaning to
 * show, such as words saved from a reading that aren't in any pack.
 */
export function dueForRecall(book: WordBook, hasMeaning: (word: string) => boolean, now = Date.now(), limit = 5): string[] {
  return Object.values(book)
    .filter((e) => hasMeaning(e.word) && isDueForRecall(e, now))
    .sort((a, b) => (recallDueDay(a) ?? 0) - (recallDueDay(b) ?? 0) || a.word.localeCompare(b.word))
    .slice(0, limit)
    .map((e) => e.word);
}

/** Calendar days until the next word comes back, or null if none will. For the empty state. */
export function daysToNextRecall(book: WordBook, hasMeaning: (word: string) => boolean, now = Date.now()): number | null {
  const today = calendarDay(now);
  let next: number | null = null;
  for (const e of Object.values(book)) {
    if (!hasMeaning(e.word)) continue;
    const due = recallDueDay(e);
    if (due === null) continue;
    const gap = isDueForRecall(e, now) ? 0 : due - today;
    if (next === null || gap < next) next = gap;
  }
  return next;
}

/** The reader's own answer. The first answer of a calendar day stands, so a second visit can't skip a gap. */
export function recordRecall(book: WordBook, word: string, remembered: boolean, now = Date.now()): WordBook {
  const k = keyOf(word);
  const prev = book[k];
  if (!prev) return book;
  const r = readRecall(prev.recall);
  const today = calendarDay(now);
  if (r.lastDay === today) return book;
  const step = remembered ? r.step + 1 : 0;
  const gap = RECALL_GAPS[step];
  return {
    ...book,
    [k]: {
      ...prev,
      recall: {
        ...r,
        rememberedDays: remembered ? addDay(r.rememberedDays, dayKey(now)) : r.rememberedDays,
        step,
        lastDay: today,
        dueDay: gap === undefined ? null : today + gap,
      },
    },
  };
}

/** The reader's own mark that they made the sentence themselves. It doesn't move the schedule. */
export function recordOwnSentence(book: WordBook, word: string, now = Date.now()): WordBook {
  const k = keyOf(word);
  const prev = book[k];
  if (!prev) return book;
  // No answer yet means the due day must stay what it would have been.
  const r = prev.recall ? readRecall(prev.recall) : { ...readRecall(undefined), dueDay: recallDueDay(prev) };
  return { ...book, [k]: { ...prev, recall: { ...r, ownSentenceDays: addDay(r.ownSentenceDays, dayKey(now)) } } };
}

/** Separate labels, worded as the reader's own marks, so nobody reads them as a test result. */
export function recallLabels(e: WordEntry | undefined): string[] {
  if (!e?.recall) return [];
  const r = readRecall(e.recall);
  const out: string[] = [];
  if (r.rememberedDays.length > 0) out.push('You marked: remembered');
  if (r.ownSentenceDays.length > 0) out.push('You marked: used in your own sentence');
  return out;
}

/** Everyday endings count as the word ("premises", "reconciled"): the reader was using it. */
function sameWord(heard: string, key: string): boolean {
  if (heard === key) return true;
  const stem = key.endsWith('e') ? key.slice(0, -1) : key;
  const y = key.endsWith('y') ? key.slice(0, -1) : null;
  return (
    heard === `${key}s` || heard === `${key}es` || heard === `${key}d` || heard === `${key}ed` || heard === `${key}ing` ||
    heard === `${key}'s` || heard === `${stem}ing` || (y !== null && (heard === `${y}ies` || heard === `${y}ied`))
  );
}

/** Did the phone hear this word in what was said? It says nothing about how the word was said. */
export function heardWordIn(word: string, transcript: string): boolean {
  const parts = tokenise(word);
  const heard = tokenise(transcript);
  if (!parts.length) return false;
  return heard.some((_, i) => parts.every((p, j) => {
    const h = heard[i + j];
    if (h === undefined) return false;
    return j === parts.length - 1 ? sameWord(h, p) : h === p;
  }));
}

/** What to show after an own-sentence attempt. The transcript is only read, never kept. */
export function ownSentenceCheck(word: string, transcript: string): { spoken: number; tooShort: boolean; heard: boolean } {
  const spoken = tokenise(transcript).length;
  return { spoken, tooShort: spoken < MIN_OWN_SENTENCE_WORDS, heard: heardWordIn(word, transcript) };
}
