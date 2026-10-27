// Privacy and consent decisions for the recogniser. The hook (speech/useListener) is thin
// wiring around these, so the rules that keep audio on the phone are tested here.
import { Platform } from 'react-native';
import { endAction, localeSupport, startGate } from '../../speech/gate';

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
