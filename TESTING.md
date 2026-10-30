# Controlled phone beta

**Goal:** find out whether Glide is trustworthy for real readers, especially readers with accents,
before building anything else. No public launch and no new features until this is done.

## Order

1. **You first.** Install the development build on your own iPhone (README). Check recognition, the
   live highlight, recording and playback, the voice ribbon, and the mic permission flow. Read one
   passage badly on purpose (skip words, say "um") and check that the results look right.
2. **10 readers**, at least 5 who speak English as a second language, with different accents. Mix fast
   and slow readers. Friends and coworkers are fine, as long as you don't coach them.
3. **Review every session** against its recording (below), including errors the reader didn't notice.

## Phase 1 starts only when

Phase 0 passes: the dev build runs on your iPhone, every hand check is done, zero S0/S1 bugs, and the
interrupted-card fixes (Finish, Carry on) are in. A call mid-session would otherwise wreck that session's wpm.

## Recruiting (12 to end with 10, in 2 weeks)

Late October is co-op interview season, so many students have real interviews coming up.

- Campus career / co-op centre: ask an advisor to mention it to students booked for mock interviews.
- International student centre, the university English Language Institute's conversation groups.
- Public library English conversation circles; newcomer employment programs (ACCES Employment, COSTI, YMCA newcomer services).
- One local Toastmasters club.
- r/cscareerquestionsCAD, r/newcomerstocanada, campus subreddit and Discord servers.

**Ask:** "I'm a student building an app that helps you rehearse what you'll say in an interview, out loud.
Got an interview or presentation in the next few weeks? 30 minutes, in person, with your own answer.
$20 gift card. Recordings stay on my phone and are deleted the same day."

Pay $20: fair for 30 minutes, gets strangers instead of friends, and cuts polite answers.

## Before each tester

- They send a real 60–120 s interview answer, typed. Mark **4 key points** in it on paper (situation,
  action, result, one specific number or name) and write M=4 on the sheet. No key points in advance, no recall test.
- You tab → tap the version line 7 times → turn on **Tester mode**. Every reading session is now
  recorded and what the phone heard is kept, **on this phone only**.
- Reset all data between testers *after* you've copied their numbers (it deletes the recordings too).

## The session (30 minutes, your iPhone, Tester mode on)

- **0–3 Consent.** Say: "This phone records your voice and keeps what it heard, on this phone only.
  Nothing is uploaded. I listen back to check the app's mistakes, then delete it all today. Your answer
  stays on this phone and gets deleted too. OK?" Log `consent=Y`, the date and a tester ID (T01…).
  No names on the sheet. Accent goes in the observer columns only, never in analytics.
- **3–9 Onboarding and Day 1 read.** Say only "Try it and think out loud." Log `hl_eye`
  (keeps / lags / jumps) and count hesitations (`confusions`). Their quotes go in a separate notes doc.
- **9–17 Interview moment.** Steps 1–2 quickly. Step 3: they paste their own answer. Step 4: their first
  rehearsal (free). Log `aha` (Y/N, reached the free run).
- **About 17: the paywall** opens as they leave that Tape. Log `paywall` (tap trial / close / look at price) and
  `paywall_min`. If they close it, unlock Pro yourself, then the second rehearsal. Log `rehearsals`.
- **20–22 Phone face down.** "Say your answer to me, no script." Tick each key point you hear. Log
  `kp_recalled` (N of M) and `recall_s`.
- **22–26 Free talk, 2 min.** "Tell me about a project you're proud of." Tally each like / so / you know /
  actually live, as a habit or a real word ("I like it", "so that"). Log `habit_n` and `real_n`.
- **26–30 Closing.**
  1. "Did it ever mark you wrong when you were right?" (`felt_unfair` Y/N)
  2. "Is there a word you say too much and want to cut?" (`named_word` Y/N; the word goes in notes)
  3. "Would you pay $10 to use this before your next interview?" (`pay10` Y/M/N)
  4. If yes: "I can send an Interac request for $10 now and refund it if you change your mind. Want it?"
     (`commit` Y/N). The hypothetical is cheap; this one is evidence.
- Don't help at any point.

Day-2 return can't be measured on your phone. For testers with iPhones, register their device
(`eas device:create`) and install the dev build; otherwise day-2 return moves to Phase 2.

## Review (after they leave, about 5 minutes per session)

You tab → Tester mode → **Review sessions**. For each reading session:

1. Play the recording and follow the passage on screen.
2. Tap every **red** word you hear them say. These are the errors that matter most: the app
   was wrong and the reader didn't catch it.
3. Tap any **green or underlined** word they did *not* say (the app, or the reader, was too generous).
4. **Done reviewing.** When all of a tester's sessions are done, **Copy numbers for the sheet** and paste
   into the beta spreadsheet. Only numbers are copied, never words or transcripts.

## The beta sheet

**/review columns** (one row per reading session, pasted as is): session · words attempted · reader
corrections · uncaught errors · false red /100 · false green /100 · reader caught % · wpm · first-word lag ms · reviewed

**Observer columns** (one row per tester): tester_id · esl (Y/N) · accent (self-described) ·
days_to_moment · consent · hl_eye · confusions · aha · paywall · paywall_min · rehearsals · kp_M · kp_recalled · recall_s ·
habit_n · real_n · felt_unfair · named_word · pay10 · commit · returned_d2

## Gates

Pool raw counts, never average percentages, and show each tester's row next to the pooled number.

| Gate | Computed as | Decision |
|---|---|---|
| **False red, accented readers** | Σ false red ÷ Σ words attempted × 100 over ESL testers' reading sessions. Also list any single tester above 4. | **≤ ~2:** Fade mode (2 levels) returns. **Above 2:** recognition work first. |
| Uncaught errors | pooled reader caught %; testers with uncaught errors | Caught % below 50%, or uncaught errors from 3+ testers: tap-to-fix and red-styling brief. |
| First-word lag | each tester's median lag; `hl_eye` | Any median over 800 ms, or lags/jumps for 3+ testers: performance work first. |
| Watch word | Σhabit_n ÷ (Σhabit_n + Σreal_n); `named_word` | Above 50% **and** 3+ of 10 named a word: watch word returns. |
| Fade demand (supporting) | `kp_recalled` after two rehearsals | Most recall 2 or fewer of 4: confirms reading isn't the skill people need. |
| Pay | x of 10 `pay10`=Y; x of 10 `commit`=Y | 3+ commits: Moment Pass brief. |

## Kill or pivot

- **False red for accented readers still above ~4/100 after two rounds of recognition fixes:** live Glide
  isn't trustworthy for the core audience. Pivot to a review after the session (a cloud pass with its own
  consent), or accept that ESL readers aren't the market. Don't paper over it.
- **0–1 of 10 commit $10 with a real moment days away:** consumer pricing doesn't work. Test B2B with the
  same career centre, or stop.
- **Most say reading it doesn't help them say it without the script:** Fade mode becomes the product, not a Pro step.
- **Several ESL testers say their real moment is CELPIP or IELTS:** move to the speaking-test wedge.
- **No one asks to keep using it or opens it again:** the problem is value, not features. Build nothing new;
  interview the testers again.

## After 20–30 TestFlight users

Look at day-7 retention (people who finish a session on day 7) and how many reach step 3 of a plan
(where Pro starts). **With 20–30 people these numbers are directional only.** One or two people change
the percentage a lot, so use them to spot a problem or a promising sign, not to prove anything. As a
rough guide: well under 10% at day 7 means rethink the habit loop before scaling; a clearly healthy
number means it's worth recruiting a bigger second round.

## After the beta

Turn Tester mode off and delete recordings (You tab) on every test phone.
