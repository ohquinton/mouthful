import { router } from 'expo-router';
import type { Profile } from './store/profile';
import type { SavedSession } from './store/sessions';

export type ProFeature = 'scripts' | 'rehearse' | 'library' | 'fixit' | 'history' | 'cold' | 'packs';

/** Soft wall: a one-screen upsell for that feature only, never the full paywall again. */
export const UPSELL: Record<ProFeature, { title: string; line: string }> = {
  scripts: { title: 'Practise your real script', line: 'Your first script is free. Add every answer you’re preparing.' },
  rehearse: { title: 'Rehearse it again', line: 'Your free run is done. Rehearse every part as often as you need before the day.' },
  library: { title: 'The whole library', line: 'Standups, interview answers, toasts, tongue twisters and more.' },
  fixit: { title: 'Fix the words you trip on', line: 'A 20-second drill on the exact words you stumbled over.' },
  history: { title: 'Every session, charted', line: 'See your pace and fillers improve over weeks, not days.' },
  packs: { title: 'Every Word Pack', line: 'Finance, tech, raise-day words and more: what they mean and how to say them.' },
  cold: { title: 'Cold read', line: 'Read something you haven’t seen, like being handed notes in a meeting.' },
};

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
// extra state: session/[id].tsx only saves a session once it's long enough to score, so a
// too-short attempt, Try again and Carry on never use it up (principle 8). Deleting the script
// doesn't give it back (its sessions stay); Reset all data does, and we accept that.

type HasPassage = Pick<SavedSession, 'passageId'>;

/** Script parts have ids like `s.<scriptId>.<part>` (content/resolve.ts). */
export function isScriptPassage(passageId: string): boolean {
  return /^s\.\d+\.\d+$/.test(passageId);
}

/** Which part of its script a passage is (0 = part 1), or undefined if it isn't a script part. */
export function scriptPart(passageId: string): number | undefined {
  const m = /^s\.\d+\.(\d+)$/.exec(passageId);
  return m ? Number(m[1]) : undefined;
}

/** True once any script part has a saved session. */
export function freeRunUsed(sessions: HasPassage[]): boolean {
  return sessions.some((s) => isScriptPassage(s.passageId));
}

/**
 * Can this reader start Glide on this passage? Only script parts are limited here; everything
 * else is gated where it's offered (requirePro). Pro: always. Free: part 1 of a script, once.
 */
export function canRehearse({ pro, sessions, passageId }: { pro: boolean; sessions: HasPassage[]; passageId: string }): boolean {
  if (!isScriptPassage(passageId) || pro) return true;
  return scriptPart(passageId) === 0 && !freeRunUsed(sessions);
}

/** True when this read is the free run: a free reader's first script session. */
export function isFreeRun({ pro, sessions, passageId }: { pro: boolean; sessions: HasPassage[]; passageId: string }): boolean {
  return !pro && isScriptPassage(passageId) && !freeRunUsed(sessions);
}

/** Free readers can keep one script. A second one is Pro. */
export function canAddScript({ pro, scriptCount }: { pro: boolean; scriptCount: number }): boolean {
  return pro || scriptCount === 0;
}

/**
 * Should leaving this Tape open the full paywall? Once only (`ahaPaywallShown`), for a free
 * reader, and only on the Tape of the free run itself: the first saved script session.
 */
export function ahaPaywallDue({
  profile,
  sessions,
  sessionId,
}: {
  profile: Pick<Profile, 'pro' | 'ahaPaywallShown'>;
  sessions: Pick<SavedSession, 'id' | 'passageId'>[];
  sessionId: string;
}): boolean {
  if (profile.pro || profile.ahaPaywallShown) return false;
  const first = sessions.find((s) => isScriptPassage(s.passageId));
  return first?.id === sessionId;
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
