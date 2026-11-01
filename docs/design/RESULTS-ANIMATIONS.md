# Results animations map

**Status:** the plan for remodel step 2 (docs/briefs/remodel-2026-11.md). Drafted with MUSE AI, adopted
2026-11-01. No new package: Reanimated and expo-haptics are already installed. The reading screen does
not change.

Style: calm but alive. Nothing bounces or scales over the reading text. Results celebrate briefly, then
return to calm. Keep existing timings: 170–200 ms tab/screen transitions, words inking in over 120 ms.

## Order on the results screen

Staggered, never all at once:
1. Flow (or score) number counts up
2. PaceStrip bars grow in, staggered
3. Mastery dots fill, one by one
4. Tiles fade in, staggered
5. The coach celebrates or encourages, in sync (once the coach exists; COACH-STATE-MAP.md)
6. Fix-it / review cards expand only when tapped, with layout animation

## 1. Count-up
- MinuteResult already passes a `shown` Flow number; the Tape already counts its score up over 600 ms.
- Count from 0 (or from the last session's number, if stored) to the value over ~600–800 ms, ease out,
  no bounce. The count-up is the celebration; no scale pop.
- Reduced motion: the final number at once.

## 2. PaceStrip bars
- Each bar grows from 0 to its value, staggered ~80–120 ms. Grow the fastest or out-of-range bar first,
  so the eye lands on what's worth fixing.
- Height growth only. No bounce, no colour flash. Pace detail lives here, never as a red warning while
  reading.
- Reduced motion: full bars at once.

## 3. Mastery dots
- Fill one by one, ~150 ms apart. The third dot (learned, `vocab.ts`) becomes a check.
- When a word is learned, this runs with the coach's Celebrate (`celebrateKind = 2`). Never a second,
  separate celebration.
- Reduced motion: filled dots, static check.

## 4. Tiles and the coaching line
- Fade in, ~100 ms apart, after the count-up starts. Fade only: no slide, no scale.
- The single coaching line fades in last. Never a list of faults.

## 5. One-off celebrations (later, optional)
Clean run, word learned, streak milestone, Pro unlock: play once, short, then calm. Not now. Until then
the count-up, bars and dots are the celebration. Never confetti (Taste rule).

## 6. Micro-interactions
- Buttons: scale to 0.97 on press plus a light haptic. No larger press scale.
- Fix-it and review cards: layout animation when tapped; never auto-expand on load.
- Plan and library progress bars: grow on load, like PaceStrip.
- Transitions stay 170–200 ms.

## Never
- Animation over the reading passage. InkCursor, GlideWord ("nothing bounces or scales") and
  VoiceRibbon ("breathes, doesn't jitter") stay as they are.
- Stacked celebrations. One at session end.
- A stopped-early One Minute (under 45 s) celebrating, or looking like a failure: it gets gentle
  encouragement.
- Feedback carried by animation alone.

## Accessibility
Reduced motion (Reanimated `useReducedMotion()`): fades and static states only. Every number, bar and
dot is still shown.
