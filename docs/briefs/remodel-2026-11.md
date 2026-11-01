# Brief: the remodel (identity, two tracks, a living app)

**Status:** direction approved by Quinton 2026-10-31 evening / 2026-11-01. Each build step still stops for
his approval (see "Build order"). **Owner:** product-lead + design-ux write the screen-level brief;
mobile-engineer and speech-engine build. **Reviewer:** qa-critic.
Sources: Quinton's own words (chat, 2026-10-31), his strategy chat with another assistant ("Mango"), and a
brief written for us by MUSE AI. Where those disagree with a principle, this brief says how we reconciled it.

## Why

Quinton saw the app running in the browser and was disappointed. The UI and layout lead with presentations,
interview plans and an ESL feel. That isn't the product. His words: "It's about articulation. It's about
speech." The agents improved features well but were building the old shape.

## What the product is

**Identity first.** People want to sound sharp, think on their feet, and be the person in the room who says
what they mean clearly. That is the pitch, and it's demoable in a 15-second video. Presentation practice is
the weakest part and never the lead, even though a presentation moment exists in the code.

**The core daily loop: topic talk.** The app gives a topic ("coffee"), you talk for a minute, it rates the
talk, and you try to beat yourself. Every day. You watch your articulation improve over weeks. One Minute
already does most of this: it leaves tester mode and becomes the front door, not a hidden mode.

**Two doors, one app ("which train are you getting on?").** The home is a map: two train lines leave the
same station.
- **Line 1: Clear English** (ESL speakers): being understood, everyday fluency, words said clearly,
  "say this, not that". Respectful, never remedial.
- **Line 2: Sharp Talk** (articulate): precise words, no fillers, steady pace, sounding sharp.

Each stop on a line is a lesson: a topic talk, a word pack, a cold read, a Glide rehearsal. The Drop moves
down the line as stops are done, like Duolingo's path but with two lines. Onboarding asks which train once,
the home defaults to it, the other line is one tap away. **One app, one store listing, one subscription,
one engine.** Never two apps. Moments (interview, raise, meeting, presentation) become optional
destinations reached from either line, not the home screen.

**The feel: sunny, alive, a slight Duolingo vibe.** Characters, motion and warmth on onboarding, the home
map, results and empty states, so it never feels like a boring utility. The reading passage stays calm:
nothing moves over the words except the ink (principle 6).

## The articulation scorecard (what a talk is rated on)

| Signal | State | Honest rule |
|---|---|---|
| Fillers: um/uh | measured (phones miss some) | say so on screen |
| Fillers: like / you know / so… | context classifier (`engine/habits.ts`) | shown; scored only after the precision gate (DECISIONS 2026-10-29) |
| Repeated words | **new** ("you said 'really' 9 times") | count only content words, never "the", "and" |
| Vocabulary variety | **new**: different words used, precise or rarer words | this is the honest version of "creativity". We count variety; we never claim to grade creativity |
| Flow (kept going), time to first word | built | |
| Pace and steadiness | built | ranges, never one correct pace |
| Grammar | **not measured** | practised through prompts and packs. A future opt-in cloud feedback could flag it; not now |
| Pronunciation | **not graded** | principle 1. We show which words the phone didn't hear clearly, with "Hear it". The Clear English line teaches "say this, not that" as content, never a score |

Every result is text or numbers too, never animation alone.

## Reconciled with existing rules

- **"No new modes until phone testing" (DECISIONS 2026-10-31):** the remodel restructures existing modes
  (One Minute, Glide, packs, cold read, moments). The two new scorecard counts are engine work, testable
  now. Rive is a native package that can't be verified on a phone yet: build it with a static fallback so
  nothing depends on it working.
- **The Drop has no mouth.** The coach map below mentions a mouth following the voice; instead the Drop's
  body pulses/ripples with `voiceLevel`. Still flat, never sad.
- **Taste rule:** alive and sunny is not vibe-coded. Duolingo is crafted, not generic. Still never: glows,
  neon, gradients on text or buttons, confetti, emoji as decoration, stock or AI-looking art. Celebration =
  one short, crafted moment (count-up, bars growing, the Drop's nod), then calm.

## Build order (stop for Quinton's approval after each)

1. **Docs** (this brief, decisions, briefs): done 2026-11-01.
2. **Results animations**, no new package: `docs/design/RESULTS-ANIMATIONS.md`.
3. **Engine:** repeated words and vocabulary variety in One Minute, with tests.
4. **Remodel brief + mockups** by product-lead and design-ux: onboarding "which train?", the two-line home
   map, One Minute out of tester mode, Progress as articulation skills over time. Quinton approves the
   mockups before any screen is rebuilt.
5. **Rebuild** onboarding, home and results from the approved mockups.
6. **Coach (Rive)**, Idle/Listening/Thinking/Nudge/Celebrate only: `docs/design/COACH-STATE-MAP.md`.
   Needs `@rive-app/react-native` (0.5.9, Nitro-based, pre-1.0, no stated RN 0.88 support yet) and a
   development build. It also renders on web via `@rive-app/canvas`. Check the free-plan export splash
   before relying on it commercially.
7. **Later, proposed not approved:** Fade mode, hear-it-back playback, saved runs + spaced re-tests,
   whole-answer target, opt-in AI content feedback.

## Distribution (Quinton's plan, not a build task)

Two audiences, two kinds of video, never crossed in one video:
- **Clear English:** "say this, not that", stop getting misunderstood, sound confident in English.
  Reddit forums and Telegram groups: answer first, give the tip, link only in your profile.
- **Sharp Talk:** "words that make you sound sharp", cut the fillers, talk slower and cleaner.
  TikTok AI UGC: 10 accounts, 1 video a day for 3 months. Vary the hook, angle and first 2 seconds per
  account, or TikTok reads it as spam.

Revenue ambition: $5,000/month ≈ 1,022 monthly subscribers at $6.99 after Apple's cut. The deciding test
is still the beta's real "$10 now?" question.
