import { talkCoachState } from '../src/components/coachState';

describe('decorative talk coach', () => {
  it('stays idle when the microphone is not running, even with a recent result', () => {
    expect(talkCoachState(false, 9000, 10000)).toBe('idle');
  });
  it('waits calmly before the first recognition result', () => {
    expect(talkCoachState(true, 0, 10000)).toBe('thinking');
  });
  it('returns to listening when recognition resumes after a gap', () => {
    expect(talkCoachState(true, 7000, 10000)).toBe('thinking');
    expect(talkCoachState(true, 9900, 10000)).toBe('listening');
  });
});
