import { router } from 'expo-router';
import { track } from './analytics';
import type { Profile } from './store/profile';
import type { SavedSession } from './store/sessions';

// 'parts' is the rehearse wall for part 2+ while the free run (part 1) is still unused.
export type ProFeature = 'scripts' | 'rehearse' | 'parts' | 'library' | 'fixit' | 'history' | 'cold' | 'packs';

/** Soft wall: a one-screen upsell for that feature only, never the full paywall again. */
export const UPSELL: Record<ProFeature, { title: string; line: string }> = {
  scripts: { title: 'Practise your real script', line: 'Your first script is free. Add every answer you’re preparing.' },
  rehearse: { title: 'Rehearse it again', line: 'Your free run is done. Rehearse every part as often as you need before the day.' },
  parts: { title: 'Rehearse every part', line: 'Your free run is part 1. Rehearse every part with Pro.' },
  library: { title: 'The whole library', line: 'Standups, interview answers, toasts, tongue twisters and more.' },
  fixit: { title: 'Fix the words you trip on', line: 'A 20-second drill on the exact words you stumbled over.' },
  history: { title: 'Every session, charted', line: 'See your pace and fillers improve over weeks, not days.' },
  packs: { title: 'Every Word Pack', line: 'Finance, tech, raise-day words and more: what they mean and how to say them.' },
  cold: { title: 'Cold read', line: 'Read something you haven’t seen, like being handed notes in a meeting.' },
};

/**
 * The paywall's `feature` route param, if it names a soft wall we have. Own keys only: a deep
 * link with ?feature=toString or ?feature=constructor must not match something UPSELL inherits.
 */
export function upsellFeature(param: string | undefined): ProFeature | undefined {
  return param && Object.prototype.hasOwnProperty.call(UPSELL, param) ? (param as ProFeature) : undefined;
}

/** Returns true if the user can use it now; otherwise opens the soft wall and returns false. */
export function requirePro(profile: Profile, feature: ProFeature): boolean {
  if (profile.pro) return true;
  router.push({ pathname: '/paywall', params: { feature } });
  return false;
}

// ---- The free run (docs/briefs/aha-before-paywall.md) ----
//
// A free reader gets one saved script and one completed Glide of its part 1, so they see their
// own words ink in before we ask for money. "Used" is worked out from saved sessions, with no
// extra state. A script session only counts once it read most of the part (partReached below).
// session/[id].tsx doesn't save a too-short attempt, and asks before an early Finish on the free
// run (stopping there saves nothing), so a 15-word Finish, Try again and Carry on never use it
// up (principle 8). Deleting the script doesn't give it back (its sessions stay); Reset all data
// does, and we accept that.

type HasPassage = Pick<SavedSession, 'passageId' | 'partReached'>;

/** Script parts have ids like `s.<scriptId>.<part>` (content/resolve.ts). */
export function isScriptPassage(passageId: string): boolean {
  return /^s\.\d+\.\d+$/.test(passageId);
}

/** Which part of its script a passage is (0 = part 1), or undefined if it isn't a script part. */
export function scriptPart(passageId: string): number | undefined {
  const m = /^s\.\d+\.(\d+)$/.exec(passageId);
  return m ? Number(m[1]) : undefined;
}

/** Share of a part's words Glide must reach for a script read to count as a run of it. */
export const RUN_SHARE = 0.8;

/**
 * Did this read get far enough to count as a run of the part? `reached` is how many words Glide
 * reached (the alignment's `next`), `sentenceEnd` the part's words' sentence-end flags. Yes at
 * 80% of the words, or once Glide is into the last sentence (a long closing sentence can hold
 * more than 20% of a part). A part that is one sentence only has the 80% rule.
 */
export function partReached(reached: number, sentenceEnd: boolean[]): boolean {
  const total = sentenceEnd.length;
  if (!total) return false;
  if (reached >= Math.ceil(total * RUN_SHARE)) return true;
  let lastSentenceStart = 0;
  for (let i = total - 2; i >= 0; i--) {
    if (sentenceEnd[i]) {
      lastSentenceStart = i + 1;
      break;
    }
  }
  return lastSentenceStart > 0 && reached > lastSentenceStart;
}

/**
 * A saved script session that counts as a run. Older sessions have no `partReached` and count:
 * they were saved as runs before this rule, and we'd rather not hand out a second free run.
 */
export function countsAsRun(s: HasPassage): boolean {
  return isScriptPassage(s.passageId) && s.partReached !== false;
}

/** True once any script part has a saved session that counts as a run (countsAsRun). */
export function freeRunUsed(sessions: HasPassage[]): boolean {
  return sessions.some(countsAsRun);
}

/**
 * Can this reader start Glide on this passage? Only script parts are limited here; everything
 * else is gated where it's offered (requirePro). Pro: always. Free: part 1 of a script, once.
 */
export function canRehearse({ pro, sessions, passageId }: { pro: boolean; sessions: HasPassage[]; passageId: string }): boolean {
  if (!isScriptPassage(passageId) || pro) return true;
  return scriptPart(passageId) === 0 && !freeRunUsed(sessions);
}

/**
 * Which soft wall to show when canRehearse() says no. Part 2+ while part 1's free run is still
 * there gets its own line, so we never say "Your free run is done" to someone who hasn't had it.
 */
export function rehearseWall({ sessions, passageId }: { sessions: HasPassage[]; passageId: string }): ProFeature {
  return !freeRunUsed(sessions) && (scriptPart(passageId) ?? 0) > 0 ? 'parts' : 'rehearse';
}

/** True when this read is the free run: a free reader's first script session. */
export function isFreeRun({ pro, sessions, passageId }: { pro: boolean; sessions: HasPassage[]; passageId: string }): boolean {
  return !pro && isScriptPassage(passageId) && !freeRunUsed(sessions);
}

/**
 * Cold read is Pro, except the active moment's final run-through (plan step 5 is free on
 * purpose). session/[id].tsx checks this for every way in, deep links included.
 */
export function canColdRead({ pro, passageId, retestPassageId }: { pro: boolean; passageId: string; retestPassageId?: string }): boolean {
  return pro || (!!retestPassageId && passageId === retestPassageId);
}

/** Free readers can keep one script. A second one is Pro. */
export function canAddScript({ pro, scriptCount }: { pro: boolean; scriptCount: number }): boolean {
  return pro || scriptCount === 0;
}

/**
 * Plan step 3 ("add your real words"): what scripts/new can offer. Linking a script that's
 * already saved makes no new script, so it's free: a reader who added their one free script
 * from the Scripts tile before starting a moment can still use it for the moment.
 */
export function scriptStepOptions({ pro, scriptCount }: { pro: boolean; scriptCount: number }): { pick: boolean; add: boolean } {
  return { pick: scriptCount > 0, add: canAddScript({ pro, scriptCount }) };
}

/**
 * Should leaving this Tape open the full paywall? Once only (`ahaPaywallShown`), for a free
 * reader, and only on the Tape of the free run itself: the first script session that counts.
 */
export function ahaPaywallDue({
  profile,
  sessions,
  sessionId,
}: {
  profile: Pick<Profile, 'pro' | 'ahaPaywallShown'>;
  sessions: Pick<SavedSession, 'id' | 'passageId' | 'partReached'>[];
  sessionId: string;
}): boolean {
  return ahaPending({ profile, sessions })?.id === sessionId;
}

/**
 * The free run's session if its paywall still hasn't opened. Today checks this on focus, for a
 * reader whose app was killed while the Tape was open. A Pro reader who saves a script session
 * gets `ahaPaywallShown` then (session/[id].tsx), so a lapsed subscriber is never told "you just
 * rehearsed" about a run from months ago.
 */
export function ahaPending<S extends Pick<SavedSession, 'id' | 'passageId' | 'partReached'>>({
  profile,
  sessions,
}: {
  profile: Pick<Profile, 'pro' | 'ahaPaywallShown'>;
  sessions: S[];
}): S | undefined {
  if (profile.pro || profile.ahaPaywallShown) return undefined;
  return sessions.find(countsAsRun);
}

// Set by whoever opens the aha paywall first in this launch: the Tape as it's left, or Today on
// focus (Today also gets focus the moment the Tape's Done lands there). `ahaPaywallShown` in the
// profile covers later launches, but it's saved asynchronously, so it can't stop a double open
// within the same second. Module state on purpose: it has to outlive both screens.
let ahaClaimed = false;

/** True for the first caller in this launch, false after. Call it just before opening the aha paywall. */
export function claimAhaPaywall(): boolean {
  if (ahaClaimed) return false;
  ahaClaimed = true;
  return true;
}

/**
 * The numbers the post-run paywall quotes, from the saved session as it is now, so "I said it"
 * on the Tape counts. `words` is what they read through (heard + missed), `heard` is heard clearly.
 */
export function ahaNumbers(s: Pick<SavedSession, 'wpm' | 'readCount' | 'skippedWords' | 'stumbled'>): { wpm: number; words: number; heard: number } {
  const heard = s.readCount ?? 0;
  const missed = s.skippedWords?.length ?? s.stumbled.length;
  return { wpm: s.wpm, words: heard + missed, heard };
}

/** The aha paywall's route, numbers only. The moment's name only when this is the moment's own script. */
export function ahaPaywallRoute(
  session: Pick<SavedSession, 'passageId' | 'wpm' | 'readCount' | 'skippedWords' | 'stumbled'>,
  moment: Profile['moment'],
) {
  const n = ahaNumbers(session);
  const own = !!moment?.scriptId && session.passageId.startsWith(`s.${moment.scriptId}.`);
  return {
    pathname: '/paywall' as const,
    params: { from: 'aha', wpm: String(n.wpm), words: String(n.words), heard: String(n.heard), ...(own && moment ? { moment: moment.id } : {}) },
  };
}

/** Headline and lead for the full paywall after the free run. Numbers only, never the script. */
export function ahaCopy({
  wpm,
  words,
  heard,
  momentShort,
  daysToGo,
}: {
  wpm: number;
  words: number;
  heard: number;
  momentShort?: string;
  daysToGo?: number;
}): { headline: string; lead: string } {
  const headline = `You just rehearsed your own ${momentShort ?? 'script'} at ${wpm} wpm.`;
  const counts = `${words} ${words === 1 ? 'word' : 'words'}, ${heard} heard clearly.`;
  const when =
    daysToGo === undefined || daysToGo < 0 ? '' : daysToGo === 0 ? ' It’s today.' : daysToGo === 1 ? ' 1 day to go.' : ` ${daysToGo} days to go.`;
  return { headline, lead: `${counts}${when} Rehearse every part until it’s yours.` };
}

// ---- Analytics for the free run and the paywall: counts and codes only, never the script ----

/** Where the paywall was opened from: a code, never text. */
export type PaywallFrom = 'aha' | 'soft' | 'you';

export function paywallFrom(fromParam: string | undefined, feature: ProFeature | undefined): PaywallFrom {
  return fromParam === 'aha' ? 'aha' : feature ? 'soft' : 'you';
}

export function trackPaywallView(from: PaywallFrom, feature: ProFeature | undefined, hasDay1: boolean) {
  track('paywall_view', { from, feature: feature ?? 'main', has_day1: hasDay1 });
}

/** Left without buying: how long they looked, in whole seconds. */
export function trackPaywallClose(from: PaywallFrom, feature: ProFeature | undefined, openedAt: number, now = Date.now()) {
  track('paywall_close', { from, feature: feature ?? 'main', seconds: Math.round((now - openedAt) / 1000) });
}

/** The free run was saved. How many words and parts, never which. */
export function trackFreeRunComplete({
  moment,
  words,
  parts,
  wpm,
  stumbled,
  day1At,
  now = Date.now(),
}: {
  moment: string | null;
  words: number;
  parts: number | null;
  wpm: number;
  stumbled: number;
  day1At?: number;
  now?: number;
}) {
  track('free_run_complete', {
    moment,
    words,
    parts,
    wpm,
    stumbled,
    minutes_since_day1: day1At ? Math.round((now - day1At) / 60_000) : null,
  });
}
