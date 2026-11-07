import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadExperience, parseExperience, saveExperience } from '../src/store/experienceChoice';

describe('the remembered door', () => {
  beforeEach(() => AsyncStorage.clear());

  it('shows both doors on a first launch', async () => {
    expect(await loadExperience()).toBeNull();
  });

  it('returns to the last door chosen', async () => {
    await saveExperience('english');
    expect(await loadExperience()).toBe('english');
    await saveExperience('articulation');
    expect(await loadExperience()).toBe('articulation');
  });

  it('forgets the door when storage is cleared, as Reset all data does', async () => {
    await saveExperience('english');
    await AsyncStorage.clear();
    expect(await loadExperience()).toBeNull();
  });

  it('shows both doors for anything that is not a real door', () => {
    for (const raw of [null, '', 'sharp', 'toString', 'constructor', '__proto__']) expect(parseExperience(raw)).toBeNull();
  });

  it('shows both doors if storage fails', async () => {
    const spy = jest.spyOn(AsyncStorage, 'getItem').mockRejectedValueOnce(new Error('no storage'));
    expect(await loadExperience()).toBeNull();
    spy.mockRestore();
  });
});
