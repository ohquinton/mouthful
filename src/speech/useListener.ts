import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { recordingsFolderUri } from '../store/recordings';
import { speechLocale, speechLocaleLabel } from '../engine/locale';
import { ANDROID_ON_DEVICE_MIN_API, endAction, localeSupport, startGate, type LocaleSupport } from './gate';

export type ListenerState =
  | 'idle'
  | 'asking'
  | 'denied'
  | 'unavailable'
  | 'needs-consent' // phone can't transcribe offline and the user hasn't agreed to the server service yet
  | 'listening'
  | 'stopped'
  | 'error'; // see `error` (the message to show) and `errorCode`

/**
 * Why the listener is in 'error', for screens that want to offer a way out.
 * 'language-not-supported': this phone can't listen for the chosen English; `error` says
 * "This phone can’t listen for X English. Pick another in You." Never preceded by a consent ask.
 */
export type ListenerErrorCode = 'language-not-supported' | 'restart-failed';

type Options = {
  /** User agreed to use the platform's server recognition when on-device isn't supported. */
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
 * - Keeps finished segments plus the live (interim) segment as one transcript.
 * - Restarts quietly if iOS ends recognition mid-session (silence, ~1 min limits).
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
  const consented = useRef(false); // the reader's yes to server recognition, as of the last start()
  const pausedForConsent = useRef(false); // a restart stopped mid-session to ask; keep the transcript
  const recordingsRef = useRef<string[]>([]);
  const endWaiters = useRef<((uris: string[]) => void)[]>([]);

  const publish = () => setTranscript(`${finalText.current} ${interim.current}`.trim());
  const serverAllowed = () => consented.current || optsRef.current.allowServer === true;
  const fail = (code: ListenerErrorCode, message: string) => {
    wanted.current = false;
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

  useSpeechRecognitionEvent('start', () => setState('listening'));

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
    setLastHeardAt(Date.now());
    publish();
  });

  useSpeechRecognitionEvent('end', () => {
    optsRef.current.onLevel?.(0);
    // Keep whatever was mid-flight when the recogniser stopped.
    if (interim.current) {
      finalText.current = `${finalText.current} ${interim.current}`.trim();
      interim.current = '';
      publish();
    }
    const onDevice = wanted.current && onDeviceSupported(optsRef.current.lang ?? 'en-US');
    const next = endAction({ wanted: wanted.current, onDevice, allowServer: serverAllowed() });
    if (next === 'restart') {
      try {
        startNative(onDevice);
      } catch {
        fail('restart-failed', 'The phone stopped listening. Try again.');
      }
    } else if (next === 'needs-consent') {
      // On-device went away between sessions. Don't switch to the server without a yes.
      wanted.current = false;
      pausedForConsent.current = true;
      setState('needs-consent');
    } else {
      // An error (e.g. language-not-supported) is followed by 'end'; keep showing the error.
      setState((s) => (s === 'error' ? s : 'stopped'));
      const waiters = endWaiters.current;
      endWaiters.current = [];
      waiters.forEach((w) => w(recordingsRef.current));
    }
  });

  useSpeechRecognitionEvent('error', (e) => {
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      wanted.current = false;
      setState('denied');
      return;
    }
    // "no-speech" and "aborted" are routine; the end handler restarts if needed.
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    if (e.error === 'language-not-supported') {
      fail('language-not-supported', languageNotSupportedMessage(optsRef.current.lang ?? 'en-US'));
      return;
    }
    setError(e.message || e.error);
  });

  /**
   * Starts listening, or lands in a state the screen renders instead:
   * 'unavailable', 'needs-consent' (show MicGate), 'denied', or 'error' with
   * errorCode 'language-not-supported' (never asks for consent first).
   * After a mid-session 'needs-consent', starting again keeps the transcript so far.
   */
  const start = useCallback(async (override?: { allowServer?: boolean }) => {
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setState('unavailable');
      return;
    }
    const lang = optsRef.current.lang ?? 'en-US';
    const allowServer = override?.allowServer ?? optsRef.current.allowServer ?? false;
    const onDevice = onDeviceSupported(lang);
    const locale: LocaleSupport = onDevice ? 'supported' : await checkLocale(lang);
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
    consented.current = allowServer;
    setError(null);
    setErrorCode(null);
    wanted.current = true;
    setLastHeardAt(Date.now());
    startNative(onDevice);
  }, [startNative]);

  /** Forget the last attempt straight away, so a retry starts from a clean page. */
  const reset = useCallback(() => {
    finalText.current = '';
    interim.current = '';
    pausedForConsent.current = false;
    setTranscript('');
    setRecordings([]);
    recordingsRef.current = [];
    setError(null);
    setErrorCode(null);
  }, []);

  /** Stops listening. Resolves with any saved recordings once the recogniser has finished (max 1.5 s). */
  const stop = useCallback((): Promise<string[]> => {
    wanted.current = false;
    const done = new Promise<string[]>((resolve) => {
      endWaiters.current.push(resolve);
      setTimeout(() => resolve(recordingsRef.current), 1500);
    });
    try {
      ExpoSpeechRecognitionModule.stop();
    } catch {}
    return done;
  }, []);

  useEffect(
    () => () => {
      wanted.current = false;
      ExpoSpeechRecognitionModule.abort();
    },
    [],
  );

  return { state, transcript, error, errorCode, lastHeardAt, recordings, start, stop, reset };
}

/** The words for the consent screen, per platform. */
export function serverServiceName(): string {
  return Platform.OS === 'ios' ? 'Apple’s speech service' : Platform.OS === 'android' ? 'Google’s speech service' : 'your browser’s speech service';
}
