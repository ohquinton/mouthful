/**
 * useListener: the recogniser wrapper every listening screen uses.
 *
 * Error contract (screens rely on this):
 * - Show the "stopped listening" card iff `state === 'error'`. `error` (the message) and
 *   `errorCode` are non-null exactly then, and listening has stopped for good: nothing restarts
 *   until the screen calls start() again, which clears them.
 * - Routine recogniser glitches (iOS audio route change when AirPods connect, network
 *   1101/1107, Android busy/client/speech-timeout, silence) are never surfaced. The hook
 *   restarts quietly and the read carries on. If HICCUP_LIMIT of them arrive within
 *   HICCUP_WINDOW_MS with nothing heard in between, it gives up: 'error' / 'repeated-failure'.
 * - 'denied', 'needs-consent' and 'unavailable' are their own states, not errors, and an
 *   `end` event never overwrites them (or 'error') with 'stopped'.
 * The rules live in ./gate.ts and are unit tested; this file is the wiring.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { recordingsFolderUri } from '../store/recordings';
import { speechLocale, speechLocaleLabel } from '../engine/locale';
import {
  ANDROID_ON_DEVICE_MIN_API,
  classifyError,
  endAction,
  localeSupport,
  noteHiccup,
  restartDelayMs,
  serverAllowed,
  startGate,
  stateAfterEnd,
  type ListenerState,
  type LocaleSupport,
} from './gate';

export type { ListenerState };

/**
 * Why the listener is in 'error', for screens that want to offer a way out.
 * - 'language-not-supported': this phone can't listen for the chosen English; `error` says
 *   "This phone can’t listen for X English. Pick another in You." Never preceded by a consent ask.
 * - 'interrupted': a call, Siri, an alarm or leaving the app took the audio session.
 * - 'repeated-failure': routine glitches kept coming with nothing heard (mic or connection gone).
 * - 'restart-failed': the native start threw when restarting mid-session.
 */
export type ListenerErrorCode = 'language-not-supported' | 'interrupted' | 'repeated-failure' | 'restart-failed';

type Options = {
  /** The profile's answer: may audio go to the platform's server recognition? Read live. */
  allowServer?: boolean;
  /** Save this session's audio to the phone (Day 1 and re-tests only, with consent). */
  record?: boolean;
  /** Emit a 0–1 voice level for the voice ribbon. */
  onLevel?: (level: number) => void;
  /** Which English to listen for, e.g. "en-IN". See engine/locale.ts. */
  lang?: string;
};

/** The phone's locale, e.g. "en-CA". Hermes and browsers both expose it through Intl. */
function deviceLocale(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().locale;
  } catch {
    return undefined;
  }
}

/** The English variety to listen for: the reader's choice in You, else the phone's region. */
export function listenLocale(chosen?: string): string {
  return speechLocale(chosen, deviceLocale());
}

/**
 * True when speech in this locale never leaves the device. On iOS each locale is checked on
 * its own (patches/expo-speech-recognition): asking for on-device in a locale that can't do it
 * would silently fall back to Apple's servers. Android's check takes no locale, and only
 * counts from Android 13 (see ANDROID_ON_DEVICE_MIN_API).
 */
export function onDeviceSupported(lang = 'en-US'): boolean {
  try {
    if (Platform.OS === 'ios') return ExpoSpeechRecognitionModule.supportsOnDeviceRecognition(lang);
    if (Platform.OS === 'android') {
      return Number(Platform.Version) >= ANDROID_ON_DEVICE_MIN_API && ExpoSpeechRecognitionModule.supportsOnDeviceRecognition();
    }
    return false;
  } catch {
    return false;
  }
}

/** The message for a variety the phone can't listen for. */
export function languageNotSupportedMessage(lang: string): string {
  return `This phone can’t listen for ${speechLocaleLabel(lang)} English. Pick another in You.`;
}

const INTERRUPTED_MESSAGE = 'Listening stopped when something else used the mic. Try again.';
const STOPPED_MESSAGE = 'The phone stopped listening. Try again.';
const NETWORK_MESSAGE = 'Lost the connection to the speech service. Check your connection and try again.';

/**
 * Whether the recogniser can listen for `lang` at all. Only iOS gives a list we can trust:
 * it's the same `SFSpeechRecognizer.supportedLocales()` the library checks before starting.
 * Android's list comes from the on-device service, not the network one we'd fall back to,
 * so a missing locale there doesn't prove the network recogniser lacks it: 'unknown'.
 */
async function checkLocale(lang: string): Promise<LocaleSupport> {
  if (Platform.OS !== 'ios') return 'unknown';
  try {
    const { locales } = await ExpoSpeechRecognitionModule.getSupportedLocales({});
    return localeSupport(lang, locales);
  } catch {
    return 'unknown';
  }
}

/**
 * Wraps the native recogniser for a session.
 * - Privacy: uses on-device recognition when the phone supports it. If it doesn't, it stops
 *   and reports `needs-consent` until the user agrees to the platform's server service.
 *   Consent is re-read at every restart (see serverAllowed in gate.ts).
 * - Keeps finished segments plus the live (interim) segment as one transcript.
 * - Restarts quietly if iOS ends recognition mid-session (silence, ~1 min limits) or after a
 *   routine glitch. See the error contract at the top of this file.
 */
export function useListener(hints: string[], opts: Options = {}) {
  const [state, setState] = useState<ListenerState>('idle');
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<ListenerErrorCode | null>(null);
  const [lastHeardAt, setLastHeardAt] = useState(0);
  const [recordings, setRecordings] = useState<string[]>([]);

  const finalText = useRef('');
  const interim = useRef('');
  const wanted = useRef(false); // true while the session should keep listening
  const optsRef = useRef(opts);
  // Before any effect or event handler can call start(), so they always see this render's opts.
  useLayoutEffect(() => {
    optsRef.current = opts;
  });
  const sessionGrant = useRef(false); // MicGate's yes, for this session's restarts only
  const pausedForConsent = useRef(false); // a restart stopped mid-session to ask; keep the transcript
  const recordingsRef = useRef<string[]>([]);
  const endWaiters = useRef<((uris: string[]) => void)[]>([]);
  const unmounted = useRef(false);
  const generation = useRef(0); // bumped by start/stop/unmount; a start() whose turn has passed bails
  const hiccups = useRef<number[]>([]); // recoverable errors since the last result
  const restartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const publish = () => setTranscript(`${finalText.current} ${interim.current}`.trim());
  const consentNow = () => serverAllowed({ profile: optsRef.current.allowServer, sessionGrant: sessionGrant.current });
  const cancelRestart = () => {
    if (restartTimer.current) clearTimeout(restartTimer.current);
    restartTimer.current = null;
  };
  /** Ends the session for good and shows the error card. */
  const fail = (code: ListenerErrorCode, message: string) => {
    wanted.current = false;
    sessionGrant.current = false;
    cancelRestart();
    setErrorCode(code);
    setError(message);
    setState('error');
  };

  const startNative = useCallback((onDevice: boolean) => {
    const lang = optsRef.current.lang ?? 'en-US';
    let canRecord = false;
    try {
      canRecord = !!optsRef.current.record && Platform.OS !== 'web' && ExpoSpeechRecognitionModule.supportsRecording();
    } catch {}
    const folderUri = canRecord ? recordingsFolderUri() : undefined;
    ExpoSpeechRecognitionModule.start({
      lang,
      interimResults: true,
      continuous: true,
      maxAlternatives: 1,
      addsPunctuation: false,
      requiresOnDeviceRecognition: onDevice,
      contextualStrings: hints.slice(0, 50),
      iosTaskHint: 'dictation',
      volumeChangeEventOptions: { enabled: !!optsRef.current.onLevel, intervalMillis: 120 },
      recordingOptions: canRecord && folderUri ? { persist: true, outputDirectory: folderUri } : undefined,
    });
  }, [hints]);

  useSpeechRecognitionEvent('start', () => {
    if (wanted.current) setState('listening');
  });

  useSpeechRecognitionEvent('volumechange', (e) => {
    // -2..10 from the recogniser; below 0 is silence. Map to 0..1.
    const level = Math.max(0, Math.min(1, e.value / 10));
    optsRef.current.onLevel?.(level);
  });

  useSpeechRecognitionEvent('audioend', (e) => {
    if (e.uri) {
      recordingsRef.current = [...recordingsRef.current, e.uri];
      setRecordings(recordingsRef.current);
    }
  });

  useSpeechRecognitionEvent('result', (e) => {
    const text = e.results[0]?.transcript ?? '';
    if (e.isFinal) {
      finalText.current = `${finalText.current} ${text}`.trim();
      interim.current = '';
    } else {
      interim.current = text;
    }
    hiccups.current = []; // something was heard, so the recogniser is working
    setLastHeardAt(Date.now());
    publish();
  });

  /** Restart mid-session, re-checking on-device support and consent. */
  const restart = useCallback(() => {
    restartTimer.current = null;
    if (!wanted.current || unmounted.current) return;
    const onDevice = onDeviceSupported(optsRef.current.lang ?? 'en-US');
    const next = endAction({ wanted: true, onDevice, allowServer: consentNow() });
    if (next === 'needs-consent') {
      // On-device went away, or consent was withdrawn. Don't use the server without a yes.
      wanted.current = false;
      sessionGrant.current = false;
      pausedForConsent.current = true;
      setState('needs-consent');
      return;
    }
    try {
      startNative(onDevice);
    } catch {
      fail('restart-failed', STOPPED_MESSAGE);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- consentNow and fail only read refs and stable setters
  }, [startNative]);

  useSpeechRecognitionEvent('end', () => {
    optsRef.current.onLevel?.(0);
    // Keep whatever was mid-flight when the recogniser stopped.
    if (interim.current) {
      finalText.current = `${finalText.current} ${interim.current}`.trim();
      interim.current = '';
      publish();
    }
    if (wanted.current && !unmounted.current) {
      cancelRestart();
      const delay = restartDelayMs(hiccups.current.length);
      if (delay === 0) restart();
      else restartTimer.current = setTimeout(restart, delay);
      return;
    }
    sessionGrant.current = false;
    setState(stateAfterEnd);
    const waiters = endWaiters.current;
    endWaiters.current = [];
    waiters.forEach((w) => w(recordingsRef.current));
  });

  useSpeechRecognitionEvent('error', (e) => {
    const kind = classifyError(e.error);
    if (kind === 'ignore') return; // the end handler restarts if needed
    if (kind === 'denied') {
      wanted.current = false;
      sessionGrant.current = false;
      cancelRestart();
      setState('denied');
      return;
    }
    if (kind === 'fatal') {
      if (e.error === 'language-not-supported') {
        fail('language-not-supported', languageNotSupportedMessage(optsRef.current.lang ?? 'en-US'));
      } else if (e.error === 'interrupted') {
        fail('interrupted', INTERRUPTED_MESSAGE);
      } else {
        fail('restart-failed', STOPPED_MESSAGE);
      }
      return;
    }
    // Recoverable: say nothing, let the end handler restart, unless it keeps happening.
    if (!wanted.current) return;
    const { recent, giveUp } = noteHiccup(hiccups.current, Date.now());
    hiccups.current = recent;
    if (giveUp) fail('repeated-failure', e.error === 'network' ? NETWORK_MESSAGE : STOPPED_MESSAGE);
  });

  /**
   * Starts listening, or lands in a state the screen renders instead:
   * 'unavailable', 'needs-consent' (show MicGate), 'denied', or 'error' with
   * errorCode 'language-not-supported' (never asks for consent first).
   * `{ allowServer: true }` is MicGate's yes: it lasts through this session's restarts only.
   * After a mid-session 'needs-consent', starting again keeps the transcript so far.
   * If the screen closes or stop() is called while this waits (permission prompt, locale
   * check), it gives up without turning the mic on.
   */
  const start = useCallback(async (override?: { allowServer?: boolean }) => {
    const turn = ++generation.current;
    const stale = () => unmounted.current || turn !== generation.current;
    cancelRestart();
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setState('unavailable');
      return;
    }
    const lang = optsRef.current.lang ?? 'en-US';
    const grant = override?.allowServer === true;
    const allowServer = serverAllowed({ profile: optsRef.current.allowServer, sessionGrant: grant });
    const onDevice = onDeviceSupported(lang);
    const locale: LocaleSupport = onDevice ? 'supported' : await checkLocale(lang);
    if (stale()) return;
    const gate = startGate({ onDevice, allowServer, locale });
    if (gate === 'language-not-supported') {
      fail('language-not-supported', languageNotSupportedMessage(lang));
      return;
    }
    if (gate === 'needs-consent') {
      setState('needs-consent');
      return;
    }
    setState('asking');
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (stale()) return;
    if (!perm.granted) {
      setState('denied');
      return;
    }
    if (!pausedForConsent.current) {
      finalText.current = '';
      interim.current = '';
      setTranscript('');
      setRecordings([]);
      recordingsRef.current = [];
    }
    pausedForConsent.current = false;
    sessionGrant.current = grant;
    hiccups.current = [];
    setError(null);
    setErrorCode(null);
    wanted.current = true;
    setLastHeardAt(Date.now());
    startNative(onDevice);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fail and cancelRestart only touch refs and stable setters
  }, [startNative]);

  /** Forget the last attempt straight away, so a retry starts from a clean page. */
  const reset = useCallback(() => {
    finalText.current = '';
    interim.current = '';
    pausedForConsent.current = false;
    hiccups.current = [];
    setTranscript('');
    setRecordings([]);
    recordingsRef.current = [];
    setError(null);
    setErrorCode(null);
  }, []);

  /** Stops listening. Resolves with any saved recordings once the recogniser has finished (max 1.5 s). */
  const stop = useCallback((): Promise<string[]> => {
    generation.current++; // a start() still waiting on a prompt must not turn the mic on
    wanted.current = false;
    sessionGrant.current = false;
    cancelRestart();
    const done = new Promise<string[]>((resolve) => {
      endWaiters.current.push(resolve);
      setTimeout(() => resolve(recordingsRef.current), 1500);
    });
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {}
    return done;
  }, []);

  useEffect(() => {
    unmounted.current = false; // strict mode mounts twice
    return () => {
      unmounted.current = true;
      wanted.current = false;
      sessionGrant.current = false;
      if (restartTimer.current) clearTimeout(restartTimer.current);
      restartTimer.current = null;
      ExpoSpeechRecognitionModule.abort();
    };
  }, []);

  return { state, transcript, error, errorCode, lastHeardAt, recordings, start, stop, reset };
}

/** The words for the consent screen, per platform. */
export function serverServiceName(): string {
  return Platform.OS === 'ios' ? 'Apple’s speech service' : Platform.OS === 'android' ? 'Google’s speech service' : 'your browser’s speech service';
}
