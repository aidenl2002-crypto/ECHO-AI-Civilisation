@echo off
REM PROJECT ECHO - one-click launcher. Double-click this file.
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo [ECHO] Node.js not found. Install Node 20+ from https://nodejs.org then re-run.
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [ECHO] First run - installing dependencies, this takes a few minutes...
  call npm install
)

if not exist ".env" (
  echo [ECHO] Creating .env from defaults...
  copy /y .env.example .env >nul
)

echo [ECHO] Building city and interface...
call npm run build
if errorlevel 1 (
  echo [ECHO] Build failed - see errors above.
  pause
  exit /b 1
)

echo [ECHO] Starting API on http://localhost:4000 ...
start "ECHO API :4000" cmd /k "cd /d ""%~dp0"" && node apps/api/dist/server.js"

echo [ECHO] Starting web UI on http://localhost:5200 ...
start "ECHO WEB :5200" cmd /k "cd /d ""%~dp0apps\web"" && npx vite --port 5200 --host 127.0.0.1 --strictPort"

timeout /t 6 /nobreak >nul
start "" "http://localhost:5200"

echo.
echo ============================================================
echo  ECHO CITY is running:
echo    City UI .... http://localhost:5200
echo    API ....... http://localhost:4000/api/state
echo    God Console: open the UI, choose God Console, then paste
echo               OWNER_TOKEN from .env into its Owner key box.
echo  Close the two ECHO windows to stop the city.
echo ============================================================
pause
