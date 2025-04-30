const fs = require('fs');
const path = require('path');

// Создаем директорию для логов, если её нет
const logsDir = path.join(__dirname, '..', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Функция для получения текущей даты в формате YYYY-MM-DD
const getDate = () => {
    return new Date().toISOString().split('T')[0];
};

// Функция для получения текущего времени
const getTime = () => {
    return new Date().toISOString().split('T')[1].split('.')[0];
};

// Создаем поток для записи логов
const getLogStream = () => {
    const logFile = path.join(logsDir, `${getDate()}.log`);
    return fs.createWriteStream(logFile, { flags: 'a' });
};

// Функция для форматирования сообщения
const formatMessage = (level, message, details = null) => {
    const logMessage = {
        timestamp: `${getDate()} ${getTime()}`,
        level,
        message,
        details: details || ''
    };
    return JSON.stringify(logMessage) + '\n';
};

// Основные функции логирования
const logger = {
    info: (message, details = null) => {
        const logStream = getLogStream();
        logStream.write(formatMessage('INFO', message, details));
    },

    error: (message, details = null) => {
        const logStream = getLogStream();
        logStream.write(formatMessage('ERROR', message, details));
    },

    warn: (message, details = null) => {
        const logStream = getLogStream();
        logStream.write(formatMessage('WARN', message, details));
    },

    debug: (message, details = null) => {
        const logStream = getLogStream();
        logStream.write(formatMessage('DEBUG', message, details));
    },

    request: (req, message = 'HTTP Request') => {
        const details = {
            method: req.method,
            url: req.url,
            headers: req.headers,
            body: req.body,
            query: req.query,
            params: req.params,
            ip: req.ip
        };
        logger.debug(message, details);
    },

    response: (res, message = 'HTTP Response') => {
        const details = {
            statusCode: res.statusCode,
            headers: res.getHeaders()
        };
        logger.debug(message, details);
    }
};

module.exports = logger; 