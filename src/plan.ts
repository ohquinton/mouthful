import type { StepId } from './content/moments';
import type { Profile } from './store/profile';
import { track } from './analytics';

/** Marks a plan step done on the active moment. Safe to call when there's no moment. */
export async function markStep(
  profile: Profile,
  update: (patch: Partial<Profile>) => Promise<void>,
  step: string | undefined,
  extra: Partial<NonNullable<Profile['moment']>> = {},
) {
  const m = profile.moment;
  if (!m || !step) return;
  const done = new Set(m.done ?? []);
  const isNew = !done.has(step);
  done.add(step as StepId);
  await update({ moment: { ...m, ...extra, done: [...done] } });
  if (isNew) track('plan_step_done', { moment: m.id, step });
}
