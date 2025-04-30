const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const path = require('path');
const logger = require('./utils/logger');
const http = require('http');

// Инициализация приложения
const app = express();
const server = http.createServer(app);

// Логируем информацию о запуске
logger.info('Server initialized in standard mode');

// Загрузка моделей и контроллеров
const { pool, initDatabase } = require('./models/db');
const wsController = require('./controllers/wsController');

// Загрузка маршрутов
const authRoutes = require('./routes/authRoutes');
const boardRoutes = require('./routes/boardRoutes');

const { 
  APP_PORT, 
  APP_IP
} = process.env;

// Настройка статических файлов
app.use(express.static(path.join(__dirname, 'public')));
app.use('/photo', express.static(path.join(__dirname, 'photo')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Настройка сессий
const sessionStore = new (require('connect-pg-simple')(session))({
    pool: pool,
    tableName: 'session'
});

const sessionParser = session({
    store: sessionStore,
    secret: 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { 
        secure: false,
        maxAge: 1000 * 60 * 60 * 168 // 7 дней
    }
});

app.use(sessionParser);

// Логирование запросов и ответов
app.use((req, res, next) => {
    logger.request(req);
    
    res.on('finish', () => {
        logger.response(res);
    });
    
    next();
});

// Подключение маршрутов
app.use(authRoutes);
app.use(boardRoutes);

// Главная страница с проверкой авторизации
app.get('/', (req, res) => {
    if (req.session.userId) {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    } else {
        res.redirect('/login.html');
    }
});

// Инициализация WebSocket
const wss = wsController.initWebSocketServer(server, sessionParser);

// Подключение к базе данных и запуск сервера
pool.connect()
    .then(() => {
        logger.info('Successfully connected to PostgreSQL');
        return initDatabase();
    })
    .then(() => {
        server.listen(APP_PORT, APP_IP, () => {
            logger.info(`Server started`, {
                port: APP_PORT,
                ip: APP_IP,
                env: process.env.NODE_ENV,
                nodeVersion: process.version
            });
        }).on('error', (err) => {
            logger.error('Server startup error', err);
            process.exit(1);
        });
    })
    .catch(err => {
        logger.error('Startup error:', err);
        process.exit(1);
    });

// Обработка необработанных ошибок
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', err);
    process.exit(1);
});

process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Promise Rejection', err);
    process.exit(1);
});