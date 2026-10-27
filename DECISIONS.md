# Decisions

One line per decision: date, decision, why. Newest first.

- **2026-10-27 · Habit words (like, so, you know, actually) stay unscored in Free talk.** We can't tell a habit from a real word ("I like it", "so that") without sentence context the recogniser doesn't give us, and discourse words are normal in many Englishes, so a score would penalise accents. Principle 7 stands. (product-lead, Wave 1)
- **2026-10-27 · Fade mode waits for the Phase 1 gate.** Glide's 5-word exact-match lookahead freezes or jumps when a reader paraphrases from memory, and Glide accuracy hasn't been measured on a phone yet. (product-lead, Wave 1)
- **2026-10-27 · Speech locale is never sent in analytics.** A locale is a proxy for accent or national origin. Accent goes on the beta sheet instead. (release-privacy, Wave 1)
