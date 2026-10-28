// Aha before paywall, criterion 8: the new events carry counts and short codes only.
// A script's title is the reader's own text, so it must never survive sanitise().
import { sanitise } from '../src/analytics';

describe('aha-before-paywall analytics', () => {
  it('drops a script title passed as a property, on any key', () => {
    const title = 'My interview: why I left Acme';
    const out = sanitise({ moment: 'interview', title, script: title, feature: title, from: 'aha', words: 123 });
    expect(out).toEqual({ moment: 'interview', from: 'aha', words: 123 });
    expect(JSON.stringify(out)).not.toContain('Acme');
  });

  it('drops a title even when it looks like a code, if the key is not allowlisted', () => {
    expect(sanitise({ title: 'standup' })).toEqual({});
  });

  it('keeps free_run_complete as numbers and the moment code', () => {
    const props = { moment: 'interview', words: 148, parts: 3, wpm: 142, stumbled: 2, minutes_since_day1: 37 };
    expect(sanitise(props)).toEqual(props);
  });

  it('keeps paywall_view / paywall_close / purchase codes', () => {
    for (const from of ['aha', 'soft', 'you']) {
      expect(sanitise({ from, feature: 'rehearse', seconds: 12 })).toEqual({ from, feature: 'rehearse', seconds: 12 });
    }
    expect(sanitise({ plan: 'annual', from: 'aha', pro: true })).toEqual({ plan: 'annual', from: 'aha', pro: true });
  });

  it('keeps script_saved’s free flag', () => {
    expect(sanitise({ words: 140, parts: 1, moment: null, free: true })).toEqual({ words: 140, parts: 1, moment: null, free: true });
  });
});
