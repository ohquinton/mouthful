import AsyncStorage from '@react-native-async-storage/async-storage';
import { EXPERIENCES, type Experience } from '../content/experiences';

// The door the reader last chose, so a returning reader goes straight to it (DECISIONS 2026-11-07).
// "Reset all data" clears it with the rest of storage, so the next launch shows both doors again.

const KEY = 'mouthful.experience.v1';

/** Only a door that exists. Anything else (old value, damaged storage) shows both doors. */
export function parseExperience(raw: string | null): Experience | null {
  return raw && Object.prototype.hasOwnProperty.call(EXPERIENCES, raw) ? (raw as Experience) : null;
}

export async function loadExperience(): Promise<Experience | null> {
  try {
    return parseExperience(await AsyncStorage.getItem(KEY));
  } catch {
    return null;
  }
}

/** Best effort: if this fails, the reader sees both doors next launch and nothing else breaks. */
export async function saveExperience(mode: Experience): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, mode);
  } catch {}
}
