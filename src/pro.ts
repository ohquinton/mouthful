import { router } from 'expo-router';
import type { Profile } from './store/profile';

export type ProFeature = 'scripts' | 'library' | 'fixit' | 'history' | 'cold' | 'packs';

/** Soft wall: a one-screen upsell for that feature only, never the full paywall again. */
export const UPSELL: Record<ProFeature, { title: string; line: string }> = {
  scripts: { title: 'Practise your real script', line: 'Paste Thursday’s presentation and rehearse it with Glide tonight.' },
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

export const COLD_READ_STREAK = 7;
