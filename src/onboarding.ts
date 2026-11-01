// Onboarding rules, kept out of the screens so they can be tested without React Native.
// The screens are src/app/onboarding/index.tsx (hook, which train, first topic talk, mic denied)
// and day1.tsx (your starting point). Brief: docs/briefs/remodel-screens.md section 1.
// MicGate uses micGateExit() so a "no" during onboarding never traps anyone.

import { daysBetween } from './engine/days';

/**
 * Where MicGate's "Not now" / "Skip for now" goes.
 * - 'back': a normal practice screen. Go back to where they came from.
 * - 'today': still onboarding. Going back would land on the first-talk step, which leads straight
 *   back to the same gate, and the tabs redirect anyone not onboarded to onboarding: a trap
 *   (principle 8). So the skip finishes onboarding (the line is already saved on step 2) and opens Home.
 */
export function micGateExit(onboarded: boolean): 'back' | 'today' {
  return onboarded ? 'back' : 'today';
}

// ---------------------------------------------------------------- steps

/** The steps on onboarding/index.tsx. 'denied' takes the first talk's place when the microphone is refused. */
export type OnboardingStep = 'hook' | 'line' | 'talk' | 'denied';

const STEPS: readonly OnboardingStep[] = ['hook', 'line', 'talk', 'denied'];

/** Four dashes at the top: hook, which train, first talk, starting point (day1.tsx is the 4th). */
export const ONBOARDING_DASHES = 4;

/** Which dash is lit (0-based). Mic denied is still the first-talk step; 'start' is day1.tsx. */
export function dashIndex(step: OnboardingStep | 'start'): number {
  if (step === 'start') return 3;
  if (step === 'denied') return 2;
  return STEPS.indexOf(step);
}

/** The step a back arrow (or Android back) returns to. null on the first step: leave it to the OS. */
export function previousStep(step: OnboardingStep): OnboardingStep | null {
  if (step === 'denied') return 'talk';
  if (step === 'talk') return 'line';
  if (step === 'line') return 'hook';
  return null;
}

/** A `step` route param, parsed: route params are strings from outside, so never trust them. */
export function parseStep(param: unknown): OnboardingStep {
  return typeof param === 'string' && (STEPS as readonly string[]).includes(param) ? (param as OnboardingStep) : 'hook';
}

// ---------------------------------------------------------------- step 2: which train?

export type Line = 'sharp' | 'clear';

/**
 * Sharp Talk is selected for everyone at first (DECISIONS 2026-11-01). Never guessed from the
 * phone's language: sorting people by language would decide for them who needs "Clear English".
 */
export const DEFAULT_LINE: Line = 'sharp';

export type LineCard = { id: Line; name: string; who: string; practise: [string, string, string] };

export const LINE_CARDS: readonly LineCard[] = [
  {
    id: 'sharp',
    name: 'Sharp Talk',
    who: 'For anyone who wants to sound sharp and think on their feet.',
    practise: ['Precise words', 'Fewer fillers and repeats', 'A steady pace'],
  },
  {
    id: 'clear',
    name: 'Clear English',
    who: 'For people who speak English as another language and want to be understood the first time.',
    practise: ['Everyday words, said clearly', 'Say this, not that', 'Talk with more ease'],
  },
];

/** The button follows the selection: "Get on Sharp Talk". */
export function lineButtonLabel(line: Line): string {
  const card = LINE_CARDS.find((c) => c.id === line) ?? LINE_CARDS[0];
  return `Get on ${card.name}`;
}

/** A saved Profile.line (coming back with the back arrow keeps their pick), or the default. */
export function lineOrDefault(saved: unknown): Line {
  return saved === 'sharp' || saved === 'clear' ? saved : DEFAULT_LINE;
}

// ---------------------------------------------------------------- step 3: the first topic talk

/**
 * Coffee (content/prompts.ts p01), the same for everyone on day 1 so first results compare fairly.
 * 30 seconds, not a full minute: an easier first step. Full minutes start on day 2.
 */
export const FIRST_TALK = {
  promptId: 'p01',
  seconds: 30,
  ideas: ['How you take it', 'A café you like', 'Why so many people drink it'],
} as const;

/**
 * The route contract with talk.tsx: it runs a 30-second topic talk on this prompt, and when it's
 * done it replaces itself with /onboarding/day1?id=<sessionId>. Params are strings (expo-router).
 */
export function firstTalkRoute() {
  return {
    pathname: '/talk' as const,
    params: { prompt: FIRST_TALK.promptId, seconds: String(FIRST_TALK.seconds), from: 'onboarding' },
  };
}

/** The one plain privacy line under the ideas. Honest about which phones use a speech service. */
export function privacyLine(onDevice: boolean): string {
  return onDevice
    ? 'It listens only while you talk. Your speech is turned into text on this phone.'
    : 'It listens only while you talk. If this phone can’t turn speech into text by itself, we’ll ask before using a speech service.';
}

// ---------------------------------------------------------------- step 4: your starting point

/** The parts of a saved One Minute session the starting point reads (store/sessions.ts SavedSession). */
export type FirstTalk = {
  kind?: 'minute';
  flow?: number;
  minute?: { talkSeconds: number; longPauses: number; umCount: number };
};

/** Under this many seconds of the 30, the first talk stopped early: no happy eyes, a gentler line. */
export const STOPPED_EARLY_SECONDS = 22;

export type StartingPoint = {
  flow: number;
  rows: { label: string; value: string }[];
  /** True when they talked for most of the 30 seconds: the Drop gets happy eyes. */
  keptGoing: boolean;
  tomorrow: string;
};

/**
 * Everything the starting point shows, or null when the session isn't a finished topic talk with a
 * Flow (missing, too short, or an older kind): the screen then says so and still lets them finish.
 * Plain counts only: no "different words" (variety is too noisy for one talk; DECISIONS 2026-11-01).
 */
export function startingPoint(s: FirstTalk | undefined, of: number = FIRST_TALK.seconds): StartingPoint | null {
  if (!s || s.kind !== 'minute' || typeof s.flow !== 'number' || !s.minute) return null;
  const talked = Math.max(0, Math.min(of, Math.round(s.minute.talkSeconds)));
  const pauses = Math.max(0, s.minute.longPauses);
  const um = Math.max(0, s.minute.umCount);
  const flow = Math.round(s.flow);
  const keptGoing = talked >= STOPPED_EARLY_SECONDS;
  return {
    flow,
    rows: [
      { label: 'Talked for', value: `${talked} of ${of} s` },
      { label: 'Long pauses', value: pauses === 0 ? 'None' : String(pauses) },
      { label: 'um/uh the phone heard', value: String(um) },
    ],
    keptGoing,
    tomorrow: keptGoing
      ? `Tomorrow: a new topic and a full minute. Try to beat ${flow}.`
      : `You stopped at ${talked} s. Tomorrow, try to keep going for the whole minute.`,
  };
}

/** Under the table: on-device recognisers drop many um and uh, so a low count must not read as praise. */
export const UM_NOTE = 'Phones miss some um and uh, so that count runs low.';

// ---------------------------------------------------------------- dates (planning a moment; no longer in onboarding)

/** "When is it?" chips. `days: null` is "Not sure": the plan has no date. Kept for "Plan for it". */
export const WHEN_CHIPS: { label: string; days: number | null }[] = [
  { label: 'Today', days: 0 },
  { label: 'Tomorrow', days: 1 },
  { label: 'In 3 days', days: 3 },
  { label: 'Next week', days: 7 },
  { label: 'In 2 weeks', days: 14 },
  { label: 'Not sure', days: null },
];

const pad = (n: number) => String(n).padStart(2, '0');

/** A local calendar date as "YYYY-MM-DD", the shape Profile.moment.date has always used. */
function iso(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * The moment's date, `days` calendar days from `now`. Built from the local date (not now + n × 24 h),
 * so a week that crosses a clock change still lands on the right day. undefined for "Not sure".
 */
export function momentDate(days: number | null, now = new Date()): string | undefined {
  if (days === null) return undefined;
  return iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + days));
}

/** Whole calendar days from today to a "YYYY-MM-DD" date, on the reader's clock. */
export function daysUntilDate(date: string, now = new Date()): number {
  const [y, m, d] = date.split('-').map(Number);
  return daysBetween(now, new Date(y, m - 1, d));
}

/** 34 → "0:34", 75 → "1:15". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

/** Home's streak pill waits until there's a streak worth showing: a "1" on day one says nothing. */
export function streakPillShown(days: number): boolean {
  return days >= 2;
}
