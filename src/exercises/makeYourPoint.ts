// Make your point: answer with a point, a reason and an example, first with the prompts showing,
// then without them. Pure logic, tested in test/makeYourPoint.test.ts.
//
// The reader checks their own answer. The phone can count words and time, but it can't tell whether
// a point is clear or a reason is good, so nothing here scores argument quality (principle 1).

import { countFreeTalk, tokenise } from '../engine/align';

export type PointTask = { id: string; question: string };

/** Ids are what analytics sees, never the text, so never reuse or renumber one. Plain words, no idioms. */
export const POINT_TASKS: readonly PointTask[] = [
  { id: 'mp01', question: 'Should phones be allowed at the dinner table?' },
  { id: 'mp02', question: 'Is it better to live in a city or a small town?' },
  { id: 'mp03', question: 'Should children learn to cook at school?' },
  { id: 'mp04', question: 'Is it better to plan a holiday or decide when you get there?' },
  { id: 'mp05', question: 'Should people work four days a week?' },
  { id: 'mp06', question: 'Is it better to read the book or watch the film?' },
  { id: 'mp07', question: 'Should everyone learn a second language?' },
  { id: 'mp08', question: 'Is it better to rent a home or buy one?' },
  { id: 'mp09', question: 'Should you tell a friend when you dislike their idea?' },
  { id: 'mp10', question: 'Is it better to be early or exactly on time?' },
  { id: 'mp11', question: 'Should people keep paper books at home?' },
  { id: 'mp12', question: 'Is it better to work alone or in a team?' },
];

export type PointPart = 'point' | 'reason' | 'example';
export const POINT_PARTS: readonly PointPart[] = ['point', 'reason', 'example'];

/** The prompts shown on the first attempt, and on request on the second. */
export const PART_STARTER: Record<PointPart, string> = {
  point: 'My point is…',
  reason: 'I think this because…',
  example: 'For example…',
};

export const PART_CHECK: Record<PointPart, string> = {
  point: 'I said my point clearly',
  reason: 'I gave a reason',
  example: 'I gave an example',
};

export const POINT_LIMIT_SECONDS = 60;
/** Fewer words than this is a failed attempt: nothing to check, so Try again (principle 8). */
export const MIN_POINT_WORDS = 5;

export type SelfCheck = Record<PointPart, boolean>;
export const EMPTY_CHECK: SelfCheck = { point: false, reason: false, example: false };

export type PointAttempt = {
  words: number;
  seconds: number; // from the first word to the end
  firstWordSeconds: number;
  um: number; // the um and uh the phone heard; it misses some
  check: SelfCheck;
  hinted: boolean; // opened the prompts on an attempt that hides them
};

export function partsSaid(check: SelfCheck): number {
  return POINT_PARTS.filter((p) => check[p]).length;
}

/** What the phone can measure about an attempt. `firstWordAt` is 0 if no word was heard. */
export function measureAttempt(transcript: string, startedAt: number, firstWordAt: number, endedAt: number): Omit<PointAttempt, 'check' | 'hinted'> {
  const counts = countFreeTalk(tokenise(transcript));
  const first = firstWordAt || endedAt;
  return {
    words: counts.spoken,
    seconds: Math.max(0, Math.round((endedAt - first) / 1000)),
    firstWordSeconds: Math.max(0, Math.round((first - startedAt) / 100) / 10),
    um: counts.fillerCount,
  };
}

/** The one thing to work on in the next attempt, from what the reader said was missing. */
export function focusFor(check: SelfCheck): string {
  if (!check.point) return 'Start with your point. Say it in your first sentence.';
  if (!check.reason) return 'After your point, say why you think it.';
  if (!check.example) return 'Add one real example: a person, a place or a time.';
  return 'You had all three parts. Now say them without the prompts.';
}

/**
 * The one change worth naming between two attempts. It reports only what happened, and it never
 * says the second answer was better: a shorter answer or a thinking pause isn't a flaw.
 */
export function changeBetween(first: PointAttempt, second: PointAttempt): string {
  const a = partsSaid(first.check);
  const b = partsSaid(second.check);
  if (b > a) return `You included ${b} of the 3 parts this time, up from ${a}.`;
  if (b === 3 && !second.hinted) return 'You said all three parts without the prompts.';
  if (b < a) return `You included ${b} of the 3 parts this time, down from ${a}. Try once more with the missing part in mind.`;
  const sooner = Math.round(first.firstWordSeconds - second.firstWordSeconds);
  if (sooner >= 2) return `You started ${sooner} seconds sooner.`;
  if (b === 3) return 'You included all three parts both times.';
  if (b === 0) return 'You didn’t check any parts either time. Start with your point.';
  return 'You included the same number of parts both times. Pick the missing one and try again.';
}

/** The next question: the least recently practised, skipping `current`. Stable for the same history. */
export function nextPointTask(history: readonly { taskId: string; at: number }[], current?: string): PointTask {
  const last = new Map<string, number>();
  for (const h of history) last.set(h.taskId, Math.max(h.at, last.get(h.taskId) ?? 0));
  const pool = POINT_TASKS.filter((t) => t.id !== current);
  let best = pool[0];
  for (const t of pool) if ((last.get(t.id) ?? 0) < (last.get(best.id) ?? 0)) best = t;
  return best;
}

export function pointTaskById(id: string | undefined): PointTask | undefined {
  return POINT_TASKS.find((t) => t.id === id);
}
