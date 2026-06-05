#!/bin/bash
# Market Bubble Chat — BROWSER launcher (macOS / Linux).
# Runs the app and opens it in your default browser. No desktop/Electron needed,
# so this works on Macs, virtual machines, and anywhere Electron is fussy.
# First time on macOS: right-click -> Open (Gatekeeper), or: xattr -dr com.apple.quarantine .

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

# 2) Dependencies — server + web only (no Electron in browser mode).
if [ ! -d web/node_modules ] || [ ! -d server/node_modules ]; then
  echo "Installing dependencies (first run — a few minutes)..."
  npm --prefix server install && npm --prefix web install || fail "Dependency install failed. Check your internet and run this again."
  echo "Setting up the X capture browser (optional — skip-safe)..."
  ( cd server && npx --yes playwright install chromium ) || true
fi

# 3) Build the web app (first run).
if [ ! -f web/.next/BUILD_ID ]; then
  echo "Building the app (first run)..."
  npm --prefix web run build || fail "Build failed."
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
