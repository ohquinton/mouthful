// The rules that decide whether the recogniser may start, and where audio may go.
// Pure, with no native imports, so they're unit tested (engine/__tests__/listener.test.ts).
// useListener is thin wiring around these.

export type ListenerState =
  | 'idle'
  | 'asking'
  | 'denied'
  | 'unavailable'
  | 'needs-consent' // phone can't transcribe offline and the user hasn't agreed to the server service yet
  | 'listening'
  | 'stopped'
  | 'error'; // listening has stopped for good; see `error` (the message to show) and `errorCode`

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

/**
 * Server recognition is allowed when the profile allows it now (so turning it off in You takes
 * effect at the next restart), or when the reader said yes in MicGate for this session
 * (start({ allowServer: true })). That yes covers this session's restarts only, so it still
 * works if the profile write hasn't landed yet, and never outlives a stop.
 */
export function serverAllowed(o: { profile: boolean | undefined; sessionGrant: boolean }): boolean {
  return o.profile === true || o.sessionGrant;
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

/**
 * What a recogniser error means for the session:
 * - 'ignore': silence or our own stop/abort. The end handler restarts as usual.
 * - 'denied': no permission. Listening stops; screens show the denied state.
 * - 'fatal': restarting can't help (no such language; a call, Siri or another app has the
 *   audio session, which iOS also reports when the app is backgrounded). State 'error'.
 * - 'recoverable': a glitch the next restart usually fixes (iOS audio route change when
 *   AirPods connect, network 1101/1107, Android busy/client). Not shown, unless it keeps
 *   happening with nothing heard (noteHiccup).
 */
export type ErrorKind = 'ignore' | 'denied' | 'fatal' | 'recoverable';

export function classifyError(code: string): ErrorKind {
  switch (code) {
    case 'aborted':
    case 'no-speech':
    case 'speech-timeout':
      return 'ignore';
    case 'not-allowed':
    case 'service-not-allowed':
      return 'denied';
    case 'language-not-supported':
    case 'interrupted':
    case 'bad-grammar':
      return 'fatal';
    default:
      return 'recoverable';
  }
}

/** Recoverable errors within HICCUP_WINDOW_MS, with nothing heard between them, before giving up. */
export const HICCUP_LIMIT = 3;
export const HICCUP_WINDOW_MS = 10_000;

/**
 * Records a recoverable error. `recent` holds the times of earlier ones since the last result
 * (a result empties it). Gives up at HICCUP_LIMIT inside the window, so a reader whose mic or
 * connection has really gone isn't left looking at "listening" while nothing is heard.
 */
export function noteHiccup(recent: readonly number[], now: number): { recent: number[]; giveUp: boolean } {
  const kept = [...recent.filter((t) => now - t < HICCUP_WINDOW_MS), now];
  return { recent: kept, giveUp: kept.length >= HICCUP_LIMIT };
}

/** After a glitch, wait a moment before restarting ('busy' means the last session hasn't let go yet). */
export function restartDelayMs(recentHiccups: number): number {
  return Math.min(recentHiccups, HICCUP_LIMIT) * 250;
}

/**
 * Whether "Carry on" (useListener's resume()) makes sense after a session ended with this
 * error code. A call, Siri, a lost connection or a mic that stopped may come back, so the read
 * so far is worth keeping. A variety the phone can't listen for won't, so that only offers
 * Try again (after picking another English).
 */
export function canResumeAfter(code: string | null | undefined): boolean {
  return code === 'interrupted' || code === 'repeated-failure' || code === 'network' || code === 'restart-failed';
}

/**
 * The key a recogniser error is counted under in tester diagnostics. The library's codes are
 * short kebab-case words ('network', 'audio-capture'); anything else could carry native text,
 * so it's counted as 'other'. Diagnostics never hold words.
 */
export function diagnosticCode(code: unknown): string {
  return typeof code === 'string' && /^[a-z][a-z-]{0,31}$/.test(code) ? code : 'other';
}

/** The state once the recogniser has ended and won't restart: never hide why it stopped. */
export function stateAfterEnd(current: ListenerState): ListenerState {
  switch (current) {
    case 'error':
    case 'denied':
    case 'needs-consent':
    case 'unavailable':
      return current;
    default:
      return 'stopped';
  }
}
