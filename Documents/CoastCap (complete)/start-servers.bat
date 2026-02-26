@echo off
echo ================================
echo  Starting Admin Panel Servers
echo ================================
echo.
echo Opening separate windows for each server...
echo.

REM Start Telegram notification server in new window
start "Telegram Notification Server" cmd /k "node telegram-notify.js"

REM Wait 2 seconds to let telegram server start first
timeout /t 2 /nobreak > nul

REM Start main server in new window
start "Main Server" cmd /k "node server.js"

echo.
echo ================================
echo  Both servers are starting!
echo ================================
echo.
echo  Two windows have opened:
echo  1. Telegram Notification Server (Port 3001)
echo  2. Main Server (Port 3000)
echo.
echo  Access Points:
echo  - Main Site:    http://localhost:3000
echo  - Admin Panel:  http://localhost:3000/admin
echo  - Login Page:   http://localhost:3000/login.html
echo.
echo  Close those windows to stop the servers.
echo.
pause

