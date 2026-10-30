# Decisions

One line per decision: date, decision, why. Newest first.

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
