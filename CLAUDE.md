# Mouthful

**That word’s a mouthful. Make it yours.**

Mouthful helps adults rehearse what they'll actually say at work (an interview answer, a presentation, a raise conversation, a meeting update) out loud. You read with Glide, the words ink in as you say them, and you see your pace, fillers and the words you tripped on. Then you practise those words alone and in a sentence.

Formerly "Cadence" (renamed: at least two speaking apps already use that name). The product name lives in `src/brand.ts` only.

Strategy, bets and open decisions: `STRATEGY.md` (read it before planning work).
Product spec (written under the old name): https://claude.ai/artifact/7y5W1WCUVuHKrXsHjLFAmC
Read AGENTS.md too: Expo SDK 58 has changed since most training data. Check the versioned docs.

## Principles (from the trust review — don't regress these)

1. **Don't overclaim.** Speech recognition tells us whether the phone *heard* a word clearly. It is not a pronunciation grade. Copy says "heard clearly", never "pronounced correctly".
2. **The reader can overrule the recogniser.** Any red word can be tapped during Glide, or marked "I said it" on the Tape. Accuracy and score recompute. Corrections are logged (`recognition_correction`) so we learn which words the recogniser gets wrong.
3. **Privacy matches the promise.** On-device recognition when the phone supports it. If not, `MicGate` asks once before any audio goes to the platform speech service. Recordings are kept only with an explicit yes (switches default to off), only on the phone, in one folder (`store/recordings.ts`). "Delete recordings" and "Reset all data" delete the audio files themselves. Analytics never carry a user's words: `track()` drops any text property that isn't a short code on an allowlist (`sanitise` in `analytics.ts`), so send lengths, counts and codes instead.
4. **No single "correct" pace.** Reading 130–165, presenting 120–155, talking 120–170 (`PACE_BANDS`). Shown as a suggested range. Pace is only ever compared within one context (Progress chart chips, Day 1 vs now).
5. **Reward steadiness, not speed.** The pacer runs at the middle of the range; we don't race your best.
6. **During Glide, nothing competes with the text.** Motion is limited to the ink cursor, the words inking in, and the footer.
7. **Only hesitations are fillers.** um, uh, erm are scored. Habit words (like, so, actually, you know) are reported on the Tape and never scored, in reading or free talk, because we can't tell a habit from a reader rephrasing or the recogniser mishearing.
8. **A failed attempt always has a way back.** Too-short sessions show Try again, which resets everything (transcript, timer, corrections, marks) and listens again.

## Layout

- `src/engine/` — pure TypeScript, unit tested in `__tests__`. **Any change here needs a test.**
  - `align.ts` — Glide matching, hesitations vs habit words, corrections, sentence context
  - `score.ts` — pace bands, score, coaching line, pacer
  - `vocab.ts` — word stages: heard → in context → comfortable (3 clean in-context days)
  - `progress.ts` — heat strip, bests, Day 1 vs now, re-test timing, pace by context
  - `review.ts` — beta review metrics (false red/green per 100 words, uncaught errors)
  - `steadiness.ts` — pace by stretch of the passage (breaths left out) and a 0–100 steadiness; shown on the Tape as `PaceStrip`, not part of the score
  - `locale.ts` — which English the recogniser listens for (reader's choice in You, else the phone's region)
  - `days.ts` — calendar-day maths (`daysBetween`, `calendarDay`), safe across clock changes
- `src/speech/gate.ts` — when speech counts as on-device (Android only from API 33) and whether a variety is supported
- `src/speech/useListener.ts` — recogniser wrapper: on-device/consent, restarts, voice level, optional recording, `reset()` for retries
- `src/store/recordings.ts` — the recordings folder; delete-all sweeps strays from older builds too
- `src/content/` — passages, Word Packs (6), moments (interview, presentation, raise, meeting), scripts
- `src/app/` — Expo Router screens: `(tabs)/` Today, Library, Progress, You; `session/[id]`, `tape`, `fixit`, `talk`, `moment`, `pack/[id]`, `words`, `scripts/*`, `onboarding/*`, `paywall`, `review` (tester mode only)
- `src/components/` — `InkCursor` and `VoiceRibbon` (Reanimated), `GlideWord`, `PlanCard`, `MicGate`, `Replay` (expo-audio), `Charts`
- `src/purchases.native.ts` — RevenueCat (phones). `src/purchases.ts` — web/test stub.
- `src/analytics.ts` — PostHog batch client. Event names, numbers and allowlisted short codes only; free text is dropped before sending.

## Running the agent team (no collisions)

Agents live in `.claude/agents/`. Only the main session hands out work and merges it.

1. **Start clean.** `git status` must be empty before agents start. Commit or stash first.
2. **Readers run in parallel, freely.** qa-critic, release-privacy and product-lead can't edit files (their `tools` lists), so any number can run at once.
3. **Writers get their own worktree.** mobile-engineer, speech-engine and design-ux always run with worktree isolation, so each edits its own copy of the repo on its own branch, never `main` directly.
4. **One owner per file per wave.** Before launching writers, list the files each will touch. If two writers need the same file, run them one after the other, not together. Default ownership: speech-engine owns `src/engine/` and `src/speech/`; mobile-engineer owns `src/app/`, `src/store/`, `src/components/`; design-ux reviews and proposes copy, and edits only when given the files.
5. **Shared files are main-session only:** `package.json`, `package-lock.json`, `app.json`, `CLAUDE.md`, `patches/`, `src/theme.ts`, `src/brand.ts`. A writer that needs a change there says so in its handoff instead of making it.
6. **Merge one branch at a time.** After each merge into `main`: `npm test` and `npm run typecheck` must pass before the next merge. A failing merge is reverted and sent back to its author.
7. **qa-critic reviews every merged change** before the next wave starts, never the agent that wrote it.
8. **Waves:** read (review, audit, decide) → write (fixes and features, isolated) → merge one by one → qa-critic → next wave.

## Tester mode (supervised beta only)

Hidden: tap the version line on the You tab 7 times, or build with `EXPO_PUBLIC_TESTER_MODE=1`. When on, every reading session is recorded and keeps its transcript, statuses and first-word lag (`SavedSession.review`), all on the phone. `/review` lets you mark errors against the recording and copies numbers-only rows for the beta sheet. See TESTING.md.

## Passage ids

`baseline` (Day 1 + re-tests) · built-in ids (`night-shift`…) · `w.<pack>.<n>` (Word Pack passages) · `s.<scriptId>.<part>` (your scripts) · `talk` (Free talk sessions)

## Moments (the main flow)

Today shows the active moment's plan (`PlanCard`): learn the words → say them in context → add your real words (Pro) → rehearse it (Pro) → final run-through (cold read). Steps are marked done via `markStep` when the screen they launch finishes (`step` route param).

## Commands

```bash
npm test                  # engine tests (131)
npm run typecheck
npx expo lint             # first run sets up ESLint
npx expo start            # dev server (needs the development build, not Expo Go)
npx eas-cli@latest build --profile development --platform ios
```

## Not built yet (in priority order)

1. Controlled phone beta: your own iPhone first, then 10 readers, at least half with accents (see TESTING.md). Fix what the review data shows before adding features.
2. Trademark check for "Mouthful" (CIPO and USPTO) before spending on branding. "Mouthful: Voice to To-Do List" exists on iOS in a different category.
3. RevenueCat products and keys in App Store Connect (code is done, needs the store setup in README).
4. PostHog project + funnel dashboard (code is done, needs a key).
5. Post-session cloud transcription for accurate "um/uh" (on-device recognisers drop them). Needs its own privacy consent.
6. Shareable Day 1 vs Day 30 clip (recordings exist now; stitching + share sheet doesn't).
7. More moments (sales call, client update) and more Word Packs.

## Known limits

- Habit words are never scored, so someone who says "like" every third word isn't told so by the score, only by the Tape's habit-word line.
- On-device recognisers often drop "um" and "uh", so filler counts run low. Item 5 above fixes that.
- First-word lag is a proxy for highlight delay (voice level crossing a threshold → first inked word). It isn't measured on web, which has no voice levels.
- Very short Free talk sessions inflate fillers per minute.
- Steadiness is timed from when Glide reaches each word, so recogniser bursts add noise. Stretches under 1.5 s of speech are dropped, but an even reader on a bursty (server) recogniser may still score lower than they should. Check it against recordings in the beta before using it in the score. Reading only: Free talk has no sentences to time.
- Android counts as on-device only from Android 13 (API 33). Below that the library uses the network recogniser even when asked for on-device. Android can't check a variety is supported before consent, so an unsupported one can still fail after the reader agrees.
- Steadiness leaves out steps over 2.5 s (the Pauses tile covers those) and steps touching a skipped word. A tail under 8 words after the last full stop isn't timed.
- Plan steps 1, 2 and 5 are free even for Pro packs (deliberate hook); steps 3–4 are Pro.
- `patches/expo-speech-recognition+58.0.0.patch` makes iOS check on-device support for the locale we listen in (the library only checked the device default, and iOS silently falls back to the server). Android's on-device check still ignores locale. Re-check the patch when upgrading the library.
