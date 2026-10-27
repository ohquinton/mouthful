// The reader can turn off anonymous usage counts in You (App Store 5.1.1).
// Off must mean nothing is sent: not new events, and not events already queued.

describe('analytics opt-out', () => {
  const realFetch = (globalThis as any).fetch;
  let stop: ((on: boolean) => void) | undefined;
  afterEach(() => {
    stop?.(false); // clears any pending flush timer so jest can exit
    (globalThis as any).fetch = realFetch;
    jest.resetModules();
    delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
  });

  const wait = () => new Promise((r) => setTimeout(r, 20));

  function load() {
    process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_test';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    (globalThis as any).fetch = fetchMock;
    const { track, setAnalyticsEnabled } = require('../src/analytics');
    stop = setAnalyticsEnabled;
    return { fetchMock, track, setAnalyticsEnabled };
  }

  it('sends nothing while opted out', async () => {
    const { fetchMock, track, setAnalyticsEnabled } = load();
    setAnalyticsEnabled(false);
    for (let i = 0; i < 12; i++) track('session_complete', { wpm: 150 });
    await wait();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('drops events queued before opting out', async () => {
    const { fetchMock, track, setAnalyticsEnabled } = load();
    for (let i = 0; i < 9; i++) track('session_complete', { wpm: 150 }); // one short of a batch
    setAnalyticsEnabled(false);
    setAnalyticsEnabled(true);
    track('session_complete', { wpm: 150 }); // would have been the 10th
    await wait();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends again after opting back in', async () => {
    const { fetchMock, track, setAnalyticsEnabled } = load();
    setAnalyticsEnabled(false);
    track('session_complete', { wpm: 150 });
    setAnalyticsEnabled(true);
    for (let i = 0; i < 10; i++) track('session_complete', { wpm: 150 });
    await wait();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).batch).toHaveLength(10);
  });
});
