@echo off
chcp 65001 >nul
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (echo 请先安装 Node.js 22 或更新版本。 & pause & exit /b 1)
call npm ci
if errorlevel 1 (pause & exit /b 1)
call npm test
if errorlevel 1 (pause & exit /b 1)
call npm run dist
if errorlevel 1 (pause & exit /b 1)
start "" "%~dp0dist"
pause
