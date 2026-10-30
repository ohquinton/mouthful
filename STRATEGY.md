# Strategy (cofounder review, 2026-10-27)

Written after a full read of the codebase. Quinton asked for blunt, ambitious feedback. This is the
"why" behind the roadmap. CLAUDE.md is the "how". If they disagree, raise it with Quinton.

## What Mouthful is for

Help people, many of them speaking English as a second language, speak better out loud: **clearer
articulation, fewer filler words, steadier pace, better emphasis, a wider vocabulary in the subjects they
need**, and knowing what they'll say. Tagline: "Find the words. Say them clearly." The promise is broad
(interviews, presentations, everyday English practice, vocabulary by subject); the store listing still leads
with one concrete moment, because a new app wins by being sharper, not broader (ELSA, Stimuler and BoldVoice
own "improve your English"). Articulation here means clear and fluent,
never "sounding native" (principle 1: we measure what the phone heard, not pronunciation). Glide (words ink in as you speak) is the core mechanic and
the marketing asset: a 7-second screen recording of it explains the app.

## Verdict

Excellent craft, too-small strategy. Today it is a careful, honest **teleprompter with a score**.
As built, the ceiling is a lifestyle app (~$20k/yr at the old 500-subscriber goal).

## Keep

- **Glide**: legible in 5 seconds, demoable on video.
- **Moment + date**: "my interview is Thursday" is the right monetisation instinct.
- **Honesty principles**: no fake pronunciation grades, reader overrules the recogniser, on-device privacy.
- **Code quality**: pure tested engine, real privacy design.

## Hard truths (worst first)

1. **It trains the wrong skill.** Nobody reads their answer off a screen in the interview. Every loop,
   including the "Final run-through", is reading. The job is saying it *without* the script.
2. **The 7-day trial gives the product away.** Someone with an interview in 3 days starts the trial,
   gets everything they need, and cancels. The most motivated buyers never pay.
3. **The paywall comes before the aha.** Day 1 is a café passage, then a full paywall. The aha is
   seeing *your own* script glide (plan step 3), which is locked.
4. **"No AI" is a principle being used as a strategy.** Google Interview Warmup is free; ChatGPT voice
   will role-play an interviewer; Yoodli, Poised and Orai have AI feedback. Keep on-device as the
   default, but consider opt-in AI feedback (e.g. "you didn't state the result in your STAR answer")
   with its own consent.
5. **Process before users.** Six agent briefs and ~1,900 lines of process docs, and the app had never
   run on a phone. Put real people on it.
6. **$40/yr consumer speaking apps are capped.** $1M/yr ≈ 25,000 annual subs. Big outcomes come from
   a desperate dated niche or B2B.

## Bets, in priority order

1. **Fade mode.** Each rehearsal hides more of the script: full text → every third word blanked →
   first letters → keywords → blank. You speak from memory; Glide still follows because `align()`
   matches against hidden words. Sells "know your answer cold by Thursday", not "read better".
   Most of the engine work already exists.
2. **Moment Pass.** ~$9.99 for 14 days of everything, no trial, beside the annual plan. Matches how
   people buy for an event and fixes truth #2.
3. **One script free.** Free users paste a real script and Glide one part of it; gate repeats,
   Fade mode and multiple scripts. Paywall after the aha.
4. **Speaking-test wedge.** CELPIP (Canadian immigration), IELTS and TOEFL speaking: dated, urgent,
   high-budget moments for exactly the ESL users the app already targets. Fits the moment/plan system.
5. **B2B later.** Career centres, bootcamps, ESL schools, employers onboarding ESL hires. One
   institutional deal can beat 500 consumer subs.
6. **Distribution.** The shareable "Day 1 vs Day 14" Glide clip, seeded with interview-tips and ESL
   creators on TikTok / Shorts. No paid ads until organic works.

## The three skills: where the code stands

| Goal | State | Plan |
|---|---|---|
| Fillers | Only um/uh/erm scored; on-device recognisers drop them; like/so/you know never scored (principle 7). Weakest part. | **Open decision:** score habit words in Free talk only (no script, so not rephrasing). Recommended yes. Needs Quinton's sign-off because it changes principle 7. |
| Pace consistency | **Done 2026-10-27:** `engine/steadiness.ts` + `PaceStrip` on the Tape. Not in the score yet. | Validate against beta recordings (recogniser bursts add noise) before scoring it. |
| Emphasis | Not measured. | Loudness on key words from `volumechange` events (~8/s). After the beta proves the basics. Pitch would need native work. |

## Done 2026-10-27

- git repo created; deps installed; 71 → 96 tests, typecheck clean.
- Daily passage/prompt roll over at local midnight, not UTC.
- Speech locale: listens for the reader's English (phone region, or chosen in You). Patched
  expo-speech-recognition so iOS checks on-device support for that locale (it used to silently send
  audio to Apple's servers when the locale couldn't run on-device).
- Pace steadiness on the Tape.
- Agent team rules in CLAUDE.md.

## Open decisions for Quinton

- Moment Pass pricing and whether to keep the annual trial.

Decided 2026-10-27 (see DECISIONS.md): habit words stay unscored in Free talk; Fade mode waits for
the Phase 1 gate and starts as two levels (full text → keywords). Both are in PARKED.md.

## Next steps

1. qa-critic review of the 2026-10-27 commits; fix findings.
2. Push to a private GitHub repo.
3. Apple Developer account → first development build → test on the iPhone (nothing has run on a device yet).
4. After Phase 1: Fade mode (2 levels) if false red ≤ ~2/100 for accented readers; watch word if the hand-tally supports it.
5. Beta with 10 readers (half ESL), per TESTING.md. Ask each: "Would you pay $10 to use this before your next interview?"

**Competitors (2026-10-29, docs/COMPETITORS.md):** Perora (free, nearly our feature set) and Sayglide (free voice-follow) mean follow-the-voice and on-device aren't moats. Our edge: the dated moment plan, honest recognition, per-context delivery feedback, honest pricing. Open dilemmas: docs/DILEMMAS.md.

**Review mining (2026-10-29, docs/MARKET-RESEARCH.md):** billing is the category's #1 pain (621 of 2,863 reviews); memorising to a date is the strongest love signal; only 14 reviews mention interviews (presentations 49, lines 38), so interview demand is unproven: recruit presenters for the beta too and don't lock the headline to "interview".

## Resume here (paused 2026-10-28)

- **In progress:** speech-engine fixing qa-critic's 6 resync findings (S1 refrain "start again" jumps to the closing line and auto-finishes; S1 stutter after a dropped word turns said words red; S2 one interim revision makes the cursor retreat up to 19 words; S2 asides quoting later words pull the cursor ahead; S2 3.6–5.3 ms per call on 300–500-word scripts, target ≤1 ms; plus an additive `align` field so the screen can tell a re-read). Stopped mid-way. WIP (failing tests + partial align.ts) is on branch `wip/resync-qa-fixes` (GitHub), with qa-critic's repro scripts in `wip/qa-resync/`. Restart speech-engine from that branch with the same brief; don't merge the WIP as is.
- **Build queue** (start the next one the moment a builder finishes; quality over speed):
  1. speech-engine: resync QA fixes (running) → merge → qa-critic re-attacks the resync.
  2. mobile-engineer: app fixes + aha QA fixes (running) → merge → qa-critic reviews.
  3. mobile-engineer: re-read handling on screen (no "Pick up from…", no pause counted) using align's new re-read field.
  4. marketing-lead: competitor teardown (Sayglide, Sayso, Dry Run, DryRun, OffBook, Run Lines): what they do, where we're truly different, what that changes in STRATEGY.
  4b. speech-engine (B): habit-word classifier (`src/engine/habits.ts`), labelled corpus, precision/recall report (running).
  4c. speech-engine: make the resync speed test (resync.test.ts §10e) robust to a busy machine: it fails in parallel Jest on a loaded laptop and may flake on CI. Options: measure per-call median over many runs with a CI-aware ceiling, or move it to a separate perf script that CI runs serially.
  5. speech-engine: beta sheet carries listener restarts/glitches (`reviewRow` in review.ts) + exact steadiness timing via heard-token counts if the beta shows it matters.
  6. brand-namer: round 2 from marketing's direction (docs/DILEMMAS.md #1) (running).
  6b. One Minute (docs/briefs/one-minute.md): after habits.ts merges, speech-engine builds `engine/minute.ts` (Flow), then mobile-engineer replaces Free talk with One Minute behind tester mode.
  6c. mobile-engineer: pre-beta steals: honest billing copy + "Cancel in Settings" on the paywall, rating-prompt timing rule, target-length lights, Scan Text tip (running).
  6d. speech-engine: minute.ts free thinking ~8 s + `timeToFirstWord` in the summary and trend (DILEMMAS #15); then mobile-engineer: show "You started after N s" on the One Minute Tape with its coaching line.
  6e. mobile-engineer: target length per DILEMMAS #16 (no per-part lights; whole-answer target in the final run-through; paste-time "runs about 3:10" warning; custom target field on scripts).
  6f. main session: rename to SaidClearly in src/brand.ts once brand-namer clears it.
  6g. mobile-engineer: onboarding redesign (docs/briefs/onboarding-redesign.md). The S0 mic-denied trap first, then the date, then the copy.
  6h. mobile-engineer, One Minute follow-ups (qa-critic, before it replaces Free talk for everyone): (S2) Progress shows the old Free talk `score` for minute sessions while the Tape shows Flow: show Flow there or leave minutes out of score bests (progress.tsx:57, talk.tsx:198); (S2) after Carry on the restart gap is closed in the stamps but the clock only shifts by `away`, so a full minute ends at Kept going ~58: shift the clock by the closed gap (talk.tsx:109, store/minute.ts:41); (S2) test/prompts.test.ts time-zone test is tautological: make it able to fail; (S3) idioms "could have gone either way" (MinuteResult.tsx:121), prompt p26 "Pitch…", p31 "thirty-second update", p33 "on Monday"; trend copy "your last 3 minutes" → "your last 3 One Minute talks" (store/minute.ts:151,153); "(it misses some)" parentheses; check long level-3 prompts on the Today tile at SE size.
  7. product-lead: emphasis coaching brief (third core goal), ready for after the beta gate.
  8. design-ux: onboarding critique and redesign brief (first 60 seconds), then a full visual pass once it runs on the iPhone.
- **Then:** mobile-engineer suppresses "Pick up from…" and pause counting while re-reading (uses the new field); logs a tapped word later inked by backfill as a correction only once; investigates the pre-existing "A network error occurred." on the web Day 1 screen. Then qa-critic attacks the resync again.
- **Open decision (name):** docs/NAME-CHECK.md. US risk medium (Foundry One's "Mouthful: Voice to To-Do List", Education, since March 2026). Keep Mouthful for the beta; decide before any branding spend or public launch. Name lives only in src/brand.ts.
- **Then:** the Mac. Xcode is installed on Quinton's MacBook Air (M2). Check the Xcode/macOS that Expo SDK 58 needs, clone the private repo, `npx expo run:ios --device` with a free Apple ID (7-day signing), rebuild for Sentry's native code. Apple Developer signup still pending.

**Polish list** (after launch-critical work; never block new building on these): Drop mascot pilot in Rive; quiet animations from docs/design/ANIMATION.md; App Store slide fixes (sentence-case pack titles, icon amber vs cursor colour); privacy policy and site text to say SaidClearly; Taste-rule pass over existing screens.

## Wave 4 backlog (qa-critic, 2026-10-27: no S0/S1; fix the S2s before the phone beta)

- S2: Finish while the `interrupted` card is up saves a session that counts the call as reading time (wpm ~20). Hide Finish while failed, or shift the clock like the consent gate (`session/[id].tsx`, src/app).
- S2: `interrupted` (call, Siri, alarm) throws the read away; add "Carry on" that restarts and keeps the transcript, like `pausedForConsent` (src/speech + src/app).
- S3: glitch cap could end a silent read on spurious iOS 1101/1107 right after a restart; count error codes on device before trusting it (src/speech).
- S3: `test/globalSetup.js` forces Toronto, so no CI run in a zone without DST; respect an explicit TZ or add a second CI job (main session).
- S3: analytics queue unbounded before the profile loads; cap ~100 (src/analytics.ts).
- S3: Reset all data turns analytics back on for someone who opted out, silently (product-lead decision).
- S3: listenerHook tests: 3 glitches over >10 s, needs-consent surviving end, the gateOpenedAt shift.
- Release: repo is PUBLIC; decide private + separate public `mouthful-site` for the policy. privacyUrl in brand.ts is still example.com.
- Design-ux copy still to apply (next mobile pass): MicGate "unavailable" dead end (title, Open Settings, Not now); paywall errors in ink not red, restore copy, legal links 44 pt and sentence case, price larger than the headline number; You → Privacy as three short lines, switch row copy, VoiceOver label "Keep Day 1 and re-test recordings"; consent title "This phone needs help to follow you"; restore/Not now accessibilityRole; tester-off prompt split in two. Plus Reset keeps the analytics opt-out (DECISIONS 2026-10-28).
- Sentry (release-privacy spec, 2026-10-28): `npx expo install @sentry/react-native`, plugin `@sentry/react-native/expo` in app.json, `getSentryExpoConfig` in metro.config.js, `SENTRY_AUTH_TOKEN` as an EAS secret, DSN in `EXPO_PUBLIC_SENTRY_DSN`. Init: enabled only with a DSN and no analytics opt-out; sendDefaultPii false; no screenshots, view hierarchy, replay, feedback, tracing, logs or session tracking; maxBreadcrumbs 0; beforeBreadcrumb → null; beforeSend drops breadcrumbs, user, extra, request, contexts.culture and device.locale, caps exception values at 200 chars, and drops any event with transcript-like text (> 8 words). Sentry project: "Prevent storing of IP addresses". Never capture listener or user strings, only fixed codes (`words.tsx:85` passes the reader's missed words as a route param). One switch: "Share anonymous usage counts and crash reports". Add a "Crash reports" section to docs/privacy.md when it ships.
- Sentry (shipped 2026-10-28, needs a native rebuild). DONE 2026-10-28: Quinton set in Sentry → mouthful-app → Settings → Security & Privacy: "Prevent storing of IP addresses" ON, and Advanced Data Scrubbing rules Remove `$contexts.culture` and `contexts.device.locale` (native crashes skip the JS scrubber). "Crash reports" section published to mouthful-site. SENTRY_AUTH_TOKEN as an EAS secret for source maps.
- Done: RevenueCat project, `pro` entitlement, `default` offering, iOS app via the MCP (store products wait for the Apple Developer account).

## Smaller bugs noted, not yet fixed

- Cold read is gated twice (7-day streak, then Pro): reads as bait (`app/(tabs)/index.tsx`).
- Reminder id is still `cadence-daily-read` (`reminders.ts`).
- Jest prints a leaked-timer warning (likely the analytics flush timer).
