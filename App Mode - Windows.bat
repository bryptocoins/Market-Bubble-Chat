@echo off
setlocal enableextensions
title Market Bubble Chat - App Mode
cd /d "%~dp0"
REM Market Bubble Chat - APP MODE (Windows): the full desktop app window.

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
call npm run install:all
if errorlevel 1 goto installFail
echo Setting up the X capture browser (optional)...
pushd server
call npx --yes playwright install chromium
popd
:depsDone

if exist "desktop\node_modules\electron\path.txt" goto electronDone
echo Finishing Electron setup...
rmdir /s /q "desktop\node_modules" 2>nul
call npm --prefix desktop install
if exist "desktop\node_modules\electron\path.txt" goto electronDone
echo Downloading the Electron runtime...
pushd desktop
call node node_modules\electron\install.js
popd
if exist "desktop\node_modules\electron\path.txt" goto electronDone
echo Retrying the Electron download via mirror...
pushd desktop
set "ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/"
call node node_modules\electron\install.js
popd
if exist "desktop\node_modules\electron\path.txt" goto electronDone
echo.
echo   Couldn't download Electron - check internet/firewall, or use WEB MODE.
echo.
pause
exit /b 1
:electronDone

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
call npm run build
if errorlevel 1 goto buildFail
if defined REV (echo %REV%)>".buildrev"
:buildDone

echo Freeing ports 3000/4000 if a previous run is still open...
powershell -NoProfile -Command "Get-NetTCPConnection -State Listen -LocalPort 3000,4000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue }" >nul 2>nul

echo Launching Market Bubble Chat...
call npm --prefix desktop start
exit /b 0

:installFail
echo.
echo   Install failed - check your internet and run this again.
echo.
pause
exit /b 1

:buildFail
echo.
echo   Build failed.
echo.
pause
exit /b 1
