// Switching tester mode off offers to delete what it kept (transcripts and marks).
// The sessions and their scores must survive; only the review data goes.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearSessionReviews, listenerSummary, loadSessions, reviewCount, saveSession, SavedSession } from '../src/store/sessions';

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

describe('listenerSummary (tester diagnostics on /review)', () => {
  const review = (listener?: { restarts: number; glitches: Record<string, number> }) => ({
    statuses: 'rr',
    transcript: '',
    marks: { said: [], notSaid: [] },
    listener,
  });

  it('lists restarts and glitch codes, most frequent first', () => {
    expect(listenerSummary(review({ restarts: 2, glitches: { network: 1, 'audio-capture': 3 } }))).toBe('2 restarts · audio-capture 3, network 1');
  });

  it('uses the singular and says when nothing went wrong', () => {
    expect(listenerSummary(review({ restarts: 1, glitches: {} }))).toBe('1 restart · no glitches');
    expect(listenerSummary(review({ restarts: 0, glitches: { other: 0 } }))).toBe('0 restarts · no glitches');
  });

  it('copes with sessions saved before the counts existed', () => {
    expect(listenerSummary(review())).toBe('Listener counts weren’t saved for this session.');
    expect(listenerSummary(undefined)).toBe('Listener counts weren’t saved for this session.');
  });

  it('keeps the counts when the session is saved and loaded', async () => {
    await AsyncStorage.clear();
    await saveSession({ ...base('d'), review: review({ restarts: 3, glitches: { network: 2 } }) });
    expect((await loadSessions())[0].review?.listener).toEqual({ restarts: 3, glitches: { network: 2 } });
  });
});
