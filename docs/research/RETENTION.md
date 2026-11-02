# Daily-habit retention (research, 2026-11-01)

> From the research agent. Evidence, not orders. Secondhand figures are marked.

## Evidence-backed
- **Early streak milestones matter.** Duolingo: learners at a 7-day streak are 2.4× more likely to return next day; the 1→2 day step is "a huge jump". https://blog.duolingo.com/how-duolingo-streak-builds-habit · https://lennysnewsletter.com/p/behind-the-product-duolingo-streaks (read via summary)
- **Streak animations and freezes:** +1.7% day-7 retention for new learners from streak animations; freezes kept and expanded. https://making.duolingo.com/how-streaks-keep-duolingo-learners-committed-to-their-language-goals
- **Commitment copy:** "Commit to my goal" instead of "Continue" raised retention; shrinking the daily task to one exercise did not (podcast above).
- **Reminders help, incrementally.** Duolingo's bandit (fresh, unseen copy): +0.5% DAU, +2% new-user retention. https://research.duolingo.com/papers/yancey.kdd20.pdf · Calm: prompting people to set a reminder (~40% did) and setters retained 3×, prompted users too. https://amplitude.com/blog/calm-increased-retention-amplitude · Headspace deep-linked pushes +109% week-1 (vendor case study, unverified).
- **Broken streaks demotivate:** emphasise intact streaks, play down broken ones, offer repair. https://www.psychologytoday.com/us/blog/ulterior-motives/202306/how-broken-streaks-sap-motivation

## Folklore (don't build on)
Leagues "+17% learning time" (no Duolingo source; also needs a server and users), "14% day-7 from wagers", "60% quit after a broken streak", "remind at 23.5 h". No published data on Duolingo's path/map redesign: unproven, not disproven.

## What we have (checked in code)
- `streak()` applies one silent freeze per 7 days: good but invisible.
- Reminder offered after the first talk (opt-in): matches Calm.
- **`src/reminders.ts` is stale:** "Today's read is ready / Read it out loud" (pre-remodel), a fixed DAILY trigger that fires even if you already practised, same copy forever.

## Recommended next ($0, local, no server)
1. **Smarter reminder:** schedule one-off notifications for the next 7 days; cancel today's when a talk is saved; put tomorrow's real topic in the body; rotate copy from a small pool; deep-link to today's stop. No guilt copy, the Drop never sad. Native: verify on a phone.
2. **Day-2 hook after every talk:** show tomorrow's stop and topic, plus a commitment button ("I'll be back tomorrow at 6 pm" sets/confirms the reminder) instead of a bare Done. Make stops 1–7 a visible "first week", with an honest marker at stop 7.
3. **Visible rest day + streak repair:** show the auto-freeze as a labelled rest-day dot ("12 days, 1 rest day"); when a streak breaks, two talks in 48 h restore it; lead with best streak and weekly total, never a sad zero. A rest day never counts as practice.

Not now: leagues, an iOS widget (needs native target), currency wagers.
