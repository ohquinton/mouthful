import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { TRIAL_REMINDER_TEXT, trialReminderPlan } from './billing';
import type { TrialStatus } from './purchases.shared';

const REMINDER_ID = 'cadence-daily-read';
const TRIAL_REMINDER_ID = 'mouthful-trial-ends';

/** Turns on the daily nudge. Returns false if the user said no to notifications. */
export async function scheduleDailyReminder(hour: number, minute: number): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  let perm = await Notifications.getPermissionsAsync();
  if (!perm.granted) perm = await Notifications.requestPermissionsAsync();
  if (!perm.granted) return false;

  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: 'Today’s read is ready',
      body: 'About a minute. Read it out loud.',
      sound: false,
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
  return true;
}

export async function cancelDailyReminder(): Promise<void> {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID).catch(() => {});
}

/**
 * Keeps the "your trial ends in 2 days" reminder in line with the store: scheduled while a trial
 * will turn into a charge, cancelled once they cancel, pay, or have no trial. Safe to call on
 * every launch (same identifier, so it replaces itself). `ask`: may we ask for notification
 * permission? Only right after they start the trial, never on a quiet launch.
 * Returns true when a reminder is scheduled.
 */
export async function syncTrialReminder(trial: TrialStatus, { ask }: { ask: boolean }): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    const plan = trialReminderPlan(trial, Date.now());
    await Notifications.cancelScheduledNotificationAsync(TRIAL_REMINDER_ID).catch(() => {});
    if (plan.action === 'cancel') return false;
    let perm = await Notifications.getPermissionsAsync();
    if (!perm.granted && ask) perm = await Notifications.requestPermissionsAsync();
    if (!perm.granted) return false;
    await Notifications.scheduleNotificationAsync({
      identifier: TRIAL_REMINDER_ID,
      content: { ...TRIAL_REMINDER_TEXT, sound: false },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: plan.at },
    });
    return true;
  } catch {
    // A reminder must never break buying or launching. The paywall already said how to cancel.
    return false;
  }
}

export function formatTime(hour: number, minute: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h}:${String(minute).padStart(2, '0')} ${hour < 12 ? 'am' : 'pm'}`;
}

export const REMINDER_OPTIONS = [
  { hour: 7, minute: 30 },
  { hour: 8, minute: 0 },
  { hour: 12, minute: 30 },
  { hour: 18, minute: 0 },
  { hour: 21, minute: 0 },
];
