# Mouthful

That word’s a mouthful. Make it yours.

## Run it on your iPhone (from Windows, no Mac needed)

The app uses the phone's speech recogniser, which Expo Go doesn't include, so you need a
**development build** once. After that, code changes reload instantly over Wi-Fi.

1. **Install and check**
   ```bash
   npm install
   npm test
   npm run typecheck
   ```
2. **Expo account:** sign up free at expo.dev, then `npx eas-cli@latest login`.
3. **Apple Developer account** ($99 USD/yr) is needed to install on a real iPhone.
4. **Register your iPhone:** `npx eas-cli@latest device:create`, then open the link on the phone.
5. **Build:** `npx eas-cli@latest build --profile development --platform ios` (cloud build, about 10–20 min).
   Open the link on the iPhone to install. On iOS 16+, turn on Settings → Privacy & Security → Developer Mode once.
6. **Run:** `npx expo start`, then open Mouthful on the phone (same Wi-Fi, or `npx expo start --tunnel`).

Rebuild (step 5) only when you add a package with native code or change `app.json` plugins.

## Keys (optional until launch)

Copy `.env.example` to `.env`.

- **RevenueCat** (subscriptions). In App Store Connect create two auto-renewing subscriptions:
  `mouthful_pro_annual` ($39.99/yr with a 7-day free trial) and `mouthful_pro_monthly` ($6.99/mo).
  In RevenueCat: add the app, import the products, create the entitlement `pro`, and put both
  products in the `default` offering as the Annual and Monthly packages. Paste the public iOS key into
  `EXPO_PUBLIC_REVENUECAT_IOS_KEY`. Without a key, development builds unlock Pro locally for testing
  and production builds refuse to sell anything.
- **PostHog** (analytics). Create a project, paste its API key into `EXPO_PUBLIC_POSTHOG_KEY`.
  Without a key nothing is sent. Only event names, numbers and short codes are sent, never transcripts, audio
  or script text. `track()` drops any other text property before it leaves the phone.

## Quick look in a browser

`npx expo start --web`, then open it in Chrome. Chrome's speech recognition works there (it asks
first, because the browser sends audio to Google). Recording and voice levels only work on the phone.

## Testing

See TESTING.md for the controlled phone beta. Tester mode (record every session, review against the
recording) is hidden: tap the version line on the You tab 7 times.
To see onboarding again: You tab → Reset all data.
