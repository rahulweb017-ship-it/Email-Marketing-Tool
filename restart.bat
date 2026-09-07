@echo off
echo ============================================
echo   Restarting Self-Hosted Email Platform
echo ============================================
echo.

call "%~dp0stop.bat"
timeout /t 2 /nobreak >nul
call "%~dp0start.bat"
