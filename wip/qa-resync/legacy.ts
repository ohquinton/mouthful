import { wordsMatch, type Alignment, type PassageWord, type WordStatus } from 'C:/Users/ohqui/Downloads/mouthful-app/mouthful-app/src/engine/align';
const L_LOOKAHEAD = 5;
const L_HES = new Set(['um', 'umm', 'uh', 'uhh', 'uhm', 'erm', 'er', 'ah', 'hmm', 'mm']);
const L_HABIT = new Set(['like', 'basically', 'actually', 'literally', 'so', 'right', 'okay', 'anyway']);
const L_PHRASES = new Set(['you know', 'i mean', 'kind of', 'sort of', 'you see']);

export function legacyAlign(passage: PassageWord[], heard: string[]): Alignment {
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

