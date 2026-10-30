# Product dilemmas

The open product questions: the options, Claude's take, and where each one stands. When one is settled,
move it to DECISIONS.md (one line) and mark it **Decided** here with the date.

---

## Open

### 1. What to call the app
- **Why:** "Mouthful" is risky in the US ("Mouthful: Voice to To-Do List", Education, since March 2026). See
  docs/NAME-CHECK.md.
- **Round 1 survivors:** Saysteady (safe, forgettable; "Say-" is crowded now), Mouthwise (keeps the hook;
  reads as mouthwash), Downpat (best meaning; ESL readers may not know the idiom).
- **Marketing direction for round 2:** calm, ready, on your side ("I'll have it down by Thursday"). Themes:
  arriving prepared, the day itself, steady ground, owning your words. Avoid: Say-, Glide, Run/Lines, Dry
  Run, Off Book/Script, Prompt, Poise, Speak, Well-, Vocal, Coach, AI, Pro, Fluent, Accent.
- **Claude's take:** don't settle for a round 1 name. Run round 2 from the marketing direction, then a
  lawyer consult on the top pick before any branding spend.
- **Status:** brand-namer round 2 running.

### 2. Rename "Glide" too?
- **Why:** "Sayglide: Voice Teleprompter" launched 2026-10-25 with "Say" + "glide" and a line that moves
  along your words. Anyone who has seen it will read our Glide as a copy.
- **Options:** keep "Glide" inside the app but never as the store hero word; or rename the mechanic with
  the app (e.g. "Ink", since words ink in).
- **Claude's take:** rename it with the app. It's cheap now (copy only) and expensive after launch.
- **Status:** decide with dilemma 1.

### 3. One Minute: its name
- **Why:** Quinton isn't sure about "One Minute". Wellspoken already has "Daily 60".
- **Options:** One Minute (plain, says exactly what it is, easy for ESL readers); Off the Cuff (an idiom,
  hard for ESL readers); Word Drop; The Minute; something tied to the new app name.
- **Claude's take:** keep "One Minute" as the working name. Plain beats clever for half-ESL users. Revisit
  when the app is renamed, since a sub-feature name should sound like the brand.
- **Status:** working name "One Minute".

### 4. One Minute vs Free talk: the best of both
- **Quinton:** "replace or take the best of both… we can only have one."
- **Plan:** one mode, one tile, one route (`/talk`). From Free talk it keeps: the daily prompt, "Different
  word", 60 s, the habit-word line, Try again. From One Minute it adds: the 3 prompt levels (concrete,
  abstract, work topics), the Flow rating, the "not your accent" line, own-history trend, and no pause
  counted before your first word (a bug in Free talk today).
- **Status:** Decided 2026-10-29: replace, keeping the best of Free talk.

### 5. Which habit words the classifier covers, and where
- **Why:** DECISIONS lists like, so, you know, actually, basically, literally; the classifier brief adds
  i mean, kind of, sort of, right. Reading sessions aren't covered by the decision.
- **Claude's take:** one list, whatever the classifier can prove at ≥ 90% precision per word. Words that
  can't reach it stay shown-only. Apply it to One Minute first (no script to rephrase). In reading, a
  "like" that isn't in the passage is already off-script, so the classifier could judge it there too, but
  only after One Minute proves it.
- **Status:** wait for the classifier's per-word report.

### 6. The free run: one, or unlimited runs of part 1?
- **Now:** one completed run of part 1 (docs/briefs/aha-before-paywall.md).
- **Revisit if:** most beta testers reach the aha but 0–1 of 10 start a trial. Then the free amount is
  wrong, not the timing.
- **Status:** one run, revisit after the beta.

### 7. Moment Pass and auto-renew
- **Why:** the category's top complaint is billing tricks (Speeko, Orai, Vocal Image, Wellspoken, ELSA
  reviews). Dry Run already sells $9.99 one-time packs.
- **Options:** keep only the annual and monthly plans (with a trial); add a ~$9.99 14-day Moment Pass that
  **doesn't auto-renew**; or make the Moment Pass the main offer.
- **Claude's take:** add the Moment Pass, sold as "no auto-renew". It answers the market's biggest complaint
  and fits a dated moment. The price waits for the beta's real "$10 now?" commits.
- **Status:** open until the beta ($10 commit question).

### 8. Speaking-test wedge (CELPIP / IELTS)
- **Why:** the teardown found 10+ CELPIP prep apps and Stimuler (IELTS band scores, 8,594 ratings). A band
  score would also break principle 1.
- **Claude's take:** downgrade from a wedge to a moment template ("Speaking test" next to Interview and
  Presentation). No band scores.
- **Status:** proposed; change STRATEGY bet 4 if Quinton agrees.

### 9. Fade mode: when
- **Why:** the resync condition is met, but Perora, Run Lines and OffBook already do memorising. Fade is
  table stakes for "know it cold", not a moat. The moat is the dated plan it sits in.
- **Status:** after the beta gate (false red ≤ ~2/100 for accented readers), 2 levels first.

### 10. An opt-in AI layer
- **Why:** the first strategy review said refusing AI leaves the most valuable feedback ("you forgot the
  result in your STAR answer") to competitors. Privacy is our trust edge.
- **Options:** never; an opt-in, clearly consented post-session cloud pass for content feedback (Pro);
  on-device only.
- **Claude's take:** opt-in post-session cloud pass, after the beta. It also fixes the um/uh undercount
  (CLAUDE.md "Not built yet" #5). It needs its own consent screen and privacy policy section.
- **Status:** open, after the beta.

---

## Decided

- **2026-10-29 · Flow, not "Articulation", for the One Minute rating.** The phone hears whether you kept
  talking, not how you sound (principle 1). Marketing can still say the feature trains articulation.
- **2026-10-29 · One Minute: engine now, screen in tester mode first.** The pure Flow math and tests are
  built now; the screen ships behind tester mode for the beta, and pause counts are checked against
  recordings before everyone gets it.
- **2026-10-29 · Habit words get a context classifier** (DECISIONS.md).
- **2026-10-28 · Aha before paywall; Reset keeps the analytics opt-out** (DECISIONS.md).
