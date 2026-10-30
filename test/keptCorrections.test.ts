// "I said it" taps during Glide: which ones are still corrections when the read ends.
// session/[id].tsx logs recognition_correction, records the word book's correction and saves
// `corrected` only for these, so the metric counts the recogniser's real misses once each.
import { keptCorrections } from '../src/store/sessions';
import { encodeStatuses } from '../src/engine/review';

describe('keptCorrections', () => {
  it('keeps a tapped word the recogniser still missed', () => {
    expect(keptCorrections(['read', 'skipped', 'read'], new Set([1]))).toEqual([1]);
  });

  // The S3: a tapped word the resync backfill inked later was logged as a correction and kept
  // in corrected[], while the tester statuses said 'r'. Now it isn't a correction at all.
  it('drops a tapped word the recogniser inked later (late result or backfill)', () => {
    expect(keptCorrections(['read', 'read', 'read'], new Set([1]))).toEqual([]);
  });

  it('drops a tapped word a revision pulled back to pending', () => {
    expect(keptCorrections(['read', 'pending', 'pending'], new Set([1]))).toEqual([]);
  });

  it('returns passage order whatever order the taps came in, and ignores out-of-range taps', () => {
    const status = ['skipped', 'read', 'skipped', 'skipped'];
    expect(keptCorrections(status, new Set([3, 0, 2, 9]))).toEqual([0, 2, 3]);
  });

  it('agrees with the tester statuses written from the raw statuses', () => {
    const raw = ['read', 'skipped', 'read', 'skipped', 'pending'];
    const tapped = new Set([1, 2, 3]); // 2 was inked by backfill after the tap
    const codes = encodeStatuses(raw, tapped);
    expect(codes).toBe('rcrcp');
    const fromCodes = [...codes].flatMap((c, i) => (c === 'c' ? [i] : []));
    expect(keptCorrections(raw, tapped)).toEqual(fromCodes);
  });
});
