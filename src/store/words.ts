import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyResults, correctWord, readingResults, WordBook, WordResult } from '../engine/vocab';
import { DICTIONARY } from '../content/wordpacks';
import type { Alignment, PassageWord } from '../engine/align';

const KEY = 'mouthful.words.v1';

export async function loadBook(): Promise<WordBook> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as WordBook) : {};
  } catch {
    return {};
  }
}

let writes: Promise<void> = Promise.resolve();
let resetting = 0;

function updateBook(change: (book: WordBook) => WordBook): Promise<void> {
  if (resetting) return Promise.resolve();
  const work = writes.then(async () => {
    if (resetting) return;
    const book = await loadBook();
    if (resetting) return;
    await AsyncStorage.setItem(KEY, JSON.stringify(change(book)));
  });
  writes = work.catch(() => {});
  return writes;
}

/** Prevent pending vocabulary writes from restoring data during a reset. */
export async function pauseWordWrites(): Promise<() => void> {
  resetting += 1;
  await writes;
  return () => { resetting -= 1; };
}

export function recordWords(results: WordResult[]): Promise<void> {
  if (!results.length) return Promise.resolve();
  const now = Date.now();
  const snapshot = results.map((result) => ({ ...result }));
  return updateBook((book) => applyResults(book, snapshot, now));
}

export function recordCorrection(word: string): Promise<void> {
  const now = Date.now();
  return updateBook((book) => correctWord(book, word, now));
}

/**
 * From a finished session: every pack word you reached (clean or skipped), plus any
 * longer word you skipped, which becomes one of "your words" to practise.
 */
/** What a finished reading tells the word book. The rules live in the engine (`readingResults`). */
export function resultsFromSession(words: PassageWord[], a: Alignment): WordResult[] {
  return readingResults(words, a.status, (k) => DICTIONARY.has(k));
}
