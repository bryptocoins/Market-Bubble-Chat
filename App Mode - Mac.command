#!/bin/bash
# Market Bubble Chat — APP MODE (macOS / Linux): the full desktop app window.
# Clone with GitHub Desktop (not a ZIP), then double-click. First time on macOS:
# right-click -> Open, or run once:  xattr -dr com.apple.quarantine .
# (On a virtual machine, use WEB MODE instead — Electron windows don't render in VMs.)

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

# 2) Dependencies
if [ ! -d web/node_modules ] || [ ! -d desktop/node_modules ] || [ ! -d server/node_modules ]; then
  echo "Installing dependencies (first run — a few minutes)..."
  npm run install:all || fail "Dependency install failed. Check your internet and run this again."
  echo "Setting up the X capture browser (optional — skip-safe)..."
  ( cd server && npx --yes playwright install chromium ) || true
fi

# 3) Electron runtime (npm sometimes skips its download; fall back to a mirror).
if [ ! -f desktop/node_modules/electron/path.txt ]; then
  echo "Finishing Electron setup..."
  rm -rf desktop/node_modules
  npm --prefix desktop install || fail "Electron setup failed. Check your internet and run this again."
fi
if [ ! -f desktop/node_modules/electron/path.txt ]; then
  echo "Downloading the Electron runtime..."
  ( cd desktop && node node_modules/electron/install.js ) || true
fi
if [ ! -f desktop/node_modules/electron/path.txt ]; then
  echo "Retrying the Electron download via mirror..."
  ( cd desktop && ELECTRON_MIRROR="https://npmmirror.com/mirrors/electron/" node node_modules/electron/install.js ) \
    || fail "Couldn't download Electron. Check your internet/firewall and run this again (or use WEB MODE)."
fi

# 4) Build the web app — first run, or whenever you've pulled an update.
REV="$(git rev-parse HEAD 2>/dev/null || true)"
if [ ! -f web/.next/BUILD_ID ] || { [ -n "$REV" ] && [ "$REV" != "$(cat .buildrev 2>/dev/null || true)" ]; }; then
  echo "Building the app..."
  npm run build || fail "Build failed."
  [ -n "$REV" ] && echo "$REV" > .buildrev
fi

# 5) Free ports 3000/4000 if a previous run is still holding them.
for p in 3000 4000; do pids="$(lsof -ti tcp:$p 2>/dev/null)"; [ -n "$pids" ] && kill -9 $pids 2>/dev/null; done

# 6) Launch the desktop app.
echo "Launching Market Bubble Chat..."
npm --prefix desktop start
