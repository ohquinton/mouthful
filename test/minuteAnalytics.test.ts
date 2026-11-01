// One Minute analytics (brief criterion 8): session_complete and the habit overrule carry numbers
// and short codes only. No prompt text, transcript or watch word survives sanitise().
import { sanitise } from '../src/analytics';
import { tokenise } from '../src/engine/align';
import type { HabitWord } from '../src/engine/habits';
import { minuteSummary } from '../src/engine/minute';
import { MINUTE_PROMPTS } from '../src/content/prompts';
import { habitCode, minuteCompleteProps } from '../src/store/minute';

const SAID = 'the meeting like went for two hours and like the client said no and you know it was like huge but we fixed it in the end';

function props() {
  const tokens = tokenise(SAID);
  const m = minuteSummary({ tokens, heardTimes: tokens.map((_, k) => 1500 + k * 450), startedAt: 0 })!;
  return minuteCompleteProps(m, MINUTE_PROMPTS[6], 60.4);
}

describe('session_complete for a minute', () => {
  it('sanitise keeps every property (all numbers or allowlisted codes)', () => {
    const p = props();
    expect(sanitise(p)).toEqual(p);
    expect(Object.keys(p).sort()).toEqual(
      [
        'kind', 'pace', 'which', 'level', 'flow', 'long_pauses', 'longest_pause_s', 'talk_seconds', 'wpm',
        'fillers_per_min', 'habit_fillers', 'habit_unsure', 'habit_overruled', 'flow_version', 'seconds',
      ].sort(),
    );
    expect(p).toMatchObject({ kind: 'minute', which: 'p07', level: 1, habit_overruled: 0, seconds: 60 });
  });

  it('carries no prompt text and none of the words said', () => {
    const json = JSON.stringify(sanitise(props()));
    expect(json).not.toContain(MINUTE_PROMPTS[6].text);
    for (const w of ['meeting', 'client', 'huge', 'fixed']) expect(json).not.toContain(w);
  });

  it('drops text if someone passes the prompt, transcript or watch word', () => {
    const out = sanitise({
      ...props(),
      prompt: 'A window',
      which: 'Explain what you do for work to a ten-year-old.', // text on an allowlisted key: still dropped
      transcript: SAID,
      word: 'window',
    });
    expect(out).not.toHaveProperty('prompt');
    expect(out).not.toHaveProperty('which');
    expect(out).not.toHaveProperty('transcript');
    expect(out).not.toHaveProperty('word');
  });

  it('carries nothing from repeated words or variety, which look like short codes and would pass sanitise', () => {
    // A repeated word ("window") or a precise word ("sunflowers") is a valid CODE, so sanitise alone
    // would keep it on an allowlisted key. minuteCompleteProps must never read them at all.
    const tokens = tokenise(
      'the window in my room is old the window faces the garden where sunflowers grow and the window lets in the ' +
        'morning light so i open the window every day and watch the sunflowers move in the wind',
    );
    const m = minuteSummary({ tokens, heardTimes: tokens.map((_, k) => 1500 + k * 450), startedAt: 0, common: new Set(['the', 'old']) })!;
    expect(m.repeated?.[0]?.word).toBe('window'); // the summary does carry them...
    expect(m.variety).toBeUndefined(); // (under 50 words: give it a record by hand below)
    const withWording: typeof m = {
      ...m,
      repeated: [{ word: 'sunflowers', count: 9, forms: ['sunflowers', 'sunflower'] }],
      variety: { mattr: 0.777, windows: 13, window: 50, words: 62, precise: { count: 2, words: ['sunflowers', 'garden'] } },
    };
    const without: typeof m = { ...m, repeated: undefined, variety: undefined };
    const a = minuteCompleteProps(withWording, MINUTE_PROMPTS[6], 60.4);
    // ...the props are identical with or without them: nothing from either can reach track()...
    expect(a).toEqual(minuteCompleteProps(without, MINUTE_PROMPTS[6], 60.4));
    expect(a).toEqual(minuteCompleteProps(m, MINUTE_PROMPTS[6], 60.4));
    // ...and no word, count or variety value appears in what would be sent.
    const sent = JSON.stringify(sanitise(a));
    for (const w of ['window', 'sunflowers', 'sunflower', 'garden', '0.777']) expect(sent).not.toContain(w);
  });

  it('keeps exactly its current keys (a new key needs a privacy review and this test changed)', () => {
    expect(Object.keys(props())).toEqual([
      'kind', 'pace', 'which', 'level', 'flow', 'long_pauses', 'longest_pause_s', 'talk_seconds', 'wpm',
      'fillers_per_min', 'habit_fillers', 'habit_unsure', 'habit_overruled', 'flow_version', 'seconds',
    ]);
  });

  it('keeps flow_version, which is a short code', () => {
    expect(sanitise({ flow_version: '1-k40p35w25' })).toEqual({ flow_version: '1-k40p35w25' });
    expect(sanitise({ flow_version: 'kept going for a minute' })).toEqual({});
  });
});

describe('recognition_correction for "I meant that"', () => {
  it('keeps kind habit and every habit word as a code (two-word ones too)', () => {
    // Every HabitWord (engine/habits.ts). The type makes a typo here a compile error.
    const all: HabitWord[] = ['like', 'so', 'you know', 'actually', 'basically', 'literally', 'i mean', 'kind of', 'sort of', 'right'];
    for (const w of all) {
      const p = { where: 'tape', kind: 'habit', which: habitCode(w) };
      expect(sanitise(p)).toEqual(p);
    }
  });
});
