# Brief: Aha before paywall

Product-lead, 2026-10-28. Approved by Quinton. Phase 0 feature work, allowed because Quinton accepted the risk:
the beta script tests where the paywall sits, so it must be in place before testers.
Owner: mobile-engineer (one wave). Reviewer: qa-critic.

## Problem

A new user reads a café passage and then gets the full paywall (`onboarding/day1.tsx`). The aha is watching
your own answer ink in, which is plan steps 3–4, both Pro (`moments.ts`, `PlanCard.tsx`, the scripts tile in
`(tabs)/index.tsx`). Cold read is locked twice: a 7-day streak, then Pro. That reads as bait.

Evidence: a hunch (STRATEGY hard truth #3, bet C). No beta data, and the old paywall was never measured.

## The change

1. **Free:** one saved script, plus **one completed Glide of its part 1**. Plan step 3 becomes free. Step 4 shows
   "Your first run is free". Steps 1, 2 and 5 stay free.
2. **Pro:** any further rehearsal (repeats, parts 2+), a second script, the library, Fix-it, Pro packs, cold read
   outside the plan, full history.
3. **The free run is used up** by a saved session on any `s.*` passage, worked out from saved sessions (no new
   state). Too-short sessions, Try again and Carry on don't use it (principle 8). Deleting the script doesn't give
   it back; Reset all data does, and we accept that.
4. **Cold read:** remove the streak lock and `COLD_READ_STREAK`. The tile shows a Pro badge like Scripts, gated only
   by `requirePro('cold')`.
5. **Onboarding:** Day 1 Continue goes straight to Today. No paywall at the end of onboarding.
6. **The single full paywall** opens once, when the reader leaves the Tape of their free run (Done, close or Again),
   never on top of the Tape, so they see their result and can tap "I said it" first. After that, only soft walls.
   `trialOffer` unchanged. Not now and close always just close.
7. **Copy after the free run** (numbers only, recomputed after corrections):
   - Headline: "You just rehearsed your own {moment.short ?? 'script'} at {wpm} wpm."
   - Lead: "{words} words, {heard} heard clearly." With a date: "{days} days to go. Rehearse every part until it's yours." Without: "Rehearse every part until it's yours."
   - Benefits: "Rehearse every part, as often as you need" · "Add every answer you're preparing" · "Drill the words you trip on".
   - New `UPSELL.rehearse`: "Rehearse it again" / "Your free run is done. Rehearse every part as often as you need before the day."
   - `UPSELL.scripts` line: "Your first script is free. Add every answer you're preparing."

## Acceptance criteria

1. Given a new free user, when they finish Day 1, then Today shows with no paywall. (`onboarding/day1.tsx`)
2. Given a free user with an Interview moment, when they tap step 3 and save a script and then tap step 4, then part 1
   opens in Glide with no wall, and step 4 reads "Your first run is free". (`content/moments.ts`, `PlanCard.tsx`, `scripts/new.tsx`)
3. Given that free run is finished, when the reader taps Done (or close, or Again) on its Tape, then the paywall opens
   once with the headline from their wpm and word count, and no script text appears in any `track()` call. Not now
   closes it; reopening that Tape doesn't open it again; the trial line only appears when `trialOffer` returns an
   offer. (`tape.tsx`, `paywall.tsx`, `store/profile.tsx` `ahaPaywallShown`)
4. Given a free user whose session ended too short, when they tap Try again, then the run is still free and no paywall
   shows. (`session/[id].tsx`)
5. Given the free run is used, when the reader opens any script part (PlanCard, `scripts/[id]`, Tape Again, deep link),
   then the `rehearse` soft wall opens. One check in `session/[id].tsx` calling `canRehearse()` in `src/pro.ts`. (`test/freeRun.test.ts`)
6. Given a free user who already has one script, when they tap "Paste a script", then the `scripts` soft wall opens.
   The Today Scripts tile opens the scripts list for free users. (`scripts/index.tsx`, `(tabs)/index.tsx`)
7. Given a free user with a 0-day streak, when they tap Cold read, then the `cold` soft wall opens, with no lock icon
   or meter. A Pro user goes straight in. (`(tabs)/index.tsx`, `pro.ts`)
8. Given the new events fire, when their properties pass through `sanitise`, then every string property is an
   allowlisted code, and a test proves a script title passed as a property is dropped. (`analytics.ts`, `test/`)

None touch `src/engine` or `src/speech`.

## Analytics

Existing allowlisted keys `from`, `feature`, `moment`, `source`; add both new names to `EventName`.

- `free_run_complete` {moment, words, parts, wpm, stumbled, minutes_since_day1}: new
- `paywall_view` adds `from`: `aha` | `soft` | `you`
- `paywall_close` {from, feature, seconds}: new
- `purchase_attempt`, `purchase_result` add `from`
- `script_saved` adds `free: boolean`

## Metric

Primary: trial starts at the post-free-run paywall, x of 10 testers (directional; no old number). Guard: step-3
reach (`plan_step_done` step=script) shouldn't fall.

## Risks

- One huge unpunctuated "part" makes the single free run cover everything. Log `words` on `free_run_complete` first.
- One free run is enough, so nobody converts. If most testers reach the aha but 0–1 of 10 start a trial, the free
  amount is wrong, not the timing. Open question: unlimited runs of part 1 instead of one.
- App Review (3.1.1 metered free content is fine): "Your first run is free" must show before they start.
- Users with no script never see the full paywall. Deliberate; watch `paywall_view` from `you`.

Out of scope: Moment Pass, Fade mode, chunker changes, engine work.

## Revision (2026-10-29, after qa-critic)

The free run counts only when Glide reached 80% of part 1 or its last sentence (`countsAsRun`). Finishing earlier asks: "Finish now? Your free run counts when you reach the end of part 1. If you stop here, this read isn't saved and your free run is still yours." (Keep reading is the default.) Part 2+ wall: "Your free run is part 1. Rehearse every part with Pro." The aha paywall also opens once after a swipe-back, and on Today if the app was killed on the Tape.
