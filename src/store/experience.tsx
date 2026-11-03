import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Experience } from '../content/experiences';

type ExperienceContextValue = {
  mode: Experience | null;
  choose: (mode: Experience) => void;
  showChoices: () => void;
};

const ExperienceContext = createContext<ExperienceContextValue | null>(null);

/** Choose at launch, then keep the choice through practice and tab navigation. No user-data migration. */
export function ExperienceProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Experience | null>(null);
  const choose = useCallback((next: Experience) => setMode(next), []);
  const showChoices = useCallback(() => setMode(null), []);
  const value = useMemo(() => ({ mode, choose, showChoices }), [mode, choose, showChoices]);
  return <ExperienceContext.Provider value={value}>{children}</ExperienceContext.Provider>;
}

export function useExperience() {
  const value = useContext(ExperienceContext);
  if (!value) throw new Error('useExperience must be inside ExperienceProvider');
  return value;
}
