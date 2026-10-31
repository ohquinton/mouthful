// Onboarding rules, kept out of the screens so they can be tested without React Native.
// The screens are src/app/onboarding/index.tsx (hook, moment and date, first read) and day1.tsx
// (starting point). MicGate uses micGateExit() so a "no" during onboarding never traps anyone.

import { daysBetween } from './engine/days';

/**
 * Where MicGate's "Not now" / "Skip for now" goes.
 * - 'back': a normal practice screen. Go back to where they came from.
 * - 'today': still onboarding. Going back would land on the mic step, which leads straight back to
 *   the same gate, and the tabs redirect anyone not onboarded to onboarding: a trap (principle 8).
 *   So the skip finishes onboarding (the plan is already saved on the moment step) and opens Today.
 */
export function micGateExit(onboarded: boolean): 'back' | 'today' {
  return onboarded ? 'back' : 'today';
}

export type OnboardingStep = 'hook' | 'moment' | 'mic';

/** The step a back arrow (or Android back) returns to. null on the first step: leave it to the OS. */
export function previousStep(step: OnboardingStep): OnboardingStep | null {
  if (step === 'mic') return 'moment';
  if (step === 'moment') return 'hook';
  return null;
}

/** "When is it?" chips. `days: null` is "Not sure": the plan has no date. */
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

/**
 * Whether the starting-point screen offers a daily reminder. Not when the moment is today or
 * tomorrow: there's no "daily" left, and asking for notifications then is noise.
 */
export function remindersShown(date: string | undefined, now = new Date()): boolean {
  if (!date) return true;
  return daysUntilDate(date, now) >= 2;
}

/**
 * "Heard clearly: 71 of 78 words". Words the phone heard (taps on "I said it" count, principle 2)
 * out of the words Glide reached. null for a session saved before readCount existed.
 */
export function heardClearly(s: { readCount?: number; skippedWords?: string[] }): { heard: number; of: number } | null {
  if (s.readCount === undefined) return null;
  return { heard: s.readCount, of: s.readCount + (s.skippedWords?.length ?? 0) };
}

/** 34 → "0:34", 75 → "1:15". */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${pad(s % 60)}`;
}

/**
 * The line under the pace on the starting point. A range, never a target (principle 4).
 */
export function paceRangeLine(wpm: number, [lo, hi]: [number, number]): string {
  if (wpm > hi) return `A comfortable range for reading aloud is ${lo}–${hi}. Try a little slower next time.`;
  if (wpm < lo) return `A comfortable range for reading aloud is ${lo}–${hi}. You can build up to it.`;
  return `That’s inside ${lo}–${hi}, a comfortable range for reading aloud.`;
}

/** Today's streak pill waits until there's a streak worth showing: a "1" on day one says nothing. */
export function streakPillShown(days: number): boolean {
  return days >= 2;
}
