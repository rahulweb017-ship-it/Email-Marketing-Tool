@echo off
title Self-Hosted Email Platform
echo ============================================
echo   Starting Self-Hosted Email Platform
echo ============================================
echo.

cd /d "%~dp0"

echo [1/2] Starting API server on port 3001...
start "API Server" cmd /k "cd /d "%~dp0apps\api" && npx tsx src/index.ts"

timeout /t 3 /nobreak >nul

echo [2/2] Starting Web frontend on port 5173...
start "Web Frontend" cmd /k "cd /d "%~dp0apps\web" && npx vite --host"

timeout /t 3 /nobreak >nul

echo.
echo ============================================
echo   Both servers started!
echo   API:      http://localhost:3001
echo   Frontend: http://localhost:5173
echo ============================================
echo.
echo Press any key to exit this launcher...
pause >nul
