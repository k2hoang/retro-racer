@echo off
rem Double-click to start Retro Racer. Close the server window to stop it.
cd /d "%~dp0"
start "Retro Racer server" powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0serve.ps1"
