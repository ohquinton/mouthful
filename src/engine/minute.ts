// One Minute: one word, sixty seconds, a Flow rating (docs/briefs/one-minute.md, Revision 2).
//
// Flow is whether you kept talking. It isn't a grade of your accent or your English. It is made of
// slots, each either scored or shown. Which slots are scored is decided by one constant
// (FLOW_SCORED), changed only at merge time with the evidence the brief asks for, never at runtime.
// Weights renormalise over the scored slots, so a shown slot can never move Flow.
//
// Times. Everything here works from `heardTimes`: for each recognised token, the time (ms, any
// clock) at which a recogniser result first contained a word at that position. That is the same
// moment useListener stamps `lastHeardAt`, so it is a *result* time, not an audio time. Use
// stampHeard() on every transcript change to build it. Consequences, by design:
//   - Bursty arrival (server recognition sends several words in one result) gives several tokens one
//     stamp. Gaps inside a burst are 0; the gap before a burst is one gap, counted once.
//   - Recogniser latency is inside the gaps. Long pauses are only > 2.5 s, which latency alone rarely
//     reaches, but server bursts can still invent one. Check against recordings in the beta.
//   - Thinking time before the first word is never a pause, and `talkSeconds` runs from the start of
//     listening, so a slow starter who then talks to the end of the minute loses nothing.
//   - Time away (a call, Siri) must not be in the stamps: shift `startedAt` and later stamps by the
//     time away, as talk.tsx already does for its clock.
//
// Pure. No React, no Date.now(): the same input always gives the same output.

import { countFreeTalk } from './align';
import { classifyHabits, type HabitResult, type HabitWord } from './habits';
import { paceScore, wordsPerMinute } from './score';

// ---------------------------------------------------------------------------------------------
// Parameters (change only with evidence; see the brief's gates)

/** A gap strictly longer than this between heard words (after the first) is a long pause. */
export const LONG_PAUSE_MS = 2500;
/** The minute. Kept going is measured out of this, and capped at it. */
export const MINUTE_SECONDS = 60;
/** Fewer spoken words (hesitations not counted) than this: no Flow, the Try again card. */
export const MIN_MINUTE_WORDS = 15;
/** Per-minute rates are taken over at least this long, so a 10 s attempt can't show 18 um/min. */
export const MIN_RATE_SECONDS = 30;
/** Each long pause costs this much of the pause slot (4+ empties it). */
const PAUSE_COST = 25;
/** Each filler per minute costs this much of a filler slot, once scored (same as fluencyScore). Unvalidated. */
const FILLER_COST = 15;
/** Coaching: stopping before this is the top issue. */
const STOPPED_BEFORE_S = 45;
/** Coaching: 3+ long pauses. */
const MANY_PAUSES = 3;
/** Coaching: above this wpm, breathe. */
const TOO_FAST_WPM = 185;
/** Coaching (only when the habit slot is scored): this many fillers a minute. */
const MANY_HABIT_FILLERS = 3;
/** Trend: changes this small (or smaller) against the median are "about the same". */
const TREND_SAME = 5;

// ---------------------------------------------------------------------------------------------
// Slots

export type FlowSlot = 'keptGoing' | 'pauses' | 'pace' | 'um' | 'habit';

/** Weight of each slot when scored (Revision 2 table). Renormalised over the scored ones. */
export const FLOW_WEIGHTS: Readonly<Record<FlowSlot, number>> = { keptGoing: 40, pauses: 35, pace: 25, um: 15, habit: 15 };

/**
 * THE switch. Slots in this list are scored; the rest are shown next to Flow and never move it.
 * Promote 'habit' only at ≥ ~90% corpus precision, the Phase 1 tally agreeing and an overrule rate
 * below ~1 in 10 for accented testers. Promote 'um' only if the tally shows ≥ ~70% caught.
 * Changing this changes FLOW_VERSION, so trends never compare across the change.
 */
export const FLOW_SCORED: readonly FlowSlot[] = ['keptGoing', 'pauses', 'pace'];

export type FlowSlots = Readonly<Record<FlowSlot, { weight: number; scored: boolean }>>;

const SLOT_ORDER: readonly FlowSlot[] = ['keptGoing', 'pauses', 'pace', 'um', 'habit'];
const SLOT_CODE: Record<FlowSlot, string> = { keptGoing: 'k', pauses: 'p', pace: 'w', um: 'u', habit: 'h' };
/** Bump when a slot's own formula changes (not its weight or scored state, which the version already encodes). */
const FLOW_FORMULA = 1;

/** A slot config with `scored` slots scored at `weights` and the rest shown. Tests use it to promote a slot. */
export function flowSlotsFrom(scored: readonly FlowSlot[], weights: Readonly<Record<FlowSlot, number>> = FLOW_WEIGHTS): FlowSlots {
  const out = {} as Record<FlowSlot, { weight: number; scored: boolean }>;
  for (const s of SLOT_ORDER) out[s] = { weight: weights[s], scored: scored.includes(s) };
  return out;
}

export const FLOW_SLOTS: FlowSlots = flowSlotsFrom(FLOW_SCORED);

/** A short, analytics-safe code for a slot config: "1-k40p35w25" = formula 1, those slots at those weights. */
export function flowVersionOf(slots: FlowSlots): string {
  let code = '';
  for (const s of SLOT_ORDER) if (slots[s].scored) code += SLOT_CODE[s] + Math.round(slots[s].weight);
  return `${FLOW_FORMULA}-${code}`;
}

/** Saved with every minute. Trends only compare sessions with the same version. */
export const FLOW_VERSION = flowVersionOf(FLOW_SLOTS);

// ---------------------------------------------------------------------------------------------
// Times

/**
 * Keeps `heardTimes` in step with the transcript. Call on every transcript change with the token
 * count and the result time. New positions get `now`; positions already stamped keep their first
 * stamp, even if an interim revision briefly drops them (the word was heard then). Returns the same
 * array when nothing new was heard. Reset to [] on Try again.
 */
export function stampHeard(prev: readonly number[], tokenCount: number, now: number): number[] {
  if (tokenCount <= prev.length) return prev as number[];
  const out = prev.slice();
  while (out.length < tokenCount) out.push(now);
  return out;
}

/**
 * Long pauses: gaps strictly over `thresholdMs` between heard words, after the first word.
 * Stamps that go backwards are treated as "same time as the one before", so noise can't make a
 * negative gap or split one silence into two. `longestSeconds` is the longest gap after the first
 * word (long or not), to one decimal.
 */
export function longPauses(heardTimes: readonly number[], opts: { thresholdMs?: number } = {}): { count: number; longestSeconds: number } {
  const threshold = opts.thresholdMs ?? LONG_PAUSE_MS;
  let count = 0;
  let longest = 0;
  let last = heardTimes.length ? heardTimes[0] : 0;
  for (let k = 1; k < heardTimes.length; k++) {
    const t = heardTimes[k];
    if (t <= last) continue;
    const gap = t - last;
    if (gap > threshold) count++;
    if (gap > longest) longest = gap;
    last = t;
  }
  return { count, longestSeconds: Math.round(longest / 100) / 10 };
}

// ---------------------------------------------------------------------------------------------
// Flow

export type FlowInput = {
  /** Seconds from the start of listening to the last heard word. */
  keptGoingSeconds: number;
  longPauses: number;
  wpm: number;
  umPerMin: number;
  /** Habit words labelled 'filler' by classifyHabits, after overrules, per minute. */
  habitFillersPerMin: number;
};

export type FlowPart = {
  slot: FlowSlot;
  scored: boolean;
  /** 0–100 for this slot alone. */
  score: number;
  /** Share of Flow after renormalising: 0 for a shown slot; the scored ones sum to 1. */
  weight: number;
};

function slotScore(slot: FlowSlot, i: FlowInput): number {
  switch (slot) {
    case 'keptGoing':
      return 100 * Math.min(1, Math.max(0, i.keptGoingSeconds) / MINUTE_SECONDS);
    case 'pauses':
      return Math.max(0, 100 - PAUSE_COST * Math.max(0, i.longPauses));
    case 'pace':
      return paceScore(i.wpm, 'talking');
    case 'um':
      return Math.max(0, 100 - FILLER_COST * Math.max(0, i.umPerMin));
    case 'habit':
      return Math.max(0, 100 - FILLER_COST * Math.max(0, i.habitFillersPerMin));
  }
}

/** Every slot's own score and its share of Flow, so the Tape can explain the number. */
export function flowParts(input: FlowInput, slots: FlowSlots = FLOW_SLOTS): FlowPart[] {
  let total = 0;
  for (const s of SLOT_ORDER) if (slots[s].scored) total += slots[s].weight;
  return SLOT_ORDER.map((slot) => ({
    slot,
    scored: slots[slot].scored,
    score: slotScore(slot, input),
    weight: slots[slot].scored && total > 0 ? slots[slot].weight / total : 0,
  }));
}

/** Flow, 0–100: the weighted mean of the scored slots only. */
export function flowScore(input: FlowInput, slots: FlowSlots = FLOW_SLOTS): number {
  let sum = 0;
  for (const p of flowParts(input, slots)) sum += p.score * p.weight;
  return Math.max(0, Math.min(100, Math.round(sum)));
}

// ---------------------------------------------------------------------------------------------
// Coaching

export type MinuteLineStats = {
  talkSeconds: number;
  longPauses: number;
  wpm: number;
  habitFillersPerMin: number;
  /** The most frequent habit filler, for the (scored-only) habit line. */
  topHabit?: string;
};

/** One coaching line about the single biggest issue, in the brief's order. */
export function minuteLine(s: MinuteLineStats, slots: FlowSlots = FLOW_SLOTS): string {
  const secs = Math.floor(Math.max(0, s.talkSeconds));
  if (secs < STOPPED_BEFORE_S) return `You stopped at ${secs} s. When you run out, say what you'd add with more time.`;
  if (s.longPauses >= MANY_PAUSES) return 'When you lose the thread, say the word again and one thing it reminds you of.';
  if (s.wpm > TOO_FAST_WPM) return 'Breathe between ideas.';
  if (slots.habit.scored && s.habitFillersPerMin >= MANY_HABIT_FILLERS)
    return `Lots of "${s.topHabit ?? 'like'}". Try a short silence instead.`;
  return 'You kept going the whole minute.';
}

// ---------------------------------------------------------------------------------------------
// Trend

export type MinuteTrend = {
  /** Median Flow of the last (up to) 5 past sessions of this version. */
  median: number;
  /** How many sessions the median is over (3–5). */
  count: number;
  /** current − median, when `current` is given. */
  delta?: number;
  direction?: 'up' | 'down' | 'same';
};

/**
 * Against your own recent minutes only. `past` is oldest first and excludes the session being shown.
 * Null with fewer than 3 past sessions that have a Flow and the same `flowVersion`.
 */
export function minuteTrend(
  past: readonly { flow?: number | null; flowVersion?: string }[],
  flowVersion: string,
  current?: number,
): MinuteTrend | null {
  const flows: number[] = [];
  for (const p of past) if (p.flowVersion === flowVersion && typeof p.flow === 'number' && Number.isFinite(p.flow)) flows.push(p.flow);
  if (flows.length < 3) return null;
  const last = flows.slice(-5).sort((a, b) => a - b);
  const mid = last.length >> 1;
  const median = last.length % 2 ? last[mid] : (last[mid - 1] + last[mid]) / 2;
  const t: MinuteTrend = { median, count: last.length };
  if (current !== undefined) {
    t.delta = Math.round((current - median) * 10) / 10;
    t.direction = Math.abs(t.delta) <= TREND_SAME ? 'same' : t.delta > 0 ? 'up' : 'down';
  }
  return t;
}

// ---------------------------------------------------------------------------------------------
// Summary for the app

export type MinuteInput = {
  /** tokenise(final transcript). */
  tokens: readonly string[];
  /** One stamp per token (stampHeard). Extra stamps past the tokens are ignored. */
  heardTimes: readonly number[];
  /** When listening started, on the same clock as heardTimes, with time away already shifted out. */
  startedAt: number;
  /** Token indices (HabitResult.index) the reader marked "I meant that". */
  overruled?: readonly number[];
  slots?: FlowSlots;
};

export type HabitCounts = { filler: number; unsure: number; real: number };

export type MinuteSummary = {
  flow: number;
  flowVersion: string;
  longPauses: number;
  longestPauseSeconds: number;
  /** Seconds from the start to the last heard word, capped at the minute. */
  talkSeconds: number;
  /** Spoken words (not um/uh) from the first heard word to the last. */
  wpm: number;
  words: number;
  umCount: number;
  umPerMin: number;
  habitFillersPerMin: number;
  habits: HabitCounts & {
    /** Fillers the reader overruled (already taken out of `filler` and byWord). */
    overruled: number;
    byWord: Partial<Record<HabitWord, HabitCounts>>;
  };
  /** Every labelled habit word, overruled fillers relabelled 'real', for the Tape's chips. */
  habitResults: HabitResult[];
  /** Flow's slots, for explaining the number. */
  parts: FlowPart[];
  /** What Flow was computed from. */
  input: FlowInput;
  line: string;
};

const round1 = (x: number) => Math.round(x * 10) / 10;

/** Everything the Tape needs for a finished minute. Null under MIN_MINUTE_WORDS spoken words: no Flow. */
export function minuteSummary(m: MinuteInput): MinuteSummary | null {
  const slots = m.slots ?? FLOW_SLOTS;
  const counts = countFreeTalk(m.tokens as string[]);
  if (counts.spoken < MIN_MINUTE_WORDS) return null;

  const times = m.heardTimes.length > m.tokens.length ? m.heardTimes.slice(0, m.tokens.length) : m.heardTimes;
  const first = times.length ? times[0] : m.startedAt;
  let lastT = first;
  for (const t of times) if (t > lastT) lastT = t;
  const talkSeconds = round1(Math.min(MINUTE_SECONDS, Math.max(0, (lastT - m.startedAt) / 1000)));
  const pauses = longPauses(times);
  const wpm = wordsPerMinute(counts.spoken, (lastT - first) / 1000);
  const rateMinutes = Math.max(talkSeconds, MIN_RATE_SECONDS) / 60;

  const overruled = new Set(m.overruled ?? []);
  const habitResults = classifyHabits(m.tokens).map((r) =>
    r.label === 'filler' && overruled.has(r.index) ? { ...r, label: 'real' as const, reason: 'overruled' } : r,
  );
  const habits: MinuteSummary['habits'] = { filler: 0, unsure: 0, real: 0, overruled: 0, byWord: {} };
  let top: HabitWord | undefined;
  for (const r of habitResults) {
    if (r.reason === 'overruled') habits.overruled++;
    habits[r.label]++;
    const b = (habits.byWord[r.word] ??= { filler: 0, unsure: 0, real: 0 });
    b[r.label]++;
    if (r.label === 'filler' && (!top || b.filler > habits.byWord[top]!.filler)) top = r.word;
  }

  const input: FlowInput = {
    keptGoingSeconds: talkSeconds,
    longPauses: pauses.count,
    wpm,
    umPerMin: counts.fillerCount / rateMinutes,
    habitFillersPerMin: habits.filler / rateMinutes,
  };
  return {
    flow: flowScore(input, slots),
    flowVersion: flowVersionOf(slots),
    longPauses: pauses.count,
    longestPauseSeconds: pauses.longestSeconds,
    talkSeconds,
    wpm,
    words: counts.spoken,
    umCount: counts.fillerCount,
    umPerMin: round1(input.umPerMin),
    habitFillersPerMin: round1(input.habitFillersPerMin),
    habits,
    habitResults,
    parts: flowParts(input, slots),
    input,
    line: minuteLine({ talkSeconds, longPauses: pauses.count, wpm, habitFillersPerMin: input.habitFillersPerMin, topHabit: top }, slots),
  };
}
