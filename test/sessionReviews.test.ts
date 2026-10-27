// Switching tester mode off offers to delete what it kept (transcripts and marks).
// The sessions and their scores must survive; only the review data goes.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSessionReviews, loadSessions, reviewCount, saveSession, SavedSession } from '../src/store/sessions';

const base = (id: string): SavedSession => ({
  id,
  passageId: 'night-shift',
  title: 'Night shift',
  at: 1_700_000_000_000,
  wpm: 140,
  fillers: 0,
  fillersPerMin: 0,
  accuracy: 95,
  pauses: 0,
  seconds: 60,
  score: 80,
  stumbled: [],
});

describe('clearSessionReviews', () => {
  beforeEach(() => AsyncStorage.clear());

  it('removes review data and keeps the sessions', async () => {
    await saveSession({ ...base('a'), review: { statuses: 'rrs', transcript: 'what the phone heard', marks: { said: [], notSaid: [] } } });
    await saveSession(base('b'));
    expect(reviewCount(await loadSessions())).toBe(1);

    expect(await clearSessionReviews()).toBe(1);

    const after = await loadSessions();
    expect(after.map((s) => s.id)).toEqual(['a', 'b']);
    expect(after[0].score).toBe(80);
    expect(after.some((s) => 'review' in s)).toBe(false);
    expect(JSON.stringify(after)).not.toContain('what the phone heard');
  });

  it('returns 0 and writes nothing when there is nothing to clear', async () => {
    await saveSession(base('a'));
    const spy = jest.spyOn(AsyncStorage, 'setItem');
    expect(await clearSessionReviews()).toBe(0);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
