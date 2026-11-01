// Topic talk wording: repeated words and vocabulary variety (remodel step 3, the scorecard table in
// docs/briefs/remodel-2026-11.md). Both are SHOWN, never scored: Flow ignores them until the beta
// says otherwise (DECISIONS 2026-11-01, principle 7's spirit). Neither is a grade of the person.
//
// Input is tokenise() output for one talk (lower case, no punctuation). Run once at Finish, not per
// recogniser update. Everything is O(n) in the number of tokens.
//
// What is never counted here, so nothing is counted twice:
//   - hesitations (um, uh…): align.ts counts them as fillers;
//   - habit words and phrases (like, basically, you know, kind of…): align.ts and habits.ts report them;
//   - an immediate repeat of the same word ("really really", "the the"): counted once. A recogniser
//     restart can double a word at the seam, and we never claim more than was said.
//
// Pure. No React, no Date.now().

import { HABIT_PHRASES, HABIT_WORDS, HESITATIONS, tokenise } from './align';

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
/** MATTR window, in words. Also the minimum talk length for a variety number. */
export const VARIETY_WINDOW = 50;

// ---------------------------------------------------------------------------------------------
// Content words

const set = (s: string): ReadonlySet<string> => new Set(s.split(/\s+/).filter(Boolean));

/**
 * Function words, never counted as repeated or precise. Explicit and small: articles and
 * determiners, pronouns, prepositions, auxiliaries and modals, conjunctions, and back-channel
 * interjections. Deliberately NOT here: "really", "very", "just", "then", "also", "thing", "good",
 * "get": over-using those is exactly what the signal is for.
 */
const STOP = set(`
  a an the this that these those some any each every either neither all both no not another other others
  such what which whose many much more most few less least several own enough same
  i me my mine myself you your yours yourself yourselves he him his himself she her hers herself
  it its itself we us our ours ourselves they them their theirs themselves one ones
  someone something somebody anyone anything anybody everyone everything everybody nobody nothing none
  who whom whoever whatever there here
  about above across after against along among around as at before behind below beneath beside besides
  between beyond by down during except for from in inside into near of off on onto out outside over past
  since through throughout till to toward towards under until up upon via with within without per than
  am is are was were be been being have has had having do does did doing done
  will would shall should can could may might must ought gonna wanna gotta
  and or but nor yet because if though although while whereas whether unless once when where why how
  yeah yes yep yup nope oh ok hey
`);

/**
 * Simple plurals only, no stemmer: things → thing, stories → story, boxes → box. Leaves -ss, -us,
 * -is words alone (glass, bus, basis). "-oes" is left too ("shoes" isn't "sho"), so "tomatoes" and
 * "tomato" stay apart. Verb endings (-ing, -ed) are not folded: "walk" and "walking" are two words.
 */
function foldPlural(w: string): string {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y';
  if (w.length > 4 && /(?:ss|sh|ch|x|z)es$/.test(w)) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !/(?:ss|us|is)$/.test(w)) return w.slice(0, -1);
  return w;
}

/**
 * The key a content word is counted under, or null for anything that isn't one: function words,
 * hesitations, habit words, contractions ("don't", "it's"), digits and symbols, single letters.
 * A possessive keeps its noun: "grandmother's" → "grandmother".
 */
export function contentKey(token: string): string | null {
  let w = token;
  if (w.endsWith("'s")) {
    w = w.slice(0, -2);
    if (STOP.has(w) || w === 'let') return null; // it's, that's, there's, let's
  }
  if (w.length < 2 || !/^[a-z]+$/.test(w)) return null; // contractions, digits, symbols, letters
  if (STOP.has(w) || HESITATIONS.has(w) || HABIT_WORDS.has(w)) return null;
  return foldPlural(w);
}

/** The content-word keys of a prompt ("Your kitchen" → kitchen), never flagged or counted precise. */
function promptKeys(prompt: string | undefined): Set<string> {
  const out = new Set<string>();
  if (!prompt) return out;
  for (const t of tokenise(prompt)) {
    const k = contentKey(t);
    if (k) out.add(k);
  }
  return out;
}

/**
 * The talk's words as both signals see them: hesitations out, habit words and both words of a
 * habit phrase out ("you know", "kind of"), an immediate repeat counted once. Function words stay
 * (MATTR is defined over all words). One pass.
 */
function talkWords(tokens: readonly string[]): string[] {
  const out: string[] = [];
  let prev: string | undefined;
  for (let k = 0; k < tokens.length; k++) {
    const w = tokens[k];
    if (HESITATIONS.has(w)) continue; // "really um really" is still an immediate repeat
    if (k + 1 < tokens.length && HABIT_PHRASES.has(`${w} ${tokens[k + 1]}`)) {
      k++;
      prev = undefined;
      continue;
    }
    if (HABIT_WORDS.has(w)) {
      prev = undefined;
      continue;
    }
    if (w === prev) continue;
    out.push(w);
    prev = w;
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

/**
 * Content words the speaker leans on: "you said 'really' 10 times". Leaves out function words,
 * hesitations, habit words and phrases, and every content word of the prompt (talking about coffee
 * means saying "coffee"). A word is flagged at MIN_REPEATS uses and MIN_REPEAT_SHARE of the content
 * words, whichever asks more. Top MAX_REPEATED, most used first. [] under MIN_TALK_WORDS.
 */
export function repeatedWords(tokens: readonly string[], opts: { prompt?: string } = {}): RepeatedWord[] {
  if (spokenCount(tokens) < MIN_TALK_WORDS) return [];
  const banned = promptKeys(opts.prompt);
  type Tally = { count: number; first: number; forms: Map<string, number> };
  const tally = new Map<string, Tally>();
  let content = 0;
  const words = talkWords(tokens);
  for (let k = 0; k < words.length; k++) {
    const key = contentKey(words[k]);
    if (!key) continue;
    content++;
    if (banned.has(key)) continue;
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
  const n = words.length;
  if (n === 0) return 0;
  const w = Math.min(window, n);
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
  return sum / (n - w + 1) / w;
}

export type VocabularyVariety = {
  /** MATTR over VARIETY_WINDOW words, 0–1, three decimals. */
  mattr: number;
  /** The display number: different words in each 50 in a row, on average (round(mattr × 50)). */
  per50: number;
  window: number;
  /** Words it was measured over (hesitations, habit words and immediate repeats left out). */
  words: number;
  /**
   * Content words not on the everyday list, once each, first heard first. Only when a list is
   * passed (`common`): the app bundles none yet, so this is left out rather than guessed.
   */
  precise?: { count: number; words: string[] };
};

/**
 * How varied the words were (MATTR), and optionally which were rarer than everyday vocabulary.
 * Undefined under VARIETY_WINDOW words: a shorter talk gets no number rather than a shaky one.
 * `common`: lower-case everyday words, ideally including inflected forms ("went", "running"); a word
 * counts as precise only if neither its form nor its plural-folded key is on it. Prompt words never
 * count as precise.
 */
export function vocabularyVariety(
  tokens: readonly string[],
  opts: { prompt?: string; common?: ReadonlySet<string> } = {},
): VocabularyVariety | undefined {
  const words = talkWords(tokens);
  if (words.length < VARIETY_WINDOW) return undefined;
  const mattr = Math.round(movingTypeTokenRatio(words) * 1000) / 1000;
  const out: VocabularyVariety = { mattr, per50: Math.round(mattr * VARIETY_WINDOW), window: VARIETY_WINDOW, words: words.length };
  if (opts.common) {
    const common = opts.common;
    const banned = promptKeys(opts.prompt);
    const seen = new Set<string>();
    const precise: string[] = [];
    for (const w of words) {
      const key = contentKey(w);
      if (!key || banned.has(key) || seen.has(key)) continue;
      seen.add(key);
      if (common.has(w) || common.has(key)) continue;
      precise.push(w);
    }
    out.precise = { count: precise.length, words: precise };
  }
  return out;
}
