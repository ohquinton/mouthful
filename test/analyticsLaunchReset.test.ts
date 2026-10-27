// Two promises from the You tab that must hold at the edges:
// - A saved opt-out is honoured from the first second: nothing is sent before the profile
//   has told analytics the reader's choice, and turning it off mid-send still stops the send.
// - Reset all data is like a fresh install: a new anonymous id, nothing from before sent.
// Storage comes from load(): jest.resetModules gives each test a fresh analytics module and a
// fresh in-memory AsyncStorage, so the test must use the same copy the module sees.
type Storage = { getItem(k: string): Promise<string | null>; setItem(k: string, v: string): Promise<void>; clear(): Promise<void> };
let AsyncStorage: Storage;

const ID_KEY = 'mouthful.analyticsId';

describe('analytics at launch and after reset', () => {
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
    AsyncStorage = require('@react-native-async-storage/async-storage');
    return { fetchMock, ...mod };
  }

  const sentIds = (fetchMock: jest.Mock) =>
    fetchMock.mock.calls.map(([, init]) => JSON.parse(init.body).batch[0].properties.distinct_id as string);

  it('sends nothing before the profile has loaded, even a full batch', async () => {
    const { fetchMock, track } = load();
    for (let i = 0; i < 12; i++) track('session_complete', { wpm: 150 });
    await wait();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('drops launch events when the saved profile says opted out', async () => {
    const { fetchMock, track, setAnalyticsEnabled } = load();
    for (let i = 0; i < 12; i++) track('session_complete', { wpm: 150 });
    setAnalyticsEnabled(false); // profile loaded: analyticsOptOut
    setAnalyticsEnabled(true); // later opts back in: the old events must not come back
    await wait();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sends launch events once the profile says sharing is on', async () => {
    const { fetchMock, track, setAnalyticsEnabled } = load();
    for (let i = 0; i < 10; i++) track('session_complete', { wpm: 150 });
    setAnalyticsEnabled(true);
    await wait();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).batch).toHaveLength(10);
  });

  it('does not send a batch if the reader opts out while it is getting ready', async () => {
    const { fetchMock, track, setAnalyticsEnabled } = load();
    setAnalyticsEnabled(true);
    for (let i = 0; i < 10; i++) track('session_complete', { wpm: 150 }); // flush starts, awaits the id
    setAnalyticsEnabled(false);
    await wait();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses a new anonymous id after Reset all data, and sends nothing queued before it', async () => {
    const { fetchMock, track, setAnalyticsEnabled, resetAnalytics } = load();
    setAnalyticsEnabled(true);
    for (let i = 0; i < 10; i++) track('session_complete', { wpm: 150 });
    await wait();
    const [before] = sentIds(fetchMock);
    expect(before).toMatch(/^anon_/);

    for (let i = 0; i < 9; i++) track('session_complete', { wpm: 150 }); // queued, not sent yet
    await AsyncStorage.clear(); // what profile reset() does
    await resetAnalytics();
    setAnalyticsEnabled(true); // apply(DEFAULT): on, like a fresh install
    track('session_complete', { wpm: 150 }); // the old 9 would have made this a batch of 10
    await wait();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    for (let i = 0; i < 9; i++) track('session_complete', { wpm: 150 });
    await wait();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const after = sentIds(fetchMock)[1];
    expect(after).toMatch(/^anon_/);
    expect(after).not.toBe(before);
    expect(await AsyncStorage.getItem(ID_KEY)).toBe(after);
  });

  it('forgets the old id even if clearing storage failed', async () => {
    const { resetAnalytics } = load();
    await AsyncStorage.setItem(ID_KEY, 'anon_old');
    await resetAnalytics();
    expect(await AsyncStorage.getItem(ID_KEY)).toBeNull();
  });

  it('a send that started before the reset never goes out', async () => {
    const { fetchMock, track, setAnalyticsEnabled, resetAnalytics } = load();
    setAnalyticsEnabled(true);
    for (let i = 0; i < 10; i++) track('session_complete', { wpm: 150 }); // flush awaits the id
    await resetAnalytics();
    await wait();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
