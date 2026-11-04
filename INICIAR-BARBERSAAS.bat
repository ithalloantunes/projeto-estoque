@echo off
setlocal
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\iniciar-barbersaas.ps1"
if errorlevel 1 (
  echo.
  echo Falha ao iniciar o BarberSaaS.
  pause
  exit /b 1
)
endlocal
