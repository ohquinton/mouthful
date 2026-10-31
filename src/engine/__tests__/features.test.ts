import { chunkScript, titleFrom, wordCount } from '../../content/scripts';
import { day1VsNow, heatStrip, personalBests, retestDue, SessionLike } from '../progress';
import { streak, SavedSession } from '../../store/sessions';

const DAY = 86_400_000;
const NOW = new Date('2026-10-26T15:00:00').getTime(); // a Monday

function s(id: string, daysAgo: number, extra: Partial<SavedSession> = {}): SavedSession {
  return {
    id,
    passageId: 'night-shift',
    title: 'x',
    at: NOW - daysAgo * DAY,
    wpm: 150,
    fillers: 1,
    fillersPerMin: 1,
    accuracy: 95,
    pauses: 0,
    seconds: 40,
    score: 80,
    stumbled: [],
    ...extra,
  };
}

describe('chunkScript', () => {
  const sentence = 'This is a sentence of exactly ten words for testing. ';

  it('keeps a short script as one part', () => {
    expect(chunkScript('Hello there. This is short.')).toEqual(['Hello there. This is short.']);
  });

  it('splits long scripts at sentence ends near 150 words', () => {
    const chunks = chunkScript(sentence.repeat(40)); // 400 words
    expect(chunks.length).toBeGreaterThanOrEqual(2);
    for (const c of chunks) {
      expect(c.trim().endsWith('.')).toBe(true);
      expect(wordCount(c)).toBeLessThanOrEqual(190);
    }
    expect(chunks.map(wordCount).reduce((a, b) => a + b, 0)).toBe(400);
  });

  it('folds a tiny tail into the previous part', () => {
    const chunks = chunkScript(sentence.repeat(15) + 'Thanks everyone.');
    expect(chunks.length).toBe(1);
  });

  it('names a script from its first words', () => {
    expect(titleFrom('Good morning everyone, thanks for coming in today. Let us start.')).toBe('Good morning everyone, thanks for');
    expect(titleFrom('   ')).toBe('Untitled script');
  });
});

describe('streak', () => {
  it('counts consecutive days including today', () => {
    expect(streak([s('a', 0), s('b', 1), s('c', 2)], NOW).days).toBe(3);
  });

  it('still counts if today is not done yet', () => {
    expect(streak([s('b', 1), s('c', 2)], NOW).days).toBe(2);
  });

  it('forgives one missed day with a streak freeze', () => {
    const r = streak([s('a', 0), s('c', 2), s('d', 3)], NOW);
    expect(r.days).toBe(3);
    expect(r.freezeUsed).toBe(true);
  });

  it('breaks on two missed days in a row', () => {
    expect(streak([s('a', 0), s('d', 3)], NOW).days).toBe(1);
  });
});

describe('progress', () => {
  it('builds a 12 x 7 heat strip with future days blank', () => {
    const grid = heatStrip([s('a', 0), s('b', 0), s('c', 7)], 12, NOW);
    expect(grid).toHaveLength(12);
    expect(grid[11][0]).toBe(2); // today, Monday, two sessions
    expect(grid[11][1]).toBe(-1); // tomorrow
    expect(grid[10][6]).toBe(0);
    expect(grid[10][0]).toBe(1); // 7 days ago: last Monday
  });

  it('finds personal bests, ignoring free talk for accuracy', () => {
    const b = personalBests([s('a', 0, { score: 91, fillersPerMin: 0.5 }), s('t', 1, { passageId: 'talk', accuracy: null, score: 70 })]);
    expect(b).toMatchObject({ bestScore: 91, cleanest: 0.5, mostAccurate: 95, totalSessions: 2, totalDays: 2 });
  });

  it('compares Day 1 with the latest read of the same passage', () => {
    const list: SessionLike[] = [
      s('day1', 10, { passageId: 'baseline', wpm: 190 }),
      s('x', 5, { passageId: 'baseline', wpm: 160 }),
      s('y', 1, { passageId: 'standup', wpm: 140 }),
    ];
    const c = day1VsNow(list, 'day1')!;
    expect(c.latest.id).toBe('x');
    expect(c.daysBetween).toBe(5);
  });

  it('asks for the day 7 re-test once, and not before', () => {
    const base = s('day1', 8, { passageId: 'baseline' });
    expect(retestDue([base], 'day1', NOW)).toBe(7);
    expect(retestDue([s('day1', 3, { passageId: 'baseline' })], 'day1', NOW)).toBeUndefined();
    expect(retestDue([base, s('r', 0, { passageId: 'baseline' })], 'day1', NOW)).toBeUndefined();
    expect(retestDue([s('day1', 31, { passageId: 'baseline' })], 'day1', NOW)).toBe(30);
  });
});
