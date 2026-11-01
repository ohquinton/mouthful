// Topic talk wording: repeated words and vocabulary variety (remodel step 3, the scorecard table in
// docs/briefs/remodel-2026-11.md). Both are SHOWN, never scored: Flow ignores them until the beta
// says otherwise (DECISIONS 2026-11-01, principle 7's spirit). Neither is a grade of the person.
//
// Input is tokenise() output for one talk (lower case, no punctuation). Run once at Finish, not per
// recogniser update. Everything is O(n) in the number of tokens.
//
// What is never counted here, so nothing is counted twice:
//   - hesitations (um, uh…): align.ts counts them as fillers;
//   - every habit word and phrase, from the lists that report them: align.ts HABIT_WORDS and
//     HABIT_PHRASES (the Glide and Free talk habit line: like, okay, anyway, you see…) and habits.ts
//     HABIT_SINGLE_FORMS and HABIT_PAIR_FORMS (the classifier: kinda, sorta, ya know…);
//   - an immediate repeat of the same word or of the same run of up to MAX_SEAM words ("really
//     really", "we bought bread we bought bread"): counted once. A recogniser restart can double a
//     few words at the seam, and we never claim more than was said.
//
// Pure. No React, no Date.now().

import { HABIT_PHRASES, HABIT_WORDS, HESITATIONS, tokenise } from './align';
import { HABIT_PAIR_FORMS, HABIT_SINGLE_FORMS } from './habits';

// ---------------------------------------------------------------------------------------------
// Parameters (unvalidated: check against beta transcripts before changing or scoring)

/** Fewer spoken words than this (hesitations not counted): no repeated words. Same floor as One Minute. */
export const MIN_TALK_WORDS = 15;
/**
 * A content word is "clearly over-used" at this many uses or more (and MIN_REPEAT_SHARE). In our one-minute fixtures,
 * natural topical talk repeats a non-topic content word 2–3 times ("sister", "weekend", "small",
 * "table"); 4 is the first count that stands out to a listener. A count, so it's checkable against
 * the recording.
 */
export const MIN_REPEATS = 4;
/**
 * A flagged word must also be at least this share of all content words. In a one-minute talk (~50–100 content words)
 * this is ≤ 4 uses, so MIN_REPEATS decides; in a longer Free talk it raises the bar with length
 * (200 content words → 8), so ordinary repetition over three minutes isn't flagged.
 */
export const MIN_REPEAT_SHARE = 0.04;
/** At most this many repeated words are returned, most used first. */
export const MAX_REPEATED = 3;
/**
 * Longest run of words collapsed when it comes twice in a row. Restart seams double a few words;
 * 8 covers a short clause ("we bought bread at the market") and nothing a speaker repeats on purpose
 * that a listener would count twice.
 */
export const MAX_SEAM = 8;
/** MATTR window, in words. Also the minimum talk length for a variety record. */
export const VARIETY_WINDOW = 50;
/**
 * Pooled variety (the only variety number meant for a screen) needs this many talks with a record
 * and this many words between them. Why, from a simulated speaker (a seeded Zipf vocabulary, 400
 * talks per length; wording.test.ts keeps a smaller version) and our fixtures:
 *   - One talk is too noisy. A 55–90 word talk's per50 has an SD of 2.3–3.2 and a 5th–95th
 *     percentile spread of 7.5–10.5 points; at 150 words still SD ~1.8 (spread ~6). Topic alone
 *     moved our three fluent fixtures 40 → 44. The whole gap between fluent and realistic learner
 *     speech is about 9, and a month of real progress is likely a few points, so a per-talk number
 *     would mostly show noise as change.
 *   - Raising the per-talk floor to ~120 words doesn't fix it (SD ~2.2, spread ~7) and would give
 *     slower speakers (often learners: our learner fixtures are 84–106 counted words) no number.
 *   - Pooling the windows of 3+ talks and 250+ words brings the SD to 1.0–1.5 (spread 3.5–5),
 *     5 talks to ~1.0, and averages the topic effect over several topics. 250, not 300, so three
 *     minutes from a slower speaker qualify.
 */
export const VARIETY_POOL_MIN_TALKS = 3;
export const VARIETY_POOL_MIN_WORDS = 250;

// ---------------------------------------------------------------------------------------------
// Content words

const set = (s: string): ReadonlySet<string> => new Set(s.split(/\s+/).filter(Boolean));

/**
 * Function words, never counted as repeated or precise. Explicit and small: articles and
 * determiners, pronouns ("ya" is how recognisers write a casual "you"), prepositions, auxiliaries
 * and modals, conjunctions, and back-channel interjections and discourse markers. "well" is here:
 * as a word it is mostly "as well" or an opener ("well, I think"), a speaking habit rather than a
 * word choice, and "you said 'well' 5 times" offers no better word.
 * Deliberately NOT here: "really", "very", "just", "then", "also", "thing", "good", "people",
 * "get": over-using those is exactly what the signal is for (vague words with sharper ones nearby).
 */
const STOP = set(`
  a an the this that these those some any each every either neither all both no not another other others
  such what which whose many much more most few less least several own enough same
  i me my mine myself you your yours yourself yourselves he him his himself she her hers herself
  it its itself we us our ours ourselves they them their theirs themselves one ones ya
  someone something somebody anyone anything anybody everyone everything everybody nobody nothing none
  who whom whoever whatever there here
  about above across after against along among around as at before behind below beneath beside besides
  between beyond by down during except for from in inside into near of off on onto out outside over past
  since through throughout till to toward towards under until up upon via with within without per than
  am is are was were be been being have has had having do does did doing done
  will would shall should can could may might must ought gonna wanna gotta
  and or but nor yet because if though although while whereas whether unless once when where why how
  yeah yes yep yup nope oh ok hey well
`);

/**
 * Number words: normalise() turns "2" into "two", so a recogniser's digits and spoken numbers end up
 * here. Saying "two" four times is a fact of the story ("two sisters, two brothers"), not a word
 * choice with a better option. ("one" is already a function word.)
 */
const NUMBERS = set(`
  zero two three four five six seven eight nine ten eleven twelve thirteen fourteen fifteen sixteen
  seventeen eighteen nineteen twenty thirty forty fifty sixty seventy eighty ninety hundred thousand
  million billion percent
`);

/** Every habit form any counter reports (see the header). One set each, built once. */
const HABIT_ONE: ReadonlySet<string> = new Set([...HABIT_WORDS, ...HABIT_SINGLE_FORMS]);
const HABIT_TWO: ReadonlySet<string> = new Set([...HABIT_PHRASES, ...HABIT_PAIR_FORMS]);

/** Words ending in s that aren't plurals: "news" is not "new", "lens" not "len". */
const NOT_PLURAL = set('news lens series species physics politics economics mathematics maths ethics chaos bias always perhaps');

/**
 * Simple plurals only, no stemmer: things → thing, stories → story, boxes → box, buses → buse
 * (the key then folds "-se", below). Leaves -ss, -us, -is words alone (glass, bus, basis). "-oes"
 * is left too ("shoes" isn't "sho"), so "tomatoes" and "tomato" stay apart. Verb endings (-ing, -ed)
 * are not folded: "walk" and "walking" are two words.
 */
function foldPlural(w: string): string {
  if (NOT_PLURAL.has(w)) return w;
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && /(?:ss|sh|ch|x|z)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !/(?:ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

/**
 * Two spellings meet under one key: a final "-se" drops its e, so "bus"/"buses" (bus, buse), "gas"/
 * "gases" and "house"/"houses" each share a key. Plain English can't tell "buses" (bus) from
 * "houses" (house) by spelling, so both sides fold instead. Keys are only compared, never shown.
 */
function keyOf(singular: string): string {
  return singular.length > 3 && singular.endsWith('se') ? singular.slice(0, -1) : singular;
}

/**
 * The key a content word is counted under, or null for anything that isn't one: function words,
 * number words, hesitations, habit words, contractions ("don't", "it's"), digits and symbols,
 * single letters. A possessive keeps its noun: "grandmother's" → "grandmother".
 */
export function contentKey(token: string): string | null {
  let w = token;
  if (w.endsWith("'s")) {
    w = w.slice(0, -2);
    if (STOP.has(w) || w === 'let') return null; // it's, that's, there's, let's
  }
  if (w.length < 2 || !/^[a-z]+$/.test(w)) return null; // contractions, digits, symbols, letters
  if (STOP.has(w) || NUMBERS.has(w) || HESITATIONS.has(w) || HABIT_ONE.has(w)) return null;
  return keyOf(foldPlural(w));
}

// ---------------------------------------------------------------------------------------------
// The prompt's word family

/**
 * Stems of a prompt key: the key itself, plus the base of an obvious derived or inflected form
 * (kindness → kind, freedom → free, learned → learn, tried → try, working → work).
 */
function stemsOf(key: string): string[] {
  const out = [key];
  let m: RegExpExecArray | null;
  if ((m = /^([a-z]{3,})(?:ness|dom|ful|ment|ship|hood|less)$/.exec(key))) out.push(m[1]);
  if (key.length > 4 && key.endsWith('ied')) out.push(key.slice(0, -3) + 'y');
  else if ((m = /^([a-z]{4,})ed$/.exec(key))) out.push(m[1]);
  if ((m = /^([a-z]{3,})ing$/.exec(key))) out.push(m[1]);
  return out;
}

/** Endings that follow a stem whose final e is dropped: time → timing, phone → phoning, cycle → cyclist. */
const AFTER_E = /^(?:ing|ed|er|est|y|ish|able|ation|ion|ist)/;
/**
 * Inflections of a short stem (3 letters or fewer), with the last letter doubled or not: old → older,
 * bus → bused. Plurals need no ending here: they already share the key (bus/buses). No bare -s, so
 * "new" doesn't take "news".
 */
const SHORT_ENDINGS = ['ed', 'er', 'est', 'ing'];
/** Shared opening letters that make two words one family: patience/patient, silence/silent, success/succeed. */
const SHARED_PREFIX = 5;

function stemFamily(k: string, s: string): boolean {
  if (k === s) return true;
  if (s.length >= 4) {
    if (k.startsWith(s)) return true; // rainy, raining, luckily, kindly, freely, homework
    if (s.endsWith('e') && k.startsWith(s.slice(0, -1)) && AFTER_E.test(k.slice(s.length - 1))) return true;
    if (s.endsWith('y') && k.startsWith(s.slice(0, -1) + 'i')) return true; // happy → happiness
    return false;
  }
  for (const e of SHORT_ENDINGS) if (k === s + e || k === s + s[s.length - 1] + e) return true;
  if (s.endsWith('y')) for (const e of ['es', 'ed', 'er', 'est']) if (k === s.slice(0, -1) + 'i' + e) return true;
  return false;
}

function sharedPrefix(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/**
 * Is a word in the prompt's family? Talking about luck means saying "lucky"; staying on topic is the
 * task, so the prompt's words and their family are never flagged as repeated or counted as precise.
 * A small rule a person can check, no stemmer or dictionary. A talk word (by its contentKey) is in
 * the family of a prompt content word when:
 *   1. it is the same key (rain/rains, bus/buses, shoe/shoes), or a stem of it (kindness → kind);
 *   2. a stem of 4+ letters starts it (raining, rainy, lucky, successful, homework), or does after
 *      dropping a final e (timing, changing) or turning y into i (happiness);
 *   3. a stem of 3 letters or fewer takes only -ed, -er, -est or -ing (older, oldest, bused), so
 *      "bus" bans "buses" (same key) but not "busy", and "new" not "news";
 *   4. it shares its first 5 letters with the prompt word (patient/patience, silent/silence,
 *      succeed/success, explanation/explain);
 *   5. it is one of those after un-, in-, im-, ir-, il-, dis- or mis- (unlucky, impatient, distrust).
 * `related` adds words the content team lists for a prompt (bike for "A bicycle"); they get the
 * same family rule. Returns a predicate over tokens.
 */
export function promptFamily(prompt: string | undefined, related: readonly string[] = []): (token: string) => boolean {
  const words: string[] = [];
  for (const t of [...(prompt ? tokenise(prompt) : []), ...related.flatMap((r) => tokenise(r))]) {
    const k = contentKey(t);
    if (k && !words.includes(k)) words.push(k);
  }
  if (!words.length) return () => false;
  const stems = words.flatMap(stemsOf);
  const direct = (k: string) => stems.some((s) => stemFamily(k, s)) || words.some((p) => p.length >= SHARED_PREFIX && sharedPrefix(k, p) >= SHARED_PREFIX);
  const memo = new Map<string, boolean>();
  return (token: string) => {
    const k = contentKey(token);
    if (!k) return false;
    let hit = memo.get(k);
    if (hit === undefined) {
      const neg = /^(?:un|in|im|ir|il|dis|mis)([a-z]{4,})$/.exec(k);
      hit = direct(k) || (!!neg && direct(neg[1]));
      memo.set(k, hit);
    }
    return hit;
  };
}

// ---------------------------------------------------------------------------------------------
// The talk's words

/**
 * The talk's words as both signals see them: hesitations out, every habit word and both words of a
 * habit phrase out, and a run of 1..MAX_SEAM words said twice in a row kept once. A habit word ends
 * a run (so "really, like, really" is two uses); a hesitation doesn't ("really um really" is one).
 * Runs are compared as heard, never after an earlier collapse, so "really busy, really really busy"
 * keeps both "really busy"s (only the "really really" is one). Function words stay (MATTR is defined
 * over all words). Two passes; at most MAX_SEAM² comparisons per word.
 */
function talkWords(tokens: readonly string[]): string[] {
  const seq: string[] = [];
  const seg: number[] = []; // which stretch between habit words each word is in
  let s = 0;
  for (let k = 0; k < tokens.length; k++) {
    const w = tokens[k];
    if (HESITATIONS.has(w)) continue;
    if (k + 1 < tokens.length && HABIT_TWO.has(`${w} ${tokens[k + 1]}`)) {
      k++;
      s++;
      continue;
    }
    if (HABIT_ONE.has(w)) {
      s++;
      continue;
    }
    seq.push(w);
    seg.push(s);
  }
  const out: string[] = [];
  next: for (let i = 0; i < seq.length; i++) {
    for (let n = 1; n <= MAX_SEAM && i + 2 * n <= seq.length && seg[i + 2 * n - 1] === seg[i]; n++) {
      let same = true;
      for (let j = 0; j < n && same; j++) same = seq[i + j] === seq[i + n + j];
      if (same) {
        i += n - 1; // drop this copy; the next one is kept (or dropped in turn if it comes again)
        continue next;
      }
    }
    out.push(seq[i]);
  }
  return out;
}

function spokenCount(tokens: readonly string[]): number {
  let n = 0;
  for (const w of tokens) if (!HESITATIONS.has(w)) n++;
  return n;
}

// ---------------------------------------------------------------------------------------------
// Repeated words

export type RepeatedWord = {
  /** The form heard most (first heard on a tie), e.g. "really". */
  word: string;
  /** Uses, all forms together ("thing" + "things"), an immediate repeat counted once. */
  count: number;
  /** Every form heard, first heard first: ["thing", "things"]. */
  forms: string[];
};

export type WordingOptions = {
  /** The prompt's text ("Coffee"). Its word family is never flagged or counted precise. */
  prompt?: string;
  /** Extra words in the prompt's family, from content (bike for "A bicycle"). */
  related?: readonly string[];
};

/**
 * Content words the speaker leans on: "you said 'really' 10 times". Leaves out function words,
 * number words, hesitations, habit words and phrases, and the prompt's word family (talking about
 * luck means saying "lucky"). A word is flagged at MIN_REPEATS uses and MIN_REPEAT_SHARE of the
 * content words, whichever asks more. Top MAX_REPEATED, most used first. [] under MIN_TALK_WORDS.
 *
 * Names are counted like any other word: tokens are lower case, so "Anna" and "anna" look the same,
 * and a list of names would exempt common English names and still flag everyone else's. Known limit.
 */
export function repeatedWords(tokens: readonly string[], opts: WordingOptions = {}): RepeatedWord[] {
  if (spokenCount(tokens) < MIN_TALK_WORDS) return [];
  const banned = promptFamily(opts.prompt, opts.related);
  type Tally = { count: number; first: number; forms: Map<string, number> };
  const tally = new Map<string, Tally>();
  let content = 0;
  const words = talkWords(tokens);
  for (let k = 0; k < words.length; k++) {
    const key = contentKey(words[k]);
    if (!key) continue;
    content++;
    if (banned(words[k])) continue;
    let t = tally.get(key);
    if (!t) tally.set(key, (t = { count: 0, first: k, forms: new Map() }));
    t.count++;
    t.forms.set(words[k], (t.forms.get(words[k]) ?? 0) + 1);
  }
  const bar = Math.max(MIN_REPEATS, Math.ceil(MIN_REPEAT_SHARE * content));
  const flagged: (RepeatedWord & { first: number })[] = [];
  for (const t of tally.values()) {
    if (t.count < bar) continue;
    let word = '';
    let most = 0;
    for (const [form, n] of t.forms) if (n > most) [word, most] = [form, n]; // Map keeps first-heard order
    flagged.push({ word, count: t.count, forms: [...t.forms.keys()], first: t.first });
  }
  return flagged
    .sort((a, b) => b.count - a.count || a.first - b.first)
    .slice(0, MAX_REPEATED)
    .map(({ word, count, forms }) => ({ word, count, forms }));
}

// ---------------------------------------------------------------------------------------------
// Vocabulary variety

/** Sum of distinct words over every `window`-word run, and how many runs. The core of MATTR. */
function windowSums(words: readonly string[], window: number): { sum: number; windows: number; width: number } {
  const n = words.length;
  const w = Math.min(window, n);
  if (w === 0) return { sum: 0, windows: 0, width: 0 };
  const counts = new Map<string, number>();
  let distinct = 0;
  for (let k = 0; k < w; k++) {
    const c = counts.get(words[k]) ?? 0;
    if (c === 0) distinct++;
    counts.set(words[k], c + 1);
  }
  let sum = distinct;
  for (let k = w; k < n; k++) {
    const inW = words[k];
    const ci = counts.get(inW) ?? 0;
    if (ci === 0) distinct++;
    counts.set(inW, ci + 1);
    const outW = words[k - w];
    const co = counts.get(outW)! - 1;
    if (co === 0) distinct--;
    counts.set(outW, co);
    sum += distinct;
  }
  return { sum, windows: n - w + 1, width: w };
}

/**
 * Moving-average type-token ratio (MATTR): the share of different words in every run of `window`
 * words in a row, averaged over all such runs. Covington, M. A. & McFall, J. D. (2010), "Cutting
 * the Gordian knot: The moving-average type–token ratio (MATTR)", Journal of Quantitative
 * Linguistics 17(2), 94–100.
 *
 * Why MATTR, not plain TTR or MTLD:
 *   - Plain TTR (different words / all words) falls as a talk gets longer, because common words
 *     come back. A fixed window removes that: a long talk and a short one are measured the same way.
 *     Fergadiotis, Wright & Green (2015), J. Speech Lang. Hear. Res. 58(3), 840–852, found MATTR
 *     among the least length-sensitive indices on spoken discourse samples.
 *   - MTLD (McCarthy & Jarvis 2010) is also length-robust but is recommended for 100+ words and is
 *     unstable on short samples; a minute of talk is often 80–150 words, and a slower speaker less.
 *   - MATTR explains itself in one sentence: "in any 50 words in a row, about N were different".
 * Under one window, it is plain TTR (Covington & McFall); vocabularyVariety() doesn't report that.
 * O(n): one count map, one word in and one out per step.
 */
export function movingTypeTokenRatio(words: readonly string[], window = VARIETY_WINDOW): number {
  const { sum, windows, width } = windowSums(words, window);
  return windows ? sum / windows / width : 0;
}

/**
 * One talk's variety record. NOT a number to show: one talk is too noisy (VARIETY_POOL_MIN_TALKS).
 * It is what pooledVariety() pools, so the Tape can show a weekly number without keeping anyone's words.
 */
export type VocabularyVariety = {
  /** This talk's MATTR over VARIETY_WINDOW words, 0–1, three decimals. Pool it; don't show it alone. */
  mattr: number;
  /** How many VARIETY_WINDOW-word runs it averages (words − window + 1): its weight in a pool. */
  windows: number;
  window: number;
  /** Words it was measured over (hesitations, habit words, the prompt's family and immediate repeats left out). */
  words: number;
  /**
   * Content words not on the everyday list, once each, first heard first. Only when a list is
   * passed (`common`): the app bundles none yet, so this is left out rather than guessed.
   */
  precise?: { count: number; words: string[] };
};

/**
 * How varied one talk's words were (MATTR), as a record for pooledVariety(), and optionally which
 * were rarer than everyday vocabulary. Undefined under VARIETY_WINDOW words.
 * The prompt's word family is left out of the windows, as in repeatedWords: a learner who says
 * "bus" eight times in a talk about the bus is on topic, not short of words.
 * `common`: lower-case everyday words, ideally including inflected forms ("went", "running"); a word
 * counts as precise only if neither its form nor its plural-folded key is on it. Prompt words never
 * count as precise.
 */
export function vocabularyVariety(
  tokens: readonly string[],
  opts: WordingOptions & { common?: ReadonlySet<string> } = {},
): VocabularyVariety | undefined {
  const banned = promptFamily(opts.prompt, opts.related);
  const words = talkWords(tokens).filter((w) => !banned(w));
  if (words.length < VARIETY_WINDOW) return undefined;
  const { sum, windows } = windowSums(words, VARIETY_WINDOW);
  const mattr = Math.round((sum / windows / VARIETY_WINDOW) * 1000) / 1000;
  const out: VocabularyVariety = { mattr, windows, window: VARIETY_WINDOW, words: words.length };
  if (opts.common) {
    const common = opts.common;
    const seen = new Set<string>();
    const precise: string[] = [];
    for (const w of words) {
      const key = contentKey(w);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      if (common.has(w) || common.has(foldPlural(w)) || common.has(key)) continue;
      precise.push(w);
    }
    out.precise = { count: precise.length, words: precise };
  }
  return out;
}

export type PooledVariety = {
  /** The display number: different words in each 50 in a row, on average over the pooled talks. */
  per50: number;
  /** Pooled MATTR, 0–1, three decimals. */
  mattr: number;
  /** Talks pooled (those with a record). */
  talks: number;
  /** Words between them. */
  words: number;
};

/**
 * Vocabulary variety over several talks (say the last 7 days, or the last 5 talks): every 50-word
 * window of every talk, averaged. Windows never cross from one talk into the next (a run spanning
 * two topics would read falsely varied), so this is exact from the per-talk records alone, and no
 * transcript needs keeping. Undefined under VARIETY_POOL_MIN_TALKS talks or VARIETY_POOL_MIN_WORDS
 * words: no number rather than a noisy one. Compare it only with the same person's earlier pools.
 */
export function pooledVariety(
  talks: readonly (Pick<VocabularyVariety, 'mattr' | 'windows' | 'words'> | null | undefined)[],
): PooledVariety | undefined {
  let sum = 0;
  let windows = 0;
  let words = 0;
  let n = 0;
  for (const t of talks) {
    if (!t || !(t.windows > 0) || !Number.isFinite(t.mattr)) continue;
    sum += t.mattr * t.windows;
    windows += t.windows;
    words += t.words;
    n++;
  }
  if (n < VARIETY_POOL_MIN_TALKS || words < VARIETY_POOL_MIN_WORDS) return undefined;
  const mattr = Math.round((sum / windows) * 1000) / 1000;
  return { per50: Math.round(mattr * VARIETY_WINDOW), mattr, talks: n, words };
}
