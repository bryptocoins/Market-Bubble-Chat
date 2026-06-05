@echo off
title Market Bubble Chat
cd /d "%~dp0"

REM 1) Node.js — auto-install via winget if available, else open the download page.
where npm >nul 2>nul && goto :haveNode
where winget >nul 2>nul && goto :wingetNode
echo.
echo   Node.js is required. Opening https://nodejs.org ...
start https://nodejs.org
echo   Install the LTS version, then run this launcher again.
echo.
pause
exit /b 1

:wingetNode
echo Node.js not found - installing it via winget (one-time)...
winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
echo.
echo   Node installed. Please CLOSE this window and run the launcher again.
echo.
pause
exit /b 1

:haveNode
REM 2) Dependencies (first run).
if not exist "web\node_modules" (
  echo Installing dependencies, this can take a few minutes...
  call npm run install:all
  if errorlevel 1 ( echo. & echo   Install failed - check your internet and run this again. & echo. & pause & exit /b 1 )
)

REM 3) Make sure Electron's runtime is present (npm sometimes skips its postinstall).
if not exist "desktop\node_modules\electron\path.txt" (
  echo Finishing Electron setup...
  rmdir /s /q "desktop\node_modules" 2>nul
  call npm --prefix desktop install
  if errorlevel 1 ( echo. & echo   Electron setup failed - check your internet and run this again. & echo. & pause & exit /b 1 )
)
if not exist "desktop\node_modules\electron\path.txt" (
  echo Downloading the Electron runtime...
  pushd desktop & node node_modules\electron\install.js & popd
  if not exist "desktop\node_modules\electron\path.txt" ( echo. & echo   Electron download failed - check your internet and run this again. & echo. & pause & exit /b 1 )
)

REM 4) Build (first run).
if not exist "web\.next\BUILD_ID" (
  echo Building the app...
  call npm run build
  if errorlevel 1 ( echo. & echo   Build failed. & echo. & pause & exit /b 1 )
)

REM 5) Launch.
echo Launching Market Bubble Chat...
call npm --prefix desktop start
