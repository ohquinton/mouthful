// Original passages. Rules (see CLAUDE.md): 60–120 words, at least one comma-heavy
// sentence, two "trip words" of 3+ syllables, things adults actually say out loud.

export type Level = 'Steady' | 'Flowing' | 'Sharp';

export type Passage = {
  id: string;
  title: string;
  level: Level;
  text: string;
};

export const PASSAGES: Passage[] = [
  {
    id: 'night-shift',
    title: 'The Night Shift',
    level: 'Steady',
    text:
      'Yesterday the ward was quiet, until the storm knocked the power out. Mara steadied the lantern, particularly careful with the new generator, and walked the hallway room by room. Nobody panicked. A patient in bed four asked if this happened often. Not often, she said, but often enough that we know what to do. By midnight the lights were back, the monitors were humming, and the coffee in the break room was, unfortunately, still terrible.',
  },
  {
    id: 'standup',
    title: 'Monday Standup',
    level: 'Steady',
    text:
      'Quick update from me. Last week I finished the reconciliation for the second quarter, and the numbers finally match. Today I am working on the summary for the finance team. I am blocked on one thing: I still need access to the shared reporting folder. If someone can approve that this morning, I can have a draft ready by Wednesday. That is everything from my side.',
  },
  {
    id: 'signal-noise',
    title: 'Signal and Noise',
    level: 'Flowing',
    text:
      'Most of what we hear in a day is noise. The trick is not to block it out, but to notice the few things that actually matter. A good listener filters quietly, catches the important detail, and answers the question that was asked rather than the one they expected. It sounds simple. In practice, it is one of the most valuable and underestimated skills in any meeting.',
  },
  {
    id: 'first-snow',
    title: 'First Snow',
    level: 'Flowing',
    text:
      'The first snow in the city never lasts. It lands on parked cars and railings, turns the park into a clean white page, and then the plows arrive. By noon it is grey slush at the curb, splashed by every passing bus. But for one quiet hour in the morning, everyone walks a little slower, looks up a little more, and remembers why they stayed through another winter.',
  },
  {
    id: 'interview',
    title: 'The Interview Answer',
    level: 'Sharp',
    text:
      'Tell me about a time you failed. Two years ago I underestimated a deadline, specifically the data migration for a regional client. I assumed the records were consistent; they were not. We delivered nine days late. Afterwards, I introduced a validation step before every migration, and I now build a buffer into every estimate. Statistically, our last twelve projects have landed on time. The failure was expensive, but the habit it created has been worth considerably more.',
  },
  {
    id: 'twisters',
    title: 'Warm-up: Tongue Twisters',
    level: 'Sharp',
    text:
      'Red lorry, yellow lorry, red lorry, yellow lorry. Six slippery snails slid slowly seaward. Unique New York, you know you need unique New York. A proper copper coffee pot. Particularly peculiar pickled peppers, particularly early, particularly often. Thirty-three thirsty, thundering thoroughbreds thumped Mister Thurber on Thursday.',
  },
];

export function passageOfTheDay(date = new Date()): Passage {
  const day = Math.floor(date.getTime() / 86_400_000);
  return PASSAGES[day % PASSAGES.length];
}

export function getPassage(id: string): Passage | undefined {
  return PASSAGES.find((p) => p.id === id);
}

export function estimateSeconds(text: string, wpm = 150): number {
  return Math.round((text.split(/\s+/).length / wpm) * 60);
}

export function formatDuration(sec: number): string {
  return sec >= 60 ? `${Math.floor(sec / 60)} min ${sec % 60} s` : `${sec} s`;
}
