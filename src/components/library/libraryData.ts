// The Library's numbers and labels, worked out from saved data. Pure TypeScript (no React), so
// test/library.test.ts can check them. The screen is src/app/(tabs)/library.tsx.
//
// The Library is the shelf behind Home (docs/briefs/remodel-screens.md §0.5): every topic, pack,
// passage and script, any time. Home's map is still where today's stop lives.

import { MINUTE_PROMPTS, type Prompt, type PromptLevel } from '../../content/prompts';
import { LINES, type LineId } from '../../content/lines';
import type { WordPack } from '../../content/wordpacks';
import type { Passage } from '../../content/passages';
import { FLOW_VERSION } from '../../engine/minute';
import { isComfortable, type WordBook } from '../../engine/vocab';
import { isShortTalk } from '../../store/minute';
import type { SavedSession } from '../../store/sessions';

// ---------------------------------------------------------------------------------------------
// Topic talks

/** The three levels of topics, in the Library's words (prompts.ts LEVEL_NAME is the talk eyebrow). */
export const TOPIC_LEVELS: readonly { level: PromptLevel; name: string; blurb: string }[] = [
  { level: 1, name: 'Everyday', blurb: 'Things you can see or touch. A good warm-up.' },
  { level: 2, name: 'Ideas', blurb: 'One word, a bigger thought. Say what you think and why.' },
  { level: 3, name: 'Bigger topics', blurb: 'A question to answer in a minute, start to finish.' },
];

export function topicsAt(level: PromptLevel): Prompt[] {
  return MINUTE_PROMPTS.filter((p) => p.level === level);
}

/**
 * Which level the Library opens on: Clear English's stops are everyday things (level 1), Sharp
 * Talk's are ideas and topics, so it starts on Ideas. The reader can switch at once.
 */
export function defaultLevel(line: LineId | undefined): PromptLevel {
  return line === 'clear' ? 1 : 2;
}

export type TopicRecord = { best: number; talks: number };

/**
 * Your best Flow on each topic, by prompt id, with how many full minutes you've talked on it.
 * Same rule as everywhere else Flow is compared: one Flow version only (trends never mix versions)
 * and full minutes only (onboarding's 30-second talk is half the length, so it never counts).
 */
export function topicRecords(sessions: readonly SavedSession[], version: string = FLOW_VERSION): Map<string, TopicRecord> {
  const out = new Map<string, TopicRecord>();
  for (const s of sessions) {
    if (s.kind !== 'minute' || !s.promptId || typeof s.flow !== 'number' || s.flowVersion !== version || isShortTalk(s)) continue;
    const r = out.get(s.promptId);
    if (r) {
      r.best = Math.max(r.best, s.flow);
      r.talks++;
    } else out.set(s.promptId, { best: s.flow, talks: 1 });
  }
  return out;
}

/** "Best 76", or "1 min" for a topic you haven't talked on yet (what it costs, not a gap). */
export function topicMeta(r: TopicRecord | undefined): string {
  return r ? `Best ${r.best}` : '1 min';
}

/** Screen-reader label for a topic: the topic, then the best, then how many talks. */
export function topicLabel(p: Prompt, r: TopicRecord | undefined): string {
  if (!r) return `${p.text} One minute topic talk. Not tried yet.`;
  return `${p.text} One minute topic talk. Your best Flow is ${r.best}, from ${r.talks} ${r.talks === 1 ? 'talk' : 'talks'}.`;
}

/** "3 of 12 tried": how many topics at this level you've talked on. */
export function triedText(level: PromptLevel, records: ReadonlyMap<string, TopicRecord>): string {
  const all = topicsAt(level);
  const tried = all.filter((p) => records.has(p.id)).length;
  return tried === 0 ? `${all.length} topics` : `${tried} of ${all.length} tried`;
}

/** The talk route for a topic from the Library: a full minute, no stop, back to the Tape after. */
export function topicRoute(promptId: string) {
  return { pathname: '/talk' as const, params: { prompt: promptId, seconds: '60' as const, from: 'library' } };
}

// ---------------------------------------------------------------------------------------------
// Word packs

/** Does this line use the pack as a lesson (its drill, or a Glide passage from it)? */
function lineUsesPack(line: LineId, packId: string): boolean {
  return LINES[line].some(
    (s) => !!s.lesson && ((s.lesson.kind === 'pack' && s.lesson.packId === packId) || (s.lesson.kind === 'glide' && s.lesson.passageId.startsWith(`w.${packId}.`))),
  );
}

/**
 * The line a pack's card is tinted with: a line that uses it as a lesson, your own line first when
 * both do. Undefined when no line uses it (the card stays plain).
 */
export function packLine(packId: string, chosen: LineId): LineId | undefined {
  const other: LineId = chosen === 'sharp' ? 'clear' : 'sharp';
  if (lineUsesPack(chosen, packId)) return chosen;
  if (lineUsesPack(other, packId)) return other;
  return undefined;
}

/** How many of a pack's words have reached "comfortable" in the word book. */
export function packDone(pack: Pick<WordPack, 'words'>, book: WordBook): number {
  return pack.words.filter((w) => {
    const e = book[w.word.toLowerCase()];
    return !!e && isComfortable(e);
  }).length;
}

/** "8 words", or "3 of 8 comfortable" once any word is. */
export function packMeta(done: number, total: number): string {
  if (done === 0) return `${total} ${total === 1 ? 'word' : 'words'}`;
  return `${done} of ${total} comfortable`;
}

// ---------------------------------------------------------------------------------------------
// Your words, your scripts

export function wordsMeta(ready: boolean, learning: number, learned: number): string {
  if (!ready) return 'Loading your words…';
  if (learning + learned === 0) return 'Words you practise or trip on collect here.';
  return `${learning} learning · ${learned} comfortable`;
}

/** The first script is free (pro.ts canAddScript); say so before there is one. */
export function scriptsMeta(ready: boolean, count: number, pro: boolean): string {
  if (!ready) return 'Loading your scripts…';
  if (count === 0) return pro ? 'Paste something you’ll say for real.' : 'Paste something you’ll say for real. The first one is free.';
  return `${count} ${count === 1 ? 'script' : 'scripts'}`;
}

// ---------------------------------------------------------------------------------------------
// Read out loud

/**
 * The passage a cold read opens: one you've never read, in the shelf's order, else the one you
 * read longest ago. A cold read is meant to be unseen (pro.ts canColdRead gates it to Pro).
 */
export function coldReadPick(passages: readonly Passage[], sessions: readonly Pick<SavedSession, 'passageId' | 'at'>[]): Passage | undefined {
  const last = new Map<string, number>();
  for (const s of sessions) last.set(s.passageId, Math.max(last.get(s.passageId) ?? 0, s.at));
  const never = passages.find((p) => !last.has(p.id));
  if (never) return never;
  let pick: Passage | undefined;
  for (const p of passages) if (!pick || (last.get(p.id) ?? 0) < (last.get(pick.id) ?? 0)) pick = p;
  return pick;
}
