@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  echo Install Node.js, then run START.bat again.
  pause
  exit /b 1
)

if not exist relay-config.json (
  echo First run: starting cloud setup...
  node setup.js
  if errorlevel 1 (
    echo Setup failed.
    pause
    exit /b 1
  )
)

node launcher.js
pause
