// Honest billing (docs/MARKET-RESEARCH.md: 621 billing complaints across competitors).
// Plain words for what happens to the reader's money, where to cancel, and a reminder before a
// free trial turns into a charge. Pure functions, so the copy and the date maths are tested.
import type { PlanId, TrialStatus } from './purchases.shared';
import { daysBetween } from './engine/days';

export type StoreOS = 'ios' | 'android' | 'web' | string;

/** Where a subscription is managed and cancelled. Web is our test harness, so it gets the iOS page. */
export function subscriptionsUrl(os: StoreOS): string {
  return os === 'android' ? 'https://play.google.com/store/account/subscriptions' : 'https://apps.apple.com/account/subscriptions';
}

/** How to get to the subscriptions page by hand. iOS 18 renamed "Apple ID", so we name the row. */
export function cancelPath(os: StoreOS): string {
  return os === 'android' ? 'Google Play → Payments & subscriptions → Subscriptions' : 'Settings → your name → Subscriptions';
}

/**
 * The line right under the plan buttons: exactly what happens, in order. The trial wording only
 * when the store has confirmed a trial for this person (trialOffer), and only on the annual plan.
 */
export function billingLine({ plan, price, trialDays, os }: { plan: PlanId; price: string; trialDays?: number; os: StoreOS }): string {
  const where = cancelPath(os);
  if (plan === 'annual' && trialDays) {
    const days = trialDays === 1 ? '1 day' : `${trialDays} days`;
    return `Free for ${days}, then ${price} a year. Cancel any time in ${where} before the trial ends and you won’t be charged.`;
  }
  const per = plan === 'annual' ? `${price} a year, renews yearly until you cancel.` : `${price} a month, renews monthly until you cancel.`;
  return `${per} Cancel any time in ${where}.`;
}

// ---- The trial reminder ----

/** How many calendar days before the trial ends we remind them, and at what local time. */
export const TRIAL_REMIND_DAYS_BEFORE = 2;
export const TRIAL_REMIND_HOUR = 10;

export const TRIAL_REMINDER_TEXT = {
  title: 'Your free trial ends in 2 days',
  body: 'Keep Pro, or cancel in Settings before then and you won’t be charged.',
};

/**
 * When to remind: 10:00 local, two calendar days before the day the trial ends. Built from the
 * local calendar (days.ts), so a clock change in between doesn't move it to 09:00 or the wrong
 * day. null when that moment has already passed (a short trial), so nothing fires late.
 */
export function trialReminderAt(trialEndsAt: number, now: number): number | null {
  const end = new Date(trialEndsAt);
  const at = new Date(end.getFullYear(), end.getMonth(), end.getDate() - TRIAL_REMIND_DAYS_BEFORE, TRIAL_REMIND_HOUR, 0, 0, 0);
  // Belt and braces: the copy says "in 2 days", so the calendar must agree.
  if (daysBetween(at, end) !== TRIAL_REMIND_DAYS_BEFORE) return null;
  if (at.getTime() <= now) return null;
  return at.getTime();
}

/**
 * What to do with the reminder, given what the store says now. Schedule only for a trial that
 * will turn into a charge (willRenew). A cancelled trial, a paid plan or no Pro: cancel it.
 */
export function trialReminderPlan(trial: TrialStatus, now: number): { action: 'schedule'; at: number } | { action: 'cancel' } {
  if (!trial || !trial.willRenew) return { action: 'cancel' };
  const at = trialReminderAt(trial.endsAt, now);
  return at === null ? { action: 'cancel' } : { action: 'schedule', at };
}
