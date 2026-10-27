import AsyncStorage from '@react-native-async-storage/async-storage';
import { applyResults, correctWord, WordBook, WordResult } from '../engine/vocab';
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

export async function recordWords(results: WordResult[]): Promise<void> {
  if (!results.length) return;
  const next = applyResults(await loadBook(), results);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

export async function recordCorrection(word: string): Promise<void> {
  const next = correctWord(await loadBook(), word);
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {}
}

/**
 * From a finished session: every pack word you reached (clean or skipped), plus any
 * longer word you skipped, which becomes one of "your words" to practise.
 */
export function resultsFromSession(words: PassageWord[], a: Alignment): WordResult[] {
  const out: WordResult[] = [];
  words.forEach((w, i) => {
    const status = a.status[i];
    if (status === 'pending') return;
    const clean = w.display.replace(/[^A-Za-z'’-]/g, '');
    if (DICTIONARY.has(w.key)) out.push({ word: clean, clean: status === 'read' });
    else if (status === 'skipped' && clean.length >= 6) out.push({ word: clean, clean: false });
  });
  return out;
}
