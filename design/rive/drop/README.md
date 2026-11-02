# The Drop in Rive (coach animation source)

Built with the Rive CLI (1.8.0) from text: `scene.rml`. Flat cobalt Drop matching `src/components/Drop.tsx`.
Moves: idle breath (2.6 s), blink (~6 s), and a demo loop of Listening (voice pulse), Thinking (eyes up),
Nod, Happy (arc eyes), Hop. `moves-sheet.png` shows each move.

- Preview: `rive design/rive/drop` (opens a window, rebuilds on save). Verify: `rive design/rive/drop --verify`.
- Install the CLI (Windows): see docs/research/RIVE.md; `rive.exe` lives in `%USERPROFILE%\.rive\bin`.
- `build/` is git-ignored. Local builds may carry a watermark: a clean `.riv` for the app needs the project
  pushed to a Rive account on Cadet (~$9–17/mo, one month is enough to export).
- Not wired into the app. Next: replace the demo layer with view-model data the app sets (`voiceLevel`,
  `isThinking`, triggers `nod`, `happy`, `hop`) per docs/design/COACH-STATE-MAP.md, then
  `@rive-app/react-native` in a dev build (pin Nitro 0.36.x; no web runtime, keep `Drop.tsx` as fallback).
