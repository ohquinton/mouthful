import { Drop } from './Drop';
import type { CoachProps } from './coachState';

/** Web keeps the shared Drop; native Rive is isolated in Coach.native.tsx. */
export function Coach({ height = 44, state = 'idle' }: CoachProps) {
  return <Drop height={height} pose={state === 'thinking' ? 'up' : 'rest'} />;
}
