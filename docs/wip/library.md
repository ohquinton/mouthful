# WIP: Library remodel (mobile-engineer)

Branch: `worktree-agent-a7359e8ce59d150c7`, from main 7e66756. Owns only `src/app/(tabs)/library.tsx`,
`src/components/library/*`, this file, `test/library*.test.ts`. Paused on the coordinator's wrap-up
(usage), 2026-11-01. At this point: `npm test` 807 pass (791 + 16 new), typecheck clean, lint clean on `src/components/library`.

## Plan
1. [x] Pure helpers `src/components/library/libraryData.ts` (best Flow per topic, same Flow version + full
   minutes only; pack line tint; shelf copy; cold-read pick) + `test/library.test.ts` (16 tests)
2. [x] Components, built but NOT wired into the screen yet and not seen on screen:
   - `TopicTalks.tsx`: heading, Drop empty state, Everyday / Ideas / Bigger topics switcher, 2-col tiles
     (levels 1–2) or full-width rows (level 3), "Best 76" + check in line colour
   - `PackCard.tsx`: line-soft tint + "On Sharp Talk" when a line uses the pack, FREE pill / ProBadge, progress bar
   - `ShelfRow.tsx`: icon row (Your words, Your scripts, Cold read)
   - `ReadAloud.tsx`: collapsed by default; cold read row + passages by level (today free, rest locked)
3. [ ] Rewrite `src/app/(tabs)/library.tsx` in this order: header "Library" (Bricolage 34) → `<TopicTalks>`
   (level state from `defaultLevel(profile.line)`; records from `topicRecords(loadSessions())`; onOpen →
   `router.push(topicRoute(p.id))`) → "Word packs" heading + horizontal `<PackCard>` list (line =
   `packLine(p.id, lineOf(profile.line))`, done = `packDone(p, book)`, press → `/pack/[id]`) → `<ShelfRow>`
   Your words (`/words`, `wordsMeta`) and Your scripts (`/scripts`, `scriptsMeta` with `loadScripts()`) →
   `<ReadAloud>` (onRead: today's passage or `requirePro(profile,'library')` → `/session/[id]`; onColdRead:
   `requirePro(profile,'cold')` then `/session/[id]` with `cold: '1'` on `coldReadPick(PASSAGES, sessions)`)
   → the "Got something coming up? Plan for it" row (`/moment`, copy Home's `planRow` style).
   Load sessions, book and scripts in one `useFocusEffect`.
4. [ ] Checks: npm test, `MOUTHFUL_TEST_TZ=Asia/Kolkata npm test`, typecheck, `npx expo lint`
5. [ ] Web screenshots `docs/design/remodel/built/library-*.png` (390×844 light + dark, 375×667 light, empty state)
6. [ ] Handoff

## Next step
Step 3: wire the components into `library.tsx` as above.
