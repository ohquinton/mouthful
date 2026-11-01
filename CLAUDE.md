# SaidClearly (formerly Mouthful)

**Find the words. Say them clearly.**

SaidClearly helps people become more articulate: find precise words, think on their feet, and practise pace, emphasis and delivery. ESL speakers are included, but the product is not centred on ESL. Rehearsing interviews, presentations and conversations is one part of a broader speaking practice. Glide, vocabulary packs and One Minute are training methods, not the entire promise. See the latest founder correction in DECISIONS.md and docs/COFOUNDER-CONTEXT.md.

Renamed Mouthful → SaidClearly on 2026-10-30 (US risk; docs/NAME-CHECK.md), and earlier Cadence → Mouthful. The product name lives in `src/brand.ts` (and app.json's display name and permission strings). The repo, bundle id (`ca.quintonjackson.mouthful`), slug and URL scheme stay "mouthful": RevenueCat, Sentry and EAS are tied to them. Copy must say "heard clearly", never imply a clarity grade (the name sounds like a verdict).

## Current direction (read this first; it overrides older text anywhere)

The remodel (DECISIONS 2026-11-01, full brief `docs/briefs/remodel-2026-11.md`):
- **What it is:** an articulation app. The pitch is identity: sound sharp, think on your feet, say what you mean clearly. Find precise words, build vocabulary, speak with steady pace, emphasis and presence, with fewer fillers and repeated words. **Presentation and interview practice never lead** (Quinton: the weakest part); moments are optional destinations.
- **The core daily loop is topic talk:** a topic ("coffee"), a minute of talking, a rating, beat yourself tomorrow, watch your articulation improve over weeks. One Minute is the front door, not a tester-mode extra.
- **Two doors, one app:** the home is a map with two train lines from one station. **Clear English** (ESL speakers: be understood, everyday fluency, "say this, not that") and **Sharp Talk** (precise words, no fillers, sounding sharp). Each stop is a lesson (topic talk, word pack, cold read, Glide rehearsal) and the Drop moves along the line. Pick a line once in onboarding; the other is one tap away. One listing, one subscription, one engine.
- **Who it's for:** fluent and ESL speakers alike, through their own door. Never remedial or condescending. UI copy stays plain English (no idioms).
- **The feel:** sunny and alive, a slight Duolingo vibe: characters and motion on onboarding, the home map, results and empty states. The reading passage stays calm (principle 6). Alive is not vibe-coded: the Taste rule in `.claude/agents/04-design-ux.md` still bans glows, gradients, confetti and AI-looking art.
- **Honest scorecard:** fillers, repeated words, vocabulary variety, Flow, time to first word, pace, steadiness. Grammar and creativity are practised, not measured. Pronunciation is never graded (principle 1).
- **How we build:** one approved step at a time, in the brief's build order; stop for Quinton's approval between steps. Real bugs and trust breaks are fixed at once. Native-only work (Rive, haptics, speech) is unverified until a phone build exists, so it always has a fallback.
- **Name:** SaidClearly. "Mouthful" survives only in code identifiers (bundle id, storage keys `mouthful.*`, product ids `mouthful_pro_*`, repo); never in anything a user sees.

**Which file wins when they disagree** (newest dated decision first):
1. `DECISIONS.md`: dated founder decisions, newest first. Always wins.
2. This file, `CLAUDE.md`: current direction, principles, layout, team rules.
3. `docs/COFOUNDER-CONTEXT.md`: Quinton's vision and how Claude and Codex work together.
4. `STRATEGY.md`: only "Current focus" and "Next up" are current; the cofounder review below them is history.
5. Agent briefs in `.claude/agents/`: how each role works. Their product descriptions defer to 1–3.
6. Everything else in `docs/` (research, briefs, dilemmas): evidence and plans, not orders. A brief marked done is history.

If you find text that contradicts a higher file, follow the higher one and say so in your handoff, quoting the stale line and its file, so the main session fixes it. Never act on the old wording. Only the main session edits this file, `DECISIONS.md`, `STRATEGY.md` and the agent briefs.

Strategy, bets and open decisions: `STRATEGY.md` (read it before planning work). Open product dilemmas: `docs/DILEMMAS.md`. Competitors: `docs/COMPETITORS.md`. What users love, ask for and hate (2,863 reviews): `docs/MARKET-RESEARCH.md`. Feature briefs: `docs/briefs/`.
Product spec (written under the old name): https://claude.ai/artifact/7y5W1WCUVuHKrXsHjLFAmC
Read AGENTS.md too: Expo SDK 58 has changed since most training data. Check the versioned docs.

## Principles (from the trust review — don't regress these)

1. **Don't overclaim.** Speech recognition tells us whether the phone *heard* a word clearly. It is not a pronunciation grade. Copy says "heard clearly", never "pronounced correctly".
2. **The reader can overrule the recogniser.** Any red word can be tapped during Glide, or marked "I said it" on the Tape. Accuracy and score recompute. Corrections are logged (`recognition_correction`) so we learn which words the recogniser gets wrong.
3. **Privacy matches the promise.** On-device recognition when the phone supports it. If not, `MicGate` asks once before any audio goes to the platform speech service. Recordings are kept only with an explicit yes (switches default to off), only on the phone, in one folder (`store/recordings.ts`). "Delete recordings" and "Reset all data" delete the audio files themselves. Analytics never carry a user's words: `track()` drops any text property that isn't a short code on an allowlist (`sanitise` in `analytics.ts`), so send lengths, counts and codes instead.
4. **No single "correct" pace.** Reading 130–165, presenting 120–155, talking 120–170 (`PACE_BANDS`). Shown as a suggested range. Pace is only ever compared within one context (Progress chart chips, Day 1 vs now).
5. **Reward steadiness, not speed.** The pacer runs at the middle of the range; we don't race your best.
6. **During Glide, nothing competes with the text.** Motion is limited to the ink cursor, the words inking in, and the footer.
7. **Only fillers we can tell from context count.** um, uh, erm are scored. Habit words (like, so, you know, actually…) are labelled filler, real or unsure by a context classifier (`engine/habits.ts`: the words around them, pauses, repetition bursts). Only "filler" counts, the reader can always overrule ("I meant that"), and a word enters any score only after it reaches ≥ ~90% precision on the labelled corpus and the beta hand tally agrees. Until then it is shown, not scored (DECISIONS 2026-10-29).
8. **A failed attempt always has a way back.** Too-short sessions show Try again, which resets everything (transcript, timer, corrections, marks) and listens again.

## Layout

- `test/` — tests outside the engine (analytics opt-out, tester review cleanup)
- `src/engine/` — pure TypeScript, unit tested in `__tests__`. **Any change here needs a test.**
  - `align.ts` — Glide matching, hesitations vs habit words, corrections, sentence context, resync after skips and re-reads (`resync.test.ts`, fixtures in `__tests__/fixtures/`)
  - `score.ts` — pace bands, score, coaching line, pacer
  - `vocab.ts` — word stages: heard → in context → comfortable (3 clean in-context days)
  - `progress.ts` — heat strip, bests, Day 1 vs now, re-test timing, pace by context
  - `review.ts` — beta review metrics (false red/green per 100 words, uncaught errors)
  - `steadiness.ts` — pace by stretch of the passage (breaths left out) and a 0–100 steadiness; shown on the Tape as `PaceStrip`, not part of the score
  - `wording.ts` — One Minute's repeated words (content words only; prompt words, hesitations and habit words never counted) (prompt word families, habit forms, number words and restart-seam repeats never counted) and vocabulary variety (MATTR over 50-word windows; a per-talk record, shown only as `pooledVariety` over 3+ talks and 250+ words). Shown, not scored; Flow unchanged
  - `locale.ts` — which English the recogniser listens for (reader's choice in You, else the phone's region)
  - `habits.ts` — habit-word classifier: each like/so/you know/actually/basically/literally/i mean/kind of/sort of/right labelled filler, real or unsure (context rules, bursts, pauses); corpus + holdout in `__tests__/fixtures/habits-*.json`. Not wired into scoring yet
  - `minute.ts` — One Minute engine: long pauses (> 2.5 s after the first word), Flow slots (kept going, pauses, pace scored; um/uh and habit fillers shown), coaching line, own-history trend (`FLOW_SCORED` is the one switch, `FLOW_VERSION` tags sessions). Wired into `talk.tsx` for everyone (topic talk, the remodel's front door; route params `prompt`, `stop`, `seconds` 30|60, `from`), results via `MinuteResult` on the Tape. 30-second talks (onboarding) carry `limitSeconds` and a `-s30` Flow version and never join 60-second trends; their Flow is scaled app-side (`forLength` in store/minute.ts) until the engine takes the talk length as a parameter
  - `days.ts` — calendar-day maths (`daysBetween`, `calendarDay`), safe across clock changes
- `src/speech/gate.ts` — when speech counts as on-device (Android only from API 33) and whether a variety is supported
- `src/speech/useListener.ts` — recogniser wrapper: on-device/consent, restarts, voice level, optional recording, `reset()` for retries
- `src/store/recordings.ts` — the recordings folder; delete-all sweeps strays from older builds too
- `src/content/` — passages, Word Packs (7, including the free Make your point pack with self-guided speaking prompts), moments (interview, presentation, raise, meeting), scripts
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

## Moments (optional destinations since the remodel; not the main flow)

Today currently shows the active moment's plan (`PlanCard`): learn the words → say them in context → add your real words → rehearse it (first run free, then Pro) → final run-through (cold read). Steps are marked done via `markStep` when the screen they launch finishes (`step` route param).

## Commands

```bash
npm test                  # engine + store tests (735); MOUTHFUL_TEST_TZ=Asia/Kolkata npm test for a zone without DST
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

- Repeated words and vocabulary variety (`wording.ts`) are unvalidated: thresholds `MIN_REPEATS` 4 and `MIN_REPEAT_SHARE` 0.04 come from our own fixtures, and variety is never shown per talk (too noisy at one minute); only `pooledVariety` (3+ talks, 250+ words). Realistic learner speech reads about 8 points lower, a real difference, so only ever compare a person with their own past. Names are still counted as repeated words. Prompt synonyms come from `related` lists in `prompts.ts` (8 prompts so far); synonyms not listed can still be flagged. "Precise words" is built but hidden until a licensed everyday-word list is bundled (candidate: NGSL 1.2, CC BY-SA 4.0, needs attribution and a licence check).

- The habit classifier's precision (100% dev, 100% holdout, 0 false accusations) is measured only on corpora we wrote; qa's independent set (habits-qa.json) went 86% → 100% after fixes made against it (recall 59%: like 58%, you know 44%), so it's now a regression bar, not an outside estimate. No habit word is scored yet; decide with the beta tally. um/uh never decide a habit label (they're stripped before the rules run). Recommended to score first: like, you know; the rest stay shown-only.
- One Minute pauses use recogniser result times, not audio, so server bursts may invent pauses; per-minute rates use talk time with a 30 s floor. The first 8 s before the first word are free (`FREE_THINK_MS`); thinking time past that counts against kept going, and time to first word is shown and trended (FLOW_VERSION 2).
- Habit words aren't scored until the classifier is validated (principle 7), so for now someone who says "like" every third word is told so only by the Tape's habit-word line.
- Numbers: a heard number is respelled the script's way when its value is in the script (integers, years, %, decimals, $£€ with m/k/bn, ordinals, clock times). Homophones ("to" for "2") and ordinals said as cardinals still go red; a re-read can pick the wrong copy when a value is written two ways. Fixture: `__tests__/fixtures/numbers.json`.
- On-device recognisers often drop "um" and "uh", so filler counts run low. Item 5 above fixes that.
- First-word lag is a proxy for highlight delay (voice level crossing a threshold → first inked word). It isn't measured on web, which has no voice levels.
- Very short Free talk sessions inflate fillers per minute.
- Steadiness is timed from when Glide reaches each word, so recogniser bursts add noise. Stretches under 1.5 s of speech are dropped, but an even reader on a bursty (server) recogniser may still score lower than they should. Check it against recordings in the beta before using it in the score. Reading only: Free talk has no sentences to time.
- Android counts as on-device only from Android 13 (API 33). Below that the library uses the network recogniser even when asked for on-device. Android can't check a variety is supported before consent, so an unsupported one can still fail after the reader agrees.
- Steadiness leaves out steps over 2.5 s (the Pauses tile covers those) and steps touching a skipped word. A tail under 8 words after the last full stop isn't timed.
- Recoverable recogniser errors (AirPods, network blips, busy) are hidden and restarted; 3 in 10 s with nothing heard ends the session with `repeated-failure`. iOS `interrupted` (call, Siri, backgrounding), `network` and `repeated-failure` stop listening; `resume()` (Carry on) keeps the read, while `language-not-supported` only offers Try again. The cap is unverified on Android phones.
- Steadiness leaves out resync jumps and re-reads (same `reachedAt` stamp on 3+ words, or next to a skipped word). A one-word gap later backfilled can still read ~12% fast in that sentence, and a real drag right after a red word may be dropped. Exact fix if needed: stamp heard-token counts per word in the session screen.
- Glide resyncs after skips and re-reads: 3 unconfirmed words (stutters and habit words don't count), then a unique 2-word match nearby or 3+ further away. A jump waits until its words are 2 from the end of the transcript, and past the next sentence it needs 2 more words read on. Live, a skip into the last sentence holds unless the reader was already in it or picked up at its first word, so a refrain can't finish the session. At Finish, `align(words, heard, heard.length)` lands a hold that's still active (gap red, the words said inked); if the anchor was a tie, the gap counts as skipped. A 3-word interim rewrite of an anchor's only content word can still pull the cursor back (why-this-job 31 → 12; garbled-tail retreats 87 → 23 overall, legacy 31). Resync costs about 1–2.3× the old aligner when the reader is lost (node --jitless ~0.9–1.6 ms worst call on 500-word scripts); not measured on a phone under Hermes. `align()` returns `rereadingAt` while the reader re-reads behind the pointer; call `align(words, heard, heard.length)` for the final alignment at session end. Parameters: `RESYNC_AFTER` 3, `NEAR_SENTENCES` 2, `CARRY_ON` 2, `MAX_ANCHOR` 6, `SETTLE` 2.
- Plan steps 1, 2, 3 and 5 are free. Step 4 is free once: the first saved script session that reached 80% of part 1 or its last sentence (`countsAsRun`, `freeRunUsed` in `pro.ts`); an earlier Finish asks first and saves nothing. Every way into a script part goes through `canRehearse()` in `session/[id].tsx`. Deleting the script doesn't give the run back; Reset all data does. The full paywall shows once, as the reader leaves that run's Tape (`ahaPaywallShown`); everything after is a soft wall. Step 3 can link a script you already saved ("Use a script you've saved"). Corrections are logged at Finish, only for words the recogniser never inked (`keptCorrections`).
- `patches/expo-speech-recognition+58.0.0.patch` makes iOS check on-device support for the locale we listen in (the library only checked the device default, and iOS silently falls back to the server). Android's on-device check still ignores locale. Re-check the patch when upgrading the library.
