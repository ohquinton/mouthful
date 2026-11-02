# WIP: Library remodel (mobile-engineer)

Branch: `worktree-agent-a7359e8ce59d150c7`, from main 7e66756. Owns only `src/app/(tabs)/library.tsx`,
`src/components/library/*`, this file, `test/library*.test.ts`.

## Plan
1. [ ] Pure helpers `src/components/library/libraryData.ts` (best Flow per topic, pack line tint, cold-read pick) + `test/library.test.ts`
2. [ ] Components: TopicTalks (level switcher + tiles/rows), PackCard, ShelfRow, ReadAloud (collapsed)
3. [ ] Rewrite `library.tsx` in the new order: topic talks → word packs → your words/scripts → read out loud → plan-for-it row
4. [ ] Checks: npm test, Kolkata tz, typecheck, lint
5. [ ] Web screenshots `docs/design/remodel/built/library-*.png` (390 light/dark, 375 light, empty state)
6. [ ] Handoff

## Next step
Step 1.
