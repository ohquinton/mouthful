/**
 * useListener: the recogniser wrapper every listening screen uses.
 *
 * Error contract (screens rely on this):
 * - Show the "stopped listening" card iff `state === 'error'`. `error` (the message) and
 *   `errorCode` are non-null exactly then, and listening has stopped: nothing restarts until
 *   the screen calls start() (Try again: a fresh read) or resume() (Carry on), which clear them.
 * - `canResume` is true only in 'error' with a code that may come back ('interrupted',
 *   'repeated-failure', 'network', 'restart-failed'; see canResumeAfter in gate.ts), never for
 *   'language-not-supported'. resume() restarts listening and KEEPS the transcript and
 *   recordings so far. It goes through the same gate as start(): on-device check, locale check,
 *   consent (profile, or a new MicGate yes: the earlier session grant ended with the error), mic
 *   permission. So it can land in 'needs-consent'; MicGate's start({ allowServer: true }) then
 *   still keeps the read. It does nothing after unmount or when canResume is false.
 * - Routine recogniser glitches (iOS audio route change when AirPods connect, network
 *   1101/1107, Android busy/client/speech-timeout, silence) are never surfaced. The hook
 *   restarts quietly and the read carries on. If HICCUP_LIMIT of them arrive within
 *   HICCUP_WINDOW_MS with nothing heard in between, it gives up: 'error' with 'network' if the
 *   last one was the connection, else 'repeated-failure'.
 * - 'denied', 'needs-consent' and 'unavailable' are their own states, not errors, and an
 *   `end` event never overwrites them (or 'error') with 'stopped'.
 * - getDiagnostics() (tester mode): quiet restarts and recoverable error codes for this attempt,
 *   counts only. Kept across resume(), zeroed by reset() and by a fresh start().
 * The rules live in ./gate.ts and are unit tested; this file is the wiring.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { recordingsFolderUri } from '../store/recordings';
import { speechLocale, speechLocaleLabel } from '../engine/locale';
import {
  ANDROID_ON_DEVICE_MIN_API,
  HICCUP_LIMIT,
  canResumeAfter,
  classifyError,
  diagnosticCode,
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
 *   "This phone can’t listen for X English. Choose a different English in the You tab."
 *   Never preceded by a consent ask. The only code without Carry on.
 * - 'interrupted': a call, Siri, an alarm or leaving the app took the audio session.
 * - 'network': routine glitches kept coming with nothing heard, and the last was the connection.
 * - 'repeated-failure': the same, for anything else (mic covered or gone, headphones).
 * - 'restart-failed': the native start threw when restarting mid-session.
 */
export type ListenerErrorCode = 'language-not-supported' | 'interrupted' | 'network' | 'repeated-failure' | 'restart-failed';

/** Tester-mode counts for one attempt. Codes and numbers only, never words. */
export type ListenerDiagnostics = {
  /** Quiet restarts that turned the mic back on (iOS session ends, glitches). */
  restarts: number;
  /** Recoverable recogniser errors by library code ('network', 'audio-capture', …; else 'other'). */
  glitches: Record<string, number>;
};

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
  return `This phone can’t listen for ${speechLocaleLabel(lang)} English. Choose a different English in the You tab.`;
}

const INTERRUPTED_MESSAGE = 'Listening stopped when something else used the mic. Try again.';
const STOPPED_MESSAGE = 'The phone stopped listening. Tap Carry on to pick up where you were.';
const REPEATED_MESSAGE = `It tried ${HICCUP_LIMIT} times and didn’t catch any words. Check nothing is covering the mic, or switch off headphones, then try again.`;
const NETWORK_MESSAGE = 'The speech service couldn’t be reached. When you’re back online, tap Try again.';

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
  // The next start() continues this read (transcript, recordings, diagnostics) instead of
  // starting fresh: set when a restart stopped mid-session to ask for consent, or by resume().
  const keepRead = useRef(false);
  const errorCodeRef = useRef<ListenerErrorCode | null>(null); // errorCode, for callbacks
  const diagnostics = useRef<ListenerDiagnostics>({ restarts: 0, glitches: {} });
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
  const setFailure = (code: ListenerErrorCode | null, message: string | null) => {
    errorCodeRef.current = code;
    setErrorCode(code);
    setError(message);
  };
  /** Stops the session and shows the error card. Only resume() continues this read. */
  const fail = (code: ListenerErrorCode, message: string) => {
    wanted.current = false;
    sessionGrant.current = false;
    keepRead.current = false; // a plain start() (Try again) after an error is a fresh read
    cancelRestart();
    setFailure(code, message);
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
      keepRead.current = true;
      setState('needs-consent');
      return;
    }
    try {
      startNative(onDevice);
      diagnostics.current.restarts++;
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
    const key = diagnosticCode(e.error);
    const glitches = diagnostics.current.glitches;
    glitches[key] = (glitches[key] ?? 0) + 1;
    const { recent, giveUp } = noteHiccup(hiccups.current, Date.now());
    hiccups.current = recent;
    if (giveUp) {
      if (e.error === 'network') fail('network', NETWORK_MESSAGE);
      else fail('repeated-failure', REPEATED_MESSAGE);
    }
  });

  /**
   * Starts listening, or lands in a state the screen renders instead:
   * 'unavailable', 'needs-consent' (show MicGate), 'denied', or 'error' with
   * errorCode 'language-not-supported' (never asks for consent first).
   * `{ allowServer: true }` is MicGate's yes: it lasts through this session's restarts only.
   * After a mid-session 'needs-consent' or a resume(), starting again keeps the read so far;
   * otherwise (including Try again after an error) it starts fresh.
   * If the screen closes or stop() is called while this waits (permission prompt, locale
   * check), it gives up without turning the mic on.
   */
  const start = useCallback(async (override?: { allowServer?: boolean }) => {
    const turn = ++generation.current;
    const stale = () => unmounted.current || turn !== generation.current;
    cancelRestart();
    // Each way out of 'error' below clears the message with it, so the card shows iff 'error'.
    const leave = (next: ListenerState) => {
      setFailure(null, null);
      setState(next);
    };
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      leave('unavailable');
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
      leave('needs-consent');
      return;
    }
    leave('asking');
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (stale()) return;
    if (!perm.granted) {
      setState('denied');
      return;
    }
    if (keepRead.current) {
      // Words still interim when listening stopped are part of the read: don't let the next
      // interim result replace them.
      finalText.current = `${finalText.current} ${interim.current}`.trim();
      interim.current = '';
    } else {
      finalText.current = '';
      interim.current = '';
      setTranscript('');
      setRecordings([]);
      recordingsRef.current = [];
      diagnostics.current = { restarts: 0, glitches: {} };
    }
    keepRead.current = false;
    sessionGrant.current = grant;
    hiccups.current = [];
    wanted.current = true;
    setLastHeardAt(Date.now());
    startNative(onDevice);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fail and cancelRestart only touch refs and stable setters
  }, [startNative]);

  /**
   * Carry on after an error that may come back (canResume): listens again and keeps the
   * transcript and recordings so far. Same gate as start(), so it can land in 'needs-consent'
   * (MicGate's yes then continues the read), 'denied', or 'error' again. No-op otherwise.
   */
  const resume = useCallback(async () => {
    if (unmounted.current || !canResumeAfter(errorCodeRef.current)) return;
    keepRead.current = true;
    await start();
  }, [start]);

  /** Forget the last attempt straight away, so a retry starts from a clean page. */
  const reset = useCallback(() => {
    finalText.current = '';
    interim.current = '';
    keepRead.current = false;
    hiccups.current = [];
    diagnostics.current = { restarts: 0, glitches: {} };
    setTranscript('');
    setRecordings([]);
    recordingsRef.current = [];
    setFailure(null, null);
  }, []);

  /** A copy of this attempt's counts, for tester mode to save with the session. */
  const getDiagnostics = useCallback(
    (): ListenerDiagnostics => ({ restarts: diagnostics.current.restarts, glitches: { ...diagnostics.current.glitches } }),
    [],
  );

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

  const canResume = state === 'error' && canResumeAfter(errorCode);

  return { state, transcript, error, errorCode, canResume, lastHeardAt, recordings, start, resume, stop, reset, getDiagnostics };
}

/** The words for the consent screen, per platform. */
export function serverServiceName(): string {
  return Platform.OS === 'ios' ? 'Apple’s speech service' : Platform.OS === 'android' ? 'Google’s speech service' : 'your browser’s speech service';
}
