# In flight

The one place that says what is running right now and how to resume it. The main session updates this
whenever a task starts, checkpoints or finishes. If a session or agent was cut off (usage limit, crash),
read this first, then the task's branch log.

**Usage rule:** the main session checks plan usage (`get_usage`) whenever an agent reports. At ≥ 90% of the
weekly limit or ≥ 85% of the 5-hour limit: start nothing new, tell running agents to commit and stop, and
update this file. Builders commit after every finished step; read-only agents send findings section by
section, so a cutoff loses at most one step.

**Resume a task:** check its branch (`git log main..<branch>`) and `git status` in its worktree, don't redo
finished steps, continue from "Next step". Never `git worktree remove` a worktree with a `node_modules`
junction (CLAUDE.md team rule 8).

_Last updated 2026-11-01 wrap-up. Usage then: 5-hour ~60%, weekly ~77% (resets Nov 6)._

| # | Task | Who | Branch / output | Status | Next step |
|---|---|---|---|---|---|
| 3 | Library remodel | mobile-engineer | **`wip/library-remodel`** on GitHub (3 commits on 7e66756; helpers + 4 components + 16 tests; plan in `docs/wip/library.md` on the branch) | **Paused at step 2 of 6.** The tab on screen is unchanged; components exist but aren't wired | Step 3: rewrite `src/app/(tabs)/library.tsx` (header → TopicTalks → PackCards → Your words / Your scripts → ReadAloud → Plan for it row), then Kolkata tests + full lint, web screenshots `library-*.png`, merge |

Nothing else is running (2026-11-01 wrap-up).

## Done recently (for context)
- 2026-11-01 wrap-up: "If you get stuck" ideas for all 36 prompts (merged); research saved in `docs/research/` (RIVE, WORD-LIST, RETENTION, COMPETITORS-UPDATE-2026-11); marketing saved in `docs/marketing/` (APP-STORE-LISTING, WAITLIST-PAGE). 797 tests.
- Remodel built and QA-fixed: onboarding, the two-line Home map, topic talk + results, one shared Drop.
- Codex's Progress ("Your voice, over time") reviewed and merged; main at 1cd9a39.

## Queued after these
- Level 3 prompts hide their ideas on the talk screen (`talk.tsx:273`, `long = level === 3`): decide whether to show them.
- Prompts p25, p31, p33 assume the speaker has a job (content writer, S3).
- **Clear English promises content that doesn't exist** (marketing): the onboarding card says "Say this, not that / Everyday words, said clearly", but all 7 packs are work-themed and Clear English stop 2 is "Run the Meeting". Decide: write 2–3 everyday packs, or soften the card.
- **Retention (research, docs/research/RETENTION.md):** smarter reminders (stale `reminders.ts` copy, fires even after practice), a day-2 hook after each talk, a visible rest day + streak repair.
0. Clear English line on Home (from marketing): `home-day2-clear-light.png` shows a duplicate "Sharp Talk >" chip under the switcher, and a work pack ("Run the Meeting") as Clear English stop 2. Check `content/lines.ts` and HomeMap.
1. Home polish: the line crossing done labels; today's card sitting low after a long run of done stops.
2. Progress per-skill trend lines (fillers, repeated words, start time, pace) from the approved mockup.
