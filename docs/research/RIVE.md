# Rive for the Drop coach (research, 2026-11-01)

> From the research agent. Evidence, not orders. Prices read from search excerpts; check the live page before paying.

## Cost
- Since 20 Oct 2025 the free Rive plan can't export at all (the editor stays free). Cadet: $9/mo billed annually (~$108/yr); docs say $17/seat/mo billed monthly. Exported files keep working after you cancel. Student plan excludes commercial use. Sources: https://rive.app/blog/rive-s-new-9-mo-plan , https://rive.app/docs/account-admin/pricing
- Cheapest path: design in the free editor, pay one month, export every .riv, cancel. Each later re-export means paying again. Runtime is MIT.

## Runtime (`@rive-app/react-native`, checked 2026-11-01)
- 0.5.9 (2026-10-29), pre-1.0, 7 releases in October: pin an exact version. Needs RN 0.78+, Expo SDK 53+, iOS 15.1+, Xcode 16.4+. Nitro modules (New Architecture only, which SDK 58 is). Not in Expo Go: needs a dev build. No config plugin needed (autolinking).
- **Version trap on RN 0.88:** peer `react-native-nitro-modules >=0.35.10 <0.37`, but Nitro latest is 0.37.1. Pin Nitro 0.36.x (≥ 0.36.2; RN 0.87+ needs it, issue https://github.com/rive-app/rive-nitro-react-native/issues/378). No source states RN 0.88 / SDK 58 support: unverified until a dev build.
- **No web implementation.** `@rive-app/canvas` is only used by its type generator. The browser preview needs our own `Coach.web.tsx` (e.g. `@rive-app/react-canvas`, unchecked) or the static Drop.

## Alternatives
- **Reanimated + react-native-svg (recommended now):** $0, already installed, works on web and in Expo Go, testable today. The Drop is flat with no mouth, so squash/stretch, blink, lean and hop are a few paths plus springs. Hand-coded states, no designer handoff.
- **lottie-react-native 7.5.0** (Apache-2.0; needs RN ≥ 0.84, React ≥ 19.2): plays timelines; input-driven state machines confirmed for dotLottie on web/Flutter, not React Native.

## Recommendation
Build the Drop's coach states in Reanimated + SVG now (also the static fallback Rive would need). Spend the one Rive month only once a phone build exists and the Reanimated Drop feels limiting.
