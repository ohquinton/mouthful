// Before the profile has told analytics the reader's choice, events wait in a queue. If the
// profile never loads, that queue must not grow without limit: it keeps the newest MAX_QUEUE.

describe('analytics queue cap before the profile decides', () => {
  const realFetch = (globalThis as any).fetch;
  let mod: typeof import('../src/analytics') | undefined;

  afterEach(() => {
    mod?.setAnalyticsEnabled(false); // clears any pending flush timer so jest can exit
    mod = undefined;
    (globalThis as any).fetch = realFetch;
    jest.resetModules();
    delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
  });

  const wait = () => new Promise((r) => setTimeout(r, 20));

  function load() {
    process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_test';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    (globalThis as any).fetch = fetchMock;
    mod = require('../src/analytics') as typeof import('../src/analytics');
    return { fetchMock, ...mod };
  }

  const sent = (fetchMock: jest.Mock) =>
    fetchMock.mock.calls.flatMap(([, init]) => JSON.parse(init.body).batch as { properties: { n: number } }[]);

  it('keeps only the newest events, dropping the oldest', async () => {
    const { fetchMock, track, setAnalyticsEnabled, MAX_QUEUE } = load();
    expect(MAX_QUEUE).toBe(100);
    for (let n = 0; n < 250; n++) track('session_complete', { n });
    await wait();
    expect(fetchMock).not.toHaveBeenCalled(); // still waiting for the profile
    setAnalyticsEnabled(true);
    await wait();
    const events = sent(fetchMock);
    expect(events).toHaveLength(MAX_QUEUE);
    expect(events[0].properties.n).toBe(150);
    expect(events[events.length - 1].properties.n).toBe(249);
  });

  it('keeps everything under the cap', async () => {
    const { fetchMock, track, setAnalyticsEnabled } = load();
    for (let n = 0; n < 40; n++) track('session_complete', { n });
    setAnalyticsEnabled(true);
    await wait();
    expect(sent(fetchMock)).toHaveLength(40);
  });
});
