// One Minute prompts (src/content/prompts.ts): 36 curated, 12 per level, one per local calendar day.
import { localDay } from '../src/content/passages';
import { MINUTE_PROMPTS, minutePromptForDay, minutePromptOfTheDay, promptOfTheDay, PROMPTS } from '../src/content/prompts';

// Free talk's 12, exactly as they were before One Minute (tester mode off still uses them).
const FREE_TALK_BEFORE = [
  'Explain what you do for work to a ten-year-old.',
  'Pitch your favourite restaurant in sixty seconds.',
  'What’s one opinion you hold that most people disagree with?',
  'Describe the best meal you’ve ever had.',
  'Teach me something you learned this week.',
  'What would you do with an extra hour every day?',
  'Give a thirty-second update on a project you’re working on.',
  'Tell me about a time a plan went wrong, and what you did.',
  'Introduce yourself as if you’re starting a new job on Monday.',
  'Convince me to visit the city you live in.',
  'Explain a hobby of yours to someone who has never tried it.',
  'What advice would you give yourself five years ago?',
];

describe('the prompt list', () => {
  it('has 36 prompts, ids p01–p36 in order, 12 per level', () => {
    expect(MINUTE_PROMPTS.map((p) => p.id)).toEqual(Array.from({ length: 36 }, (_, k) => `p${String(k + 1).padStart(2, '0')}`));
    for (const level of [1, 2, 3]) expect(MINUTE_PROMPTS.filter((p) => p.level === level)).toHaveLength(12);
  });

  it('folds Free talk’s 12 into level 3, unchanged', () => {
    expect(MINUTE_PROMPTS.filter((p) => p.level === 3).map((p) => p.text)).toEqual(FREE_TALK_BEFORE);
    expect(PROMPTS).toEqual(FREE_TALK_BEFORE);
  });

  it('levels 1 and 2 are a word or two, no duplicates anywhere', () => {
    for (const p of MINUTE_PROMPTS.filter((x) => x.level < 3)) expect(p.text.split(' ').length).toBeLessThanOrEqual(2);
    expect(new Set(MINUTE_PROMPTS.map((p) => p.text.toLowerCase())).size).toBe(36);
  });

  it('ids are short codes analytics keeps', () => {
    for (const p of MINUTE_PROMPTS) expect(p.id).toMatch(/^[a-z0-9_:-]{1,24}$/i);
  });
});

describe('one prompt per local calendar day', () => {
  it('two different local days show their own prompt; one day shows one prompt all day', () => {
    const early = new Date(2026, 9, 29, 0, 5);
    const late = new Date(2026, 9, 29, 23, 55);
    const tomorrow = new Date(2026, 9, 30, 0, 5);
    expect(minutePromptOfTheDay(late).id).toBe(minutePromptOfTheDay(early).id);
    expect(minutePromptOfTheDay(tomorrow).id).not.toBe(minutePromptOfTheDay(late).id);
  });

  it('36 days in a row (across a clock change) show all 36 once, taking turns between levels', () => {
    const ids: string[] = [];
    const levels: number[] = [];
    // March: most zones with DST spring forward this month, so one of these days is 23 hours long.
    for (let k = 0; k < 36; k++) {
      const p = minutePromptOfTheDay(new Date(2026, 2, 1 + k, 12));
      ids.push(p.id);
      levels.push(p.level);
    }
    expect(new Set(ids).size).toBe(36);
    for (let k = 1; k < 36; k++) expect(levels[k]).toBe((levels[k - 1] % 3) + 1);
  });

  it('a time zone change does not skip a prompt: it follows the date the phone shows', () => {
    // Toronto, Wed 20:00 → a 14 h flight east → Kolkata, Thu 19:30 local. Only one calendar day
    // passed on the phone's clock (though 23.5 hours passed in all), so it is the next prompt.
    const leave = localDay(new Date(2026, 9, 28, 20, 0));
    const land = localDay(new Date(2026, 9, 29, 19, 30));
    expect(land - leave).toBe(1);
    expect(minutePromptForDay(land).id).toBe(minutePromptForDay(leave, 1).id);
    // Flying west the same date can come round twice: the same prompt, not a skipped one.
    expect(minutePromptForDay(leave).id).toBe(minutePromptForDay(leave).id);
  });

  it('every day’s prompt is the day before’s "Different word", so nothing is ever skipped', () => {
    const start = localDay(new Date(2026, 9, 1));
    for (let d = start; d < start + 72; d++) expect(minutePromptForDay(d + 1).id).toBe(minutePromptForDay(d, 1).id);
  });

  it('"Different word" gives a different prompt, and works for any number of taps', () => {
    const day = localDay(new Date(2026, 9, 29));
    expect(minutePromptForDay(day, 1).id).not.toBe(minutePromptForDay(day).id);
    expect(minutePromptForDay(day, 36).id).toBe(minutePromptForDay(day).id);
    expect(minutePromptForDay(-5).id).toMatch(/^p\d\d$/); // no undefined for odd inputs
  });

  it('Free talk’s prompt of the day is unchanged', () => {
    const d = new Date(2026, 9, 29, 9);
    expect(promptOfTheDay(d)).toBe(FREE_TALK_BEFORE[localDay(d) % 12]);
    expect(promptOfTheDay(d, 2)).toBe(FREE_TALK_BEFORE[(localDay(d) + 2) % 12]);
  });
});
