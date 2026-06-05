#!/bin/bash
# Market Bubble Chat launcher for macOS / Linux. Double-click (after a one-time
# `chmod +x start-market-bubble-chat.command`) or run from a terminal.
cd "$(dirname "$0")"

if [ ! -f web/.next/BUILD_ID ]; then
  echo "First run — building the app, this takes a minute..."
  npm run build
fi

echo "Launching Market Bubble Chat..."
npm --prefix desktop start
