import { encodeStatuses, reviewMetrics, reviewRow, toggleMark } from '../review';

describe('beta review metrics', () => {
  const statuses = encodeStatuses(['read', 'skipped', 'read', 'skipped', 'skipped', 'read', 'read', 'read', 'read', 'read', 'pending'], new Set([3]));

  it('encodes what the reader saw at the end', () => {
    expect(statuses).toBe('rsrcsrrrrrp');
  });

  it('counts only the reader’s own fixes before review', () => {
    const m = reviewMetrics(statuses, { said: [], notSaid: [] });
    expect(m.attempted).toBe(10);
    expect(m.falseRed).toBe(1);
    expect(m.falseRedPer100).toBe(10);
    expect(m.correctionRate).toBe(1);
  });

  it('adds errors the reader missed and removes corrections that were wrong', () => {
    // Reviewer hears word 1 on the tape (an uncaught error), and word 7 was green but never said.
    let marks = toggleMark(statuses, { said: [], notSaid: [] }, 1);
    marks = toggleMark(statuses, marks, 7);
    const m = reviewMetrics(statuses, marks);
    expect(m.uncaught).toBe(1);
    expect(m.falseRed).toBe(2);
    expect(m.falseRedPer100).toBe(20);
    expect(m.falseGreen).toBe(1);
    expect(m.correctionRate).toBe(0.5);

    // The reader's "I said it" on word 3 turns out to be wrong.
    const m2 = reviewMetrics(statuses, toggleMark(statuses, marks, 3));
    expect(m2.falseRed).toBe(1);
  });

  it('toggles marks off again and ignores words not reached', () => {
    const once = toggleMark(statuses, { said: [], notSaid: [] }, 1);
    expect(toggleMark(statuses, once, 1).said).toEqual([]);
    expect(toggleMark(statuses, once, 10)).toBe(once);
  });

  it('exports numbers only', () => {
    const row = reviewRow(reviewMetrics(statuses, { said: [], notSaid: [] }), { session: 'T3-1', wpm: 142, firstWordLagMs: 640, reviewed: false });
    expect(row).toBe('T3-1\t10\t1\t0\t10\t0\t100\t142\t640\tno');
  });
});
