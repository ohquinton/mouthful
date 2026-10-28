import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Privacy-safe product analytics (PostHog). Sends event names and numbers only:
// never transcripts, never audio, never what the user typed into a script.
//
// Set EXPO_PUBLIC_POSTHOG_KEY (and optionally EXPO_PUBLIC_POSTHOG_HOST) to turn it on.
// With no key, every call is a no-op, so development and tests send nothing.

const KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY;
const HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST ?? 'https://us.i.posthog.com';
const ID_KEY = 'mouthful.analyticsId';

export type EventName =
  | 'onboarding_step'
  | 'onboarding_complete'
  | 'mic_denied'
  | 'server_recognition_consent'
  | 'session_start'
  | 'session_complete'
  | 'session_too_short'
  | 'recognition_correction'
  | 'drill_complete'
  | 'moment_start'
  | 'plan_step_done'
  | 'pack_open'
  | 'script_saved'
  | 'paywall_view' // `from`: aha (after the free script run) | soft (a soft wall) | you (See Pro)
  | 'paywall_close' // seconds on the paywall before leaving it without buying
  | 'free_run_complete' // the free reader's one script run was saved: counts and the moment code only
  | 'purchase_attempt'
  | 'purchase_result'
  | 'recording_played'
  | 'recordings_deleted'
  | 'session_retry'
  | 'session_resume'; // Carry on after the recogniser stopped; `error` is the listener's code

type Props = Record<string, string | number | boolean | null | undefined>;

/**
 * Only these keys may carry text, and only short codes we chose (like "glide" or "interview").
 * Any other string property is dropped before sending, so a user's words, scripts or
 * transcripts can't leak into analytics even if someone adds a careless track() call.
 */
const TEXT_KEYS = new Set(['kind', 'pace', 'plan', 'feature', 'moment', 'step', 'where', 'which', 'error', 'from', 'source']);
const CODE = /^[a-z0-9_:-]{1,24}$/i;

export function sanitise(props: Props): Props {
  const out: Props = {};
  for (const [k, v] of Object.entries(props)) {
    if (typeof v === 'string') {
      if (TEXT_KEYS.has(k) && CODE.test(v)) out[k] = v;
      else if (typeof __DEV__ !== 'undefined' && __DEV__) console.warn(`[analytics] dropped text property "${k}"`);
      continue;
    }
    out[k] = v;
  }
  return out;
}

let distinctId: string | null = null;
// The reader can turn analytics off in You. The profile provider calls setAnalyticsEnabled
// once the saved profile is read and on every change, because this module can't read React state.
let enabled = true;
// Nothing is sent until the profile has told us the reader's choice at least once. Until then
// events wait in the queue, so a saved opt-out is honoured even for events from the first second.
let decided = false;
// Bumped by resetAnalytics(), so a flush that started before Reset all data can't send afterwards.
let generation = 0;
let queue: { event: string; properties: Props; timestamp: string }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;
// Most events we hold while waiting for the profile. If it never loads (storage broken), the
// queue would otherwise grow for the whole session. Oldest go first: the latest are the most useful.
export const MAX_QUEUE = 100;

async function getId(): Promise<string> {
  if (distinctId) return distinctId;
  try {
    distinctId = await AsyncStorage.getItem(ID_KEY);
  } catch {}
  if (!distinctId) {
    distinctId = `anon_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    try {
      await AsyncStorage.setItem(ID_KEY, distinctId);
    } catch {}
  }
  return distinctId;
}

function clearTimer() {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
}

function schedule() {
  if (!decided) return; // wait for the profile; setAnalyticsEnabled(true) schedules it
  if (queue.length >= 10) flush();
  else if (!timer) timer = setTimeout(flush, 8000);
}

async function flush() {
  timer = null;
  if (!KEY || !enabled || !decided || !queue.length) return;
  const batch = queue;
  queue = [];
  const startedIn = generation;
  const id = await getId();
  // The reader may have opted out, or reset everything, while the id was loading.
  if (!enabled || startedIn !== generation) return;
  try {
    await fetch(`${HOST}/batch/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: KEY,
        batch: batch.map((e) => ({ ...e, properties: { ...e.properties, distinct_id: id, $os: Platform.OS } })),
      }),
    });
  } catch {
    // Offline: drop it. Analytics must never break the app.
  }
}

export function track(event: EventName, properties: Props = {}) {
  if (!KEY || !enabled) return;
  queue.push({ event, properties: sanitise(properties), timestamp: new Date().toISOString() });
  if (queue.length > MAX_QUEUE) queue = queue.slice(-MAX_QUEUE);
  schedule();
}

/** True when this build has a PostHog key, so there is something to opt out of. */
export const analyticsEnabled = !!KEY;

/**
 * Turns sending on or off. Off also drops anything queued but not yet sent, so events
 * from before the reader opted out never leave the phone. The first call also lets events
 * queued at launch go out (when on).
 */
export function setAnalyticsEnabled(on: boolean) {
  enabled = on;
  decided = true;
  if (on) {
    if (queue.length) schedule();
    return;
  }
  queue = [];
  clearTimer();
}

/**
 * Reset all data: forget the anonymous id (the next event makes a new one, like a fresh
 * install) and drop anything queued. Call it after storage is cleared.
 */
export async function resetAnalytics(): Promise<void> {
  generation++;
  distinctId = null;
  queue = [];
  clearTimer();
  try {
    await AsyncStorage.removeItem(ID_KEY); // in case clearing storage failed
  } catch {}
}
