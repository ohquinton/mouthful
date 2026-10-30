import * as Sentry from '@sentry/react-native';
import type { ErrorEvent } from '@sentry/react-native';
import { Platform } from 'react-native';

// Crash reports (Sentry), privacy first. A crash report carries the error type, a short
// error message, the stack trace, the app version and the phone model and OS. Never the
// reader's words, voice, scripts, locale or anything they did before the crash.
//
// Set EXPO_PUBLIC_SENTRY_DSN to turn it on. With no DSN, every call is a no-op.
// Crash reports follow the same switch as usage counts in You ("Share anonymous usage
// counts and crash reports"). Nothing starts until the profile says the reader's choice,
// exactly like analytics.ts.

const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

/** True when this build has a Sentry DSN, so there is something to opt out of. */
export const crashReportsConfigured = !!DSN;

// An error message longer than this many words looks like a transcript or a script,
// not a programming error, so the whole event is dropped rather than risk sending it.
export const MAX_WORDS = 8;
// Longest exception message we send. Long messages are where user text tends to hide.
export const MAX_VALUE_LENGTH = 200;

function wordCount(text: string): number {
  return text.split(/\s+/).filter(Boolean).length;
}

/**
 * Strips everything from an event that could identify the reader or carry their words.
 * Pure (returns a copy), so it's tested in test/sentryScrub.test.ts. Returns null to drop
 * the event entirely.
 */
export function scrubEvent<E extends ErrorEvent>(event: E): E | null {
  // Messages first: captureMessage puts text here. We never call it, but a library might.
  const messages = [event.message, event.logentry?.message];
  for (const m of messages) if (typeof m === 'string' && wordCount(m) > MAX_WORDS) return null;

  const out: E = { ...event };
  delete out.breadcrumbs; // what the reader did before the crash (screens, taps, route params)
  delete out.user;
  delete out.extra;
  delete out.request;

  if (out.contexts) {
    const contexts = { ...out.contexts };
    delete contexts.culture; // locale, calendar, timezone: hints at where the reader is from
    if (contexts.device) {
      const device = { ...contexts.device };
      delete device.locale;
      contexts.device = device;
    }
    out.contexts = contexts;
  }

  if (out.exception?.values) {
    const values = [];
    for (const v of out.exception.values) {
      if (typeof v.value === 'string') {
        if (wordCount(v.value) > MAX_WORDS) return null;
        values.push({ ...v, value: v.value.slice(0, MAX_VALUE_LENGTH) });
      } else values.push(v);
    }
    out.exception = { ...out.exception, values };
  }
  return out;
}

// 'off' until the profile says yes; 'on' once started; 'stopped' after an opt-out. Sentry's
// native SDK can't be restarted once closed (its transport goes with it), so a stop lasts
// until the next launch.
type State = 'off' | 'on' | 'stopped';
let state: State = 'off';

/** For tests and the tester-mode check: where crash reporting is right now. */
export function crashReportsState(): State {
  return state;
}

/** The options we start Sentry with. Exported so the test can check every privacy switch. */
export function sentryOptions(): Sentry.ReactNativeOptions {
  return {
    dsn: DSN,
    environment: typeof __DEV__ !== 'undefined' && __DEV__ ? 'development' : 'production',
    sendDefaultPii: false,
    attachScreenshot: false,
    attachViewHierarchy: false,
    tracesSampleRate: 0,
    enableLogs: false,
    enableAutoSessionTracking: false,
    enableCaptureFailedRequests: false,
    maxBreadcrumbs: 0,
    // No replay or feedback integrations: they're only added when asked for, and we never ask.
    beforeBreadcrumb: () => null,
    beforeSend: (event) => scrubEvent(event),
  };
}

/**
 * The profile provider calls this with the reader's choice once the saved profile is read,
 * and on every change. Before the first call nothing is started, so a saved opt-out holds
 * from the first second (the same "decided" rule as analytics.ts).
 * - "on" the first time: start Sentry. This is the only place Sentry.init is called.
 * - "off": stop sending at once and shut down the native crash handler too.
 * - "on" after an "off" in the same launch: stays off until the app is next opened.
 *   Sentry can't restart its native side, and we'd rather miss a crash than half-work.
 */
export function setCrashReportsEnabled(on: boolean) {
  if (!DSN || Platform.OS === 'web') return; // web is our test harness: no crash reports from it
  try {
    if (on && state === 'off') {
      state = 'on';
      Sentry.init(sentryOptions());
    } else if (!on && state === 'on') {
      state = 'stopped';
      // Off before close(), so the flush inside close() sends nothing new.
      const options = Sentry.getClient()?.getOptions();
      if (options) options.enabled = false;
      Sentry.close().catch(() => {});
    }
  } catch {
    // Crash reporting must never be the thing that crashes the app.
  }
}

/**
 * Tester mode only: sends a fixed test error so a device check can confirm crash reports
 * arrive (and arrive scrubbed). Returns false when crash reports are off or not set up.
 */
export function sendTestCrashReport(): boolean {
  if (state !== 'on') return false;
  try {
    Sentry.captureException(new Error('Test crash report from tester mode'));
    return true;
  } catch {
    return false;
  }
}

/** Wraps the root layout so render errors are reported. A no-op until Sentry is started. */
export const wrapRoot = Sentry.wrap;
