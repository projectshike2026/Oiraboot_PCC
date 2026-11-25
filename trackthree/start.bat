@echo off
cd /d "%~dp0"
title PCIU Scholarship Atlas (Track 3)
echo ====================================================================
echo Starting PCIU Scholarship Atlas (Track 3 - Flask)
echo Directory: %CD%
echo URL: http://localhost:8080
echo ====================================================================

:: Auto-launch browser after short delay
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:8080"

python app.py
pause
