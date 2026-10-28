# Strategy (cofounder review, 2026-10-27)

Written after a full read of the codebase. Quinton asked for blunt, ambitious feedback. This is the
"why" behind the roadmap. CLAUDE.md is the "how". If they disagree, raise it with Quinton.

## What Mouthful is for

Help people speak better out loud for a real moment: **fewer filler words, steadier pace, better
emphasis**, and knowing what they'll say. Glide (words ink in as you speak) is the core mechanic and
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

## Resume here (paused 2026-10-28)

- **In progress:** speech-engine fixing qa-critic's 6 resync findings (S1 refrain "start again" jumps to the closing line and auto-finishes; S1 stutter after a dropped word turns said words red; S2 one interim revision makes the cursor retreat up to 19 words; S2 asides quoting later words pull the cursor ahead; S2 3.6–5.3 ms per call on 300–500-word scripts, target ≤1 ms; plus an additive `align` field so the screen can tell a re-read). Stopped mid-way. WIP (failing tests + partial align.ts) is on branch `wip/resync-qa-fixes` (GitHub), with qa-critic's repro scripts in `wip/qa-resync/`. Restart speech-engine from that branch with the same brief; don't merge the WIP as is.
- **Then:** mobile-engineer suppresses "Pick up from…" and pause counting while re-reading (uses the new field); logs a tapped word later inked by backfill as a correction only once; investigates the pre-existing "A network error occurred." on the web Day 1 screen. Then qa-critic attacks the resync again.
- **Then:** the Mac. Xcode is installed on Quinton's MacBook Air (M2). Check the Xcode/macOS that Expo SDK 58 needs, clone the private repo, `npx expo run:ios --device` with a free Apple ID (7-day signing), rebuild for Sentry's native code. Apple Developer signup still pending.

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
