@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js version 20 or later is required.
  echo Install it from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)
start "JARVIS SERVER" cmd /k "node server.mjs"
timeout /t 2 /nobreak >nul
start "" "http://127.0.0.1:3000"
echo JARVIS is launching in your browser.
exit /b 0
