@echo off
setlocal
cd /d "%~dp0"

:: Check if server is already running on port 8765
netstat -ano | findstr :8765 >nul
if %errorlevel% neq 0 (
    echo Starting Webcam VR Hub Server...
    start "Webcam VR Server" /min python server.py
    ping 127.0.0.1 -n 2 >nul
)

:: Find preferred Chromium browser for app mode
set "BROWSER="
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "BROWSER=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
if not defined BROWSER if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "BROWSER=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined BROWSER if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "BROWSER=%LocalAppData%\Google\Chrome\Application\chrome.exe"

if defined BROWSER (
    start "" "%BROWSER%" --app=http://localhost:8765 --start-maximized
) else (
    start http://localhost:8765
)

exit /b 0
