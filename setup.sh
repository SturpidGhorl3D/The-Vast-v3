#!/bin/bash

# Проверка наличия Node.js
if ! command -v node &> /dev/null; then
    echo "Node.js не найден. Пожалуйста, установите его с сайта https://nodejs.org/"
    exit 1
fi

echo "Установка зависимостей..."
npm install

echo "Запуск игры..."
npm run dev
