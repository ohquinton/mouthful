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
  | 'paywall_view'
  | 'purchase_attempt'
  | 'purchase_result'
  | 'recording_played'
  | 'recordings_deleted'
  | 'session_retry';

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
let queue: { event: string; properties: Props; timestamp: string }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

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

async function flush() {
  timer = null;
  if (!KEY || !queue.length) return;
  const batch = queue;
  queue = [];
  const id = await getId();
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
  if (!KEY) return;
  queue.push({ event, properties: sanitise(properties), timestamp: new Date().toISOString() });
  if (queue.length >= 10) flush();
  else if (!timer) timer = setTimeout(flush, 8000);
}

export const analyticsEnabled = !!KEY;
