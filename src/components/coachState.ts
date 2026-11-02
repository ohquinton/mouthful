export type CoachState = 'idle' | 'listening' | 'thinking';
export type CoachProps = { height?: number; state?: CoachState };

/** Matches design/rive/drop/scene.rml. Decoration only; never used for scoring. */
export const COACH_MODE: Record<CoachState, number> = { idle: 0, listening: 1, thinking: 2 };

export function talkCoachState(running: boolean, lastHeardAt: number, now: number): CoachState {
  if (!running) return 'idle';
  // Recognition can arrive in bursts. This is a waiting pose, never a claim of silence.
  return lastHeardAt > 0 && now - lastHeardAt < 2500 ? 'listening' : 'thinking';
}
