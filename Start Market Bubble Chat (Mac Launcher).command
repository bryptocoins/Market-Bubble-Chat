#!/bin/bash
# Market Bubble Chat launcher for macOS / Linux.
# Clone the repo with GitHub Desktop (not a ZIP download) and just double-click
# this. If macOS still blocks it, right-click -> Open, or run once:
#   xattr -dr com.apple.quarantine .
cd "$(dirname "$0")"

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
