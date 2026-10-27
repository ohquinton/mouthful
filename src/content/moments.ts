import type { PaceContext } from '../engine/score';

// "What are you preparing for?" Each moment is a five-step plan built from the same
// engine: a Word Pack, Glide passages, your own script and a re-test.

export type MomentId = 'interview' | 'presentation' | 'raise' | 'meeting';

export type StepId = 'learn' | 'context' | 'script' | 'rehearse' | 'retest';

export type Moment = {
  id: MomentId;
  title: string; // "Job interview"
  short: string; // "interview", used in "Your interview is in 3 days"
  sub: string;
  icon: 'briefcase-outline' | 'easel-outline' | 'cash-outline' | 'people-outline';
  packId: string;
  pace: PaceContext;
  scriptPrompt: string;
  scriptPlaceholder: string;
};

export const MOMENTS: Moment[] = [
  {
    id: 'interview',
    title: 'Job interview',
    short: 'interview',
    sub: 'Practise your answers out loud',
    icon: 'briefcase-outline',
    packId: 'interview',
    pace: 'talking',
    scriptPrompt: 'Paste your answer to the question you’re dreading.',
    scriptPlaceholder: 'Tell me about yourself… I’m a data analyst with three years of experience in…',
  },
  {
    id: 'presentation',
    title: 'Presentation',
    short: 'presentation',
    sub: 'Deliver it with clarity',
    icon: 'easel-outline',
    packId: 'present',
    pace: 'presenting',
    scriptPrompt: 'Paste your talk or your speaker notes.',
    scriptPlaceholder: 'Good morning, everyone. Today I want to walk you through…',
  },
  {
    id: 'raise',
    title: 'Ask for a raise',
    short: 'raise conversation',
    sub: 'Make your case calmly',
    icon: 'cash-outline',
    packId: 'raise',
    pace: 'talking',
    scriptPrompt: 'Paste the case you want to make.',
    scriptPlaceholder: 'Thanks for making time for this. Over the past year I’ve…',
  },
  {
    id: 'meeting',
    title: 'Big meeting',
    short: 'meeting',
    sub: 'Lead it without rushing',
    icon: 'people-outline',
    packId: 'meetings',
    pace: 'presenting',
    scriptPrompt: 'Paste your update or talking points.',
    scriptPlaceholder: 'Quick update from me. Last week we…',
  },
];

export function getMoment(id: string | undefined): Moment | undefined {
  return MOMENTS.find((m) => m.id === id);
}

export type PlanStep = { id: StepId; title: string; sub: string; pro: boolean };

export function planSteps(m: Moment): PlanStep[] {
  return [
    { id: 'learn', title: 'Learn the words', sub: '8 words, how to say them', pro: false },
    { id: 'context', title: 'Say them in context', sub: 'A short passage with Glide', pro: false },
    { id: 'script', title: 'Add your real words', sub: m.scriptPrompt, pro: true },
    { id: 'rehearse', title: 'Rehearse it', sub: 'Read your version with Glide', pro: true },
    { id: 'retest', title: 'Final run-through', sub: 'Cold read, like the real thing', pro: false },
  ];
}

/** Whole days from today until the event (local dates). Negative once it's passed. */
export function daysUntil(dateIso: string, now = new Date()): number {
  const [y, mo, d] = dateIso.split('-').map(Number);
  const event = new Date(y, mo - 1, d).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((event - today) / 86_400_000);
}

export function countdownLabel(m: Moment, dateIso?: string, now = new Date()): string {
  if (!dateIso) return `Preparing for your ${m.short}`;
  const n = daysUntil(dateIso, now);
  if (n < 0) return `Your ${m.short} has passed. How did it go?`;
  if (n === 0) return `Your ${m.short} is today`;
  if (n === 1) return `Your ${m.short} is tomorrow`;
  return `Your ${m.short} is in ${n} days`;
}

export function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** The first step not done yet, or undefined when the plan is complete. */
export function nextStep(steps: PlanStep[], done: StepId[]): PlanStep | undefined {
  return steps.find((s) => !done.includes(s.id));
}
