# Brief: One Minute (one word, sixty seconds, a Flow rating)

Product-lead, 2026-10-29. Owners: speech-engine (engine), then mobile-engineer (screens). Reviewer: qa-critic.
Phase: engine buildable now (pure, no device) if Quinton accepts it in writing; Flow UI behind tester mode in
Phase 1; ships in Phase 2 if the data holds.

**Amendment (main session, 2026-10-29):** the brief was written before DECISIONS 2026-10-29 (habit-word
classifier). Habit-word fillers from `src/engine/habits.ts` are a planned Flow input: shown as "likely
fillers" with "I meant that" overrule until they pass ≥ ~90% precision and the beta tally, then scored.

## Problem

A dated interview means talking without a script, but every loop today is reading (STRATEGY hard truth 1).
Free talk gives a minute on a prompt, but scores it like reading: fillers weigh heavily and the phone
undercounts them. Nothing says "you kept going", which is what fluent speech means for a nervous ESL speaker.

## Decisions

1. **Name and place: One Minute.** Replaces Free talk's prompt of the day (same `/talk` route and Today tile,
   renamed). No separate streak. Not a plan step yet.
2. **Prompts:** 36 curated in `src/content/prompts.ts`, `{ id: 'p01'…, level: 1|2|3, text }`, 12 per level:
   1 concrete ("coffee", "rain", "your phone"), 2 abstract ("trust", "time", "risk"), 3 short work topics
   ("a mistake you learned from"). No idioms, holidays, sport or local brands. Rotates by `localDay`;
   "Different word" stays. Today's 12 prompts fold into level 3.
3. **Rating: "Flow", 0–100** (not "articulation": we hear whether you kept talking, not how you sound):
   - Kept going (40%): seconds from start to the last heard word, out of 60.
   - Long pauses (35%): gaps > 2.5 s between heard words after the first word; each costs 25 points
     (4+ = 0). Thinking time before the first word is excluded.
   - Pace (25%): `paceScore(wpm, 'talking')`, band 120–170.
   - um/uh shown next to Flow, not counted, labelled "um/uh the phone heard: 2 (it misses some)". They come
     back in only if the Phase 1 tally shows the app catches ≥ ~70%.
   - Staying on the word: killed (punishes good tangents and synonyms).
   - Under the number, always: "Flow is whether you kept talking. It isn't a grade of your accent or your English."
   - One coaching line, in order: stopped before 45 s → "You stopped at 34 s. When you run out, say what
     you'd add with more time."; 3+ long pauses → "When you lose the thread, say the word again and one thing
     it reminds you of."; above 185 wpm → "Breathe between ideas."; else "You kept going the whole minute."
   - Over time: only against the median of your own last 5 minutes, once there are ≥ 3.
4. **Free vs Pro:** all free (the day-2 habit loop). History: 7 sessions free, full for Pro.
5. **Analytics:** no new events. `session_complete` gains `kind: 'minute'`, `which: 'p07'`, `level`, `flow`,
   `long_pauses`, `longest_pause_s`, `talk_seconds`, `wpm`, `fillers_per_min`. Never the watch word or text.

## Acceptance criteria

speech-engine (`src/engine/minute.ts`, `__tests__/minute.test.ts`; useListener unchanged):
1. Heard times with a 4 s gap before the first word and two 3 s gaps after → `longPauses()` = count 2, longest 3.0 s.
2. Talks to 60 s, no long pauses, 140 wpm → `flowScore()` = 100; adding 4+ fillers/min doesn't change it.
3. Stops at 30 s → `minuteLine()` returns the stopped-early line with the seconds; no line contains
   "pronounc", "accent" or "correct".
4. < 3 past minutes → `minuteTrend()` = null; else compares against the median of the last 5 (only sessions with `flow`).

mobile-engineer (`src/content/prompts.ts`, `src/app/talk.tsx`, `src/app/tape.tsx`, `src/app/(tabs)/index.tsx`,
`src/store/sessions.ts`), after the engine merge:

5. Two different local calendar days show their own prompt; a time zone change doesn't skip one.
6. A finished minute's Tape shows Flow, the plain-language line, um/uh with "(it misses some)", one coaching
   line; the saved session has `flow`; `score` computed as before.
7. A recogniser error or < 15 words → no Flow saved; Try again resets pauses and clock (principle 8).
8. Sanitised session events carry no prompt text, transcript or watch word.

## Metric and gate

Primary: day-2 voluntary return among testers who did a minute on day 1. Check: the app's long-pause count
vs the observer's from the recording, within ±1 per minute in ≥ 8 of 10 sessions. Smallest test: in
Phase 1, each tester does a single-word minute; the observer tallies pauses and um/uh and asks "Did that
number feel fair?".

## Risks

Gaming (nonstop talk scores 100: acceptable, fluent talk is the skill); discouraging ESL readers (thinking
time excluded, 2.5 s cut, ask "felt fair?"); single-minute noise (median comparison, nothing under 15 words);
pause timing uses recogniser result times, not voice, so server bursts may invent pauses (check against
recordings; switch to voice-level silence if off).

## Found along the way

Free talk counts the silence before the first word as a pause (`useListener` stamps `lastHeardAt` at start;
`talk.tsx` counts the start-to-first-word gap). It biases against slow starters. Fix with One Minute.
