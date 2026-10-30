# Run Mouthful on your iPhone from the Mac

For Quinton's MacBook Air (M2). Uses a **free Apple ID**: no Apple Developer Program needed to run on your
own phone. The catch: the app stops opening after **7 days**, so rebuild weekly (step 9). TestFlight and
other testers' phones still need the paid account (RELEASE.md).

Requirements for Expo SDK 58 (docs.expo.dev/versions/v58.0.0): **Xcode 26.4+**, **Node 22.13+**, iPhone on
**iOS 16.4+**.

**Shortcut:** after installing Xcode (step 1), copy `scripts/setup-mac.sh` to the Mac and run `bash setup-mac.sh`. It does steps 2–6 and stops with a plain message whenever it needs you.

## 1. Xcode

1. Xcode → About Xcode: version must be **26.4 or newer**. If not, update it in the App Store.
2. Open Xcode once and let it install its components. If it asks for the iOS platform, install it.
3. Xcode → Settings → **Accounts** → **+** → Apple ID → sign in with your normal Apple ID. You'll see
   "(Personal Team)". That's the free signing account.
4. In Terminal: `xcode-select -p` should print a path inside `Xcode.app`. If it doesn't:
   `sudo xcode-select -s /Applications/Xcode.app`.

## 2. Tools (Terminal)

```bash
# Homebrew (skip if `brew -v` works)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install node gh cocoapods
node -v        # must be 22.13 or newer
gh auth login  # GitHub.com → HTTPS → Yes → Login with a web browser
```

## 3. Get the code

```bash
mkdir -p ~/dev && cd ~/dev
gh repo clone ohquinton/mouthful
cd mouthful
npm ci         # also applies patches/ (the iOS speech patch)
```

## 4. Keys (`.env`)

`.env` is never in git. Copy it from the Windows machine
(`C:\Users\ohqui\Downloads\mouthful-app\mouthful-app\.env`) with AirDrop or a USB stick into `~/dev/mouthful/`.
Don't paste keys into chats or commits.

- `EXPO_PUBLIC_SENTRY_DSN`: keep it, so the tester-mode "Send a test crash report" works.
- `EXPO_PUBLIC_REVENUECAT_IOS_KEY`: **leave it out for now.** Real purchases need the paid Apple account.
  Without a key, development builds unlock Pro locally (README). To see the free experience and the aha
  paywall, test on a build *with* the key once the Apple account exists, or ask for a dev-only "pretend
  free" switch.

## 5. iPhone

1. Plug the iPhone into the Mac with a cable. Unlock it and tap **Trust**.
2. iPhone → Settings → Privacy & Security → **Developer Mode** → on → restart when asked.
   (The option appears after the phone has been connected to Xcode once; if it's missing, do step 6 first.)

## 6. Build and install

```bash
cd ~/dev/mouthful
npx expo run:ios --device
```

- Pick your iPhone from the list.
- First build takes 5–15 minutes (it generates the `ios/` folder and installs CocoaPods).
- If it says no signing team: run `open ios/*.xcworkspace`, click the **Mouthful** target → **Signing &
  Capabilities** → Team: **(Personal Team)**, keep "Automatically manage signing" on, then run the command
  again. If the bundle ID is rejected as taken, tell Claude. Don't rename it in Xcode (app.json owns it).

## 7. Trust the app on the phone

iPhone → Settings → General → **VPN & Device Management** → your Apple ID → **Trust**. Then open Mouthful.

## 8. Daily use

- After the first build, for JavaScript changes only: `npx expo start`, then open the app on the phone
  (same Wi-Fi as the Mac).
- Rebuild with `npx expo run:ios --device` after `git pull` brings native changes (new packages, app.json,
  patches/).

## 9. Every 7 days

Free signing expires: the app won't open. Plug in and run `npx expo run:ios --device` again. Your
sessions stay on the phone.

## First checks on the phone (about 15 minutes)

1. App launches without crashing; icon is the blue word bars.
2. You → English → your variety is preselected (Canadian).
3. Read night-shift: words ink in as you speak; note if the highlight lags (> ~1 s feels broken).
4. Skip the second line on purpose and keep reading: ink catches up within a few words, only skipped words red.
5. Mid-read, trigger Siri: the **Paused** card shows; **Carry on** keeps your place.
6. Tester mode (tap the version line on You 7 times) → **Send a test crash report** → it appears in Sentry
   (mouthful / mouthful-app) with no IP, locale or breadcrumbs.
7. Check icons draw (paywall close ✕, MicGate icon). They didn't on the web build.

Write down anything odd (screenshot + what you did) and bring it to Claude.

## Limits of the free Apple ID

- 7-day expiry; at most 3 of your own apps installed this way at once.
- No in-app purchases (sandbox needs the paid account) and no push notifications (Mouthful only uses local
  reminders, and remote push is switched off in app.json so free signing works).
