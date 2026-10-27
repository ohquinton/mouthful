# App Store Connect: App Privacy answers

Draft from release-privacy, 2026-10-28. Not legal advice. Re-check whenever an SDK or data flow changes.

## Beta build (supervised TestFlight)

PostHog key empty, Sentry on (once added), RevenueCat in sandbox.

| Data type | Collected? | Linked to user? | Tracking? | Purpose | Why |
|---|---|---|---|---|---|
| Purchases → Purchase History | Yes | No (anonymous RevenueCat IDs only) | No | Analytics, App Functionality | RevenueCat's guidance says select both purposes. |
| Diagnostics → Crash Data | Yes, once Sentry ships | No | No | App Functionality | Sentry config drops breadcrumbs, user, locale; IP storage off in Sentry. Don't declare Performance Data while tracing is 0. |
| Audio Data | No (iOS) | n/a | n/a | n/a | On-device processing isn't "collected". On the server path, Apple's Speech framework sends the audio, and Apple says developers aren't responsible for disclosing data Apple collects. Keep this reasoning on file. |
| Everything else | No | | | | Sessions, scripts and recordings stay on the phone. |

## Launch

As above, plus:

| Data type | Collected? | Linked? | Tracking? | Purpose | Note |
|---|---|---|---|---|---|
| Usage Data → Product Interaction | Only if the PostHog key is set | No, **if** PostHog IP capture is off | No | Analytics | Otherwise ask a lawyer (below). |
| Audio Data (Android only) | Declare conservatively | No | No | App Functionality | Google's recogniser isn't covered by Apple's sentence. |

No IDFA, no App Tracking Transparency prompt.

## Questions for a lawyer

- Under PIPEDA, does an IP address plus a random install ID count as personal information?
- Does audio sent by SFSpeechRecognizer server recognition count as data our app collects?
- Does the policy need to name Apple and Google as speech processors, and does analytics tied to a random ID need opt-in?
