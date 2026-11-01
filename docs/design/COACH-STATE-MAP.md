# Coach state map (Rive): the Drop, alive

**Status:** draft, remodel step 6 (docs/briefs/remodel-2026-11.md). Drafted with MUSE AI 2026-10-31;
reconciled with DECISIONS 2026-11-01. Not approved for building until Quinton approves step 6.

**Reconciliations:**
- The coach is **the Drop** (DECISIONS 2026-10-30): flat, two colours, **no mouth**, never sad. Where the
  original draft had a mouth following the voice, the Drop's body pulses or ripples with `voiceLevel`.
- Never over the reading text (principle 6). Placement: the practice footer, onboarding, the home map,
  results, empty states.
- Taste rule: crafted and calm. No glow, no confetti, no shine.

## Package and risk
- `@rive-app/react-native` 0.5.9 (Nitro modules, peer `react-native-nitro-modules`, pre-1.0, updated
  2026-10-29). No stated support for React Native 0.88 / Expo SDK 58 yet: verify in a development build.
  Not in Expo Go. Web renders through `@rive-app/canvas`.
- Rive free-plan exports may play a splash; check before a commercial launch.
- Build it behind a fallback: if Rive fails to load, show a static Drop image. Nothing may depend on it.

## Rive file
- `assets/coach.riv`, artboard `Coach`, state machine `Coach`.
- Base layer always on: breathing and blinking, under every other state.

## Inputs (code ↔ .riv contract)

| Input | Type | Set from |
|---|---|---|
| `isListening` | boolean | mic on, session running |
| `voiceLevel` | number 0–1 | `useVoiceLevel()` (VoiceRibbon), already smoothed |
| `isTooFast` / `isTooSlow` | boolean | `paceZone()` in `engine/score.ts` |
| `micError` | boolean | mic permission or recogniser failure |
| `onFiller` | trigger | hesitation count rises (`align.ts`) |
| `onSkipped` | trigger | a word becomes `skipped` |
| `onCorrected` | trigger | reader taps a red word ("I said it") |
| `onBreath` | trigger | pointer reaches a `breathAfter` word |
| `onComplete` | trigger | results computed |
| `onLearned` | trigger | a word reaches learned (`vocab.ts`) |
| `celebrateKind` | number | 0 none, 1 clean run, 2 learned, 3 streak |

## States
- **Idle:** home, library, no session. Breathing, blinking, a small tilt now and then.
- **Listening:** in session. Faces the text direction; body pulses with `voiceLevel`, matching the ribbon.
- **Thinking:** silence mid-sentence (> 2 s reading; > 2.5 s in One Minute, `LONG_PAUSE_MS`). Eyes up,
  waiting. Thinking is normal, never worried.
- **Breath (1 s):** a pause at punctuation. A small inhale. Teaches that pausing at a full stop is good.
- **Nudge (1.2 s):** only for hesitations (um/uh) and skipped words. A gentle glance; no frown, no red, no
  shake. First filler: one nudge. After that only at ≥ 3 fillers/min, at most every 15 s. **Never for
  habit words** (like, so, you know…).
- **Encouraging (brief):** on a correction tap. A nod; the recogniser is sometimes wrong.
- **Pace cue (modifier):** too fast, a slow breath; too slow, a slight lean in. At most once per sentence.
  In range: nothing.
- **Results, Celebrate or Encourage (2–3 s, then Idle):** clean run (0 fillers, no long pauses, in band),
  word learned, or streak milestone celebrate; otherwise encourage with the one coaching line. A One
  Minute stopped under 45 s gets gentle encouragement.
- **Mic off / error:** holds up a mic, static. No panic, no red.

## Priority
1. Results beat everything, only at session end.
2. Nudge and Encouraging are brief overlays; they never stack.
3. Breath beats Thinking; Thinking beats Listening.
4. Two triggers in one frame: take the higher, drop the other. Never queue nudges.
5. Mic off beats Listening, not a Results celebration.

## Component (proposed)
`src/components/Coach.tsx` passes inputs to Rive and holds no logic of its own. The screens derive the
inputs from `align.ts`, `score.ts` and `minute.ts`, so the logic stays in tested engine code.

## Accessibility
- Reduced motion: the Idle frame only; state changes as static expressions.
- `accessibilityElementsHidden` during reading, like VoiceRibbon.
- Every state also has text or a number. Never feedback by animation alone.

## Build order
1. Idle, Listening, Thinking, Nudge, Celebrate.
2. Breath, Encouraging, Pace cue, Mic off.
3. Results celebrations and Mastery sync (with RESULTS-ANIMATIONS.md).
