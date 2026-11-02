# Library remodel checkpoint

Integrated on `codex/remodel`, 2026-11-02. Claude's three committed foundation steps
were cherry-picked; Codex's isolated pending screen/components were reviewed and copied.
The original `Codex Library` worktree is preserved; its local changes are now superseded
by this integrated branch and must not be blindly merged again.

## Implemented
- Topic talks by category, free full-minute routes, comparable best Flow per topic.
- Word-pack cards with line labels, honest comfort progress and Free/Pro labels.
- Saved words and scripts with loading/empty metadata.
- Expandable reading shelf; consistent displayed free passage and gate.
- Cold reads wait for refreshed history, retain Pro gating and announce that requirement.
- Responsive single-column treatment at large font scale; no title truncation.
- Fixed corrupted punctuation, false not-tried loading labels and unseen-passage promises.

## Validation
- TypeScript passed; lint has no errors and 13 existing warnings.
- Toronto: 47 suites, 817 tests passed.
- Kolkata: 47 suites, 807 passed, 10 timezone-specific tests skipped.
- Browser: dark 390x844 Library, 320x568 shelves and long-prompt talk; category switch,
  topic route, Close return, tab refocus, cold-read paywall/dismiss, onboarding skip.
- Independent static QA found no blocker. Its remaining stale-history-on-refocus note
  was fixed by clearing ready before each focused reload.

## Still needs device/visual coverage
Light theme, native Dynamic Type/VoiceOver, populated history/progress screenshots,
and native speech/Rive behavior. Browser checks did not start a microphone or purchase.
