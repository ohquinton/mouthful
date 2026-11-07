import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PointAttempt } from '../exercises/makeYourPoint';

// Finished practice exercises, on the phone only. Numbers and the reader's own ticks, never what
// they said. Kept apart from sessions so they can't enter Flow trends, streaks or score bests.

export type PointRecord = { id: string; taskId: string; at: number; first: PointAttempt; second: PointAttempt };

export const POINT_RECORDS_KEY = 'mouthful.practice.point.v1';

export async function loadPointRecords(): Promise<PointRecord[]> {
  try {
    const raw = await AsyncStorage.getItem(POINT_RECORDS_KEY);
    return raw ? (JSON.parse(raw) as PointRecord[]) : [];
  } catch {
    return [];
  }
}

export async function savePointRecord(record: PointRecord): Promise<void> {
  try {
    const all = await loadPointRecords();
    await AsyncStorage.setItem(POINT_RECORDS_KEY, JSON.stringify([...all, record]));
  } catch {
    // The reader still sees their result; only the history misses it.
  }
}
