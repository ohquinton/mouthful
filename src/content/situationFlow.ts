import { SITUATIONS, type Situation } from './situations';

/**
 * The steps of one situation, as plain functions so they are tested without a phone.
 *
 * Nothing here marks what the reader said. The word count only decides whether the phone heard
 * enough to go on, and the ticks are the reader's own (principle 1).
 */

export type SituationStage = 'example' | 'supported' | 'independent' | 'selfcheck' | 'result';

/** Fewer heard words than this is a too-short attempt. A real answer can be as short as "Yes, I'm Ana." */
export const MIN_RESPONSE_WORDS = 3;

export type SituationFlow = {
  stage: SituationStage;
  /** 1 for the first go; each retry from the result adds one. */
  attempt: number;
  /** Did the reader open the hidden starters on this attempt's independent step? */
  startersOpened: boolean;
  supportedWords: number;
  independentWords: number;
  /** Check ids the reader ticked. */
  ticks: string[];
  /** Words heard on a too-short attempt at this step; null when there is no such attempt. */
  tooShort: number | null;
};

/** What is saved: numbers, booleans and our own ids. There is no place here for what was said. */
export type SituationRecord = {
  situationId: string;
  at: number;
  attempt: number;
  startersOpened: boolean;
  supportedWords: number;
  independentWords: number;
  ticks: string[];
  checks: number;
};

export function startFlow(): SituationFlow {
  return { stage: 'example', attempt: 1, startersOpened: false, supportedWords: 0, independentWords: 0, ticks: [], tooShort: null };
}

/** Steps shown as "Step n of 4", and the label for each. The result sits outside the count. */
export function stageStep(stage: SituationStage): { step: number; label: string } {
  switch (stage) {
    case 'example': return { step: 1, label: 'See some examples' };
    case 'supported': return { step: 2, label: 'Answer with help' };
    case 'independent': return { step: 3, label: 'Answer on your own' };
    default: return { step: 4, label: 'Check it yourself' };
  }
}

export function readyToRespond(flow: SituationFlow): SituationFlow {
  return flow.stage === 'example' ? { ...flow, stage: 'supported' } : flow;
}

/** The mic has stopped: too little heard stays on this step, otherwise the next step opens. */
export function responseHeard(flow: SituationFlow, words: number): SituationFlow {
  if (flow.stage !== 'supported' && flow.stage !== 'independent') return flow;
  if (words < MIN_RESPONSE_WORDS) return { ...flow, tooShort: words };
  return flow.stage === 'supported'
    ? { ...flow, stage: 'independent', supportedWords: words, tooShort: null }
    : { ...flow, stage: 'selfcheck', independentWords: words, tooShort: null };
}

/** Try again after a too-short attempt. Starters already opened stay on record for this attempt. */
export function clearTooShort(flow: SituationFlow): SituationFlow {
  return flow.tooShort === null ? flow : { ...flow, tooShort: null };
}

/** Only the independent step records this: starters are simply visible on the supported step. */
export function openStarters(flow: SituationFlow): SituationFlow {
  return flow.stage === 'independent' ? { ...flow, startersOpened: true } : flow;
}

export function toggleTick(flow: SituationFlow, checkId: string): SituationFlow {
  if (flow.stage !== 'selfcheck') return flow;
  const ticks = flow.ticks.includes(checkId) ? flow.ticks.filter((t) => t !== checkId) : [...flow.ticks, checkId];
  return { ...flow, ticks };
}

export function finishCheck(flow: SituationFlow): SituationFlow {
  return flow.stage === 'selfcheck' ? { ...flow, stage: 'result' } : flow;
}

/** Another go at the same task, on your own: starters hidden again and everything from the last go cleared. */
export function retry(flow: SituationFlow): SituationFlow {
  return { ...flow, stage: 'independent', attempt: flow.attempt + 1, startersOpened: false, independentWords: 0, ticks: [], tooShort: null };
}

export function situationRecord(situation: Situation, flow: SituationFlow, at: number): SituationRecord {
  return {
    situationId: situation.id,
    at,
    attempt: flow.attempt,
    startersOpened: flow.startersOpened,
    supportedWords: flow.supportedWords,
    independentWords: flow.independentWords,
    ticks: situation.checks.filter((c) => flow.ticks.includes(c.id)).map((c) => c.id),
    checks: situation.checks.length,
  };
}

/**
 * The result's one piece of advice: what exactly to do differently on the next attempt. It comes
 * only from the reader's ticks and whether they opened the starters, never from what was heard.
 */
export function situationFeedback(situation: Situation, flow: SituationFlow): { selfChecked: string; starters: string; nextTime: string } {
  const missed = situation.checks.filter((c) => !flow.ticks.includes(c.id));
  const ticked = situation.checks.length - missed.length;
  return {
    selfChecked: `Self-checked: you ticked ${ticked} of ${situation.checks.length}.`,
    starters: flow.startersOpened ? 'You opened the starters on your own answer.' : 'You kept the starters closed on your own answer.',
    nextTime: missed.length ? missed[0].nextTime : flow.startersOpened ? 'Next time, try the same answer with the starters closed.' : situation.stretch,
  };
}

/** The phone's word count, for the screen. It says how much was heard, nothing about how good it was. */
export function heardLine(words: number): string {
  return `The phone heard ${words} ${words === 1 ? 'word' : 'words'}.`;
}

/**
 * Next up: the situation done the fewest times, oldest attempt first, then in written order. Never
 * the one just left, so "Next situation" always moves on. Ids we no longer know are ignored.
 */
export function nextSituation(records: readonly SituationRecord[], after?: string): Situation {
  const pool = SITUATIONS.filter((s) => s.id !== after);
  const stats = (id: string) => {
    const mine = records.filter((r) => r.situationId === id);
    return { count: mine.length, last: mine.reduce((latest, r) => Math.max(latest, r.at), 0) };
  };
  return pool.reduce((best, s) => {
    const a = stats(s.id);
    const b = stats(best.id);
    return a.count < b.count || (a.count === b.count && a.last < b.last) ? s : best;
  });
}

/** Analytics for a finished attempt: our ids and numbers only. Tick ids stay on the phone too. */
export function situationCompleteProps(record: SituationRecord) {
  return {
    where: 'situation',
    which: record.situationId,
    attempt: record.attempt,
    starters_opened: record.startersOpened,
    ticked: record.ticks.length,
    checks: record.checks,
    supported_words: record.supportedWords,
    independent_words: record.independentWords,
  };
}
