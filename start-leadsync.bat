@echo off
cls
echo =========================================
echo     LeadSync CRM - Development Server
echo =========================================
echo.

echo [1/3] Stopping existing processes...
taskkill /F /IM node.exe /T 2>nul
timeout /t 2 /nobreak >nul

echo.
echo [2/3] Starting Backend Server (port 4000)...
cd /d E:\newleadsync\startup-new\startup\leadsync-backend
start "LeadSync Backend" cmd /k "npm run dev"

timeout /t 5 /nobreak >nul

echo.
echo [3/3] Starting Frontend Server (port 5173)...
cd /d E:\newleadsync\startup-new\startup\leadsync-frontend
start "LeadSync Frontend" cmd /k "npx serve -s dist -p 5173"

timeout /t 3 /nobreak >nul

echo.
echo =========================================
echo    Servers Started Successfully!
echo =========================================
echo.
echo Frontend: http://localhost:5173
echo Backend:  http://localhost:4000
echo.
echo Press any key to exit this window...
pause >nul
