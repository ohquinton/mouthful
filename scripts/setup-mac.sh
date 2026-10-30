#!/usr/bin/env bash
# One-shot setup for running the app on your own iPhone from a Mac, with a free Apple ID.
# Run it in Terminal:   bash setup-mac.sh
# It stops with a plain message whenever it needs you. Safe to run again: finished steps are skipped.
# Full guide: docs/SETUP-MAC.md
set -euo pipefail

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
stop() { printf '\n\033[31m%s\033[0m\n' "$*"; exit 1; }

REPO_DIR="$HOME/dev/mouthful"

say "1/7  Xcode"
if ! xcodebuild -version >/dev/null 2>&1; then
  stop "Xcode isn't installed or set up. Install it from the App Store, open it once, then run:
  sudo xcode-select -s /Applications/Xcode.app
and run this script again."
fi
XCODE_VERSION=$(xcodebuild -version | head -1 | awk '{print $2}')
XCODE_MAJOR=${XCODE_VERSION%%.*}
XCODE_MINOR=$(echo "$XCODE_VERSION" | cut -d. -f2)
if [ "$XCODE_MAJOR" -lt 26 ] || { [ "$XCODE_MAJOR" -eq 26 ] && [ "${XCODE_MINOR:-0}" -lt 4 ]; }; then
  stop "Xcode $XCODE_VERSION is too old. Expo SDK 58 needs Xcode 26.4 or newer. Update it in the App Store."
fi
echo "Xcode $XCODE_VERSION: OK"
echo "Reminder: Xcode → Settings → Accounts → add your Apple ID (shows as Personal Team)."

say "2/7  Homebrew"
if ! command -v brew >/dev/null 2>&1; then
  stop "Homebrew isn't installed. Paste this into Terminal, follow its prompts, then run this script again:
  /bin/bash -c \"\$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)\""
fi
echo "Homebrew: OK"

say "3/7  Node, GitHub CLI, CocoaPods"
for pkg in node gh cocoapods; do
  if brew list "$pkg" >/dev/null 2>&1; then echo "$pkg: already installed"; else brew install "$pkg"; fi
done
NODE_MAJOR=$(node -v | sed 's/^v//' | cut -d. -f1)
NODE_MINOR=$(node -v | sed 's/^v//' | cut -d. -f2)
if [ "$NODE_MAJOR" -lt 22 ] || { [ "$NODE_MAJOR" -eq 22 ] && [ "$NODE_MINOR" -lt 13 ]; }; then
  stop "Node $(node -v) is too old (need 22.13 or newer). Run: brew upgrade node"
fi
echo "Node $(node -v): OK"

say "4/7  GitHub login"
if ! gh auth status >/dev/null 2>&1; then
  echo "Log in when asked: GitHub.com → HTTPS → Yes → Login with a web browser."
  gh auth login
fi
echo "GitHub: logged in"

say "5/7  Get the code"
if [ -d "$REPO_DIR/.git" ]; then
  echo "Already cloned at $REPO_DIR, pulling the latest."
  git -C "$REPO_DIR" pull --ff-only
else
  mkdir -p "$(dirname "$REPO_DIR")"
  gh repo clone ohquinton/mouthful "$REPO_DIR"
fi
cd "$REPO_DIR"
npm ci   # also applies patches/ (the iOS speech patch)

say "6/7  Keys (.env)"
if [ ! -f .env ]; then
  echo "No .env yet. That's fine for a first look: Pro unlocks locally in development builds."
  echo "For crash reports, copy .env from the Windows PC (AirDrop or USB) into $REPO_DIR later."
  echo "Never paste keys into chats or commits."
else
  echo ".env found."
fi

say "7/7  Build onto your iPhone"
cat <<'EOF'
Before pressing Enter:
  • Plug your iPhone into the Mac with a cable, unlock it, and tap Trust.
  • If the phone asks, turn on Settings → Privacy & Security → Developer Mode and restart it.
The first build takes 5–15 minutes. Pick your iPhone from the list when asked.
If it says "no signing team": open ios/*.xcworkspace, click the Mouthful target → Signing & Capabilities
→ Team: (Personal Team), then run this script again.
After it installs: iPhone → Settings → General → VPN & Device Management → your Apple ID → Trust.
EOF
read -r -p "Press Enter to build (Ctrl+C to stop)... " _
npx expo run:ios --device

say "Done. Next time, for code-only changes, run:  cd $REPO_DIR && git pull && npx expo start"
echo "Every 7 days (free signing expires), plug in and run:  cd $REPO_DIR && npx expo run:ios --device"
