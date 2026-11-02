# Drop coach: Rive source and app integration

Built with Rive CLI 1.8.0 from `scene.rml`. Flat cobalt, white eyes, no mouth.
The artboard is transparent so it works on light and dark app surfaces.

## Build locally

From the repository root, run `./scripts/build-coach.ps1` in PowerShell.
It verifies, builds and copies `assets/rive/drop.riv`. Override `-Rive` if the CLI
is installed elsewhere. No account upload, signing request or paid export is used.
The source has no scripts or external assets. According to `rive docs publishing`,
script signing does not apply to script-free files. The earlier editor subscription
notes were not a prerequisite for this local build.

Preview with `rive design/rive/drop`. Verify with `rive design/rive/drop --verify`
and `rive inspect design/rive/drop --summary`. Do not use `rive push` to preview.

## Contract

Artboard `Drop`; default machine `Coach`; view model `Coach`, instance `Default`.
Numeric `mode`: 0 idle, 1 listening, 2 thinking, 3 nod, 4 happy, 5 hop.
Only integers 0-5 are supported. Changes blend over 180 ms. Breath and Blink are
separate layers. Moves play once and hold their last authored frame; return to
mode 0 before replaying a move. Listening is an authored pulse, not live amplitude.
Neutral keys prevent interrupted poses leaking into the next state. `Demo` retains
the original repeating showcase.

CLI screenshot example (argument order matters; `1` is a frame, `1s` a second):
```
rive design/rive/drop --data=mode=1 --advance=400ms --data=mode=2 --advance=700ms --screenshot
```
PNG references capture listening, thinking, happy and happy interrupted by idle.

## App slice: topic-talk footer

`Coach.native.tsx` loads Rive with a guarded native import. `RiveCoach.native.tsx`
loads the bundled file and binds the numeric mode. Only idle/listening/thinking
are wired in this slice. Recent recognition selects listening; waiting for a result
selects thinking. This is decoration, not silence detection or scoring. The existing
VoiceRibbon continues to show actual audio level. No transcript reaches Rive.

Web uses `Coach.tsx` and the shared SVG Drop. Native uses a static SVG while loading,
on errors, without the native module, under Reduce Motion, while backgrounded, or
when the route loses focus. Reduced Motion changes are observed live. The original
Drop continues to serve onboarding, Home and results.

The 300-unit artboard has padding for hop/lean. Native placement scales and offsets
it to align its body with the existing 112 by 156 Drop footprint. Frame rate is
capped at 30; the coach is decorative and cannot receive touch or screen-reader focus.

Dependencies are pinned: @rive-app/react-native 0.5.10, Nitro 0.36.5. Metro includes
.riv assets. A new development build is required to exercise native rendering.
JavaScript bundling does not verify native compilation or visual performance.

## Phone checks still required

- Start a talk: correct scale, no backdrop or splash, visible listening/thinking.
- Finish and retry, navigate away/back, background/foreground: no stuck or duplicate renderer.
- Toggle Reduce Motion during a talk: static immediately; no animated fallback.
- Test an older build without Rive, and a corrupt/missing asset: practice remains usable.
- Test light/dark, iOS/Android and small screens with large text.

Live audio binding, persistent state-specific loops and wider Home/results integration
remain future work. No phone build has been validated for this slice.
