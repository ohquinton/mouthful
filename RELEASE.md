# First internal TestFlight build

From release-privacy, 2026-10-28. No veto for an internal build. External TestFlight and the App Store
stay blocked until the privacy policy is hosted and its URL is in `src/brand.ts` and App Store Connect.

1. **Apple Developer Program approval.** Blocker until it arrives.
2. Sign the Paid Apps agreement; set up tax and banking.
3. Create the app in App Store Connect, bundle ID `ca.quintonjackson.mouthful`.
4. Create a subscription group with `mouthful_pro_annual` (7-day intro offer) and `mouthful_pro_monthly`, with localisations and review screenshots.
5. Users and Access → Integrations → In-App Purchase: generate the key, upload the .p8 and Issuer ID to RevenueCat. Create an App Store Connect API key for product import. Never commit a .p8.
6. RevenueCat: attach both products to the `pro` entitlement and to the `default` offering's `$rc_annual` / `$rc_monthly` packages.
7. `eas env:create --name EXPO_PUBLIC_REVENUECAT_IOS_KEY --value appl_… --environment production --environment preview --environment development --visibility sensitive` (EXPO_PUBLIC values can't be "secret"; check `eas env --help` for the exact flags in your eas-cli version).
8. `eas.json` build profiles name their environment (done).
9. Create a sandbox tester under Users and Access.
10. `eas build --profile production --platform ios`, then `eas submit`. Add yourself as an internal tester and install from TestFlight.
11. Sandbox matrix: annual with trial, monthly, cancel, restore, expiry. A sandbox account that already used the trial must see "Subscribe", not "Start free trial".

## Before external testers or the store

- Host `docs/privacy.md` (separate public `mouthful-site` repo with GitHub Pages) and put the URL in `src/brand.ts` and App Store Connect.
- App Privacy answers: `PRIVACY-ANSWERS.md`.
- Crash reporting (Sentry) is specced in STRATEGY.md's Wave 4 notes; adding it changes the policy and the privacy label.
- Bump the version per release.
