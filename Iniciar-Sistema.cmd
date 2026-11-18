@echo off
cd /d "%~dp0"
call npm.cmd run local:start
if errorlevel 1 (
  pause
  exit /b 1
)
start "" "http://localhost:3000"
pause
