// One Minute prompts (src/content/prompts.ts): 36 curated, 12 per level, one per local calendar day.
import { localDay } from '../src/content/passages';
import { MINUTE_PROMPTS, minutePromptForDay, minutePromptOfTheDay, promptOfTheDay, PROMPTS } from '../src/content/prompts';

// Free talk's 12 (tester mode off still uses them), as they were before One Minute except three
// reworded on 2026-10-31 for plain English: p26 (no "pitch"), p31 (no "thirty-second"), p33 (no "on Monday").
const FREE_TALK_BEFORE = [
  'Explain what you do for work to a ten-year-old.',
  'Tell me why I should try your favourite restaurant.',
  'What’s one opinion you hold that most people disagree with?',
  'Describe the best meal you’ve ever had.',
  'Teach me something you learned this week.',
  'What would you do with an extra hour every day?',
  'Give a short update on a project you’re working on.',
  'Tell me about a time a plan went wrong, and what you did.',
  'Introduce yourself as if it’s your first day at a new job.',
  'Convince me to visit the city you live in.',
  'Explain a hobby of yours to someone who has never tried it.',
  'What advice would you give yourself five years ago?',
];

describe('the prompt list', () => {
  it('has 36 prompts, ids p01–p36 in order, 12 per level', () => {
    expect(MINUTE_PROMPTS.map((p) => p.id)).toEqual(Array.from({ length: 36 }, (_, k) => `p${String(k + 1).padStart(2, '0')}`));
    for (const level of [1, 2, 3]) expect(MINUTE_PROMPTS.filter((p) => p.level === level)).toHaveLength(12);
  });

  it('folds Free talk’s 12 into level 3, in order', () => {
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

  // The phone's clock in a given zone, as a Date whose local fields show that wall time. The test
  // process runs in one zone (globalSetup), so this is how a test sees a phone that changed zone.
  const phoneClock = (instant: number, timeZone: string): Date => {
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' })
      .formatToParts(new Date(instant))
      .reduce<Record<string, number>>((acc, p) => (p.type === 'literal' ? acc : { ...acc, [p.type]: Number(p.value) }), {});
    return new Date(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  };
  const HOUR = 3_600_000;

  it('a time zone change follows the date the phone shows, not the hours that passed', () => {
    // Toronto Wed 28 Oct 20:00 (00:00 UTC Thu) → a 14 h flight east → Kolkata Thu 29 Oct 19:30.
    // Only 14 hours passed, but the phone's date moved on one day, so it is the next prompt.
    const leaveAt = Date.UTC(2026, 9, 29, 0, 0);
    const leave = phoneClock(leaveAt, 'America/Toronto');
    const land = phoneClock(leaveAt + 14 * HOUR, 'Asia/Kolkata');
    expect([leave.getDate(), leave.getHours()]).toEqual([28, 20]); // the helper really shows Toronto time
    expect([land.getDate(), land.getHours(), land.getMinutes()]).toEqual([29, 19, 30]);
    expect(localDay(land) - localDay(leave)).toBe(1);
    expect(minutePromptOfTheDay(land).id).toBe(minutePromptOfTheDay(leave, 1).id);
    expect(minutePromptOfTheDay(land).id).not.toBe(minutePromptOfTheDay(leave).id);
  });

  it('flying west across the date line goes back a day: yesterday’s prompt again, never a skip', () => {
    // Auckland Thu 29 Oct 09:00 (20:00 UTC Wed) → a 9 h flight → Honolulu Wed 28 Oct 19:00.
    const leaveAt = Date.UTC(2026, 9, 28, 20, 0);
    const leave = phoneClock(leaveAt, 'Pacific/Auckland');
    const land = phoneClock(leaveAt + 9 * HOUR, 'Pacific/Honolulu');
    expect([leave.getDate(), land.getDate()]).toEqual([29, 28]);
    expect(localDay(land) - localDay(leave)).toBe(-1);
    expect(minutePromptOfTheDay(land).id).toBe(minutePromptOfTheDay(leave, -1).id);
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
