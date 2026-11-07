import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Experience } from '../content/experiences';
import { loadExperience, saveExperience } from './experienceChoice';

type ExperienceContextValue = {
  mode: Experience | null;
  /** False until the saved door has been read, so a returning reader never sees the doors flash. */
  ready: boolean;
  choose: (mode: Experience) => void;
  showChoices: () => void;
};

const ExperienceContext = createContext<ExperienceContextValue | null>(null);

/**
 * Opens on the door the reader last chose; a first launch shows both. Home's switch shows both again
 * without forgetting the old choice, so closing the app there returns to it. No user-data migration.
 */
export function ExperienceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Experience | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    loadExperience().then((saved) => {
      if (!live) return;
      setMode(saved);
      setReady(true);
    });
    return () => { live = false; };
  }, []);

  const choose = useCallback((next: Experience) => {
    setMode(next);
    saveExperience(next);
  }, []);
  const showChoices = useCallback(() => setMode(null), []);
  const value = useMemo(() => ({ mode, ready, choose, showChoices }), [mode, ready, choose, showChoices]);
  return <ExperienceContext.Provider value={value}>{children}</ExperienceContext.Provider>;
}

export function useExperience() {
  const value = useContext(ExperienceContext);
  if (!value) throw new Error('useExperience must be inside ExperienceProvider');
  return value;
}
