# Codex UI pass — 2026-11-01

Branch: codex/remodel. Base: Claude main 4c88ccc. Work performed in separate Codex Repo checkout and isolated railway/talk worktrees; Claude checkout untouched.

## Completed
- Animated daily Home railway, cobalt Drop, persisted Sharp Talk/Clear English selection, real local-date completion, Home tab, optional compact plan access.
- Public topic talk with calm ready/live layout, retained consent/retry/interruption behavior, validated stop IDs, wording records, simpler results and first-word trends.
- Topic-talk Progress history with same-version Flow summaries; other practice collapsed separately; filler charts filtered by speaking context.

## Validation
- TypeScript passed; Expo lint zero errors and 13 existing warnings.
- 43 suites / 708 tests passed. Jest emitted its existing open-handle warning before exiting successfully.
- Local Chromium: light 390x844 and dark 375x667; persisted line switch and correct talk stop parameter; seeded result returns to completed Home; Progress shows saved talk. No page runtime errors in these checks. Screenshots outside repo in C:/Users/ohqui/Downloads/Codex UI Review.
- Independent design review completed and its Progress findings addressed. Independent final QA agent hit usage limit before reporting; root reviewed integration instead. Native microphone, animation performance, VoiceOver and largest Dynamic Type remain unverified.

## Still unfinished
- Onboarding remains the existing first-read flow; genuine 30-second topic onboarding requires duration-aware scoring/history, not copy-only changes.
- Railway currently offers daily topic-talk stops, not a wired pack/read/Glide lesson sequence. Both lines currently use shared prompts.
- Weekly pooled vocabulary visualization, authored Rive character, and richer character expressions remain future work. No packages or paid services added.
- This is a completed bounded UI pass, not release sign-off or completion of the entire remodel.


## Combined Claude/Codex snapshot — 2026-11-01

Merged origin/main through d18dc60 into Codex history. Uses Claude's coherent numbered railway, shared Drop, 30-second onboarding, topic-talk/results contracts and latest QA fixes. Retains Codex topic-talk Progress/history, separate other practice, context-filtered fillers and initial loading state. Short talks are explicitly excluded from full-minute usual Flow and labelled in history. Removed obsolete duplicate daily-date railway component/helpers. Legacy saved sessions remain intact; date-based stops are not mapped into fabricated numbered completions.

Updated old Codex tests to use the new usualFor API; removed the superseded date-based route validator test (numbered stop contracts have their own tests). Typecheck passed; 44 suites / 791 tests passed. Independent agents reached usage limits during integration review, so this is root-validated integration, not independent QA sign-off.

Remaining review findings: verify recording opt-in actually produces and retains talk audio; remove any onboarding copy encouraging comparison of 30-second Flow with a full minute; check line attribution of historical untagged first talks. Native testing remains outstanding. Earlier unfinished list above describes the prior pass; onboarding and numbered lesson map now come from Claude's merged work.
