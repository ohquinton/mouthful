# Brief: remodel screens (step 4: screen brief and mockups)

**Status:** proposal for Quinton's approval. Nothing here is built. Step 5 (rebuild) starts only after he
approves these mockups, with any changes he asks for. **Owner:** design-ux (2026-11-01). **Builds:**
mobile-engineer (screens), speech-engine (two new counts, the 30-second Flow). **Reviewer:** qa-critic.
**Parent brief:** `docs/briefs/remodel-2026-11.md`. Motion follows `docs/design/RESULTS-ANIMATIONS.md`;
the Drop follows `docs/design/COACH-STATE-MAP.md` and `docs/design/ANIMATION.md`.

**Mockups:** `docs/design/remodel/*.png` (390×844 viewport, rendered @2x), overview in
`docs/design/remodel/sheet.png`. Source: `docs/design/remodel/src/gen.py` (static HTML/CSS + SVG,
screenshotted with Playwright). Re-run with `python docs/design/remodel/src/gen.py`.

| Screen | Light | Dark |
|---|---|---|
| Onboarding 1 · hook | `01-onboarding-hook-light.png` | |
| Onboarding 2 · which train? | `02-onboarding-pick-line-light.png` | |
| Onboarding 3 · first topic talk | `03-onboarding-first-talk-light.png`, `04-onboarding-first-talk-live-light.png` | |
| Onboarding 3b · mic denied | `03b-onboarding-mic-denied-light.png` | |
| Onboarding 4 · starting point | `05-onboarding-starting-point-light.png` | |
| Home · the map (day 6) | `06-home-map-light.png` | `06-home-map-dark.png` |
| Home · day 2, Clear English (station in view) | `06b-home-first-day-clear-english-light.png` | |
| Home · today's stop done | `06c-home-stop-done-light.png` | |
| Topic talk · ready / talking | `07-topic-talk-ready-light.png`, `08-topic-talk-live-light.png` | |
| Results | `09-results-light.png` | `09-results-dark.png` |
| Results · stopped early | `09b-results-stopped-early-light.png` | |
| Progress / early | `10-progress-light.png`, `10b-progress-early-light.png` | |

---

## 0. Decisions this brief proposes (shared by every screen)

### 0.1 What a stop is (needs Quinton's yes; see Open questions)

**One stop = one day's practice, and every stop ends with a topic talk.** Quinton's loop is "beat
yourself tomorrow", so a topic talk has to happen every day. The stop types are what comes *before* the
talk:

| Stop type | What you do | About | Icon |
|---|---|---|---|
| Topic talk | One minute on today's topic | 1 min | speech bubble |
| Word pack | Learn 6–8 words (hear each one), then a topic talk where you try to use 2 of them | 3 min | book |
| Cold read | Read an unseen passage once, then a topic talk | 3 min | eye |
| Glide rehearsal | Read a passage with Glide, then a topic talk | 3 min | lines |

Pattern per line (repeats, content differs): talk, pack, talk, cold read, talk, Glide, talk… Doing one stop
keeps the streak. "Do the next stop now" lets keen people go on the same day (the streak counts days, not
stops). The Flow you try to beat is always the topic talk, so the trend stays one kind of speaking
(principle 4).

### 0.2 The two line colours (proposed `theme.ts` tokens)

Neither is cobalt (the accent), amber (warning only), green (`good`) or red (`stumble`). Sharp Talk is a
berry (energy, "sharp"); Clear English is a deep teal ("clear water"). Each has a soft tint for the track
ahead and chip fills, and `onLine` for a check drawn on a filled line colour.

| Token | Light | Dark | Contrast (light: on bg / surface; dark: on bg / surface) |
|---|---|---|---|
| `sharp` | `#C2185B` | `#F06292` | 5.34 / 5.87 · 6.21 / 5.68 |
| `sharpSoft` | `#F2C9D9` | `#4A2235` | track ahead only (1.35 / 1.42 on bg, decorative; see note) |
| `clear` | `#00788A` | `#3BB8C4` | 4.71 / 5.18 · 8.00 / 7.31 |
| `clearSoft` | `#C4E3E7` | `#173C43` | track ahead only (1.23 / 1.60 on bg) |
| `onLine` | `#FFFFFF` | `#0E1017` | check on a filled stop: 5.87 / 5.18 light, 6.21 / 8.00 dark |

- All four line colours pass 4.5:1 against `bg` and `surface`, so they work as text if we ever need it,
  and easily pass 3:1 for graphics (WCAG 1.4.11).
- The soft tints are below 3:1 by design: the track ahead is decoration. What a stop *is* never depends on
  them: ahead stops have a white fill, a ring, a muted icon and a text label; done stops are filled with a
  check; the current stop is large with the icon in line colour and the Drop on it.
- **Where line colours appear:** the map, the line switcher dots, the "which train?" cards, and the small
  line strip on results. Nowhere else. Buttons stay `button` cobalt. This is the one exception to "one
  accent per screen" that the Taste rule already allows.
- **Dark mode:** `onLine` flips to the dark background colour, because white on `#F06292` is only 3.06:1.
- **Risk to watch:** `clear` (teal, hue 186°) sits near `good` (green, hue 161°). They never share a job
  on one screen (the map uses no `good`; results use `good` only for "in the range" text).
- No other new tokens. The Drop uses `button` for its body (cobalt, readable in both modes) and white eyes.

### 0.3 The Drop on these screens

Flat, two colours (body `button`, eyes white), two eyes, no mouth, no shine, never sad. Static SVG in step 5
(`src/components/Drop.tsx`, poses: rest, looking up, looking right, looking down, happy eyes, a small
tilt); the Rive version replaces it in step 6 behind the same props, with the static one as fallback.

| Where | Pose | Rule |
|---|---|---|
| Hook | rest, standing on the station where the two lines meet | the brand image |
| Which train? | looking down at the cards, small tilt | |
| Mic denied | looking up | never worried, never red |
| Talking (footer) | looking up at the topic; body pulses with `voiceLevel` (step 6) | never over the text |
| Starting point, results | next to the **coaching line**, not the number | ANIMATION.md: never beside a number it could seem to grade |
| Map | stands on the current stop, "you are here" | moves along the line after a stop |
| Results line strip | on the next stop | happy eyes after a full minute, rest after a stopped-early one |
| Progress empty | looking up | |

### 0.4 Copy rules used throughout

Sentence case, Canadian spelling (practise as a verb), plain English, no idioms in instructions, numbers
over praise, at most one exclamation mark per flow (these screens use none). The Flow fine print stays
under every Flow number: "Flow is whether you kept talking. It isn't a grade of your accent or your
English." Topic words (Coffee, Rain) and pack titles are set in Literata because they are words you say.

### 0.5 Tabs

**Home · Library · Progress · You.** "Today" becomes "Home" (the map). Library stays the shelf for every
pack, passage and script. Moments (interview, presentation, raise, meeting) move behind "Got something
coming up? Plan for it" on Home and stay reachable from Library. The tab icon for Home is a route (two
dots joined by a path), not a sun.

---

## 1. Onboarding (4 steps)

Steps: **hook → which train? → first topic talk (30 s) → your starting point → Home.** Same route and step
machine as today (`src/app/onboarding/index.tsx`: progress dashes, back arrow, Android back goes to the
previous step, `FadeInDown` 260 ms between steps, already off under Reduce Motion). The moment picker and
"When is it?" leave onboarding.

### 1.1 Hook (`01-onboarding-hook-light.png`)

**Job:** "This is for me" in 5 seconds: a daily habit that makes you sound sharper.

**Layout:** progress dashes (1 of 4); the Drop standing on a station with the two lines (berry left, teal
right) leaving it and running off both edges of the screen; brand; hook; one line; button; fine print.

**Copy:**
- Brand: SaidClearly
- Hook (Literata 34, inks in word by word): **Find the words. Say them clearly.**
- Lead: Talk for one minute a day. Get a little sharper every week.
- Button: **Get started**
- Under it: No account needed.

**States:** only one. Returning users never see it.

**Motion:** the hook inks in word by word (exists). New: the two lines draw out from the station, 400 ms,
ease out, starting 200 ms after the screen appears; then the Drop blinks once. Reduced motion: everything
drawn, hook fully inked, no blink.

**Reuse / new:** reuse hook ink-in, `PrimaryButton`. New: station + lines SVG, `Drop`.

### 1.2 Which train are you getting on? (`02-onboarding-pick-line-light.png`)

**Job:** pick a door in one tap without feeling sorted into a box.

**Layout:** title with the Drop beside it; one lead line; two tall cards, each with its line running down
the left edge (three stops: one filled, two open), name, who it's for, three short "you'll practise"
lines, and a radio on the right; button at the bottom.

**Copy:**
- Title: **Which train are you getting on?**
- Lead: Both lines practise the same thing: talking clearly. You can switch any time.
- Card 1: **Sharp Talk** · For anyone who wants to sound sharp and think on their feet. · Precise words ·
  Fewer fillers and repeats · A steady pace
- Card 2: **Clear English** · For people who speak English as another language and want to be understood
  the first time. · Everyday words, said clearly · Say this, not that · Talk with more ease
- Button: **Get on Sharp Talk** / **Get on Clear English** (follows the selection)

**States:** nothing selected yet is not a state: Sharp Talk is pre-selected unless the phone's language is
not English, in which case Clear English is (proposal; see Open questions). Selected card: 2 px border in
its line colour **and** a filled check (not colour alone).

**Motion:** selecting a card: the border and check cross-fade 150 ms, light haptic. Reduced motion: instant.

**Accessibility:** each card is one radio button: "Sharp Talk. For anyone who wants to sound sharp and
think on their feet. Selected, 1 of 2."

**Reuse / new:** the tile + radio pattern from today's moment picker. New: `line` field on the profile
(`'sharp' | 'clear'`), saved here and changeable from Home or You.

### 1.3 Your first topic talk (`03-onboarding-first-talk-light.png`, `04-onboarding-first-talk-live-light.png`)

**Job:** get a first real talk recorded within 30 seconds of deciding, without fear.

**Layout (before):** eyebrow; the topic in Literata 52; one instruction; a box of three starter ideas; the
privacy note; the keep-a-recording switch (off by default); "Your phone will ask to use the microphone";
button.

**Copy (before):**
- Eyebrow: YOUR FIRST TOPIC TALK · 30 SECONDS
- Topic: **Coffee** (fixed for everyone on day 1 so first results compare fairly; prompt `p01`)
- Talk about it for 30 seconds. Anything you like is fine.
- Box title: If you are not sure where to start · How you take it · A café you like · Why so many people
  drink it
- Privacy (on-device phone): It listens only while you talk. Your speech is turned into text on this
  phone. (Server phone: It listens only while you talk. If this phone can't turn speech into text by
  itself, we'll ask before using a speech service.)
- Switch: Keep a recording of this talk · Off unless you turn it on. Saved on this phone.
- Small: Your phone will ask to use the microphone.
- Button: **Start talking**

**Talking:** the topic talk screen (section 3) with a 30-second clock: header "Your first talk", eyebrow
TALK FOR 30 SECONDS, hint "Keep going. If you get stuck, say the word again.", the ideas stay visible.
At 30 s it finishes on its own.

**States:**
- **Mic denied** (`03b-onboarding-mic-denied-light.png`): the Drop looking up; **SaidClearly can't hear
  you yet** · It needs the microphone to hear your talk. Turn on Microphone and Speech Recognition in
  Settings. · Your line is saved. You can do your first talk later from Home. · **Open Settings** ·
  Skip for now → Home (day 1, stop 1 is the first talk).
- **Needs consent / unavailable:** today's `MicGate` cards, with "read" changed to "talk".
- **Too short** (under 15 words): "Only 6 words came through. Try again a little closer to the mic." ·
  **Try again** (resets everything, principle 8) · Skip for now.
- **Recogniser error mid-talk:** today's `ListenError` card (Carry on / Try again).

**Motion:** none on this screen beyond the step fade.

**Reuse / new:** reuse `MicGate`, `useListener`, `ListenError`, the recording switch, `talk.tsx`'s One
Minute path. New: a 30-second length for One Minute (see Engine needs), starter ideas per topic (content).

### 1.4 Your starting point (`05-onboarding-starting-point-light.png`)

**Job:** show one honest number to beat, and get a reminder time.

**Layout:** eyebrow; Flow number counting up; fine print; a box of four plain rows; a note; the Drop
beside "tomorrow" line; reminder chips; button.

**Copy:**
- YOUR STARTING POINT · **74** Flow
- Flow is whether you kept talking. It isn't a grade of your accent or your English.
- Rows: Talked for · 29 of 30 s / Different words · 52 / Long pauses · None / um/uh the phone heard · 1
- Phones miss some um and uh, so that count runs low.
- (Drop, happy eyes) Tomorrow: a new topic and a full minute. Try to beat 74.
- Remind me each day: 8:00 am · 12:30 pm · 6:00 pm · No reminder
- Button: **See my line** → Home, with stop 1 marked done.

**States:** first talk under 45 s: no happy eyes, line "You stopped at 21 s. Tomorrow, try to keep going
for the whole minute." Notifications declined by the OS after picking a time: today's day1 handling.

**Motion:** Flow counts up 0 → 74 over 700 ms, ease out (RESULTS-ANIMATIONS §1); rows fade in 100 ms
apart after the count starts; the Drop's eyes change to happy once, at the end. Success haptic. Reduced
motion: final number, everything shown, no eye change.

**Reuse / new:** reuse reminder chips and scheduling from `onboarding/day1.tsx`, `FLOW_FINE_PRINT`, the
count-up. New: the Drop.

---

## 2. Home: the two-line map (`06-home-map-*.png`, `06b…`, `06c…`)

**Job:** "What do I do today?" answered by one place on a line and one button.

**Layout (top to bottom):**
1. Date (muted) and streak as words: "6 days in a row". On the right, this week as seven small circles
   (M–S): filled with a check for days practised, a ring for today, outline for the rest.
2. The line switcher: one segmented control, **Sharp Talk** | **Clear English**, each with its colour dot.
   The chosen line is selected. One tap shows the other line (its own progress, its own Drop position).
3. The map, scrolling vertically, current stop centred on open: done stops (filled, check, label + "Flow
   71"), the current stop (large ring with the stop icon, the Drop standing on it, a "today" card beside
   it), stops ahead (white, soft ring, muted icon, label + day). Done track is solid line colour; the track
   ahead is the soft tint. The line bends between two columns so it reads as a path, not a list.
4. Pinned at the bottom: **Start today's stop** and, under it, a small row "Got something coming up?
   **Plan for it** ›".
5. Tab bar.

**Copy:**
- Header: Sunday, Nov 1 · 6 days in a row (first day: "Day 1"; day 2 before practising: "Day 2")
- Today card: TODAY · STOP 6 / Topic talk: **Coffee** / 1 minute. Your best is 76.
  - Word pack stop: Word pack: **Make your point** / 8 words, then a short talk.
  - Cold read stop: Cold read: **Signal and Noise** / Then a short topic talk.
  - Glide stop: Glide rehearsal: **The Night Shift** / Then a short topic talk.
- Done stop labels: Topic talk · Rain / Flow 71; Word pack · Make your point / 8 words, then a talk
- Ahead labels: Cold read / Tomorrow; Topic talk / Tuesday
- Button: **Start today's stop**
- Moments row: Got something coming up? **Plan for it** › (opens the moment picker; the active moment's
  plan then appears as a small card *below* the map, never above it)

**States:**
- **First day after onboarding** (`06b`, shown on Clear English): the station "Start" is in view at the
  top; the other line leaves the same station and runs off the right edge with a tag "Sharp Talk ›" that
  switches lines. Stop 1 ("Your first talk · Coffee, Flow 74 · your starting point") is done. If the mic
  was denied in onboarding, stop 1 is current and the card says "Your first talk: **Coffee** / 30 seconds.
  The phone needs the microphone first."
- **Partial (mid-line):** `06`.
- **Today's stop done** (`06c`): the Drop has moved to tomorrow's stop with happy eyes; the card reads
  TOMORROW · STOP 7; the bottom area shows a check and "Today's stop is done. See you tomorrow." with a
  secondary button **Do the next stop now**.
- **Streak broken:** no red, no sad Drop. Header: "Welcome back" and the week strip; the line is unchanged
  (progress is never taken away). Freeze used: today's line "Streak freeze used this week. You're still on
  6."
- **Other line, never started:** the station is in view, the Drop is not on it (it stays on your chosen
  line). Card: "Start Clear English here. Your Sharp Talk progress stays where it is." Button: **Start
  this line**.
- **End of the content we have:** the last stop is a "More stops soon" sign; topic talks keep coming daily
  (36 prompts rotate) so the loop never stops.
- **Pro:** stop types that are Pro today (Glide rehearsal of your own script after the free run) show a
  small `ProBadge` on the card, never a lock on the map itself. Topic talks are always free.
- **Error:** storage read failed: show the map from the last known stop and a quiet line under the header,
  "Couldn't load today's stop. Pull down to try again."
- **Long content:** card titles wrap to two lines (Literata), never truncate; long pack titles wrap.

**Motion (alive, never busy):**
- Arriving after a finished stop: the done segment draws from the old stop to the new one (300 ms), the
  stop fills and its check appears (150 ms), then the Drop slides along the track to the next stop
  (400 ms, ease in-out) and blinks. Selection haptic when it lands. This is the map's one reward moment and
  plays once per stop.
- Idle: the Drop blinks every 4–7 s (step 6 adds breathing). Nothing else moves.
- Switching lines: the map cross-fades 200 ms; no slide.
- Reduced motion: no draw or slide; the map simply shows the new state; no blinking.

**Accessibility:** the map is a list to VoiceOver, in order: "Stop 4, Topic talk, Rain, done, Flow 71",
"Stop 6, today, Topic talk, Coffee, your best is 76", "Stop 7, Cold read, tomorrow". The Drop is hidden from
VoiceOver. The switcher is a tab list ("Sharp Talk, selected, 1 of 2"). Week circles read as "6 of 7 days
this week". Each stop is a 44 pt target (done stops open that day's results; ahead stops show what they are).

**Reuse / new:** reuse `streak()` (store/sessions.ts), `PrimaryButton`/`SecondaryButton`, moments and
`PlanCard` (moved below the map). New: `LineMap` (react-native-svg), `LineSwitch`, `WeekStrip`, `Drop`, the
line/stop model in the store (chosen line, current stop per line, done stops with their session ids), the
stop sequence per line (content). **Removes from Home:** "What are you preparing for?" dark card, the
"🔥 days" streak in amber (emoji as decoration and amber used for a non-warning, both against the Taste
rule), "Ways to practise" tiles (they live in Library).

---

## 3. Topic talk (One Minute, promoted) (`07-topic-talk-ready-light.png`, `08-topic-talk-live-light.png`)

**Job:** one topic, one minute, nothing to worry about but talking.

**Layout:** top bar (close, "Topic talk · stop 6", the clock); a progress bar; eyebrow; the topic in
Literata 52; one instruction; "If you get stuck" with three ideas; footer.

**Copy:**
- Ready: TODAY'S TOPIC / **Coffee** / Talk about it for one minute. Take a moment to think: the first 8 seconds don't count against
  you. / If you get stuck: How you take it · A café you like · Why so many people drink it /
  **Start talking** / Different topic
- Talking: same topic; instruction becomes "Keep going. If you get stuck, say the word again." Footer: the
  Drop, the voice ribbon, **Finish** (quiet text button).
- Word pack stops add one line under the topic: "Try to use 2 of today's words: nuance, premise, candid…"

**The start (proposal: calm, no 3-2-1):** a countdown adds pressure for exactly the people who freeze, and
the engine already gives 8 free seconds (`FREE_THINK_MS`). On **Start talking**: the button fades to the
footer (200 ms), the Drop's eyes lift to the topic, the clock starts at 0:00. If Quinton prefers a count,
the fallback is a 3-2-1 in the button area (three numbers, 600 ms each, fade only, no scale), with the
free 8 seconds starting after it.

**Clock:** counts up 0:00 → 1:00 in the top bar (tabular figures) with the bar filling; light haptic at
0:50; at 1:00 it finishes on its own. **Finish** any time; under 15 words is the too-short state.

**States:**
- **Ready / talking / paused** (call or Siri interrupts: today's Paused card, "Carry on" keeps the talk).
- **Too short:** "Only 6 words came through. Try again a little closer to the mic." **Try again** resets
  pauses, clock and transcript (principle 8).
- **Recogniser error / mic denied / needs consent:** `ListenError` and `MicGate`, unchanged.
- **Different topic:** before starting only; picks the next prompt in the rotation (exists).
- **Long topic** (level 3 prompts are sentences): the topic drops to Literata 30/40 and wraps; ideas hide if
  it would push them under the footer.

**Motion:** only the clock, the bar, the voice ribbon and the Drop's listening pose (body pulse with
`voiceLevel` in step 6). Nothing moves over the topic. Reduced motion: the ribbon still shows level (it is
information), no Drop pulse.

**Reuse / new:** `src/app/talk.tsx` One Minute path (leaves tester mode), `MINUTE_PROMPTS` rotation,
`minuteSummary`, `VoiceRibbon`, `useListener`, Paused card, Different word. New: starter ideas per prompt
(content), the `stop` route param so finishing marks the stop done, footer Drop. **Removed from the talk
screen:** the Free talk filler jar and "Right in the pocket" pace label (idiom, and live judgement while
talking).

---

## 4. Results scorecard (`09-results-*.png`, `09b-results-stopped-early-light.png`)

**Job:** one honest picture of how you talked, one thing to try tomorrow, and the feeling of moving on.

**Layout:** eyebrow with the topic; **Flow** number large with the change against your usual; fine print;
six tiles in two columns; the Drop with one coaching line; the line strip (stops done, the Drop on the next
stop); **Back to the map**.

**Copy (values from the mockup):**
- TOPIC TALK · **Coffee**
- **78** Flow · ↑ 6 on your usual 72 (first 2 talks: no comparison line; trend needs 3, `minuteTrend`)
- Flow is whether you kept talking. It isn't a grade of your accent or your English.
- Tiles:

| Tile | Value | Note | Source |
|---|---|---|---|
| Fillers (um, uh) | 2 | Phones miss some. | built (`umCount`) |
| Repeated words | **really** ×9 | Your most used word | **new** (engine step 3): content words only, never "the", "and" |
| Different words | 96 | 3 precise: nuance, premise, candid | **new**: distinct words; "precise" = words from the packs or a rare-word list. Never called creativity |
| Kept going | 58 s | 1 long pause, 3.1 s (or "No long pauses") | built |
| First word | 2.4 s | Your usual: 4.1 s (first talks: "The first 8 s are free") | built |
| Pace | 142 wpm | In the 120–170 range (good colour) / Above 170 / Below 120 (ember) | built |

- Likely fillers (like, you know…), when any: the existing chip row below the tiles, "Likely fillers: like
  ×3. Tap any you meant." (unchanged, shown not scored).
- Coaching line (one, with the Drop): today's `minuteLine` order, plus one new line when nothing above it
  fires and a content word was said 6+ times in a minute: **You said "really" 9 times. Tomorrow, try a
  different word, or leave it out.** Never a list of faults.
- Line strip: Stop 6 done · Stop 7 tomorrow: beat 78
- Button: **Back to the map**

**States:**
- **First talk ever / under 3 talks:** no "on your usual"; First word note "The first 8 s are free".
- **Personal best:** the change line becomes "Your best so far" (good colour, with ↑). No extra animation.
- **Stopped early (under 45 s, 15+ words)** (`09b`): no up arrow, "Your usual is 64" in muted; the
  stopped-early coaching line; the Drop tilted, rest eyes (encouraging, never sad); the stop still counts
  (the strip advances); a quiet "Talk about it again" under the button. It never looks like a failure
  (RESULTS-ANIMATIONS "Never").
- **Under 15 words:** no results; the too-short state on the talk screen (no Flow saved).
- **Repeated words, nothing over 2:** tile shows "None" / "No word more than twice".
- **Precise words, none:** note "in 1 minute".
- **Server recognition used:** the fine print adds "This phone used a speech service, so pauses may be a
  little off."
- **Dark** (`09-results-dark.png`): tokens only; line strip uses dark `sharp`/`sharpSoft`, check in `onLine`.

**Motion (RESULTS-ANIMATIONS order):**
1. Flow counts up from your usual (or 0 the first time) to 78, 700 ms, ease out.
2. Tiles fade in 100 ms apart, starting as the count starts. Fade only.
3. The coaching line fades in last; the Drop nods once (step 6: Celebrate on a clean or best run, else
   Encourage).
4. The line strip: the segment to stop 7 draws (300 ms), then the Drop hops to stop 7 (250 ms). Success
   haptic when the count lands. That is the whole celebration: no confetti, no scale pop.
Reduced motion: final number, all tiles shown, the strip already advanced, no hop.

**Reuse / new:** rework `src/components/MinuteResult.tsx` into the scorecard (keeps Flow, fine print,
trend, first word, long pauses, pace note, filler chips and "I meant that"). New: two tiles (engine step
3), the line strip, the Drop. The tape route (`tape.tsx`) keeps reading sessions as they are.

---

## 5. Progress (`10-progress-light.png`, `10b-progress-early-light.png`)

**Job:** "Am I getting more articulate?" answered skill by skill, week by week.

**Layout:** title; one summary line; "YOUR SKILLS · WEEK BY WEEK"; six rows, each: skill name, what it
means, change since week 1, a small sparkline (8 weekly points, latest point marked), this week's value;
a note at the bottom. Topic talks only, so it compares one kind of speaking (principle 4).

**Copy:**
- **Progress** · 31 talks in 8 weeks · best Flow 84 (**Trust**)
- Rows:
  - Flow · Kept talking, few long pauses · ▲ Up from 61 in week 1 · **78** this week
  - Fillers · um and uh heard · ▼ Down from 3.8 · **1.4** per min
  - Repeated words · Your most used word · ▼ Down from 11 · **5** times
  - Different words · In one talk · ▲ Up from 71 · **94** words
  - First word · Time before you start · ▼ Down from 6.4 s · **2.6** seconds
  - Pace · Shaded: the 120–170 range · In range: 6 of 7 talks · **141** wpm (no up or down: no single
    correct pace, principles 4 and 5)
- Note: Each line is the middle of your talks that week. Phones miss some um and uh, so that count runs low.

**Rules:** each point is the weekly **median**; a week with no talk leaves a gap, not a zero. A change is
shown in `good` with ▲/▼ **and** words ("Up from…", "Down from…") only when it moved the better way;
otherwise muted ("About the same as week 1"). Never red. 8 weeks shown; Pro sees all weeks by swiping the
sparkline (free: 8 weeks, matches today's history rule).

**States:**
- **Empty (no talks):** "Your first topic talk takes one minute." + **Start today's stop**.
- **Early (1–2 talks)** (`10b`): the Drop; **Two talks so far** · After your third talk, each skill gets
  its own line here: Flow, fillers, repeated words, different words, first word and pace. · a list of the
  talks with their Flow.
- **3+ talks, under 2 weeks:** sparklines by talk instead of week, labelled "Last 5 talks".
- **Reading sessions** (Glide, cold read) keep today's charts (pace by context, Day 1 vs now, heat strip)
  in a second section "Reading" below the skills, collapsed by default.

**Motion:** sparklines draw left to right, 400 ms, 60 ms apart (like chart draw-in today). Reduced motion:
drawn.

**Reuse / new:** `Charts.tsx` patterns (band shading from `PaceChart`), `heatStrip`, `personalBests`,
`streak`. New: `Sparkline`, weekly median per skill (store), the two new counts saved on each session.

---

## 6. What engine and content work this needs (not design's to build)

- **speech-engine:** repeated words (top content word and its count, stop-word list) and vocabulary
  variety (distinct words, precise-word list) in `minute.ts`, saved per session, with tests (step 3, not
  built yet). A 30-second One Minute (`MINUTE_SECONDS` as a parameter; kept going out of 30) for onboarding,
  tagged so it never mixes with 60-second trends. The new "repeated word" coaching line, after the existing
  ones in priority.
- **mobile-engineer:** line + stop model and storage, `LineMap`, `LineSwitch`, `WeekStrip`, `Drop`,
  `Sparkline`; One Minute out of tester mode; onboarding steps; moving moments behind "Plan for it".
- **content (product-lead):** the stop sequence for both lines; Clear English packs (everyday words and
  "say this, not that", each with Hear it); three starter ideas for each of the 36 prompts.

## 7. Self-critique (rubric from `.claude/agents/04-design-ux.md`, 0–2 each, /20)

| Screen | Job | Hier. | One action | Calm | Copy | States | A11y | Dyn. Type | Dark | Consist. | Total |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Hook | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 19 |
| Which train? | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 2 | 18 |
| First talk | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 2 | 18 |
| Starting point | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 2 | 18 |
| Home map | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 2 | 1 | 17 |
| Topic talk | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 19 |
| Results | 2 | 2 | 2 | 2 | 2 | 2 | 2 | 1 | 2 | 2 | 19 |
| Progress | 2 | 1 | 2 | 2 | 2 | 2 | 2 | 1 | 1 | 2 | 17 |

Where points were lost, and what I did about it:
- **Dark (1s):** only Home and Results were rendered in dark. Tokens are complete for every screen; check
  the rest in the step-5 build.
- **Dynamic Type (1s):** at the largest sizes the map's side labels will not fit beside the stops. Rule:
  above XL text, labels move under each stop and the today card becomes full width under the current stop;
  results tiles go to one column; Progress sparklines move under the label. Not mocked.
- **Home a11y and consistency (1s):** the map is new drawing (react-native-svg), so VoiceOver order must be
  built as a list on top of it; it is the screen most at risk of looking "different from the rest".
- **Progress hierarchy (1):** six equal rows; nothing says "this one moved most". Accepted: one idea per row
  is the point, and Flow is first.
- **Fixed during review:** streak heading wrapped (shortened); a half-hidden stop label peeked over the
  bottom panel (moved off-screen); the hook's lines ended mid-air (now run off both edges); results line
  strip overflowed its card; "Faster than your usual 4 s" wrapped with an orphan "s"; the "stronger word"
  coaching line (vague for ESL readers) became "a different word"; the Drop sat next to the starting
  Flow number (moved beside the next-step line, per ANIMATION.md); Progress rows wrapped and the sixth was
  cut off; a stopped-early result led with "Try again" (read as failure; now the stop counts and "Back to
  the map" leads); the starting-point tiles were cramped (now plain rows).
- **Taste check:** no gradients, glows, shadows, confetti, emoji or stock art; one flat Drop; motion only
  where it explains or rewards. "Next to Duolingo or Headspace?": the map and the Drop yes; topic talk is
  deliberately quieter. "Want to come back tomorrow?": the number to beat, the stop ahead with tomorrow's
  name, and the week strip all point at tomorrow.
- **What I removed:** the moment picker from onboarding, the Home prep card, practice tiles and amber emoji
  streak, the filler jar and live pace label while talking.

## 8. Open questions for Quinton

1. **What is a stop?** This brief proposes one stop per day, every stop ending in a topic talk (packs, cold
   reads and Glide come before the talk). Yes, or should lesson stops replace the talk on their day?
2. **Line colours:** berry for Sharp Talk, teal for Clear English. Happy with them, or try another pair?
3. **Calm start or 3-2-1?** Proposal: calm start with the 8 free seconds. A 3-2-1 is the fallback.
4. **Onboarding talk is 30 seconds, not 60.** Easier first step, but its Flow is a 30-second Flow. OK to
   ask "beat 74" tomorrow on a full minute, or should day 1 also be a full minute?
5. **Default line:** pre-select Sharp Talk, or pre-select Clear English when the phone's language isn't
   English? (A guess from the phone's language could feel like being sorted.)
6. **The Drop on the map is cobalt on a berry or teal line.** Keep the Drop one colour everywhere (brand),
   or tint its body to the line?
7. **"Precise words" list:** pack words only (honest, small), or a general rare-word list too (bigger, but
   a list someone has to choose)?
8. **Tabs:** Home · Library · Progress · You. OK to rename Today to Home?
9. **Moments on Home:** only the "Plan for it" row, and an active plan as a small card under the map. Is
   that quiet enough?
