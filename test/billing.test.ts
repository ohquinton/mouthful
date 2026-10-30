// Honest billing: the copy under the plan buttons and the "trial ends in 2 days" reminder date.
// Runs in a zone with daylight saving (globalSetup), so the clock-change cases are real.
import { billingLine, cancelPath, subscriptionsUrl, TRIAL_REMIND_HOUR, trialReminderAt, trialReminderPlan } from '../src/billing';
import { daysBetween } from '../src/engine/days';

const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m - 1, d, h, min).getTime();

describe('billingLine: exactly what happens to their money', () => {
  it('names the trial, the price after it, and where to cancel before it ends', () => {
    expect(billingLine({ plan: 'annual', price: '$39.99', trialDays: 7, os: 'ios' })).toBe(
      'Free for 7 days, then $39.99 a year. Cancel any time in Settings → your name → Subscriptions before the trial ends and you won’t be charged.',
    );
  });

  it('says nothing about a trial the store has not confirmed', () => {
    const line = billingLine({ plan: 'annual', price: '$39.99', os: 'ios' });
    expect(line).toBe('$39.99 a year, renews yearly until you cancel. Cancel any time in Settings → your name → Subscriptions.');
    expect(line).not.toMatch(/free|trial/i);
  });

  it('never puts trial wording on the monthly plan', () => {
    const line = billingLine({ plan: 'monthly', price: '$6.99', trialDays: 7, os: 'ios' });
    expect(line).toBe('$6.99 a month, renews monthly until you cancel. Cancel any time in Settings → your name → Subscriptions.');
  });

  it('uses the store price as given (local currency)', () => {
    expect(billingLine({ plan: 'annual', price: 'CA$54.99', os: 'ios' })).toMatch(/^CA\$54\.99 a year/);
  });

  it('a 1-day trial is "1 day"', () => {
    expect(billingLine({ plan: 'annual', price: '$39.99', trialDays: 1, os: 'ios' })).toMatch(/^Free for 1 day, then/);
  });

  it('points Android readers to Google Play', () => {
    expect(billingLine({ plan: 'monthly', price: '$6.99', os: 'android' })).toContain(cancelPath('android'));
    expect(subscriptionsUrl('android')).toBe('https://play.google.com/store/account/subscriptions');
  });

  it('iOS and web (the test harness) open the App Store subscriptions page', () => {
    expect(subscriptionsUrl('ios')).toBe('https://apps.apple.com/account/subscriptions');
    expect(subscriptionsUrl('web')).toBe('https://apps.apple.com/account/subscriptions');
  });
});

describe('trialReminderAt: 10:00, two calendar days before the trial ends', () => {
  it('a 7-day trial: two days before the end day, at 10:00 local', () => {
    const start = at(2026, 10, 30, 21, 15);
    const end = at(2026, 11, 6, 21, 15);
    const r = new Date(trialReminderAt(end, start)!);
    expect([r.getFullYear(), r.getMonth() + 1, r.getDate(), r.getHours(), r.getMinutes()]).toEqual([2026, 11, 4, TRIAL_REMIND_HOUR, 0]);
    expect(daysBetween(r, end)).toBe(2);
  });

  it('across the autumn clock change (Toronto: 1 Nov 2026) it stays 10:00 and 2 days', () => {
    const end = at(2026, 11, 2, 9, 0);
    const r = new Date(trialReminderAt(end, at(2026, 10, 26))!);
    expect([r.getMonth() + 1, r.getDate(), r.getHours()]).toEqual([10, 31, 10]);
    expect(daysBetween(r, end)).toBe(2);
  });

  it('across the spring clock change (Toronto: 8 Mar 2026) it stays 10:00 and 2 days', () => {
    const end = at(2026, 3, 9, 8, 30);
    const r = new Date(trialReminderAt(end, at(2026, 3, 2))!);
    expect([r.getMonth() + 1, r.getDate(), r.getHours()]).toEqual([3, 7, 10]);
    expect(daysBetween(r, end)).toBe(2);
  });

  it('rolls back across a month and a year end', () => {
    const r = new Date(trialReminderAt(at(2027, 1, 1, 3, 0), at(2026, 12, 25))!);
    expect([r.getFullYear(), r.getMonth() + 1, r.getDate()]).toEqual([2026, 12, 30]);
  });

  it('nothing when the reminder time has already passed (a short trial), so nothing fires late', () => {
    const end = at(2026, 11, 2, 9, 0);
    expect(trialReminderAt(end, at(2026, 10, 31, 10, 0))).toBeNull();
    expect(trialReminderAt(end, at(2026, 11, 1))).toBeNull();
    expect(trialReminderAt(end, at(2026, 10, 31, 9, 59))).not.toBeNull();
  });
});

describe('trialReminderPlan: in line with the store', () => {
  const now = at(2026, 10, 30);
  const end = at(2026, 11, 6);

  it('schedules for a trial that will turn into a charge', () => {
    expect(trialReminderPlan({ endsAt: end, willRenew: true }, now)).toEqual({ action: 'schedule', at: trialReminderAt(end, now) });
  });

  it('cancels once they cancel the trial in Settings', () => {
    expect(trialReminderPlan({ endsAt: end, willRenew: false }, now)).toEqual({ action: 'cancel' });
  });

  it('cancels for a paid plan or no Pro (not in a trial)', () => {
    expect(trialReminderPlan(null, now)).toEqual({ action: 'cancel' });
  });

  it('cancels when it is too late to remind', () => {
    expect(trialReminderPlan({ endsAt: at(2026, 10, 31), willRenew: true }, now)).toEqual({ action: 'cancel' });
  });
});
