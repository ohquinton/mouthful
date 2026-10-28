// Glide engine: lines up what the speech recogniser heard with the passage on screen.
// Pure functions only, so it can be unit tested without a phone.

export type WordStatus = 'pending' | 'read' | 'skipped';

export type PassageWord = {
  display: string; // exactly as shown, punctuation included
  key: string; // normalised for matching
  breathAfter: boolean; // a comma / full stop follows, so a pause here is good
  sentenceEnd: boolean;
};

export type Alignment = {
  status: WordStatus[];
  next: number; // index of the next expected passage word
  read: number;
  skipped: number;
  fillers: Record<string, number>; // scored fillers: hesitations only (um, uh, erm)
  fillerCount: number;
  hesitations: Record<string, number>; // same as fillers; kept for clarity at call sites
  hesitationCount: number;
  habits: Record<string, number>; // like, so, you know: reported, never scored
  habitCount: number;
  spoken: number; // words that count toward pace (passage words + off-script words incl. habit words; not hesitations)
  done: boolean;
  /**
   * Only while the reader is re-reading behind the pointer (a backfill): the passage index of the
   * word they just re-read. The pointer holds during a re-read, so the session screen should count
   * a change here as progress (no "Pick up from" nudge, no mid-sentence pause). Absent otherwise,
   * including once the re-read reaches the pointer and reading carries on.
   */
  rereadingAt?: number;
};

const LOOKAHEAD = 5;

// Hesitation sounds are never real words, so they always count.
const HESITATIONS = new Set(['um', 'umm', 'uh', 'uhh', 'uhm', 'erm', 'er', 'ah', 'hmm', 'mm']);
// Habit words are real words with real uses ("so that", "I like it", "right now"). An off-script
// one might be a habit, or a reader rephrasing, or the recogniser mishearing. We can't tell which,
// so they're reported on the Tape and never scored, while reading or in free talk.
const HABIT_WORDS = new Set(['like', 'basically', 'actually', 'literally', 'so', 'right', 'okay', 'anyway']);
const HABIT_PHRASES = new Set(['you know', 'i mean', 'kind of', 'sort of', 'you see']);

// Some words the recogniser writes as digits or symbols. Map the common ones back.
const NUMBER_WORDS: Record<string, string> = {
  '0': 'zero', '1': 'one', '2': 'two', '3': 'three', '4': 'four', '5': 'five',
  '6': 'six', '7': 'seven', '8': 'eight', '9': 'nine', '10': 'ten',
  '&': 'and', '%': 'percent',
};

export function normalise(word: string): string {
  const w = word
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'&%]/g, '')
    .replace(/^'+|'+$/g, '');
  return NUMBER_WORDS[w] ?? w;
}

/** Splits recogniser output into normalised tokens. Hyphenated words become two tokens. */
export function tokenise(text: string): string[] {
  return text
    .replace(/[-–—]/g, ' ')
    .split(/\s+/)
    .map(normalise)
    .filter(Boolean);
}

export function preparePassage(text: string): PassageWord[] {
  return text
    .split(/\s+/)
    .filter(Boolean)
    .flatMap((raw) => {
      // "well-known" shows as one word on screen but people say two.
      const parts = raw.split(/(?<=-)/);
      return parts.map((display, i) => {
        const last = i === parts.length - 1;
        return {
          display,
          key: normalise(display),
          breathAfter: last && /[,;:.!?]["”’)]?$/.test(raw),
          sentenceEnd: last && /[.!?]["”’)]?$/.test(raw),
        };
      });
    })
    .filter((w) => w.key.length > 0);
}

function editDistanceAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  let j = 0;
  let edits = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    if (++edits > 1) return false;
    if (a.length > b.length) i++;
    else if (b.length > a.length) j++;
    else {
      i++;
      j++;
    }
  }
  return edits + (a.length - i) + (b.length - j) <= 1;
}

/** Exact match, or one letter off for longer words (forgives accents and recogniser spelling). */
export function wordsMatch(heard: string, expected: string): boolean {
  if (heard === expected) return true;
  if (expected.length >= 5 && heard.length >= 4) return editDistanceAtMostOne(heard, expected);
  // "colour" vs "color", "grey" vs "gray" style spellings
  return heard.replace(/u/g, '') === expected.replace(/u/g, '') && expected.length >= 4;
}

// ---------------------------------------------------------------------------------------------
// Resync. A reader who drops a clause, skips a line or goes back a sentence leaves the lookahead
// window behind, and without help every word after that turns red. So when several words in a
// row don't line up, Glide looks for those words elsewhere in the passage and picks up there:
//   - Trigger: RESYNC_AFTER unconfirmed words (2 if they are the passage's last words).
//     Hesitations and habit words never count (principle 7). "Unconfirmed" = since the last two
//     words that matched one after the other, so a stray "the" that lands nearby can't hide being
//     lost. A pair right after unconfirmed words is checked against the rest of the passage first.
//   - Anchor: the earliest run of heard words that matches the passage in order, with at least one
//     word that isn't a stopword. Two words are enough if that pair appears once in the whole
//     passage and sits before the pointer or within the current sentence and the next two. Further
//     ahead, or if the pair appears more than once, it needs three or more words until one copy is
//     left; identical copies of MAX_ANCHOR words go to the nearest one ahead.
//   - Ahead: the gap is marked skipped (red, so the reader can tap it: principle 2) and reading
//     carries on from the anchor. Words before the anchor that matched by chance are undone.
//   - Behind: a re-read. The pointer stays put; re-read words ink any red word they cover
//     (backfill) and the pointer moves on once the re-read reaches it.
// Separately, a jump onto a stopword ("the", "and") only counts once the next word carries on from
// it, so a stray "the" never paints the words before it red.
// Everything is recomputed from the full transcript on every call: pure, so a revised interim
// result simply re-aligns.

/** Function words and very common verbs: never enough on their own to anchor a resync. */
const STOPWORDS = new Set(
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

/** Unconfirmed words in a row before Glide looks elsewhere in the passage (2 if they end it). */
const RESYNC_AFTER = 3;
/** Two-word anchors reach the end of the current sentence plus this many more. */
const NEAR_SENTENCES = 2;
/** A jump past the current sentence and this many more is far: it must be confirmed by reading on. */
const FAR_AFTER_SENTENCES = 1;
/** A stopword jump counts if the next word is this close after it (one more word may be skipped).
 *  A far jump needs this many words read on past its anchor. */
const CARRY_ON = 2;
/** Identical copies this long are a tie, broken toward the nearest one ahead (unless one is behind). */
const MAX_ANCHOR = 6;
/** The recogniser still rewrites its last few words. A jump ahead waits until the words it rests
 *  on are at least this many words from the end of the transcript, so one revision can't undo it. */
const SETTLE = 2;
/** A jump landing this close to the end (in the last sentence) would finish the read: see findAnchor. */
const ENDGAME = 8;
/** Anchor starts tried per word: the latest words of a long stuck run (bounds the search). */
const MAX_STARTS = 24;

type Matches = { at: number[]; bits: Uint8Array };
type PassageIndex = {
  sentEnd: Int32Array;
  stop: Uint8Array;
  finalStart: number; // first word of the last sentence
  penultStart: number; // first word of the sentence before it
  matches: Map<string, Matches>;
};
const INDEX = new WeakMap<PassageWord[], PassageIndex>();

function indexFor(p: PassageWord[]): PassageIndex {
  let idx = INDEX.get(p);
  if (!idx) {
    const n = p.length;
    const sentEnd = new Int32Array(n);
    let end = n - 1;
    for (let i = n - 1; i >= 0; i--) {
      if (p[i].sentenceEnd) end = i;
      sentEnd[i] = end;
    }
    const stop = new Uint8Array(n);
    p.forEach((w, i) => {
      if (STOPWORDS.has(w.key)) stop[i] = 1;
    });
    const startOf = (i: number) => {
      while (i > 0 && !p[i - 1].sentenceEnd) i--;
      return i;
    };
    const finalStart = startOf(n - 1);
    const penultStart = finalStart > 0 ? startOf(finalStart - 1) : 0;
    idx = { sentEnd, stop, finalStart, penultStart, matches: new Map() };
    INDEX.set(p, idx);
  }
  return idx;
}

/** Every passage index a heard word matches, as a list and a lookup. Depends only on (passage, word). */
function matchesOf(p: PassageWord[], idx: PassageIndex, w: string): Matches {
  let m = idx.matches.get(w);
  if (!m) {
    const at: number[] = [];
    const bits = new Uint8Array(p.length + 1);
    for (let k = 0; k < p.length; k++) {
      if (wordsMatch(w, p[k].key)) {
        at.push(k);
        bits[k] = 1;
      }
    }
    m = { at, bits };
    if (idx.matches.size > 4000) idx.matches.clear();
    idx.matches.set(w, m);
  }
  return m;
}

/** Exclusive end of the pointer's sentence plus `more` sentences after it. */
function sentencesFrom(idx: PassageIndex, ptr: number, n: number, more: number): number {
  if (ptr >= n) return n;
  let e = idx.sentEnd[ptr];
  for (let s = 0; s < more && e + 1 < n; s++) e = idx.sentEnd[e + 1];
  return e + 1;
}

/** Does the next real word after heard[i] carry on from passage word m (within CARRY_ON words)? */
function carriesOn(passage: PassageWord[], heard: string[], i: number, m: number): boolean {
  const w = heard[i];
  for (let j = i + 1; j < heard.length; j++) {
    const x = heard[j];
    if (x === w || HESITATIONS.has(x) || HABIT_WORDS.has(x)) continue;
    if (j + 1 < heard.length && HABIT_PHRASES.has(`${x} ${heard[j + 1]}`)) {
      j++;
      continue;
    }
    for (let k = m + 1; k < Math.min(m + 1 + CARRY_ON, passage.length); k++) if (wordsMatch(x, passage[k].key)) return true;
    return false;
  }
  return false; // nothing after it yet: wait for the next result
}

// What each heard word turned out to be.
const FWD = 1; // a passage word at or ahead of the pointer
const BACK = 2; // a passage word behind the pointer, while re-reading
const HES = 3;
const HABIT = 4;
const PHRASE = 5; // first word of a habit phrase ("you know")
const PHRASE2 = 6; // its second word
const REPEAT = 7; // "the the"
const OFF = 8; // off-script

type Anchor = { h: number; k: number; back: boolean };

/**
 * What the anchor search remembers about each start in the current run (indexed by position in
 * the run), so each new word only extends the starts still in play. A start's result depends only
 * on its own words and the ones after it, so a dead start stays dead and a waiting one picks up
 * where it stopped.
 */
type Starts = { dead: Uint8Array; cands: (number[] | undefined)[]; len: Int32Array };

function findAnchor(
  p: PassageWord[],
  idx: PassageIndex,
  heard: string[],
  kind: Uint8Array,
  at: Int32Array,
  run: number[],
  runStart: number,
  ptr: number,
  lastAnchor: number,
  st: Starts,
  settled: number, // heard words from here on may still be rewritten by the recogniser
): Anchor | 'wait' | null {
  const n = p.length;
  const near = sentencesFrom(idx, ptr, n, NEAR_SENTENCES);
  const far = sentencesFrom(idx, ptr, n, FAR_AFTER_SENTENCES);
  const hasContent = (k: number, len: number) => {
    for (let j = k; j < k + len; j++) if (!idx.stop[j]) return true;
    return false;
  };
  // Short of RESYNC_AFTER words, only the last words of the passage are enough (nothing can follow).
  const early = run.length < RESYNC_AFTER;
  const enough = (k: number, len: number) => hasContent(k, len) && (len >= 3 || k < near) && (!early || k + len === n);
  const bitsAt = (j: number) => matchesOf(p, idx, heard[run[j]]).bits;

  const last = run.length - 1;
  let wait = false; // something may still anchor once more words arrive
  for (let s = Math.max(0, last - MAX_STARTS); s < last; s++) {
    if (st.dead[s]) continue;
    let cands = st.cands[s];
    let len = st.len[s];
    if (!cands) {
      const second = bitsAt(s + 1);
      cands = matchesOf(p, idx, heard[run[s]]).at.filter((k) => second[k + 1] === 1);
      len = 2;
    }
    let waiting = false;
    let pick = -1;
    while (cands.length) {
      if (cands.length === 1 && enough(cands[0], len)) {
        pick = cands[0];
        break;
      }
      if (len >= MAX_ANCHOR) {
        const ok = cands.filter((k) => enough(k, len));
        const ahead = ok.find((k) => k >= ptr);
        // A copy behind the pointer and one ahead ("let me start again" on a passage that ends
        // with its opening line): keep listening until they differ. Starting again is far likelier
        // than a leap, and holding marks nothing either way.
        if (ahead === undefined || ok[0] >= ptr) {
          pick = ahead ?? (ok.length ? ok[ok.length - 1] : -1);
          break;
        }
      }
      if (s + len > last) {
        waiting = true; // not enough words yet to tell the copies apart
        break;
      }
      const b = bitsAt(s + len);
      const L = len;
      cands = cands.filter((k) => b[k + L] === 1);
      len++;
    }
    st.cands[s] = cands;
    st.len[s] = len;
    if (waiting) {
      wait = true;
      continue;
    }
    if (pick < 0 || at[run[s]] === pick) {
      st.dead[s] = 1; // nothing found, or it agrees with what we have
      continue;
    }

    // Walk back over earlier words of the run that also line up (habit words included: "so our
    // plan" anchored on "our plan" still inks a passage "So"), so none of them is left red.
    let h = run[s];
    let k = pick;
    const back = pick < ptr;
    const floor = back ? 0 : ptr;
    for (let x = h - 1; x >= runStart && k - 1 >= floor; x--) {
      if (kind[x] === HES) continue;
      if (kind[x] === PHRASE || kind[x] === PHRASE2 || !wordsMatch(heard[x], p[k - 1].key)) break;
      h = x;
      k--;
    }
    if (h <= lastAnchor) {
      st.dead[s] = 1;
      continue;
    }
    if (!back) {
      // How far the reader has carried on, in order, from the anchor.
      let ext = len;
      while (s + ext <= last && pick + ext < n && bitsAt(s + ext)[pick + ext] === 1) ext++;
      const toEnd = pick + ext >= n; // nothing can follow, so there is nothing to wait for
      // The end of the passage: a jump there finishes the session at once, so only one that's
      // plainly honest. Either the reader was already in the last sentence, or they were in the
      // sentence before and picked up at the start of the last one. Otherwise ("sorry, let me start
      // again: thank you all…" when the passage ends with its opening line), hold.
      if (k >= Math.max(idx.finalStart, n - ENDGAME) && ptr <= idx.finalStart && !(k === idx.finalStart && ptr >= idx.penultStart)) {
        st.dead[s] = 1;
        continue;
      }
      // Far ahead (past the next sentence) the anchor may be an aside quoting a later line, so it
      // needs CARRY_ON more words read on past it.
      const need = k >= far ? len + CARRY_ON : len;
      if (ext < need && !toEnd) {
        if (s + ext > last) wait = true;
        else st.dead[s] = 1; // the reader went somewhere else
        continue;
      }
      if (!toEnd && run[s + need - 1] >= settled) {
        wait = true;
        continue;
      }
    }
    return { h, k, back };
  }
  return wait ? 'wait' : null;
}

/**
 * Lines up what the recogniser heard with the passage. Re-runs from scratch on every recogniser
 * update and is pure, so it self-corrects when the recogniser revises a word it already sent.
 */
export function align(passage: PassageWord[], heard: string[], settled = heard.length - SETTLE): Alignment {
  const n = passage.length;
  const H = heard.length;
  const idx = n ? indexFor(passage) : undefined;
  const kind = new Uint8Array(H);
  const at = new Int32Array(H).fill(-1);
  const held = new Int32Array(H).fill(-1); // a stopword jump waiting to see if reading carries on from it

  let next = 0;
  let bp = -1; // re-reading behind the pointer: the next passage word expected there
  let prev = -1; // passage word the last counted heard word matched, -1 if it didn't
  let prevJumped = false; // and whether it got there by skipping words
  // The run: counted words since the last two that matched one after the other, and the state
  // to rewind to if a resync reinterprets them.
  let runStart = 0;
  const run: number[] = [];
  const st: Starts = { dead: new Uint8Array(H), cands: [], len: new Int32Array(H) };
  const addToRun = (i: number) => {
    st.dead[run.length] = 0;
    st.cands[run.length] = undefined;
    run.push(i);
  };
  let snapNext = 0;
  let snapBp = -1;
  let snapPrev = -1;
  let snapJumped = false;
  let habitGap = false; // a habit word since the last match: "in, like, to" isn't two words in a row
  let blockedUntil = 0; // words before a resync anchor are off-script
  let pending: Anchor | null = null;
  let lastAnchor = -1;
  let budget = 8 * H + 64; // rewinds are bounded, whatever the transcript

  for (let i = 0; i < H; i++) {
    if (pending && i === pending.h) {
      if (pending.back) bp = pending.k;
      else {
        next = pending.k;
        bp = -1;
      }
      prev = -1;
      prevJumped = false;
      habitGap = false;
      runStart = i;
      run.length = 0;
      snapNext = next;
      snapBp = bp;
      snapPrev = prev;
      snapJumped = false;
      pending = null;
    }
    const w = heard[i];
    at[i] = -1;
    held[i] = -1;
    let confirm = false;

    let match = -1;
    let back = false;
    if (i >= blockedUntil) {
      if (bp >= 0) {
        for (let k = bp; k < Math.min(bp + LOOKAHEAD, next); k++) {
          if (wordsMatch(w, passage[k].key)) {
            match = k;
            back = true;
            break;
          }
        }
      }
      if (match < 0) {
        for (let k = next; k < Math.min(next + LOOKAHEAD, n); k++) {
          if (wordsMatch(w, passage[k].key)) {
            match = k;
            break;
          }
        }
        // Unsure matches wait until the next word carries on from them: a stopword reached by a
        // jump or straight after an off-script word, and any jump straight after an off-script word
        // (a re-read "so our plan" must not leap to a later "the plan"). Nothing follows the last
        // word, so a jump onto it may skip one.
        if (match >= 0) {
          const afterOff = prev < 0 && run.length > 0;
          const jump = match > next;
          const unsure = idx!.stop[match] ? jump || afterOff : jump && afterOff;
          if (unsure && (match < n - 1 ? !carriesOn(passage, heard, i, match) : match - next > 1)) {
            held[i] = match;
            match = -1;
          }
        }
      }
    }

    if (match >= 0) {
      // The word just before was said right before where reading lands, not where it first
      // matched by chance: "… | the power out" (a held "the"), "… | room nobody" (not the "room" in
      // "room by room"). Two words in a row beat one word on its own.
      const last = run.length ? run[run.length - 1] : -1;
      if (
        !back &&
        last >= 0 &&
        (kind[last] === OFF ? match > next : kind[last] === FWD && at[last] < match - 1) &&
        wordsMatch(heard[last], passage[match - 1].key)
      ) {
        at[last] = match - 1;
        kind[last] = FWD;
        prev = match - 1;
        prevJumped = match - 1 > next;
      }
      // Held stopwords before a landing in the same stretch were said where they first matched
      // ("current job I made the weekly": "I" is inked even though "made" replaced "built").
      if (!back) {
        let cur = prev === match - 1 ? match - 1 : match;
        for (let r = run.length - (prev === match - 1 ? 2 : 1); r >= 0 && kind[run[r]] === OFF; r--) {
          const x = run[r];
          if (held[x] >= next && held[x] < cur) {
            at[x] = held[x];
            kind[x] = FWD;
            cur = held[x];
          }
        }
      }
      at[i] = match;
      const jumped = back ? match > bp : match > next;
      if (back) {
        kind[i] = BACK;
        bp = match + 1 >= next ? -1 : match + 1;
      } else {
        kind[i] = FWD;
        next = match + 1;
        bp = -1;
      }
      // Two words in a row, the first not reached by a jump, confirm that Glide is on track: nothing
      // before them needs rethinking. Not enough: two stopwords after an off-script word, a jump
      // plus one word, or a habit word between them. Each can be a repeated pair inside the window
      // ("team | I am blocked" landing on an earlier "I am working", "taken | over the").
      const opening = match === 0 && !run.length && snapNext === 0; // the first word, nothing before it
      confirm =
        opening ||
        (prev >= 0 && match === prev + 1 && !prevJumped && !habitGap && (!run.length || !(idx!.stop[prev] && idx!.stop[match])));
      habitGap = false;
      prev = match;
      prevJumped = jumped;
      if (confirm && !run.length) {
        runStart = i + 1;
        run.length = 0;
        snapNext = next;
        snapBp = bp;
        snapPrev = match;
        snapJumped = jumped;
        continue;
      }
      // After unconfirmed words, check first that they and this pair don't fit better elsewhere
      // ("and | the project budget" after a skip, not the "the project" inside the window).
      addToRun(i);
    } else {
      const pair = i + 1 < H && !(pending && pending.h === i + 1) ? `${w} ${heard[i + 1]}` : '';
      if (pair && HABIT_PHRASES.has(pair)) {
        kind[i] = PHRASE;
        kind[i + 1] = PHRASE2;
        at[i + 1] = -1;
        habitGap = true;
        i++;
        continue;
      }
      if (HESITATIONS.has(w)) {
        kind[i] = HES;
        continue;
      }
      if (HABIT_WORDS.has(w)) {
        kind[i] = HABIT;
        habitGap = true;
        continue;
      }
      // Repeating a word just read ("the the", "back back") is a stumble, not progress. It never
      // counts toward a resync or starts an anchor: a stutter is the reader on track.
      if (next > 0 && w === passage[next - 1].key) {
        kind[i] = REPEAT;
        continue;
      } else {
        kind[i] = OFF;
        if (i < blockedUntil) continue;
        addToRun(i);
        prev = -1;
      }
    }

    const found =
      n > 0 && run.length >= 2 && budget > 0
        ? findAnchor(passage, idx!, heard, kind, at, run, runStart, snapNext, lastAnchor, st, settled)
        : null;
    const anchor = found === 'wait' ? null : found;
    if (!anchor || (confirm && (kind[anchor.h] === FWD || kind[anchor.h] === BACK))) {
      // Confirm the pair, unless the words before it might still fit better elsewhere.
      if (confirm && found !== 'wait') {
        runStart = i + 1;
        run.length = 0;
        snapNext = next;
        snapBp = bp;
        snapPrev = prev;
        snapJumped = prevJumped;
      }
      continue;
    }
    // Rewind to the start of the run and read it again: off-script up to the anchor, then on.
    budget -= i - runStart + 1;
    lastAnchor = anchor.h;
    pending = anchor;
    // Ahead: words before the anchor matched by chance, so they are undone. Behind (a re-read):
    // they stand, so the pointer never moves back.
    blockedUntil = anchor.back ? runStart : anchor.h;
    next = snapNext;
    bp = snapBp;
    prev = snapPrev;
    prevJumped = snapJumped;
    run.length = 0;
    i = runStart - 1;
  }

  const fillers: Record<string, number> = {};
  const hesitations: Record<string, number> = {};
  const habits: Record<string, number> = {};
  let fillerCount = 0;
  let habitCount = 0;
  let spoken = 0;
  const hit = new Uint8Array(n);
  let lastOn = -1; // the last heard word that matched the passage
  for (let i = 0; i < H; i++) {
    const w = heard[i];
    if (kind[i] === FWD || kind[i] === BACK) lastOn = i;
    switch (kind[i]) {
      case FWD:
      case BACK:
        hit[at[i]] = 1;
        spoken++;
        break;
      case OFF:
        spoken++;
        break;
      case HES:
        fillers[w] = (fillers[w] ?? 0) + 1;
        hesitations[w] = (hesitations[w] ?? 0) + 1;
        fillerCount++;
        break;
      case HABIT:
      case PHRASE: {
        const f = kind[i] === PHRASE ? `${w} ${heard[i + 1]}` : w;
        habits[f] = (habits[f] ?? 0) + 1;
        habitCount++;
        spoken += kind[i] === PHRASE ? 2 : 1; // said on purpose, so it counts toward pace
        break;
      }
    }
  }
  let read = 0;
  let skipped = 0;
  const status: WordStatus[] = new Array(n);
  for (let k = 0; k < n; k++) {
    if (k >= next) status[k] = 'pending';
    else if (hit[k]) {
      status[k] = 'read';
      read++;
    } else {
      status[k] = 'skipped';
      skipped++;
    }
  }

  const out: Alignment = {
    status,
    next,
    read,
    skipped,
    fillers,
    fillerCount,
    hesitations,
    hesitationCount: fillerCount,
    habits,
    habitCount,
    spoken,
    done: n > 0 && next >= n,
  };
  // Re-reading behind the pointer and not yet back at it (the word before the pointer means it is).
  if (lastOn >= 0 && kind[lastOn] === BACK && at[lastOn] < next - 1) out.rereadingAt = at[lastOn];
  return out;
}

/**
 * Free talk has no script. Same rule as reading: only hesitations (um, uh) count as fillers;
 * habit words like "like" and "so" are reported but not scored, and still count toward pace.
 */
export function countFreeTalk(heard: string[]) {
  const a = align([], heard);
  return {
    fillers: a.hesitations,
    fillerCount: a.hesitationCount,
    habits: a.habits,
    habitCount: a.habitCount,
    spoken: a.spoken,
  };
}

/** The sentence a passage word sits in, for practising a stumbled word in context. */
export function sentenceAround(passage: PassageWord[], index: number): string {
  let start = index;
  while (start > 0 && !passage[start - 1].sentenceEnd) start--;
  let end = index;
  while (end < passage.length - 1 && !passage[end].sentenceEnd) end++;
  return passage
    .slice(start, end + 1)
    .map((w) => w.display)
    .join(' ');
}

/** Every skipped word, cleaned, in order (duplicates kept). Used to undo recogniser mistakes. */
export function skippedWords(passage: PassageWord[], a: Alignment): string[] {
  return a.status.flatMap((s, i) => (s === 'skipped' ? [passage[i].display.replace(/[^A-Za-z'’-]/g, '')] : []));
}

/** Re-applies "I said it" corrections: those skipped indices count as read. */
export function withCorrections(a: Alignment, corrected: Set<number>): Alignment {
  if (!corrected.size) return a;
  let fixed = 0;
  const status = a.status.map((s, i) => {
    if (s === 'skipped' && corrected.has(i)) {
      fixed++;
      return 'read' as const;
    }
    return s;
  });
  return { ...a, status, read: a.read + fixed, skipped: a.skipped - fixed };
}

/** Each stumbled word with the sentence it came from, so Fix-it can practise it in context. */
export function stumbledContexts(passage: PassageWord[], a: Alignment, words: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  a.status.forEach((s, i) => {
    if (s !== 'skipped') return;
    const clean = passage[i].display.replace(/[^A-Za-z'’-]/g, '');
    if (words.includes(clean) && !out[clean]) out[clean] = sentenceAround(passage, i);
  });
  return out;
}

/** Words the user skipped or repeated, in passage order, for the Fix-it drill. */
export function stumbledWords(passage: PassageWord[], a: Alignment, limit = 3): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  a.status.forEach((s, i) => {
    if (s !== 'skipped') return;
    const clean = passage[i].display.replace(/[^A-Za-z'’-]/g, '');
    if (clean.length < 3 || seen.has(clean.toLowerCase())) return;
    seen.add(clean.toLowerCase());
    out.push(clean);
  });
  // Longest first: those are usually the real trip words.
  return out.sort((x, y) => y.length - x.length).slice(0, limit);
}

/** Long words in the passage, handed to the recogniser as hints so it expects them. */
export function contextualHints(passage: PassageWord[], max = 50): string[] {
  const words = new Set<string>();
  for (const w of passage) {
    const clean = w.display.replace(/[^A-Za-z'’-]/g, '');
    if (clean.length >= 7) words.add(clean);
    if (words.size >= max) break;
  }
  return [...words];
}
