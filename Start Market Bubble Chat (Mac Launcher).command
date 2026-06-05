#!/bin/bash
# Market Bubble Chat launcher for macOS / Linux.
# Clone the repo with GitHub Desktop (not a ZIP download) and just double-click
# this. If macOS still blocks it, right-click -> Open, or run once:
#   xattr -dr com.apple.quarantine .
cd "$(dirname "$0")"

# Put common Node install locations on PATH (Homebrew on Apple Silicon,
# nodejs.org installer, nvm) so a double-clicked launcher can find npm.
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
[ -s "$HOME/.nvm/nvm.sh" ] && . "$HOME/.nvm/nvm.sh"

if ! command -v npm >/dev/null 2>&1; then
  echo ""
  echo "  Node.js isn't installed (npm not found)."
  echo "  Install the LTS version from https://nodejs.org, then run this again."
  echo ""
  read -p "  Press Return to close. "
  exit 1
fi

if [ ! -d web/node_modules ] || [ ! -d desktop/node_modules ] || [ ! -d server/node_modules ]; then
  echo "First run — installing dependencies, this can take a few minutes..."
  npm run install:all
fi

if [ ! -f web/.next/BUILD_ID ]; then
  echo "Building the app..."
  npm run build
fi

echo "Launching Market Bubble Chat..."
npm --prefix desktop start
