@echo off
title Market Bubble Chat (Browser)
cd /d "%~dp0"

REM Market Bubble Chat - BROWSER launcher (Windows). Runs the app and opens it in
REM your browser. No desktop/Electron needed - works on VMs and locked-down PCs.

where npm >nul 2>nul && goto :haveNode
where winget >nul 2>nul && goto :wingetNode
echo.
echo   Node.js is required. Opening https://nodejs.org ...
start https://nodejs.org
echo   Install the LTS version, then run this again.
echo.
pause
exit /b 1

:wingetNode
echo Node.js not found - installing via winget (one-time)...
winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
echo Node installed. Please CLOSE this window and run this again.
pause
exit /b 1

:haveNode
if not exist "web\node_modules" (
  echo Installing dependencies, this can take a few minutes...
  call npm --prefix server install
  call npm --prefix web install
  echo Setting up the X capture browser (optional)...
  pushd server & call npx --yes playwright install chromium & popd
)

if not exist "web\.next\BUILD_ID" (
  echo Building the app...
  call npm --prefix web run build
)

echo Starting Market Bubble Chat...
start "MB Server" cmd /c "npm --prefix server run start"
start "MB Web" cmd /c "npm --prefix web run start"
timeout /t 6 >nul
start "" http://localhost:3000
echo.
echo   Market Bubble Chat is running at  http://localhost:3000
echo   Two small server windows opened - closing them stops the app.
echo.
pause
