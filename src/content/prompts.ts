import { localDay } from './passages';

// One Minute prompts (docs/briefs/one-minute.md). 12 per level:
//   1 = an everyday thing you can see or touch, 2 = an idea, 3 = a short work or life topic.
// Rules for new ones: plain words an English learner knows, no idioms, holidays, sport or brands.
// The ids are what analytics sees (`which: 'p07'`), never the text, so never reuse or renumber one.

export type PromptLevel = 1 | 2 | 3;
export type Prompt = {
  id: string;
  level: PromptLevel;
  text: string;
  /**
   * Synonyms of the topic (bike for "A bicycle"). Passed to minuteSummary as `related`, so talking
   * about the topic is never flagged as a repeated word (engine/wording.ts promptFamily).
   */
  related?: readonly string[];
  /** "If you get stuck" starter ideas, three short phrases. Shown on the ready screen when present. */
  ideas?: readonly string[];
};

/** What each level is, for the eyebrow above the prompt. */
export const LEVEL_NAME: Record<PromptLevel, string> = { 1: 'Everyday thing', 2: 'An idea', 3: 'A topic' };

export const MINUTE_PROMPTS: readonly Prompt[] = [
  { id: 'p01', level: 1, text: 'Coffee', ideas: ['How you take it', 'A café you like', 'Why so many people drink it'] },
  { id: 'p02', level: 1, text: 'Rain' },
  { id: 'p03', level: 1, text: 'Your phone', related: ['mobile', 'smartphone', 'cellphone'] },
  { id: 'p04', level: 1, text: 'Bread' },
  { id: 'p05', level: 1, text: 'The bus', related: ['coach'] },
  { id: 'p06', level: 1, text: 'Shoes' },
  { id: 'p07', level: 1, text: 'A window' },
  { id: 'p08', level: 1, text: 'Your kitchen' },
  { id: 'p09', level: 1, text: 'A clock' },
  { id: 'p10', level: 1, text: 'A bicycle', related: ['bike', 'cycle'] },
  { id: 'p11', level: 1, text: 'Keys', related: ['keyring'] },
  { id: 'p12', level: 1, text: 'A river' },

  { id: 'p13', level: 2, text: 'Trust' },
  { id: 'p14', level: 2, text: 'Time' },
  { id: 'p15', level: 2, text: 'Risk' },
  { id: 'p16', level: 2, text: 'Luck' },
  { id: 'p17', level: 2, text: 'Patience', related: ['wait'] },
  { id: 'p18', level: 2, text: 'Change' },
  { id: 'p19', level: 2, text: 'Home' },
  { id: 'p20', level: 2, text: 'Success' },
  { id: 'p21', level: 2, text: 'Kindness', related: ['nice', 'kind-hearted'] },
  { id: 'p22', level: 2, text: 'Freedom', related: ['liberty'] },
  { id: 'p23', level: 2, text: 'Habits', related: ['routine'] },
  { id: 'p24', level: 2, text: 'Silence' },

  // Level 3 is Free talk's original 12, in their original order (promptOfTheDay still uses them).
  { id: 'p25', level: 3, text: 'Explain what you do for work to a ten-year-old.' },
  { id: 'p26', level: 3, text: 'Tell me why I should try your favourite restaurant.' },
  { id: 'p27', level: 3, text: 'What’s one opinion you hold that most people disagree with?' },
  { id: 'p28', level: 3, text: 'Describe the best meal you’ve ever had.' },
  { id: 'p29', level: 3, text: 'Teach me something you learned this week.' },
  { id: 'p30', level: 3, text: 'What would you do with an extra hour every day?' },
  { id: 'p31', level: 3, text: 'Give a short update on a project you’re working on.' },
  { id: 'p32', level: 3, text: 'Tell me about a time a plan went wrong, and what you did.' },
  { id: 'p33', level: 3, text: 'Introduce yourself as if it’s your first day at a new job.' },
  { id: 'p34', level: 3, text: 'Convince me to visit the city you live in.' },
  { id: 'p35', level: 3, text: 'Explain a hobby of yours to someone who has never tried it.' },
  { id: 'p36', level: 3, text: 'What advice would you give yourself five years ago?' },
];

/** A prompt by id (a route param or a saved session's promptId), or undefined for an unknown id. */
export function promptById(id: string | undefined): Prompt | undefined {
  return id ? MINUTE_PROMPTS.find((p) => p.id === id) : undefined;
}

/** The old Free talk prompts: level 3's text. Free talk is gone (topic talk replaced it); kept for promptOfTheDay's tests. */
export const PROMPTS: readonly string[] = MINUTE_PROMPTS.filter((p) => p.level === 3).map((p) => p.text);

/**
 * The order One Minute walks through: level 1, 2, 3, then the next of each, so days take turns
 * between an easy word, an idea and a topic. All 36 come round once before any repeats.
 */
const ROTATION: readonly Prompt[] = (() => {
  const byLevel = ([1, 2, 3] as const).map((l) => MINUTE_PROMPTS.filter((p) => p.level === l));
  const out: Prompt[] = [];
  for (let i = 0; i < byLevel[0].length; i++) for (const list of byLevel) out.push(list[i]);
  return out;
})();

/**
 * One Minute's prompt for a local calendar day (localDay). `offset` is how many times the reader
 * tapped "Different word". It depends only on the date, not on hours passed, so a flight or a
 * clock change moves it on by exactly the days the calendar moved: never skipped, never doubled.
 */
export function minutePromptForDay(day: number, offset = 0): Prompt {
  const n = ROTATION.length;
  return ROTATION[(((day + offset) % n) + n) % n];
}

/**
 * The prompt `steps` places after `p` in the rotation: "Different topic" when a stop or onboarding
 * chose the prompt rather than the day. 0 steps gives `p` itself.
 */
export function promptAfter(p: Prompt, steps: number): Prompt {
  const n = ROTATION.length;
  const at = ROTATION.findIndex((x) => x.id === p.id);
  return ROTATION[(((at + steps) % n) + n) % n];
}

export function minutePromptOfTheDay(date = new Date(), offset = 0): Prompt {
  return minutePromptForDay(localDay(date), offset);
}

/** The old Free talk prompt of the day. Nothing in the app uses it since topic talk; locale.test.ts still checks its day maths. */
export function promptOfTheDay(date = new Date(), offset = 0): string {
  return PROMPTS[(localDay(date) + offset) % PROMPTS.length];
}
