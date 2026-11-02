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

Codex checkpoint (2026-11-02): synced main through `845e332` into `codex/remodel`.
Library wiring remains unfinished in `C:/Users/ohqui/Downloads/Codex Library`
(`codex/library-finish`); the talk layout from `C:/Users/ohqui/Downloads/Codex Recording`
(`codex/talk-recording`) was reviewed and copied into the current Rive integration slice.
The original worktree is preserved. Library remains unfinished and is not included.

**Rive Drop (2026-11-02):** source in `design/rive/drop/` (README there). Five moves built and verified; not wired into the app.

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

## Codex validation, 2026-11-02
- TypeScript passed; onboarding tests: 28 passed; lint: no errors, 13 existing warnings.
- Rive CLI verify/build: no errors or warnings; rendered happy, thinking and happy-to-idle reset.
- First talk retains its selected line; onboarding hook scrolls; Progress shows prompt titles.
- Rive Coach modes are controllable, with interrupted-pose resets. Native integration, live audio, reduced-motion handling and device checks remain outstanding.

## Rive integration slice, 2026-11-02

- Native topic-talk footer now uses the bundled script-free Rive Drop. Web remains SVG.
- Native fallback covers missing module, file/instance/property/view errors, reduced motion,
  background and lost focus. Reduced Motion is observed live. No new audio/data flow.
- Rive 0.5.10 and Nitro 0.36.5 pinned; Metro includes .riv; local build script in scripts/build-coach.ps1.
- Talk-screen scroll, level-3 ideas and direct-link Close recovery integrated from the paused worktree.
- TypeScript and lint passed (13 existing warnings). All 46 suites / 801 tests passed;
  Jest printed its existing open-handle warning but the root command exited successfully.
- Expo export succeeded for iOS, Android and web, including the 3.8KB asset. Export warned about
  expo-router's existing router-store package export and used file-based resolution.
- Independent QA found no blocking static issue. CLI verify/inspect/render passed; bundled asset matches.
- Browser layout check was blocked by automatic approval review with no detailed reason;
  the expected browser automation tools were unavailable. No fresh browser sign-off is claimed.
- Native compilation and phone rendering remain unverified. No EAS build, release or OTA was sent.
- Native integration checklist and limitations: design/rive/drop/README.md.

## Library completed on Codex branch, 2026-11-02

The earlier Library WIP status above is superseded: foundations and screen wiring are
integrated on `codex/remodel`. `Codex Library` remains preserved for provenance, not
pending integration. See docs/wip/library.md for exact coverage and remaining phone checks.
Onboarding's first talk now offers Skip for now before starting the mic; the existing
skip handler finishes onboarding without fabricating a completed stop or session.
Cold-read paywall copy now describes no-preview practice, without promising never-seen content.

The supported browser tool is working with Metro on port 8095. Verified dark phone-width
Library, topic selection/navigation, compact long-prompt layout, refocus, cold-read Pro gate
and first-talk skip. Earlier browser-unavailable notes describe the previous checkpoint.
Native Rive and microphone verification remain outstanding; no native release was sent.
