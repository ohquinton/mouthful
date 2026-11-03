import { Platform } from 'react-native';
import { AndroidImportance, IosAuthorizationStatus, SchedulableTriggerInputTypes, getPermissionsAsync, requestPermissionsAsync, setNotificationChannelAsync, scheduleNotificationAsync, cancelScheduledNotificationAsync } from 'expo-notifications';
import { TRIAL_REMINDER_TEXT, trialReminderPlan } from './billing';
import type { TrialStatus } from './purchases.shared';

const REMINDER_ID = 'cadence-daily-read';
const TRIAL_REMINDER_ID = 'mouthful-trial-ends';
const DAILY_CHANNEL = 'practice-reminders';

// Schedule and Off must finish in tap order, including across different screens.
// A rejected operation must not poison the queue or prevent a later Off attempt.
let dailyWork: Promise<unknown> = Promise.resolve();
function dailyOperation<T>(work: () => Promise<T>): Promise<T> {
  const next = dailyWork.then(work);
  dailyWork = next.catch(() => {});
  return next;
}

/** Turns on the daily nudge. Returns false if the user said no to notifications. */
export function scheduleDailyReminder(hour: number, minute: number): Promise<boolean> {
  return dailyOperation(async () => {
    if (Platform.OS === 'web') return false;
    if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) {
      throw new Error('Invalid reminder time');
    }
    // Android 13+ needs a channel before requesting notification permission.
    if (Platform.OS === 'android') await setNotificationChannelAsync(DAILY_CHANNEL, {
      name: 'Practice reminders', importance: AndroidImportance.LOW,
      sound: null, enableVibrate: false,
    });
    let perm = await getPermissionsAsync();
    const allowed = () => perm.granted || perm.ios?.status === IosAuthorizationStatus.PROVISIONAL;
    if (!allowed() && perm.canAskAgain) perm = await requestPermissionsAsync();
    if (!allowed()) return false;

    // Reuse the identifier to replace the request. Do not cancel the old reminder first:
    // a failed replacement should not needlessly remove the user's existing schedule.
    await scheduleNotificationAsync({
      identifier: REMINDER_ID,
      content: {
        title: 'A minute to find your words',
        body: 'Pick a topic and say what you think.',
        sound: false,
      },
      trigger: { type: SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: DAILY_CHANNEL },
    });
    return true;
  });
}

export function cancelDailyReminder(): Promise<void> {
  return dailyOperation(async () => {
    if (Platform.OS === 'web') return;
    await cancelScheduledNotificationAsync(REMINDER_ID);
  });
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
    await cancelScheduledNotificationAsync(TRIAL_REMINDER_ID).catch(() => {});
    if (plan.action === 'cancel') return false;
    let perm = await getPermissionsAsync();
    if (!perm.granted && ask) perm = await requestPermissionsAsync();
    if (!perm.granted) return false;
    await scheduleNotificationAsync({
      identifier: TRIAL_REMINDER_ID,
      content: { ...TRIAL_REMINDER_TEXT, sound: false },
      trigger: { type: SchedulableTriggerInputTypes.DATE, date: plan.at },
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
