# Engine fixtures

Data only (JSON): Jest runs every `.ts` file under `__tests__` as a test suite, so fixture logic lives
in the test that uses it. No tester data here. Every transcript is generated or typed from the
built-in passages, the scripts below or text written for the test. Tester recordings and scripts
never leave the phone (see TESTING.md).

| Fixture | What it is | Failure type | Fixed? | By |
|---|---|---|---|---|
| `memory-scripts.json` | The Fade experiment's 8 work scripts (interview, meeting, raise, presentation) with from-memory variants: fillers dropped, a clause dropped, synonyms, two sentences swapped plus one paraphrased. Ported from branch `worktree-agent-a8f8e4f1d0fc2114a`, commit de4351f. | Lost pointer after a dropped clause or reordered sentence (today: 42–51% inked) | y | Glide resync (`align.ts`), `resync.test.ts` |
| `repeated-phrases.json` | 6 adversarial scripts built from repeated phrases ("the project … the project", "we need to …" ×4, a First/Second/Third list, "I think" ×4, "the report is late" ×3, a sentence said twice). The test skips, re-reads and stutters through every position. | False green from anchoring on the wrong copy of a phrase | y (0 false greens in 2,050 cases) | Glide resync |

Generated in `resync.test.ts` from all 25 built-in texts (passages, Day 1 baseline, Word Pack
passages, moment placeholders) plus the 8 scripts:

| Case set | Count | Failure type | Fixed? |
|---|---|---|---|
| Verbatim, every prefix | 37 texts | Regression guard: must equal the pre-resync aligner word for word | n/a (unchanged) |
| Skips of 6, 10, 20, 40 words at every position | 5,188 | Lost pointer (today ~50% of said words red) | y |
| Whole-sentence skips | 89 | Lost pointer | y |
| Re-read of the previous sentence (3 shapes, one with an aside) | 342 | False jump forward, pointer regress | y |
| Digits, contractions, homophones, one-letter-off on the above | sampled | Resync on noisy recogniser output | y (no new reds or greens) |
| Interim revisions (each word first arrives as a wrong guess; every 7th, two words rewritten) | sampled | Red↔green flicker | y, except backfill (see resync.test.ts §6) |
