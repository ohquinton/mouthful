import AsyncStorage from '@react-native-async-storage/async-storage';

// Bring Your Own Script: paste any text, the app splits it into readable chunks.

export type Script = {
  id: string;
  title: string;
  createdAt: number;
  chunks: string[];
};

export const MAX_SCRIPT_WORDS = 1500;
const TARGET_CHUNK_WORDS = 150;
const KEY = 'mouthful.scripts.v1';

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/**
 * Splits text into chunks of about 150 words, only ever breaking at the end of a sentence
 * so nobody has to stop mid-thought. A single very long sentence becomes its own chunk.
 */
export function chunkScript(text: string, target = TARGET_CHUNK_WORDS): string[] {
  const clean = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?\n]+(?:[.!?]+["”’)]?|\n+|$)/g)?.map((s) => s.trim()).filter(Boolean) ?? [clean];

  const chunks: string[] = [];
  let current: string[] = [];
  let words = 0;
  for (const s of sentences) {
    const n = wordCount(s);
    if (words > 0 && words + n > target * 1.25) {
      chunks.push(current.join(' '));
      current = [];
      words = 0;
    }
    current.push(s);
    words += n;
    if (words >= target) {
      chunks.push(current.join(' '));
      current = [];
      words = 0;
    }
  }
  if (current.length) {
    // Fold a tiny tail into the previous chunk instead of leaving a 12-word session.
    if (words < target * 0.35 && chunks.length) chunks[chunks.length - 1] += ` ${current.join(' ')}`;
    else chunks.push(current.join(' '));
  }
  return chunks;
}

export function titleFrom(text: string): string {
  const first = text.trim().split(/[.!?\n]/)[0] ?? '';
  const words = first.split(/\s+/).slice(0, 5).join(' ');
  return words.length ? words.replace(/[,:;]$/, '') : 'Untitled script';
}

export async function loadScripts(): Promise<Script[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Script[]) : [];
  } catch {
    return [];
  }
}

export async function saveScript(title: string, text: string): Promise<Script> {
  const script: Script = {
    id: `${Date.now()}`,
    title: title.trim() || titleFrom(text),
    createdAt: Date.now(),
    chunks: chunkScript(text),
  };
  const all = await loadScripts();
  all.unshift(script);
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
  return script;
}

export async function deleteScript(id: string): Promise<void> {
  const all = (await loadScripts()).filter((s) => s.id !== id);
  await AsyncStorage.setItem(KEY, JSON.stringify(all));
}
