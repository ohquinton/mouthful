describe('analytics', () => {
  const realFetch = (globalThis as any).fetch;
  afterEach(() => {
    (globalThis as any).fetch = realFetch;
    jest.resetModules();
    delete process.env.EXPO_PUBLIC_POSTHOG_KEY;
  });

  it('sends nothing without a key', async () => {
    const fetchMock = jest.fn();
    (globalThis as any).fetch = fetchMock as any;
    const { track, analyticsEnabled } = require('../../analytics');
    expect(analyticsEnabled).toBe(false);
    for (let i = 0; i < 12; i++) track('session_complete', { wpm: 150 });
    await new Promise((r) => setTimeout(r, 10));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('batches events to PostHog with an anonymous id', async () => {
    process.env.EXPO_PUBLIC_POSTHOG_KEY = 'phc_test';
    const fetchMock = jest.fn().mockResolvedValue({ ok: true });
    (globalThis as any).fetch = fetchMock as any;
    const { track } = require('../../analytics');
    for (let i = 0; i < 10; i++) track('session_complete', { wpm: 150 + i, accuracy: 96 });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://us.i.posthog.com/batch/');
    const body = JSON.parse(init.body);
    expect(body.api_key).toBe('phc_test');
    expect(body.batch).toHaveLength(10);
    expect(body.batch[0].event).toBe('session_complete');
    expect(body.batch[0].properties.distinct_id).toMatch(/^anon_/);
    expect(Object.keys(body.batch[0].properties).sort()).toEqual(['$os', 'accuracy', 'distinct_id', 'wpm']);
  });
});

describe('analytics privacy guard', () => {
  it('drops any free-text property, keeps short codes and numbers', () => {
    const { sanitise } = require('../../analytics');
    expect(
      sanitise({ where: 'glide', source: 'script', length: 12, pack_word: false, word: 'reconciliation', note: 'my private script text' }),
    ).toEqual({ where: 'glide', source: 'script', length: 12, pack_word: false });
    expect(sanitise({ moment: 'interview', where: 'this is a sentence someone typed' })).toEqual({ moment: 'interview' });
  });
});
