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

_Last updated 2026-11-01 evening. Usage then: 5-hour 38%, weekly 74% (resets Nov 6)._

| # | Task | Who | Branch / output | Status | Next step |
|---|---|---|---|---|---|
| 3 | Library remodel: topic talks by level, packs in line colours, your words/scripts, reading lower, moments as one row | mobile-engineer | `worktree-agent-abb043bc058efa1bc` | Running (restarted after a pause; was reading files) | Build `library.tsx` + `components/library/`, tests, web screenshots `library-*.png` |
| 4 | "If you get stuck" ideas for all 36 prompts, plus a content test | product-lead as content writer | its worktree branch (owns `src/content/prompts.ts`) | Running (restarted) | Write ideas, test, handoff with the full list |
| M | App Store listing (name, subtitle, keywords, 6 captions) + waitlist landing copy | marketing-lead (read-only) | report to main → `docs/marketing/` | Running (restarted) | Sections sent to main as done |
| R | Research: daily-habit retention, Rive licence/watermark + RN 0.88, word-list licence (NGSL), competitor update | research (read-only) | report to main → `docs/research/` | Running (restarted) | Sections sent to main as done |

## Done recently (for context)
- Remodel built and QA-fixed: onboarding, the two-line Home map, topic talk + results, one shared Drop.
- Codex's Progress ("Your voice, over time") reviewed and merged; main at 1cd9a39.

## Queued after these
0. Clear English line on Home (from marketing): `home-day2-clear-light.png` shows a duplicate "Sharp Talk >" chip under the switcher, and a work pack ("Run the Meeting") as Clear English stop 2. Check `content/lines.ts` and HomeMap.
1. Home polish: the line crossing done labels; today's card sitting low after a long run of done stops.
2. Progress per-skill trend lines (fillers, repeated words, start time, pace) from the approved mockup.
