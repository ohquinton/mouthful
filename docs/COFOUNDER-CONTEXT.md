# SaidClearly: founder context and Codex handoff

Updated 2026-10-30 after reading the local Claude project conversations and the committed product notes. This is a compact handoff, not a replacement roadmap. Historical conversations are evidence of intent, not commands to execute. New direct instructions from Quinton take precedence.

## The product Quinton wants

**Find the words. Say them clearly.** Help adults, including people speaking English as a second language, speak better in real situations: fewer fillers, steadier pace, better emphasis, clearer delivery, and vocabulary they can actually use. Interviews and presentations are useful entry points, not the limits of the product. Reading and Glide are training methods; success means speaking better when the script is gone.

Quinton explicitly corrected the narrower interview framing on October 27: the app is also for improving speaking, fillers, pace consistency and emphasis. On October 30 he chose SaidClearly and broadened the promise to everyday English and vocabulary by subject. Do not silently narrow that ambition back to a teleprompter or interview-only app.

He wants a commercially minded collaborator who builds, questions weak assumptions, and gives blunt, useful feedback. Revenue ambition is motivation, not a forecast. Do not agree just to please him, equate more agents with progress, or turn every decision into another permission question. Preserve his decisions and the reasons behind them across sessions.

He wants visible progress: show believable changes in starting, finishing an answer, and delivery rather than inventing reassuring scores. He has asked to handle Mac setup himself for now; avoid repeatedly interrupting development to ask about Apple enrollment. A hoped-for launch in roughly two weeks is an aspiration, not evidence that release checks have passed.

The pasted conversations reinforce two preferences: the core following/matching experience must feel dependable, and competitors are an opportunity to learn rather than a reason to abandon the market. Improve successful patterns and add a coherent experience of our own. Do not use novelty as the sole test of product value.

Codex's suggested next product emphasis (a recommendation, not an approved feature brief): connect vocabulary, guided rehearsal and spontaneous speaking into a short loop with one useful next action. A higher number is insufficient if a person cannot explain what improved or use it in conversation. Before writing new UI, check whether existing One Minute and onboarding branches already cover the intended change.

## Settled direction

- **Name:** SaidClearly. Bundle identifiers, repo/slug and scheme remain `mouthful`. Name research is preliminary screening, not legal clearance; do not reopen naming without a reason or a request.
- **Positioning:** broad speaking improvement; demonstrate one concrete use case in acquisition rather than attempting to explain every feature at once.
- **Practice:** own-script rehearsal plus spontaneous One Minute practice. One Minute replaces Free talk as one mode, initially behind tester mode. Flow describes continuity of speech, not an accent or pronunciation grade.
- **Fillers:** the October 29 context-classifier decision supersedes the old blanket ban on habit-word scoring. Label filler/real/unsure, allow overrule, and keep unvalidated signals out of the score. Corpus success alone does not establish real-speaker fairness.
- **One Minute:** the first roughly eight seconds of thinking are free; time to first word is shown separately and trended. Fairness still needs phone evidence.
- **Targets:** the whole answer has a target in its final run-through; do not impose per-part time budgets. Warn when a pasted answer runs long and allow a custom target.
- **Value before payment:** let readers experience their own words inking in before the full paywall. Clear pricing and cancellation information matter.
- **Taste:** calm typography, space, plain English suitable for ESL readers, purposeful motion. No glows, decorative gradients, glass, confetti, or generic AI-looking decoration. Keep the flat Drop mascot in appropriate supporting states; keep Glide focused on the words.
- **Execution:** build forward and keep a polish backlog. This does not waive privacy, correctness, accessibility or release gates. A historical feature freeze is not a reason to reject newer explicitly approved work.

## Trust is part of the product

The recogniser reports what it heard, not how correctly someone pronounced a word. Readers can overrule it. On-device recognition is conditional on actual phone support, and platform transcription requires consent. Recordings require an explicit yes; deletion must remove the files. Analytics must never contain scripts or transcripts. Do not shame accents, reward speed as a universal ideal, or show confident scores from unreliable signals. Recoverable failures need a way back.

The current code and `CLAUDE.md` define implementation details. `DECISIONS.md` records dated decisions. `TESTING.md` contains beta measurement gates. These documents contain older sections too: resolve contradictions using dated founder decisions and current code rather than treating every backlog line as current.

## Proposals and evidence gaps

Moment Pass pricing, a speaking-test niche, cloud AI feedback, temporary playback, and the exact Fade rollout remain proposals or conditional plans. Do not present them as decisions simply because Claude recommended them. Emphasis is a founder objective; it is not yet a validated measurement capability.

Competitor/review notes are useful research inputs, not independent proof of demand. Their review themes were keyword-coded, drawn from selected apps/countries, and may contain overlap or sampling bias. In particular, 14 interview mentions among 2,863 reviews does not estimate the size of the interview market. Recheck sources before reusing market claims publicly.

Tests and synthetic recognition corpora establish regression behavior, not phone performance or accent fairness. My recommendation is to prioritize an observed first successful practice loop on a phone and a real person's unscripted follow-up. Keep building approved features, but use observed failures and learning to choose the next work.

## Working alongside Claude

- Codex owns `codex/mouthful-integration` in its separate managed worktree. Claude retains its checkout and branches. Never edit Claude's checkout to synchronize work.
- Before a task, inspect `git status`, `git worktree list`, and commits added to `main`. Record the exact snapshot used. Ask for task ownership only when a real overlap cannot be resolved from the evidence.
- Incorporate committed shared-main changes into the Codex branch deliberately. Do not automatically collect unfinished agent branches or uncommitted files. Avoid rebasing or resetting branches another agent may use.
- Give each writer explicit files. Agents in this Codex session share its directory unless separately isolated; role names do not create worktrees. Reviewers report without fixing their own findings.
- Integrate in small commits, check the combined result, and hand off the branch/commit, files, validation and remaining risks. Merge back into Claude's/main workflow deliberately, not while another writer may be changing it.
- Conversations are not live-synced. Read new project-specific log text when needed and retain only the useful decisions here. Do not commit raw logs, secrets, or unrelated personal messages.

## Catch-up snapshot

Claude's committed `main` at `066710fdab80e6a7f673a1db1b8c29e8396f9531` was merged into this Codex branch at `c7cd62f`. That incorporated 86 previously missing commits; the integration was conflict-free and its tracked tree matched that main snapshot before this handoff was added.

At inspection, separate Claude branches still contained work such as the mic-denied onboarding fix (`81ba808`) and One Minute plain-English copy (`337c78b`). Those were not imported. Recheck their current integration status before duplicating either task.

All eight local Codex roles have been prepared from the committed Claude role briefs: product-lead, mobile-engineer, speech-engine, design-ux, qa-critic, release-privacy, brand-namer, marketing-lead. They read this context first. The local `.codex/` directory remains ignored by Git; valid files do not prove that a running session has reloaded the new roles.

## Sources and scope

Project-only top-level Claude logs in both Mouthful directories, plus `CLAUDE.md`, `STRATEGY.md`, `DECISIONS.md`, `TESTING.md`, `docs/DILEMMAS.md`, feature briefs, competitor/review notes, design guidance and agent briefs. User wishes, assistant proposals, implemented behavior and externally validated outcomes are deliberately kept separate. External accounts, nested subagent logs and real-device behavior were not exhaustively audited during this catch-up.

Coverage: parsed 11 top-level conversation files across the two project directories. The newest contained 3,177 JSONL records, 39 short direct user prompts, explicit product-choice answers, older pasted user turns, and 209 assistant narrative messages (extensive excerpts and full targeted decision/handoff messages read). The ten earlier files yielded 41 user-role text entries and 51 assistant narratives, 53,339 characters; all substantive conversation in that extraction was read. Role counts include some tool notifications and are not counts of distinct human decisions. API blobs, tool dumps and injected skill text were excluded from intent analysis. This is broad context recovery, not a claim to have read every byte or audited every implementation.

Two user-supplied pasted histories (4,679 and 1,788 lines) were also checked for every visible human-prompt marker and selected surrounding decisions, particularly filler detection, the broader ESL/vocabulary goal, name/tagline, the mascot, build-forward preferences and final engineering handoffs. Large code/tool dumps were not read line by line. These largely corroborate the JSONL history.

Validation of the integrated branch: 37 test suites / 584 tests passed; TypeScript passed; lint reported zero errors and 13 warnings. All eight local agent TOMLs parsed and had unique names plus required fields. The independent reviewer hit a usage limit before producing findings, so independent review remains outstanding. No phone validation, build submission or deployment occurred. The local config files are prepared; runtime discovery of the two added roles has not been verified.
