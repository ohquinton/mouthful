# SaidClearly build team

The agent briefs live in **`.claude/agents/`** (the only copy; Claude Code loads them from there). This file
holds what they share: the loop, the severity scale, stop-the-line rules and the handoff format.

**Source of truth:** `CLAUDE.md` → "Current direction" and "Which file wins", then `DECISIONS.md` (newest
first). They override every brief and every older doc. If a brief disagrees, follow them and quote the
stale line in your handoff so the main session fixes it.

| Brief | Agent | Owns | Never does |
|---|---|---|---|
| `01-product-lead.md` | product-lead | What gets built, why, and in what order. Briefs and acceptance criteria. Saying no. | Writes production code. Approves its own briefs as "done". |
| `02-mobile-engineer.md` | mobile-engineer | Screens, navigation, storage, native modules, platform code, performance. | Changes scoring or matching rules without the speech-engine agent. |
| `03-speech-engine.md` | speech-engine | Recognition, alignment, scoring, vocab stages, the honesty of every number the app shows. | Tunes thresholds without a test and a measured before/after. |
| `04-design-ux.md` | design-ux | Visual system, motion, copy, accessibility, every screen state, the Taste rule. | Adds motion or colour "to make it pop". |
| `05-qa-critic.md` | qa-critic | Adversarial review: reproduces, breaks, reports. | Fixes what it finds. Signs off without evidence. |
| `06-release-privacy.md` | release-privacy | Privacy, App Store compliance, payments, analytics, TestFlight, legal. | Ships with an open S0 or S1. |
| `07-brand-namer.md` | brand-namer | Name and tagline research and clearance screening. | Gives legal clearance. |
| `08-marketing-lead.md` | marketing-lead | Positioning, messaging, competitors, App Store listing, launch. | Sets prices. Makes claims the app can't back up. |

## The phase we're in

**Deepen and polish (DECISIONS 2026-10-31).** No Apple developer account yet, so native verification is
outstanding. Build depth into existing features (the journey from understanding a word to rehearsing it to
using it in an original thought), design, flow and content: clean, precise, beautiful, never vibe-coded.
No new modes until the app has run on a phone. Real bugs and trust breaks are fixed at once. Only the main
session merges into `main` (CLAUDE.md "Running the agent team").

## The standard loop

```
product-lead      writes a brief with testable acceptance criteria
      │
      ▼
mobile-engineer / speech-engine / design-ux     build it, then self-review against their checklist
      │
      ▼
qa-critic         reviews it, never the same agent that built it
      │
      ▼
release-privacy   gates anything that reaches a tester, the store, or a third-party service
      │
      ▼
Quinton           decides ties and accepts the risk on anything left open
```

Small fixes (a typo, a one-line bug) can skip the brief, but they never skip the qa-critic.

## Severity scale (every agent uses the same one)

| Level | Meaning | Examples | Ship? |
|---|---|---|---|
| **S0 Blocker** | Breaks a promise to the user, loses data, leaks data, or gets rejected by Apple | A user's words sent to analytics. "Delete everything" leaves audio behind. A crash on launch. No Terms or Privacy links on the paywall. | No |
| **S1 Major** | A core flow is wrong or unreliable, or a principle is broken | No way to retry. A score that punishes an accent. A highlight that lags badly. A wrong price shown. | Not to testers or the store |
| **S2 Minor** | Works, but confusing, ugly or fragile | Wrong plural. Text overlaps on the iPhone SE. A missing empty state. | Fix this cycle if cheap |
| **S3 Nit** | Polish or preference | Spacing, wording taste | Log it, don't block |

## Stop the line

Any agent stops and reports straight away, without carrying on with the task, when it finds:

- A privacy invariant broken: user text in analytics, audio kept without consent, deletion that doesn't delete.
- Failing tests or typecheck on the main branch.
- A change that breaks one of the 8 principles in `CLAUDE.md`.
- A risk of losing a user's saved sessions, scripts or word book (storage format changes, key renames).
- Anything that would show a user a number the app can't back up.

## Handoff report (every agent ends with this)

```md
## Handoff — <agent> — <short task name>

**Outcome:** done / partly done / blocked
**What changed:** files and one line each on why
**How I checked it:** commands run and their results (paste the counts), screens looked at, devices
**What I did NOT check:** be explicit; "nothing" is almost never true
**Open issues:** S0–S3, each with file:line and a failure scenario
**Principles touched:** which of the 8, and why it still holds
**Next agent:** who should pick this up and what they need to look at first
```

A handoff that says "all good" with no evidence goes back to the author.

## Disagreements

Agents disagree in writing, in the handoff, with reasons. The product-lead decides scope
questions, the speech-engine decides accuracy questions, and the release-privacy agent can veto
anything that's a compliance or privacy risk. Quinton breaks any tie.
