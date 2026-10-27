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

## Before each tester

- You tab → tap the version line 7 times → turn on **Tester mode**. Every reading session is now
  recorded and what the phone heard is kept, **on this phone only**.
- Tell the tester that, and get their OK to record. Recordings never leave the phone.
- Reset all data between testers *after* you've copied their numbers (it deletes the recordings too).

## The session (about 10 minutes)

1. Hand them the phone on the first onboarding screen. Say only: "Try it and think out loud."
2. They pick a moment and do the Day 1 read.
3. Plan step 1 (Learn the words) and step 2 (Say them in context).
4. One more passage from the Library, then one Free talk.
5. Don't help. Write down where they hesitate and what they say.

## Review (after they leave, about 5 minutes per session)

You tab → Tester mode → **Review sessions**. For each reading session:

1. Play the recording and follow the passage on screen.
2. Tap every **red** word you hear them say. These are the errors that matter most: the app
   was wrong and the reader didn't catch it.
3. Tap any **green or underlined** word they did *not* say (the app, or the reader, was too generous).
4. **Done reviewing.** When all of a tester's sessions are done, **Copy numbers for the sheet** and paste
   into the beta spreadsheet. Only numbers are copied, never words or transcripts.

## What we measure

| Metric | Where it comes from | Watch for |
|---|---|---|
| **False red words per 100 passage words** | Review screen: reader corrections + uncaught errors − wrong corrections | Accented readers vs. others. This is the number that decides what we do next. |
| Uncaught errors | Red words you heard on the recording that the reader didn't fix | If high, readers are blaming themselves for the app's mistakes. |
| False green per 100 | Green words that weren't said | High means matching is too loose (lookahead or the one-letter allowance). |
| **Correction frequency** | "Reader caught %" in the export, and `recognition_correction` events | Readers fixing a lot is annoying even when it works. |
| **Speak-to-highlight delay** | "First-word lag" (voice detected → first word inks), plus your own eye: did the highlight keep up, lag, or jump ahead? | Over about 800 ms feels broken. Note the phone model. |
| **Voluntary return** | Did they open it the next day, unprompted? Ask them, or check `session_start` the next day. | The habit loop. |
| Confusion | Your notes. Their words, not yours. | Anything two people stumble on is a bug. |

## Decide

- **False red above about 2 per 100 words for accented readers:** fix recognition before anything else.
  Try longer contextual hints, a looser match for long words, or a cloud pass after the session
  (needs its own consent).
- **Lots of uncaught errors:** make "tap to fix" more obvious, and soften how red words look.
- **First-word lag over about 800 ms, or the highlight visibly lags:** profile the session screen before
  adding anything.
- **Most people don't come back on day 2 without a reminder:** the habit loop needs work. That matters
  more than any feature.

## After 20–30 TestFlight users

Look at day-7 retention (people who finish a session on day 7) and how many reach step 3 of a plan
(where Pro starts). **With 20–30 people these numbers are directional only.** One or two people change
the percentage a lot, so use them to spot a problem or a promising sign, not to prove anything. As a
rough guide: well under 10% at day 7 means rethink the habit loop before scaling; a clearly healthy
number means it's worth recruiting a bigger second round.

## After the beta

Turn Tester mode off and delete recordings (You tab) on every test phone.
