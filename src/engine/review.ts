// Beta review: count what the recogniser got wrong, including errors the reader didn't notice.
// A reviewer listens to the recording next to the result and marks each word. Pure, so it's testable.

/**
 * One character per passage word, as the session ended:
 * r = heard (green), s = missed (red), c = missed but the reader said "I said it", p = not reached.
 */
export type StatusCode = 'r' | 's' | 'c' | 'p';

export type ReviewMarks = {
  /** Red words the reviewer heard on the recording: errors the reader didn't fix. */
  said: number[];
  /** Green or corrected words the reviewer did NOT hear: the app (or the reader) was too generous. */
  notSaid: number[];
};

export type ReviewMetrics = {
  attempted: number; // words the reader got to
  userCorrections: number; // red words the reader fixed themselves
  uncaught: number; // red words that were really said, which the reader didn't fix
  falseRed: number; // all wrongly red words: fixed by the reader + uncaught - corrections that were wrong
  falseRedPer100: number;
  falseGreen: number; // green words that weren't said
  falseGreenPer100: number;
  correctionRate: number; // share of false reds the reader caught themselves (0–1)
};

export function encodeStatuses(status: string[], corrected: Set<number>): string {
  return status.map((s, i) => (s === 'read' ? 'r' : s === 'skipped' ? (corrected.has(i) ? 'c' : 's') : 'p')).join('');
}

const per100 = (n: number, of: number) => (of ? Math.round((n / of) * 1000) / 10 : 0);

export function reviewMetrics(statuses: string, marks: ReviewMarks): ReviewMetrics {
  const said = new Set(marks.said);
  const notSaid = new Set(marks.notSaid);
  let attempted = 0;
  let userCorrections = 0;
  let wrongCorrections = 0;
  let uncaught = 0;
  let falseGreen = 0;
  for (let i = 0; i < statuses.length; i++) {
    const s = statuses[i] as StatusCode;
    if (s === 'p') continue;
    attempted++;
    if (s === 'c') {
      userCorrections++;
      if (notSaid.has(i)) wrongCorrections++;
    } else if (s === 's' && said.has(i)) uncaught++;
    else if (s === 'r' && notSaid.has(i)) falseGreen++;
  }
  const falseRed = userCorrections - wrongCorrections + uncaught;
  return {
    attempted,
    userCorrections,
    uncaught,
    falseRed,
    falseRedPer100: per100(falseRed, attempted),
    falseGreen,
    falseGreenPer100: per100(falseGreen, attempted),
    correctionRate: falseRed ? Math.round(((userCorrections - wrongCorrections) / falseRed) * 100) / 100 : 1,
  };
}

/** Cycles a word's review mark: red words toggle "said", green or corrected words toggle "not said". */
export function toggleMark(statuses: string, marks: ReviewMarks, i: number): ReviewMarks {
  const s = statuses[i] as StatusCode;
  const flip = (list: number[]) => (list.includes(i) ? list.filter((x) => x !== i) : [...list, i].sort((a, b) => a - b));
  if (s === 's') return { ...marks, said: flip(marks.said) };
  if (s === 'r' || s === 'c') return { ...marks, notSaid: flip(marks.notSaid) };
  return marks;
}

/** Numbers only, for pasting into the beta spreadsheet. Never the words or the transcript. */
export function reviewRow(m: ReviewMetrics, extra: { session: string; wpm: number; firstWordLagMs?: number; reviewed: boolean }): string {
  return [
    extra.session,
    m.attempted,
    m.userCorrections,
    m.uncaught,
    m.falseRedPer100,
    m.falseGreenPer100,
    Math.round(m.correctionRate * 100),
    extra.wpm,
    extra.firstWordLagMs ?? '',
    extra.reviewed ? 'yes' : 'no',
  ].join('\t');
}

export const REVIEW_HEADER = [
  'session',
  'words attempted',
  'reader corrections',
  'uncaught errors',
  'false red /100',
  'false green /100',
  'reader caught %',
  'wpm',
  'first-word lag ms',
  'reviewed',
].join('\t');
