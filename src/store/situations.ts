import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SituationRecord } from '../content/situationFlow';

/**
 * Situation results, on their own key and away from sessions, so nothing here can reach Flow
 * trends, bests or Progress. Numbers, booleans and our own ids only: what the phone heard is
 * shown on screen and never passed to this file.
 */
const KEY = 'mouthful.situations.v1';
/** Enough for "which next?". Oldest go first, so this can't grow for ever. */
export const MAX_RECORDS = 200;

function isRecord(r: unknown): r is SituationRecord {
  const v = r as SituationRecord | null;
  return !!v && typeof v.situationId === 'string' && typeof v.at === 'number' && Array.isArray(v.ticks);
}

export async function loadSituationRecords(): Promise<SituationRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isRecord) : [];
  } catch {
    return [];
  }
}

let writes: Promise<unknown> = Promise.resolve();
let resetting = 0;

/** Best effort: false means this one result wasn't saved, and the reader can be told. */
export function saveSituationRecord(record: SituationRecord): Promise<boolean> {
  if (resetting) return Promise.resolve(false);
  const work = writes.then(async () => {
    if (resetting) return false;
    try {
      const all = await loadSituationRecords();
      if (resetting) return false;
      await AsyncStorage.setItem(KEY, JSON.stringify([...all, record].slice(-MAX_RECORDS)));
      return true;
    } catch {
      return false;
    }
  });
  writes = work;
  return work;
}

/** Stops a pending save from restoring data during Reset all data, as words.ts does. */
export async function pauseSituationWrites(): Promise<() => void> {
  resetting += 1;
  await writes;
  return () => { resetting -= 1; };
}
