@echo off
title Market Bubble Chat (App Mode)
cd /d "%~dp0"
REM Market Bubble Chat - APP MODE (Windows): the full desktop app window.

where npm >nul 2>nul && goto :haveNode
where winget >nul 2>nul && goto :wingetNode
echo. & echo   Node.js is required. Opening https://nodejs.org ... & start https://nodejs.org
echo   Install the LTS version, then run this again. & echo. & pause & exit /b 1
:wingetNode
echo Node.js not found - installing via winget (one-time)...
winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
echo. & echo   Node installed. CLOSE this window and run the launcher again. & echo. & pause & exit /b 1

:haveNode
if not exist "web\node_modules" (
  echo Installing dependencies, this can take a few minutes...
  call npm run install:all
  if errorlevel 1 ( echo. & echo   Install failed - check your internet and run this again. & echo. & pause & exit /b 1 )
  echo Setting up the X capture browser (optional)...
  pushd server & call npx --yes playwright install chromium & popd
)

if not exist "desktop\node_modules\electron\path.txt" (
  echo Finishing Electron setup...
  rmdir /s /q "desktop\node_modules" 2>nul
  call npm --prefix desktop install
)
if not exist "desktop\node_modules\electron\path.txt" (
  echo Downloading the Electron runtime...
  pushd desktop & node node_modules\electron\install.js & popd
)
if not exist "desktop\node_modules\electron\path.txt" (
  echo Retrying the Electron download via mirror...
  pushd desktop & set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/" & node node_modules\electron\install.js & popd
  if not exist "desktop\node_modules\electron\path.txt" ( echo. & echo   Couldn't download Electron - check internet/firewall, or use WEB MODE. & echo. & pause & exit /b 1 )
)

REM Build on first run, or whenever you've pulled an update.
set "REV="
for /f %%i in ('git rev-parse HEAD 2^>nul') do set "REV=%%i"
set "LASTREV="
if exist ".buildrev" set /p LASTREV=<".buildrev"
set DOBUILD=0
if not exist "web\.next\BUILD_ID" set DOBUILD=1
if defined REV if not "%REV%"=="%LASTREV%" set DOBUILD=1
if "%DOBUILD%"=="1" (
  echo Building the app...
  call npm run build
  if errorlevel 1 ( echo. & echo   Build failed. & echo. & pause & exit /b 1 )
  if defined REV >".buildrev" echo %REV%
)

echo Launching Market Bubble Chat...
call npm --prefix desktop start
