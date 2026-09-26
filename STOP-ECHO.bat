@echo off
REM PROJECT ECHO - stops the city servers started by START-ECHO.bat.
echo [ECHO] Stopping city servers...
taskkill /F /FI "WINDOWTITLE eq ECHO API*" >nul 2>nul
taskkill /F /FI "WINDOWTITLE eq ECHO WEB*" >nul 2>nul
timeout /t 2 /nobreak >nul

REM Fallback: if anything is still holding the ports, free them.
for %%P in (4000 5200) do (
  for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":%%P " ^| findstr LISTENING') do (
    echo [ECHO] Freeing port %%P ^(PID %%a^)...
    taskkill /F /PID %%a >nul 2>nul
  )
)

echo [ECHO] City stopped. Your world autosaves while running;
echo        press Save in the UI top bar before stopping to be safe.
pause
