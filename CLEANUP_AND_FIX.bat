@echo off
echo ========================================
echo   QR CODE FIX - WA-BLAST-PRO
echo ========================================
echo.
echo Step 1: Stopping all Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 3 >nul
echo    Done! All node processes stopped.
echo.

echo Step 2: Cleaning WhatsApp sessions...
cd /d "%~dp0server"
if exist "wa-session" (
    rmdir /s /q "wa-session" 2>nul
    echo    Deleted wa-session
)
if exist ".wwebjs_cache" (
    rmdir /s /q ".wwebjs_cache" 2>nul
    echo    Deleted .wwebjs_cache
)
if exist ".wwebjs_auth" (
    rmdir /s /q ".wwebjs_auth" 2>nul
    echo    Deleted .wwebjs_auth
)
echo    Done! All sessions cleaned.
echo.

echo Step 3: Creating fresh session directory...
mkdir "wa-session" 2>nul
mkdir "logs" 2>nul
echo    Done! Fresh directories created.
echo.

echo ========================================
echo   CLEANUP COMPLETE!
echo ========================================
echo.
echo Next steps:
echo   1. Run this command: cd server ^&^& npm run dev
echo   2. Open browser: http://localhost:5173
echo   3. Go to Connection page
echo   4. Click "Connect WhatsApp"
echo   5. Wait 30 seconds for QR code
echo.
echo Press any key to exit...
pause >nul
