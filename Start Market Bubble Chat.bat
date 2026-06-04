@echo off
title Market Bubble Chat
cd /d "%~dp0"

if not exist "web\.next\BUILD_ID" (
  echo First run - building the app, this takes a minute...
  call npm run build
)

echo Launching Market Bubble Chat...
call npm --prefix desktop start
