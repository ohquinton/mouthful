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

// eslint-disable-next-line @typescript-eslint/no-require-imports
const MEMORY: ScriptFixture[] = require('./fixtures/memory-scripts.json').scripts;
// eslint-disable-next-line @typescript-eslint/no-require-imports
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
const skipCase = (group: string, t: Text, s: number, len: number) => {
  const p = preparePassage(t.text);
  return planCase(group, `${t.id} skip ${len} @${s}`, p, [[0, s], [s + len, p.length]], 1);
};

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
    .map(([s, e]) => planCase('skip sentence', `${t.id} skip sentence @${s}`, p, [[0, s], [e, p.length]], 1));
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
});

// ------------------------------------------------------------------------------------------------
// 2. Skips.

function skipFailures(cases: Case[]) {
  const fails: string[] = [];
  for (const c of cases) {
    const want = expected(c);
    const got = align(c.passage, c.heard).status;
    if (code(got) !== code(want)) {
      fails.push(`${c.label}: final\n  want ${code(want)}\n  got  ${code(got)}`);
      continue;
    }
    // Within 3 spoken words of resuming: the gap is red, the 3 words are inked, nothing else is red.
    const r = c.resume!;
    const a = align(c.passage, c.heard.slice(0, r.heard + 3));
    const upto = r.passage + 3;
    if (code(a.status.slice(0, upto)) !== code(want.slice(0, upto)) || a.next !== upto) {
      fails.push(`${c.label}: after 3 words\n  want ${code(want.slice(0, upto))}\n  got  ${code(a.status.slice(0, upto))} next=${a.next}`);
    }
  }
  return fails;
}

describe('2. skips resync within 3 words', () => {
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
      expect(skipFailures(SKIPS.filter((c) => c.group === `skip ${len}`))).toEqual([]);
    });
  }

  it('every skipped whole sentence: exactly that sentence is red', () => {
    expect(skipFailures(SENTENCE_SKIPS)).toEqual([]);
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
    expect(fails).toEqual([]);
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
      const fg = got.filter((s, k) => s === 'read' && !c.said[k]).length;
      if (fg) fails.push(`${c.label}: ${fg} false green\n  want ${code(expected(c))}\n  got  ${code(got)}`);
    }
    expect(fails).toEqual([]);
  });

  it('a skip lands on the nearest forward copy of a repeated phrase', () => {
    const t = REPEATED.find((x) => x.id === 'we-need-to')!;
    const p = preparePassage(t.text);
    const rs = sentenceRanges(p);
    // read sentence 1, skip sentence 2, read "we need to cut the cloud bill …"
    const c = planCase('named', 'we-need-to', p, [[0, rs[1][0]], [rs[2][0], p.length]], 1);
    expect(code(align(p, c.heard).status)).toBe(code(expected(c)));
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
        const b = score(c, legacyAlign(c.passage, c.heard).status);
        const a = score(c, align(c.passage, c.heard).status);
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

  it('interim revisions cause no more red↔green flicker than before', () => {
    const rows = ['group | cases | flicker before | flicker after'];
    const by: Record<string, [number, number, number]> = {};
    const worse: string[] = [];
    for (const c of sample) {
      const snaps = withRevisions(c.heard);
      const before = flickers(replay(legacyAlign, c, snaps).map((a) => a.status));
      const after = flickers(replay(align, c, snaps).map((a) => a.status));
      const g = (by[c.group.replace(/ \d+$/, '')] ??= [0, 0, 0]);
      g[0]++;
      g[1] += before;
      g[2] += after;
      if (after > before) worse.push(`${c.label}: ${before} → ${after}`);
    }
    for (const [g, [n, b, a]] of Object.entries(by)) rows.push(`${g} | ${n} | ${b} | ${a}`);
    console.log(rows.join('\n'));
    expect(worse).toEqual([]);
  });

  it('digits, contractions, homophones and near-misses in a skip still resync to the right place', () => {
    const fails: string[] = [];
    for (const c of [...SENTENCE_SKIPS, ...SKIPS.filter((x) => x.group === 'skip 10')]) {
      const heard = realistic([...c.heard]);
      const before = score(c, legacyAlign(c.passage, heard).status);
      const after = score(c, align(c.passage, heard).status);
      if (after.falseGreen > before.falseGreen) fails.push(`${c.label}: false green ${before.falseGreen} → ${after.falseGreen}`);
      if (after.inkedSaid < before.inkedSaid) fails.push(`${c.label}: inked ${before.inkedSaid} → ${after.inkedSaid}`);
    }
    expect(fails).toEqual([]);
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
    expect(fails).toEqual([]);
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
    const rows = ['passage | words | heard | stuck run | median ms/call | max ms/call (before → after)'];
    for (const [name, text] of [[longest.id, longest.text], ['190-word script chunk', chunk]]) {
      const p = preparePassage(text);
      const keys = keysOf(p);
      // 40 off-script words made of the passage's own vocabulary shuffled: no bigram lines up, so the
      // search runs on every word, the costliest case.
      const vocab = [...new Set(keys)];
      const stuck = Array.from({ length: 40 }, (_, i) => vocab[(i * 37 + 11) % vocab.length]);
      const heard = [...keys.slice(0, 15), ...stuck, ...keys.slice(15)];
      const time = (f: typeof align) => {
        const ts: number[] = [];
        for (let rep = 0; rep < 3; rep++) {
          for (const h of prefixes(heard)) {
            const t0 = performance.now();
            f(p, h);
            ts.push(performance.now() - t0);
          }
        }
        ts.sort((a, b) => a - b);
        return { median: ts[Math.floor(ts.length / 2)], p99: ts[Math.floor(ts.length * 0.99)], max: ts[ts.length - 1] };
      };
      time(align); // warm up the JIT and the per-passage index
      const b = time(legacyAlign);
      const a = time(align);
      rows.push(`${name} | ${p.length} | ${heard.length} | 40 | ${b.median.toFixed(3)} → ${a.median.toFixed(3)} | p99 ${b.p99.toFixed(3)} → ${a.p99.toFixed(3)}, max ${b.max.toFixed(3)} → ${a.max.toFixed(3)}`);
      expect(a.p99).toBeLessThan(1);
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
