import { dailyJourney, dailyStopId } from '../src/content/journey';
import type { SavedSession } from '../src/store/sessions';

function talk(at: Date, stopId?: string, extra: Partial<SavedSession> = {}): SavedSession {
  return { id: String(at.getTime()), passageId: 'talk', title: 'Coffee', at: at.getTime(), wpm: 120, fillers: 0, fillersPerMin: 0, accuracy: null, pauses: 0, seconds: 60, score: 70, stumbled: [], kind: 'minute', flow: 70, stopId, ...extra };
}

test('stop IDs use the local calendar, including the clock-change day', () => {
  expect(dailyStopId('sharp', new Date(2026, 10, 1, 0, 5))).toBe('sharp:2026-11-01');
  expect(dailyStopId('clear', new Date(2026, 10, 1, 23, 55))).toBe('clear:2026-11-01');
});

test('new and legacy readers are never given invented completed stations', () => {
  const day = new Date(2026, 10, 1);
  expect(dailyJourney([], 'sharp', day)).toEqual({ id: 'sharp:2026-11-01', today: undefined, previous: undefined, completed: 0 });
  expect(dailyJourney([talk(day)], 'sharp', day).completed).toBe(0);
});

test('only completed topic talks on this line complete its stop', () => {
  const day = new Date(2026, 10, 1);
  const otherLine = talk(day, 'clear:2026-11-01');
  const reading = talk(day, 'sharp:2026-11-01', { kind: undefined });
  const invalidFlow = talk(day, 'sharp:2026-11-01', { flow: undefined });
  expect(dailyJourney([otherLine, reading, invalidFlow], 'sharp', day).today).toBeUndefined();
});

test('repeat talks stay on one station; the latest attempt is displayed', () => {
  const day = new Date(2026, 10, 1, 12);
  const first = talk(new Date(2026, 10, 1, 9), 'sharp:2026-11-01');
  const repeat = talk(new Date(2026, 10, 1, 11), 'sharp:2026-11-01', { flow: 75 });
  const previous = talk(new Date(2026, 9, 31, 20), 'sharp:2026-10-31');
  const result = dailyJourney([repeat, previous, first], 'sharp', day);
  expect(result.completed).toBe(2);
  expect(result.today).toBe(repeat);
  expect(result.previous).toBe(previous);
  expect(dailyJourney([first, repeat], 'sharp', new Date(2026, 10, 2)).today).toBeUndefined();
});
