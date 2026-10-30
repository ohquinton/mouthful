// Glide resync: when a reader skips more than the lookahead (a dropped clause, a skipped line, a
// re-read from another sentence), the pointer must catch up instead of turning the rest red.
// Every requirement from the resync brief is a test here. Tables print with `npx jest resync`.
//
// `legacyAlign` below is a frozen copy of align() as it was before resync (commit cea3317). It is
// the "before" in every comparison. Never edit it.

import { align, preparePassage, tokenise, wordsMatch, type Alignment, type PassageWord, type WordStatus } from '../align';
import { PASSAGES } from '../../content/passages';
import { WORD_PACKS } from '../../content/wordpacks';
import { MOMENTS } from '../../content/moments';
import { BASELINE } from '../../content/resolve';

// ------------------------------------------------------------------------------------------------
// Frozen "before": align() at cea3317.

const L_LOOKAHEAD = 5;
const L_HES = new Set(['um', 'umm', 'uh', 'uhh', 'uhm', 'erm', 'er', 'ah', 'hmm', 'mm']);
const L_HABIT = new Set(['like', 'basically', 'actually', 'literally', 'so', 'right', 'okay', 'anyway']);
const L_PHRASES = new Set(['you know', 'i mean', 'kind of', 'sort of', 'you see']);

function legacyAlign(passage: PassageWord[], heard: string[]): Alignment {
  const status: WordStatus[] = passage.map(() => 'pending');
  const fillers: Record<string, number> = {};
  const hesitations: Record<string, number> = {};
  const habits: Record<string, number> = {};
  let fillerCount = 0;
  let hesitationCount = 0;
  let habitCount = 0;
  let next = 0;
  let read = 0;
  let skipped = 0;
  let spoken = 0;
  const addHabit = (f: string, words: number) => {
    habits[f] = (habits[f] ?? 0) + 1;
    habitCount++;
    spoken += words;
  };
  for (let i = 0; i < heard.length; i++) {
    const w = heard[i];
    let match = -1;
    for (let k = next; k < Math.min(next + L_LOOKAHEAD, passage.length); k++) {
      if (wordsMatch(w, passage[k].key)) {
        match = k;
        break;
      }
    }
    if (match >= 0) {
      for (let k = next; k < match; k++) {
        status[k] = 'skipped';
        skipped++;
      }
      status[match] = 'read';
      read++;
      spoken++;
      next = match + 1;
      continue;
    }
    const pair = heard[i + 1] ? `${w} ${heard[i + 1]}` : '';
    if (pair && L_PHRASES.has(pair)) {
      addHabit(pair, 2);
      i++;
      continue;
    }
    if (L_HES.has(w)) {
      fillers[w] = (fillers[w] ?? 0) + 1;
      fillerCount++;
      hesitations[w] = (hesitations[w] ?? 0) + 1;
      hesitationCount++;
      continue;
    }
    if (L_HABIT.has(w)) {
      addHabit(w, 1);
      continue;
    }
    if (next > 0 && w === passage[next - 1].key) continue;
    spoken++;
  }
  return {
    status, next, read, skipped, fillers, fillerCount, hesitations, hesitationCount, habits, habitCount, spoken,
    done: passage.length > 0 && next >= passage.length,
  };
}

// ------------------------------------------------------------------------------------------------
// Content and fixtures.

type Text = { id: string; text: string };
type ScriptFixture = {
  id: string;
  kind: string;
  text: string;
  fillerDrops: string[];
  clause: string;
  synonyms: [string, string][];
  swap: number;
  paraphrase: { sentence: number; text: string };
};

const MEMORY: ScriptFixture[] = require('./fixtures/memory-scripts.json').scripts;
const REPEATED: Text[] = require('./fixtures/repeated-phrases.json').scripts;

/** Every text the app ships: passages, the Day 1 baseline, Word Pack passages, moment placeholders. */
const BUILT_IN: Text[] = [
  ...PASSAGES.map((p) => ({ id: p.id, text: p.text })),
  { id: BASELINE.id, text: BASELINE.text },
  ...WORD_PACKS.flatMap((pack) => pack.passages.map((p, i) => ({ id: `w.${pack.id}.${i}`, text: p.text }))),
  ...MOMENTS.map((m) => ({ id: `moment.${m.id}.placeholder`, text: m.scriptPlaceholder })),
];
const SCRIPTS: Text[] = MEMORY.map((s) => ({ id: s.id, text: s.text }));
const LONG_TEXTS = [...BUILT_IN, ...SCRIPTS].filter((t) => preparePassage(t.text).length >= 50);

// ------------------------------------------------------------------------------------------------
// Cases with ground truth. A plan is a list of passage ranges [start, end) the reader says in
// order, with optional off-script words between them.

type Part = [number, number] | string[];
type Case = {
  group: string;
  label: string;
  passage: PassageWord[];
  heard: string[];
  said: boolean[]; // literally said at some point
  covered: boolean[]; // meaning said (paraphrase cases); equals said elsewhere
  reach: number; // furthest passage index + 1 the reader got to
  resume?: { heard: number; passage: number }; // where reading picks up after a skip
  // Other plans that give exactly the same transcript ("often. Not often, she said, but often":
  // skipping 6 words from either "often" sounds identical). No aligner can tell them apart, so any
  // of them is a right answer.
  alts?: Case[];
};

const keysOf = (p: PassageWord[]) => p.map((w) => w.key);

function planCase(group: string, label: string, passage: PassageWord[], parts: Part[], resumePart?: number): Case {
  const keys = keysOf(passage);
  const heard: string[] = [];
  const said = passage.map(() => false);
  let reach = 0;
  let resume: Case['resume'];
  parts.forEach((part, pi) => {
    if (typeof part[0] === 'string') {
      heard.push(...(part as string[]));
      return;
    }
    const [s, e] = part as [number, number];
    if (pi === resumePart) resume = { heard: heard.length, passage: s };
    for (let k = s; k < e; k++) {
      heard.push(keys[k]);
      said[k] = true;
    }
    reach = Math.max(reach, e);
  });
  return { group, label, passage, heard, said, covered: said, reach, resume };
}

function expected(c: Case): WordStatus[] {
  return c.passage.map((_, k) => (k >= c.reach ? 'pending' : c.said[k] ? 'read' : 'skipped'));
}

const code = (s: WordStatus[]) => s.map((x) => (x === 'read' ? 'r' : x === 'skipped' ? 's' : '.')).join('');

function sentenceRanges(p: PassageWord[]): [number, number][] {
  const out: [number, number][] = [];
  let start = 0;
  p.forEach((w, i) => {
    if (w.sentenceEnd || i === p.length - 1) {
      out.push([start, i + 1]);
      start = i + 1;
    }
  });
  return out;
}

/** The experiment's "from memory" transcripts (fillers dropped, clause dropped, synonyms, reorder). */
function memoryCase(f: ScriptFixture, variant: string): Case {
  const passage = preparePassage(f.text);
  const keys = keysOf(passage);
  const n = keys.length;
  const said = new Array<boolean>(n).fill(true);
  const covered = new Array<boolean>(n).fill(true);
  const replace = new Array<string[] | undefined>(n).fill(undefined);
  if (variant === 'a-fillers') {
    for (const d of f.fillerDrops) {
      const i = keys.indexOf(d);
      replace[i] = [];
      said[i] = false;
    }
  } else if (variant === 'b-clause') {
    const seq = tokenise(f.clause);
    const s = keys.findIndex((_, i) => seq.every((w, j) => keys[i + j] === w));
    for (let i = s; i < s + seq.length; i++) {
      replace[i] = [];
      said[i] = false;
      covered[i] = false;
    }
  } else if (variant === 'c-synonyms') {
    for (const [from, to] of f.synonyms) {
      const i = keys.findIndex((k, j) => k === from && replace[j] === undefined);
      replace[i] = tokenise(to);
      said[i] = false;
    }
  }
  const ranges = sentenceRanges(passage);
  let order = ranges.map((_, i) => i);
  if (variant === 'd-reorder') {
    order = [...order];
    [order[f.swap], order[f.swap + 1]] = [order[f.swap + 1], order[f.swap]];
    const [ps, pe] = ranges[f.paraphrase.sentence];
    for (let i = ps; i < pe; i++) {
      said[i] = false;
      replace[i] = [];
    }
    replace[ps] = tokenise(f.paraphrase.text);
  }
  const heard: string[] = [];
  for (const si of order) {
    const [s, e] = ranges[si];
    for (let i = s; i < e; i++) {
      const r = replace[i];
      if (r === undefined) heard.push(keys[i]);
      else heard.push(...r);
    }
  }
  return { group: `memory ${variant}`, label: `${f.id} ${variant}`, passage, heard, said, covered, reach: n };
}

/** Skip `len` words starting at `s`. */
const skipCase = (group: string, t: Text, s: number, len: number): Case => {
  const p = preparePassage(t.text);
  const mk = (x: number) => planCase(group, `${t.id} skip ${len} @${x}`, p, [[0, x], [x + len, p.length]], 1);
  const c = mk(s);
  c.alts = [];
  // Same transcript to the matcher: every word equal, or one letter off where wordsMatch allows it.
  const sounds = (a: string[], b: string[]) => a.length === b.length && a.every((w, i) => wordsMatch(w, b[i]) || wordsMatch(b[i], w));
  for (let x = Math.max(1, s - len); x <= s + len && x + len <= p.length; x++) {
    if (x !== s && sounds(mk(x).heard, c.heard)) c.alts.push(mk(x));
  }
  return c;
};

/** The reading of the case (itself or an identical-sounding alternative) closest to what we got. */
function truthFor(c: Case, got: WordStatus[]): Case {
  const options = [c, ...(c.alts ?? [])];
  const cost = (o: Case) => got.reduce((n, s, k) => n + (s !== (k >= o.reach ? 'pending' : o.said[k] ? 'read' : 'skipped') ? 1 : 0), 0);
  return options.reduce((best, o) => (cost(o) < cost(best) ? o : best));
}

/** Failures as a compact list: how many, and the first few. */
const summary = (fails: string[]) => ({ count: fails.length, first: fails.slice(0, 25) });
const NONE = { count: 0, first: [] };

/** Read to `cut`, go back to `back`, read to the end. */
const rereadCase = (group: string, t: Text, cut: number, back: number, aside: string[] = []) => {
  const p = preparePassage(t.text);
  return planCase(group, `${t.id} re-read ${back}..${cut}${aside.length ? ' +aside' : ''}`, p, [[0, cut], aside, [back, p.length]]);
};

// ------------------------------------------------------------------------------------------------
// Measuring.

type Score = { words: number; saidN: number; coveredN: number; inked: number; inkedSaid: number; falseGreen: number; falseRed: number };

function score(c: Case, status: WordStatus[]): Score {
  let inked = 0;
  let inkedSaid = 0;
  let falseGreen = 0;
  let falseRed = 0;
  status.forEach((s, k) => {
    const read = s === 'read';
    if (read) inked++;
    if (read && c.said[k]) inkedSaid++;
    if (read && !c.covered[k]) falseGreen++;
    if (!read && c.said[k]) falseRed++; // said, but not inked (red or never reached)
  });
  return {
    words: c.passage.length,
    saidN: c.said.filter(Boolean).length,
    coveredN: c.covered.filter(Boolean).length,
    inked, inkedSaid, falseGreen, falseRed,
  };
}

const addScores = (a: Score, b: Score): Score => ({
  words: a.words + b.words, saidN: a.saidN + b.saidN, coveredN: a.coveredN + b.coveredN, inked: a.inked + b.inked,
  inkedSaid: a.inkedSaid + b.inkedSaid, falseGreen: a.falseGreen + b.falseGreen, falseRed: a.falseRed + b.falseRed,
});
const ZERO: Score = { words: 0, saidN: 0, coveredN: 0, inked: 0, inkedSaid: 0, falseGreen: 0, falseRed: 0 };
const per100 = (a: number, b: number) => (b ? (100 * a) / b : 0);

/** Word-by-word replay, as the session screen sees it. Returns every intermediate alignment. */
function replay(f: (p: PassageWord[], h: string[]) => Alignment, c: { passage: PassageWord[] }, snapshots: string[][]) {
  return snapshots.map((h) => f(c.passage, h));
}
const prefixes = (heard: string[]) => heard.map((_, t) => heard.slice(0, t + 1));

/** Red↔green flicker: a word goes read→skipped→read or skipped→read→skipped across calls. */
function flickers(states: WordStatus[][]): number {
  if (!states.length) return 0;
  let count = 0;
  for (let k = 0; k < states[0].length; k++) {
    const seq: WordStatus[] = [];
    for (const s of states) if (seq[seq.length - 1] !== s[k]) seq.push(s[k]);
    for (let j = 2; j < seq.length; j++) {
      if (seq[j] === seq[j - 2] && seq[j] !== 'pending' && seq[j - 1] !== 'pending') count++;
    }
  }
  return count;
}

// ------------------------------------------------------------------------------------------------
// Case sets.

const VERBATIM: Case[] = [...BUILT_IN, ...SCRIPTS, ...REPEATED].map((t) => {
  const p = preparePassage(t.text);
  return planCase('verbatim', t.id, p, [[0, p.length]]);
});

const SKIP_LENGTHS = [6, 10, 20, 40];
const SKIPS: Case[] = LONG_TEXTS.flatMap((t) => {
  const n = preparePassage(t.text).length;
  const out: Case[] = [];
  for (const len of SKIP_LENGTHS) for (let s = 3; s + len + 3 <= n; s++) out.push(skipCase(`skip ${len}`, t, s, len));
  return out;
});

const SENTENCE_SKIPS: Case[] = LONG_TEXTS.flatMap((t) => {
  const p = preparePassage(t.text);
  return sentenceRanges(p)
    .slice(1, -1)
    .map(([s, e]) => skipCase('skip sentence', t, s, e - s));
});

const REREADS: Case[] = LONG_TEXTS.flatMap((t) => {
  const p = preparePassage(t.text);
  const rs = sentenceRanges(p);
  const out: Case[] = [];
  for (let j = 1; j < rs.length; j++) {
    const [ps] = rs[j - 1];
    const [s, e] = rs[j];
    out.push(rereadCase('re-read', t, s, ps)); // finished sentence j-1, read it again
    out.push(rereadCase('re-read', t, s + Math.floor((e - s) / 2), ps)); // stopped mid-sentence j, back to j-1
    out.push(rereadCase('re-read', t, s + Math.floor((e - s) / 2), s, tokenise('sorry let me start that bit again')));
  }
  return out;
});

/** Adversarial: every skip of 3–12 words, every re-read, every 2–3 word stutter, in scripts built from repeated phrases. */
const ADVERSARIAL: Case[] = REPEATED.flatMap((t) => {
  const p = preparePassage(t.text);
  const n = p.length;
  const out: Case[] = [];
  for (let len = 3; len <= 12; len++) for (let s = 2; s + len + 3 <= n; s++) out.push(skipCase('adversarial skip', t, s, len));
  const rs = sentenceRanges(p);
  for (let j = 1; j < rs.length; j++) {
    out.push(rereadCase('adversarial re-read', t, rs[j][0], rs[j - 1][0]));
    out.push(rereadCase('adversarial re-read', t, rs[j][0] + 3, rs[j - 1][0]));
  }
  for (let cut = 4; cut < n; cut++) {
    for (const back of [2, 3]) out.push(planCase('adversarial stutter', `${t.id} stutter ${back} @${cut}`, p, [[0, cut], [cut - back, n]]));
  }
  return out;
});

const MEMORY_VARIANTS = ['a-fillers', 'b-clause', 'c-synonyms', 'd-reorder'];
const MEMORY_CASES: Case[] = MEMORY.flatMap((f) => MEMORY_VARIANTS.map((v) => memoryCase(f, v)));

// ------------------------------------------------------------------------------------------------
// 1. No regressions.

describe('1. verbatim reads are unchanged', () => {
  it('every built-in text, read word for word, gives the same alignment as before at every step', () => {
    const diffs: string[] = [];
    for (const c of VERBATIM) {
      const heard = tokenise([...BUILT_IN, ...SCRIPTS, ...REPEATED].find((t) => t.id === c.label)!.text);
      expect(heard).toEqual(c.heard); // the transcript a recogniser would send is the passage's keys
      for (const h of prefixes(heard)) {
        if (JSON.stringify(align(c.passage, h)) !== JSON.stringify(legacyAlign(c.passage, h))) diffs.push(`${c.label} @${h.length}`);
      }
      const end = align(c.passage, heard);
      if (!end.done || end.skipped !== 0) diffs.push(`${c.label} not clean at the end`);
    }
    expect(diffs).toEqual([]);
    expect(VERBATIM.length).toBeGreaterThanOrEqual(BUILT_IN.length);
  });

  it('Free talk (no passage) counts exactly as before', () => {
    const talks = [
      'so I really like the new design um it is basically done',
      'you know it went well and uh I mean we shipped it on time',
      'um um uh so so like actually right okay anyway literally the the the project',
      ...MEMORY_CASES.map((c) => c.heard.join(' ')),
    ];
    for (const t of talks) {
      for (const h of prefixes(tokenise(t))) expect(align([], h)).toEqual(legacyAlign([], h));
    }
  });
});

// ------------------------------------------------------------------------------------------------
// 2. Skips.

// Words Glide can't be sure of: hesitations and habit words (principle 7), and stopwords, which
// on their own are everywhere. A copy of the spec, kept here so the test doesn't trust the code.
const NOT_COUNTED = new Set([...L_HES, ...L_HABIT]);
const STOP = new Set(
  (
    'a an the and or but if so of to in on at by for with from into onto about over under than then ' +
    'that this these those there their they them we our us you your i me my mine he she his her it its ' +
    'is are was were be been being am do does did done have has had having will would can could should ' +
    'may might must shall not no yes all any some each every most more much many very just also only ' +
    'what which who whom when where why how here now up down out off again still even back well too ' +
    "i'm i've i'd i'll we're we've it's that's don't can't won't let get got make made want said say " +
    'know think like going go went one two three four five six seven eight nine ten first next last'
  ).split(/\s+/),
);

/**
 * How many resumed words Glide may need: 3 more than where the first stretch it can be sure of
 * begins (three words in a row, no habit words, not all stopwords, one copy in the passage).
 * Resuming on "the new generator" that's 3. On "has made a real difference" it's 5.
 */
function sureAfter(c: Case): number {
  const keys = keysOf(c.passage);
  const r = c.resume!;
  for (let j = 0; r.passage + j + 3 <= keys.length; j++) {
    const tri = keys.slice(r.passage + j, r.passage + j + 3);
    if (tri.some((w) => NOT_COUNTED.has(w)) || tri.every((w) => STOP.has(w))) continue;
    let copies = 0;
    for (let k = 0; k + 3 <= keys.length; k++) if (tri.every((w, d) => wordsMatch(w, keys[k + d]))) copies++;
    if (copies === 1) return j + 3;
  }
  return keys.length - r.passage;
}

/** After t resumed words: the gap is red, the t words are inked, nothing else is red, the pointer is right after them. */
function caughtUp(c: Case, want: WordStatus[], t: number): boolean {
  const r = c.resume!;
  const a = align(c.passage, c.heard.slice(0, r.heard + t));
  const upto = r.passage + t;
  return a.next === upto && code(a.status.slice(0, upto)) === code(want.slice(0, upto));
}

// When a jump ahead is allowed and how long it may take (qa-critic's findings, section 10). A copy
// of the spec, so the test doesn't trust the code:
//   - The recogniser may still rewrite the last 2 words, so a jump waits until the words it rests
//     on have 2 more after them (SPEC_SETTLE), unless they reach the end of the passage.
//   - A jump past the reader's sentence and the next one is far: it needs 2 more words read on
//     past its anchor (SPEC_CARRY_ON), in case the anchor is an aside quoting a later line.
//   - A jump into the last sentence leads straight to the end of the read, so it holds unless the
//     reader was already in the last sentence, or was in the one before and picked up at the start
//     of the last one. (A refrain: the closing line quoted, or the opening line repeated at the end.)
const SPEC_SETTLE = 2;
const SPEC_CARRY_ON = 2;

const sentenceIndex = (p: PassageWord[], k: number) => sentenceRanges(p).findIndex(([s, e]) => k >= s && k < e);
const skipStart = (c: Case) => c.said.indexOf(false);
const isFarJump = (c: Case) => sentenceIndex(c.passage, c.resume!.passage) > sentenceIndex(c.passage, skipStart(c)) + 1;
function holdsAtEnd(c: Case): boolean {
  const rs = sentenceRanges(c.passage);
  const finalStart = rs[rs.length - 1][0];
  const penultStart = rs.length > 1 ? rs[rs.length - 2][0] : 0;
  const k = c.resume!.passage;
  const ptr = skipStart(c);
  return k >= finalStart && ptr < finalStart && !(k === finalStart && ptr >= penultStart);
}
/** Resumed words Glide may need before it has caught up. */
// Counted words, that is: a habit word ("say so now") or a stutter ("in to | to discuss", the
// resumed word the same as the one before the skip) never counts toward a resync, so each one
// among them adds a word.
function catchUpWithin(c: Case): number {
  const base = sureAfter(c) + SPEC_SETTLE + (isFarJump(c) ? SPEC_CARRY_ON : 0);
  const r = c.resume!.heard;
  let extra = 0;
  for (let j = r; j < r + base + extra && j < c.heard.length; j++) {
    if (L_HABIT.has(c.heard[j]) || (j > 0 && c.heard[j] === c.heard[j - 1])) extra++;
  }
  return base + extra;
}

const RESYNC_HISTOGRAM: Record<string, number> = {};

function skipFailures(cases: Case[]) {
  const fails: string[] = [];
  for (const c0 of cases) {
    const end = align(c0.passage, c0.heard);
    const got = end.status;
    // Held: nothing after the pointer is claimed, and the session doesn't end itself.
    const held = (o: Case) => !end.done && end.next <= o.resume!.passage && !got.some((s, k) => s === 'read' && !o.said[k]);
    // Any identical-sounding reading may be the right one ("schedule the | project", the second
    // "the" skipped, or "schedule | the project", the first): a hold is right if one of them holds.
    const options = [c0, ...(c0.alts ?? [])];
    const jumps = options.filter((o) => !holdsAtEnd(o));
    if (options.some((o) => holdsAtEnd(o) && held(o))) continue;
    if (!jumps.length) {
      fails.push(`${c0.label}: should hold at the end, got ${code(got)}`);
      continue;
    }
    const c = truthFor({ ...jumps[0], alts: jumps.slice(1) }, got);
    const want = expected(c);
    if (code(got) !== code(want)) {
      fails.push(`${c.label}: final
  want ${code(want)}
  got  ${code(got)}`);
      continue;
    }
    const within = catchUpWithin(c);
    let t = 1;
    while (t < within && !caughtUp(c, want, t)) t++;
    const bucket = t <= 3 ? '1-3' : t <= 5 ? '4-5' : t <= 7 ? '6-7' : '8+';
    RESYNC_HISTOGRAM[bucket] = (RESYNC_HISTOGRAM[bucket] ?? 0) + 1;
    if (!caughtUp(c, want, Math.min(within, c.passage.length - c.resume!.passage))) {
      fails.push(`${c.label}: not caught up after ${within} words`);
    }
  }
  return fails;
}

describe('2. skips', () => {
  it('night-shift: skipping the second line and reading on', () => {
    const p = preparePassage(PASSAGES.find((x) => x.id === 'night-shift')!.text);
    // "Yesterday the ward was quiet, until the storm | knocked the power out. Mara steadied the | lantern, …"
    const c = planCase('named', 'night-shift line 2', p, [[0, 8], [14, p.length]], 1);
    expect(skipFailures([c])).toEqual([]);
    const a = align(p, c.heard);
    expect(a.status.slice(8, 14)).toEqual(Array(6).fill('skipped'));
    expect(a.skipped).toBe(6);
    expect(a.done).toBe(true);
  });

  it('a dropped clause no longer turns the rest of the answer red', () => {
    const f = MEMORY.find((s) => s.id === 'raise')!;
    const c = memoryCase(f, 'b-clause');
    const before = legacyAlign(c.passage, c.heard);
    const after = align(c.passage, c.heard);
    expect(before.read).toBeLessThan(40); // the bug: 28 of 111 inked
    expect(after.skipped).toBe(10); // exactly the dropped clause
    expect(after.done).toBe(true);
  });

  for (const len of SKIP_LENGTHS) {
    it(`every skip of ${len} words in every built-in text and script: exactly the gap is red`, () => {
      expect(summary(skipFailures(SKIPS.filter((c) => c.group === `skip ${len}`)))).toEqual(NONE);
    });
  }

  it('every skipped whole sentence: exactly that sentence is red', () => {
    expect(summary(skipFailures(SENTENCE_SKIPS))).toEqual(NONE);
  });

  // Was "within 3 words". Since qa-critic's findings a jump also waits for the recogniser to
  // settle (2 words) and, when far, for 2 words read on past the anchor: 5 words near, 7 far.
  it('resyncs within 5 words (7 past the next sentence) whenever the reader resumes on words it can be sure of', () => {
    const cases = [...SKIPS, ...SENTENCE_SKIPS].filter((c) => !holdsAtEnd(c));
    const exact = cases.filter((c) => sureAfter(c) === 3);
    expect(summary(skipFailures(exact))).toEqual(NONE);
    for (const k of Object.keys(RESYNC_HISTOGRAM)) delete RESYNC_HISTOGRAM[k];
    skipFailures(cases);
    const total = Object.values(RESYNC_HISTOGRAM).reduce((a, b) => a + b, 0);
    const rows = ['resumed words until caught up | skips'];
    for (const b of ['1-3', '4-5', '6-7', '8+']) rows.push(`${b} | ${RESYNC_HISTOGRAM[b] ?? 0} (${((100 * (RESYNC_HISTOGRAM[b] ?? 0)) / total).toFixed(1)}%)`);
    const far = exact.filter(isFarJump).length;
    rows.push(`${exact.length} of ${cases.length} skips resume on 3 words Glide can be sure of; all are caught up by the 5th word (${far} far ones by the 7th)`);
    console.log(rows.join('\n'));
  });
});

// ------------------------------------------------------------------------------------------------
// 3. Re-reads.

describe('3. re-reads', () => {
  it('going back over the previous sentence never jumps forward, never regresses, never reddens', () => {
    const fails: string[] = [];
    for (const c of REREADS) {
      let lastNext = 0;
      for (const h of prefixes(c.heard)) {
        const a = align(c.passage, h);
        if (a.next < lastNext) fails.push(`${c.label}: pointer went back at ${h.length}`);
        if (a.skipped > 0) fails.push(`${c.label}: red at ${h.length}: ${code(a.status)}`);
        lastNext = a.next;
        if (fails.length > 20) break;
      }
      const end = align(c.passage, c.heard);
      if (!end.done || end.skipped) fails.push(`${c.label}: end ${code(end.status)}`);
    }
    expect(summary(fails)).toEqual(NONE);
  });

  it('a word skipped the first time stays red if the re-read skips it again, and inks if it is said', () => {
    const p = preparePassage('Mara steadied the lantern, particularly careful with the new generator, and walked the hallway room by room. Nobody panicked at all that night.');
    // first pass drops "particularly", then the reader re-reads the sentence
    const again = planCase('named', 'reread-skip', p, [[0, 4], [5, 12], [0, 4], [5, p.length]]);
    const a = align(p, again.heard);
    expect(a.status[4]).toBe('skipped');
    expect(a.skipped).toBe(1);
    const fixed = planCase('named', 'reread-fix', p, [[0, 4], [5, 12], [0, p.length]]);
    const b = align(p, fixed.heard);
    expect(b.status[4]).toBe('read'); // said on the second pass: backfilled, pointer never moved back
    expect(b.skipped).toBe(0);
    expect(b.done).toBe(true);
  });
});

// ------------------------------------------------------------------------------------------------
// 4. Repeated phrases.

describe('4. repeated phrases never anchor on the wrong copy', () => {
  it('no false greens in any skip, re-read or stutter of the adversarial scripts', () => {
    const fails: string[] = [];
    for (const c of ADVERSARIAL) {
      const got = align(c.passage, c.heard).status;
      const t = truthFor(c, got);
      const fg = got.filter((s, k) => s === 'read' && !t.said[k]).length;
      if (fg) fails.push(`${c.label}: ${fg} false green\n  want ${code(expected(t))}\n  got  ${code(got)}`);
    }
    expect(summary(fails)).toEqual(NONE);
  });

  it('a phrase that appears twice waits for the word that tells the copies apart', () => {
    const t = REPEATED.find((x) => x.id === 'same-sentence-twice')!;
    const p = preparePassage(t.text);
    const rs = sentenceRanges(p);
    // "Thanks for coming in today." | skip "We shipped … last week." | "Thanks for coming in today, again, …"
    // The first five words match sentence 1 (behind) and sentence 3 (ahead); "again" decides.
    const c = planCase('named', 'same-sentence-twice', p, [[0, rs[1][0]], [rs[2][0], p.length]], 1);
    const a = align(p, c.heard);
    expect(code(a.status)).toBe(code(expected(c)));
    // and before "again" arrives nothing has moved: no guess between the two copies
    const early = align(p, c.heard.slice(0, c.resume!.heard + 5));
    expect(early.next).toBe(rs[1][0]);
    expect(early.skipped).toBe(0);
  });

  it('copies that stay identical go to the nearest one ahead, never one behind', () => {
    const p = preparePassage('Please check the figures in the report today. Then we will meet. Please check the figures in the report today. Then we will decide.');
    const rs = sentenceRanges(p);
    // read sentence 1, skip "Then we will meet.", read sentences 3 and 4
    const c = planCase('named', 'identical copies', p, [[0, rs[1][0]], [rs[2][0], p.length]], 1);
    expect(code(align(p, c.heard).status)).toBe(code(expected(c)));
  });

  it('identical-sounding readings are both right: "the launch. We need to …" may be either copy', () => {
    // Skipping sentence 2 of we-need-to, or reading its first three words and skipping to "cut",
    // gives the same transcript word for word. Glide takes the nearest copy; the test accepts either.
    const t = REPEATED.find((x) => x.id === 'we-need-to')!;
    const p = preparePassage(t.text);
    const rs = sentenceRanges(p);
    const c = skipCase('named', t, rs[1][0], rs[2][0] - rs[1][0]);
    expect(c.alts!.length).toBeGreaterThan(0);
    const got = align(p, c.heard).status;
    expect(code(got)).toBe(code(expected(truthFor(c, got))));
  });
});

// ------------------------------------------------------------------------------------------------
// 5. False greens: the before/after table.

describe('5. false green budget', () => {
  it('prints the before/after table and holds the budget', () => {
    const groups: [string, Case[]][] = [
      ['verbatim', VERBATIM],
      ...SKIP_LENGTHS.map((l) => [`skip ${l}`, SKIPS.filter((c) => c.group === `skip ${l}`)] as [string, Case[]]),
      ['skip sentence', SENTENCE_SKIPS],
      ['re-read', REREADS],
      ['adversarial', ADVERSARIAL],
      ...MEMORY_VARIANTS.map((v) => [`memory ${v}`, MEMORY_CASES.filter((c) => c.group === `memory ${v}`)] as [string, Case[]]),
    ];
    const rows = ['group | cases | inked % of said (before → after) | false green /100 words (before → after) | false red /100 said (before → after)'];
    const result: Record<string, { before: Score; after: Score; added: number }> = {};
    for (const [name, cases] of groups) {
      let before = ZERO;
      let after = ZERO;
      let added = 0;
      for (const c of cases) {
        const bs = legacyAlign(c.passage, c.heard).status;
        const as = align(c.passage, c.heard).status;
        const b = score(truthFor(c, bs), bs);
        const a = score(truthFor(c, as), as);
        before = addScores(before, b);
        after = addScores(after, a);
        added += Math.max(0, a.falseGreen - b.falseGreen);
      }
      result[name] = { before, after, added };
      const f = (x: number) => x.toFixed(1);
      rows.push(
        `${name} | ${cases.length} | ${f(per100(before.inkedSaid, before.saidN))} → ${f(per100(after.inkedSaid, after.saidN))} | ` +
          `${f(per100(before.falseGreen, before.words))} → ${f(per100(after.falseGreen, after.words))} | ` +
          `${f(per100(before.falseRed, before.saidN))} → ${f(per100(after.falseRed, after.saidN))}`,
      );
    }
    console.log(rows.join('\n'));

    // resync adds no false green on verbatim, skip and re-read cases
    for (const name of ['verbatim', 'skip 6', 'skip 10', 'skip 20', 'skip 40', 'skip sentence', 're-read', 'adversarial']) {
      expect([name, result[name].added]).toEqual([name, 0]);
      expect([name, result[name].after.falseGreen]).toEqual([name, 0]);
    }
    // paraphrase cases: no worse than the experiment's P2b (b 0.1, c 0.0, d 0.0 per 100 words)
    const budget: Record<string, number> = { 'memory a-fillers': 0, 'memory b-clause': 0.1, 'memory c-synonyms': 0, 'memory d-reorder': 0 };
    for (const [name, max] of Object.entries(budget)) {
      const s = result[name].after;
      expect([name, per100(s.falseGreen, s.words) <= max + 1e-9]).toEqual([name, true]);
    }
    // and it actually fixes the bug: a dropped clause inks ≥ 89% (the experiment's P2b)
    const b = result['memory b-clause'].after;
    expect(per100(b.inked, b.words)).toBeGreaterThanOrEqual(89);
  });
});

// ------------------------------------------------------------------------------------------------
// 6. Recogniser realism: incremental results, revised interim words, homophones, digits, contractions.

const HOMOPHONE: Record<string, string> = { to: 'two', two: 'to', too: 'to', there: 'their', their: 'there', for: 'four', four: 'for', right: 'write', new: 'knew', by: 'buy', one: 'won', our: 'are', no: 'know' };

/** An interim guess for a word: a homophone, a dropped last letter, or a wrong ending. */
function interimOf(w: string, salt: number): string {
  if (HOMOPHONE[w]) return HOMOPHONE[w];
  if (w.length > 4 && salt % 2 === 0) return w.slice(0, -1);
  return w.length > 2 ? `${w.slice(0, -1)}${'aeiou'[salt % 5]}` : `${w}h`;
}

/** Snapshots as a recogniser sends them: each word first arrives as an interim guess, then the final;
 *  every 7th word the last two are rewritten together. */
function withRevisions(heard: string[]): string[][] {
  const out: string[][] = [];
  for (let t = 0; t < heard.length; t++) {
    const head = heard.slice(0, t);
    out.push([...head, interimOf(heard[t], t)]);
    if (t % 7 === 6 && t > 0) out.push([...heard.slice(0, t - 1), interimOf(heard[t - 1], t + 1), interimOf(heard[t], t + 2)]);
    out.push(heard.slice(0, t + 1));
  }
  return out;
}

/** What a recogniser does to the final transcript: digits, homophones, contractions, near-misses. */
function realistic(heard: string[]): string[] {
  const digits: Record<string, string> = { three: '3', two: '2', four: '4', eighteen: '18', seventy: '70', ninety: '90' };
  const out: string[] = [];
  heard.forEach((w, i) => {
    if (digits[w]) out.push(digits[w]);
    else if (w === "we're") out.push('we', 'are');
    else if (w === "i'm") out.push('i', 'am');
    else if (w === "don't") out.push('do', 'not');
    else if (i % 11 === 5 && w.length >= 6) out.push(w.slice(0, -1)); // one letter off
    else if (i % 13 === 7 && HOMOPHONE[w]) out.push(HOMOPHONE[w]);
    else out.push(w);
  });
  return out;
}

describe('6. recogniser realism', () => {
  const sample = [
    ...VERBATIM,
    ...SKIPS.filter((_, i) => i % 23 === 0),
    ...SENTENCE_SKIPS,
    ...REREADS.filter((_, i) => i % 3 === 0),
    ...MEMORY_CASES,
  ];

  // Flicker is counted per 100 tracked words (words that left "pending" at least once): before
  // resync the pointer got stuck, so words after a skip were never tracked and could not flicker.
  it('interim revisions cause no more red↔green flicker than before', () => {
    const rows = ['group | cases | flickers before → after | per 100 tracked words before → after'];
    const by: Record<string, { n: number; fb: number; fa: number; tb: number; ta: number }> = {};
    const worse: string[] = [];
    const tracked = (states: WordStatus[][]) => states[0].filter((_, k) => states.some((s) => s[k] !== 'pending')).length;
    for (const c of sample) {
      const snaps = withRevisions(c.heard);
      const sb = replay(legacyAlign, c, snaps).map((a) => a.status);
      const sa = replay(align, c, snaps).map((a) => a.status);
      const before = flickers(sb);
      const after = flickers(sa);
      const g = (by[c.group.replace(/ \d+$/, '')] ??= { n: 0, fb: 0, fa: 0, tb: 0, ta: 0 });
      g.n++;
      g.fb += before;
      g.fa += after;
      g.tb += tracked(sb);
      g.ta += tracked(sa);
      // where before and after end the same, after may never flicker more
      if (code(sb[sb.length - 1]) === code(sa[sa.length - 1]) && after > before) worse.push(`${c.label}: ${before} → ${after}`);
    }
    for (const [name, g] of Object.entries(by)) {
      const rb = per100(g.fb, g.tb);
      const ra = per100(g.fa, g.ta);
      rows.push(`${name} | ${g.n} | ${g.fb} → ${g.fa} | ${rb.toFixed(2)} → ${ra.toFixed(2)}`);
      // Backfill (re-reads, reordered sentences) can flicker a red word behind the pointer while the
      // recogniser revises it; today that word just stays red. Every other group must not get worse.
      if (name !== 'memory d-reorder') expect([name, ra <= rb + 1e-9]).toEqual([name, true]);
      else expect(ra).toBeLessThan(5);
    }
    console.log(rows.join('\n'));
    expect(summary(worse)).toEqual(NONE);
  });

  it('digits, contractions, homophones and near-misses in a skip still resync to the right place', () => {
    const fails: string[] = [];
    for (const c of [...SENTENCE_SKIPS, ...SKIPS.filter((x) => x.group === 'skip 10')]) {
      const heard = realistic([...c.heard]);
      const before = score(c, legacyAlign(c.passage, heard).status);
      const after = score(c, align(c.passage, heard).status);
      if (after.falseGreen > before.falseGreen) fails.push(`${c.label}: false green ${before.falseGreen} → ${after.falseGreen}`);
      // A skip into the last sentence holds (section 2): the old aligner inked a few of those words
      // by chance in its lookahead; a hold inks none, by design. Its false greens still count above.
      const holds = [c, ...(c.alts ?? [])].some(holdsAtEnd);
      if (!holds && after.inkedSaid < before.inkedSaid) fails.push(`${c.label}: inked ${before.inkedSaid} → ${after.inkedSaid}`);
    }
    expect(summary(fails)).toEqual(NONE);
  });

  it('a noisy straight read (no skips) gets no new reds and no new greens', () => {
    const fails: string[] = [];
    for (const c of VERBATIM) {
      const heard = realistic([...c.heard]);
      const before = legacyAlign(c.passage, heard).status;
      const after = align(c.passage, heard).status;
      after.forEach((s, k) => {
        if (s === 'read' && before[k] !== 'read' && !c.said[k]) fails.push(`${c.label} #${k}: new green`);
        if (s !== 'read' && before[k] === 'read') fails.push(`${c.label} #${k}: new red`);
      });
    }
    expect(summary(fails)).toEqual(NONE);
  });
});

// ------------------------------------------------------------------------------------------------
// 7. Hesitations and habit words.

describe('7. hesitations and habit words never trigger or anchor a resync', () => {
  const p = preparePassage(PASSAGES.find((x) => x.id === 'night-shift')!.text);
  const keys = keysOf(p);

  it('a run of um, uh, like, so and you know does not move the pointer', () => {
    const heard = [...keys.slice(0, 10), ...tokenise('um uh like so you know um basically uh actually so like')];
    const a = align(p, heard);
    expect(a.next).toBe(10);
    expect(a.skipped).toBe(0);
    expect(a.fillerCount).toBe(4);
    expect(a.habitCount).toBe(7);
  });

  it('fillers inside a skip do not count toward the trigger, and are still counted on the Tape', () => {
    const c = planCase('named', 'fillers in skip', p, [[0, 8], tokenise('um uh like'), [20, 21], ['um'], [21, 23], tokenise('you know'), [23, p.length]], 2);
    const a = align(p, c.heard);
    expect(code(a.status)).toBe(code(expected(c)));
    expect(a.fillers).toEqual({ um: 2, uh: 1 });
    expect(a.habits).toEqual({ like: 1, 'you know': 1 });
    expect(a.spoken).toBe(c.said.filter(Boolean).length + 3); // passage words + like + you know
  });

  it('habit words are never an anchor, even when the passage contains them', () => {
    const q = preparePassage('The plan is simple. We ship on Friday and then we wait. Honestly, so right, like everyone else, we review it on Monday.');
    // lost after "the plan is", the reader says habit words that happen to sit later in the passage
    const a = align(q, tokenise('the plan is so right like zebra quantum velvet'));
    expect(a.next).toBe(3);
    expect(a.skipped).toBe(0);
  });
});

// ------------------------------------------------------------------------------------------------
// 8. Performance.

describe('8. performance', () => {
  it('worst case stays under 1 ms per call on the longest passage with a 40-word stuck run', () => {
    const texts = [...BUILT_IN, ...SCRIPTS];
    const longest = texts.reduce((a, b) => (preparePassage(b.text).length > preparePassage(a.text).length ? b : a));
    // a 190-word script chunk (chunkScript's ceiling is ~187) built from real sentences, the worst a reader can paste
    const chunk = SCRIPTS.map((s) => s.text).join(' ').split(/\s+/).slice(0, 190).join(' ');
    const rows = ['passage | words | heard | stuck run (40 words) | worst call, ms (before → after) | median call, ms (before → after)'];
    for (const [name, text] of [[longest.id, longest.text], ['190-word script chunk', chunk]]) {
      const p = preparePassage(text);
      const keys = keysOf(p);
      const vocab = [...new Set(keys)];
      const counts = new Map<string, number>();
      for (const k of keys) counts.set(k, (counts.get(k) ?? 0) + 1);
      const common = [...vocab].sort((x, y) => counts.get(y)! - counts.get(x)!).slice(0, 6);
      const runs: [string, string[]][] = [
        // the passage's own words shuffled: real words, no bigram lines up, so the search runs on every word
        ['shuffled passage words', Array.from({ length: 40 }, (_, i) => vocab[(i * 37 + 11) % vocab.length])],
        // its most common words ("the", "and", "to"): every word matches many places, the costliest search
        ['most common words', Array.from({ length: 40 }, (_, i) => common[(i * 5 + (i >> 2)) % common.length])],
      ];
      for (const [label, stuck] of runs) {
        const heard = [...keys.slice(0, 15), ...stuck, ...keys.slice(15)];
        // Each call's time is its best of 15 runs (the rest is timer and garbage-collector noise);
        // the worst call is the slowest prefix of the transcript.
        const time = (f: typeof align) => {
          const best = prefixes(heard).map((h) => {
            let m = Infinity;
            for (let rep = 0; rep < 15; rep++) {
              const t0 = performance.now();
              f(p, h);
              m = Math.min(m, performance.now() - t0);
            }
            return m;
          });
          const sorted = [...best].sort((x, y) => x - y);
          return { worst: sorted[sorted.length - 1], median: sorted[Math.floor(sorted.length / 2)] };
        };
        time(align); // warm up the JIT and the per-passage index
        const b = time(legacyAlign);
        const a = time(align);
        rows.push(
          `${name} | ${p.length} | ${heard.length} | ${label} | ${b.worst.toFixed(3)} → ${a.worst.toFixed(3)} | ${b.median.toFixed(3)} → ${a.median.toFixed(3)}`,
        );
        expect(a.worst).toBeLessThan(1);
      }
    }
    console.log(rows.join('\n'));
  });
});

// ------------------------------------------------------------------------------------------------
// 9. Determinism.

describe('9. determinism', () => {
  it('same input, same output, whatever was aligned before', () => {
    const cases = [...SENTENCE_SKIPS.slice(0, 20), ...REREADS.slice(0, 20), ...MEMORY_CASES];
    const first = cases.map((c) => JSON.stringify(align(c.passage, c.heard)));
    // different call history: other passages, partial transcripts, reverse order, fresh passage objects
    for (const c of [...cases].reverse()) align(c.passage, c.heard.slice(0, 7));
    const again = cases.map((c) => JSON.stringify(align(preparePassage(c.passage.map((w) => w.display).join(' ')), [...c.heard])));
    expect(again).toEqual(first);
  });
});

// ------------------------------------------------------------------------------------------------
// 10. qa-critic's findings on the first resync. Each block started as a failing test; the
// generators are ports of qa-critic's repro scripts with a fixed seed (same numbers every run).

/** Same linear congruential generator qa-critic used, so the case sets match its numbers. */
const seeded = (seed: number) => () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const QA_TEXTS: Text[] = [...PASSAGES.map((p) => ({ id: p.id, text: p.text })), ...SCRIPTS];
const QA_FUZZ_TEXTS: Text[] = [
  ...PASSAGES.map((p) => ({ id: p.id, text: p.text })),
  ...WORD_PACKS.flatMap((pack) => pack.passages.map((p, i) => ({ id: `w.${pack.id}.${i}`, text: p.text }))),
  ...SCRIPTS,
];
const skippedWordsOf = (p: PassageWord[], a: Alignment) => p.filter((_, i) => a.status[i] === 'skipped').map((w) => w.display);
const garble = (w: string) => (w.length > 3 ? w.slice(0, -2) + 'zq' : 'zz');

describe('10a. a refrain never finishes the read early', () => {
  const REFRAIN =
    'Thank you all for coming in today. This quarter we moved the billing system to the new platform and cut support tickets by a third. ' +
    'Next quarter we will finish the migration for the last two regions. Thank you all for coming in today.';
  const p = preparePassage(REFRAIN);
  const opening = 'thank you all for coming in today this quarter we moved the billing system to the new platform';

  it('"sorry, let me start again" + the opening line (also the closing line) is a re-read, not a jump to the end', () => {
    for (const tail of ['sorry let me start again thank you all for coming in today', 'sorry let me start again thank you all for coming in today this quarter']) {
      const heard = tokenise(`${opening} ${tail}`);
      for (const h of prefixes(heard)) {
        const a = align(p, h);
        expect([h.length, a.done, a.skipped, a.next <= 18]).toEqual([h.length, false, 0, true]);
      }
      expect(align(p, heard).next).toBe(18); // still waiting at "and cut support tickets"
    }
  });

  it('reading on from the restart finishes cleanly', () => {
    const a = align(p, tokenise(`${opening} sorry let me start again ${REFRAIN}`));
    expect(a.done).toBe(true);
    expect(a.skipped).toBe(0);
  });

  it('an aside that quotes the closing line never ends the session', () => {
    const q = preparePassage('I want this job because it combines health and software. I spent four years as a nurse. That is why I want this job.');
    const a = align(q, tokenise('i want this job because it combines health and software i spent four years oh and why i want this job'));
    expect(a.done).toBe(false);
    expect(a.status.slice(-5)).not.toContain('read');
    const r = preparePassage('I want this job because it combines health and software. I spent four years as a nurse in a busy ward. That is why I want this job.');
    const b = align(r, tokenise('i want this job because it combines health and software i spent four years as a i want this job'));
    expect(b.done).toBe(false);
    expect(b.skipped).toBe(0);
  });

  it('a real skip in the second-last sentence, then the whole last sentence, still finishes', () => {
    const q = preparePassage('We cut costs by ten percent this year. The board asked for more detail on hiring. Thanks for listening.');
    const a = align(q, tokenise('we cut costs by ten percent this year the board asked for more detail sorry thanks for listening'));
    expect(a.done).toBe(true);
    expect(skippedWordsOf(q, a)).toEqual(['on', 'hiring.']);
  });

  it('in every text, quoting the last sentence from the first half never finishes the read', () => {
    const fails: string[] = [];
    for (const t of [...BUILT_IN, ...SCRIPTS]) {
      const q = preparePassage(t.text);
      const rs = sentenceRanges(q);
      if (rs.length < 3) continue;
      const [fs, fe] = rs[rs.length - 1];
      const keys = keysOf(q);
      for (let cut = 3; cut < rs[rs.length - 2][0]; cut += 4) {
        const heard = [...keys.slice(0, cut), 'sorry', ...keys.slice(fs, fe)];
        for (const h of prefixes(heard)) {
          if (align(q, h).done) {
            fails.push(`${t.id} cut ${cut} @${h.length}: done`);
            break;
          }
        }
      }
    }
    expect(summary(fails)).toEqual(NONE);
  });
});

describe('10b. stutters never turn read words red', () => {
  it('night-shift: "by midnight lights were back back the monitors" leaves only "the" red', () => {
    const q = preparePassage(
      'Not often, she said, but often enough that we know what to do. By midnight the lights were back, the monitors were humming, and the coffee in the break room was, unfortunately, still terrible.',
    );
    const h = tokenise('not often she said but often enough that we know what to do by midnight lights were back back the monitors were humming');
    expect(skippedWordsOf(q, legacyAlign(q, h))).toEqual(['the']);
    expect(skippedWordsOf(q, align(q, h))).toEqual(['the']);
  });

  it('light noise (drops, mishearings, stutters, habit words, 3-word restarts): never more said words red than before, in any run', () => {
    // qa-critic's generator: 150 runs per text, 3,900 in all.
    const rnd = seeded(9);
    const OFFW = ['banana', 'sorry', 'wait', 'um', 'like', 'actually', 'hmm', 'okay', 'well', 'right'];
    let cases = 0;
    let better = 0;
    let fgNew = 0;
    let fgOld = 0;
    const worse: string[] = [];
    for (const t of QA_FUZZ_TEXTS) {
      const q = preparePassage(t.text);
      const keys = keysOf(q);
      for (let rep = 0; rep < 150; rep++) {
        const heard: string[] = [];
        const said = keys.map(() => false);
        for (let k = 0; k < keys.length; k++) {
          const r = rnd();
          if (r < 0.04) continue; // dropped
          if (r < 0.08) {
            heard.push('zz' + keys[k]); // misheard
            continue;
          }
          heard.push(keys[k]);
          said[k] = true;
          const r2 = rnd();
          if (r2 < 0.05) heard.push(keys[k]); // stutter
          else if (r2 < 0.12) heard.push(OFFW[Math.floor(rnd() * OFFW.length)]);
          else if (r2 < 0.15 && k > 2) heard.push(keys[k - 2], keys[k - 1], keys[k]); // restart the phrase
        }
        cases++;
        const n = align(q, heard);
        const l = legacyAlign(q, heard);
        const red = (a: Alignment) => a.status.filter((s, k) => s !== 'read' && said[k]).length;
        const fg = (a: Alignment) => a.status.filter((s, k) => s === 'read' && !said[k]).length;
        fgNew += fg(n);
        fgOld += fg(l);
        if (red(n) > red(l)) worse.push(`${t.id} #${rep}: ${red(l)} → ${red(n)}\n  heard: ${heard.join(' ')}`);
        if (red(n) < red(l)) better++;
      }
    }
    console.log(`light-noise fuzz: ${cases} runs; more said words red than before in ${worse.length}, fewer in ${better}; false greens ${fgOld} → ${fgNew}`);
    expect(cases).toBe(3900);
    expect(summary(worse)).toEqual(NONE);
    expect(fgNew).toBeLessThanOrEqual(fgOld);
  });
});

describe('10c. one interim revision never undoes a resync', () => {
  // qa-critic's a10 rewrote the last THREE words ("time clinicians lose" → "thyme clinician loose"),
  // and "time" is the only word of "i know how much time" that isn't a stopword, so the rewritten
  // transcript on its own has no anchor left: no aligner that only sees the transcript can hold
  // there. Known limit. The contract is the one qa-critic set: a jump resting on words before the
  // last 2 holds, whatever the recogniser does to those 2.
  it('why-this-job after a 12-word skip: rewriting the last 1–2 words never pulls the cursor back', () => {
    const t = SCRIPTS.find((s) => s.id === 'why-this-job')!;
    const q = preparePassage(t.text);
    const keys = keysOf(q);
    const heard = [...keys.slice(0, 12), ...keys.slice(24)];
    const fails: string[] = [];
    for (let len = 14; len <= 26; len++) {
      const good = align(q, heard.slice(0, len)).next;
      for (const k of [1, 2]) {
        const bad = align(q, heard.slice(0, len).map((w, j) => (j >= len - k ? garble(w) : w))).next;
        if (good - bad > 4) fails.push(`${len} words, last ${k} rewritten: ${good} → ${bad}`);
      }
    }
    expect(fails).toEqual([]);
  });

  it('a jump still waiting to settle when the session ends lands once the caller says nothing more will change', () => {
    const p = preparePassage(PASSAGES.find((x) => x.id === 'night-shift')!.text);
    const keys = keysOf(p);
    // "Yesterday the ward | (skip) | the lantern particularly careful" and the reader stops.
    const heard = [...keys.slice(0, 3), ...keys.slice(15, 18)];
    expect(align(p, heard).next).toBe(3); // the last two words may still be rewritten: wait
    const end = align(p, heard, heard.length);
    expect(end.next).toBe(18);
    expect(end.skipped).toBe(12);
  });

  it('after a 12-word skip, garbling the last 1–3 words retreats the cursor more than 4 words no more often than before', () => {
    const count = (f: typeof align) => {
      let total = 0;
      let big = 0;
      let worst = 0;
      for (const t of QA_TEXTS) {
        const q = preparePassage(t.text);
        const keys = keysOf(q);
        for (const at of [12, 30]) {
          if (keys.length < at + 40) continue;
          const heard = [...keys.slice(0, at), ...keys.slice(at + 12)];
          for (let i = at + 1; i < at + 10; i++) {
            for (let k = 1; k <= 3; k++) {
              const good = f(q, heard.slice(0, i));
              const bad = f(q, heard.slice(0, i).map((w, j) => (j >= i - k ? garble(w) : w)));
              let lost = 0;
              for (let x = 0; x < q.length; x++) if (good.status[x] !== 'pending' && bad.status[x] === 'pending') lost++;
              total++;
              if (lost > 4) big++;
              worst = Math.max(worst, lost);
            }
          }
        }
      }
      return { total, big, worst };
    };
    const before = count(legacyAlign);
    const after = count(align);
    console.log(`garbled tail after a skip: ${after.total} cases; retreats over 4 words ${before.big} → ${after.big}, worst ${before.worst} → ${after.worst}`);
    expect(after.total).toBe(621);
    expect(after.big).toBeLessThanOrEqual(before.big);
  });
});

describe('10d. asides that quote later words', () => {
  const T = 'The project starts in March. We hired two engineers for the launch. The budget for the project is fixed. Sales will grow in the spring.';

  it('"i hope sales will grow this year" does not ink the last sentence or move the cursor there', () => {
    const q = preparePassage(T);
    const heard = tokenise('the project starts in march i hope sales will grow this year we hired two engineers');
    for (const h of prefixes(heard)) expect([h.length, align(q, h).next <= 9]).toEqual([h.length, true]);
    const a = align(q, heard);
    expect(a.next).toBe(9);
    expect(a.skipped).toBe(0);
    expect(a.status.slice(20)).not.toContain('read');
  });

  it('asides of 3 later words, then back to where the reader was: far ones never ink or leap', () => {
    // qa-critic's generator: "sorry wait <3 words from 8, 15 or 25 ahead> no", then 6 words from where they were.
    const QA_STOP = new Set('a an the and or but if so of to in on at by for with from is are was were we i you it this that our my be have has had'.split(' '));
    const counts = (f: typeof align) => {
      const out = { cases: 0, falseGreen: 0, leap: 0, tenAhead: 0, far: 0, farFalseGreen: 0, farLeap: 0 };
      for (const t of QA_TEXTS) {
        const q = preparePassage(t.text);
        const keys = keysOf(q);
        const n = q.length;
        const rs = sentenceRanges(q);
        const sentOf = (k: number) => rs.findIndex(([s, e]) => k >= s && k < e);
        for (let pos = 5; pos < n - 30; pos += 3) {
          for (const d of [8, 15, 25]) {
            const c = pos + d;
            if (c + 3 > n) continue;
            const chunk = keys.slice(c, c + 3);
            if (chunk.every((w) => QA_STOP.has(w))) continue;
            const stopAt = Math.min(pos + 6, c);
            const heard = [...keys.slice(0, pos), 'sorry', 'wait', ...chunk, 'no', ...keys.slice(pos, stopAt)];
            out.cases++;
            let maxNext = 0;
            for (const h of prefixes(heard)) maxNext = Math.max(maxNext, f(q, h).next);
            const a = f(q, heard);
            const fg = [c, c + 1, c + 2].filter((k) => a.status[k] === 'read' && k >= stopAt).length;
            const far = sentOf(c) > sentOf(pos) + 1; // beyond the reader's sentence and the next
            if (far) out.far++;
            if (fg) out.falseGreen++;
            if (maxNext > stopAt + 2) out.leap++;
            if (a.next - stopAt >= 10) out.tenAhead++;
            if (far && fg) out.farFalseGreen++;
            if (far && maxNext > stopAt + 2) out.farLeap++;
          }
        }
      }
      return out;
    };
    const before = counts(legacyAlign);
    const after = counts(align);
    console.log(`asides (legacy): ${JSON.stringify(before)}\nasides (now):    ${JSON.stringify(after)}`);
    expect(after.cases).toBe(720);
    expect(after.farFalseGreen).toBe(0);
    expect(after.farLeap).toBe(0);
  });
});

describe('10e. performance on long scripts', () => {
  it('a 500-word script with a 150-word ramble stays under 1 ms per call, worst case', () => {
    const rnd = seeded(5);
    const all = keysOf(preparePassage([...PASSAGES.map((x) => x.text), ...SCRIPTS.map((s) => s.text)].join(' ')));
    const rows = ['words | transcript | heard | worst call ms (before → after)'];
    const slow: string[] = [];
    for (const [N, R] of [
      [300, 100],
      [500, 150],
    ]) {
      const q = preparePassage(all.slice(0, N).join(' '));
      const k = keysOf(q);
      const vocab = [...new Set(k)];
      const ramble = () => Array.from({ length: R }, () => vocab[Math.floor(rnd() * vocab.length)]);
      const shapes: [string, string[]][] = [
        [`ramble ${R} at 50`, [...k.slice(0, 50), ...ramble(), ...k.slice(50)]],
        [`ramble ${R} at the end`, [...k.slice(0, N - 20), ...ramble()]],
        ['read twice', [...k, ...k]],
        ['wrong passage from word 10', [...k.slice(0, 10), ...ramble(), ...ramble()]],
      ];
      for (const [label, heard] of shapes) {
        // every 7th prefix, longest first; each call's time is its best of 15 runs (the rest is noise)
        const worst = (f: typeof align) => {
          let w = 0;
          for (let len = heard.length; len > 0; len -= 7) {
            const h = heard.slice(0, len);
            let m = Infinity;
            for (let rep = 0; rep < 15; rep++) {
              const t0 = performance.now();
              f(q, h);
              m = Math.min(m, performance.now() - t0);
            }
            w = Math.max(w, m);
          }
          return w;
        };
        worst(align); // warm up
        const b = worst(legacyAlign);
        const a = worst(align);
        rows.push(`${N} | ${label} | ${heard.length} | ${b.toFixed(3)} → ${a.toFixed(3)}`);
        if (a >= 1) slow.push(`${N} ${label}: ${a.toFixed(3)} ms`);
      }
    }
    console.log(rows.join('\n'));
    expect(slow).toEqual([]);
  });
});

describe('10f. rereadingAt: where a re-read is, for the session screen', () => {
  const p = preparePassage(PASSAGES.find((x) => x.id === 'night-shift')!.text);
  const keys = keysOf(p);
  const rs = sentenceRanges(p);

  it('is absent on a straight read and in Free talk', () => {
    for (const h of prefixes(keys)) expect('rereadingAt' in align(p, h)).toBe(false);
    expect('rereadingAt' in align([], tokenise('so um we shipped it'))).toBe(false);
  });

  it('follows a re-read word by word and clears when it reaches the pointer', () => {
    const [s1, e1] = rs[1];
    const heard = [...keys.slice(0, e1), ...keys.slice(s1, e1), ...keys.slice(e1, e1 + 3)];
    const seen = prefixes(heard).map((h) => align(p, h).rereadingAt);
    const during = seen.slice(e1, e1 + (e1 - s1) - 1).filter((x): x is number => x !== undefined);
    expect(during.length).toBeGreaterThan(3);
    for (let i = 1; i < during.length; i++) expect(during[i]).toBeGreaterThan(during[i - 1]);
    expect(during.every((k) => k >= s1 && k < e1)).toBe(true);
    expect(seen[seen.length - 1]).toBeUndefined(); // back at the pointer and reading on
  });

  it('lets the session screen tell a backfill re-read from a stall', () => {
    // Skip sentence 2, read 5 words of sentence 3, go back and read sentence 2, then on (qa-critic's a11).
    const [a2, b2] = rs[1];
    const heard = [...keys.slice(0, a2), ...keys.slice(b2, b2 + 5), ...keys.slice(a2, b2), ...keys.slice(b2)];
    // What the screen does with the contract: the pointer or rereadingAt moving is progress, so
    // neither the "Pick up from" nudge (6 s) nor a mid-sentence pause (2 s) fires during the re-read.
    const sim = (useField: boolean) => {
      let lastNext = 0;
      let lastRe: number | undefined;
      let lastMove = 0;
      let stalls = 0;
      for (let i = 1; i <= heard.length; i++) {
        const t = i * 400;
        const a = align(p, heard.slice(0, i));
        const moved = a.next !== lastNext || (useField && a.rereadingAt !== lastRe);
        if (moved) {
          if (t - lastMove > 2000) stalls++;
          lastMove = t;
        }
        lastNext = a.next;
        lastRe = a.rereadingAt;
      }
      return stalls;
    };
    expect(sim(false)).toBeGreaterThan(0); // the stall the screen sees today
    expect(sim(true)).toBe(0);
    expect(align(p, heard).skipped).toBe(0);
  });
});
