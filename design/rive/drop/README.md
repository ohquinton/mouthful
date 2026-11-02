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

## Controllable Coach (Codex, 2026-11-02)

The default Coach state machine binds the Coach view model, exported instance Default.
Set numeric mode: 0 idle, 1 listening, 2 thinking, 3 nod, 4 happy, 5 hop.
Only integers 0-5 are supported. Changes blend over 180 ms.
Breathing and blinking run on independent layers. Each move plays once and holds its
final frame; return to mode 0 before replaying the same move. Listening is an authored
pulse, not live audio. The original repeating showcase remains available as Demo.
Every expression keys neutral transforms and eye visibility to prevent interrupted
poses leaking into subsequent states.

CLI checks (argument order matters; 1 means one frame, 1s means one second):
```
rive . --verify
rive inspect . --summary
rive . --data=mode=4 --advance=700ms --screenshot
```
The PNG references were rendered with the CLI. Visual checks include happy to idle
and happy to thinking before the happy timeline ends.
App integration, live voice binding, reduced-motion behavior and device validation
remain outstanding. No runtime package, account upload or paid export was performed.
