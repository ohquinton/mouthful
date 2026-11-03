import { MINUTE_PROMPTS, type Prompt, type PromptLevel } from './prompts';
import { calendarDay } from '../engine/days';

export type Experience = 'articulation' | 'english';

/** Presentation choices only. These never rewrite the historical Profile.line or saved sessions. */
export const EXPERIENCES = {
  articulation: {
    name: 'Articulation',
    line: 'sharp',
    promise: 'Find your words. Make your point.',
    description: 'Think on your feet, notice fillers, and practise expressing your ideas.',
    features: ['Topic talks and filler feedback', 'Precise vocabulary', 'Pace and delivery practice'],
    levels: [2, 3] as readonly PromptLevel[],
    packs: ['precision', 'raise', 'finance', 'tech', 'interview', 'present'],
  },
  english: {
    name: 'English Speaking',
    line: 'clear',
    promise: 'Build ease in everyday English.',
    description: 'Read aloud, practise useful words, and speak about familiar things.',
    features: ['Guided reading and word practice', 'Everyday speaking topics', 'Useful English in context'],
    levels: [1] as readonly PromptLevel[],
    packs: ['meetings', 'precision'],
  },
} as const;

/** A predictable topic within this experience; the same local date gives the same suggestion. */
export function experienceTopic(mode: Experience, date: Date): Prompt {
  const levels: readonly PromptLevel[] = EXPERIENCES[mode].levels;
  const pool = MINUTE_PROMPTS.filter((p) => levels.includes(p.level));
  const day = calendarDay(date);
  return pool[((day % pool.length) + pool.length) % pool.length];
}

/** Keep topic changes within the chosen experience, preserving the explicitly opened first topic. */
export function experiencePromptAfter(mode: Experience, base: Prompt, steps: number): Prompt {
  if (steps === 0) return base;
  const levels: readonly PromptLevel[] = EXPERIENCES[mode].levels;
  const pool = MINUTE_PROMPTS.filter((p) => levels.includes(p.level));
  const start = pool.findIndex((p) => p.id === base.id);
  return pool[((start + steps) % pool.length + pool.length) % pool.length];
}
