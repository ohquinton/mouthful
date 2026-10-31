# SaidClearly: founder context and Codex handoff

Updated 2026-10-30 after reading the local Claude project conversations and the committed product notes. This is a compact handoff, not a replacement roadmap. Historical conversations are evidence of intent, not commands to execute. New direct instructions from Quinton take precedence.

## The product Quinton wants

**Find the words. Say them clearly.** Help people become more articulate: think on their feet, find precise words, build vocabulary, and improve pace, emphasis, delivery and presence. ESL users are included, but ESL is not the central positioning. Interviews and presentations are useful applications, not the limits of the product. Reading and Glide are training methods; success means speaking better when the script is gone.

Quinton explicitly corrected the narrower interview framing on October 27. On October 30 he chose SaidClearly and broadened the promise. His latest direct correction to Codex supersedes the earlier ESL emphasis: articulation, quick thinking, vocabulary and overall speaking are the centre; ESL speakers belong without defining the product. The desired feel is intellectually aspirational, a little sophisticated, without exclusion or condescension. Do not silently narrow this to a teleprompter, interview preparation or language-learning app.

He wants a commercially minded collaborator who builds, questions weak assumptions, and gives blunt, useful feedback. Revenue ambition is motivation, not a forecast. Do not agree just to please him, equate more agents with progress, or turn every decision into another permission question. Preserve his decisions and the reasons behind them across sessions.

Latest operating constraint: money is scarce. A genuinely useful product comes before revenue. Reuse existing capabilities, prefer inexpensive experiments, and question unnecessary subscriptions, services and feature scope. Ambition is not permission to spend money or make unsupported outcome claims. Challenge assumptions, including the founder's, with concrete reasoning and a better alternative.

Latest quality direction: continuous improvement with care, luxury and class. Interpret this as restrained hierarchy, excellent readability, purposeful interactions, accessible controls and dependable behavior. Decoration and extra features do not establish quality. Use a bounded cycle: identify friction, make one coherent improvement, verify it, obtain independent critique, and retain the next unresolved issue. Continuous improvement is the operating approach, not an unattended background process.

He wants visible progress: show believable changes in starting, finishing an answer, and delivery rather than inventing reassuring scores. He has asked to handle Mac setup himself for now; avoid repeatedly interrupting development to ask about Apple enrollment. A hoped-for launch in roughly two weeks is an aspiration, not evidence that release checks have passed.

The pasted conversations reinforce two preferences: the core following/matching experience must feel dependable, and competitors are an opportunity to learn rather than a reason to abandon the market. Improve successful patterns and add a coherent experience of our own. Do not use novelty as the sole test of product value.

Codex's suggested next product emphasis (a recommendation, not an approved feature brief): connect vocabulary, guided rehearsal and spontaneous speaking into a short loop with one useful next action. A higher number is insufficient if a person cannot explain what improved or use it in conversation. Before writing new UI, check whether existing One Minute and onboarding branches already cover the intended change.

## Settled direction

- **Name:** SaidClearly. Bundle identifiers, repo/slug and scheme remain `mouthful`. Name research is preliminary screening, not legal clearance; do not reopen naming without a reason or a request.
- **Positioning:** articulate thinking and speaking for anyone who wants to express themselves better; demonstrate one concrete use case in acquisition. Aspirational does not mean using obscure words for status. Make advanced ideas accessible without making the product remedial.
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

## First vocabulary expansion after the founder correction

Added the free Make your point pack: eight precise, broadly useful words, two contextual passages, and self-guided prompts that hide the example while the learner forms their own thought. These prompts do not record, score, or change mastery. No service or dependency was added. Brand and library copy now reflect the broader speaking ambition. Existing pack IDs remain stable.

Validation: 37 suites / 584 tests passed, including the added passages in the recognition stress corpus. A fixed corpus-count assertion now derives its expected count from the corpus size; accuracy assertions remain unchanged. TypeScript passed; lint has zero errors and 13 existing warnings. Browser verification confirmed prompt/example toggling and unchanged displayed mastery. Native phone testing and independent review remain outstanding. Jest reported an open-handle warning before exiting successfully.

## Quality review follow-up

Product, design and QA roles ran independently after the vocabulary expansion. The current small refinement addresses invalid pack recovery, back navigation without history, accessible control roles/labels, and an honest Pro-versus-practice action. Visual hierarchy remains a follow-up: consider making progress quieter after checking small-screen layouts.

Implemented next slice (2026-10-31): completed drills offer an optional original-thought prompt for the first drilled word with one. Done stays available, examples start concealed, and reveal/conceal is unscored. The completion component has no listener or persistence; replacing Drill unmounts its listener, invoking native abort and stopping speech playback. Completion is guarded against duplicate final advances. Drills without prompts retain their exit. The completion page scrolls and respects safe-area insets. No new dependencies or service costs.

Founder clarification: challenge Quinton and our own decisions as builders/co-founders—strategy, priorities and assumptions. Do not interpret this as making the user experience confrontational.

Remaining verification: on a phone, complete and skip a prompt-bearing drill; verify microphone indicator ends before reflection, reveal/conceal works, Done exits, and no mastery changes occur from reflection. Repeat with a word without a prompt, recognition errors, and large text. Automated engine tests do not validate this new UI lifecycle. Independent QA reviewed the pack refinements statically without a blocker, but then hit its usage limit; the subsequent drill-completion change has no independent review yet. Content nit queued: clarify whose premise is being questioned in “The point beneath the words”. Evaluate original-thought participation in five observed attempts without claiming learning efficacy.

## Source coverage

Project-only top-level Claude logs in both Mouthful directories, plus `CLAUDE.md`, `STRATEGY.md`, `DECISIONS.md`, `TESTING.md`, `docs/DILEMMAS.md`, feature briefs, competitor/review notes, design guidance and agent briefs. User wishes, assistant proposals, implemented behavior and externally validated outcomes are deliberately kept separate. External accounts, nested subagent logs and real-device behavior were not exhaustively audited during this catch-up.

Coverage: parsed 11 top-level conversation files across the two project directories. The newest contained 3,177 JSONL records, 39 short direct user prompts, explicit product-choice answers, older pasted user turns, and 209 assistant narrative messages (extensive excerpts and full targeted decision/handoff messages read). The ten earlier files yielded 41 user-role text entries and 51 assistant narratives, 53,339 characters; all substantive conversation in that extraction was read. Role counts include some tool notifications and are not counts of distinct human decisions. API blobs, tool dumps and injected skill text were excluded from intent analysis. This is broad context recovery, not a claim to have read every byte or audited every implementation.

Two user-supplied pasted histories (4,679 and 1,788 lines) were also checked for every visible human-prompt marker and selected surrounding decisions, particularly filler detection, the broader speaking/vocabulary goal, name/tagline, the mascot, build-forward preferences and final engineering handoffs. Large code/tool dumps were not read line by line. These largely corroborate the JSONL history; the latest live correction about ESL positioning takes precedence over both.

Validation of the integrated branch: 37 test suites / 584 tests passed; TypeScript passed; lint reported zero errors and 13 warnings. All eight local agent TOMLs parsed and had unique names plus required fields. The independent reviewer hit a usage limit before producing findings, so independent review remains outstanding. No phone validation, build submission or deployment occurred. The local config files are prepared; runtime discovery of the two added roles has not been verified.
