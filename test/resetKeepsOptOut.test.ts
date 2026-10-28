// Reset all data deletes everything, but an analytics opt-out survives it (DECISIONS.md
// 2026-10-28): the reader said no, and "delete my data" mustn't silently turn tracking back on.
// The anonymous id still goes, as on a fresh install.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { keptAfterReset, wipeAllData } from '../src/store/resetData';

jest.mock('../src/store/recordings', () => ({ deleteAllRecordings: jest.fn(() => 0) }));

const PROFILE_KEY = 'mouthful.profile.v1';

describe('keptAfterReset', () => {
  it('keeps an opt-out', () => {
    expect(keptAfterReset({ analyticsOptOut: true })).toEqual({ analyticsOptOut: true });
  });

  it('keeps nothing when the reader never opted out', () => {
    expect(keptAfterReset({})).toEqual({});
    expect(keptAfterReset({ analyticsOptOut: false })).toEqual({});
  });
});

describe('wipeAllData', () => {
  beforeEach(() => AsyncStorage.clear());

  it('clears everything, writes back the opt-out, and drops the anonymous id', async () => {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify({ onboarded: true, analyticsOptOut: true, pro: false, paywallSeen: true }));
    await AsyncStorage.setItem('mouthful.sessions.v1', '[]');
    await AsyncStorage.setItem('mouthful.analyticsId', 'old-id');

    await wipeAllData(PROFILE_KEY, { onboarded: false, pro: false, paywallSeen: false, analyticsOptOut: true });

    expect(JSON.parse((await AsyncStorage.getItem(PROFILE_KEY))!)).toEqual({ onboarded: false, pro: false, paywallSeen: false, analyticsOptOut: true });
    expect(await AsyncStorage.getItem('mouthful.sessions.v1')).toBeNull();
    expect(await AsyncStorage.getItem('mouthful.analyticsId')).toBeNull();
  });

  it('leaves no profile at all when nothing is kept, like a fresh install', async () => {
    await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify({ onboarded: true, pro: false, paywallSeen: true }));
    await wipeAllData(PROFILE_KEY, null);
    expect(await AsyncStorage.getItem(PROFILE_KEY)).toBeNull();
  });

  it('deletes the recordings before clearing storage', async () => {
    const { deleteAllRecordings } = jest.requireMock('../src/store/recordings') as { deleteAllRecordings: jest.Mock };
    deleteAllRecordings.mockClear();
    await AsyncStorage.setItem('mouthful.sessions.v1', JSON.stringify([{ id: 'a', recordings: ['file:///r/recording_1.wav'] }]));
    await wipeAllData(PROFILE_KEY, null);
    expect(deleteAllRecordings).toHaveBeenCalledWith(['file:///r/recording_1.wav']);
  });
});
