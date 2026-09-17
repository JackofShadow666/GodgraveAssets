@echo off
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found.
  pause
  exit /b 1
)

where npx >nul 2>nul
if errorlevel 1 (
  echo npx was not found.
  echo Reinstall Node.js including npm.
  pause
  exit /b 1
)

echo Opening Cloudflare login...
call npx --yes wrangler@latest login
if errorlevel 1 (
  echo Cloudflare login failed.
  pause
  exit /b 1
)

echo Deploying Cloudflare Worker...
call npx --yes wrangler@latest deploy --config "cloudflare\wrangler.toml"

echo.
echo If deploy succeeded, run START.bat.
echo If START.bat still says cloud is not configured, send me the workers.dev URL shown above.
pause
