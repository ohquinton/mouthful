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

/**
 * Re-runs from scratch on every recogniser update. Passages are short, so this is cheap,
 * and it self-corrects when the recogniser revises a word it already sent.
 */
export function align(passage: PassageWord[], heard: string[]): Alignment {
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

  const addHesitation = (f: string) => {
    fillers[f] = (fillers[f] ?? 0) + 1;
    fillerCount++;
    hesitations[f] = (hesitations[f] ?? 0) + 1;
    hesitationCount++;
  };
  const addHabit = (f: string, words: number) => {
    habits[f] = (habits[f] ?? 0) + 1;
    habitCount++;
    spoken += words; // said on purpose, so it counts toward pace
  };

  for (let i = 0; i < heard.length; i++) {
    const w = heard[i];

    let match = -1;
    for (let k = next; k < Math.min(next + LOOKAHEAD, passage.length); k++) {
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
    if (pair && HABIT_PHRASES.has(pair)) {
      addHabit(pair, 2);
      i++;
      continue;
    }
    if (HESITATIONS.has(w)) {
      addHesitation(w);
      continue;
    }
    if (HABIT_WORDS.has(w)) {
      addHabit(w, 1);
      continue;
    }
    // Repeating a word just read ("the the") is a stumble, not progress.
    if (next > 0 && w === passage[next - 1].key) continue;
    spoken++;
  }

  return {
    status,
    next,
    read,
    skipped,
    fillers,
    fillerCount,
    hesitations,
    hesitationCount,
    habits,
    habitCount,
    spoken,
    done: passage.length > 0 && next >= passage.length,
  };
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
