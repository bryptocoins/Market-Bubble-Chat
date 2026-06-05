#!/bin/bash
# Market Bubble Chat — macOS / Linux launcher.
# Clone with GitHub Desktop (not a ZIP), then just double-click this. It sets up
# everything it needs (Node check, dependencies, Electron, build) and launches.
# If macOS blocks it the first time: right-click -> Open, or run: xattr -dr com.apple.quarantine .

cd "$(dirname "$0")"

# Put common Node install locations on PATH (Homebrew/Apple Silicon, nodejs.org, nvm).
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"

fail() { echo ""; echo "  $1"; echo ""; read -p "  Press Return to close. "; exit 1; }

# 1) Node.js — install via Homebrew if available, else point to the download.
if ! command -v npm >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "Node.js not found — installing it via Homebrew (one-time, a few minutes)..."
    brew install node
    hash -r
  fi
fi
if ! command -v npm >/dev/null 2>&1; then
  command -v open >/dev/null 2>&1 && open "https://nodejs.org"
  fail "Node.js is required. I opened https://nodejs.org — install the LTS version, then run this again."
fi

# 2) Dependencies (first run).
if [ ! -d web/node_modules ] || [ ! -d desktop/node_modules ] || [ ! -d server/node_modules ]; then
  echo "Installing dependencies (first run — this can take a few minutes)..."
  npm run install:all || fail "Dependency install failed. Check your internet connection and run this again."
  echo "Setting up the X capture browser (optional — skip-safe)..."
  ( cd server && npx --yes playwright install chromium ) || true
fi

# 3) Make sure Electron's runtime is actually present. npm sometimes skips its
#    postinstall (node_modules exists but the real app doesn't). Reinstall, then
#    download it directly if it's still missing.
if [ ! -f desktop/node_modules/electron/path.txt ]; then
  echo "Finishing Electron setup..."
  rm -rf desktop/node_modules
  npm --prefix desktop install || fail "Electron setup failed. Check your internet connection and run this again."
fi
if [ ! -f desktop/node_modules/electron/path.txt ]; then
  echo "Downloading the Electron runtime..."
  ( cd desktop && node node_modules/electron/install.js ) || true
fi
if [ ! -f desktop/node_modules/electron/path.txt ]; then
  echo "Retrying the Electron download via mirror..."
  ( cd desktop && ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" node node_modules/electron/install.js ) \
    || fail "Couldn't download Electron. Check your internet connection (or a firewall blocking the download) and run this again."
fi

# 4) Build (first run).
if [ ! -f web/.next/BUILD_ID ]; then
  echo "Building the app (first run)..."
  npm run build || fail "Build failed. Run this again, or check the messages above."
fi

# 5) Launch.
echo "Launching Market Bubble Chat..."
npm --prefix desktop start
