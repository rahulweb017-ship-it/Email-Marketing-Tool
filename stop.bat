@echo off
echo ============================================
echo   Stopping Self-Hosted Email Platform
echo ============================================
echo.

echo Killing processes on port 3001 (API)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo   API server stopped.

echo Killing processes on port 5173 (Frontend)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr "LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
echo   Web frontend stopped.

echo.
echo ============================================
echo   All servers stopped.
echo ============================================
pause
