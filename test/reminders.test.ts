import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { cancelDailyReminder, scheduleDailyReminder } from '../src/reminders';

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: jest.fn(), requestPermissionsAsync: jest.fn(),
  scheduleNotificationAsync: jest.fn(), cancelScheduledNotificationAsync: jest.fn(),
  setNotificationChannelAsync: jest.fn(),
  AndroidImportance: { LOW: 4 }, IosAuthorizationStatus: { PROVISIONAL: 3 },
  SchedulableTriggerInputTypes: { DAILY: 'daily', DATE: 'date' },
}));

const permissions = Notifications.getPermissionsAsync as jest.Mock;
const request = Notifications.requestPermissionsAsync as jest.Mock;
const schedule = Notifications.scheduleNotificationAsync as jest.Mock;
const cancel = Notifications.cancelScheduledNotificationAsync as jest.Mock;
const channel = Notifications.setNotificationChannelAsync as jest.Mock;
const platform = Platform as { OS: string };

beforeEach(() => {
  jest.resetAllMocks();
  platform.OS = 'ios';
  permissions.mockResolvedValue({ granted: true, canAskAgain: true });
  schedule.mockResolvedValue('cadence-daily-read');
  cancel.mockResolvedValue(undefined);
  channel.mockResolvedValue(null);
});

it('replaces the same daily identifier without pre-cancelling the existing schedule', async () => {
  await expect(scheduleDailyReminder(8, 0)).resolves.toBe(true);
  expect(schedule).toHaveBeenCalledWith(expect.objectContaining({
    identifier: 'cadence-daily-read',
    content: expect.objectContaining({ body: 'Pick a topic and say what you think.', sound: false }),
    trigger: expect.objectContaining({ type: 'daily', hour: 8, minute: 0 }),
  }));
  expect(cancel).not.toHaveBeenCalled();
});

it('waits for a pending permission request before applying Off', async () => {
  let grant!: (value: object) => void;
  let requesting!: () => void;
  const started = new Promise<void>((resolve) => { requesting = resolve; });
  permissions.mockResolvedValue({ granted: false, canAskAgain: true });
  request.mockImplementation(() => { requesting(); return new Promise((resolve) => { grant = resolve; }); });
  const first = scheduleDailyReminder(8, 0);
  await started;
  const off = cancelDailyReminder();
  expect(cancel).not.toHaveBeenCalled();
  grant({ granted: true });
  await first;
  await off;
  expect(schedule.mock.invocationCallOrder[0]).toBeLessThan(cancel.mock.invocationCallOrder[0]);
  expect(cancel).toHaveBeenCalledWith('cadence-daily-read');
});

it('does not swallow cancellation failures and allows a retry', async () => {
  cancel.mockRejectedValueOnce(new Error('OS unavailable'));
  await expect(cancelDailyReminder()).rejects.toThrow('OS unavailable');
  await expect(cancelDailyReminder()).resolves.toBeUndefined();
});

it('does not poison the queue after a failed replacement', async () => {
  schedule.mockRejectedValueOnce(new Error('Could not schedule'));
  await expect(scheduleDailyReminder(8, 0)).rejects.toThrow('Could not schedule');
  expect(cancel).not.toHaveBeenCalled();
  await expect(cancelDailyReminder()).resolves.toBeUndefined();
});

it('respects permission denial without repeatedly asking', async () => {
  permissions.mockResolvedValue({ granted: false, canAskAgain: false });
  await expect(scheduleDailyReminder(8, 0)).resolves.toBe(false);
  expect(request).not.toHaveBeenCalled();
  expect(schedule).not.toHaveBeenCalled();
});

it('accepts quiet provisional iOS permission without asking again', async () => {
  permissions.mockResolvedValue({ granted: false, canAskAgain: true, ios: { status: 3 } });
  await expect(scheduleDailyReminder(8, 0)).resolves.toBe(true);
  expect(request).not.toHaveBeenCalled();
});

it('creates a quiet Android channel before requesting permission', async () => {
  platform.OS = 'android';
  permissions.mockResolvedValue({ granted: false, canAskAgain: true });
  request.mockResolvedValue({ granted: true });
  await scheduleDailyReminder(18, 0);
  expect(channel).toHaveBeenCalledWith('practice-reminders', expect.objectContaining({ sound: null, enableVibrate: false }));
  expect(channel.mock.invocationCallOrder[0]).toBeLessThan(request.mock.invocationCallOrder[0]);
  expect(schedule.mock.calls[0][0].trigger.channelId).toBe('practice-reminders');
});

it('does not call native APIs on web', async () => {
  platform.OS = 'web';
  await expect(scheduleDailyReminder(8, 0)).resolves.toBe(false);
  await cancelDailyReminder();
  expect(permissions).not.toHaveBeenCalled();
  expect(schedule).not.toHaveBeenCalled();
  expect(cancel).not.toHaveBeenCalled();
});

it('rejects invalid times before changing native state', async () => {
  await expect(scheduleDailyReminder(24, 0)).rejects.toThrow('Invalid reminder time');
  expect(permissions).not.toHaveBeenCalled();
  expect(schedule).not.toHaveBeenCalled();
});
