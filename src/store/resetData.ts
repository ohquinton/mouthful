import { pauseWordWrites } from './words';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadSessions, recordingUris } from './sessions';
import { deleteAllRecordings } from './recordings';
import { resetAnalytics } from '../analytics';

/**
 * "Reset all data", without React, so it's tested in test/resetKeepsOptOut.test.ts.
 * profile.tsx's reset() calls it.
 */

/**
 * What survives a reset: only the reader's analytics opt-out (DECISIONS.md 2026-10-28).
 * Reset is "delete my data"; silently turning tracking back on for someone who said no
 * would break principle 3.
 */
export function keptAfterReset(p: { analyticsOptOut?: boolean }): { analyticsOptOut?: true } {
  return p.analyticsOptOut ? { analyticsOptOut: true } : {};
}

/**
 * Deletes every recording, clears storage, then writes `keptProfile` back under the profile
 * key (if there is one), so an opt-out still holds on the next launch. Analytics always
 * starts over under a new anonymous id. Best effort: a failed step never stops the next one.
 */
export async function wipeAllData(profileKey: string, keptProfile: object | null): Promise<void> {
  const resumeWords = await pauseWordWrites();
  try {
    // Audio files first: once the database is cleared we'd no longer know where they are.
    try {
      deleteAllRecordings(recordingUris(await loadSessions()));
    } catch {}
    try {
      await AsyncStorage.clear();
    } catch {}
    if (keptProfile) {
      try {
        await AsyncStorage.setItem(profileKey, JSON.stringify(keptProfile));
      } catch {}
    }
    await resetAnalytics();
  } finally { resumeWords(); }
}
