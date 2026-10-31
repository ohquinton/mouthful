import { DICTIONARY } from './wordpacks';
import type { SavedSession } from '../store/sessions';

export type DrillItem = { word: string; sentence?: string };

/** Resolve once, preserving saved-session precedence and the order of first occurrence. */
export async function loadDrillItems(
  raw: string | undefined,
  sid: string | undefined,
  readSession: (id: string) => Promise<SavedSession | undefined>,
): Promise<DrillItem[]> {
  const session = sid ? await readSession(sid) : undefined;
  const contexts = session?.stumbledContext ?? {};
  const contextual = Object.keys(contexts);
  const words = sid ? (contextual.length ? contextual : session?.stumbled ?? []) : (raw ?? '').split(',');
  const seen = new Set<string>();
  return words.flatMap((source) => {
    const word = source.trim();
    const key = word.toLowerCase();
    if (!word || seen.has(key)) return [];
    seen.add(key);
    return [{ word, sentence: DICTIONARY.get(key)?.example ?? contexts[source] }];
  });
}
