// Privacy and consent decisions for the recogniser. The hook (speech/useListener) is thin
// wiring around these, so the rules that keep audio on the phone are tested here.
import { Platform } from 'react-native';
import {
  HICCUP_LIMIT,
  HICCUP_WINDOW_MS,
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
} from '../../speech/gate';

const libOnDevice = jest.fn((_lang?: string) => true);
jest.mock('expo-speech-recognition', () => ({
  ExpoSpeechRecognitionModule: { supportsOnDeviceRecognition: (lang?: string) => libOnDevice(lang) },
  useSpeechRecognitionEvent: () => {},
}));
jest.mock('../../store/recordings', () => ({ recordingsFolderUri: () => 'file:///recordings/' }));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { onDeviceSupported } = require('../../speech/useListener') as typeof import('../../speech/useListener');

function onPlatform(os: string, version?: number) {
  Object.assign(Platform, { OS: os, Version: version });
}

describe('on-device recognition: only claim it when audio really stays on the phone', () => {
  afterEach(() => onPlatform('ios'));

  it('trusts Android 13 and later, where the library builds a real on-device recogniser', () => {
    onPlatform('android', 33);
    expect(onDeviceSupported('en-IN')).toBe(true);
    onPlatform('android', 35);
    expect(onDeviceSupported('en-IN')).toBe(true);
  });

  it('says no on Android 12 and 12L, where the library falls back to the network recogniser', () => {
    // Android reports on-device available from API 31, but expo-speech-recognition only calls
    // createOnDeviceSpeechRecognizer from API 33; below that, EXTRA_PREFER_OFFLINE is just a hint.
    onPlatform('android', 31);
    expect(onDeviceSupported('en-US')).toBe(false);
    onPlatform('android', 32);
    expect(onDeviceSupported('en-US')).toBe(false);
  });

  it('still says no on new Android when the phone has no on-device recogniser', () => {
    onPlatform('android', 34);
    libOnDevice.mockReturnValueOnce(false);
    expect(onDeviceSupported('en-US')).toBe(false);
  });

  it('checks the listening locale on iOS', () => {
    onPlatform('ios');
    onDeviceSupported('en-IN');
    expect(libOnDevice).toHaveBeenLastCalledWith('en-IN');
  });

  it('never claims on-device on web', () => {
    onPlatform('web');
    expect(onDeviceSupported('en-US')).toBe(false);
  });
});

describe('localeSupport', () => {
  it('finds the locale in the platform list, whatever the separator or case', () => {
    expect(localeSupport('en-IN', ['en-GB', 'en-IN', 'en-US'])).toBe('supported');
    expect(localeSupport('en-IN', ['en_IN'])).toBe('supported');
    expect(localeSupport('en-in', ['en-IN'])).toBe('supported');
  });

  it('says unsupported only when the platform gave a list without it', () => {
    expect(localeSupport('en-PH', ['en-GB', 'en-US'])).toBe('unsupported');
  });

  it('says unknown when the platform gave no list (Android 12, web, an error)', () => {
    expect(localeSupport('en-PH', [])).toBe('unknown');
    expect(localeSupport('en-PH', undefined)).toBe('unknown');
  });
});

describe('startGate', () => {
  it('starts straight away on-device', () => {
    expect(startGate({ onDevice: true, allowServer: false, locale: 'unknown' })).toBe('start');
  });

  it('asks before any audio goes to a server', () => {
    expect(startGate({ onDevice: false, allowServer: false, locale: 'supported' })).toBe('needs-consent');
    expect(startGate({ onDevice: false, allowServer: false, locale: 'unknown' })).toBe('needs-consent');
  });

  it('never asks for consent to use a variety the phone can’t listen for', () => {
    expect(startGate({ onDevice: false, allowServer: false, locale: 'unsupported' })).toBe('language-not-supported');
    expect(startGate({ onDevice: false, allowServer: true, locale: 'unsupported' })).toBe('language-not-supported');
  });

  it('uses the server once the reader has said yes', () => {
    expect(startGate({ onDevice: false, allowServer: true, locale: 'supported' })).toBe('start');
    expect(startGate({ onDevice: false, allowServer: true, locale: 'unknown' })).toBe('start');
  });
});

describe('endAction: when iOS ends a session mid-read', () => {
  it('restarts quietly while the session still wants to listen on-device', () => {
    expect(endAction({ wanted: true, onDevice: true, allowServer: false })).toBe('restart');
  });

  it('stops and asks if on-device went away at the restart and the reader never agreed to the server', () => {
    expect(endAction({ wanted: true, onDevice: false, allowServer: false })).toBe('needs-consent');
  });

  it('restarts on the server only with consent', () => {
    expect(endAction({ wanted: true, onDevice: false, allowServer: true })).toBe('restart');
  });

  it('stops when the session is over', () => {
    expect(endAction({ wanted: false, onDevice: true, allowServer: true })).toBe('stopped');
    expect(endAction({ wanted: false, onDevice: false, allowServer: false })).toBe('stopped');
  });
});

describe('classifyError: only errors that really stop listening reach the screen', () => {
  it('ignores silence and our own stop, which the end handler restarts from', () => {
    for (const code of ['no-speech', 'speech-timeout', 'aborted']) expect(classifyError(code)).toBe('ignore');
  });

  it('treats permission errors as denied', () => {
    expect(classifyError('not-allowed')).toBe('denied');
    expect(classifyError('service-not-allowed')).toBe('denied');
  });

  it('treats an unsupported language and an interruption (call, Siri, app switch) as fatal', () => {
    expect(classifyError('language-not-supported')).toBe('fatal');
    expect(classifyError('interrupted')).toBe('fatal');
  });

  it('treats routine glitches as recoverable: AirPods route change, network blips, a busy or flaky service', () => {
    for (const code of ['audio-capture', 'network', 'busy', 'client', 'unknown', 'too-many-requests']) {
      expect(classifyError(code)).toBe('recoverable');
    }
  });
});

describe('noteHiccup: give up only when recoverable errors keep coming with nothing heard', () => {
  it('keeps going for one or two hiccups', () => {
    let recent: number[] = [];
    for (let i = 1; i < HICCUP_LIMIT; i++) {
      const r = noteHiccup(recent, i * 100);
      expect(r.giveUp).toBe(false);
      recent = r.recent;
    }
  });

  it(`gives up at ${HICCUP_LIMIT} inside the window`, () => {
    let r = { recent: [] as number[], giveUp: false };
    for (let i = 0; i < HICCUP_LIMIT; i++) r = noteHiccup(r.recent, 1000 + i * 500);
    expect(r.giveUp).toBe(true);
  });

  it('forgets hiccups older than the window, so a long read with rare blips never gives up', () => {
    let r = { recent: [] as number[], giveUp: false };
    for (let i = 0; i < 10; i++) {
      r = noteHiccup(r.recent, i * (HICCUP_WINDOW_MS / 2 + 1));
      expect(r.giveUp).toBe(false);
    }
  });
});

describe('restartDelayMs: back off a little after a glitch, never after a routine end', () => {
  it('restarts at once after silence or a time limit', () => {
    expect(restartDelayMs(0)).toBe(0);
  });

  it('waits longer after each recent glitch, and stays well under a second', () => {
    expect(restartDelayMs(1)).toBeGreaterThan(0);
    expect(restartDelayMs(2)).toBeGreaterThan(restartDelayMs(1));
    expect(restartDelayMs(HICCUP_LIMIT)).toBeLessThan(1000);
  });
});

describe('stateAfterEnd: the end event never hides why listening stopped', () => {
  it('keeps error, denied, needs-consent and unavailable', () => {
    for (const s of ['error', 'denied', 'needs-consent', 'unavailable'] as const) expect(stateAfterEnd(s)).toBe(s);
  });

  it('turns a live session into stopped', () => {
    expect(stateAfterEnd('listening')).toBe('stopped');
    expect(stateAfterEnd('asking')).toBe('stopped');
  });
});

describe('serverAllowed: consent follows the profile, plus a one-session yes from MicGate', () => {
  it('follows the profile, so turning it off in You takes effect at the next restart', () => {
    expect(serverAllowed({ profile: true, sessionGrant: false })).toBe(true);
    expect(serverAllowed({ profile: false, sessionGrant: false })).toBe(false);
    expect(serverAllowed({ profile: undefined, sessionGrant: false })).toBe(false);
  });

  it('honours the yes given for this session even before the profile catches up', () => {
    expect(serverAllowed({ profile: false, sessionGrant: true })).toBe(true);
    expect(serverAllowed({ profile: undefined, sessionGrant: true })).toBe(true);
  });
});

describe('canResumeAfter: Carry on only when listening could really pick up again', () => {
  it.each(['interrupted', 'repeated-failure', 'network', 'restart-failed'])('offers it after %s', (code) => {
    expect(canResumeAfter(code)).toBe(true);
  });

  it('never offers it for a variety the phone can’t listen for, or with no error', () => {
    expect(canResumeAfter('language-not-supported')).toBe(false);
    expect(canResumeAfter(null)).toBe(false);
    expect(canResumeAfter(undefined)).toBe(false);
  });
});

describe('diagnosticCode: tester diagnostics hold codes, never words', () => {
  it('keeps the library’s short codes', () => {
    expect(diagnosticCode('network')).toBe('network');
    expect(diagnosticCode('audio-capture')).toBe('audio-capture');
  });

  it('counts anything that could be native text as other', () => {
    expect(diagnosticCode('Error Domain=kAFAssistantErrorDomain Code=1101')).toBe('other');
    expect(diagnosticCode('the night shift')).toBe('other');
    expect(diagnosticCode('x'.repeat(40))).toBe('other');
    expect(diagnosticCode(undefined)).toBe('other');
  });
});
