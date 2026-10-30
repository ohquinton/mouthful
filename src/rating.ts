// When to ask for an App Store rating (docs/DILEMMAS.md #12). Competitors get 1-star reviews for
// asking before the app helped, so we only ask once it clearly has, and never after a bad try.
import type { Profile } from './store/profile';
import type { SavedSession } from './store/sessions';
import { ahaPending, countsAsRun } from './pro';
import { daysBetween } from './engine/days';
import { track } from './analytics';

/** At least this many days between two asks. */
export const RATING_COOLDOWN_DAYS = 120;
/** At most this many asks in any 365 days (Apple's own limit for the system prompt). */
export const RATING_MAX_PER_YEAR = 3;

/** Why we asked, as an analytics code. */
export type RatingReason = 'second_run' | 'after_moment';

type RatingSession = Pick<SavedSession, 'id' | 'passageId' | 'partReached'>;

// Set when this launch had a too-short read or a recogniser error. The ask waits for a launch
// where nothing went wrong. Module state on purpose: it has to outlive the screens.
let roughPatch = false;

/** Call when a read was too short to score, or the recogniser stopped with an error. */
export function noteRoughPatch() {
  roughPatch = true;
}

/** For tests: a fresh launch. */
export function resetRoughPatch() {
  roughPatch = false;
}

/** The moment's date (yyyy-mm-dd) as local midnight, or undefined if it isn't a real date. */
function localDate(iso: string | undefined): Date | undefined {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/**
 * Why we may ask for a rating now, or null. Called as the reader leaves the Tape of `sessionId`.
 * - After their second run that reached its part (pro.ts countsAsRun), on the Tape of a run, or
 * - the day after the active moment's date (any later day counts).
 * Never in a launch that had a too-short read or an error, never within 120 days of the last
 * ask, never more than 3 times in 365 days, and never while the free run's paywall is still due
 * (one ask at a time).
 */
export function ratingReason(
  sessions: RatingSession[],
  profile: Pick<Profile, 'pro' | 'ahaPaywallShown' | 'moment' | 'ratingAsks'>,
  now: number,
  { sessionId, rough = roughPatch }: { sessionId?: string; rough?: boolean } = {},
): RatingReason | null {
  if (rough) return null;
  const asks = profile.ratingAsks ?? [];
  if (asks.some((t) => daysBetween(t, now) < RATING_COOLDOWN_DAYS)) return null;
  if (asks.filter((t) => daysBetween(t, now) < 365).length >= RATING_MAX_PER_YEAR) return null;
  if (ahaPending({ profile, sessions })) return null;

  const current = sessions.find((s) => s.id === sessionId);
  if (current && countsAsRun(current) && sessions.filter(countsAsRun).length >= 2) return 'second_run';

  const date = localDate(profile.moment?.date);
  if (date && current && daysBetween(date, now) >= 1) return 'after_moment';
  return null;
}

/** The yes/no version of ratingReason. */
export function shouldAskForRating(
  sessions: RatingSession[],
  profile: Pick<Profile, 'pro' | 'ahaPaywallShown' | 'moment' | 'ratingAsks'>,
  now: number,
  opts?: { sessionId?: string; rough?: boolean },
): boolean {
  return ratingReason(sessions, profile, now, opts) !== null;
}

/**
 * Shows the system rating prompt. Returns true only if it was really asked.
 *
 * TODO(main session): expo-store-review isn't installed yet. Run `npx expo install expo-store-review`
 * (native module: the dev build needs a rebuild), then here:
 * `if (!(await StoreReview.isAvailableAsync())) return false; await StoreReview.requestReview(); return true;`
 * Until then this says no, so nothing is recorded or tracked as asked.
 */
async function requestStoreReview(): Promise<boolean> {
  return false;
}

/**
 * Asks if the rule says so, then remembers the ask (for the cooldown) and tracks the reason.
 * Best effort: a failed ask never gets in the reader's way.
 */
export async function maybeAskForRating({
  sessions,
  profile,
  update,
  sessionId,
  now = Date.now(),
}: {
  sessions: RatingSession[];
  profile: Profile;
  update: (patch: Partial<Profile>) => Promise<void>;
  sessionId: string;
  now?: number;
}): Promise<RatingReason | null> {
  const reason = ratingReason(sessions, profile, now, { sessionId });
  if (!reason) return null;
  let asked = false;
  try {
    asked = await requestStoreReview();
  } catch {}
  if (!asked) return null;
  // Keep a year of asks: that's all the rule looks at.
  await update({ ratingAsks: [...(profile.ratingAsks ?? []).filter((t) => daysBetween(t, now) < 365), now] });
  track('rating_prompt', { reason });
  return reason;
}
