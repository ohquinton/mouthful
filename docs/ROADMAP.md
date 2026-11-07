# SaidClearly development tree

Written 2026-11-07 from a code audit at commit 1770f10. A plan, not an order: DECISIONS.md still wins.
Items marked **DECIDE** need Quinton. Nothing here has been tried on a phone or tested with a paying customer.

**The product in one line:** someone's second attempt is meaningfully better than their first, and they can see it weeks later.

## The tree

Each stage depends on the one above it. Inside a stage, branches can be built in parallel.

```
A. MAKE THE BASE TRUE
├─ A1 Merge the three loops in progress
├─ A2 Fix stale docs: CLAUDE.md, STRATEGY, agent briefs and TESTING still describe the old product
├─ A3 Remove train leftovers from results (MinuteResult, lines.ts stops, HomeMap)
└─ A4 Remember the chosen door between launches (DECIDE)
        │
B. FINISH THE PRACTICE LOOPS (attempt → one finding → adjust → retry)
├─ B1 Make your point (agent building)
├─ B2 Say it shorter (needs B1)
├─ B3 Six everyday English situations (agent building)
├─ B4 Vocabulary recall and own-sentence use (agent building)
└─ B5 Every result screen links to one specific next exercise
        │
C. MAKE PEOPLE COME BACK (nothing else here makes money without this)
├─ C1 "Revisit later": bring back an old question and show then against now
├─ C2 Progress shows the new exercises (today it shows only readings and talks)
├─ C3 A next-practice path for each door, replacing the removed train map
└─ C4 Reminders that name the next practice
        │
D. PROVE IT ON A REAL PHONE (gate: no money work ships before this passes)
├─ D1 Development build on one phone (needs an Apple account, or an Android phone)
├─ D2 Speech, interruptions, retries, saving, reminders, Rive
├─ D3 Hand-check fillers and pauses against recordings
└─ D4 Rewrite TESTING.md around the loops, then watch 5 people, then 10
        │
E. MAKE IT SOMETHING PEOPLE CAN BUY
├─ E1 Decide what Pro sells (DECIDE; see Shortcut 1)
├─ E2 Rewrite the paywall, its trigger and the soft walls to match
├─ E3 Create store products; add RevenueCat Android key; test sandbox buy, restore, cancel
├─ E4 Add the PostHog key and build the funnel: first talk → retry → paywall → trial → paid
└─ E5 Ask testers to commit real money before launch
        │
F. LAUNCH
├─ F1 Trademark clearance for SaidClearly, before any branding spend
├─ F2 New store listing and screenshots (current slides sell rehearsal and plans)
├─ F3 Privacy policy and store privacy answers updated; policy on a real web page
├─ F4 Founding users: student, ESL and speaking groups from the TESTING.md recruiting list
└─ F5 App Store release, watching Sentry and the funnel
        │
G. AFTER REAL DATA (don't build until the data asks for it)
├─ Explain it simply, Tell the story, Pause and restart
├─ Hear → read → say, Keep the conversation going, Clarify and repair
├─ Day 1 against Day 30 audio clip, Fade mode, cloud transcription for um and uh
└─ Score habit words, only once the classifier passes its bar
```

## Shortcuts found in the current code

Worst first.

1. **Pro sells the product we demoted.** `src/app/paywall.tsx` opens with "Rehearse your real answer, talk or pitch" and "Be ready when it counts". The one full paywall fires only after a script run (`ahaPending`, `src/pro.ts:161`). Home now leads with other things, so most people may never reach it. Nothing asks for money after the core loop.
2. **No phone has run the current build.** Speech, the core of the app, is verified only in tests and browser checks. 831 passing tests do not prove the product works.
3. **No retention design replaced the train map.** Removing it was right, but it was also the only daily path. `lines.ts` still drives what results say.
4. **The door is asked again every launch.** `src/store/experience.tsx` keeps it in memory only. That is friction on a daily habit.
5. **The test plan tests the old product.** `TESTING.md` recruits for interview answers and measures Glide, so it wouldn't validate these loops.
6. **The funnel can't be measured.** The PostHog key is empty, so no paying-customer number would exist at launch. The RevenueCat Android key is empty too.
7. **Store and legal material is out of date.** Store slides sell rehearsal and plans, the privacy policy is dated 28 October and predates the new exercise records, and `src/brand.ts:13` links to a GitHub file as the privacy page.
8. **"Comfortable" overclaims** (the vocabulary agent is addressing this).
9. **Make your point copy overclaims slightly, and this one is mine.** "You said all three parts" states a self-tick as fact. Change it to "You checked all three parts" before merging.

## Ideas to add or improve

- **Paywall after the first then-against-now comparison,** the moment the product proves itself, in place of the script run. Needs testing.
- **Keep the billing trust work.** Billing and cancelling is the largest complaint in our review research (621 of the mined complaints). Clear cancel copy and the trial reminder are a selling point.
- **One saved recording per exercise, with consent,** so "then against now" can be heard as well as counted.
- **Link the content.** One situation can feed its reading, its words and its response, instead of separate catalogues.
- **Harder means less support,** not harder words: prompts, then fewer prompts, then a new question.
- **Data moves with the person.** Practice lives on one phone, so a new phone may lose it. Check device backup before launch.

## Definition of done for every feature

1. It answers: what skill, what does the person do, what feedback, what happens next?
2. After the feedback, the person knows exactly what to do differently.
3. Recovery works for mic denied, nothing heard, too short, interrupted, and leaving midway.
4. Tests pass in both time zones, typecheck and lint are clean, and analytics carry codes and numbers only.
5. An independent qa-critic reviewed it, not the agent that wrote it.
6. It lists what is measured, what is self-checked, and what is unvalidated on a phone.
