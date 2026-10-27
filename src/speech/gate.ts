// The rules that decide whether the recogniser may start, and where audio may go.
// Pure, with no native imports, so they're unit tested (engine/__tests__/listener.test.ts).
// useListener is thin wiring around these.

/** Whether the platform recogniser can listen for a locale. `unknown` means it gave no list. */
export type LocaleSupport = 'supported' | 'unsupported' | 'unknown';

const norm = (tag: string) => tag.replace(/_/g, '-').toLowerCase();

/**
 * Looks the locale up in what `getSupportedLocales()` returned. An empty list isn't a "no":
 * Android 12 and below, Android without an on-device service, and web all return [] whatever
 * they support.
 */
export function localeSupport(lang: string, locales: readonly string[] | undefined): LocaleSupport {
  if (!locales || locales.length === 0) return 'unknown';
  const want = norm(lang);
  return locales.some((l) => norm(l) === want) ? 'supported' : 'unsupported';
}

export type StartGate = 'start' | 'needs-consent' | 'language-not-supported';

/**
 * Before listening. A variety the phone can't listen for is reported before consent is asked,
 * because saying yes wouldn't help. Server recognition needs the reader's yes.
 */
export function startGate(o: { onDevice: boolean; allowServer: boolean; locale: LocaleSupport }): StartGate {
  if (o.onDevice) return 'start';
  if (o.locale === 'unsupported') return 'language-not-supported';
  return o.allowServer ? 'start' : 'needs-consent';
}

export type EndAction = 'restart' | 'needs-consent' | 'stopped';

/**
 * When the recogniser ends (iOS ends sessions on silence and time limits). A restart re-checks
 * on-device support, so if that went away it must not quietly switch to the server.
 */
export function endAction(o: { wanted: boolean; onDevice: boolean; allowServer: boolean }): EndAction {
  if (!o.wanted) return 'stopped';
  return o.onDevice || o.allowServer ? 'restart' : 'needs-consent';
}

/**
 * Android: the platform says on-device is available from API 31, but expo-speech-recognition
 * 58.0.0 only builds an on-device recogniser from API 33 (ExpoSpeechService.kt
 * `createSpeechRecognizer`). Below that it uses the network recogniser with
 * EXTRA_PREFER_OFFLINE, which is only a hint, so audio may leave the phone.
 */
export const ANDROID_ON_DEVICE_MIN_API = 33;
