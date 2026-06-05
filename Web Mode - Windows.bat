@echo off
setlocal enableextensions
title Market Bubble Chat - Web Mode
cd /d "%~dp0"
REM Market Bubble Chat - WEB MODE (Windows): runs the app and opens it in your
REM browser. No desktop window/Electron - works on VMs and locked-down PCs.

where npm >nul 2>nul && goto haveNode
where winget >nul 2>nul && goto wingetNode
echo.
echo   Node.js is required. Opening https://nodejs.org ...
start "" https://nodejs.org
echo   Install the LTS version, then run this again.
echo.
pause
exit /b 1

:wingetNode
echo Node.js not found - installing via winget (one-time)...
winget install -e --id OpenJS.NodeJS.LTS --accept-source-agreements --accept-package-agreements
echo.
echo   Node installed. CLOSE this window and run the launcher again.
echo.
pause
exit /b 1

:haveNode
if exist "web\node_modules" goto depsDone
echo Installing dependencies, this can take a few minutes...
call npm --prefix server install
call npm --prefix web install
echo Setting up the X capture browser (optional)...
pushd server
call npx --yes playwright install chromium
popd
:depsDone

REM Build on first run, or whenever you've pulled an update.
set "REV="
for /f "delims=" %%i in ('git rev-parse HEAD 2^>nul') do set "REV=%%i"
set "LASTREV="
if exist ".buildrev" set /p LASTREV=<".buildrev"
set "DOBUILD="
if not exist "web\.next\BUILD_ID" set "DOBUILD=1"
if defined REV if not "%REV%"=="%LASTREV%" set "DOBUILD=1"
if not defined DOBUILD goto buildDone
echo Building the app...
call npm --prefix web run build
if errorlevel 1 goto buildFail
if defined REV (echo %REV%)>".buildrev"
:buildDone

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
exit /b 0

:buildFail
echo.
echo   Build failed.
echo.
pause
exit /b 1
