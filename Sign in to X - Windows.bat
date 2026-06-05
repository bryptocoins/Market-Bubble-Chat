@echo off
setlocal enableextensions
title Market Bubble Chat - Sign in to X
cd /d "%~dp0"
REM One-time X sign-in. Opens a browser to log into x.com; your session is saved
REM so the app can read your X live chat. Run once (re-run if X logs you out).

where npm >nul 2>nul || goto noNode
if exist "server\node_modules" goto haveDeps
echo Installing dependencies (first run)...
call npm --prefix server install
if errorlevel 1 goto failInstall
:haveDeps
echo Making sure the X browser is installed...
pushd server
call npx --yes playwright install chromium
popd
echo.
echo   A browser window will open. Log into x.com, then CLOSE it to save your session.
call npm run x:login
echo.
echo   Done. You can start the app now (App Mode or Web Mode).
echo.
pause
exit /b 0

:noNode
echo.
echo   Node.js is required. Install the LTS from https://nodejs.org, then run this again.
echo.
pause
exit /b 1

:failInstall
echo.
echo   Install failed - check your internet and run this again.
echo.
pause
exit /b 1
