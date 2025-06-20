# GBoard
Дипломный проект "Разработка интерактивной онлайн доски для дистанционного обучения"

# Технологии
 - **Backend**: Node.js, Express, WebSockets
 - **Frontend**: HTML5, CSS3, JavaScript
 - **База данных**: PostgreSQL
 - **Аутентификация**: bcrypt

# Установка и запуск
## Требования 
 - Node.js (v14 или выше)
 - PostgreSQL (v14 или выше)
 - npm
## Шаги установки 
 1. Подготовка базы данных
  - Установите PostgreSQL, если он еще не установлен
  - Создайте новую базу данных с названием "gboard"
  - Импортируйте структуру базы данных из файла GBoard_DB.sql
 2. Настройка переменных окружения
  - Изменить файл .env в корне проекта, под свои нужды
 3. Запуск сервера
  - В терминале впишите следующую команду: node server.js.
 4. Доступ к приложению
  - Откройте браузер и перейдите по адресу: http://localhost:3000

# Демонстрационный сервер
Вы можете опробовать работу приложения на демонстрационном сервере:
https://onlinegboard.ru/

# Структура проекта
 - models/ - модели данных и взаимодействие с базой
 - controllers/ - обработчики запросов
 - routes/ - маршрутизация API
 - utils/ - утилиты и вспомогательные функции
 - public/ - клиентские файлы (HTML, CSS, JavaScript)
 - board_history/ - хранение истории рисования
