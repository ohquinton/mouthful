import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadSessions, recordingUris } from './sessions';
import { deleteAllRecordings } from './recordings';
import { setAnalyticsEnabled } from '../analytics';

export type Goal = 'meetings' | 'video' | 'esl' | 'confidence';

export type Profile = {
  onboarded: boolean;
  goal?: Goal;
  /** The moment the user is preparing for, if any (see content/moments.ts). */
  moment?: { id: string; date?: string; startedAt: number; done?: string[]; scriptId?: string } | null;
  /** Asked once: OK to use the platform's server speech service when the phone can't transcribe offline. */
  allowServerRecognition?: boolean;
  /** Keep Day 1 and re-test recordings on this phone so you can hear your progress. */
  keepRecordings?: boolean;
  /** Supervised beta only: record every reading session and keep what the phone heard, for review. */
  testerMode?: boolean;
  /** Which English the recogniser listens for, e.g. "en-IN". Unset: the phone's region (engine/locale.ts). */
  speechLang?: string;
  /** The reader turned off anonymous usage counts in You. Unset means sharing is on. */
  analyticsOptOut?: boolean;
  baselineSessionId?: string;
  reminder?: { hour: number; minute: number } | null;
  pro: boolean;
  paywallSeen: boolean;
};

const KEY = 'mouthful.profile.v1';
const DEFAULT: Profile = { onboarded: false, pro: false, paywallSeen: false };

type Ctx = {
  profile: Profile;
  ready: boolean;
  update: (patch: Partial<Profile>) => Promise<void>;
  reset: () => Promise<void>;
};

const ProfileContext = createContext<Ctx | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(DEFAULT);
  const [ready, setReady] = useState(false);

  // The latest profile, for update(): state updaters can run after update() returns, which
  // would save a stale copy. Every change goes through apply(), so this never falls behind.
  const latest = useRef(DEFAULT);

  const apply = useCallback((next: Profile) => {
    latest.current = next;
    setProfile(next);
    setAnalyticsEnabled(!next.analyticsOptOut);
  }, []);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => raw && apply({ ...DEFAULT, ...(JSON.parse(raw) as Partial<Profile>) }))
      .catch(() => {})
      .finally(() => setReady(true));
  }, [apply]);

  const update = useCallback(
    async (patch: Partial<Profile>) => {
      const next = { ...latest.current, ...patch };
      apply(next);
      try {
        await AsyncStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        // Best effort: the in-memory profile still works for this launch.
      }
    },
    [apply],
  );

  const reset = useCallback(async () => {
    apply(DEFAULT);
    // Audio files first: once the database is cleared we'd no longer know where they are.
    try {
      deleteAllRecordings(recordingUris(await loadSessions()));
    } catch {}
    try {
      await AsyncStorage.clear();
    } catch {}
  }, [apply]);

  const value = useMemo(() => ({ profile, ready, update, reset }), [profile, ready, update, reset]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile(): Ctx {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error('useProfile must be used inside ProfileProvider');
  return ctx;
}

export const GOALS: { id: Goal; title: string; sub: string }[] = [
  { id: 'meetings', title: 'Meetings and presentations', sub: 'Standups, client calls, slides' },
  { id: 'video', title: 'Videos and podcasts', sub: 'Scripts, voiceovers, Looms' },
  { id: 'esl', title: 'English as a second language', sub: 'Pace, clarity, tricky words' },
  { id: 'confidence', title: 'Just more confidence', sub: 'Reading out loud without freezing' },
];
