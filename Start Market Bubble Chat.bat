@echo off
title Market Bubble Chat
cd /d "%~dp0"

where npm >nul 2>nul || (
  echo.
  echo   Node.js isn't installed. Get it from https://nodejs.org, then run this again.
  echo.
  pause
  exit /b 1
)

if not exist "web\node_modules" (
  echo First run - installing dependencies, this can take a few minutes...
  call npm run install:all
)

if not exist "web\.next\BUILD_ID" (
  echo Building the app...
  call npm run build
)

echo Launching Market Bubble Chat...
call npm --prefix desktop start
