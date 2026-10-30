/* eslint-disable @typescript-eslint/no-require-imports -- each test needs a fresh copy of the module, so require() after resetModules */
// Crash reports follow the "Share anonymous usage counts and crash reports" switch in You.
// Nothing may start before the profile has said the reader's choice, and off means off.

describe('crash reports switch', () => {
  afterEach(() => {
    jest.resetModules();
    jest.dontMock('react-native');
    delete process.env.EXPO_PUBLIC_SENTRY_DSN;
  });

  function load(dsn = 'https://key@o1.ingest.sentry.io/1') {
    if (dsn) process.env.EXPO_PUBLIC_SENTRY_DSN = dsn;
    const sentry = require('../src/sentry');
    const sdk = require('@sentry/react-native');
    sdk._options.enabled = true;
    return { ...sentry, sdk };
  }

  it('starts nothing until the profile has decided', () => {
    const { sdk, crashReportsState } = load();
    expect(sdk.init).not.toHaveBeenCalled();
    expect(crashReportsState()).toBe('off');
  });

  it('never starts for a reader who opted out', () => {
    const { sdk, setCrashReportsEnabled, sendTestCrashReport } = load();
    setCrashReportsEnabled(false);
    setCrashReportsEnabled(false);
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sdk.close).not.toHaveBeenCalled();
    expect(sendTestCrashReport()).toBe(false);
    expect(sdk.captureException).not.toHaveBeenCalled();
  });

  it('starts once when sharing is on, however often the profile changes', () => {
    const { sdk, setCrashReportsEnabled, crashReportsState } = load();
    setCrashReportsEnabled(true);
    setCrashReportsEnabled(true);
    setCrashReportsEnabled(true);
    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk.init.mock.calls[0][0].dsn).toBe('https://key@o1.ingest.sentry.io/1');
    expect(sdk.init.mock.calls[0][0].sendDefaultPii).toBe(false);
    expect(crashReportsState()).toBe('on');
  });

  it('opting out stops sending at once and closes the SDK, once', () => {
    const { sdk, setCrashReportsEnabled, crashReportsState, sendTestCrashReport } = load();
    setCrashReportsEnabled(true);
    setCrashReportsEnabled(false);
    setCrashReportsEnabled(false);
    expect(sdk._options.enabled).toBe(false);
    expect(sdk.close).toHaveBeenCalledTimes(1);
    expect(crashReportsState()).toBe('stopped');
    expect(sendTestCrashReport()).toBe(false);
  });

  it('opting back in during the same launch stays off (no second init) until next launch', () => {
    const { sdk, setCrashReportsEnabled, crashReportsState } = load();
    setCrashReportsEnabled(true);
    setCrashReportsEnabled(false);
    setCrashReportsEnabled(true);
    expect(sdk.init).toHaveBeenCalledTimes(1);
    expect(sdk._options.enabled).toBe(false);
    expect(crashReportsState()).toBe('stopped');
  });

  it('a reader who opted out and switches sharing on starts crash reports then', () => {
    const { sdk, setCrashReportsEnabled } = load();
    setCrashReportsEnabled(false);
    setCrashReportsEnabled(true);
    expect(sdk.init).toHaveBeenCalledTimes(1);
  });

  it('does nothing without a DSN', () => {
    const { sdk, setCrashReportsEnabled, crashReportsConfigured, sendTestCrashReport } = load('');
    expect(crashReportsConfigured).toBe(false);
    setCrashReportsEnabled(true);
    expect(sdk.init).not.toHaveBeenCalled();
    expect(sendTestCrashReport()).toBe(false);
  });

  it('does nothing on web, our test harness', () => {
    jest.doMock('react-native', () => ({ Platform: { OS: 'web' } }));
    const { sdk, setCrashReportsEnabled } = load();
    setCrashReportsEnabled(true);
    expect(sdk.init).not.toHaveBeenCalled();
  });

  it('the tester-mode test report sends a fixed message, never anything else', () => {
    const { sdk, setCrashReportsEnabled, sendTestCrashReport } = load();
    setCrashReportsEnabled(true);
    expect(sendTestCrashReport()).toBe(true);
    expect(sdk.captureException).toHaveBeenCalledTimes(1);
    expect((sdk.captureException.mock.calls[0][0] as Error).message).toBe('Test crash report from tester mode');
  });

  it('a throwing SDK never throws into the app', () => {
    const { sdk, setCrashReportsEnabled } = load();
    sdk.init.mockImplementationOnce(() => {
      throw new Error('native module missing');
    });
    expect(() => setCrashReportsEnabled(true)).not.toThrow();
  });
});
