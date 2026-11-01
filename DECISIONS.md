# Decisions

One line per decision: date, decision, why. Newest first.

- **2026-11-01 · The remodel** (Quinton, after seeing the app in the browser: "way too focused" on presentations and ESL). Full brief: `docs/briefs/remodel-2026-11.md`. Supersedes the presentation/interview-led layout and the "lead with one concrete moment" store line.
  - **Pitch is identity:** sound sharp, think on your feet, be articulate. Presentation practice is the weakest part and never leads, in the app or in marketing.
  - **Core daily loop is topic talk:** a topic, a minute of talking, a rating, beat yourself, track it over weeks. One Minute leaves tester mode and becomes the front door; Glide rehearsal and moments become stops and destinations.
  - **Two doors, one app:** a home map with two train lines from one station, "Clear English" (ESL) and "Sharp Talk" (articulate). Pick once in onboarding; the other is one tap away. One store listing, one subscription, one engine. Concept approved; screens wait for approved mockups.
  - **Scorecard adds repeated words and vocabulary variety.** Grammar and creativity are practised, not measured; we never claim to grade creativity. Pronunciation is never graded (principle 1): we show words the phone didn't hear clearly, with Hear it.
  - **The feel is sunny and alive, a slight Duolingo vibe,** with characters and motion on onboarding, the home map, results and empty states. The reading passage stays calm (principle 6). The Taste rule still bans glows, gradients, confetti and AI-looking art: alive is not vibe-coded.
  - **Rive is approved in principle for the Drop as a living coach** (`docs/design/COACH-STATE-MAP.md`), after the results animations (`docs/design/RESULTS-ANIMATIONS.md`) and behind a static fallback, because it needs a development build we can't verify yet. The Drop keeps no mouth.
  - **Each build step stops for Quinton's approval.**

- **2026-10-31 · Deepen and polish existing features; defer new modes until manual testing** (Quinton). Focus on flow, responsiveness, UI and thoughtful feature depth. Code checks are not evidence that native performance or visual polish has been validated.

- **2026-10-31 · Improve the existing experience while Apple account access is unavailable** (Quinton). Prioritise design, flow and thoughtful future ideas. Continue browser/code validation; keep native verification outstanding rather than treating account setup as the current work. Challenge builder decisions, not users.

- **2026-10-30 · Articulation and overall speaking are the centre, not ESL** (Quinton, direct correction to Codex). Train quick thinking, precise vocabulary, pacing, emphasis and presence. ESL users are included without defining the brand. Aim for intellectual aspiration without condescension; a useful product comes first, with disciplined spending and honest pushback.

- **2026-10-30 · Mascot: the Drop** (flat, no mouth, never sad), piloted on onboarding and empty states. **No glow effects and no new colour:** celebrations use the existing `good` colour; amber means "watch out" only. Design rule: it must never look vibe-coded (Taste section in the design-ux agent).
- **2026-10-30 · Tagline: "Find the words. Say them clearly."** Covers vocabulary by subject and articulation, works for interviews, presentations and everyday English, simple for ESL speakers, never grades. Positioning broadened to speaking practice and vocabulary; the store still leads with one concrete moment. (ESL emphasis superseded the same day: articulation first, ESL included; see the Codex-logged 2026-10-30 entry.)
- **2026-10-30 · Name: SaidClearly** (Quinton). Clearance and a lawyer consult before branding spend.
- **2026-10-30 · One Minute: first ~8 s of thinking free; time to first word shown as its own trended number.** Trains starting fast, closes the "silent minute" loophole (DILEMMAS #15).
- **2026-10-30 · Target length: whole answer in the final run-through only, no per-part lights; paste-time warning; custom targets.** Per-part budgets were our invention, not the reader's moment (DILEMMAS #16).
- **2026-10-29 · Habit words get a context classifier (reverses 2026-10-27 "stay unscored").** Quinton: most uses are tellable from context ("I like it" vs "it was, like, huge"), from repetition bursts, and from pauses. Each like/so/you know/actually/basically/literally is labelled filler, real or unsure; only "filler" counts, the reader can overrule ("I meant that"), and it enters the score only after ≥ ~90% precision on a labelled corpus and the beta hand tally agrees. Until then it is shown, not scored.
- **2026-10-28 · The single full paywall moves from after Day 1 to after the first own-script run.** Free: one script, one completed Glide of its part 1; cold read loses its streak lock and is Pro only. The aha (your own words inking in) has to come before the ask. Phase 0 feature, approved by Quinton. Brief: docs/briefs/aha-before-paywall.md.
- **2026-10-28 · Reset all data keeps an analytics opt-out.** Reset is a "delete my data" action; silently turning tracking back on for someone who said no breaks principle 3. (product-lead, Wave 4) Implementation pending (src/store/profile.tsx).
- **2026-10-28 · Phase 1 beta follows TESTING.md:** 30-minute sessions, $20 per tester, key points marked in advance, a real $10 commit question, gates computed from pooled counts. (product-lead, Wave 4)
- ~~**2026-10-27 · Habit words (like, so, you know, actually) stay unscored in Free talk.**~~ (superseded 2026-10-29) We can't tell a habit from a real word ("I like it", "so that") without sentence context the recogniser doesn't give us, and discourse words are normal in many Englishes, so a score would penalise accents. Principle 7 stands. (product-lead, Wave 1)
- **2026-10-27 · Fade mode waits for the Phase 1 gate.** Glide's 5-word exact-match lookahead freezes or jumps when a reader paraphrases from memory, and Glide accuracy hasn't been measured on a phone yet. (product-lead, Wave 1)
- **2026-10-27 · Speech locale is never sent in analytics.** A locale is a proxy for accent or national origin. Accent goes on the beta sheet instead. (release-privacy, Wave 1)
