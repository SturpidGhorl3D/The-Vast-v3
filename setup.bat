@echo off

:: Проверка наличия Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js не найден. Пожалуйста, установите его с сайта https://nodejs.org/
    pause
    exit /b
)

echo Установка зависимостей...
call npm install

echo Запуск игры...
call npm run dev
pause
