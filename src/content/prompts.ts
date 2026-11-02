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
  { id: 'p02', level: 1, text: 'Rain', ideas: ['What rain sounds like', 'A rainy day you remember', 'What you do when it rains'] },
  { id: 'p03', level: 1, text: 'Your phone', related: ['mobile', 'smartphone', 'cellphone'], ideas: ['What you use it for most', 'The first phone you had', 'A day without it'] },
  { id: 'p04', level: 1, text: 'Bread', ideas: ['How you like to eat it', 'Bread where you grew up', 'The smell of fresh bread'] },
  { id: 'p05', level: 1, text: 'The bus', related: ['coach'], ideas: ['A bus ride you remember', 'The people you see on it', 'The bus or walking, and why'] },
  { id: 'p06', level: 1, text: 'Shoes', ideas: ['The shoes you wear most', 'Shoes for different places', 'Buying a new pair'] },
  { id: 'p07', level: 1, text: 'A window', ideas: ['The view from your window', 'Open or closed, and why', 'Watching the weather outside'] },
  { id: 'p08', level: 1, text: 'Your kitchen', ideas: ['What it looks like', 'Something you make there', 'The busiest time of day'] },
  { id: 'p09', level: 1, text: 'A clock', ideas: ['Where you see one', 'Clocks on walls and phones', 'When time feels slow'] },
  { id: 'p10', level: 1, text: 'A bicycle', related: ['bike', 'cycle'], ideas: ['Bikes in your city', 'Why people choose them', 'A bicycle compared with a bus'] },
  { id: 'p11', level: 1, text: 'Keys', related: ['keyring'], ideas: ['The keys you carry', 'A time you lost them', 'Keys or a number code'] },
  { id: 'p12', level: 1, text: 'A river', ideas: ['A river you have seen', 'What people do by rivers', 'Why cities grow near rivers'] },

  { id: 'p13', level: 2, text: 'Trust', ideas: ['Someone you trust', 'How people earn it', 'Trusting a stranger'] },
  { id: 'p14', level: 2, text: 'Time', ideas: ['When time goes fast', 'How you spend your mornings', 'Why time feels short'] },
  { id: 'p15', level: 2, text: 'Risk', ideas: ['A small risk you took', 'Safe choices or bold ones', 'Why some people enjoy risk'] },
  { id: 'p16', level: 2, text: 'Luck', ideas: ['A lucky moment you remember', 'Luck or hard work', 'Things people do for luck'] },
  { id: 'p17', level: 2, text: 'Patience', related: ['wait'], ideas: ['Waiting in a long line', 'Someone with a lot of patience', 'When waiting is hardest'] },
  { id: 'p18', level: 2, text: 'Change', ideas: ['A change you liked', 'Why change can feel hard', 'How your town has changed'] },
  { id: 'p19', level: 2, text: 'Home', ideas: ['What makes a place home', 'A home you remember', 'Home as a feeling'] },
  { id: 'p20', level: 2, text: 'Success', ideas: ['What success means to you', 'Someone you think is successful', 'Big wins and small wins'] },
  { id: 'p21', level: 2, text: 'Kindness', related: ['nice', 'kind-hearted'], ideas: ['A kind thing someone did', 'Kindness to strangers', 'Why small kindness matters'] },
  { id: 'p22', level: 2, text: 'Freedom', related: ['liberty'], ideas: ['What freedom means to you', 'A small everyday freedom', 'Freedom and rules'] },
  { id: 'p23', level: 2, text: 'Habits', related: ['routine'], ideas: ['A habit you are proud of', 'How a habit starts', 'A habit you want to build'] },
  { id: 'p24', level: 2, text: 'Silence', ideas: ['A quiet place you like', 'Silence in a conversation', 'Silence or music, and why'] },

  // Level 3 is Free talk's original 12, in their original order (promptOfTheDay still uses them).
  { id: 'p25', level: 3, text: 'Explain what you do for work to a ten-year-old.', ideas: ['Your work or studies, simply', 'One thing you did today', 'Why it helps people'] },
  { id: 'p26', level: 3, text: 'Tell me why I should try your favourite restaurant.', ideas: ['What you always order there', 'What the place feels like', 'What makes it different'] },
  { id: 'p27', level: 3, text: 'What’s one opinion you hold that most people disagree with?', ideas: ['Your opinion, simply', 'Why you think it', 'What most people say instead'] },
  { id: 'p28', level: 3, text: 'Describe the best meal you’ve ever had.', ideas: ['Where you were', 'What you ate', 'Why you still remember it'] },
  { id: 'p29', level: 3, text: 'Teach me something you learned this week.', ideas: ['What it is, simply', 'Where you learned it', 'Why it is useful'] },
  { id: 'p30', level: 3, text: 'What would you do with an extra hour every day?', ideas: ['What you would do first', 'Why that matters to you', 'How your week would change'] },
  { id: 'p31', level: 3, text: 'Give a short update on a project you’re working on.', ideas: ['What the project is', 'What is done so far', 'What comes next'] },
  { id: 'p32', level: 3, text: 'Tell me about a time a plan went wrong, and what you did.', ideas: ['What the plan was', 'The moment it went wrong', 'What you did next'] },
  { id: 'p33', level: 3, text: 'Introduce yourself as if it’s your first day at a new job.', ideas: ['Your name and your background', 'Something you enjoy doing', 'What you hope to learn'] },
  { id: 'p34', level: 3, text: 'Convince me to visit the city you live in.', ideas: ['The best thing about it', 'One place to see first', 'The food you can try there'] },
  { id: 'p35', level: 3, text: 'Explain a hobby of yours to someone who has never tried it.', ideas: ['What the hobby is', 'How you got started', 'The first step to try it'] },
  { id: 'p36', level: 3, text: 'What advice would you give yourself five years ago?', ideas: ['Where you were five years ago', 'The advice, simply', 'How it would have helped'] },
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
