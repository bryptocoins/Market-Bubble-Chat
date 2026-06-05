#!/bin/bash
# One-time X sign-in (macOS / Linux). Opens a browser to log into x.com; your
# session is saved so the app can read your X live chat. Run once (re-run if X
# logs you out). NOTE: needs a real display — won't work inside a Mac VM.

cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
fail() { echo ""; echo "  $1"; echo ""; read -p "  Press Return to close. "; exit 1; }

command -v npm >/dev/null 2>&1 || fail "Node.js is required. Install the LTS from https://nodejs.org, then run this again."

if [ ! -d server/node_modules ]; then
  echo "Installing dependencies (first run)..."
  npm --prefix server install || fail "Install failed. Check your internet and run this again."
fi

echo "Making sure the X browser is installed..."
( cd server && npx --yes playwright install chromium ) || fail "Couldn't install the X browser (Chromium). Check your internet and run this again."

echo ""
echo "  A browser window will open. Log into x.com, then CLOSE it to save your session."
npm run x:login

echo ""
echo "  ✅ Done. You can start the app now (App Mode or Web Mode)."
read -p "  Press Return to close. "
