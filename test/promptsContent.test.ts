// "If you get stuck" ideas (src/content/prompts.ts): three short, plain starting points per prompt.
// Shown on the topic talk ready screen; written for intermediate English learners (no idioms, no slang).
import { MINUTE_PROMPTS } from '../src/content/prompts';

// Words that are slang, idioms, or assume a life not everyone has (a car, a job, siblings, a religion),
// plus the presentation and interview framing the product never leads with. Checked as whole words.
const BANNED_WORDS = [
  'gonna', 'wanna', 'gotta', 'kinda', 'sorta', 'yeah', 'cool', 'awesome', 'stuff', 'guy', 'guys', 'vibe', 'vibes',
  'chill', 'literally', 'basically', 'super', 'totally', 'hang', 'nail', 'crush', 'pitch', 'boss', 'salary',
  'money', 'debt', 'car', 'garden', 'church', 'religion', 'brother', 'sister', 'siblings', 'husband', 'wife',
  'christmas', 'holiday', 'interview', 'presentation', 'audience', 'slides', 'illness', 'sick', 'doctor',
];
// Idioms as phrases (substring, case-insensitive).
const BANNED_PHRASES = [
  'piece of cake', 'break the ice', 'hit the', 'on the fly', 'off the top', 'in a nutshell', 'at the end of the day',
  'bottom line', 'big picture', 'go-to', 'under the weather', 'call it a day', 'worth the trip', 'pros and cons',
  'ins and outs', 'the hang of',
];

const words = (idea: string) => idea.split(' ').filter(Boolean);

describe('"If you get stuck" ideas', () => {
  it('every prompt has exactly three', () => {
    for (const p of MINUTE_PROMPTS) expect([p.id, p.ideas?.length]).toEqual([p.id, 3]);
  });

  it('each idea is 2 to 6 words, with no doubled or stray spaces', () => {
    for (const p of MINUTE_PROMPTS) {
      for (const idea of p.ideas ?? []) {
        expect(idea).toBe(idea.trim());
        expect(idea).not.toMatch(/\s{2,}/);
        const n = words(idea).length;
        if (n < 2 || n > 6) throw new Error(`${p.id} "${idea}" has ${n} words`);
      }
    }
  });

  it('no two ideas in a prompt are the same', () => {
    for (const p of MINUTE_PROMPTS) {
      const lower = (p.ideas ?? []).map((i) => i.toLowerCase());
      expect([p.id, new Set(lower).size]).toEqual([p.id, lower.length]);
    }
  });

  it('sentence case: a capital first letter, no other capitals except "I", no full stop or question mark', () => {
    for (const p of MINUTE_PROMPTS) {
      for (const idea of p.ideas ?? []) {
        const [first, ...rest] = words(idea);
        if (!/^[A-Z]/.test(first)) throw new Error(`${p.id} "${idea}" should start with a capital`);
        for (const w of rest) if (/[A-Z]/.test(w) && w !== 'I') throw new Error(`${p.id} "${idea}": "${w}" is not sentence case`);
        expect(idea).not.toMatch(/[.?!]$/);
      }
    }
  });

  it('no slang, idioms or framing from the banned lists', () => {
    for (const p of MINUTE_PROMPTS) {
      for (const idea of p.ideas ?? []) {
        const lower = idea.toLowerCase();
        for (const w of lower.split(/[^a-z'’-]+/)) if (BANNED_WORDS.includes(w)) throw new Error(`${p.id} "${idea}": "${w}" is banned`);
        for (const phrase of BANNED_PHRASES) if (lower.includes(phrase)) throw new Error(`${p.id} "${idea}": "${phrase}" is banned`);
      }
    }
  });

  it('the banned-word check catches a bad idea (guards the test itself)', () => {
    const bad = 'Your boss and some stuff'.toLowerCase().split(/[^a-z'’-]+/);
    expect(bad.filter((w) => BANNED_WORDS.includes(w))).toEqual(['boss', 'stuff']);
  });
});
