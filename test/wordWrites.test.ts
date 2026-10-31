import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadBook, recordWords, recordCorrection, pauseWordWrites } from '../src/store/words';

beforeEach(async () => { await AsyncStorage.clear(); });

it('preserves simultaneous results for different words', async () => {
  await Promise.all(['nuance', 'candid'].map((word) => recordWords([{ word, clean: true }])));
  expect(Object.keys(await loadBook()).sort()).toEqual(['candid', 'nuance']);
});

it('applies a correction after the pending stumble', async () => {
  await Promise.all([recordWords([{ word: 'nuance', clean: false }]), recordCorrection('nuance')]);
  const entry = (await loadBook()).nuance;
  expect(entry.stumbles).toBe(0);
  expect(entry.cleanDays).toHaveLength(1);
});

it('blocks writes during reset and resumes afterward', async () => {
  const pending = recordWords([{ word: 'nuance', clean: true }]);
  const resume = await pauseWordWrites();
  try {
    await pending;
    await AsyncStorage.clear();
    await recordCorrection('candid');
    expect(await loadBook()).toEqual({});
  } finally { resume(); }
  await recordWords([{ word: 'premise', clean: true }]);
  expect(Object.keys(await loadBook())).toEqual(['premise']);
});
