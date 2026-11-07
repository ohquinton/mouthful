/**
 * The English Speaking starter: six everyday situations, written by us.
 *
 * Ids are stable and never renumbered or reused: analytics and saved results see only these ids,
 * and check ids. Copy stays in plain English with no idioms, and away from the workplace.
 */

/** One thing the reader can tick about what they did. `nextTime` is the advice if they don't. */
export type SituationCheck = { id: string; label: string; nextTime: string };

export type Situation = {
  id: string;
  title: string;
  /** The task, in one plain sentence. */
  task: string;
  /** Short phrases that do the task. Read aloud or on screen. */
  examples: string[];
  /** The line the reader responds to. */
  otherSays: string;
  starters: string[];
  checks: SituationCheck[];
  /** Advice once every check is ticked and no starters were opened. */
  stretch: string;
};

export const SITUATIONS: readonly Situation[] = [
  {
    id: 'meet_new',
    title: 'Meeting someone new',
    task: 'Say hello to someone new, tell them your name, and ask them one question.',
    examples: ['Nice to meet you. I am Ana.', 'I live near here.', 'How do you know Maria?'],
    otherSays: 'Hi, I don’t think we have met. I’m Sam.',
    starters: ['Nice to meet you, I am…', 'I live…', 'What about you, do you…'],
    checks: [
      { id: 'name', label: 'I said my name.', nextTime: 'Next time, say your name in your first sentence.' },
      { id: 'question', label: 'I asked them a question.', nextTime: 'Next time, finish with one question, such as “Where do you live?”' },
    ],
    stretch: 'Next time, add one more thing about yourself, such as where you live.',
  },
  {
    id: 'ask_help',
    title: 'Asking for help',
    task: 'Say what you need, ask for help with it, and say thank you.',
    examples: ['Yes, please. I am looking for the pharmacy.', 'Could you show me where it is?', 'Thank you, that is very kind.'],
    otherSays: 'Hello, you look a little lost. Can I help you?',
    starters: ['I am looking for…', 'Could you show me…', 'Thank you for…'],
    checks: [
      { id: 'need', label: 'I said what I need.', nextTime: 'Next time, name the thing you need in your first sentence.' },
      { id: 'ask', label: 'I asked for help with it.', nextTime: 'Next time, ask directly, starting with “Could you…”' },
      { id: 'thanks', label: 'I said thank you.', nextTime: 'Next time, finish by saying “Thank you.”' },
    ],
    stretch: 'Next time, ask one more question about what they told you, such as “Is it far?”',
  },
  {
    id: 'explain_problem',
    title: 'Explaining a problem',
    task: 'Say what is wrong, say when it started, and ask for what you would like done.',
    examples: ['The heating in my room is not working.', 'It stopped last night.', 'Could someone look at it today?'],
    otherSays: 'Hello, this is the front desk. What is the problem?',
    starters: ['The … is not working.', 'It started…', 'Could someone…'],
    checks: [
      { id: 'what', label: 'I said what is wrong.', nextTime: 'Next time, start by naming the thing that is wrong.' },
      { id: 'when', label: 'I said when it started.', nextTime: 'Next time, add when it started, such as “It stopped last night.”' },
      { id: 'request', label: 'I asked for what I would like done.', nextTime: 'Next time, finish by asking for what you want, starting with “Could someone…”' },
    ],
    stretch: 'Next time, add what you have already tried.',
  },
  {
    id: 'arrange_plans',
    title: 'Arranging plans',
    task: 'Suggest a day, a time and a place to meet a friend.',
    examples: ['I am free on Saturday morning.', 'Shall we meet at ten?', 'How about the café near the station?'],
    otherSays: 'It would be nice to see you this week. When are you free?',
    starters: ['I am free on…', 'Shall we meet at…', 'How about…'],
    checks: [
      { id: 'day', label: 'I suggested a day.', nextTime: 'Next time, name a day, such as “I am free on Saturday.”' },
      { id: 'time', label: 'I suggested a time.', nextTime: 'Next time, name a time, such as “Shall we meet at ten?”' },
      { id: 'place', label: 'I suggested a place.', nextTime: 'Next time, name a place, starting with “How about…”' },
    ],
    stretch: 'Next time, offer a second day in case the first one does not work.',
  },
  {
    id: 'clarify',
    title: 'Clearing up a misunderstanding',
    task: 'Say there is a misunderstanding, say what you understood, and ask what they meant.',
    examples: ['Sorry, I think we misunderstood each other.', 'I thought the dinner was on Saturday.', 'Can you tell me what you meant?'],
    otherSays: 'Wait, I thought you were bringing the food on Friday.',
    starters: ['Sorry, I think…', 'I thought…', 'Can you tell me…'],
    checks: [
      { id: 'name_it', label: 'I said there is a misunderstanding.', nextTime: 'Next time, start with “Sorry, I think we misunderstood each other.”' },
      { id: 'understood', label: 'I said what I understood.', nextTime: 'Next time, say what you understood, starting with “I thought…”' },
      { id: 'ask_meant', label: 'I asked what they meant.', nextTime: 'Next time, finish by asking, “Can you tell me what you meant?”' },
    ],
    stretch: 'Next time, finish by saying what you will do now.',
  },
  {
    id: 'late',
    title: 'Explaining you are late',
    task: 'Say you will be late, say why, and say when you will arrive.',
    examples: ['I am so sorry, I am going to be late.', 'My bus did not come.', 'I will be there in twenty minutes.'],
    otherSays: 'Hi, where are you? We are all here already.',
    starters: ['I am sorry, I am…', 'My … did not…', 'I will be there in…'],
    checks: [
      { id: 'say_late', label: 'I said I will be late.', nextTime: 'Next time, say it first: “I am going to be late.”' },
      { id: 'why', label: 'I said why.', nextTime: 'Next time, give the reason in one short sentence.' },
      { id: 'arrive', label: 'I said when I will arrive.', nextTime: 'Next time, give a time, such as “I will be there in twenty minutes.”' },
    ],
    stretch: 'Next time, add what they can do while they wait, such as “Please start without me.”',
  },
];

/** Route params are never trusted: unknown ids give nothing. */
export function situationById(id: unknown): Situation | undefined {
  return typeof id === 'string' ? SITUATIONS.find((s) => s.id === id) : undefined;
}
