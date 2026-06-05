#!/bin/bash
# Market Bubble Chat — WEB MODE (macOS / Linux): runs the app and opens it in your
# browser. No desktop window/Electron — works on Macs, virtual machines, anywhere.
# First time on macOS: right-click -> Open, or run once: xattr -dr com.apple.quarantine .

cd "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"
fail() { echo ""; echo "  $1"; echo ""; read -p "  Press Return to close. "; exit 1; }

# 1) Node.js
if ! command -v npm >/dev/null 2>&1; then
  command -v brew >/dev/null 2>&1 && { echo "Installing Node.js via Homebrew (one-time)..."; brew install node; hash -r; }
fi
if ! command -v npm >/dev/null 2>&1; then
  command -v open >/dev/null 2>&1 && open "https://nodejs.org"
  fail "Node.js is required. Install the LTS version from https://nodejs.org, then run this again."
fi

# 2) Dependencies — server + web only (no Electron in web mode).
if [ ! -d web/node_modules ] || [ ! -d server/node_modules ]; then
  echo "Installing dependencies (first run — a few minutes)..."
  npm --prefix server install && npm --prefix web install || fail "Dependency install failed. Check your internet and run this again."
  echo "Setting up the X capture browser (optional — skip-safe)..."
  ( cd server && npx --yes playwright install chromium ) || true
fi

# 3) Build the web app — first run, or whenever you've pulled an update.
REV="$(git rev-parse HEAD 2>/dev/null || true)"
if [ ! -f web/.next/BUILD_ID ] || { [ -n "$REV" ] && [ "$REV" != "$(cat .buildrev 2>/dev/null || true)" ]; }; then
  echo "Building the app..."
  npm --prefix web run build || fail "Build failed."
  [ -n "$REV" ] && echo "$REV" > .buildrev
fi

# 4) Start backend + web, then open the browser.
echo "Starting Market Bubble Chat..."
npm --prefix server run start &
npm --prefix web run start &
sleep 6
( command -v open >/dev/null 2>&1 && open "http://localhost:3000" ) \
  || ( command -v xdg-open >/dev/null 2>&1 && xdg-open "http://localhost:3000" ) \
  || echo "  Open http://localhost:3000 in your browser."
echo ""
echo "  ✅ Market Bubble Chat is running at  http://localhost:3000"
echo "  Keep this window open. Close it (or press Ctrl+C) to stop."
wait
