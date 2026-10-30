// Glide's progress decisions (src/glide.ts): a re-read behind the pointer is progress, so it
// never shows "Pick up from…" and never counts as a mid-sentence pause.
import { finalAlignment, isLost, LOST_AFTER_MS, pauseAfter, progressKind } from '../src/glide';
import { partReached } from '../src/pro';

// pro.ts imports the router for requirePro(); the real one needs React Native.
jest.mock('expo-router', () => ({ router: { push: jest.fn() } }));
import { align, preparePassage, tokenise } from '../src/engine/align';
import { getPassage } from '../src/content/passages';

describe('progressKind', () => {
  it('the pointer moving on is an advance', () => {
    expect(progressKind({ next: 4 }, { next: 5 })).toBe('advance');
  });

  it('a new rereadingAt with the pointer held is a re-read', () => {
    expect(progressKind({ next: 9 }, { next: 9, rereadingAt: 3 })).toBe('reread');
    expect(progressKind({ next: 9, rereadingAt: 3 }, { next: 9, rereadingAt: 4 })).toBe('reread');
  });

  it('the same rereadingAt again, or none, is nothing new', () => {
    expect(progressKind({ next: 9, rereadingAt: 4 }, { next: 9, rereadingAt: 4 })).toBe('none');
    expect(progressKind({ next: 9, rereadingAt: 4 }, { next: 9 })).toBe('none');
    expect(progressKind({ next: 9 }, { next: 9 })).toBe('none');
  });
});

describe('pauseAfter', () => {
  it('a long stop mid-sentence is a pause', () => {
    expect(pauseAfter({ gapMs: 2500, breathAfter: false, rereading: false })).toBe('mid');
  });

  it('not while re-reading', () => {
    expect(pauseAfter({ gapMs: 2500, breathAfter: false, rereading: true })).toBe('none');
  });

  it('a short stop at a breath mark fills it; a quick step does nothing', () => {
    expect(pauseAfter({ gapMs: 500, breathAfter: true, rereading: false })).toBe('breath');
    expect(pauseAfter({ gapMs: 300, breathAfter: true, rereading: false })).toBe('none');
    expect(pauseAfter({ gapMs: 1500, breathAfter: false, rereading: false })).toBe('none');
  });
});

describe('isLost: the "Pick up from…" nudge', () => {
  const base = { listening: true, started: true, done: false, rereading: false, now: 10_000, lastProgressAt: 10_000 - LOST_AFTER_MS - 1 };

  it('shows after 6 s with no progress', () => {
    expect(isLost(base)).toBe(true);
    expect(isLost({ ...base, lastProgressAt: base.now - LOST_AFTER_MS + 1 })).toBe(false);
  });

  it('never while re-reading', () => {
    expect(isLost({ ...base, rereading: true })).toBe(false);
  });

  it('never before the first word, after the end, or while not listening', () => {
    expect(isLost({ ...base, started: false })).toBe(false);
    expect(isLost({ ...base, done: true })).toBe(false);
    expect(isLost({ ...base, listening: false })).toBe(false);
  });

  it('a stream of re-read steps keeps resetting the clock, as the session screen does', () => {
    // Walk updates the way session/[id].tsx does: progress (advance or re-read) stamps the time.
    const updates = [
      { at: 0, next: 5 },
      { at: 4000, next: 5, rereadingAt: 1 },
      { at: 8000, next: 5, rereadingAt: 2 },
      { at: 12000, next: 5, rereadingAt: 3 },
    ];
    let prev: { next: number; rereadingAt?: number } = { next: 0 };
    let lastProgressAt = 0;
    for (const u of updates) {
      if (progressKind(prev, u) !== 'none') lastProgressAt = u.at;
      prev = u;
      // Checked just before the next update, with the re-read already over.
      expect(isLost({ listening: true, started: true, done: false, rereading: false, now: u.at + 4000, lastProgressAt })).toBe(false);
    }
  });
});

describe('finalAlignment: what finish() saves', () => {
  const words = preparePassage(getPassage('night-shift')!.text);
  const keys = words.map((w) => w.key);

  it('qa-critic repro: read 10, skip 6, read 3, Finish lands the jump and marks the gap', () => {
    const heard = [...keys.slice(0, 10), ...keys.slice(16, 19)];
    const live = align(words, heard);
    const { raw, final } = finalAlignment(words, heard, new Set());
    // Live, the jump rests on the last words and hasn't landed: nothing is red yet.
    expect(live.skipped).toBe(0);
    expect(raw.next).toBe(19);
    expect(final.read).toBe(13);
    expect(final.skipped).toBe(6);
    expect(Math.round((final.read / (final.read + final.skipped)) * 100)).toBe(68);
  });

  it('"I said it" taps apply on top of the settled alignment; the raw view keeps the skip', () => {
    const heard = [...keys.slice(0, 10), ...keys.slice(16, 19)];
    const { raw, final } = finalAlignment(words, heard, new Set([10, 11]));
    expect(raw.skipped).toBe(6);
    expect(final.skipped).toBe(4);
    expect(final.read).toBe(15);
  });

  it('a skip that lands on the last words counts as reaching the part (the free run, pro.ts partReached)', () => {
    // Reads to word 66, skips 3 and Finishes on the last 6: the jump rests on the last 2 words,
    // so only the settled alignment reaches the end. (A skip of a whole long stretch straight to
    // the closing sentence doesn't resync at all yet: that's align()'s limit, not this call's.)
    const ends = words.map((w) => w.sentenceEnd);
    const heard = [...keys.slice(0, 66), ...keys.slice(69)];
    const { final } = finalAlignment(words, heard, new Set());
    expect(final.next).toBe(keys.length);
    expect(final.skipped).toBe(3);
    expect(partReached(final.next, ends)).toBe(true);
  });
});

describe('the settled alignment the session saves', () => {
  it('a clean read ends in the same place live and settled', () => {
    const words = preparePassage('The quick brown fox jumps over the lazy dog near the river bank today.');
    const heard = tokenise('the quick brown fox jumps over the lazy dog near the river bank today');
    expect(align(words, heard, heard.length).next).toBe(align(words, heard).next);
  });

  it('a jump still waiting at the last words lands only in the settled alignment (what finish() saves)', () => {
    const words = preparePassage(getPassage('night-shift')!.text);
    const keys = words.map((w) => w.key);
    // Reads the first 3 words, skips 12, reads 3 more and taps Finish.
    const heard = [...keys.slice(0, 3), ...keys.slice(15, 18)];
    expect(align(words, heard).next).toBe(3);
    const settled = align(words, heard, heard.length);
    expect(settled.next).toBe(18);
    expect(settled.skipped).toBe(12);
  });
});
