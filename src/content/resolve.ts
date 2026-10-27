import { getPassage, Passage } from './passages';
import { loadScripts } from './scripts';
import { packPassage } from './wordpacks';

// The Day 1 baseline: ~45 seconds, neutral, the same for everyone so Day 7/30/100 re-tests compare fairly.
export const BASELINE: Passage = {
  id: 'baseline',
  title: 'Your Day 1 read',
  level: 'Steady',
  text:
    'Every morning, the café on the corner opens before the sun is fully up. The owner unlocks the door, switches on the espresso machine, and writes the specials on a small chalkboard. Regulars arrive one by one. Some want conversation, and some just want their coffee and a quiet table by the window. By eight o’clock the line reaches the door, the music is a little louder, and the whole neighbourhood seems, finally, to be awake.',
};

/** Script chunks use ids like `s.<scriptId>.<chunkIndex>`. */
export function scriptChunkId(scriptId: string, chunk: number) {
  return `s.${scriptId}.${chunk}`;
}

export async function resolvePassage(id: string): Promise<Passage | undefined> {
  if (id === BASELINE.id) return BASELINE;
  const builtIn = getPassage(id);
  if (builtIn) return builtIn;
  const fromPack = packPassage(id);
  if (fromPack) return fromPack;
  const m = /^s\.(\d+)\.(\d+)$/.exec(id);
  if (!m) return undefined;
  const script = (await loadScripts()).find((s) => s.id === m[1]);
  const text = script?.chunks[Number(m[2])];
  if (!script || !text) return undefined;
  const label = script.chunks.length > 1 ? ` · part ${Number(m[2]) + 1} of ${script.chunks.length}` : '';
  return { id, title: `${script.title}${label}`, level: 'Flowing', text };
}

/** Where a passage came from, for analytics. A code, never the text. */
export function sourceOf(id: string): 'baseline' | 'pack' | 'script' | 'talk' | 'passage' {
  if (id === BASELINE.id) return 'baseline';
  if (id.startsWith('w.')) return 'pack';
  if (id.startsWith('s.')) return 'script';
  if (id === 'talk') return 'talk';
  return 'passage';
}
