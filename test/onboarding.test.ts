// Onboarding rules (src/onboarding.ts). The S0 first: saying no to the mic during onboarding must
// lead out of onboarding, never back to the mic step (which leads straight back to the gate).
import { micGateExit, previousStep } from '../src/onboarding';

describe('micGateExit: no trap when the mic is refused', () => {
  it('finishes onboarding and opens Today while onboarding', () => {
    expect(micGateExit(false)).toBe('today');
  });

  it('goes back as before once onboarded (practice screens)', () => {
    expect(micGateExit(true)).toBe('back');
  });
});

describe('previousStep', () => {
  it('walks back one step at a time and stops at the hook', () => {
    expect(previousStep('mic')).toBe('moment');
    expect(previousStep('moment')).toBe('hook');
    expect(previousStep('hook')).toBeNull();
  });
});
