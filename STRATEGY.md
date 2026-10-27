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

## Smaller bugs noted, not yet fixed

- Cold read is gated twice (7-day streak, then Pro): reads as bait (`app/(tabs)/index.tsx`).
- Reminder id is still `cadence-daily-read` (`reminders.ts`).
- Paywall: no Privacy/Terms links (App Store rejection), trial copy ignores eligibility, icon is the Expo placeholder.
- Jest prints a leaked-timer warning (likely the analytics flush timer).
