@echo off
color 0A
echo.
echo ========================================
echo    QR CODE FIX - CLEAN START
echo ========================================
echo.
echo [1/5] Stopping all servers...
taskkill /F /IM node.exe >nul 2>&1
echo      Done! All Node.js processes stopped.
timeout /t 3 >nul

echo.
echo [2/5] Cleaning WhatsApp sessions...
cd /d "%~dp0server"
rmdir /s /q "wa-session" 2>nul
rmdir /s /q ".wwebjs_cache" 2>nul
rmdir /s /q ".wwebjs_auth" 2>nul
echo      Done! Sessions cleaned.

echo.
echo [3/5] Creating fresh directories...
mkdir "wa-session" 2>nul
mkdir "logs" 2>nul
echo      Done! Fresh folders created.

echo.
echo [4/5] Starting servers...
cd /d "%~dp0"
start "WA-BLAST Backend+Frontend" cmd /k "npm run dev:all"
timeout /t 5 >nul

echo.
echo [5/5] Opening browser...
start http://localhost:3000
timeout /t 2 >nul

echo.
echo ========================================
echo    CLEANUP COMPLETE!
echo ========================================
echo.
echo   Next steps:
echo   1. Wait 10 seconds for servers to start
echo   2. Login/Register if needed
echo   3. Go to Connection page
echo   4. Click "Connect WhatsApp"
echo   5. Wait 30-90 seconds
echo   6. QR Code will appear!
echo.
echo   Check the new terminal window for logs.
echo.
pause
