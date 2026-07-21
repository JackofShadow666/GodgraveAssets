@echo off
title Godgrave Launcher

:: Если перетащили файл или папку
if not "%~1"=="" goto :run

:: Если запустили без параметров — запрашиваем папку
echo ========================================
echo   🎮 GODGRAVE LAUNCHER
echo ========================================
echo.
echo Перетащите папку с игрой или index.html
echo на этот файл, или введите путь вручную:
echo.
set /p folder="Путь к папке: "
if "%folder%"=="" exit /b
goto :run

:run
:: Определяем путь
if exist "%~1" (
    if exist "%~1\index.html" (
        set "folder=%~1"
    ) else if exist "%~1" (
        set "folder=%~dp1"
    ) else (
        set "folder=%~1"
    )
) else (
    set "folder=%folder%"
)

:: Проверяем index.html
if not exist "%folder%\index.html" (
    echo ❌ Ошибка: в папке нет index.html!
    echo %folder%
    pause
    exit /b
)

echo ✅ Папка: %folder%
echo.

:: Проверяем Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    echo ❌ Python не найден!
    echo Установите Python: https://python.org/
    pause
    exit /b
)

:: Находим свободный порт
set port=8000
:findport
netstat -ano | findstr ":%port% " >nul
if %errorlevel% equ 0 (
    set /a port+=1
    goto :findport
)

echo 📡 Порт: %port%
echo 🌐 Открываем браузер...
echo.

:: Запускаем сервер в фоне
start /B python -m http.server %port% --directory "%folder%"

:: Ждём запуска сервера
timeout /t 2 /nobreak >nul

:: Открываем браузер
start http://localhost:%port%/index.html?assets=./

echo.
echo ========================================
echo   🟢 СЕРВЕР ЗАПУЩЕН
echo   📡 http://localhost:%port%
echo   🔴 Закройте это окно чтобы остановить
echo ========================================
echo.
pause >nul

:: Останавливаем сервер
taskkill /F /IM python.exe >nul 2>nul
echo ✅ Сервер остановлен