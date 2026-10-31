import { loadDrillItems } from '../src/content/drill';
import type { SavedSession } from '../src/store/sessions';

const saved = (fields: Partial<SavedSession>) => fields as SavedSession;

it('ignores blank entries and repeated words without changing first-occurrence order', async () => {
  const read = jest.fn();
  const items = await loadDrillItems(' nuance, ,NUANCE, candid, ', undefined, read);
  expect(items.map((item) => item.word)).toEqual(['nuance', 'candid']);
  expect(items.every((item) => !!item.sentence)).toBe(true);
  expect(read).not.toHaveBeenCalled();
});

it('reads a saved session once and retains its custom sentence', async () => {
  const read = jest.fn().mockResolvedValue(saved({ stumbledContext: { zephyr: 'A zephyr moved the leaves.' }, stumbled: ['other'] }));
  expect(await loadDrillItems('nuance', 'saved', read)).toEqual([{ word: 'zephyr', sentence: 'A zephyr moved the leaves.' }]);
  expect(read).toHaveBeenCalledTimes(1);
});

it('supports older sessions with only stumbled words', async () => {
  const read = jest.fn().mockResolvedValue(saved({ stumbled: ['nuance'] }));
  expect((await loadDrillItems(undefined, 'old', read))[0].word).toBe('nuance');
});

it('does not substitute route words for a missing saved session', async () => {
  expect(await loadDrillItems('nuance', 'deleted', async () => undefined)).toEqual([]);
});

it('propagates storage errors so the screen can offer retry', async () => {
  await expect(loadDrillItems(undefined, 'saved', async () => { throw new Error('unavailable'); })).rejects.toThrow('unavailable');
});
