# Brief: onboarding redesign (the first 60 seconds)

design-ux, 2026-10-30. Mockups: `docs/design/onboarding/` (390×844, light and dark), contact sheet
`docs/design/sheet-onboarding.png`. Owner: mobile-engineer. Reviewer: qa-critic, then design-ux on device.

## Problems, worst first

1. **[S0] Denying the mic traps the reader in onboarding.** `onboarded` is only set in `onboarding/day1.tsx`;
   MicGate's "Not now" returns to the mic step and the tabs redirect back to onboarding. No way through
   (principle 8). Fix: "Skip for now" on the mic-denied screen sets `onboarded` and goes to Today with the plan
   saved. **(S, do first.)**
2. **[S1] The date is never asked.** The moment step saves `{ id, startedAt }` with no date, so Today says
   "Preparing for your interview", not "in 3 days". The countdown is our edge. Fix: date chips from `moment.tsx`
   on the same screen as the moment. (S)
3. **[S1] Too much reading before the first word inks.** 6 taps and ~165 words of UI copy (40–50 s for an ESL
   reader). The mic screen alone has ~80 words; privacy is explained four times. Fix: one privacy line and one
   plain warning before the system dialog. (S)
4. **[S2] The Day 1 result overclaims and the "Day 1" frame doesn't fit.** It shows "Accuracy %" and a Fillers
   tile that's often "0", promises day 7/30 re-tests to someone whose interview is in 3 days, and pre-selects a
   reminder. Fix: pace + "71 of 78 words heard clearly", no pre-selected reminder plus a "No reminder" chip,
   "Read it again". (M; `day1Line` copy is speech-engine's)
5. **[S2] No back between steps; questionnaire-style options.** Steps share one route with no back (Android back
   leaves the app); "Everyday speaking" is a fifth tile that leads nowhere; "trip you up" is an idiom; brand name
   and button are both cobalt (two accents). Fix: back arrows, the fifth option as a quiet link, plain copy,
   brand name in ink. (S)

## New flow (exact copy)

1. **Hook:** the tagline inks in. "Learn the words you need, then say them out loud. They ink in as you say
   them." · **Get started** · "No account needed."
2. **Moment and date:** "What are you preparing for?" · 4 tiles · "When is it?" Today / Tomorrow / In 3 days /
   Next week / In 2 weeks / Not sure · **Make my plan** · link "Nothing planned? Just practise"
3. **First read:** dark card "Your interview is in 3 days" / "5 short steps. The first one takes 30 seconds." ·
   "First, a 30-second read" · one privacy line · "Keep a recording of this read" (off) · "Your phone will ask to
   use the microphone." · **Start reading**
   - **3b. Mic denied:** "SaidClearly can't hear you yet" · "Your plan is saved. You can do this read later from
     Today." · **Open Settings** · "Skip for now"
4. **Glide:** a still line until the first word inks: "Read out loud at your normal pace. The words turn dark as
   you say them." It disappears without animation (principle 6).
5. **Starting point:** "142 words a minute" · range line · "Heard clearly: 71 of 78 words" · "Phones miss some
   words, especially with accents." · "Remind me to practise" (hidden if the date is today or tomorrow) ·
   **See my plan** · "Read it again"
6. **Today:** plan card with the date; hide the streak pill until day 2.

Before → after: first inked word 6 taps / ~165 words / 40–50 s → 7 taps / ~75 words / ~25 s (the extra tap is
the date, which is the hook). To Today: ~10 taps / 110 s → 9–10 taps / ~85 s. Not mocked: 375×667 and the largest
Dynamic Type (on small screens, screen 2 scrolls above a pinned button).

## App Store slides (`docs/design/store/`, 1320×2868)

1. "Rehearse what you'll say": interview answer inking in mid-read (interviews, "practise them out loud").
2. "Find the words for any subject": Finance Word Pack (vocabulary by subject).
3. "Said it? Tap it.": red dotted word + callout (honesty). Callout must say "marked as skipped".
4. "Ready by the day it counts": plan card counting down, "Your first run is free".
5. "Say it clearly, no script": One Minute. **Only once One Minute is out of tester mode** (guideline 2.3.3:
   screenshots must show the live app); until then use slide 6.
6. "Asks before your voice leaves": first-read screen, recording switch off. Spare: the Tape, "Then practise the
   hard words".

Fix before upload: pack titles in sentence case ("Run the meeting"); the icon's amber bar vs the in-app cursor
colour.
